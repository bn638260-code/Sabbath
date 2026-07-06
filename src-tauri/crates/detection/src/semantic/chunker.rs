/// Sliding-window sentence chunker for transcript text.
///
/// Splits text on sentence boundaries and produces overlapping windows
/// of 1 to `max_sentences` consecutive sentences.  Short windows (fewer
/// than `min_words` words) are discarded so the embedder is not asked to
/// process fragments that carry no semantic signal.
/// Citation meta-speech that preachers prepend to a quote ("the Bible says,
/// …"). It is not verse content: embedded together with the quote it dilutes
/// cosine similarity enough to push genuine paraphrases below the operator
/// threshold, so it is stripped from the front of each sentence.
const CITATION_LEAD_INS: &[&str] = &[
    "the bible says",
    "bible says",
    "the scripture says",
    "scripture says",
    "the scriptures say",
    "the word of god says",
    "the word says",
    "the bible tells us",
    "the lord says",
    "god says",
    "jesus says",
    "jesus said",
    "he says",
    "he said",
    "it says",
];

/// Connectives that may precede a citation lead-in ("Because the Bible says").
const LEAD_CONJUNCTIONS: &[&str] = &["and", "but", "because", "for", "so", "now", "remember"];

pub struct Chunker {
    /// Minimum number of words a window must contain to be emitted.
    min_words: usize,
    /// Maximum number of consecutive sentences in a single window.
    max_sentences: usize,
}

impl Default for Chunker {
    fn default() -> Self {
        Self::new()
    }
}

impl Chunker {
    pub fn new() -> Self {
        Self {
            min_words: 5,
            max_sentences: 2, // Reduced from 3 to limit embed() calls per transcript
        }
    }

    /// Create a chunker with custom parameters.
    pub fn with_params(min_words: usize, max_sentences: usize) -> Self {
        Self {
            min_words,
            max_sentences,
        }
    }

    /// Split `text` into overlapping sentence windows for embedding.
    ///
    /// Sentence boundaries are `.`, `!`, `?`, and newlines.
    /// Windows are produced in overlapping fashion:
    ///   `[s1]`, `[s1, s2]`, `[s2]`, `[s2, s3]`, `[s3]`, ...
    ///
    /// More precisely, for each starting sentence index `i` we emit
    /// windows of length 1, 2, ... up to `max_sentences` (clamped to
    /// the number of remaining sentences).  Windows with fewer than
    /// `min_words` words are dropped.  Duplicates are not emitted.
    pub fn chunk(&self, text: &str) -> Vec<String> {
        let sentences = self.split_sentences(text);
        if sentences.is_empty() {
            return vec![];
        }

        let mut windows: Vec<String> = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for start in 0..sentences.len() {
            let max_end = (start + self.max_sentences).min(sentences.len());
            for end in (start + 1)..=max_end {
                let window = sentences[start..end].join(" ");
                let word_count = window.split_whitespace().count();
                if word_count >= self.min_words && seen.insert(window.clone()) {
                    windows.push(window);
                }
            }
        }

        windows
    }

    /// Split text into trimmed, non-empty sentences.
    #[expect(
        clippy::unused_self,
        reason = "method kept on self for future extensibility"
    )]
    fn split_sentences(&self, text: &str) -> Vec<String> {
        // First replace newlines with a sentence-ending marker so they
        // act as boundaries alongside punctuation.
        let normalized = text.replace('\n', ". ");

        let mut sentences = Vec::new();
        let mut current = String::new();

        for ch in normalized.chars() {
            if ch == '.' || ch == '!' || ch == '?' {
                let trimmed = strip_citation_lead_in(current.trim()).to_string();
                if !trimmed.is_empty() {
                    sentences.push(trimmed);
                }
                current.clear();
            } else {
                current.push(ch);
            }
        }

        // Remaining text after the last boundary
        let trimmed = strip_citation_lead_in(current.trim()).to_string();
        if !trimmed.is_empty() {
            sentences.push(trimmed);
        }

        sentences
    }
}

/// Strip leading connectives plus one citation lead-in ("Because the Bible
/// says, …" → "…"). Returns the sentence unchanged when no lead-in matches.
fn strip_citation_lead_in(sentence: &str) -> &str {
    let mut rest = sentence;

    // Optional connectives before the lead-in.
    loop {
        let stripped = LEAD_CONJUNCTIONS
            .iter()
            .find_map(|conj| strip_prefix_word_ci(rest, conj));
        match stripped {
            Some(after) => rest = after,
            None => break,
        }
    }

    for lead_in in CITATION_LEAD_INS {
        if let Some(after) = strip_prefix_word_ci(rest, lead_in) {
            return after.trim_start_matches([',', ':', ' ']).trim_start();
        }
    }

    sentence
}

