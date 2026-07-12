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

/// Whether semantic (paraphrase) detection should also run on partial
/// transcripts. Partials arrive every second or so, and each semantic pass
/// runs the ONNX embedding model — this is the dominant CPU cost while
/// transcribing. In low power mode semantic detection runs only on finished
/// sentences; direct reference detection ("John 3:16") is unaffected.
pub(crate) fn partial_semantic_detection_enabled(low_power: Option<bool>) -> bool {
    !low_power.unwrap_or(false)
}

pub(crate) fn partial_semantic_detection_enabled_for_provider(
    low_power: Option<bool>,
    _provider: &str,
) -> bool {
    partial_semantic_detection_enabled(low_power)
}

pub(crate) fn final_semantic_detection_allowed(_provider: &str, _confidence: f64) -> bool {
    true
}

pub(crate) fn final_semantic_detection_allowed_by_settings(
    semantic_enabled: bool,
    provider: &str,
    confidence: f64,
    transcript_chars: usize,
) -> bool {
    semantic_enabled
        && !(confidence > 0.0 && confidence < 0.5 && transcript_chars < 12)
        && final_semantic_detection_allowed(provider, confidence)
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
    use super::{
        final_semantic_detection_allowed, partial_semantic_detection_enabled,
        partial_semantic_detection_enabled_for_provider, transcript_logging_decision,
    };

    #[test]
    fn low_power_mode_disables_partial_semantic_detection() {
        // Semantic detection on partials is the dominant CPU cost while
        // transcribing; low power mode must restrict it to finished
        // sentences while the default keeps it on.
        assert!(partial_semantic_detection_enabled(None));
        assert!(partial_semantic_detection_enabled(Some(false)));
        assert!(!partial_semantic_detection_enabled(Some(true)));
    }

    #[test]
    fn active_provider_partials_can_run_semantic_detection() {
        assert!(partial_semantic_detection_enabled_for_provider(
            None, "soniox"
        ));
        assert!(partial_semantic_detection_enabled_for_provider(
            None, "deepgram"
        ));
    }

    #[test]
    fn active_provider_semantic_policy_matches_production_matrix() {
        let providers = ["vosk", "deepgram", "soniox"];

        for provider in providers {
            assert!(
                final_semantic_detection_allowed(provider, 0.90),
                "{provider} high-confidence final should run semantic detection"
            );
            assert!(
                !partial_semantic_detection_enabled_for_provider(Some(true), provider),
                "{provider} partial semantic detection should respect low power mode"
            );
        }

        assert!(partial_semantic_detection_enabled_for_provider(
            None, "vosk"
        ));
        assert!(partial_semantic_detection_enabled_for_provider(
            None, "deepgram"
        ));

        assert!(final_semantic_detection_allowed("vosk", 0.40));
        assert!(final_semantic_detection_allowed("deepgram", 0.40));
        assert!(final_semantic_detection_allowed("soniox", 0.40));
    }

    #[test]
    fn active_provider_low_confidence_finals_can_run_semantic_detection() {
        assert!(final_semantic_detection_allowed("soniox", 0.40));
        assert!(final_semantic_detection_allowed("soniox", 0.50));
        assert!(final_semantic_detection_allowed("soniox", 0.0));
        assert!(final_semantic_detection_allowed("deepgram", 0.20));
    }

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
