use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crossbeam_channel::Receiver;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use crate::error::SttError;
use crate::keyterms::afrikaans_bible_keyterms;
use crate::provider::SttProvider;
use crate::types::{SttConfig, TranscriptEvent};

const SONIOX_RT_URL: &str = "wss://stt-rt.soniox.com/transcribe-websocket";
const MAX_RECONNECT_ATTEMPTS: u32 = 5;
const RECONNECT_DELAY: Duration = Duration::from_secs(1);
const BATCH_SAMPLES: usize = 800;
pub const SONIOX_MODEL: &str = "stt-rt-v5";

#[derive(Debug, Deserialize)]
struct SonioxToken {
    text: String,
    #[serde(default)]
    is_final: bool,
}

#[derive(Debug, Deserialize)]
struct SonioxResponse {
    #[serde(default)]
    tokens: Vec<SonioxToken>,
    #[serde(default)]
    error_code: Option<i32>,
    #[serde(default)]
    error_message: Option<String>,
}

#[derive(Debug)]
pub struct SonioxClient {
    config: SttConfig,
    cancelled: Arc<AtomicBool>,
}

enum WsCommand {
    Audio(Vec<u8>),
    Close,
}

/// Build the initial Soniox WebSocket configuration payload.
pub(crate) fn build_start_payload(config: &SttConfig) -> serde_json::Value {
    let language = config.language.as_deref().unwrap_or("en");
    let language_hints = match language {
        "af" => vec!["af"],
        other => vec![other],
    };

    serde_json::json!({
        "api_key": config.api_key,
        "model": config.model,
        "audio_format": "pcm_s16le",
        "sample_rate": config.sample_rate,
        "num_channels": 1,
        "language_hints": language_hints,
        "enable_endpoint_detection": true,
        "context": {
            "terms": afrikaans_bible_keyterms(),
        },
    })
}

/// Parse a Soniox token stream response into transcript events.
pub(crate) fn parse_token_response(
    json: &SonioxResponse,
    finalized_text: &mut String,
) -> Result<Vec<TranscriptEvent>, SttError> {
    if let Some(message) = json.error_message.as_ref() {
        return Err(SttError::ParseError(message.clone()));
    }

    let mut events = Vec::new();
    let mut partial_parts: Vec<String> = Vec::new();
    let mut new_final_parts: Vec<String> = Vec::new();
    let mut endpoint = false;

    for token in &json.tokens {
        if token.text == "<end>" {
            endpoint = true;
            continue;
        }
        if token.is_final {
            new_final_parts.push(token.text.clone());
        } else {
            partial_parts.push(token.text.clone());
        }
    }

    if !new_final_parts.is_empty() {
        finalized_text.push_str(&new_final_parts.join(""));
    }

    let partial_transcript = format!("{}{}", finalized_text, partial_parts.join(""));
    if !partial_transcript.trim().is_empty() {
        if partial_parts.is_empty() && !new_final_parts.is_empty() {
            events.push(TranscriptEvent::Final {
                transcript: finalized_text.clone(),
                words: vec![],
                confidence: 1.0,
                speech_final: endpoint,
            });
        } else {
            events.push(TranscriptEvent::Partial {
                transcript: partial_transcript,
                words: vec![],
            });
        }
    }

    if endpoint {
        if !finalized_text.trim().is_empty() {
            events.push(TranscriptEvent::Final {
                transcript: finalized_text.clone(),
                words: vec![],
                confidence: 1.0,
                speech_final: true,
            });
        }
        events.push(TranscriptEvent::UtteranceEnd);
        finalized_text.clear();
    }

    Ok(events)
}

impl SonioxClient {
    pub fn new(config: SttConfig) -> Self {
        Self {
            config,
            cancelled: Arc::new(AtomicBool::new(false)),
        }
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
                break;
            }