/// Case-insensitively strip `prefix` from the start of `text` when it ends at
/// a word boundary; returns the remainder (leading separators trimmed).
fn strip_prefix_word_ci<'a>(text: &'a str, prefix: &str) -> Option<&'a str> {
    if text.len() < prefix.len() || !text.is_char_boundary(prefix.len()) {
        return None;
    }
    let (head, tail) = text.split_at(prefix.len());
    if !head.eq_ignore_ascii_case(prefix) {
        return None;
    }
    // Word boundary: end of text or a non-alphanumeric separator.
    if tail.chars().next().is_some_and(char::is_alphanumeric) {
        return None;
    }
    Some(tail.trim_start_matches([',', ':', ' ']).trim_start())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_sentences() {
        let chunker = Chunker::new();
        let text =
            "God so loved the world. He gave his only son. Whoever believes shall not perish.";
        let chunks = chunker.chunk(text);

        // Should produce single-sentence, two-sentence, and three-sentence windows
        assert!(!chunks.is_empty());

        // The first single sentence should be present
        assert!(chunks.iter().any(|c| c.contains("God so loved the world")));

        // A two-sentence window should be present
        assert!(chunks
            .iter()
            .any(|c| c.contains("God so loved the world") && c.contains("He gave his only son")));
    }

    #[test]
    fn test_newline_boundaries() {
        let chunker = Chunker::new();
        let text = "The first sentence is right here\nThe second sentence is right here\nThe third sentence is right here";
        let chunks = chunker.chunk(text);

        assert!(!chunks.is_empty());
        // Newlines act as sentence boundaries, so single-sentence windows appear
        assert!(chunks
            .iter()
            .any(|c| c == "The first sentence is right here"));
        // Two-sentence windows should also appear
        assert!(chunks.iter().any(|c| {
            c.contains("The first sentence is right here")
                && c.contains("The second sentence is right here")
        }));
    }

    #[test]
    fn test_short_text_filtered() {
        let chunker = Chunker::new();
        let text = "Hi. Bye.";
        let chunks = chunker.chunk(text);

        // Both individual sentences are fewer than 5 words, but the
        // combined window "Hi Bye" is still only 2 words => all filtered
        assert!(chunks.is_empty());
    }

    #[test]
    fn test_no_boundary_single_chunk() {
        let chunker = Chunker::new();
        let text = "for God so loved the world that he gave his only begotten son";
        let chunks = chunker.chunk(text);

        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], text);
    }

    #[test]
    fn test_empty_text() {
        let chunker = Chunker::new();
        assert!(chunker.chunk("").is_empty());
    }

    #[test]
    fn citation_lead_in_is_stripped_before_embedding() {
        // "Because the Bible says," is meta-speech: embedding it alongside the
        // quote dilutes similarity enough to drop a genuine paraphrase below
        // the operator threshold (real sermon: Luke 15:7).
        let chunker = Chunker::new();
        let chunks = chunker
            .chunk("Because the Bible says, for every sin that repents, there is joy in heaven.");

        assert!(
            chunks
                .iter()
                .any(|c| c == "for every sin that repents, there is joy in heaven"),
            "citation lead-in must be stripped: {chunks:?}"
        );
        assert!(
            !chunks
                .iter()
                .any(|c| c.to_lowercase().contains("bible says")),
            "meta-speech must not reach the embedder: {chunks:?}"
        );
    }

    #[test]
    fn sentences_without_lead_ins_are_unchanged() {
        let chunker = Chunker::new();
        let chunks = chunker.chunk("The Lord is my shepherd I shall not want.");

        assert_eq!(chunks, vec!["The Lord is my shepherd I shall not want"]);
    }

    #[test]
    fn lead_in_only_sentence_is_not_emptied() {
        // A sentence that is nothing but meta-speech must not become an empty
        // chunk; the min-words filter should drop it entirely.
        let chunker = Chunker::new();
        let chunks = chunker.chunk("The Bible says.");

        assert!(
            chunks.is_empty(),
            "meta-only sentence must be dropped: {chunks:?}"
        );
    }

    #[test]
    fn test_max_window_size() {
        let chunker = Chunker::with_params(1, 2);
        let text = "One fish. Two fish. Red fish. Blue fish.";
        let chunks = chunker.chunk(text);

        // With max_sentences=2, should never combine more than 2 sentences
        // No chunk should contain 3 sentence texts
        for chunk in &chunks {
            let parts: Vec<&str> = chunk.split("fish").collect();
            // Each sentence has "fish" once, so a 3-sentence window would
            // have 3 occurrences (4 parts when split)
            assert!(parts.len() <= 3, "Window too large: {chunk}");
        }
    }
}
