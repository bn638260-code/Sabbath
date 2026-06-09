use crate::events::WordPayload;
use rhema_stt::Word;

/// Pure policy: transcript text may be logged ONLY in debug builds AND when the
/// operator explicitly opts in via `SABBATHCUE_DEBUG_TRANSCRIPTS`. Release builds
/// can never log spoken content, regardless of the env var.
pub(crate) fn transcript_logging_decision(is_debug_build: bool, env_value: &str) -> bool {
    is_debug_build && matches!(env_value.trim(), "1" | "true" | "TRUE" | "yes" | "YES")
}

pub(crate) fn transcript_logging_enabled() -> bool {
    transcript_logging_decision(
        cfg!(debug_assertions),
        &std::env::var("SABBATHCUE_DEBUG_TRANSCRIPTS").unwrap_or_default(),
    )
}

/// Truncate a string to at most `max_bytes`, snapping to a valid UTF-8 char boundary.
pub(crate) fn truncate_safe(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

pub(crate) fn to_word_payloads(words: Vec<Word>) -> Vec<WordPayload> {
    words
        .into_iter()
        .map(|word| {
            let punctuated = word
                .punctuated_word
                .clone()
                .unwrap_or_else(|| word.text.clone());
            WordPayload {
                text: word.text,
                start: word.start,
                end: word.end,
                confidence: word.confidence,
                punctuated,
            }
        })
        .collect()
}

pub(crate) fn average_word_confidence(words: &[Word], fallback: f64) -> f64 {
    let mut total = 0.0;
    let mut count = 0.0;
    for word in words {
        if word.confidence > 0.0 {
            total += word.confidence;
            count += 1.0;
        }
    }
    if count == 0.0 {
        fallback
    } else {
        total / count
    }
}

pub(crate) fn word_count(text: &str) -> usize {
    text.split_whitespace().count()
}

#[cfg(test)]
mod tests {
    use super::transcript_logging_decision;

    #[test]
    fn release_build_never_logs_even_with_optin() {
        assert!(!transcript_logging_decision(false, "1"));
        assert!(!transcript_logging_decision(false, "true"));
        assert!(!transcript_logging_decision(false, "YES"));
    }

    #[test]
    fn debug_build_logs_only_with_optin() {
        assert!(transcript_logging_decision(true, "1"));
        assert!(transcript_logging_decision(true, " YES "));
        assert!(!transcript_logging_decision(true, ""));
        assert!(!transcript_logging_decision(true, "0"));
        assert!(!transcript_logging_decision(true, "off"));
    }
}