            match self
                .try_connect(audio_rx.clone(), event_tx.clone(), self.cancelled.clone())
                .await
            {
                Ok(()) => break,
                Err(error) => {
                    attempts += 1;
                    log::warn!(
                        "SonioxClient: connection error (attempt {attempts}/{MAX_RECONNECT_ATTEMPTS}): {error}"
                    );
                    if attempts >= MAX_RECONNECT_ATTEMPTS {
                        let _ = event_tx
                            .send(TranscriptEvent::Error(error.to_string()))
                            .await;
                        return Err(error);
                    }
                    tokio::time::sleep(RECONNECT_DELAY).await;
                }
            }
        }

        Ok(())
    }

    #[allow(clippy::too_many_lines)]
    async fn try_connect(
        &self,
        audio_rx: Receiver<Vec<i16>>,
        event_tx: mpsc::Sender<TranscriptEvent>,
        cancelled: Arc<AtomicBool>,
    ) -> Result<(), SttError> {
        let (ws_stream, _response) = tokio_tungstenite::connect_async(SONIOX_RT_URL)
            .await
            .map_err(|e| SttError::ConnectionFailed(e.to_string()))?;

        log::info!("SonioxClient: connected to Soniox real-time API");
        let _ = event_tx.send(TranscriptEvent::Connected).await;

        let (mut write, mut read) = ws_stream.split();

        let start_payload = build_start_payload(&self.config).to_string();
        write
            .send(Message::Text(start_payload.into()))
            .await
            .map_err(|e| SttError::ConnectionFailed(e.to_string()))?;

        let send_error_flag = Arc::new(AtomicBool::new(false));
        let recv_error_flag = Arc::new(AtomicBool::new(false));
        let error_detail = Arc::new(Mutex::new(None::<String>));
        let (ws_tx, mut ws_rx) = mpsc::channel::<WsCommand>(64);

        let mut audio_reader = {
            let ws_tx = ws_tx.clone();
            let cancelled = cancelled.clone();
            tokio::task::spawn_blocking(move || {
                let mut batch_buf = Vec::with_capacity(BATCH_SAMPLES * 2);
                let batch_byte_threshold = BATCH_SAMPLES * 2;

                loop {
                    if cancelled.load(Ordering::SeqCst) {
                        let _ = ws_tx.blocking_send(WsCommand::Close);
                        break;
                    }

                    match audio_rx.recv_timeout(Duration::from_millis(50)) {
                        Ok(samples) => {
                            for sample in samples {
                                batch_buf.extend_from_slice(&sample.to_le_bytes());
                            }
                            if batch_buf.len() >= batch_byte_threshold {
                                let data = std::mem::take(&mut batch_buf);
                                if ws_tx.blocking_send(WsCommand::Audio(data)).is_err() {
                                    break;
                                }
                            }
                        }
                        Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                            if !batch_buf.is_empty() {
                                let data = std::mem::take(&mut batch_buf);
                                if ws_tx.blocking_send(WsCommand::Audio(data)).is_err() {
                                    break;
                                }
                            }
                        }
                        Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                            if !batch_buf.is_empty() {
                                let data = std::mem::take(&mut batch_buf);
                                let _ = ws_tx.blocking_send(WsCommand::Audio(data));
                            }
                            let _ = ws_tx.blocking_send(WsCommand::Close);
                            break;
                        }
                    }
                }
            })
        };

        let send_err = send_error_flag.clone();
        let send_error_detail = error_detail.clone();
        let mut ws_writer = tokio::spawn(async move {
            while let Some(cmd) = ws_rx.recv().await {
                match cmd {
                    WsCommand::Audio(data) => {
                        if let Err(e) = write.send(Message::Binary(data.into())).await {
                            send_err.store(true, Ordering::SeqCst);
                            if let Ok(mut detail) = send_error_detail.lock() {
                                *detail = Some(format!("send error: {e}"));
                            }
                            break;
                        }
                    }
                    WsCommand::Close => {
                        let _ = write.close().await;
                        break;
                    }
                }
            }
        });

        let recv_cancelled = cancelled.clone();
        let recv_err = recv_error_flag.clone();
        let recv_error_detail = error_detail.clone();
        let recv_event_tx = event_tx.clone();
        let finalized_text = Arc::new(Mutex::new(String::new()));
        let mut receiver = tokio::spawn(async move {
            while let Some(msg_result) = read.next().await {
                if recv_cancelled.load(Ordering::SeqCst) {
                    break;
                }

                match msg_result {
                    Ok(Message::Text(text)) => {
                        let parsed: SonioxResponse = match serde_json::from_str(&text) {
                            Ok(json) => json,
                            Err(error) => {
                                log::warn!("SonioxClient receiver: parse error: {error}");
                                continue;
                            }
                        };

                        let mut events = match finalized_text.lock() {
                            Ok(mut buffer) => parse_token_response(&parsed, &mut buffer),
                            Err(_) => continue,
                        };

                        if let Err(error) = &mut events {
                            log::warn!("SonioxClient receiver: token parse error: {error}");
                            continue;
                        }

                        for event in events.as_ref().unwrap() {
                            if recv_event_tx.send(event.clone()).await.is_err() {
                                return;
                            }
                        }
                    }
                    Ok(Message::Close(close)) => {
                        if !recv_cancelled.load(Ordering::SeqCst) {
                            let reason = close.as_ref().map_or_else(
                                || "server closed connection without a reason".into(),
                                |frame| {
                                    format!(
                                        "server closed connection: code={} reason={}",
                                        frame.code, frame.reason
                                    )
                                },
                            );
                            recv_err.store(true, Ordering::SeqCst);
                            if let Ok(mut detail) = recv_error_detail.lock() {
                                *detail = Some(reason);
                            }
                        }
                        break;
                    }
                    Ok(_) => {}
                    Err(error) => {
                        recv_err.store(true, Ordering::SeqCst);
                        if let Ok(mut detail) = recv_error_detail.lock() {
                            *detail = Some(format!("WebSocket error: {error}"));
                        }
                        break;
                    }
                }
            }
        });

        tokio::select! {
            _ = &mut audio_reader => {}
            _ = &mut ws_writer => {}
            _ = &mut receiver => {}
        }

        audio_reader.abort();
        ws_writer.abort();
        receiver.abort();
        let _ = tokio::join!(audio_reader, ws_writer, receiver);

        if send_error_flag.load(Ordering::SeqCst) || recv_error_flag.load(Ordering::SeqCst) {
            let detail = error_detail
                .lock()
                .ok()
                .and_then(|detail| detail.clone())
                .unwrap_or_else(|| "Connection lost unexpectedly".into());
            return Err(SttError::ConnectionFailed(detail));
        }

        let _ = event_tx.send(TranscriptEvent::Disconnected).await;
        Ok(())
    }

    pub fn stop(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }
}

