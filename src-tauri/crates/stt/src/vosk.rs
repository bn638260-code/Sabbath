//! Offline Vosk STT provider.
//!
//! The provider streams 16 kHz mono PCM to a small worker process. Production
//! builds can bundle the worker as a self-contained executable; development
//! builds can still run the Python script directly.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStderr, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use crossbeam_channel::Receiver;
use serde::Deserialize;
use tokio::sync::mpsc;

use crate::error::SttError;
use crate::keyterms::verse_only_keyterms;
use crate::provider::SttProvider;
use crate::types::{TranscriptEvent, Word};

/// 50ms at 16 kHz. A small latency tradeoff gives Vosk more acoustic context
/// per pass, which helps short Bible references land more consistently.
const DEFAULT_CHUNK_SAMPLES: usize = 800;
const CHECK_READY_TIMEOUT: Duration = Duration::from_secs(20);
const PREFLIGHT_CACHE_TTL: Duration = Duration::from_secs(600);

static PREFLIGHT_CACHE: OnceLock<Mutex<HashMap<(PathBuf, PathBuf), Instant>>> = OnceLock::new();

fn preflight_cache() -> &'static Mutex<HashMap<(PathBuf, PathBuf), Instant>> {
    PREFLIGHT_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn preflight_cache_hit(model_path: &Path, worker_path: &Path) -> bool {
    let Ok(cache) = preflight_cache().lock() else {
        return false;
    };
    let Some(validated_at) = cache.get(&(model_path.to_path_buf(), worker_path.to_path_buf())) else {
        return false;
    };
    validated_at.elapsed() < PREFLIGHT_CACHE_TTL
}

fn record_preflight_success(model_path: &Path, worker_path: &Path) {
    let Ok(mut cache) = preflight_cache().lock() else {
        return;
    };
    cache.insert(
        (model_path.to_path_buf(), worker_path.to_path_buf()),
        Instant::now(),
    );
}

