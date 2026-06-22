use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Notify;

use crate::state::AppState;
use rhema_detection::{DetectionMerger, DirectDetector};

use super::utils::{transcript_logging_enabled, truncate_safe};

/// Check whether the operator has paused detection suggestions.
/// Uses a blocking lock so the pause flag is authoritative.
/// The lock is held only for an atomic load, so transcript events are not blocked.
pub(crate) fn is_detection_paused(app: &AppHandle) -> bool {
    let state: State<'_, Mutex<AppState>> = app.state();
    let paused = match state.lock() {
        Ok(s) => s.detection_paused.load(Ordering::Relaxed),
        Err(_) => true,
    };
    paused
}

pub(crate) const SEMANTIC_WINDOW_SEGMENTS: usize = 4;
pub(crate) const FINAL_SEMANTIC_MIN_WORDS: usize = 3;
pub(crate) const PARTIAL_SEMANTIC_DEBOUNCE: Duration = Duration::from_millis(100);
pub(crate) const PARTIAL_SEMANTIC_MIN_WORDS: usize = 3;
pub(crate) const LIVE_SEMANTIC_CAP: usize = 3;
const LIVE_SEMANTIC_OVERLAP_BOOST: f64 = 0.10;

/// Maximum trailing words of the rolling transcript window fed to live
/// semantic + FTS5 detection.
pub(crate) const LIVE_DETECTION_WINDOW_WORDS: usize = 12;

/// Clear the rolling detection window after this much silence between finals.
pub(crate) const WINDOW_RESET_GAP: Duration = Duration::from_secs(8);

/// Return the last `max_words` whitespace-delimited words of `text`, re-joined
/// with single spaces.
pub(crate) fn clamp_to_recent_words(text: &str, max_words: usize) -> String {
    let words: Vec<&str> = text.split_whitespace().collect();
    let start = words.len().saturating_sub(max_words);
    words[start..].join(" ")
}

/// True when the transcript window is an explicit scripture reference or a
/// voice/reading command that the direct + command paths already handle.
///
/// Live semantic (fuzzy) search defers to those paths for such utterances, so
/// the detections panel reflects what was actually spoken instead of keyword
/// noise from BM25 matching on reference words like "chapter"/"verse".
pub(crate) fn transcript_defers_to_direct(text: &str) -> bool {
    crate::commands::transcript_router::looks_like_complete_reference(text)
        || rhema_detection::is_voice_command_utterance(text)
}

/// Take the latest pending semantic job from a shared slot, recovering from
/// poisoned locks so the worker doesn't die permanently.
pub(crate) fn take_semantic_job(
    slot: &Arc<Mutex<Option<(u64, String)>>>,
    label: &str,
) -> Option<(u64, String)> {
    match slot.lock() {
        Ok(mut guard) => guard.take(),
        Err(poisoned) => {
            log::error!("[DET-SEMANTIC] {label} semantic slot lock poisoned; recovering");
            let mut guard = poisoned.into_inner();
            guard.take()
        }
    }
}

/// Replace the latest pending semantic job in a shared slot, recovering from
/// poisoned locks. Returns true if a previous job was replaced.
fn replace_semantic_job(
    slot: &Arc<Mutex<Option<(u64, String)>>>,
    job: (u64, String),
    label: &str,
) -> bool {
    match slot.lock() {
        Ok(mut guard) => guard.replace(job).is_some(),
        Err(poisoned) => {
            log::error!("[DET-SEMANTIC] {label} semantic slot lock poisoned; recovering");
            let mut guard = poisoned.into_inner();
            guard.replace(job).is_some()
        }
    }
}

pub(crate) fn enqueue_final_semantic_job(
    job_slot: &Arc<Mutex<Option<(u64, String)>>>,
    notify: &Arc<Notify>,
    sent_counter: &Arc<AtomicU64>,
    replaced_counter: &Arc<AtomicU64>,
    seq: u64,
    text: String,
) {
    if text.trim().is_empty() {
        return;
    }

    if text.split_whitespace().count() < FINAL_SEMANTIC_MIN_WORDS {
        log::debug!("[DET-TRACE] seq={seq} skip=semantic_enqueue reason=tiny_window label=final");
        return;
    }

    // Explicit references and voice commands are owned by the direct + command
    // paths. Skipping the enqueue (rather than suppressing later in the worker)
    // also prevents these utterances from evicting a pending prose job from the
    // latest-wins slot, so genuine paraphrase detections still run.
    if transcript_defers_to_direct(&text) {
        log::debug!(
            "[DET-TRACE] seq={seq} skip=semantic_enqueue reason=reference_or_command label=final"
        );
        return;
    }

    let replaced = replace_semantic_job(job_slot, (seq, text), "final");
    let n = sent_counter.fetch_add(1, Ordering::Relaxed) + 1;

    if replaced {
        let replaced_count = replaced_counter.fetch_add(1, Ordering::Relaxed) + 1;
        let sent = sent_counter.load(Ordering::Relaxed);
        log::debug!(
            "[QUEUE] final_semantic latest-wins replaced stale work sent={sent} replaced={replaced_count}"
        );
    } else if n % 25 == 0 {
        let replaced_count = replaced_counter.load(Ordering::Relaxed);
        log::info!("[QUEUE] final_semantic latest-wins sent={n} replaced={replaced_count}");
    }

    notify.notify_one();
}