#[async_trait::async_trait]
impl SttProvider for SonioxClient {
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
        "soniox"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_payload_uses_stt_rt_v5_afrikaans_hints_and_endpoint_detection() {
        let payload = build_start_payload(&SttConfig {
            api_key: "test-key".into(),
            model: SONIOX_MODEL.into(),
            sample_rate: 16_000,
            encoding: "pcm_s16le".into(),
            language: Some("af".into()),
        });

        assert_eq!(payload["model"], SONIOX_MODEL);
        assert_eq!(payload["language_hints"], serde_json::json!(["af"]));
        assert_eq!(payload["enable_endpoint_detection"], true);
        assert_eq!(payload["audio_format"], "pcm_s16le");
        assert_eq!(payload["sample_rate"], 16_000);
    }

    #[test]
    fn non_final_tokens_emit_partial_only() {
        let mut finalized = String::new();
        let events = parse_token_response(
            &SonioxResponse {
                tokens: vec![
                    SonioxToken {
                        text: "Johannes".into(),
                        is_final: false,
                    },
                    SonioxToken {
                        text: " 3".into(),
                        is_final: false,
                    },
                ],
                error_code: None,
                error_message: None,
            },
            &mut finalized,
        )
        .unwrap();

        assert_eq!(events.len(), 1);
        assert!(matches!(events[0], TranscriptEvent::Partial { .. }));
    }

    #[test]
    fn final_tokens_emit_once_for_detection() {
        let mut finalized = String::new();
        let events = parse_token_response(
            &SonioxResponse {
                tokens: vec![
                    SonioxToken {
                        text: "Johannes 3 vers 16".into(),
                        is_final: true,
                    },
                    SonioxToken {
                        text: "<end>".into(),
                        is_final: true,
                    },
                ],
                error_code: None,
                error_message: None,
            },
            &mut finalized,
        )
        .unwrap();

        assert!(
            events
                .iter()
                .any(|event| matches!(event, TranscriptEvent::Final { speech_final: true, .. }))
        );
        assert!(events.iter().any(|event| matches!(event, TranscriptEvent::UtteranceEnd)));
    }
}