#[derive(Debug)]
pub struct VoskProvider {
    model_path: PathBuf,
    worker_path: PathBuf,
    cancelled: Arc<AtomicBool>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum WorkerEvent {
    Ready,
    Partial {
        text: String,
        #[serde(default)]
        words: Vec<VoskWord>,
    },
    Final {
        text: String,
        #[serde(default)]
        words: Vec<VoskWord>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Deserialize)]
struct VoskWord {
    word: String,
    start: f64,
    end: f64,
    #[serde(default)]
    conf: f64,
}

impl VoskProvider {
    pub fn new(model_path: PathBuf, worker_path: PathBuf) -> Self {
        Self {
            model_path,
            worker_path,
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn check_ready(&self) -> Result<(), SttError> {
        if !self.model_path.exists() {
            return Err(SttError::ConnectionFailed(format!(
                "Vosk model not found: {}",
                self.model_path.display()
            )));
        }
        if !self.worker_path.exists() {
            return Err(SttError::ConnectionFailed(format!(
                "Vosk worker not found: {}",
                self.worker_path.display()
            )));
        }

        if preflight_cache_hit(&self.model_path, &self.worker_path) {
            log::info!(
                "Vosk preflight skipped; worker and model validated recently (model={}, worker={})",
                self.model_path.display(),
                self.worker_path.display()
            );
            return Ok(());
        }

        let grammar_json = vosk_grammar_json()?;
        let grammar_file = write_grammar_temp_file(&grammar_json)?;
        let mut command = worker_command(&self.worker_path);
        push_worker_args(&mut command, &self.model_path);
        push_grammar_file_args(&mut command, grammar_file.path());
        command.stdin(Stdio::null());
        let started_at = Instant::now();
        log::info!(
            "Checking Vosk worker readiness: model={}, worker={}",
            self.model_path.display(),
            self.worker_path.display()
        );
        let mut child = command
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| SttError::ConnectionFailed(format!("failed to start Vosk worker: {e}")))?;

        let stdout = child.stdout.take().ok_or_else(|| {
            terminate_vosk_child(&mut child);
            SttError::ConnectionFailed("failed to open Vosk preflight stdout".to_string())
        })?;
        let (event_tx, event_rx) = std::sync::mpsc::channel::<WorkerEvent>();
        let reader = std::thread::Builder::new()
            .name("vosk-preflight-reader".into())
            .spawn(move || {
                for line in BufReader::new(stdout).lines() {
                    let Ok(line) = line else { break };
                    if let Ok(event) = serde_json::from_str::<WorkerEvent>(&line) {
                        let _ = event_tx.send(event);
                    }
                }
            })
            .map_err(|e| {
                terminate_vosk_child(&mut child);
                SttError::ConnectionFailed(format!("failed to spawn Vosk preflight reader: {e}"))
            })?;

        let mut ready = false;
        let deadline = started_at + CHECK_READY_TIMEOUT;
        loop {
            match event_rx.recv_timeout(Duration::from_millis(100)) {
                Ok(WorkerEvent::Ready) => {
                    ready = true;
                    break;
                }
                Ok(WorkerEvent::Error { message }) => {
                    terminate_vosk_child(&mut child);
                    let _ = reader.join();
                    return Err(SttError::ConnectionFailed(message));
                }
                Ok(WorkerEvent::Partial { .. } | WorkerEvent::Final { .. }) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }

            if let Ok(Some(status)) = child.try_wait() {
                let stderr = child
                    .stderr
                    .take()
                    .map_or_else(String::new, |stderr| {
                        let mut bytes = Vec::new();
                        let _ = BufReader::new(stderr).read_to_end(&mut bytes);
                        first_nonempty_lines(&bytes, 6)
                    });
                let _ = reader.join();
                return Err(SttError::ConnectionFailed(format!(
                    "Vosk worker preflight exited before ready with status {status}.{}",
                    stderr_suffix(&stderr)
                )));
            }

            if Instant::now() >= deadline {
                terminate_vosk_child(&mut child);
                let _ = reader.join();
                return Err(SttError::ConnectionFailed(format!(
                    "Vosk worker did not report ready within {} seconds",
                    CHECK_READY_TIMEOUT.as_secs()
                )));
            }
        }

        terminate_vosk_child(&mut child);
        let _ = reader.join();
        if ready {
            log::info!(
                "Vosk worker readiness check passed in {}ms",
                started_at.elapsed().as_millis()
            );
            record_preflight_success(&self.model_path, &self.worker_path);
            Ok(())
        } else {
            Err(SttError::ConnectionFailed(
                "Vosk worker exited without reporting ready".to_string(),
            ))
        }
    }

    fn spawn_worker(&self, grammar_file: &GrammarTempFile) -> Result<Child, SttError> {
        if !self.model_path.exists() {
            return Err(SttError::ConnectionFailed(format!(
                "Vosk model not found: {}",
                self.model_path.display()
            )));
        }
        if !self.worker_path.exists() {
            return Err(SttError::ConnectionFailed(format!(
                "Vosk worker not found: {}",
                self.worker_path.display()
            )));
        }

        let mut command = worker_command(&self.worker_path);
        push_worker_args(&mut command, &self.model_path);
        push_grammar_file_args(&mut command, grammar_file.path());
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| SttError::ConnectionFailed(format!("failed to start Vosk worker: {e}")))
    }
}

/// Keeps a grammar JSON temp file on disk until dropped.
struct GrammarTempFile {
    path: PathBuf,
}

impl GrammarTempFile {
    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for GrammarTempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn push_grammar_file_args(command: &mut Command, grammar_file: &Path) {
    command.arg("--grammar-json-file").arg(grammar_file);
}

fn worker_is_executable(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
}

fn worker_command(worker_path: &Path) -> Command {
    let mut command = if worker_is_executable(worker_path) {
        Command::new(worker_path)
    } else {
        let mut command = Command::new(python_executable());
        command.arg(worker_path);
        command
    };
    suppress_console_window(&mut command);
    command
}

#[cfg(windows)]
fn suppress_console_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn suppress_console_window(_command: &mut Command) {}

/// The Vosk C library appends `/conf/model.conf` etc. with forward slashes.
/// Under the Windows extended-length prefix (`\\?\`) path normalization is
/// disabled, so such joins fail and model loading reports "Failed to create
/// a model". Strip the prefix before handing the path to the worker.
fn simplify_model_path(model_path: &Path) -> PathBuf {
    let text = model_path.to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{rest}"));
    }
    if let Some(rest) = text.strip_prefix(r"\\?\") {
        return PathBuf::from(rest.to_string());
    }
    model_path.to_path_buf()
}

fn push_worker_args(command: &mut Command, model_path: &Path) {
    command
        .arg("--model")
        .arg(simplify_model_path(model_path))
        .arg("--sample-rate")
        .arg("16000");
}

fn write_grammar_temp_file(json: &str) -> Result<GrammarTempFile, SttError> {
    let mut file = tempfile::Builder::new()
        .prefix("sabbathcue-vosk-grammar-")
        .suffix(".json")
        .tempfile()
        .map_err(|e| {
            SttError::ConnectionFailed(format!("failed to create Vosk grammar temp file: {e}"))
        })?;
    file.write_all(json.as_bytes()).map_err(|e| {
        SttError::ConnectionFailed(format!("failed to write Vosk grammar temp file: {e}"))
    })?;
    file.flush().map_err(|e| {
        SttError::ConnectionFailed(format!("failed to flush Vosk grammar temp file: {e}"))
    })?;

    let (_file, path) = file.keep().map_err(|e| {
        SttError::ConnectionFailed(format!("failed to persist Vosk grammar temp file: {e}"))
    })?;
    Ok(GrammarTempFile { path })
}

fn python_executable() -> String {
    std::env::var("SABBATHCUE_PYTHON")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "python".to_string())
}

