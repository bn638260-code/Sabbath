use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crossbeam_channel::Receiver;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use crate::error::SttError;
use crate::provider::SttProvider;
use crate::types::{SttConfig, TranscriptEvent};

const GLADIA_LIVE_URL: &str = "https://api.gladia.io/v2/live";
const MAX_RECONNECT_ATTEMPTS: u32 = 5;
const RECONNECT_DELAY: Duration = Duration::from_secs(1);
const BATCH_SAMPLES: usize = 800;

#[derive(Debug, Deserialize)]
struct GladiaLiveSession {
    #[allow(dead_code)]
    id: String,
    url: String,
}

#[derive(Debug)]
pub struct GladiaClient {
    config: SttConfig,
    cancelled: Arc<AtomicBool>,
}

enum WsCommand {
    Audio(Vec<u8>),
    Close,
}

impl GladiaClient {
    pub fn new(config: SttConfig) -> Self {
        Self {
            config,
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    async fn create_live_session(&self) -> Result<GladiaLiveSession, SttError> {
        if self.config.api_key.trim().is_empty() {
            return Err(SttError::ApiKeyMissing);
        }

        let body = serde_json::json!({
            "encoding": self.config.encoding,
            "sample_rate": self.config.sample_rate,
            "bit_depth": 16,
            "channels": 1,
            "model": self.config.model,
            "language_config": {
                "languages": [self.config.language.as_deref().unwrap_or("en")],
                "code_switching": false
            },
            "messages_config": {
                "receive_partial_transcripts": true
            }
        });

        let response = reqwest::Client::new()
            .post(GLADIA_LIVE_URL)
            .header("x-gladia-key", &self.config.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| SttError::ConnectionFailed(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(SttError::ConnectionFailed(format!(
                "Gladia live session failed with HTTP {status}: {body}"
            )));
        }

        response
            .json::<GladiaLiveSession>()
            .await
            .map_err(|e| SttError::ConnectionFailed(e.to_string()))
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
                        "GladiaClient: connection error (attempt {attempts}/{MAX_RECONNECT_ATTEMPTS}): {error}"
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
        let session = self.create_live_session().await?;
        let (ws_stream, _response) = tokio_tungstenite::connect_async(&session.url)
            .await
            .map_err(|e| SttError::ConnectionFailed(e.to_string()))?;

        log::info!("GladiaClient: connected to Gladia live session");
        let _ = event_tx.send(TranscriptEvent::Connected).await;

        let (mut write, mut read) = ws_stream.split();
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
                        let stop = serde_json::json!({"type": "stop_recording"}).to_string();
                        let _ = write.send(Message::Text(stop.into())).await;
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
        let mut receiver = tokio::spawn(async move {
            while let Some(msg_result) = read.next().await {
                if recv_cancelled.load(Ordering::SeqCst) {
                    break;
                }

                match msg_result {
                    Ok(Message::Text(text)) => {
                        if let Err(error) = parse_and_send(&text, &recv_event_tx).await {
                            log::warn!("GladiaClient receiver: parse error: {error}");
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
}

pub(crate) async fn parse_and_send(
    text: &str,
    event_tx: &mpsc::Sender<TranscriptEvent>,
) -> Result<(), SttError> {
    let json: serde_json::Value =
        serde_json::from_str(text).map_err(|e| SttError::ParseError(e.to_string()))?;

    if json.get("type").and_then(|v| v.as_str()) != Some("transcript") {
        return Ok(());
    }

    let data = json.get("data").unwrap_or(&serde_json::Value::Null);
    let utterance = data.get("utterance").unwrap_or(&serde_json::Value::Null);
    let transcript = utterance
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if transcript.trim().is_empty() {
        return Ok(());
    }

    let is_final = data
        .get("is_final")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);

    let event = if is_final {
        TranscriptEvent::Final {
            transcript,
            words: vec![],
            confidence: utterance
                .get("confidence")
                .and_then(serde_json::Value::as_f64)
                .unwrap_or(1.0),
            speech_final: true,
        }
    } else {
        TranscriptEvent::Partial {
            transcript,
            words: vec![],
        }
    };

    event_tx
        .send(event)
        .await
        .map_err(|e| SttError::SendError(e.to_string()))
}

#[async_trait::async_trait]
impl SttProvider for GladiaClient {
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
        "gladia"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn parse_one(payload: &str) -> Option<TranscriptEvent> {
        let (tx, mut rx) = mpsc::channel(4);
        parse_and_send(payload, &tx).await.unwrap();
        rx.try_recv().ok()
    }

    #[tokio::test]
    async fn parses_partial_transcript() {
        let event = parse_one(
            r#"{"type":"transcript","data":{"is_final":false,"utterance":{"text":"John three sixteen"}}}"#,
        )
        .await;

        match event {
            Some(TranscriptEvent::Partial { transcript, words }) => {
                assert_eq!(transcript, "John three sixteen");
                assert!(words.is_empty());
            }
            other => panic!("expected partial transcript, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn parses_final_transcript_with_default_confidence() {
        let event = parse_one(
            r#"{"type":"transcript","data":{"is_final":true,"utterance":{"text":"John 3:16"}}}"#,
        )
        .await;

        match event {
            Some(TranscriptEvent::Final {
                transcript,
                words,
                confidence,
                speech_final,
            }) => {
                assert_eq!(transcript, "John 3:16");
                assert!(words.is_empty());
                assert!((confidence - 1.0).abs() < f64::EPSILON);
                assert!(speech_final);
            }
            other => panic!("expected final transcript, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn parses_final_transcript_with_confidence() {
        let event = parse_one(
            r#"{"type":"transcript","data":{"is_final":true,"utterance":{"text":"Psalm 23","confidence":0.92}}}"#,
        )
        .await;

        match event {
            Some(TranscriptEvent::Final { confidence, .. }) => {
                assert!((confidence - 0.92).abs() < f64::EPSILON);
            }
            other => panic!("expected final transcript, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn ignores_non_transcript_messages() {
        let event = parse_one(r#"{"type":"audio_chunk","data":{"ok":true}}"#).await;

        assert!(event.is_none());
    }
}
