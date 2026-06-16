//! Offline sherpa-onnx streaming STT provider.

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use crossbeam_channel::Receiver;
use tokio::sync::mpsc;

use crate::error::SttError;
use crate::provider::SttProvider;
use crate::types::TranscriptEvent;
use crate::worker;

const SHERPA_LABEL: &str = "Sherpa";
const SHERPA_CHUNK_SAMPLES: usize = 1_600;
const SHERPA_ENDPOINT_RULE1_SILENCE: &str = "1.2";
const SHERPA_ENDPOINT_RULE2_SILENCE: &str = "0.6";

#[derive(Debug)]
pub struct SherpaProvider {
    model_path: PathBuf,
    worker_path: PathBuf,
    cancelled: Arc<AtomicBool>,
}

impl SherpaProvider {
    pub fn new(model_path: PathBuf, worker_path: PathBuf) -> Self {
        Self {
            model_path,
            worker_path,
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn check_ready(&self) -> Result<(), SttError> {
        worker::check_ready(
            SHERPA_LABEL,
            &self.model_path,
            &self.worker_path,
            |command| {
                push_worker_args(command, &self.model_path);
            },
        )
    }

    fn spawn_worker(&self) -> Result<Child, SttError> {
        if !self.model_path.exists() {
            return Err(SttError::ConnectionFailed(format!(
                "Sherpa model not found: {}",
                self.model_path.display()
            )));
        }
        if !self.worker_path.exists() {
            return Err(SttError::ConnectionFailed(format!(
                "Sherpa worker not found: {}",
                self.worker_path.display()
            )));
        }

        let mut command = worker::worker_command(&self.worker_path);
        push_worker_args(&mut command, &self.model_path);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| SttError::ConnectionFailed(format!("failed to start Sherpa worker: {e}")))
    }
}

fn push_worker_args(command: &mut Command, model_path: &Path) {
    command
        .arg("--model-dir")
        .arg(worker::simplify_model_path(model_path))
        .arg("--sample-rate")
        .arg("16000")
        .arg("--decoding-method")
        .arg("modified_beam_search")
        .arg("--num-threads")
        .arg("1")
        .arg("--chunk-samples")
        .arg(SHERPA_CHUNK_SAMPLES.to_string())
        .arg("--rule1-min-trailing-silence")
        .arg(SHERPA_ENDPOINT_RULE1_SILENCE)
        .arg("--rule2-min-trailing-silence")
        .arg(SHERPA_ENDPOINT_RULE2_SILENCE);
}

#[async_trait::async_trait]
impl SttProvider for SherpaProvider {
    async fn start(
        &self,
        audio_rx: Receiver<Vec<i16>>,
        event_tx: mpsc::Sender<TranscriptEvent>,
    ) -> Result<(), SttError> {
        self.cancelled.store(false, Ordering::SeqCst);
        let cancel_on_drop = worker::CancellationGuard::new(self.cancelled.clone());
        let mut child = self.spawn_worker()?;
        let Some(mut stdin) = child.stdin.take() else {
            worker::terminate_child(SHERPA_LABEL, &mut child);
            return Err(SttError::ConnectionFailed(
                "failed to open Sherpa stdin".to_string(),
            ));
        };
        let Some(stdout) = child.stdout.take() else {
            worker::terminate_child(SHERPA_LABEL, &mut child);
            return Err(SttError::ConnectionFailed(
                "failed to open Sherpa stdout".to_string(),
            ));
        };
        let Some(stderr) = child.stderr.take() else {
            worker::terminate_child(SHERPA_LABEL, &mut child);
            return Err(SttError::ConnectionFailed(
                "failed to open Sherpa stderr".to_string(),
            ));
        };

        let reader = match worker::spawn_reader(SHERPA_LABEL, stdout, event_tx.clone()) {
            Ok(reader) => reader,
            Err(error) => {
                worker::terminate_child(SHERPA_LABEL, &mut child);
                return Err(error);
            }
        };
        let stderr_reader = match worker::spawn_stderr_logger(SHERPA_LABEL, stderr) {
            Ok(reader) => reader,
            Err(error) => {
                worker::terminate_child(SHERPA_LABEL, &mut child);
                return Err(error);
            }
        };

        let writer_cancelled = self.cancelled.clone();
        let writer = tokio::task::spawn_blocking(move || {
            let mut pending: Vec<i16> = Vec::with_capacity(SHERPA_CHUNK_SAMPLES);
            loop {
                if writer_cancelled.load(Ordering::SeqCst) {
                    break;
                }
                match audio_rx.recv_timeout(Duration::from_millis(25)) {
                    Ok(samples) => {
                        pending.extend(samples);
                        while pending.len() >= SHERPA_CHUNK_SAMPLES {
                            let chunk: Vec<i16> = pending.drain(..SHERPA_CHUNK_SAMPLES).collect();
                            worker::write_samples(SHERPA_LABEL, &mut stdin, &chunk)?;
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                        if !pending.is_empty() {
                            worker::write_samples(SHERPA_LABEL, &mut stdin, &pending)?;
                            pending.clear();
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => break,
                }
            }
            if !pending.is_empty() {
                worker::write_samples(SHERPA_LABEL, &mut stdin, &pending)?;
            }
            Ok::<(), SttError>(())
        });

        let mut process = worker::WorkerProcess::new(SHERPA_LABEL, child, reader, stderr_reader);
        let run_result = worker::wait_for_worker_shutdown(
            SHERPA_LABEL,
            self.cancelled.as_ref(),
            &mut process,
            &writer,
        )
        .await;
        cancel_on_drop.cancel();
        worker::stop_writer(SHERPA_LABEL, writer).await;
        process.stop();
        let _ = event_tx.send(TranscriptEvent::Disconnected).await;
        run_result
    }

    fn stop(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    fn name(&self) -> &'static str {
        "sherpa"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn bundled_worker_start_keeps_provider_alive_until_audio_disconnect() {
        let model_path = project_root()
            .join("models")
            .join("sherpa")
            .join("sherpa-onnx-streaming-zipformer-en-2023-06-26");
        let worker_path = project_root()
            .join("sidecars")
            .join("sherpa_worker")
            .join("sherpa_worker.exe");

        if !model_path.exists() || !worker_path.exists() {
            eprintln!(
                "Skipping bundled Sherpa lifecycle test: model={} worker={}",
                model_path.display(),
                worker_path.display()
            );
            return;
        }

        let provider = SherpaProvider::new(model_path, worker_path);
        let (audio_tx, audio_rx) = crossbeam_channel::bounded::<Vec<i16>>(2);
        let (event_tx, mut event_rx) = mpsc::channel::<TranscriptEvent>(8);
        let handle = tokio::spawn(async move { provider.start(audio_rx, event_tx).await });

        let connected = tokio::time::timeout(Duration::from_secs(60), async {
            while let Some(event) = event_rx.recv().await {
                match event {
                    TranscriptEvent::Connected => return true,
                    TranscriptEvent::Error(error) => panic!("Sherpa worker error: {error}"),
                    TranscriptEvent::Partial { .. }
                    | TranscriptEvent::Final { .. }
                    | TranscriptEvent::UtteranceEnd
                    | TranscriptEvent::SpeechStarted
                    | TranscriptEvent::Disconnected => {}
                }
            }
            false
        })
        .await
        .expect("Sherpa worker should report ready within the cold-start timeout");

        assert!(connected, "Sherpa worker event stream ended before ready");

        tokio::time::sleep(Duration::from_millis(2_500)).await;
        assert!(
            !handle.is_finished(),
            "Sherpa provider must stay alive while audio is still connected"
        );

        drop(audio_tx);
        let result = tokio::time::timeout(Duration::from_secs(5), handle)
            .await
            .expect("Sherpa provider should stop after audio disconnect")
            .expect("Sherpa provider task should not panic");

        assert!(
            result.is_ok(),
            "Sherpa provider should stop cleanly after audio disconnect: {result:?}"
        );
    }

    fn project_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("..")
    }

    #[test]
    fn worker_args_include_streaming_latency_settings() {
        let mut command = Command::new("worker");
        push_worker_args(&mut command, Path::new("C:/models/sherpa/model"));
        let args = worker::collect_command_args(&command);

        assert!(args
            .windows(2)
            .any(|w| w[0] == "--model-dir" && w[1].ends_with("model")));
        assert!(args
            .windows(2)
            .any(|w| w[0] == "--sample-rate" && w[1] == "16000"));
        assert!(args
            .windows(2)
            .any(|w| w[0] == "--decoding-method" && w[1] == "modified_beam_search"));
        assert!(args
            .windows(2)
            .any(|w| w[0] == "--chunk-samples" && w[1] == "1600"));
        assert!(args
            .windows(2)
            .any(|w| w[0] == "--num-threads" && w[1] == "1"));
        assert!(args
            .windows(2)
            .any(|w| w[0] == "--rule2-min-trailing-silence" && w[1] == "0.6"));
        assert!(!args.iter().any(|arg| arg == "--hotwords-file"));
    }

    #[test]
    fn check_ready_reports_missing_model() {
        let temp = tempfile::tempdir().expect("temp dir");
        let worker_path = temp.path().join("sherpa_worker.exe");
        std::fs::write(&worker_path, b"stub").expect("stub worker");

        let provider = SherpaProvider::new(temp.path().join("missing-model"), worker_path);
        let error = provider.check_ready().expect_err("missing model must fail");

        assert!(
            error.to_string().contains("Sherpa model not found"),
            "error should mention the missing model, got: {error}"
        );
    }

    #[test]
    fn check_ready_reports_missing_worker() {
        let temp = tempfile::tempdir().expect("temp dir");
        let model_path = temp.path().join("model");
        std::fs::create_dir_all(&model_path).expect("model dir");

        let provider = SherpaProvider::new(model_path, temp.path().join("missing-worker.exe"));
        let error = provider
            .check_ready()
            .expect_err("missing worker must fail");

        assert!(
            error.to_string().contains("Sherpa worker not found"),
            "error should mention the missing worker, got: {error}"
        );
    }
}