fn first_nonempty_lines(bytes: &[u8], limit: usize) -> String {
    String::from_utf8_lossy(bytes)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(limit)
        .collect::<Vec<_>>()
        .join("\n")
}

fn stderr_suffix(stderr: &str) -> String {
    if stderr.is_empty() {
        String::new()
    } else {
        format!(" Stderr:\n{stderr}")
    }
}

fn write_samples(stdin: &mut ChildStdin, samples: &[i16]) -> Result<(), SttError> {
    let mut bytes = Vec::with_capacity(samples.len() * 2);
    for sample in samples {
        bytes.extend_from_slice(&sample.to_le_bytes());
    }
    stdin
        .write_all(&bytes)
        .map_err(|e| SttError::SendError(format!("Vosk worker write failed: {e}")))
}

fn to_words(words: Vec<VoskWord>) -> Vec<Word> {
    words
        .into_iter()
        .map(|word| Word {
            text: word.word.clone(),
            start: word.start,
            end: word.end,
            confidence: word.conf,
            punctuated_word: Some(word.word),
        })
        .collect()
}

fn average_confidence(words: &[Word]) -> f64 {
    let scored = words
        .iter()
        .filter(|word| word.confidence > 0.0)
        .collect::<Vec<_>>();
    if scored.is_empty() {
        return 0.75;
    }
    let scored_len = u32::try_from(scored.len()).expect("word count fits in u32");
    scored.iter().map(|word| word.confidence).sum::<f64>() / f64::from(scored_len)
}

fn vosk_grammar_json() -> Result<String, SttError> {
    let phrases = verse_only_keyterms();
    serde_json::to_string(&phrases)
        .map_err(|e| SttError::ConnectionFailed(format!("failed to build Vosk grammar: {e}")))
}

