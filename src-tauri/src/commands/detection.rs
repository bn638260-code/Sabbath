#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]

use std::sync::Mutex;

use serde::Serialize;
use tauri::State;

use rhema_detection::{DetectionPipeline, ReadingMode};

use super::validation::{
    bounded_optional_limit, bounded_text, MAX_QUERY_BYTES, MAX_TRANSCRIPT_BYTES,
};
use crate::state::AppState;

mod egw;
mod result;
mod semantic_search;
mod settings;

#[cfg(test)]
pub(crate) use egw::detect_egw_fts;
pub(crate) use egw::{apply_egw_auto_queue, detect_egw_references};
pub use result::{to_result, DetectionResult};
use semantic_search::{run_semantic_search, SemanticSearchResult};
use settings::{apply_detection_settings_to_merger, DEFAULT_SEMANTIC_VISIBILITY_THRESHOLD};

/// Confidence assigned to the best FTS5 BM25 match (rank 0) in context search.
pub(crate) const FTS5_RANK0_CONFIDENCE: f64 = 0.68;

/// Confidence decrease per FTS5 rank position.
pub(crate) const FTS5_CONFIDENCE_DECAY: f64 = 0.04;

/// FTS5 results below this confidence are not included.
pub(crate) const FTS5_MIN_CONFIDENCE: f64 = 0.50;

/// Direct detection results at or above this confidence are visible to operators.
/// Auto-live/auto-queue uses the UI threshold separately.
pub(crate) const OPERATOR_DETECTION_THRESHOLD: f64 = 0.70;

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
    let mut results: Vec<DetectionResult> =
        merged.iter().map(|m| to_result(&app_state, m)).collect();
    results.extend(detect_egw_references(&app_state, &text));
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

#[tauri::command]
pub fn semantic_search(
    state: State<'_, Mutex<AppState>>,
    pipeline_state: State<'_, Mutex<DetectionPipeline>>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SemanticSearchResult>, String> {
    bounded_text(&query, "query", MAX_QUERY_BYTES)?;
    let k = bounded_optional_limit(limit, 10)?;
    let (vector_results, semantic_ready) = {
        let mut pipeline = pipeline_state.lock().map_err(|e| e.to_string())?;
        let semantic_ready = pipeline.has_semantic();
        if semantic_ready {
            (pipeline.semantic_search(&query, k), semantic_ready)
        } else {
            (Vec::new(), semantic_ready)
        }
    };
    let app_state = state.lock().map_err(|e| e.to_string())?;
    Ok(run_semantic_search(
        &app_state,
        &query,
        k,
        vector_results,
        semantic_ready,
    ))
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
    semantic_confidence_threshold: Option<f64>,
    cooldown_ms: u64,
) -> Result<(), String> {
    if !confidence_threshold.is_finite() {
        return Err("confidence_threshold must be finite".into());
    }
    if let Some(threshold) = semantic_confidence_threshold {
        if !threshold.is_finite() {
            return Err("semantic_confidence_threshold must be finite".into());
        }
    }
    let threshold = confidence_threshold.clamp(0.0, 1.0);
    let semantic_threshold = semantic_confidence_threshold
        .unwrap_or(DEFAULT_SEMANTIC_VISIBILITY_THRESHOLD)
        .clamp(0.0, 1.0);
    let auto_threshold = auto_mode.then_some(threshold);

    {
        let mut merger = merger_state.lock().map_err(|e| e.to_string())?;
        apply_detection_settings_to_merger(
            &mut merger,
            auto_threshold,
            semantic_threshold,
            cooldown_ms,
        );
    }

    {
        let mut pipeline = pipeline_state.lock().map_err(|e| e.to_string())?;
        apply_detection_settings_to_merger(
            pipeline.merger_mut(),
            auto_threshold,
            semantic_threshold,
            cooldown_ms,
        );
    }

    log::info!(
        "[DET] Settings updated: auto_mode={auto_mode}, operator_threshold={OPERATOR_DETECTION_THRESHOLD:.2}, semantic_threshold={semantic_threshold:.2}, auto_threshold={}, cooldown_ms={}",
        auto_threshold.map_or_else(|| "disabled".to_string(), |value| format!("{value:.2}")),
        cooldown_ms.clamp(250, 60_000)
    );

    Ok(())
}

