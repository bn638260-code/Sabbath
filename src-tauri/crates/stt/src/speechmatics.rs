use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use crossbeam_channel::Receiver;
use futures_util::{SinkExt, Stream, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

use crate::error::SttError;
use crate::provider::SttProvider;
use crate::types::{SttConfig, TranscriptEvent, Word};

const SPEECHMATICS_RT_URL: &str = "wss://eu2.rt.speechmatics.com/v2";
const BATCH_SAMPLES: usize = 800;
const MAX_RECONNECT_ATTEMPTS: u32 = 5;
pub const SPEECHMATICS_MODEL: &str = "standard";

#[derive(Debug, Deserialize, Default)]
struct Metadata {
    #[serde(default)]
    transcript: String,
}

#[derive(Debug, Deserialize, Default)]
struct Alternative {
    #[serde(default)]
    content: String,
    #[serde(default)]
    confidence: f64,
}

#[derive(Debug, Deserialize, Default)]
struct ResultItem {
    #[serde(default)]
    start_time: f64,
    #[serde(default)]
    end_time: f64,
    #[serde(default, rename = "type")]
    result_type: String,
    #[serde(default)]
    alternatives: Vec<Alternative>,
}

#[derive(Debug, Deserialize, Default)]
struct Response {
    #[serde(default)]
    message: String,
    #[serde(default, rename = "type")]
    error_type: String,
    #[serde(default)]
    reason: String,
    #[serde(default)]
    metadata: Metadata,
    #[serde(default)]
    results: Vec<ResultItem>,
}

#[derive(Debug)]
pub struct SpeechmaticsClient {
    config: SttConfig,
    cancelled: Arc<AtomicBool>,
}

enum AudioCommand {
    Data(Vec<u8>),
    Finish(u64),
}

async fn open_speechmatics_stream(
    api_key: &str,
) -> Result<WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>, SttError> {
    let mut request = SPEECHMATICS_RT_URL
        .into_client_request()
        .map_err(|error| SttError::ConnectionFailed(error.to_string()))?;
    request.headers_mut().insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {api_key}"))
            .map_err(|error| SttError::ConnectionFailed(error.to_string()))?,
    );
    tokio_tungstenite::connect_async(request)
        .await
        .map(|(stream, _)| stream)
        .map_err(|error| SttError::ConnectionFailed(error.to_string()))
}

async fn wait_for_recognition_started<R>(read: &mut R) -> Result<(), SttError>
where
    R: Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    loop {
        let frame = tokio::time::timeout(Duration::from_secs(15), read.next())
            .await
            .map_err(|_| SttError::ConnectionFailed("Speechmatics startup timed out".into()))?
            .ok_or_else(|| SttError::ConnectionFailed("Speechmatics closed at startup".into()))?
            .map_err(|error| SttError::ConnectionFailed(error.to_string()))?;
        if let Message::Text(text) = frame {
            let response: Response = serde_json::from_str(&text)
                .map_err(|error| SttError::ParseError(error.to_string()))?;
            if response.message == "RecognitionStarted" {
                return Ok(());
            }
            if response.message == "Error" {
                return Err(parse_response(&text).unwrap_err());
            }
        }
    }
}