fn spawn_vosk_reader(
    stdout: impl std::io::Read + Send + 'static,
    reader_tx: mpsc::Sender<TranscriptEvent>,
) -> Result<std::thread::JoinHandle<()>, SttError> {
    std::thread::Builder::new()
        .name("vosk-worker-reader".into())
        .spawn(move || {
            let lines = BufReader::new(stdout).lines();
            for line in lines {
                let Ok(line) = line else { break };
                let Ok(event) = serde_json::from_str::<WorkerEvent>(&line) else {
                    continue;
                };
                match event {
                    WorkerEvent::Ready => {
                        let _ = reader_tx.blocking_send(TranscriptEvent::Connected);
                    }
                    WorkerEvent::Partial { text, words } if !text.trim().is_empty() => {
                        let _ = reader_tx.blocking_send(TranscriptEvent::Partial {
                            transcript: text,
                            words: to_words(words),
                        });
                    }
                    WorkerEvent::Final { text, words } if !text.trim().is_empty() => {
                        let words = to_words(words);
                        let confidence = average_confidence(&words);
                        let _ = reader_tx.blocking_send(TranscriptEvent::Final {
                            transcript: text,
                            words,
                            confidence,
                            speech_final: true,
                        });
                        let _ = reader_tx.blocking_send(TranscriptEvent::UtteranceEnd);
                    }
                    WorkerEvent::Error { message } => {
                        let _ = reader_tx.blocking_send(TranscriptEvent::Error(message));
                    }
                    WorkerEvent::Partial { .. } | WorkerEvent::Final { .. } => {}
                }
            }
        })
        .map_err(|e| SttError::ConnectionFailed(format!("failed to spawn Vosk reader: {e}")))
}

fn spawn_vosk_stderr_logger(stderr: ChildStderr) -> Result<std::thread::JoinHandle<()>, SttError> {
    std::thread::Builder::new()
        .name("vosk-worker-stderr".into())
        .spawn(move || {
            for line in BufReader::new(stderr).lines() {
                match line {
                    Ok(line) if !line.trim().is_empty() => {
                        log::info!("[VOSK] {line}");
                    }
                    Ok(_) => {}
                    Err(error) => {
                        log::warn!("Vosk stderr reader failed: {error}");
                        break;
                    }
                }
            }
        })
        .map_err(|e| SttError::ConnectionFailed(format!("failed to spawn Vosk stderr reader: {e}")))
}

async fn stop_vosk_writer(writer: tokio::task::JoinHandle<Result<(), SttError>>) {
    match tokio::time::timeout(Duration::from_secs(2), writer).await {
        Ok(Ok(Ok(()))) => {}
        Ok(Ok(Err(e))) => log::warn!("Vosk writer exited with error: {e}"),
        Ok(Err(e)) => log::warn!("Vosk writer task failed: {e}"),
        Err(_) => {
            log::warn!("Vosk writer did not stop promptly; terminating worker process");
        }
    }
}

fn stop_vosk_worker(
    mut child: Child,
    reader: std::thread::JoinHandle<()>,
    stderr_reader: std::thread::JoinHandle<()>,
) {
    terminate_vosk_child(&mut child);
    if reader.join().is_err() {
        log::warn!("Vosk reader thread panicked");
    }
    if stderr_reader.join().is_err() {
        log::warn!("Vosk stderr reader thread panicked");
    }
}

fn terminate_vosk_child(child: &mut Child) {
    match child.try_wait() {
        Ok(Some(_status)) => {}
        Ok(None) => {
            if let Err(e) = child.kill() {
                log::warn!("Failed to terminate Vosk worker process: {e}");
            }
        }
        Err(e) => log::warn!("Failed to inspect Vosk worker process: {e}"),
    }
    if let Err(e) = child.wait() {
        log::warn!("Failed to reap Vosk worker process: {e}");
    }
}

