//! Pure, stateless detection logic peeled out of the live detection loop.
//!
//! Nothing here touches `AppHandle`, managed state, or IPC — these are the
//! transcript-window, reading-mode-decision, and reading-scope-filter helpers
//! that the live loop in `detection.rs` calls into. Keeping them separate makes
//! them trivially unit-testable and shrinks the orchestration surface.

use rhema_detection::{MergedDetection, VerseRef};

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct DirectReadingCandidate {
    pub(crate) verse_ref: VerseRef,
    pub(crate) confidence: f64,
    pub(crate) is_chapter_only: bool,
}

/// Return the last `max_words` whitespace-delimited words of `text`, re-joined
/// with single spaces.
pub(crate) fn clamp_to_recent_words(text: &str, max_words: usize) -> String {
    let words: Vec<&str> = text.split_whitespace().collect();
    let start = words.len().saturating_sub(max_words);
    words[start..].join(" ")
}

/// Strip reference-navigation scaffolding ("chapter", "verse", "it says", and
/// bare numbers) from a transcript window before it is used to build FTS5 /
/// vector search queries.
///
/// When a preacher reads a reference aloud ("chapter 7 verse 9 it says ...")
/// those framing words otherwise dominate BM25 matching and pollute the
/// embedding, surfacing irrelevant verses. The spoken reference itself is
/// already owned by the direct path, so only the surrounding verse content
/// should drive paraphrase search. Original casing of kept tokens is preserved;
/// the displayed transcript is unaffected.
pub(crate) fn strip_reference_scaffolding(text: &str) -> String {
    let tokens: Vec<&str> = text.split_whitespace().collect();
    let cores: Vec<String> = tokens
        .iter()
        .map(|t| {
            t.trim_matches(|c: char| !c.is_alphanumeric())
                .to_lowercase()
        })
        .collect();
    let mut out: Vec<&str> = Vec::new();
    for (i, token) in tokens.iter().enumerate() {
        let core = cores[i].as_str();
        if core.is_empty() {
            continue;
        }
        let digits: String = core.chars().filter(|c| !matches!(c, ',' | '.')).collect();
        let is_number = !digits.is_empty() && digits.chars().all(|c| c.is_ascii_digit());
        let prev = i.checked_sub(1).map(|p| cores[p].as_str());
        let next = cores.get(i + 1).map(String::as_str);
        let is_scaffold = matches!(core, "chapter" | "chapters" | "verse" | "verses")
            || (core == "it" && next == Some("says"))
            || (core == "says" && prev == Some("it"));
        if !is_number && !is_scaffold {
            out.push(token);
        }
    }
    out.join(" ")
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

pub(crate) fn is_direct_reading_handoff(detection: &rhema_detection::Detection) -> bool {
    detection.confidence >= 0.90 || detection.is_chapter_only
}

pub(crate) fn direct_reading_candidates(merged: &[MergedDetection]) -> Vec<DirectReadingCandidate> {
    merged
        .iter()
        .filter(|merged| is_direct_reading_handoff(&merged.detection))
        .map(|merged| DirectReadingCandidate {
            verse_ref: merged.detection.verse_ref.clone(),
            confidence: merged.detection.confidence,
            is_chapter_only: merged.detection.is_chapter_only,
        })
        .collect()
}

pub(crate) fn choose_reading_candidate(
    candidates: &[DirectReadingCandidate],
    active_scope: Option<(i32, i32)>,
) -> Option<DirectReadingCandidate> {
    if let Some((book_number, chapter)) = active_scope {
        if let Some(candidate) = candidates.iter().find(|candidate| {
            candidate.verse_ref.book_number == book_number && candidate.verse_ref.chapter == chapter
        }) {
            return Some(candidate.clone());
        }

        if let Some(candidate) = candidates
            .iter()
            .find(|candidate| candidate.verse_ref.book_number == book_number)
        {
            return Some(candidate.clone());
        }
    }

    candidates.first().cloned()
}

/// Decide whether a fresh direct detection should (re)start reading mode.
///
/// Same book+chapter normally means "already tracking this" — but a specific
/// verse reference (not a bare chapter default) that names a different verse
/// than the current position re-anchors reading mode to it. Without this, a
/// chapter-only hit ("Malachi 3" → 3:1) pins the cursor at verse 1 even after
/// the speaker announces "verses 16-18", and stray word-overlap can then
/// false-advance to a nearby low verse. Chapter-only hits never re-anchor, so
/// this cannot thrash the cursor back to verse 1.
pub(crate) fn should_restart_reading(
    active: bool,
    current_book: i32,
    current_chapter: i32,
    current_verse: Option<i32>,
    candidate: &DirectReadingCandidate,
) -> bool {
    let recent = &candidate.verse_ref;

    if !active {
        // Not active (fresh or paused) — any explicit reference (re)starts.
        return true;
    }

    if current_book == recent.book_number && current_chapter == recent.chapter {
        // Re-anchor only to a specific verse that differs from where we are.
        return !candidate.is_chapter_only && current_verse != Some(recent.verse_start);
    }

    if current_book != recent.book_number {
        // Different book — only an explicit, high-confidence reference restarts.
        return candidate.confidence >= 0.90 || candidate.is_chapter_only;
    }

    // Same book, different chapter — natural progression.
    true
}

pub(crate) fn filter_semantic_results_to_reading_scope(
    results: Vec<crate::commands::detection::DetectionResult>,
    scope: Option<(i32, i32)>,
) -> Vec<crate::commands::detection::DetectionResult> {
    let Some((book_number, chapter)) = scope else {
        return results;
    };

    results
        .into_iter()
        .filter(|result| {
            result.content_type != "bible"
                || (result.book_number == book_number && result.chapter == chapter)
        })
        .collect()
}

pub(crate) fn filter_direct_results_to_scope_if_present(
    results: Vec<crate::commands::detection::DetectionResult>,
    scope: Option<(i32, i32)>,
) -> Vec<crate::commands::detection::DetectionResult> {
    let Some((book_number, chapter)) = scope else {
        return results;
    };

    let has_active_match = results.iter().any(|result| {
        result.content_type == "bible"
            && result.book_number == book_number
            && result.chapter == chapter
    });
    if !has_active_match {
        return results;
    }

    results
        .into_iter()
        .filter(|result| {
            result.content_type != "bible"
                || (result.book_number == book_number && result.chapter == chapter)
        })
        .collect()
}