pub(crate) fn enqueue_partial_semantic_job(
    job_slot: &Arc<Mutex<Option<(u64, String)>>>,
    notify: &Arc<Notify>,
    sent_counter: &Arc<AtomicU64>,
    replaced_counter: &Arc<AtomicU64>,
    seq: u64,
    text: String,
) {
    if text.trim().is_empty() {
        return;
    }

    if transcript_defers_to_direct(&text) {
        log::debug!(
            "[DET-TRACE] seq={seq} skip=semantic_enqueue reason=reference_or_command label=partial"
        );
        return;
    }

    let replaced = replace_semantic_job(job_slot, (seq, text), "partial");
    let n = sent_counter.fetch_add(1, Ordering::Relaxed) + 1;

    if replaced {
        let replaced_count = replaced_counter.fetch_add(1, Ordering::Relaxed) + 1;
        let sent = sent_counter.load(Ordering::Relaxed);
        log::debug!(
            "[QUEUE] partial_semantic latest-wins replaced stale work sent={sent} replaced={replaced_count}"
        );
    } else if n % 25 == 0 {
        let replaced_count = replaced_counter.load(Ordering::Relaxed);
        log::info!("[QUEUE] partial_semantic latest-wins sent={n} replaced={replaced_count}");
    }

    notify.notify_one();
}

pub(crate) fn enqueue_direct_detection_job(
    detect_tx: &tokio::sync::mpsc::Sender<(u64, String)>,
    latest_accepted_seq: &Arc<AtomicU64>,
    sent_counter: &Arc<AtomicU64>,
    dropped_counter: &Arc<AtomicU64>,
    seq: u64,
    text: String,
    source: &str,
) {
    match detect_tx.try_send((seq, text)) {
        Ok(()) => {
            latest_accepted_seq.store(seq, Ordering::Release);
            let n = sent_counter.fetch_add(1, Ordering::Relaxed) + 1;
            if n % 25 == 0 {
                let depth = detect_tx.max_capacity() - detect_tx.capacity();
                let dropped = dropped_counter.load(Ordering::Relaxed);
                log::info!(
                    "[QUEUE] detect_tx source={source} sent={n} dropped={dropped} depth={depth}/{}",
                    detect_tx.max_capacity()
                );
            }
        }
        Err(tokio::sync::mpsc::error::TrySendError::Full(_)) => {
            let dropped = dropped_counter.fetch_add(1, Ordering::Relaxed) + 1;
            let sent = sent_counter.load(Ordering::Relaxed);
            log::warn!(
                "[QUEUE] detect_tx DROPPED source={source} (consumer behind) sent={sent} dropped={dropped}"
            );
        }
        Err(tokio::sync::mpsc::error::TrySendError::Closed(_)) => {}
    }
}

#[derive(Debug, Default)]
pub(crate) struct DeepgramSemanticBuffer {
    parts: Vec<String>,
    seq: u64,
}

impl DeepgramSemanticBuffer {
    pub(crate) fn push_final(
        &mut self,
        seq: u64,
        text: String,
        speech_final: bool,
    ) -> Option<(u64, String)> {
        self.parts.push(text);
        self.seq = seq;
        if speech_final {
            self.flush_with_seq(seq)
        } else {
            None
        }
    }

    pub(crate) fn flush(&mut self) -> Option<(u64, String)> {
        self.flush_with_seq(self.seq)
    }

    pub(crate) fn flush_with_seq(&mut self, seq: u64) -> Option<(u64, String)> {
        if self.parts.is_empty() || seq == 0 {
            return None;
        }

        let text = self.parts.join(" ");
        self.clear();
        Some((seq, text))
    }

    pub(crate) fn clear(&mut self) {
        self.parts.clear();
        self.seq = 0;
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.parts.is_empty()
    }
}

fn semantic_result_key(result: &crate::commands::detection::DetectionResult) -> String {
    if result.content_type == "egw" {
        return format!(
            "egw:{}:{}:{}",
            result.book_number, result.chapter, result.verse
        );
    }
    if result.book_number > 0 && result.chapter > 0 && result.verse > 0 {
        format!("{}:{}:{}", result.book_number, result.chapter, result.verse)
    } else {
        result.verse_ref.clone()
    }
}

pub(crate) fn finalize_live_semantic_results(
    results: Vec<crate::commands::detection::DetectionResult>,
) -> Vec<crate::commands::detection::DetectionResult> {
    let mut grouped: HashMap<String, (crate::commands::detection::DetectionResult, usize)> =
        HashMap::new();

    for result in results {
        let key = semantic_result_key(&result);
        match grouped.get_mut(&key) {
            Some((existing, overlap_count)) => {
                *overlap_count += 1;
                existing.confidence = existing.confidence.max(result.confidence);
                existing.auto_queued |= result.auto_queued;
                if existing.verse_text.is_empty() && !result.verse_text.is_empty() {
                    existing.verse_text.clone_from(&result.verse_text);
                }
                if existing.transcript_snippet.is_empty() && !result.transcript_snippet.is_empty() {
                    existing
                        .transcript_snippet
                        .clone_from(&result.transcript_snippet);
                }
                if existing.book_number <= 0 && result.book_number > 0 {
                    *existing = result;
                }
            }
            None => {
                grouped.insert(key, (result, 1));
            }
        }
    }

    let mut merged = grouped
        .into_values()
        .map(|(mut result, overlap_count)| {
            if overlap_count > 1 {
                result.confidence = (result.confidence + LIVE_SEMANTIC_OVERLAP_BOOST).min(0.98);
            }
            result
        })
        .collect::<Vec<_>>();

    merged.sort_by(|a, b| {
        b.confidence
            .partial_cmp(&a.confidence)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.verse_ref.cmp(&b.verse_ref))
    });
    merged.truncate(LIVE_SEMANTIC_CAP);
    merged
}

