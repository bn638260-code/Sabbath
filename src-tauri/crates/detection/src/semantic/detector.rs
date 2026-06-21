use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

use super::cache::EmbeddingCache;
use super::chunker::Chunker;
use super::embedder::{StubEmbedder, TextEmbedder};
use super::ensemble::EnsembleSearcher;
use super::index::{StubIndex, VectorIndex};
use super::synonyms::SynonymExpander;
use crate::types::{Detection, DetectionSource, VerseRef};

/// Default cache capacity (number of text-chunk entries).
const DEFAULT_CACHE_CAPACITY: usize = 256;

/// Default cosine-similarity threshold below which results are discarded.
const DEFAULT_CONFIDENCE_THRESHOLD: f64 = 0.42;
const SEMANTIC_SEARCH_K: usize = 12;
const MAX_SEMANTIC_DETECTIONS: usize = 5;
/// Bonus added to displayed confidence per extra strategy that agreed on a
/// result (capped at two extra), rewarding cross-strategy corroboration.
const AGREEMENT_BONUS: f64 = 0.02;

/// Orchestrator that combines text chunking, embedding, vector search,
/// and caching to detect Bible verses from transcript text using
/// semantic similarity.
pub struct SemanticDetector {
    embedder: Box<dyn TextEmbedder>,
    index: Box<dyn VectorIndex>,
    chunker: Chunker,
    cache: EmbeddingCache,
    confidence_threshold: f64,
    #[allow(dead_code)]
    synonym_expander: SynonymExpander,
    ensemble: EnsembleSearcher,
    /// When true, uses ensemble search (3 strategies) for better accuracy.
    /// When false, single direct embedding for speed.
    use_synonyms: bool,
}

impl SemanticDetector {
    /// Create a new detector backed by the given embedder and index.
    pub fn new(embedder: Box<dyn TextEmbedder>, index: Box<dyn VectorIndex>) -> Self {
        Self {
            embedder,
            index,
            chunker: Chunker::new(),
            cache: EmbeddingCache::new(DEFAULT_CACHE_CAPACITY),
            confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
            synonym_expander: SynonymExpander::new(),
            ensemble: EnsembleSearcher::new(),
            use_synonyms: true,
        }
    }

    /// Create a detector with stub (no-op) implementations.
    ///
    /// The stub detector compiles and runs without model files but
    /// always returns empty results because its index is empty.
    pub fn stub() -> Self {
        Self::new(Box::new(StubEmbedder::new(1024)), Box::new(StubIndex))
    }

    /// Enable or disable synonym expansion (paraphrase detection mode).
    pub fn set_use_synonyms(&mut self, enabled: bool) {
        self.use_synonyms = enabled;
    }

    /// Returns whether synonym expansion is currently enabled.
    pub fn use_synonyms(&self) -> bool {
        self.use_synonyms
    }

    /// Returns `true` when the underlying index contains vectors and
    /// the detector can produce meaningful results.
    pub fn is_ready(&self) -> bool {
        !self.index.is_empty()
    }