#[derive(Serialize)]
pub struct DetectionControlStatus {
    pub detection_paused: bool,
    pub explicit_citations_only: bool,
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
pub fn set_explicit_citations_only(
    state: State<'_, Mutex<AppState>>,
    enabled: bool,
) -> Result<bool, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    app_state
        .explicit_citations_only
        .store(enabled, std::sync::atomic::Ordering::SeqCst);
    log::info!("[DET] Explicit citations only set to: {enabled}");
    Ok(enabled)
}

#[tauri::command]
pub fn detection_control_status(
    state: State<'_, Mutex<AppState>>,
) -> Result<DetectionControlStatus, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let detection_paused = app_state
        .detection_paused
        .load(std::sync::atomic::Ordering::Relaxed);
    let explicit_citations_only = app_state
        .explicit_citations_only
        .load(std::sync::atomic::Ordering::Relaxed);
    Ok(DetectionControlStatus {
        detection_paused,
        explicit_citations_only,
    })
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

    fn direct_merged_with_reference(book_number: i32, chapter: i32, verse: i32) -> MergedDetection {
        MergedDetection {
            detection: Detection {
                verse_ref: VerseRef {
                    book_number,
                    book_name: "John".to_string(),
                    chapter,
                    verse_start: verse,
                    verse_end: None,
                },
                verse_id: None,
                confidence: 0.98,
                source: DetectionSource::DirectReference,
                transcript_snippet: format!("John {chapter}:{verse}"),
                detected_at: 0,
                is_chapter_only: false,
            },
            auto_queued: true,
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
             CREATE TABLE egw_books (id INTEGER PRIMARY KEY AUTOINCREMENT, book_number INTEGER NOT NULL UNIQUE, title TEXT NOT NULL, abbreviation TEXT NOT NULL, chapter_count INTEGER NOT NULL DEFAULT 0);
             CREATE TABLE egw_paragraphs (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL, book_number INTEGER NOT NULL, book_title TEXT NOT NULL, chapter INTEGER NOT NULL, chapter_title TEXT NOT NULL, paragraph INTEGER NOT NULL, text TEXT NOT NULL);
             INSERT INTO translations VALUES
               (1, 'KJV', 'King James', 'en', 0, 1),
               (2, 'NKJV', 'New King James', 'en', 1, 1),
               (3, 'NLT', 'New Living Translation', 'en', 1, 1),
               (4, 'SpaRV', 'Reina-Valera', 'es', 0, 1),
               (5, 'FreJND', 'J.N. Darby French', 'fr', 0, 1);
             INSERT INTO books VALUES
               (1, 1, 43, 'John', 'Jn', 'NT'),
               (2, 2, 43, 'John', 'Jn', 'NT'),
               (3, 3, 43, 'John', 'Jn', 'NT'),
               (4, 4, 43, 'Juan', 'Jn', 'NT'),
               (5, 5, 43, 'Jean', 'Jn', 'NT');
             INSERT INTO verses VALUES
               (100, 1, 43, 'John', 'Jn', 3, 16, 'KJV John 3:16 text.'),
               (101, 1, 43, 'John', 'Jn', 3, 17, 'KJV John 3:17 text.'),
               (200, 2, 43, 'John', 'Jn', 3, 16, 'NKJV John 3:16 text.'),
               (300, 3, 43, 'John', 'Jn', 3, 16, 'NLT John 3:16 text.'),
               (400, 4, 43, 'Juan', 'Jn', 3, 16, 'SpaRV Juan 3:16 text.'),
               (500, 5, 43, 'Jean', 'Jn', 3, 16, 'FreJND Jean 3:16 text.');
             INSERT INTO egw_books (book_number, title, abbreviation, chapter_count) VALUES
               (1, 'Patriarchs and Prophets', 'PP', 2),
               (2, 'The Desire of Ages', 'DA', 1);
             INSERT INTO egw_paragraphs (book_id, book_number, book_title, chapter, chapter_title, paragraph, text) VALUES
               (1, 1, 'Patriarchs and Prophets', 1, 'Why Was Sin Permitted?', 2, 'The history of the great conflict.'),
               (2, 2, 'The Desire of Ages', 14, 'We Have Found the Messias', 3, 'Jesus had bidden Peter and his companions follow Him.');
             CREATE VIRTUAL TABLE egw_paragraphs_fts USING fts5(text, content='egw_paragraphs', content_rowid='id', tokenize='unicode61');
             INSERT INTO egw_paragraphs_fts(rowid, text) SELECT id, text FROM egw_paragraphs;",
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

        apply_detection_settings_to_merger(
            &mut merger,
            Some(0.80),
            DEFAULT_SEMANTIC_VISIBILITY_THRESHOLD,
            2500,
        );

        let results = merger.merge(vec![], vec![semantic_detection(0.79)]);

        assert!(
            (merger.confidence_threshold() - OPERATOR_DETECTION_THRESHOLD).abs() < f64::EPSILON
        );
        assert!(
            (merger.semantic_confidence_threshold() - DEFAULT_SEMANTIC_VISIBILITY_THRESHOLD).abs()
                < f64::EPSILON
        );
        assert!((merger.auto_queue_threshold() - 0.80).abs() < f64::EPSILON);
        assert_eq!(results.len(), 1);
        assert!(!results[0].auto_queued);
    }

    #[test]
    fn manual_mode_disables_auto_queue_without_hiding_semantic_results() {
        let mut merger = DetectionMerger::new();

        apply_detection_settings_to_merger(
            &mut merger,
            None,
            DEFAULT_SEMANTIC_VISIBILITY_THRESHOLD,
            2500,
        );

        let results = merger.merge(vec![], vec![semantic_detection(0.79)]);

        assert_eq!(results.len(), 1);
        assert!(!results[0].auto_queued);
        assert!(merger.auto_queue_threshold().is_infinite());
    }

    #[test]
    fn detection_settings_apply_semantic_visibility_threshold() {
        let mut merger = DetectionMerger::new();

        apply_detection_settings_to_merger(&mut merger, Some(0.85), 0.65, 2500);

        assert!(
            (merger.confidence_threshold() - OPERATOR_DETECTION_THRESHOLD).abs() < f64::EPSILON
        );
        assert!((merger.semantic_confidence_threshold() - 0.65).abs() < f64::EPSILON);
        assert!(merger
            .merge(vec![], vec![semantic_detection(0.64)])
            .is_empty());
        assert_eq!(
            merger.merge(vec![], vec![semantic_detection(0.65)]).len(),
            1
        );
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
    fn to_result_resolves_semantic_vector_id_to_spanish_and_french_active_translations() {
        for (translation_id, expected_ref, expected_text) in [
            (4, "Juan 3:16", "SpaRV Juan 3:16 text."),
            (5, "Jean 3:16", "FreJND Jean 3:16 text."),
        ] {
            let fixture = fixture_state(translation_id);
            let merged = semantic_merged_with_verse_id(100);

            let result = to_result(&fixture.state, &merged);

            assert_eq!(result.verse_ref, expected_ref);
            assert_eq!(result.verse_text, expected_text);
            assert_eq!(result.source, "semantic");
        }
    }

    #[test]
    fn to_result_resolves_direct_reference_to_active_translation() {
        let fixture = fixture_state(2);
        let merged = direct_merged_with_reference(43, 3, 16);

        let result = to_result(&fixture.state, &merged);

        assert_eq!(result.verse_ref, "John 3:16");
        assert_eq!(result.verse_text, "NKJV John 3:16 text.");
        assert_eq!(result.source, "direct");
        assert!(result.auto_queued);
    }

    #[test]
    fn to_result_resolves_direct_reference_to_spanish_and_french_active_translations() {
        for (translation_id, expected_ref, expected_text) in [
            (4, "Juan 3:16", "SpaRV Juan 3:16 text."),
            (5, "Jean 3:16", "FreJND Jean 3:16 text."),
        ] {
            let fixture = fixture_state(translation_id);
            let merged = direct_merged_with_reference(43, 3, 16);

            let result = to_result(&fixture.state, &merged);

            assert_eq!(result.verse_ref, expected_ref);
            assert_eq!(result.verse_text, expected_text);
            assert_eq!(result.source, "direct");
        }
    }

    #[test]
    fn to_result_falls_back_to_source_translation_when_active_reference_missing() {
        let fixture = fixture_state(2);
        let merged = semantic_merged_with_verse_id(101);

        let result = to_result(&fixture.state, &merged);

        assert_eq!(result.verse_ref, "John 3:17");
        assert_eq!(result.verse_text, "KJV John 3:17 text.");
    }

    #[test]
    fn detect_egw_references_finds_title_chapter_paragraph() {
        let fixture = fixture_state(1);

        let results = detect_egw_references(
            &fixture.state,
            "please read Patriarchs and Prophets chapter one paragraph two",
        );

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content_type, "egw");
        assert_eq!(results[0].verse_ref, "Patriarchs and Prophets 1:2");
        assert_eq!(
            results[0].egw_paragraph.as_ref().map(|p| p.text.as_str()),
            Some("The history of the great conflict.")
        );
    }

    #[test]
    fn egw_direct_results_auto_queue_when_auto_mode_threshold_allows() {
        let fixture = fixture_state(1);
        let mut results = detect_egw_references(
            &fixture.state,
            "please read Patriarchs and Prophets chapter one paragraph two",
        );
        let mut merger = DetectionMerger::new();
        apply_detection_settings_to_merger(
            &mut merger,
            Some(0.80),
            DEFAULT_SEMANTIC_VISIBILITY_THRESHOLD,
            2500,
        );

        apply_egw_auto_queue(&mut results, &mut merger);

        assert_eq!(results.len(), 1);
        assert!(results[0].auto_queued);
    }

    #[test]
    fn egw_direct_results_do_not_auto_queue_in_manual_mode() {
        let fixture = fixture_state(1);
        let mut results = detect_egw_references(&fixture.state, "PP 1:2");
        let mut merger = DetectionMerger::new();
        apply_detection_settings_to_merger(
            &mut merger,
            None,
            DEFAULT_SEMANTIC_VISIBILITY_THRESHOLD,
            2500,
        );

        apply_egw_auto_queue(&mut results, &mut merger);

        assert_eq!(results.len(), 1);
        assert!(!results[0].auto_queued);
    }

    #[test]
    fn detect_egw_references_resolves_reference_embedded_in_rolling_window() {
        // The live semantic gate runs this on the rolling transcript window so
        // Ellen White references that endpointing fragmented across finals are
        // still caught (surrounded by other speech).
        let fixture = fixture_state(1);

        let results = detect_egw_references(
            &fixture.state,
            "testing one two the desire of ages chapter fourteen paragraph three and then we continue",
        );

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].verse_ref, "The Desire of Ages 14:3");
        assert_eq!(results[0].source, "direct");
    }

    #[test]
    fn detect_egw_references_handles_noisy_spoken_human_intro() {
        let fixture = fixture_state(1);

        let results = detect_egw_references(
            &fixture.state,
            "um can we go to patriarchs and prophets chapter one paragraph two please",
        );

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content_type, "egw");
        assert_eq!(results[0].verse_ref, "Patriarchs and Prophets 1:2");
        assert_eq!(results[0].source, "direct");
    }

    #[test]
    fn detect_egw_references_finds_abbreviation_colon_style_reference() {
        let fixture = fixture_state(1);

        let results = detect_egw_references(&fixture.state, "DA 14:3");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content_type, "egw");
        assert_eq!(results[0].verse_ref, "The Desire of Ages 14:3");
        assert_eq!(results[0].chapter, 14);
        assert_eq!(results[0].verse, 3);
    }

    #[test]
    fn detect_egw_fts_matches_paragraph_by_keywords() {
        let fixture = fixture_state(1);

        let results = detect_egw_fts(
            &fixture.state,
            "tonight we consider the great conflict and its history",
        );

        assert!(!results.is_empty());
        assert_eq!(results[0].content_type, "egw");
        assert_eq!(results[0].source, "semantic");
        assert_eq!(
            results[0].egw_paragraph.as_ref().map(|p| p.paragraph),
            Some(2)
        );
    }

    #[test]
    fn detect_egw_references_requires_existing_paragraph() {
        let fixture = fixture_state(1);

        let results = detect_egw_references(&fixture.state, "PP 1:99");

        assert!(results.is_empty());
    }
}