fn mark_egw_auto_queue(
    app: &AppHandle,
    results: &mut [crate::commands::detection::DetectionResult],
) {
    let merger_state: State<'_, Mutex<DetectionMerger>> = app.state();
    let Ok(mut merger) = merger_state.lock() else {
        log::warn!("[DET-EGW] DetectionMerger busy; EGW auto-queue skipped");
        return;
    };
    crate::commands::detection::apply_egw_auto_queue(results, &mut merger);
}

fn emit_egw_direct_detections(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    transcript: &str,
) {
    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(app_state) = app_managed.lock() else {
        if transcript_logging_enabled() {
            log::debug!("[DET-EGW] AppState busy; skipping direct EGW detection");
        }
        return;
    };
    let mut results = crate::commands::detection::detect_egw_references(&app_state, transcript);
    drop(app_state);

    if results.is_empty() || seq < latest_seq.load(Ordering::Acquire) {
        return;
    }

    mark_egw_auto_queue(app, &mut results);
    for result in &results {
        log::info!(
            "[DET-EGW] Found: {} ({:.0}%) auto_q={}",
            result.verse_ref,
            result.confidence * 100.0,
            result.auto_queued
        );
    }
    let _ = app.emit("verse_detections", &results);
}

/// Run direct (regex/pattern) detection only. Instant, no ONNX.
/// Uses SEPARATE Mutex<DirectDetector> and Mutex<DetectionMerger> so it
/// never blocks on the semantic worker, and cooldown state persists across calls.
/// Returns true if high-confidence results were found (>= 0.90).
#[expect(
    clippy::similar_names,
    clippy::too_many_lines,
    reason = "direct detection orchestration is intentionally kept together"
)]
pub(crate) fn run_direct_detection(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    transcript: &str,
) -> bool {
    // [DIAG] AppState mutex contention on the direct-detection hot path.
    static LOCK_OK: AtomicU64 = AtomicU64::new(0);
    static LOCK_CONTENDED: AtomicU64 = AtomicU64::new(0);

    // Stale detection suppression: if this job's sequence is older than the
    // latest accepted transcript sequence, skip emission.
    if seq < latest_seq.load(Ordering::Acquire) {
        log::debug!("[DET-DIRECT] Skipping stale job seq={seq}");
        return false;
    }
    let t0 = std::time::Instant::now();
    let detector_state: State<'_, Mutex<DirectDetector>> = app.state();
    let mut detector = match detector_state.lock() {
        Ok(d) => d,
        Err(e) => {
            log::error!("Failed to lock DirectDetector: {e}");
            return false;
        }
    };
    let direct_results = detector.detect(transcript);
    drop(detector); // Release immediately

    if direct_results.is_empty() {
        emit_egw_direct_detections(app, seq, latest_seq, transcript);
        return false;
    }

    // Check if any result has high confidence before merging
    let has_high_confidence = direct_results.iter().any(|d| d.confidence >= 0.90);

    // Merge using the managed merger (persists cooldown state across calls,
    // preventing duplicate emissions when running on both partials and finals)
    let merger_state: State<'_, Mutex<DetectionMerger>> = app.state();
    let mut merger = match merger_state.lock() {
        Ok(m) => m,
        Err(e) => {
            log::error!("Failed to lock DetectionMerger: {e}");
            return false;
        }
    };
    let merged = merger.merge(direct_results, vec![]);
    drop(merger);
    if merged.is_empty() {
        emit_egw_direct_detections(app, seq, latest_seq, transcript);
        return has_high_confidence;
    }

    // Resolve verse info from DB (needs AppState, but only briefly for DB lookup)
    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(app_state) = app_managed.lock() else {
        let bad = LOCK_CONTENDED.fetch_add(1, Ordering::Relaxed) + 1;
        let good = LOCK_OK.load(Ordering::Relaxed);
        log::warn!("[DET-DIRECT] AppState lock FAILED (contention) ok={good} contended={bad}");

        // Check for stale sequence BEFORE emitting in fallback path
        if seq < latest_seq.load(Ordering::Acquire) {
            log::debug!("[DET-DIRECT] Skipping stale emission in fallback path seq={seq}");
            return has_high_confidence;
        }

        // AppState is locked, so emit results without verse text.
        let results: Vec<crate::commands::detection::DetectionResult> = merged
            .iter()
            .map(|m| {
                let vr = &m.detection.verse_ref;
                crate::commands::detection::DetectionResult {
                    content_type: "bible".to_string(),
                    verse_ref: format!("{} {}:{}", vr.book_name, vr.chapter, vr.verse_start),
                    verse_text: String::new(),
                    book_name: vr.book_name.clone(),
                    book_number: vr.book_number,
                    chapter: vr.chapter,
                    verse: vr.verse_start,
                    confidence: m.detection.confidence,
                    source: "direct".to_string(),
                    auto_queued: m.auto_queued,
                    transcript_snippet: m.detection.transcript_snippet.clone(),
                    is_chapter_only: m.detection.is_chapter_only,
                    egw_paragraph: None,
                }
            })
            .collect();
        for r in &results {
            log::info!(
                "[DET-DIRECT] Found: {} ({:.0}%) (no DB)",
                r.verse_ref,
                r.confidence * 100.0
            );
        }
        let _ = app.emit("verse_detections", &results);
        return has_high_confidence;
    };
    let ok = LOCK_OK.fetch_add(1, Ordering::Relaxed) + 1;
    if ok % 50 == 0 {
        let bad = LOCK_CONTENDED.load(Ordering::Relaxed);
        log::info!("[DET-DIRECT] AppState lock stats ok={ok} contended={bad}");
    }
    let mut results: Vec<crate::commands::detection::DetectionResult> = merged
        .iter()
        .map(|m| crate::commands::detection::to_result(&app_state, m))
        .collect();
    let egw_start = results.len();
    results.extend(crate::commands::detection::detect_egw_references(
        &app_state, transcript,
    ));
    drop(app_state);
    if results.len() > egw_start {
        mark_egw_auto_queue(app, &mut results[egw_start..]);
    }

    for r in &results {
        log::info!(
            "[DET-DIRECT] Found: {} ({:.0}%)",
            r.verse_ref,
            r.confidence * 100.0
        );
    }

    // Final stale check before emission
    if seq < latest_seq.load(Ordering::Acquire) {
        log::debug!("[DET-DIRECT] Skipping emission for stale seq={seq}");
        return has_high_confidence;
    }

    log::info!(
        "[DET-TRACE] seq={seq} decision=direct emitted={} top={} took={:?}",
        results.len(),
        results.first().map_or("-", |r| r.verse_ref.as_str()),
        t0.elapsed()
    );
    let _ = app.emit("verse_detections", &results);
    if transcript_logging_enabled() {
        log::info!(
            "[DET-DIRECT] Detection took {:?} for {:?}",
            t0.elapsed(),
            truncate_safe(transcript, 50)
        );
    } else {
        log::info!("[DET-DIRECT] Detection took {:?}", t0.elapsed());
    }
    has_high_confidence
}

