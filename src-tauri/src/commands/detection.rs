#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]

use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Instant;

use serde::Serialize;
use tauri::State;

use rhema_bible::{EgwBook, EgwParagraph, Verse};
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
    pub content_type: String,
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
    pub egw_paragraph: Option<EgwParagraph>,
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
        content_type: "bible".to_string(),
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
        egw_paragraph: None,
    }
}

fn egw_to_result(
    paragraph: EgwParagraph,
    confidence: f64,
    transcript_snippet: &str,
) -> DetectionResult {
    let reference = format!(
        "{} {}:{}",
        paragraph.book_title, paragraph.chapter, paragraph.paragraph
    );

    DetectionResult {
        content_type: "egw".to_string(),
        verse_ref: reference,
        verse_text: paragraph.text.clone(),
        book_name: paragraph.book_title.clone(),
        book_number: paragraph.book_number,
        chapter: paragraph.chapter,
        verse: paragraph.paragraph,
        confidence,
        source: "direct".to_string(),
        auto_queued: false,
        transcript_snippet: transcript_snippet.to_string(),
        is_chapter_only: false,
        egw_paragraph: Some(paragraph),
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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ParsedNumber {
    value: i32,
    next_index: usize,
}

fn normalize_reference_text(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn integer_token(token: &str) -> Option<i32> {
    if token.chars().all(|ch| ch.is_ascii_digit()) {
        return token.parse::<i32>().ok().filter(|value| *value > 0);
    }
    None
}

fn unit_word(token: &str) -> Option<i32> {
    match token {
        "one" | "first" => Some(1),
        "two" | "second" => Some(2),
        "three" | "third" => Some(3),
        "four" | "fourth" => Some(4),
        "five" | "fifth" => Some(5),
        "six" | "sixth" => Some(6),
        "seven" | "seventh" => Some(7),
        "eight" | "eighth" => Some(8),
        "nine" | "ninth" => Some(9),
        _ => None,
    }
}

fn teen_word(token: &str) -> Option<i32> {
    match token {
        "ten" | "tenth" => Some(10),
        "eleven" | "eleventh" => Some(11),
        "twelve" | "twelfth" => Some(12),
        "thirteen" | "thirteenth" => Some(13),
        "fourteen" | "fourteenth" => Some(14),
        "fifteen" | "fifteenth" => Some(15),
        "sixteen" | "sixteenth" => Some(16),
        "seventeen" | "seventeenth" => Some(17),
        "eighteen" | "eighteenth" => Some(18),
        "nineteen" | "nineteenth" => Some(19),
        _ => None,
    }
}

fn tens_word(token: &str) -> Option<i32> {
    match token {
        "twenty" | "twentieth" => Some(20),
        "thirty" | "thirtieth" => Some(30),
        "forty" | "fortieth" => Some(40),
        "fifty" | "fiftieth" => Some(50),
        "sixty" | "sixtieth" => Some(60),
        "seventy" | "seventieth" => Some(70),
        "eighty" | "eightieth" => Some(80),
        "ninety" | "ninetieth" => Some(90),
        _ => None,
    }
}

fn parse_under_hundred(tokens: &[&str], index: usize) -> Option<ParsedNumber> {
    let token = tokens.get(index)?;
    if let Some(value) = integer_token(token) {
        return Some(ParsedNumber {
            value,
            next_index: index + 1,
        });
    }
    if let Some(value) = teen_word(token).or_else(|| unit_word(token)) {
        return Some(ParsedNumber {
            value,
            next_index: index + 1,
        });
    }
    let value = tens_word(token)?;
    let mut next_index = index + 1;
    let mut total = value;
    if let Some(next) = tokens.get(next_index).and_then(|next| unit_word(next)) {
        total += next;
        next_index += 1;
    }
    Some(ParsedNumber {
        value: total,
        next_index,
    })
}

fn parse_number_at(tokens: &[&str], index: usize) -> Option<ParsedNumber> {
    let first = parse_under_hundred(tokens, index)?;
    if tokens.get(first.next_index) != Some(&"hundred") {
        return Some(first);
    }

    let mut value = first.value * 100;
    let mut next_index = first.next_index + 1;
    if let Some(remainder) = parse_under_hundred(tokens, next_index) {
        value += remainder.value;
        next_index = remainder.next_index;
    }
    Some(ParsedNumber { value, next_index })
}

fn is_reference_filler(token: &str) -> bool {
    matches!(
        token,
        "book"
            | "of"
            | "the"
            | "chapter"
            | "chapters"
            | "paragraph"
            | "paragraphs"
            | "para"
            | "par"
            | "number"
            | "no"
            | "ellen"
            | "white"
            | "egw"
            | "read"
            | "from"
            | "go"
            | "to"
    )
}

fn parse_next_number(tokens: &[&str], start_index: usize) -> Option<ParsedNumber> {
    let mut index = start_index;
    while index < tokens.len() {
        if let Some(parsed) = parse_number_at(tokens, index) {
            return Some(parsed);
        }
        if !is_reference_filler(tokens[index]) {
            return None;
        }
        index += 1;
    }
    None
}

fn parse_number_after_label(tokens: &[&str], labels: &[&str]) -> Option<ParsedNumber> {
    for (index, token) in tokens.iter().enumerate() {
        if labels.contains(token) {
            if let Some(parsed) = parse_next_number(tokens, index + 1) {
                return Some(parsed);
            }
        }
    }
    None
}

fn parse_egw_chapter_paragraph(tail: &str) -> Option<(i32, i32)> {
    let tokens: Vec<&str> = tail.split_whitespace().collect();
    if tokens.is_empty() {
        return None;
    }

    let chapter = parse_number_after_label(&tokens, &["chapter", "chapters"]);
    let paragraph = parse_number_after_label(&tokens, &["paragraph", "paragraphs", "para", "par"]);
    if let (Some(chapter), Some(paragraph)) = (chapter, paragraph) {
        return Some((chapter.value, paragraph.value));
    }

    if let Some(chapter) = chapter {
        let paragraph = parse_next_number(&tokens, chapter.next_index)?;
        return Some((chapter.value, paragraph.value));
    }

    let chapter = parse_next_number(&tokens, 0)?;
    let paragraph = parse_next_number(&tokens, chapter.next_index)?;
    Some((chapter.value, paragraph.value))
}

fn alias_match_end(text: &str, alias: &str) -> Option<usize> {
    if alias.is_empty() {
        return None;
    }
    for (index, _) in text.match_indices(alias) {
        let before_ok = index == 0 || text.as_bytes().get(index - 1) == Some(&b' ');
        let end = index + alias.len();
        let after_ok = end == text.len() || text.as_bytes().get(end) == Some(&b' ');
        if before_ok && after_ok {
            return Some(end);
        }
    }
    None
}

fn egw_aliases(book: &EgwBook) -> Vec<String> {
    let mut aliases = Vec::new();
    for value in [&book.title, &book.abbreviation] {
        let alias = normalize_reference_text(value);
        if !alias.is_empty() && !aliases.contains(&alias) {
            aliases.push(alias.clone());
        }
        if let Some(without_the) = alias.strip_prefix("the ") {
            if !without_the.is_empty() && !aliases.iter().any(|item| item == without_the) {
                aliases.push(without_the.to_string());
            }
        }
    }
    aliases
}

fn best_egw_alias_match<'a>(
    normalized_text: &str,
    books: &'a [EgwBook],
) -> Vec<(&'a EgwBook, usize, usize)> {
    let mut matches = books
        .iter()
        .flat_map(|book| {
            egw_aliases(book).into_iter().filter_map(move |alias| {
                alias_match_end(normalized_text, &alias).map(|end| (book, end, alias.len()))
            })
        })
        .collect::<Vec<_>>();

    matches.sort_by(|a, b| b.2.cmp(&a.2).then_with(|| a.1.cmp(&b.1)));
    matches
}

/// Confidence assigned to EGW paragraphs matched by keyword (below explicit references).
const EGW_FTS_CONFIDENCE: f64 = 0.55;

/// Minimum word count before running EGW keyword search.
const EGW_FTS_MIN_WORDS: usize = 5;

/// Maximum EGW paragraphs surfaced per detection pass.
const EGW_FTS_LIMIT: usize = 2;

/// Detect EGW paragraphs by BM25 keyword search of the transcript window.
pub(crate) fn detect_egw_fts(state: &AppState, text: &str) -> Vec<DetectionResult> {
    if text.split_whitespace().count() < EGW_FTS_MIN_WORDS {
        return Vec::new();
    }
    let Some(db) = state.bible_db.as_ref() else {
        return Vec::new();
    };

    match db.search_egw_bm25(text, EGW_FTS_LIMIT) {
        Ok(paragraphs) => paragraphs
            .into_iter()
            .map(|paragraph| {
                let mut result = egw_to_result(paragraph, EGW_FTS_CONFIDENCE, text);
                result.source = "semantic".to_string();
                result
            })
            .collect(),
        Err(error) => {
            log::warn!("[DET-EGW] FTS search failed: {error}");
            Vec::new()
        }
    }
}

/// Detect explicit Ellen G. White paragraph references like `PP 1:2` or
/// `Patriarchs and Prophets chapter one paragraph two`.
pub(crate) fn detect_egw_references(state: &AppState, text: &str) -> Vec<DetectionResult> {
    let Some(db) = state.bible_db.as_ref() else {
        return Vec::new();
    };
    let books = match db.list_egw_books() {
        Ok(books) => books,
        Err(error) => {
            log::warn!("[DET-EGW] Failed to load EGW books for direct detection: {error}");
            return Vec::new();
        }
    };
    if books.is_empty() {
        log::debug!("[DET-EGW] No EGW books imported; EGW detection disabled");
        return Vec::new();
    }

    let normalized = normalize_reference_text(text);
    if normalized.is_empty() {
        return Vec::new();
    }

    let mut seen = HashSet::new();
    let mut results = Vec::new();
    for (book, alias_end, _) in best_egw_alias_match(&normalized, &books) {
        let tail = normalized.get(alias_end..).unwrap_or_default().trim();
        let Some((chapter, paragraph_number)) = parse_egw_chapter_paragraph(tail) else {
            continue;
        };
        if chapter <= 0 || paragraph_number <= 0 {
            continue;
        }
        if !seen.insert((book.book_number, chapter, paragraph_number)) {
            continue;
        }

        match db.get_egw_paragraph(book.book_number, chapter, paragraph_number) {
            Ok(Some(paragraph)) => {
                results.push(egw_to_result(paragraph, 0.94, text));
            }
            Ok(None) => {}
            Err(error) => {
                log::warn!(
                    "[DET-EGW] Failed to resolve {} {}:{}: {error}",
                    book.title,
                    chapter,
                    paragraph_number
                );
            }
        }
    }
    results
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
               (3, 'NLT', 'New Living Translation', 'en', 1, 1);
             INSERT INTO books VALUES
               (1, 1, 43, 'John', 'Jn', 'NT'),
               (2, 2, 43, 'John', 'Jn', 'NT'),
               (3, 3, 43, 'John', 'Jn', 'NT');
             INSERT INTO verses VALUES
               (100, 1, 43, 'John', 'Jn', 3, 16, 'KJV John 3:16 text.'),
               (101, 1, 43, 'John', 'Jn', 3, 17, 'KJV John 3:17 text.'),
               (200, 2, 43, 'John', 'Jn', 3, 16, 'NKJV John 3:16 text.'),
               (300, 3, 43, 'John', 'Jn', 3, 16, 'NLT John 3:16 text.');
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