#[async_trait::async_trait]
impl SttProvider for VoskProvider {
    async fn start(
        &self,
        audio_rx: Receiver<Vec<i16>>,
        event_tx: mpsc::Sender<TranscriptEvent>,
    ) -> Result<(), SttError> {
        let grammar_json = vosk_grammar_json()?;
        let grammar_file = write_grammar_temp_file(&grammar_json)?;
        let mut child = self.spawn_worker(&grammar_file)?;
        let Some(mut stdin) = child.stdin.take() else {
            terminate_vosk_child(&mut child);
            return Err(SttError::ConnectionFailed(
                "failed to open Vosk stdin".to_string(),
            ));
        };
        let Some(stdout) = child.stdout.take() else {
            terminate_vosk_child(&mut child);
            return Err(SttError::ConnectionFailed(
                "failed to open Vosk stdout".to_string(),
            ));
        };
        let Some(stderr) = child.stderr.take() else {
            terminate_vosk_child(&mut child);
            return Err(SttError::ConnectionFailed(
                "failed to open Vosk stderr".to_string(),
            ));
        };

        let cancelled = self.cancelled.clone();
        let reader = match spawn_vosk_reader(stdout, event_tx.clone()) {
            Ok(reader) => reader,
            Err(error) => {
                terminate_vosk_child(&mut child);
                return Err(error);
            }
        };
        let stderr_reader = match spawn_vosk_stderr_logger(stderr) {
            Ok(reader) => reader,
            Err(error) => {
                terminate_vosk_child(&mut child);
                return Err(error);
            }
        };

        let writer_cancelled = cancelled.clone();
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
                            write_samples(&mut stdin, &chunk)?;
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                        if !pending.is_empty() {
                            write_samples(&mut stdin, &pending)?;
                            pending.clear();
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => break,
                }
            }
            if !pending.is_empty() {
                write_samples(&mut stdin, &pending)?;
            }
            Ok::<(), SttError>(())
        });

        stop_vosk_writer(writer).await;
        stop_vosk_worker(child, reader, stderr_reader);
        let _ = event_tx.send(TranscriptEvent::Disconnected).await;
        Ok(())
    }

    fn stop(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    fn name(&self) -> &'static str {
        "vosk"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grammar_json_is_valid_json_array() {
        let json = vosk_grammar_json().expect("grammar JSON should be valid");
        let parsed: Vec<String> =
            serde_json::from_str(&json).expect("grammar JSON must parse as string array");
        assert!(!parsed.is_empty(), "grammar phrases must not be empty");
    }

    #[test]
    fn grammar_json_includes_bible_reference_terms() {
        let json = vosk_grammar_json().expect("grammar JSON should be valid");
        let parsed: Vec<String> =
            serde_json::from_str(&json).expect("grammar JSON must parse as string array");
        assert!(
            parsed.iter().any(|p| p == "chapter"),
            "grammar must include 'chapter'"
        );
        assert!(
            parsed.iter().any(|p| p == "verse"),
            "grammar must include 'verse'"
        );
        assert!(
            parsed.iter().any(|p| p == "verses"),
            "grammar must include 'verses'"
        );
        assert!(
            parsed.iter().any(|p| p == "to"),
            "grammar must include 'to'"
        );
        assert!(
            parsed.iter().any(|p| p == "through"),
            "grammar must include 'through'"
        );
        assert!(
            parsed.iter().any(|p| p == "next"),
            "grammar must include 'next'"
        );
        assert!(
            parsed.iter().any(|p| p == "previous"),
            "grammar must include 'previous'"
        );
    }

    #[test]
    fn grammar_json_excludes_worship_and_unk_terms() {
        let json = vosk_grammar_json().expect("grammar JSON should be valid");
        let parsed: Vec<String> =
            serde_json::from_str(&json).expect("grammar JSON must parse as string array");
        assert!(
            !parsed.iter().any(|p| p == "[unk]"),
            "grammar must NOT include '[unk]'"
        );
        assert!(
            !parsed.iter().any(|p| p == "sabbath"),
            "grammar must NOT include 'sabbath'"
        );
        assert!(
            !parsed.iter().any(|p| p == "holy spirit"),
            "grammar must NOT include 'holy spirit'"
        );
        assert!(
            !parsed.iter().any(|p| p == "scripture reading"),
            "grammar must NOT include 'scripture reading'"
        );
        assert!(
            !parsed.iter().any(|p| p == "hymn number"),
            "grammar must NOT include 'hymn number'"
        );
    }

    #[test]
    fn grammar_json_includes_hymn_cue_words() {
        // Hymn voice control matches "(sda) hymn/song (number) <number>";
        // the grammar must contain those cue words or local Vosk can never
        // transcribe a hymn command.
        let json = vosk_grammar_json().expect("grammar JSON should be valid");
        let parsed: Vec<String> =
            serde_json::from_str(&json).expect("grammar JSON must parse as string array");
        for cue in ["hymn", "song", "number", "sda"] {
            assert!(
                parsed.iter().any(|p| p == cue),
                "grammar must include hymn cue word '{cue}'"
            );
        }
    }

    #[test]
    fn grammar_json_includes_high_number_support() {
        let json = vosk_grammar_json().expect("grammar JSON should be valid");
        let parsed: Vec<String> =
            serde_json::from_str(&json).expect("grammar JSON must parse as string array");
        assert!(
            parsed.iter().any(|p| p == "hundred"),
            "grammar must include 'hundred' for high chapter/verse numbers"
        );
        assert!(
            parsed.iter().any(|p| p == "and"),
            "grammar must include 'and' for number-word grouping"
        );
    }

    #[test]
    fn grammar_json_preserves_voice_control_and_translation_terms() {
        let json = vosk_grammar_json().expect("grammar JSON should be valid");
        let parsed: Vec<String> =
            serde_json::from_str(&json).expect("grammar JSON must parse as string array");
        assert!(
            parsed.iter().any(|p| p == "stop transcribing"),
            "grammar must keep the supported stop command"
        );
        assert!(
            parsed.iter().any(|p| p == "niv"),
            "grammar must keep supported translation abbreviations"
        );
        assert!(
            parsed.iter().any(|p| p == "king james version"),
            "grammar must keep supported translation names"
        );
    }

    #[test]
    fn grammar_json_has_no_duplicates() {
        let json = vosk_grammar_json().expect("grammar JSON should be valid");
        let mut parsed: Vec<String> =
            serde_json::from_str(&json).expect("grammar JSON must parse as string array");
        let before = parsed.len();
        parsed.sort();
        parsed.dedup();
        assert_eq!(
            before,
            parsed.len(),
            "grammar must not contain duplicate phrases"
        );
    }

    #[test]
    fn write_grammar_temp_file_writes_valid_json_array() {
        let json = vosk_grammar_json().expect("grammar JSON should be valid");
        let temp = write_grammar_temp_file(&json).expect("temp grammar file should be created");
        let contents =
            std::fs::read_to_string(temp.path()).expect("grammar temp file should exist");
        let parsed: Vec<String> =
            serde_json::from_str(&contents).expect("grammar temp file must contain JSON array");
        let expected: Vec<String> =
            serde_json::from_str(&json).expect("grammar JSON must parse as string array");
        assert_eq!(parsed, expected);
    }

    #[test]
    fn spawn_uses_grammar_file_not_inline_json() {
        let json = vosk_grammar_json().expect("grammar JSON should be valid");
        let temp = write_grammar_temp_file(&json).expect("temp grammar file should be created");

        let mut command = Command::new("python");
        push_grammar_file_args(&mut command, temp.path());

        let args = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        assert!(
            args.windows(2).any(|window| {
                window[0] == "--grammar-json-file" && window[1] == temp.path().to_string_lossy()
            }),
            "worker args must include --grammar-json-file with the temp path"
        );
        assert!(
            !args.iter().any(|arg| arg == &json),
            "worker args must not include the full inline grammar JSON payload"
        );
        assert!(
            !args.iter().any(|arg| arg == "--grammar-json"),
            "worker args must not use --grammar-json"
        );
    }

    #[test]
    #[ignore = "requires Python, the vosk package, and a local model download"]
    fn local_worker_preflight_succeeds_when_model_is_installed() {
        let model_path = project_root()
            .join("models")
            .join("vosk")
            .join("vosk-model-small-en-us");
        let worker_path = project_root().join("scripts").join("vosk_worker.py");

        if !model_path.exists() || !worker_path.exists() {
            eprintln!(
                "Skipping local Vosk preflight: model={} worker={}",
                model_path.display(),
                worker_path.display()
            );
            return;
        }

        VoskProvider::new(model_path, worker_path)
            .check_ready()
            .expect("local Vosk worker/model preflight should report ready");
    }

    fn project_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("..")
    }

    #[test]
    fn check_ready_reports_missing_model() {
        let temp = tempfile::tempdir().expect("temp dir");
        let worker_path = temp.path().join("vosk_worker.exe");
        std::fs::write(&worker_path, b"stub").expect("stub worker");

        let provider = VoskProvider::new(temp.path().join("missing-model"), worker_path);
        let error = provider.check_ready().expect_err("missing model must fail");
        assert!(
            error.to_string().contains("Vosk model not found"),
            "error should mention the missing model, got: {error}"
        );
    }

    #[test]
    fn check_ready_reports_missing_worker() {
        let temp = tempfile::tempdir().expect("temp dir");
        let model_path = temp.path().join("model");
        std::fs::create_dir_all(&model_path).expect("model dir");

        let provider = VoskProvider::new(model_path, temp.path().join("missing-worker.exe"));
        let error = provider
            .check_ready()
            .expect_err("missing worker must fail");
        assert!(
            error.to_string().contains("Vosk worker not found"),
            "error should mention the missing worker, got: {error}"
        );
    }

    #[test]
    fn worker_command_runs_exe_directly_and_py_through_python() {
        let exe_command = worker_command(Path::new("C:/app/scripts/vosk_worker.exe"));
        assert!(
            exe_command
                .get_program()
                .to_string_lossy()
                .ends_with("vosk_worker.exe"),
            "bundled .exe worker must run directly"
        );
        assert_eq!(exe_command.get_args().count(), 0);

        let py_command = worker_command(Path::new("C:/app/scripts/vosk_worker.py"));
        let program = py_command.get_program().to_string_lossy().into_owned();
        assert!(
            !program.to_ascii_lowercase().ends_with(".py"),
            ".py worker must run through a Python interpreter, got program: {program}"
        );
        let args = py_command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert!(
            args.iter().any(|arg| arg.ends_with("vosk_worker.py")),
            "python invocation must pass the script path"
        );
    }

    #[test]
    fn worker_args_strip_windows_extended_length_prefix() {
        // Regression: passing `\\?\C:\...` to the worker made the Vosk C
        // library fail with "Failed to create a model" because its internal
        // forward-slash path joins are not normalized under the prefix.
        let mut command = Command::new("worker");
        push_worker_args(&mut command, Path::new(r"\\?\C:\models\vosk\model"));
        let args = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert!(
            args.windows(2)
                .any(|w| w[0] == "--model" && w[1] == r"C:\models\vosk\model"),
            "model arg must not carry the \\\\?\\ prefix, got: {args:?}"
        );
    }

    #[test]
    fn simplify_model_path_handles_unc_and_plain_paths() {
        assert_eq!(
            simplify_model_path(Path::new(r"\\?\UNC\server\share\model")),
            PathBuf::from(r"\\server\share\model")
        );
        assert_eq!(
            simplify_model_path(Path::new(r"C:\models\vosk")),
            PathBuf::from(r"C:\models\vosk")
        );
        assert_eq!(
            simplify_model_path(Path::new("/opt/models/vosk")),
            PathBuf::from("/opt/models/vosk")
        );
    }

    #[test]
    fn worker_args_include_model_and_sample_rate() {
        let mut command = Command::new("worker");
        push_worker_args(&mut command, Path::new("C:/models/vosk"));
        let args = command
            .get_args()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        assert!(args
            .windows(2)
            .any(|w| w[0] == "--model" && w[1].ends_with("vosk")));
        assert!(args
            .windows(2)
            .any(|w| w[0] == "--sample-rate" && w[1] == "16000"));
    }

    #[test]
    fn to_words_maps_vosk_fields() {
        let words = to_words(vec![VoskWord {
            word: "genesis".to_string(),
            start: 1.5,
            end: 2.0,
            conf: 0.9,
        }]);
        assert_eq!(words.len(), 1);
        assert_eq!(words[0].text, "genesis");
        assert!((words[0].start - 1.5).abs() < f64::EPSILON);
        assert!((words[0].end - 2.0).abs() < f64::EPSILON);
        assert!((words[0].confidence - 0.9).abs() < f64::EPSILON);
        assert_eq!(words[0].punctuated_word.as_deref(), Some("genesis"));
    }

    #[test]
    fn average_confidence_defaults_when_unscored() {
        assert!((average_confidence(&[]) - 0.75).abs() < f64::EPSILON);

        let unscored = to_words(vec![VoskWord {
            word: "john".to_string(),
            start: 0.0,
            end: 0.5,
            conf: 0.0,
        }]);
        assert!((average_confidence(&unscored) - 0.75).abs() < f64::EPSILON);

        let scored = to_words(vec![
            VoskWord {
                word: "john".to_string(),
                start: 0.0,
                end: 0.5,
                conf: 0.8,
            },
            VoskWord {
                word: "three".to_string(),
                start: 0.5,
                end: 1.0,
                conf: 0.6,
            },
        ]);
        assert!((average_confidence(&scored) - 0.7).abs() < 1e-9);
    }

    #[test]
    fn reader_maps_worker_events_to_transcript_events() {
        let stdout: &[u8] = concat!(
            "{\"type\": \"ready\"}\n",
            "not json at all\n",
            "{\"type\": \"partial\", \"text\": \"  \"}\n",
            "{\"type\": \"partial\", \"text\": \"john three\", \"words\": []}\n",
            "{\"type\": \"final\", \"text\": \"john three sixteen\", \"words\": [{\"word\": \"john\", \"start\": 0.0, \"end\": 0.4, \"conf\": 0.9}]}\n",
            "{\"type\": \"error\", \"message\": \"model exploded\"}\n",
        )
        .as_bytes();

        let (tx, mut rx) = mpsc::channel(16);
        let reader = spawn_vosk_reader(stdout, tx).expect("reader thread");
        reader.join().expect("reader thread must not panic");

        let mut events = Vec::new();
        while let Ok(event) = rx.try_recv() {
            events.push(event);
        }

        assert!(matches!(events[0], TranscriptEvent::Connected));
        let TranscriptEvent::Partial { transcript, .. } = &events[1] else {
            panic!("expected partial event, got {:?}", events[1]);
        };
        assert_eq!(transcript, "john three");
        let TranscriptEvent::Final {
            transcript,
            words,
            speech_final,
            ..
        } = &events[2]
        else {
            panic!("expected final event, got {:?}", events[2]);
        };
        assert_eq!(transcript, "john three sixteen");
        assert_eq!(words.len(), 1);
        assert!(speech_final);
        assert!(matches!(events[3], TranscriptEvent::UtteranceEnd));
        let TranscriptEvent::Error(message) = &events[4] else {
            panic!("expected error event, got {:?}", events[4]);
        };
        assert_eq!(message, "model exploded");
        assert_eq!(
            events.len(),
            5,
            "blank partials and bad JSON must be skipped"
        );
    }

    /// End-to-end preflight against the real bundled worker executable and
    /// model. This is exactly what the installed app runs before starting
    /// transcription, so it catches broken worker/model/grammar combinations.
    /// Skips (with a note) when local assets are missing, e.g. on CI.
    #[test]
    fn bundled_worker_preflight_reports_ready() {
        let model_path = project_root()
            .join("models")
            .join("vosk")
            .join("vosk-model-small-en-us");
        let worker_path = project_root().join("sidecars").join("vosk_worker.exe");

        if !model_path.exists() || !worker_path.exists() {
            eprintln!(
                "Skipping bundled Vosk preflight: model={} worker={}",
                model_path.display(),
                worker_path.display()
            );
            return;
        }

        VoskProvider::new(model_path, worker_path)
            .check_ready()
            .expect("bundled Vosk worker/model preflight should report ready");
    }
}
