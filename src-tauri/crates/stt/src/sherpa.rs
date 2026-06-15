//! Offline sherpa-onnx streaming STT provider.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use crossbeam_channel::Receiver;
use tokio::sync::mpsc;

use crate::error::SttError;
use crate::keyterms::bible_keyterms;
use crate::provider::SttProvider;
use crate::types::TranscriptEvent;
use crate::worker::{self, WorkerTempFile, DEFAULT_CHUNK_SAMPLES};

const SHERPA_LABEL: &str = "Sherpa";

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
        let hotwords = sherpa_hotwords_text();
        let hotwords_file = write_hotwords_temp_file(&hotwords)?;
        worker::check_ready(
            SHERPA_LABEL,
            &self.model_path,
            &self.worker_path,
            |command| {
                push_worker_args(command, &self.model_path);
                push_hotwords_file_args(command, hotwords_file.path());
            },
        )
    }

    fn spawn_worker(&self, hotwords_file: &WorkerTempFile) -> Result<Child, SttError> {
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
        push_hotwords_file_args(&mut command, hotwords_file.path());
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
        .arg("modified_beam_search");
}

fn push_hotwords_file_args(command: &mut Command, hotwords_file: &Path) {
    command.arg("--hotwords-file").arg(hotwords_file);
}

fn sherpa_hotwords_text() -> String {
    let terms = bible_keyterms()
        .into_iter()
        .map(|term| term.trim().to_ascii_lowercase())
        .filter(|term| !term.is_empty())
        .collect::<BTreeSet<_>>();
    let mut text = terms.into_iter().collect::<Vec<_>>().join("\n");
    text.push('\n');
    text
}

fn write_hotwords_temp_file(contents: &str) -> Result<WorkerTempFile, SttError> {
    worker::write_worker_temp_file("sabbathcue-sherpa-hotwords-", ".txt", contents)
}

#[async_trait::async_trait]
impl SttProvider for SherpaProvider {
    async fn start(
        &self,
        audio_rx: Receiver<Vec<i16>>,
        event_tx: mpsc::Sender<TranscriptEvent>,
    ) -> Result<(), SttError> {
        let hotwords = sherpa_hotwords_text();
        let hotwords_file = write_hotwords_temp_file(&hotwords)?;
        let mut child = self.spawn_worker(&hotwords_file)?;
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
            let mut pending: Vec<i16> = Vec::with_capacity(DEFAULT_CHUNK_SAMPLES);
            loop {
                if writer_cancelled.load(Ordering::SeqCst) {
                    break;
                }
                match audio_rx.recv_timeout(Duration::from_millis(25)) {
                    Ok(samples) => {
                        pending.extend(samples);
                        while pending.len() >= DEFAULT_CHUNK_SAMPLES {
                            let chunk: Vec<i16> = pending.drain(..DEFAULT_CHUNK_SAMPLES).collect();
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

        worker::stop_writer(SHERPA_LABEL, writer).await;
        worker::stop_worker(SHERPA_LABEL, child, reader, stderr_reader);
        let _ = event_tx.send(TranscriptEvent::Disconnected).await;
        Ok(())
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

    #[test]
    fn hotwords_include_bible_terms_lowercased() {
        let hotwords = sherpa_hotwords_text();

        assert!(hotwords.lines().any(|term| term == "genesis"));
    }

    #[test]
    fn hotwords_are_deduplicated() {
        let hotwords = sherpa_hotwords_text();
        let terms = hotwords.lines().collect::<Vec<_>>();
        let unique = terms.iter().copied().collect::<BTreeSet<_>>();

        assert_eq!(terms.len(), unique.len());
    }

    #[test]
    fn write_hotwords_temp_file_writes_line_delimited_phrases() {
        let hotwords = sherpa_hotwords_text();
        let temp = write_hotwords_temp_file(&hotwords).expect("temp hotwords file");
        let contents =
            std::fs::read_to_string(temp.path()).expect("hotwords temp file should exist");

        assert!(contents.lines().any(|term| term == "revelation"));
    }

    #[test]
    fn worker_args_include_model_dir_sample_rate_and_decoding_method() {
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
    }

    #[test]
    fn worker_args_include_hotwords_file() {
        let temp = tempfile::NamedTempFile::new().expect("temp file");
        let mut command = Command::new("worker");
        push_hotwords_file_args(&mut command, temp.path());
        let args = worker::collect_command_args(&command);

        assert!(args
            .windows(2)
            .any(|w| { w[0] == "--hotwords-file" && w[1] == temp.path().to_string_lossy() }));
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
