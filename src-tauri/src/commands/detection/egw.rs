use std::collections::{HashMap, HashSet};

use rhema_bible::EgwBook;

use crate::state::AppState;

use super::result::{egw_to_result, DetectionResult};

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
#[cfg(test)]
const EGW_FTS_CONFIDENCE: f64 = 0.55;

/// Minimum word count before running EGW keyword search.
#[cfg(test)]
const EGW_FTS_MIN_WORDS: usize = 5;

/// Maximum EGW paragraphs surfaced per detection pass.
#[cfg(test)]
const EGW_FTS_LIMIT: usize = 2;

/// Detect EGW paragraphs by BM25 keyword search of the transcript window.
#[cfg(test)]
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

pub(crate) fn apply_egw_auto_queue(
    results: &mut [DetectionResult],
    merger: &mut rhema_detection::DetectionMerger,
) {
    let direct_indices: Vec<usize> = results
        .iter()
        .enumerate()
        .filter_map(|(index, result)| {
            (result.content_type == "egw" && result.source == "direct").then_some(index)
        })
        .collect();

    if direct_indices.is_empty() {
        return;
    }

    let candidates: Vec<rhema_detection::Detection> = direct_indices
        .iter()
        .map(|index| {
            let result = &results[*index];
            rhema_detection::Detection {
                verse_ref: rhema_detection::VerseRef {
                    book_number: result.book_number,
                    book_name: result.book_name.clone(),
                    chapter: result.chapter,
                    verse_start: result.verse,
                    verse_end: None,
                },
                verse_id: None,
                confidence: result.confidence,
                source: rhema_detection::DetectionSource::DirectReference,
                transcript_snippet: result.transcript_snippet.clone(),
                detected_at: 0,
                is_chapter_only: false,
            }
        })
        .collect();

    let auto_by_ref: HashMap<(i32, i32, i32), bool> = merger
        .merge(candidates, vec![])
        .into_iter()
        .map(|merged| {
            let verse_ref = merged.detection.verse_ref;
            (
                (
                    verse_ref.book_number,
                    verse_ref.chapter,
                    verse_ref.verse_start,
                ),
                merged.auto_queued,
            )
        })
        .collect();

    for index in direct_indices {
        let result = &mut results[index];
        result.auto_queued = auto_by_ref
            .get(&(result.book_number, result.chapter, result.verse))
            .copied()
            .unwrap_or(false);
    }
}