fn spawn_audio_reader(
    audio_rx: Receiver<Vec<i16>>,
    audio_tx: mpsc::Sender<AudioCommand>,
    cancelled: Arc<AtomicBool>,
) -> tokio::task::JoinHandle<()> {
    tokio::task::spawn_blocking(move || {
        let mut batch = Vec::with_capacity(BATCH_SAMPLES * 2);
        let mut sequence = 0_u64;
        loop {
            if cancelled.load(Ordering::SeqCst) {
                let _ = audio_tx.blocking_send(AudioCommand::Finish(sequence));
                return;
            }
            match audio_rx.recv_timeout(Duration::from_millis(50)) {
                Ok(samples) => {
                    for sample in samples {
                        batch.extend_from_slice(&sample.to_le_bytes());
                    }
                    if batch.len() >= BATCH_SAMPLES * 2 {
                        sequence += 1;
                        if audio_tx
                            .blocking_send(AudioCommand::Data(std::mem::take(&mut batch)))
                            .is_err()
                        {
                            return;
                        }
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                    if !batch.is_empty() {
                        sequence += 1;
                        if audio_tx
                            .blocking_send(AudioCommand::Data(std::mem::take(&mut batch)))
                            .is_err()
                        {
                            return;
                        }
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                    if !batch.is_empty() {
                        sequence += 1;
                        let _ =
                            audio_tx.blocking_send(AudioCommand::Data(std::mem::take(&mut batch)));
                    }
                    let _ = audio_tx.blocking_send(AudioCommand::Finish(sequence));
                    return;
                }
            }
        }
    })
}

pub(crate) fn build_start_payload(config: &SttConfig) -> serde_json::Value {
    serde_json::json!({
        "message": "StartRecognition",
        "audio_format": {
            "type": "raw",
            "encoding": "pcm_s16le",
            "sample_rate": config.sample_rate,
        },
        "transcription_config": {
            "language": config.language.as_deref().unwrap_or("en"),
            "operating_point": config.model,
            "enable_partials": true,
            "max_delay": 2.0,
            "max_delay_mode": "flexible",
        },
    })
}

fn response_text(response: &Response) -> String {
    if !response.metadata.transcript.trim().is_empty() {
        return response.metadata.transcript.trim().to_string();
    }

    let mut text = String::new();
    for result in &response.results {
        let Some(alternative) = result.alternatives.first() else {
            continue;
        };
        let content = alternative.content.trim();
        if result.result_type == "punctuation" {
            text.push_str(content);
        } else if !content.is_empty() {
            if !text.is_empty() {
                text.push(' ');
            }
            text.push_str(content);
        }
    }
    text
}

fn response_words(response: &Response) -> Vec<Word> {
    response
        .results
        .iter()
        .filter(|item| item.result_type == "word")
        .filter_map(|item| {
            let alternative = item.alternatives.first()?;
            Some(Word {
                text: alternative.content.clone(),
                start: item.start_time,
                end: item.end_time,
                confidence: alternative.confidence,
                punctuated_word: Some(alternative.content.clone()),
            })
        })
        .collect()
}

fn parse_response(text: &str) -> Result<(Vec<TranscriptEvent>, bool), SttError> {
    let response: Response =
        serde_json::from_str(text).map_err(|error| SttError::ParseError(error.to_string()))?;
    if response.message == "Error" {
        let detail = if response.reason.is_empty() {
            response.error_type
        } else {
            format!("{}: {}", response.error_type, response.reason)
        };
        return Err(SttError::ParseError(format!(
            "Speechmatics error: {detail}"
        )));
    }

    let transcript = response_text(&response);
    let words = response_words(&response);
    let confidence = if words.is_empty() {
        1.0
    } else {
        let word_count = u32::try_from(words.len()).map_err(|_| {
            SttError::ParseError("Speechmatics response contained too many words".into())
        })?;
        words.iter().map(|word| word.confidence).sum::<f64>() / f64::from(word_count)
    };
    let events = match response.message.as_str() {
        "AddPartialTranscript" if !transcript.is_empty() => {
            vec![TranscriptEvent::Partial { transcript, words }]
        }
        "AddTranscript" if !transcript.is_empty() => vec![
            TranscriptEvent::Final {
                transcript,
                words,
                confidence,
                speech_final: true,
            },
            TranscriptEvent::UtteranceEnd,
        ],
        _ => vec![],
    };
    Ok((events, response.message == "EndOfTranscript"))
}

impl SpeechmaticsClient {
    pub fn new(config: SttConfig) -> Self {
        Self {
            config,
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    async fn try_connect(
        &self,
        audio_rx: Receiver<Vec<i16>>,
        event_tx: mpsc::Sender<TranscriptEvent>,
    ) -> Result<(), SttError> {
        let stream = open_speechmatics_stream(&self.config.api_key).await?;
        let (mut write, mut read) = stream.split();
        write
            .send(Message::Text(
                build_start_payload(&self.config).to_string().into(),
            ))
            .await
            .map_err(|error| SttError::SendError(error.to_string()))?;

        wait_for_recognition_started(&mut read).await?;
        let _ = event_tx.send(TranscriptEvent::Connected).await;

        let (audio_tx, mut audio_commands) = mpsc::channel::<AudioCommand>(64);
        let audio_reader = spawn_audio_reader(audio_rx, audio_tx, self.cancelled.clone());

        let mut finishing = false;
        loop {
            tokio::select! {
                command = audio_commands.recv(), if !finishing => match command {
                    Some(AudioCommand::Data(data)) => write.send(Message::Binary(data.into()))
                        .await.map_err(|error| SttError::SendError(error.to_string()))?,
                    Some(AudioCommand::Finish(last_seq_no)) => {
                        finishing = true;
                        let end = serde_json::json!({"message": "EndOfStream", "last_seq_no": last_seq_no});
                        write.send(Message::Text(end.to_string().into())).await
                            .map_err(|error| SttError::SendError(error.to_string()))?;
                    }
                    None => break,
                },
                frame = read.next() => match frame {
                    Some(Ok(Message::Text(text))) => {
                        let (events, ended) = parse_response(&text)?;
                        for event in events {
                            if event_tx.send(event).await.is_err() {
                                audio_reader.abort();
                                return Ok(());
                            }
                        }
                        if ended { break; }
                    }
                    Some(Ok(Message::Close(close))) if finishing => {
                        log::info!("Speechmatics closed after EndOfStream: {close:?}");
                        break;
                    }
                    Some(Ok(Message::Close(close))) => {
                        audio_reader.abort();
                        return Err(SttError::ConnectionFailed(format!("Speechmatics closed: {close:?}")));
                    }
                    Some(Ok(_)) => {}
                    Some(Err(error)) => {
                        audio_reader.abort();
                        return Err(SttError::ConnectionFailed(error.to_string()));
                    }
                    None if finishing => break,
                    None => {
                        audio_reader.abort();
                        return Err(SttError::ConnectionFailed("Speechmatics connection ended".into()));
                    }
                }
            }
        }
        audio_reader.abort();
        let _ = write.close().await;
        let _ = event_tx.send(TranscriptEvent::Disconnected).await;
        Ok(())
    }

    pub async fn connect(
        &self,
        audio_rx: Receiver<Vec<i16>>,
        event_tx: mpsc::Sender<TranscriptEvent>,
    ) -> Result<(), SttError> {
        if self.config.api_key.trim().is_empty() {
            return Err(SttError::ApiKeyMissing);
        }
        let mut attempts = 0;
        loop {
            if self.cancelled.load(Ordering::SeqCst) {
                return Ok(());
            }
            match self.try_connect(audio_rx.clone(), event_tx.clone()).await {
                Ok(()) => return Ok(()),
                Err(error @ (SttError::ParseError(_) | SttError::ApiKeyMissing)) => {
                    return Err(error)
                }
                Err(error) => {
                    attempts += 1;
                    if attempts >= MAX_RECONNECT_ATTEMPTS {
                        return Err(error);
                    }
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }
}

#[async_trait::async_trait]
impl SttProvider for SpeechmaticsClient {
    async fn start(
        &self,
        audio_rx: Receiver<Vec<i16>>,
        event_tx: mpsc::Sender<TranscriptEvent>,
    ) -> Result<(), SttError> {
        self.connect(audio_rx, event_tx).await
    }

    fn stop(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    fn name(&self) -> &'static str {
        "speechmatics"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_payload_uses_live_pcm_and_language() {
        let payload = build_start_payload(&SttConfig {
            api_key: "secret".into(),
            model: SPEECHMATICS_MODEL.into(),
            sample_rate: 16_000,
            encoding: "pcm_s16le".into(),
            language: Some("af".into()),
        });
        assert_eq!(payload["message"], "StartRecognition");
        assert_eq!(payload["audio_format"]["encoding"], "pcm_s16le");
        assert_eq!(payload["transcription_config"]["language"], "af");
        assert_eq!(payload["transcription_config"]["enable_partials"], true);
    }

    #[test]
    fn parses_partial_final_and_error_messages() {
        let partial =
            r#"{"message":"AddPartialTranscript","metadata":{"transcript":"Revelation seven"}}"#;
        assert!(matches!(
            parse_response(partial).unwrap().0.as_slice(),
            [TranscriptEvent::Partial { .. }]
        ));

        let final_text = r#"{"message":"AddTranscript","metadata":{"transcript":"Revelation seven verse thirteen"}}"#;
        let events = parse_response(final_text).unwrap().0;
        assert!(matches!(
            events[0],
            TranscriptEvent::Final {
                speech_final: true,
                ..
            }
        ));
        assert!(matches!(events[1], TranscriptEvent::UtteranceEnd));

        let error = r#"{"message":"Error","type":"not_authorised","reason":"invalid key"}"#;
        assert!(parse_response(error)
            .unwrap_err()
            .to_string()
            .contains("not_authorised"));
    }
}