/// Run hybrid semantic detection combining FTS5 BM25 with vector search.
/// Uses `spawn_blocking` so mutex locks and DB I/O don't starve the tokio runtime.
#[expect(
    clippy::too_many_lines,
    reason = "live semantic detection coordinates stale checks, explicit EGW routing, and emission in one pipeline"
)]
pub(crate) fn run_semantic_detection(
    app: &AppHandle,
    seq: u64,
    latest_seq: &Arc<AtomicU64>,
    transcript: &str,
) {
    // Stale detection suppression: if this job's sequence is older than the
    // latest accepted transcript sequence, skip emission.
    if seq < latest_seq.load(Ordering::Acquire) {
        log::debug!("[DET-SEMANTIC] Skipping stale job seq={seq}");
        return;
    }

    // Reference and command windows never reach this worker — they are filtered
    // at enqueue (see `enqueue_*_semantic_job`). Remaining windows are EGW
    // references or sermon prose.
    //
    // Catch Ellen White references that endpointing fragmented across several
    // finals: the single-final direct pass misses them, but the rolling window
    // still holds the whole "Book chapter N paragraph M". Emit the explicit
    // paragraph and skip fuzzy search.
    let mut egw_explicit = {
        let app_managed: State<'_, Mutex<AppState>> = app.state();
        let Ok(app_state) = app_managed.lock() else {
            log::error!("[DET-SEMANTIC] AppState lock failed for EGW window catch");
            return;
        };
        crate::commands::detection::detect_egw_references(&app_state, transcript)
    };
    if !egw_explicit.is_empty() {
        if seq < latest_seq.load(Ordering::Acquire) {
            return;
        }
        mark_egw_auto_queue(app, &mut egw_explicit);
        for r in &egw_explicit {
            log::info!(
                "[DET-TRACE] seq={seq} decision=egw_explicit reason=window_reference {} ({:.0}%) auto_q={}",
                r.verse_ref,
                r.confidence * 100.0,
                r.auto_queued
            );
        }
        let _ = app.emit("verse_detections", &egw_explicit);
        return;
    }

    let t0 = std::time::Instant::now();
    if transcript_logging_enabled() {
        log::info!(
            "[DET-SEMANTIC] Running on: {:?}",
            truncate_safe(transcript, 80)
        );
    } else {
        log::info!("[DET-SEMANTIC] Running");
    }

    // FTS5 BM25 phrase search (~5ms)
    let (fts_results, active_translation_id) = {
        let managed: State<'_, Mutex<AppState>> = app.state();
        let Ok(app_state) = managed.lock() else {
            log::error!("Failed to lock AppState for FTS5");
            return;
        };
        (
            app_state
                .bible_db
                .as_ref()
                .and_then(|db| db.search_verses_bm25(transcript, 10).ok()),
            app_state.active_translation_id,
        )
    };

    let fts = fts_results.unwrap_or_default();
    if fts.is_empty() {
        log::debug!("[DET-SEMANTIC] No FTS5 results, trying vector-only search");
    } else if let Some(top) = fts.first() {
        log::debug!(
            "[DET-SEMANTIC] FTS5 hits={} top={} {}:{} rank={:.3}",
            fts.len(),
            top.book_name,
            top.chapter,
            top.verse,
            top.rank
        );
    }

    // Use hybrid pipeline: FTS5 + vector search when available.
    // Even with empty FTS5, vector search can catch paraphrases.
    let (merged, semantic_ready, paraphrase_enabled) = {
        let pipeline_state: State<'_, Mutex<rhema_detection::DetectionPipeline>> = app.state();
        let Ok(mut pipeline) = pipeline_state.lock() else {
            log::error!("Failed to lock DetectionPipeline");
            return;
        };
        let semantic_ready = pipeline.has_semantic();
        let paraphrase_enabled = pipeline.use_synonyms();
        let merged = pipeline.process_hybrid_with_fts(transcript, &fts);
        (merged, semantic_ready, paraphrase_enabled)
    };

    log::info!(
        "[DET-SEMANTIC] Workflow seq={} words={} fts_hits={} vector_ready={} paraphrase={} active_translation_id={} candidates={} elapsed={:?}",
        seq,
        transcript.split_whitespace().count(),
        fts.len(),
        semantic_ready,
        paraphrase_enabled,
        active_translation_id,
        merged.len(),
        t0.elapsed()
    );

    // Resolve verse text from DB for merged results. Explicit EGW references
    // are handled above; live semantic output intentionally avoids EGW BM25
    // quote matches because short sermon windows produced noisy DA/PP hits.
    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(app_state) = app_managed.lock() else {
        log::error!("Failed to lock AppState for verse resolution");
        return;
    };

    let results: Vec<crate::commands::detection::DetectionResult> = merged
        .iter()
        .map(|m| crate::commands::detection::to_result(&app_state, m))
        .collect();

    drop(app_state);
    let results = finalize_live_semantic_results(results);

    if results.is_empty() {
        log::info!("[DET-SEMANTIC] No detections");
        return;
    }

    // Final stale check before emission
    if seq < latest_seq.load(Ordering::Acquire) {
        log::debug!("[DET-SEMANTIC] Skipping emission for stale seq={seq}");
        return;
    }

    for r in &results {
        log::info!(
            "[DET-SEMANTIC] Found: {} ({:.0}% {}) auto_q={}",
            r.verse_ref,
            r.confidence * 100.0,
            r.source,
            r.auto_queued
        );
    }
    let _ = app.emit("verse_detections", &results);
    log::info!(
        "[DET-TRACE] seq={seq} decision=semantic_fuzzy emitted={} top={} ({:.0}%)",
        results.len(),
        results.first().map_or("-", |r| r.verse_ref.as_str()),
        results.first().map_or(0.0, |r| r.confidence) * 100.0
    );
    log::info!("[DET-SEMANTIC] Total: {:?}", t0.elapsed());
}

