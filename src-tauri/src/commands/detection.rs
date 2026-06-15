#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]

use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Instant;

use serde::Serialize;
use tauri::State;

use rhema_bible::Verse;
use rhema_detection::{DetectionPipeline, MergedDetection, ReadingMode};

use super::validation::{
    bounded_optional_limit, bounded_text, MAX_QUERY_BYTES, MAX_TRANSCRIPT_BYTES,
};
use crate::state::AppState;

/// Confidence assigned to the best FTS5 BM25 match (rank 0) in context search.
pub(crate) const FTS5_RANK0_CONFIDENCE: f64 = 0.68;

/// Confidence decrease per FTS5 rank position.
pub(crate) const FTS5_CONFIDENCE_DECAY: f64 = 0.04;

/// FTS5 results below this confidence are not included.
pub(crate) const FTS5_MIN_CONFIDENCE: f64 = 0.50;

/// Detection results at or above this confidence are visible to operators.
/// Auto-live/auto-queue uses the UI threshold separately.
pub(crate) const OPERATOR_DETECTION_THRESHOLD: f64 = 0.42;

const AUTO_QUEUE_DISABLED_THRESHOLD: f64 = f64::INFINITY;

/// Serializable detection result for the frontend
#[derive(Clone, Serialize)]
pub struct DetectionResult {
    pub verse_ref: String,
    pub verse_text: String,
    pub book_name: String,
    pub book_number: i32,
    pub chapter: i32,
    pub verse: i32,
    pub confidence: f64,
    pub source: String,
    pub auto_queued: bool,
    pub transcript_snippet: String,
    /// True when detected from a chapter-only reference (verse defaults to 1, may be refined).
    pub is_chapter_only: bool,
}

fn source_to_string(source: &rhema_detection::DetectionSource) -> String {
    match source {
        rhema_detection::DetectionSource::DirectReference => "direct".to_string(),
        rhema_detection::DetectionSource::Semantic { .. } => "semantic".to_string(),
    }
}

/// Resolve a detection to a full verse result using the database.
///
/// Resolution order:
/// 1. Semantic `verse_id` mapped to the active translation by reference.
/// 2. By `book_number/chapter/verse_start` with active translation.
/// 3. Semantic `verse_id` source row fallback if the active translation is missing the verse.
/// 4. Fallback to unresolved `VerseRef` fields (no DB available).
pub fn to_result(state: &AppState, merged: &MergedDetection) -> DetectionResult {
    let vr = &merged.detection.verse_ref;
    let vid = merged.detection.verse_id;

    let resolved = state.bible_db.as_ref().and_then(|db| {
        let source_verse = vid.and_then(|id| resolve_semantic_verse_id(state, id));
        // Fall back to book/chapter/verse lookup (direct + FTS5 detections)
        if vr.book_number > 0 && vr.chapter > 0 && vr.verse_start > 0 {
            if let Ok(Some(v)) = db.get_verse(
                state.active_translation_id,
                vr.book_number,
                vr.chapter,
                vr.verse_start,
            ) {
                return Some(v);
            }
        }
        if source_verse.is_some() {
            return source_verse;
        }
        None
    });

    let (reference, verse_text, book_name, book_number, chapter, verse) = if let Some(v) = resolved
    {
        let r = format!("{} {}:{}", v.book_name, v.chapter, v.verse);
        (r, v.text, v.book_name, v.book_number, v.chapter, v.verse)
    } else {
        let r = format!("{} {}:{}", vr.book_name, vr.chapter, vr.verse_start);
        (
            r,
            String::new(),
            vr.book_name.clone(),
            vr.book_number,
            vr.chapter,
            vr.verse_start,
        )
    };

    DetectionResult {
        verse_ref: reference,
        verse_text,
        book_name,
        book_number,
        chapter,
        verse,
        confidence: merged.detection.confidence,
        source: source_to_string(&merged.detection.source),
        auto_queued: merged.auto_queued,
        transcript_snippet: merged.detection.transcript_snippet.clone(),
        is_chapter_only: merged.detection.is_chapter_only,
    }
}