    /// Detect Bible verses in `text` using semantic similarity.
    ///
    /// The text is split into overlapping sentence windows, each window
    /// is embedded, and the nearest verses in the vector index are
    /// returned if they exceed the confidence threshold.
    ///
    /// The returned `Detection` objects have placeholder `VerseRef`
    /// fields (all zeros / empty) — the caller is expected to resolve
    /// them using the `verse_id` from the underlying `SearchResult`.
    pub fn detect(&mut self, text: &str) -> Vec<Detection> {
        if !self.is_ready() {
            return vec![];
        }

        let mut detections = Vec::new();

        if self.use_synonyms {
            // Ensemble search: 3 strategies (original + synonym + concept)
            // More expensive (~3 embed calls) but much better accuracy for paraphrases.
            match self.ensemble.search(
                text,
                self.embedder.as_ref(),
                self.index.as_ref(),
                SEMANTIC_SEARCH_K,
            ) {
                Ok(results) => {
                    // `results` is already ranked by ensemble score; keep that
                    // order but display the raw match strength (best similarity)
                    // plus a small bonus when strategies agree, so the shown
                    // confidence reflects how strong the match actually is.
                    let now = Self::timestamp_ms();
                    for result in results {
                        if result.score >= self.confidence_threshold {
                            let agreement_bonus = match result.sources.len() {
                                0 | 1 => 0.0,
                                2 => AGREEMENT_BONUS,
                                _ => AGREEMENT_BONUS * 2.0,
                            };
                            let confidence =
                                (result.best_similarity + agreement_bonus).min(1.0);
                            detections.push(Self::make_detection(
                                result.verse_id,
                                confidence,
                                text,
                                now,
                            ));
                        }
                    }
                }
                Err(e) => {
                    log::warn!("[SEMANTIC] Ensemble search failed: {e}");
                }
            }
        } else {
            let now = Self::timestamp_ms();
            let mut seen_verse_ids = HashSet::new();
            let chunks = self.chunker.chunk(text);
            let search_chunks = if chunks.is_empty() {
                vec![text.to_string()]
            } else {
                chunks
            };

            for chunk in search_chunks {
                let results = if let Some((_embedding, results)) = self.cache.get(&chunk) {
                    results.clone()
                } else {
                    let Ok(embedding) = self.embedder.embed(&chunk) else {
                        continue;
                    };
                    let Ok(results) = self.index.search(&embedding, SEMANTIC_SEARCH_K) else {
                        continue;
                    };

                    self.cache
                        .insert(chunk.clone(), (embedding, results.clone()));
                    results
                };

                for result in &results {
                    if result.similarity >= self.confidence_threshold
                        && seen_verse_ids.insert(result.verse_id)
                    {
                        detections.push(Self::make_detection(
                            result.verse_id,
                            result.similarity,
                            &chunk,
                            now,
                        ));
                    }
                }
            }

            // Direct-embedding hits arrive per chunk; rank by similarity.
            detections.sort_by(|a, b| {
                b.confidence
                    .partial_cmp(&a.confidence)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        }

        // Ensemble results keep their score ranking; direct results are sorted
        // above. Cap to the top semantic suggestions either way.
        detections.truncate(MAX_SEMANTIC_DETECTIONS);

        detections
    }

    /// Update the minimum similarity threshold for a result to be
    /// included in the output.
    pub fn set_confidence_threshold(&mut self, threshold: f64) {
        self.confidence_threshold = threshold;
    }

    /// Direct query -> results for manual semantic search.
    /// Unlike `detect()`, this does NOT chunk the text or apply cooldown.
    pub fn search_query(&mut self, query: &str, k: usize) -> Vec<(i64, f64)> {
        if !self.is_ready() {
            return vec![];
        }
        let Ok(embedding) = self.embedder.embed(query) else {
            return vec![];
        };
        match self.index.search(&embedding, k) {
            Ok(results) => results.iter().map(|r| (r.verse_id, r.similarity)).collect(),
            Err(_) => vec![],
        }
    }

    // ---- private helpers ----

    #[expect(
        clippy::cast_possible_truncation,
        reason = "timestamp millis won't exceed u64 for centuries"
    )]
    fn timestamp_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    fn make_detection(
        verse_id: i64,
        similarity: f64,
        snippet: &str,
        detected_at: u64,
    ) -> Detection {
        Detection {
            verse_ref: VerseRef {
                book_number: 0,
                book_name: String::new(),
                chapter: 0,
                verse_start: 0,
                verse_end: None,
            },
            verse_id: Some(verse_id),
            confidence: similarity,
            source: DetectionSource::Semantic { similarity },
            transcript_snippet: snippet.to_string(),
            detected_at,
            is_chapter_only: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::semantic::index::SearchResult;
    use crate::DetectionError;

    /// A fake index that always returns a fixed set of results.
    struct FakeIndex {
        results: Vec<SearchResult>,
    }

    impl VectorIndex for FakeIndex {
        fn search(&self, _query: &[f32], k: usize) -> Result<Vec<SearchResult>, DetectionError> {
            Ok(self.results.iter().take(k).cloned().collect())
        }

        fn len(&self) -> usize {
            self.results.len()
        }
    }

    #[test]
    fn test_stub_returns_empty() {
        let mut detector = SemanticDetector::stub();
        let results = detector.detect("for God so loved the world");
        assert!(results.is_empty());
    }

    #[test]
    fn test_stub_is_not_ready() {
        let detector = SemanticDetector::stub();
        assert!(!detector.is_ready());
    }

    #[test]
    fn test_detection_with_fake_index() {
        let fake_results = vec![
            SearchResult {
                verse_id: 1001,
                similarity: 0.85,
            },
            SearchResult {
                verse_id: 1002,
                similarity: 0.20,
            },
        ];

        let mut detector = SemanticDetector::new(
            Box::new(StubEmbedder::new(128)),
            Box::new(FakeIndex {
                results: fake_results,
            }),
        );

        assert!(detector.is_ready());

        let detections =
            detector.detect("for God so loved the world that he gave his only begotten son");

        // Should include the high-similarity result but not the 0.20 one
        assert!(!detections.is_empty());
        for d in &detections {
            assert!(d.confidence >= 0.35);
            assert!(matches!(d.source, DetectionSource::Semantic { .. }));
        }
    }

    #[test]
    fn test_ensemble_detection_confidence_uses_best_similarity() {
        let fake_results = vec![SearchResult {
            verse_id: 1001,
            similarity: 0.85,
        }];

        let mut detector = SemanticDetector::new(
            Box::new(StubEmbedder::new(128)),
            Box::new(FakeIndex {
                results: fake_results,
            }),
        );

        let detections = detector.detect("plain transcription filler without biblical theme words");

        assert_eq!(detections.len(), 1);
        assert!(
            detections[0].confidence >= 0.85,
            "displayed confidence should reflect raw best similarity, not the compressed ensemble score"
        );
        assert!(detections[0].confidence <= 1.0);
    }

    #[test]
    fn test_threshold_adjustment() {
        let fake_results = vec![SearchResult {
            verse_id: 1001,
            similarity: 0.60,
        }];

        let mut detector = SemanticDetector::new(
            Box::new(StubEmbedder::new(128)),
            Box::new(FakeIndex {
                results: fake_results,
            }),
        );

        // Default threshold should include this supported semantic result.
        let detections = detector.detect("for God so loved the world that he gave his son");
        assert!(!detections.is_empty());

        // Raise threshold above the result's similarity
        detector.set_confidence_threshold(0.70);
        let detections =
            detector.detect("whoever believes in him shall not perish but have everlasting life");
        assert!(detections.is_empty());
    }

    #[test]
    fn test_direct_embedding_mode_sorts_and_caps_model_hits() {
        let fake_results = vec![
            SearchResult {
                verse_id: 1001,
                similarity: 0.50,
            },
            SearchResult {
                verse_id: 1002,
                similarity: 0.90,
            },
            SearchResult {
                verse_id: 1003,
                similarity: 0.60,
            },
            SearchResult {
                verse_id: 1004,
                similarity: 0.80,
            },
            SearchResult {
                verse_id: 1005,
                similarity: 0.70,
            },
            SearchResult {
                verse_id: 1006,
                similarity: 0.75,
            },
        ];

        let mut detector = SemanticDetector::new(
            Box::new(StubEmbedder::new(128)),
            Box::new(FakeIndex {
                results: fake_results,
            }),
        );
        detector.set_use_synonyms(false);

        let detections =
            detector.detect("for God so loved the world that he gave his son to save us");

        assert_eq!(detections.len(), MAX_SEMANTIC_DETECTIONS);
        let ids: Vec<Option<i64>> = detections.iter().map(|d| d.verse_id).collect();
        assert_eq!(
            ids,
            vec![Some(1002), Some(1004), Some(1006), Some(1005), Some(1003)]
        );
        for detection in detections {
            assert!(matches!(detection.source, DetectionSource::Semantic { .. }));
            assert_eq!(detection.verse_ref.book_number, 0);
            assert_eq!(detection.verse_ref.chapter, 0);
            assert!(!detection.transcript_snippet.is_empty());
        }
    }

    #[test]
    fn test_direct_embedding_mode_dedupes_repeated_hits_across_chunks() {
        let fake_results = vec![
            SearchResult {
                verse_id: 1001,
                similarity: 0.88,
            },
            SearchResult {
                verse_id: 1002,
                similarity: 0.72,
            },
        ];

        let mut detector = SemanticDetector::new(
            Box::new(StubEmbedder::new(128)),
            Box::new(FakeIndex {
                results: fake_results,
            }),
        );
        detector.set_use_synonyms(false);

        let detections = detector.detect(
            "God loved the world enough to give his son. Whoever believes receives eternal life.",
        );

        let ids: Vec<Option<i64>> = detections.iter().map(|d| d.verse_id).collect();
        assert_eq!(ids, vec![Some(1001), Some(1002)]);
    }

    #[test]
    fn test_search_query_returns_raw_model_hits_without_detection_threshold() {
        let fake_results = vec![
            SearchResult {
                verse_id: 1001,
                similarity: 0.20,
            },
            SearchResult {
                verse_id: 1002,
                similarity: 0.90,
            },
        ];

        let mut detector = SemanticDetector::new(
            Box::new(StubEmbedder::new(128)),
            Box::new(FakeIndex {
                results: fake_results,
            }),
        );

        let results = detector.search_query("manual semantic search text", 2);

        assert_eq!(results, vec![(1001, 0.20), (1002, 0.90)]);
    }
}