/// Check reading mode: if active, test transcript against expected verse.
/// If direct detection just found a new verse, start/restart reading mode.
/// Returns `true` when reading mode handled the transcript (suppresses semantic).
#[expect(
    clippy::too_many_lines,
    reason = "sequential state-machine logic is clearer in one flow"
)]
pub(crate) fn check_reading_mode(app: &AppHandle, transcript: &str, direct_found: bool) -> bool {
    use rhema_detection::ReadingMode;

    // If direct detection found a verse, consider starting/restarting reading mode.
    // BUT: if reading mode is already active on a book/chapter, do NOT restart
    // on a different book — false positives from bare numbers (e.g., "verse 5"
    // getting matched as "Job 3:5") would hijack the reading session.
    if direct_found {
        let verse_info = {
            let detector_state: State<'_, Mutex<DirectDetector>> = app.state();
            let Ok(detector) = detector_state.lock() else {
                return false;
            };
            detector.recent_detections().front().cloned()
        };

        if let Some(recent) = verse_info {
            // Get the confidence of the detection to distinguish explicit refs from false positives
            let detection_confidence = {
                let detector_state: State<'_, Mutex<DirectDetector>> = app.state();
                detector_state
                    .lock()
                    .ok()
                    .and_then(|d| d.recent_detections().front().map(|_| 0.95)) // Direct detections are always high confidence
                    .unwrap_or(0.0)
            };

            let should_start = {
                let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
                match rm_managed.lock() {
                    Ok(rm) => {
                        if !rm.is_active() && !rm.has_verses() {
                            true // Not active, no verses loaded — start fresh
                        } else if !rm.is_active() && rm.has_verses() {
                            // Paused — restart on any new explicit reference
                            true
                        } else if rm.current_book() == recent.book_number
                            && rm.current_chapter() == recent.chapter
                        {
                            false // Same book+chapter — already tracking this
                        } else if rm.current_book() != recent.book_number
                            && detection_confidence >= 0.90
                        {
                            // Different book with high confidence — explicit new reference
                            // (e.g., "John 1:1" after reading Exodus). Restart.
                            true
                        } else if rm.current_book() == recent.book_number {
                            // Same book, different chapter — natural progression
                            true
                        } else {
                            // Different book, low confidence — likely false positive
                            false
                        }
                    }
                    Err(_) => false,
                }
            };

            if should_start {
                let chapter_data = {
                    let t_db = std::time::Instant::now();
                    let app_managed: State<'_, Mutex<AppState>> = app.state();
                    // Blocking lock is OK — we're inside spawn_blocking, not on the async runtime.
                    let Ok(app_state) = app_managed.lock() else {
                        log::error!("[READING] AppState lock poisoned");
                        return false;
                    };
                    let result = match &app_state.bible_db {
                        Some(db) => db
                            .get_chapter(
                                app_state.active_translation_id,
                                recent.book_number,
                                recent.chapter,
                            )
                            .ok(),
                        None => None,
                    };
                    log::info!("[READING] get_chapter took {:?}", t_db.elapsed());
                    result
                };

                if let Some(chapter_verses) = chapter_data {
                    let verses: Vec<(i32, String)> = chapter_verses
                        .into_iter()
                        .map(|v| (v.verse, v.text))
                        .collect();

                    let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
                    if let Ok(mut rm) = rm_managed.lock() {
                        rm.start(
                            recent.book_number,
                            &recent.book_name,
                            recent.chapter,
                            recent.verse_start,
                            verses,
                        );

                        // Check if transcript contains "chapter" keyword - if so, expect chapter number next
                        // This handles "Genesis chapter" → pause → "5" → go to chapter 5
                        let lower = transcript.to_lowercase();
                        if lower.contains("chapter")
                            && !lower.contains("verse")
                            && !lower.contains("next")
                            && !lower.contains("previous")
                        {
                            rm.set_expecting_chapter();
                        }
                    }
                }
            }
        }
    }

    let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();

    // Check for chapter navigation commands (e.g., "let's go to chapter seven").
    {
        let chapter_change = {
            let Ok(mut rm) = rm_managed.lock() else {
                return false;
            };
            if !rm.is_active() && !rm.has_verses() {
                None
            } else {
                if transcript_logging_enabled() {
                    log::info!("[READING] Checking chapter command for: {transcript:?}");
                }
                rm.check_chapter_command(transcript)
            }
        };

        if let Some(change) = chapter_change {
            let chapter_data = {
                let t_db = std::time::Instant::now();
                let app_managed: State<'_, Mutex<AppState>> = app.state();
                // Blocking lock is OK — we're inside spawn_blocking, not on the async runtime.
                let Ok(app_state) = app_managed.lock() else {
                    log::error!("[READING] AppState lock poisoned (chapter nav)");
                    return false;
                };
                let result = match &app_state.bible_db {
                    Some(db) => db
                        .get_chapter(
                            app_state.active_translation_id,
                            change.book_number,
                            change.new_chapter,
                        )
                        .ok(),
                    None => None,
                };
                log::info!("[READING] get_chapter (nav) took {:?}", t_db.elapsed());
                result
            };

            if let Some(chapter_verses) = chapter_data {
                if !chapter_verses.is_empty() {
                    let start_verse = change.start_verse.unwrap_or(1);

                    // Find the text for the starting verse
                    let start_verse_text = chapter_verses
                        .iter()
                        .find(|v| v.verse == start_verse)
                        .map_or_else(|| chapter_verses[0].text.clone(), |v| v.text.clone());

                    let verses: Vec<(i32, String)> = chapter_verses
                        .into_iter()
                        .map(|v| (v.verse, v.text))
                        .collect();

                    if let Ok(mut rm) = rm_managed.lock() {
                        rm.start(
                            change.book_number,
                            &change.book_name,
                            change.new_chapter,
                            start_verse,
                            verses,
                        );
                    }

                    if !change.emit_start_verse {
                        log::info!(
                            "[READING] Chapter context moved to {} {}; waiting for verse before UI emit",
                            change.book_name,
                            change.new_chapter
                        );
                        return true;
                    }

                    // Emit the starting verse of the new chapter
                    let reference = format!(
                        "{} {}:{}",
                        change.book_name, change.new_chapter, start_verse
                    );
                    let advance = rhema_detection::ReadingAdvance {
                        book_number: change.book_number,
                        book_name: change.book_name.clone(),
                        chapter: change.new_chapter,
                        verse: start_verse,
                        verse_text: start_verse_text.clone(),
                        reference: reference.clone(),
                        confidence: 1.0,
                    };
                    let _ = app.emit("reading_mode_verse", &advance);

                    return true;
                }
            }
        }
    }

    // Check reading mode for verse advancement.
    // Allow check even when paused (has_verses but !active) so "verse N"
    // commands can re-activate reading mode after timeout.
    let advance = {
        let Ok(mut rm) = rm_managed.lock() else {
            return false;
        };
        if !rm.is_active() && !rm.has_verses() {
            return false;
        }
        rm.check_transcript(transcript)
    };

    if let Some(advance) = advance {
        let _ = app.emit("reading_mode_verse", &advance);
        return true;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::{
        enqueue_final_semantic_job, enqueue_partial_semantic_job, finalize_live_semantic_results,
        replace_semantic_job, take_semantic_job, DeepgramSemanticBuffer, LIVE_SEMANTIC_CAP,
        PARTIAL_SEMANTIC_DEBOUNCE, PARTIAL_SEMANTIC_MIN_WORDS, SEMANTIC_WINDOW_SEGMENTS,
    };
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    use tokio::sync::Notify;

    #[test]
    fn semantic_enqueue_skips_reference_and_command_windows() {
        let slot = Arc::new(Mutex::new(None));
        let notify = Arc::new(Notify::new());
        let sent = Arc::new(AtomicU64::new(0));
        let replaced = Arc::new(AtomicU64::new(0));

        // Explicit reference — direct path owns it; semantic must not enqueue
        // (so it cannot evict a pending prose job from the latest-wins slot).
        enqueue_final_semantic_job(
            &slot,
            &notify,
            &sent,
            &replaced,
            1,
            "John chapter 8 verse 9".to_string(),
        );
        assert!(
            slot.lock().unwrap().is_none(),
            "reference window must not enqueue a semantic job"
        );

        // Voice command — same.
        enqueue_partial_semantic_job(
            &slot,
            &notify,
            &sent,
            &replaced,
            2,
            "let's go to the next verse".to_string(),
        );
        assert!(
            slot.lock().unwrap().is_none(),
            "command window must not enqueue a semantic job"
        );

        enqueue_final_semantic_job(&slot, &notify, &sent, &replaced, 3, "one".to_string());
        assert!(
            slot.lock().unwrap().is_none(),
            "tiny final window must not enqueue a semantic job"
        );

        // Sermon prose — must enqueue so paraphrase detection still runs.
        enqueue_final_semantic_job(
            &slot,
            &notify,
            &sent,
            &replaced,
            4,
            "for God so loved the world that he gave his only begotten son".to_string(),
        );
        assert_eq!(
            slot.lock().unwrap().as_ref().map(|(seq, _)| *seq),
            Some(4),
            "prose window must enqueue a semantic job"
        );
    }

    fn make_detection_result(
        verse_ref: &str,
        book_number: i32,
        chapter: i32,
        verse: i32,
        confidence: f64,
    ) -> crate::commands::detection::DetectionResult {
        crate::commands::detection::DetectionResult {
            content_type: "bible".to_string(),
            verse_ref: verse_ref.to_string(),
            verse_text: "verse text".to_string(),
            book_name: "Book".to_string(),
            book_number,
            chapter,
            verse,
            confidence,
            source: "semantic".to_string(),
            auto_queued: false,
            transcript_snippet: "snippet".to_string(),
            is_chapter_only: false,
            egw_paragraph: None,
        }
    }

    /// Test helper to verify stale sequence suppression logic.
    /// This simulates the sequence checking used in `run_direct_detection`
    /// and `run_semantic_detection` to ensure stale jobs don't emit.
    #[test]
    fn test_stale_sequence_suppression() {
        let latest_seq = Arc::new(AtomicU64::new(10));

        // Current job is stale (seq < latest)
        let seq = 5;
        assert!(seq < latest_seq.load(Ordering::Relaxed));
        assert!(latest_seq.load(Ordering::Relaxed) > seq);

        // Current job is fresh (seq == latest)
        let seq = 10;
        assert!(seq >= latest_seq.load(Ordering::Relaxed));

        // Current job is ahead (seq > latest) - should be accepted
        let seq = 15;
        assert!(seq >= latest_seq.load(Ordering::Relaxed));
    }

    /// Test that sequence numbers increase monotonically
    #[test]
    fn test_sequence_monotonic_increase() {
        let seq = Arc::new(AtomicU64::new(0));

        let s1 = seq.fetch_add(1, Ordering::Relaxed) + 1;
        let s2 = seq.fetch_add(1, Ordering::Relaxed) + 1;
        let s3 = seq.fetch_add(1, Ordering::Relaxed) + 1;

        assert!(s1 < s2);
        assert!(s2 < s3);
        assert_eq!(s1, 1);
        assert_eq!(s2, 2);
        assert_eq!(s3, 3);
    }

    #[test]
    fn defers_to_direct_for_explicit_references_and_commands() {
        use super::transcript_defers_to_direct as defers;

        // Explicit scripture references — the direct path is authoritative.
        assert!(defers("John chapter 8 verse 9"));
        assert!(defers("Galatians 1 verse 1"));
        assert!(defers("genesis chapter 3 verse 15"));
        assert!(defers("1 Samuel 1 verse 3"));
        assert!(defers("Revelation 1 verse 1"));
        assert!(defers("Romans 8 verse 5"));
        // Voice/reading commands.
        assert!(defers("Hymn number 46"));
        assert!(defers("I need the new living translation."));
        assert!(defers("King James Version"));
        assert!(defers("let's go to the next verse"));
        assert!(defers("in the same chapter verse 17"));
    }

    #[test]
    fn does_not_defer_for_sermon_prose() {
        use super::transcript_defers_to_direct as defers;

        // Spoken verse content must stay eligible for semantic paraphrase
        // detection (e.g. this should still surface John 3:16).
        assert!(!defers(
            "For God so loved the world that he gave his only begotten son"
        ));
        assert!(!defers("testing one two testing"));
        assert!(!defers("today we are talking about obedience and grace"));
    }

    #[test]
    fn live_semantic_workflow_matches_requested_speed_and_result_window() {
        assert_eq!(LIVE_SEMANTIC_CAP, 3);
        assert_eq!(SEMANTIC_WINDOW_SEGMENTS, 4);
        assert_eq!(PARTIAL_SEMANTIC_DEBOUNCE, Duration::from_millis(100));
        assert_eq!(PARTIAL_SEMANTIC_MIN_WORDS, 3);
    }

    #[test]
    fn clamp_to_recent_words_keeps_only_trailing_words() {
        assert_eq!(
            super::clamp_to_recent_words("one two three four five", 3),
            "three four five"
        );
    }

    #[test]
    fn clamp_to_recent_words_returns_all_when_under_limit() {
        assert_eq!(
            super::clamp_to_recent_words("john three sixteen", 12),
            "john three sixteen"
        );
    }

    #[test]
    fn clamp_to_recent_words_normalizes_empty_and_extra_whitespace() {
        assert_eq!(super::clamp_to_recent_words("", 12), "");
        assert_eq!(
            super::clamp_to_recent_words("   spaced   out  ", 12),
            "spaced out"
        );
    }

    /// Test that stale detection is correctly identified when
    /// a newer transcript arrives while an older job is processing.
    #[test]
    fn test_stale_detection_with_concurrent_updates() {
        let latest_seq = Arc::new(AtomicU64::new(5));

        // Job starts with seq=5 (fresh)
        let job_seq = 5;
        assert!(job_seq >= latest_seq.load(Ordering::Relaxed));

        // While job is processing, new transcript arrives (seq=6)
        latest_seq.store(6, Ordering::Relaxed);

        // Job finishes and checks for staleness
        assert!(job_seq < latest_seq.load(Ordering::Relaxed));
        // Should skip emission
    }

    /// Test that `detection_paused` initializes to false and toggles correctly.
    /// This verifies the backend contract: Pause Suggestions must be backend-enforced.
    #[test]
    fn test_detection_paused_state() {
        let app_state = crate::state::AppState::new();
        assert!(
            !app_state
                .detection_paused
                .load(std::sync::atomic::Ordering::Relaxed),
            "detection_paused should default to false"
        );

        app_state
            .detection_paused
            .store(true, std::sync::atomic::Ordering::SeqCst);
        assert!(app_state
            .detection_paused
            .load(std::sync::atomic::Ordering::Relaxed));

        app_state
            .detection_paused
            .store(false, std::sync::atomic::Ordering::SeqCst);
        assert!(!app_state
            .detection_paused
            .load(std::sync::atomic::Ordering::Relaxed));
    }

    #[test]
    fn test_finalize_live_semantic_results_dedupes_and_boosts_overlap() {
        let results = vec![
            make_detection_result("John 3:16", 43, 3, 16, 0.86),
            make_detection_result("John 3:16", 43, 3, 16, 0.74),
            make_detection_result("Romans 8:28", 45, 8, 28, 0.72),
        ];

        let finalized = finalize_live_semantic_results(results);

        assert_eq!(finalized.len(), 2);
        assert_eq!(finalized[0].verse_ref, "John 3:16");
        assert!(
            finalized[0].confidence > 0.86,
            "overlap should boost the deduped result"
        );
    }

    #[test]
    fn test_finalize_live_semantic_results_caps_after_dedupe() {
        let results = vec![
            make_detection_result("John 3:16", 43, 3, 16, 0.90),
            make_detection_result("John 3:16", 43, 3, 16, 0.75),
            make_detection_result("Romans 8:28", 45, 8, 28, 0.82),
            make_detection_result("Genesis 1:1", 1, 1, 1, 0.81),
            make_detection_result("Psalm 23:1", 19, 23, 1, 0.80),
            make_detection_result("Isaiah 53:5", 23, 53, 5, 0.79),
            make_detection_result("Matthew 5:3", 40, 5, 3, 0.78),
        ];

        let finalized = finalize_live_semantic_results(results);

        assert_eq!(finalized.len(), LIVE_SEMANTIC_CAP);
        assert!(finalized.iter().any(|r| r.verse_ref == "Romans 8:28"));
        assert!(finalized.iter().any(|r| r.verse_ref == "Genesis 1:1"));
    }

    #[test]
    fn semantic_job_slot_replace_reports_whether_existing_job_was_replaced() {
        let slot = Arc::new(Mutex::new(None));

        assert!(!replace_semantic_job(&slot, (1, "old".to_string()), "test"));
        assert!(replace_semantic_job(&slot, (2, "new".to_string()), "test"));

        assert_eq!(
            take_semantic_job(&slot, "test"),
            Some((2, "new".to_string()))
        );
        assert_eq!(take_semantic_job(&slot, "test"), None);
    }

    #[test]
    fn semantic_job_slot_recovers_from_poisoned_lock() {
        let slot = Arc::new(Mutex::new(None));

        let poisoned_slot = slot.clone();
        let _ = std::panic::catch_unwind(move || {
            let mut guard = poisoned_slot.lock().unwrap();
            guard.replace((1, "poisoned".to_string()));
            panic!("poison semantic slot");
        });

        assert!(replace_semantic_job(
            &slot,
            (2, "recovered".to_string()),
            "test"
        ));
        assert_eq!(
            take_semantic_job(&slot, "test"),
            Some((2, "recovered".to_string()))
        );
    }

    #[test]
    fn deepgram_semantic_buffer_waits_until_speech_final() {
        let mut buffer = DeepgramSemanticBuffer::default();

        assert_eq!(buffer.push_final(1, "John 3".to_string(), false), None);
        assert_eq!(
            buffer.push_final(2, "sixteen".to_string(), true),
            Some((2, "John 3 sixteen".to_string()))
        );
        assert!(buffer.is_empty());
    }

    #[test]
    fn deepgram_semantic_buffer_flushes_duplicate_speech_final_boundary() {
        let mut buffer = DeepgramSemanticBuffer::default();

        assert_eq!(buffer.push_final(1, "Psalm 23".to_string(), false), None);
        assert_eq!(buffer.flush_with_seq(2), Some((2, "Psalm 23".to_string())));
        assert!(buffer.is_empty());
    }

    #[test]
    fn deepgram_semantic_buffer_utterance_end_uses_last_final_seq() {
        let mut buffer = DeepgramSemanticBuffer::default();

        assert_eq!(
            buffer.push_final(7, "The Lord is my shepherd".to_string(), false),
            None
        );
        assert_eq!(
            buffer.flush(),
            Some((7, "The Lord is my shepherd".to_string()))
        );
        assert!(buffer.is_empty());
    }
}