fn resolve_semantic_verse_id(state: &AppState, verse_id: i64) -> Option<Verse> {
    let db = state.bible_db.as_ref()?;
    match db.get_verse_by_id_in_translation(verse_id, state.active_translation_id) {
        Ok(Some(active_verse)) => {
            if active_verse.id != verse_id {
                log::debug!(
                    "[DET] Resolved semantic verse_id={} to active_translation_id={} as {} {}:{}",
                    verse_id,
                    state.active_translation_id,
                    active_verse.book_name,
                    active_verse.chapter,
                    active_verse.verse
                );
            }
            return Some(active_verse);
        }
        Ok(None) => {}
        Err(error) => {
            log::warn!(
                "[DET] Failed to resolve semantic verse_id={} in active_translation_id={}: {error}",
                verse_id,
                state.active_translation_id
            );
        }
    }

    match db.get_verse_by_id(verse_id) {
        Ok(source_verse) => source_verse,
        Err(error) => {
            log::warn!("[DET] Failed to resolve semantic source verse_id={verse_id}: {error}");
            None
        }
    }
}

/// Run the detection pipeline on a piece of transcript text
#[tauri::command]
pub fn detect_verses(
    state: State<'_, Mutex<AppState>>,
    pipeline_state: State<'_, Mutex<DetectionPipeline>>,
    text: String,
) -> Result<Vec<DetectionResult>, String> {
    bounded_text(&text, "text", MAX_TRANSCRIPT_BYTES)?;
    let merged = {
        let mut pipeline = pipeline_state.lock().map_err(|e| e.to_string())?;
        pipeline.process(&text)
    };
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let results: Vec<DetectionResult> = merged.iter().map(|m| to_result(&app_state, m)).collect();
    Ok(results)
}

/// Check if semantic search is available
#[tauri::command]
pub fn detection_status(
    pipeline_state: State<'_, Mutex<DetectionPipeline>>,
) -> Result<DetectionStatusResult, String> {
    let pipeline = pipeline_state.lock().map_err(|e| e.to_string())?;
    Ok(DetectionStatusResult {
        has_direct: true,
        has_semantic: pipeline.has_semantic(),
        paraphrase_enabled: pipeline.use_synonyms(),
    })
}

/// Toggle paraphrase detection (synonym expansion) on/off
#[tauri::command]
pub fn toggle_paraphrase_detection(
    pipeline_state: State<'_, Mutex<DetectionPipeline>>,
    enabled: bool,
) -> Result<bool, String> {
    let mut pipeline = pipeline_state.lock().map_err(|e| e.to_string())?;
    pipeline.set_use_synonyms(enabled);
    log::info!("[DET] Paraphrase detection (synonyms) set to: {enabled}");
    Ok(enabled)
}

#[derive(Serialize)]
pub struct DetectionStatusResult {
    pub has_direct: bool,
    pub has_semantic: bool,
    pub paraphrase_enabled: bool,
}

#[derive(Serialize)]
pub struct SemanticSearchResult {
    pub verse_ref: String,
    pub verse_text: String,
    pub book_name: String,
    pub book_number: i32,
    pub chapter: i32,
    pub verse: i32,
    pub similarity: f64,
}

#[tauri::command]
pub fn semantic_search(
    state: State<'_, Mutex<AppState>>,
    pipeline_state: State<'_, Mutex<DetectionPipeline>>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SemanticSearchResult>, String> {
    let t0 = Instant::now();
    bounded_text(&query, "query", MAX_QUERY_BYTES)?;
    let k = bounded_optional_limit(limit, 10)?;

    // Lock pipeline for vector search (may be slow if ONNX runs). If the
    // optional semantic assets are absent, continue with the FTS5 fallback
    // below so context search still works in free/lightweight installs.
    let (vector_results, semantic_ready) = {
        let mut pipeline = pipeline_state.lock().map_err(|e| e.to_string())?;
        let semantic_ready = pipeline.has_semantic();
        if semantic_ready {
            (pipeline.semantic_search(&query, k), semantic_ready)
        } else {
            (Vec::new(), semantic_ready)
        }
    }; // Pipeline lock dropped

    // Lock AppState for DB lookups only (fast)
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let vector_hit_count = vector_results.len();

    let mut results: Vec<SemanticSearchResult> = vector_results
        .into_iter()
        .filter_map(|(verse_id, similarity)| {
            if let Some(v) = resolve_semantic_verse_id(&app_state, verse_id) {
                return Some(SemanticSearchResult {
                    verse_ref: format!("{} {}:{}", v.book_name, v.chapter, v.verse),
                    verse_text: v.text,
                    book_name: v.book_name,
                    book_number: v.book_number,
                    chapter: v.chapter,
                    verse: v.verse,
                    similarity,
                });
            }
            None
        })
        .collect();

    // FTS5 BM25 across all English translations — resolve to active translation
    let mut fts_count = 0;
    if let Some(ref db) = app_state.bible_db {
        let fts_results = db.search_verses_bm25(&query, k).unwrap_or_else(|e| {
            log::warn!("[semantic_search] FTS5/BM25 query failed: {e}");
            Vec::new()
        });
        fts_count = fts_results.len();
        let seen: HashSet<(i32, i32, i32)> = results
            .iter()
            .map(|r| (r.book_number, r.chapter, r.verse))
            .collect();

        for (rank, fts) in fts_results.iter().enumerate() {
            if !seen.contains(&(fts.book_number, fts.chapter, fts.verse)) {
                #[expect(clippy::cast_precision_loss, reason = "rank is small")]
                let similarity = FTS5_RANK0_CONFIDENCE - (rank as f64 * FTS5_CONFIDENCE_DECAY);
                if similarity < FTS5_MIN_CONFIDENCE {
                    break;
                }
                // Resolve to active translation text
                if let Ok(Some(v)) = db.get_verse(
                    app_state.active_translation_id,
                    fts.book_number,
                    fts.chapter,
                    fts.verse,
                ) {
                    results.push(SemanticSearchResult {
                        verse_ref: format!("{} {}:{}", v.book_name, v.chapter, v.verse),
                        verse_text: v.text,
                        book_name: v.book_name,
                        book_number: v.book_number,
                        chapter: v.chapter,
                        verse: v.verse,
                        similarity,
                    });
                }
            }
        }
    }

    // Ensure highest similarity is always first
    results.sort_by(|a, b| {
        b.similarity
            .partial_cmp(&a.similarity)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    log::info!(
        "[DET-SEMANTIC-SEARCH] words={} vector_hits={} fts_hits={} semantic_ready={} active_translation_id={} results={} elapsed={:?}",
        query.split_whitespace().count(),
        vector_hit_count,
        fts_count,
        semantic_ready,
        app_state.active_translation_id,
        results.len(),
        t0.elapsed()
    );

    Ok(results)
}

/// Get reading mode status
#[tauri::command]
pub fn reading_mode_status(
    state: State<'_, Mutex<ReadingMode>>,
) -> Result<ReadingModeStatus, String> {
    let rm = state.lock().map_err(|e| e.to_string())?;
    Ok(ReadingModeStatus {
        active: rm.is_active(),
        current_verse: rm.current_verse(),
    })
}

#[derive(Serialize)]
pub struct ReadingModeStatus {
    pub active: bool,
    pub current_verse: Option<i32>,
}

/// Stop reading mode
#[tauri::command]
pub fn stop_reading_mode(state: State<'_, Mutex<ReadingMode>>) -> Result<(), String> {
    let mut rm = state.lock().map_err(|e| e.to_string())?;
    rm.deactivate();
    Ok(())
}

#[tauri::command]
pub fn update_detection_settings(
    merger_state: State<'_, Mutex<rhema_detection::DetectionMerger>>,
    pipeline_state: State<'_, Mutex<DetectionPipeline>>,
    auto_mode: bool,
    confidence_threshold: f64,
    cooldown_ms: u64,
) -> Result<(), String> {
    if !confidence_threshold.is_finite() {
        return Err("confidence_threshold must be finite".into());
    }
    let threshold = confidence_threshold.clamp(0.0, 1.0);
    let auto_threshold = auto_mode.then_some(threshold);

    {
        let mut merger = merger_state.lock().map_err(|e| e.to_string())?;
        apply_detection_settings_to_merger(&mut merger, auto_threshold, cooldown_ms);
    }

    {
        let mut pipeline = pipeline_state.lock().map_err(|e| e.to_string())?;
        apply_detection_settings_to_merger(pipeline.merger_mut(), auto_threshold, cooldown_ms);
    }

    log::info!(
        "[DET] Settings updated: auto_mode={auto_mode}, operator_threshold={OPERATOR_DETECTION_THRESHOLD:.2}, auto_threshold={}, cooldown_ms={}",
        auto_threshold.map_or_else(|| "disabled".to_string(), |value| format!("{value:.2}")),
        cooldown_ms.clamp(250, 60_000)
    );

    Ok(())
}

fn apply_detection_settings_to_merger(
    merger: &mut rhema_detection::DetectionMerger,
    auto_threshold: Option<f64>,
    cooldown_ms: u64,
) {
    merger.set_confidence_threshold(OPERATOR_DETECTION_THRESHOLD);
    merger.set_auto_queue_threshold(auto_threshold.unwrap_or(AUTO_QUEUE_DISABLED_THRESHOLD));
    merger.set_cooldown_ms(cooldown_ms.clamp(250, 60_000));
}

#[derive(Serialize)]
pub struct DetectionControlStatus {
    pub detection_paused: bool,
}

#[tauri::command]
pub fn set_detection_paused(
    state: State<'_, Mutex<AppState>>,
    paused: bool,
) -> Result<bool, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    app_state
        .detection_paused
        .store(paused, std::sync::atomic::Ordering::SeqCst);
    log::info!("[DET] Detection paused set to: {paused}");
    Ok(paused)
}

#[tauri::command]
pub fn detection_control_status(
    state: State<'_, Mutex<AppState>>,
) -> Result<DetectionControlStatus, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let detection_paused = app_state
        .detection_paused
        .load(std::sync::atomic::Ordering::Relaxed);
    Ok(DetectionControlStatus { detection_paused })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rhema_detection::{Detection, DetectionMerger, DetectionSource, MergedDetection, VerseRef};

    struct DetectionFixture {
        state: AppState,
        _dir: tempfile::TempDir,
    }

    fn semantic_detection(confidence: f64) -> Detection {
        Detection {
            verse_ref: VerseRef {
                book_number: 43,
                book_name: "John".to_string(),
                chapter: 3,
                verse_start: 16,
                verse_end: None,
            },
            verse_id: None,
            confidence,
            source: DetectionSource::Semantic {
                similarity: confidence,
            },
            transcript_snippet: "testimony about grace and rescue".to_string(),
            detected_at: 0,
            is_chapter_only: false,
        }
    }

    fn semantic_merged_with_verse_id(verse_id: i64) -> MergedDetection {
        MergedDetection {
            detection: Detection {
                verse_ref: VerseRef {
                    book_number: 0,
                    book_name: String::new(),
                    chapter: 0,
                    verse_start: 0,
                    verse_end: None,
                },
                verse_id: Some(verse_id),
                confidence: 0.72,
                source: DetectionSource::Semantic { similarity: 0.72 },
                transcript_snippet: "God so loved the world".to_string(),
                detected_at: 0,
                is_chapter_only: false,
            },
            auto_queued: false,
        }
    }

    fn fixture_state(active_translation_id: i64) -> DetectionFixture {
        let dir = tempfile::tempdir().expect("temp dir");
        let db_path = dir.path().join("rhema.db");
        let conn = rusqlite::Connection::open(&db_path).expect("open fixture db");
        conn.execute_batch(
            "CREATE TABLE translations (id INTEGER PRIMARY KEY, abbreviation TEXT, title TEXT, language TEXT, is_copyrighted INTEGER, is_downloaded INTEGER);
             CREATE TABLE books (id INTEGER PRIMARY KEY, translation_id INTEGER, book_number INTEGER, name TEXT, abbreviation TEXT, testament TEXT);
             CREATE TABLE verses (id INTEGER PRIMARY KEY, translation_id INTEGER, book_number INTEGER, book_name TEXT, book_abbreviation TEXT, chapter INTEGER, verse INTEGER, text TEXT);
             INSERT INTO translations VALUES
               (1, 'KJV', 'King James', 'en', 0, 1),
               (2, 'NKJV', 'New King James', 'en', 1, 1),
               (3, 'NLT', 'New Living Translation', 'en', 1, 1);
             INSERT INTO books VALUES
               (1, 1, 43, 'John', 'Jn', 'NT'),
               (2, 2, 43, 'John', 'Jn', 'NT'),
               (3, 3, 43, 'John', 'Jn', 'NT');
             INSERT INTO verses VALUES
               (100, 1, 43, 'John', 'Jn', 3, 16, 'KJV John 3:16 text.'),
               (101, 1, 43, 'John', 'Jn', 3, 17, 'KJV John 3:17 text.'),
               (200, 2, 43, 'John', 'Jn', 3, 16, 'NKJV John 3:16 text.'),
               (300, 3, 43, 'John', 'Jn', 3, 16, 'NLT John 3:16 text.');",
        )
        .expect("fixture schema");
        drop(conn);

        let mut state = AppState::new();
        state.active_translation_id = active_translation_id;
        state.bible_db = Some(rhema_bible::BibleDb::open(&db_path).expect("open bible db"));

        DetectionFixture { state, _dir: dir }
    }

    #[test]
    fn detection_settings_keep_semantic_results_visible_below_auto_threshold() {
        let mut merger = DetectionMerger::new();

        apply_detection_settings_to_merger(&mut merger, Some(0.80), 2500);

        let results = merger.merge(vec![], vec![semantic_detection(0.50)]);

        assert!(
            (merger.confidence_threshold() - OPERATOR_DETECTION_THRESHOLD).abs() < f64::EPSILON
        );
        assert!((merger.auto_queue_threshold() - 0.80).abs() < f64::EPSILON);
        assert_eq!(results.len(), 1);
        assert!(!results[0].auto_queued);
    }

    #[test]
    fn manual_mode_disables_auto_queue_without_hiding_semantic_results() {
        let mut merger = DetectionMerger::new();

        apply_detection_settings_to_merger(&mut merger, None, 2500);

        let results = merger.merge(vec![], vec![semantic_detection(0.72)]);

        assert_eq!(results.len(), 1);
        assert!(!results[0].auto_queued);
        assert!(merger.auto_queue_threshold().is_infinite());
    }

    #[test]
    fn to_result_resolves_semantic_vector_id_to_active_translation() {
        let fixture = fixture_state(3);
        let merged = semantic_merged_with_verse_id(100);

        let result = to_result(&fixture.state, &merged);

        assert_eq!(result.verse_ref, "John 3:16");
        assert_eq!(result.verse_text, "NLT John 3:16 text.");
        assert_eq!(result.source, "semantic");
    }

    #[test]
    fn to_result_falls_back_to_source_translation_when_active_reference_missing() {
        let fixture = fixture_state(2);
        let merged = semantic_merged_with_verse_id(101);

        let result = to_result(&fixture.state, &merged);

        assert_eq!(result.verse_ref, "John 3:17");
        assert_eq!(result.verse_text, "KJV John 3:17 text.");
    }
}
