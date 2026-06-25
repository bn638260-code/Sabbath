//! Detection accuracy benchmark: runs a labeled set of sermon-style utterances
//! through the live auto-live detection path (direct reference parsing + hybrid
//! FTS5 BM25 + vector search, mirroring the STT pipeline) and reports precision /
//! recall / accuracy at the auto-live confidence threshold.
//!
//! The dataset is authored and documented (not field-recorded), so the number
//! reflects a curated, diverse test set rather than live-service data. It is the
//! best defensible measurement available without a labeled sermon corpus.
//!
//! Usage (from repo root, so the default asset paths resolve):
//!   cargo run -p rhema-detection --features precompute-bin --release \
//!     --bin detection_accuracy -- [--threshold 0.90] \
//!     [--model PATH] [--tokenizer PATH] [--embeddings PATH] [--ids PATH] [--verses PATH]

use std::collections::HashMap;
use std::path::PathBuf;

use rhema_bible::BibleDb;
use rhema_detection::semantic::embedder::TextEmbedder;
use rhema_detection::{
    DetectionPipeline, HnswVectorIndex, OnnxEmbedder, SemanticDetector,
};

/// One labeled case: (category, utterance, expected reference or None for noise).
type Case = (&'static str, &'static str, Option<&'static str>);

/// Authored labeled dataset (~50 cases) spanning the detector's strategies:
/// `direct` (spoken explicit references), `spoken` (number-word references),
/// `quote` (near-verbatim KJV text), `para` (paraphrase), and `noise`
/// (ordinary sermon/announcement speech that must NOT fire).
const CASES: &[Case] = &[
    // --- direct: explicit "Book chapter:verse" references ---
    ("direct", "Let's turn to John 3:16 this morning", Some("John 3:16")),
    ("direct", "Our text today is Romans 8:28", Some("Romans 8:28")),
    ("direct", "Open your Bibles to Genesis 1:1", Some("Genesis 1:1")),
    ("direct", "Turn with me to Psalm 23:1", Some("Psalms 23:1")),
    ("direct", "Reading from Philippians 4:13", Some("Philippians 4:13")),
    ("direct", "Consider Proverbs 3:5", Some("Proverbs 3:5")),
    ("direct", "Matthew 5:16 tells us", Some("Matthew 5:16")),
    ("direct", "As we see in Isaiah 53:5", Some("Isaiah 53:5")),
    ("direct", "Look at First Corinthians 13:4", Some("1 Corinthians 13:4")),
    ("direct", "It is found in Hebrews 11:1", Some("Hebrews 11:1")),
    ("direct", "From the book of Jeremiah 29:11", Some("Jeremiah 29:11")),
    ("direct", "Ephesians 2:8 reminds us", Some("Ephesians 2:8")),
    // --- spoken: number words instead of digits ---
    ("spoken", "John chapter three verse sixteen", Some("John 3:16")),
    ("spoken", "Romans chapter eight verse twenty eight", Some("Romans 8:28")),
    ("spoken", "Psalm chapter twenty three verse one", Some("Psalms 23:1")),
    ("spoken", "Genesis chapter one verse one", Some("Genesis 1:1")),
    ("spoken", "Matthew chapter five verse sixteen", Some("Matthew 5:16")),
    ("spoken", "First Corinthians chapter thirteen verse four", Some("1 Corinthians 13:4")),
    ("spoken", "Philippians chapter four verse thirteen", Some("Philippians 4:13")),
    ("spoken", "Proverbs chapter three verse five", Some("Proverbs 3:5")),
    // --- quote: near-verbatim KJV text, no spoken reference ---
    ("quote", "For God so loved the world that he gave his only begotten Son", Some("John 3:16")),
    ("quote", "The Lord is my shepherd I shall not want", Some("Psalms 23:1")),
    ("quote", "In the beginning God created the heaven and the earth", Some("Genesis 1:1")),
    ("quote", "I can do all things through Christ which strengtheneth me", Some("Philippians 4:13")),
    ("quote", "Trust in the Lord with all thine heart and lean not unto thine own understanding", Some("Proverbs 3:5")),
    ("quote", "For all have sinned and come short of the glory of God", Some("Romans 3:23")),
    ("quote", "The wages of sin is death but the gift of God is eternal life", Some("Romans 6:23")),
    ("quote", "I am the way the truth and the life", Some("John 14:6")),
    ("quote", "Be still and know that I am God", Some("Psalms 46:10")),
    ("quote", "Now faith is the substance of things hoped for the evidence of things not seen", Some("Hebrews 11:1")),
    ("quote", "Let your light so shine before men that they may see your good works", Some("Matthew 5:16")),
    ("quote", "And we know that all things work together for good to them that love God", Some("Romans 8:28")),
    // --- para: paraphrase, same meaning, different words ---
    ("para", "God loved us so much that he sent his only son to save everyone who believes", Some("John 3:16")),
    ("para", "the Lord looks after me like a shepherd so I never go without", Some("Psalms 23:1")),
    ("para", "we are saved by grace through faith and not by our own works", Some("Ephesians 2:8")),
    ("para", "let your light shine so people can see your good deeds", Some("Matthew 5:16")),
    ("para", "give all your worries to God because he genuinely cares about you", Some("1 Peter 5:7")),
    ("para", "everyone has sinned and fallen short of God's glory", Some("Romans 3:23")),
    ("para", "I have learned to be content no matter what situation I am in", Some("Philippians 4:11")),
    ("para", "the joy of the Lord is my strength", Some("Nehemiah 8:10")),
    // --- noise: ordinary speech that must NOT fire a verse ---
    ("noise", "good morning church it is so wonderful to be together today", None),
    ("noise", "as we continue our sermon series this morning let us settle our hearts", None),
    ("noise", "the offering plates will be passed down each row in just a moment", None),
    ("noise", "a big thank you to the worship team for leading us so beautifully", None),
    ("noise", "please remember the fellowship lunch in the hall after the service", None),
    ("noise", "we have some announcements about the youth retreat next weekend", None),
    ("noise", "let us stand together and greet one another with a smile", None),
    ("noise", "the parking lot will be repaved starting on monday", None),
    ("noise", "our guest speaker travelled a long way to be with us today", None),
    ("noise", "please silence your phones before we begin the message", None),
];

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let threshold: f64 = arg(&args, "--threshold")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.90);
    let model = arg(&args, "--model")
        .unwrap_or_else(|| "models/minilm-l6-v2-int8/onnx/model_quantized.onnx".into());
    let tokenizer =
        arg(&args, "--tokenizer").unwrap_or_else(|| "models/minilm-l6-v2/tokenizer.json".into());
    let embeddings = arg(&args, "--embeddings")
        .unwrap_or_else(|| "embeddings/kjv-nkjv-nlt-minilm-l6-v2.bin".into());
    let ids = arg(&args, "--ids")
        .unwrap_or_else(|| "embeddings/kjv-nkjv-nlt-minilm-l6-v2-ids.bin".into());
    let verses = arg(&args, "--verses").unwrap_or_else(|| "data/verses-for-embedding.json".into());
    let db_path = arg(&args, "--db").unwrap_or_else(|| "data/rhema.db".into());

    let embedder = OnnxEmbedder::load(&PathBuf::from(&model), &PathBuf::from(&tokenizer))
        .expect("load ONNX model + tokenizer");
    let dim = TextEmbedder::dimension(&embedder);
    let index = HnswVectorIndex::load(&PathBuf::from(&embeddings), &PathBuf::from(&ids), dim)
        .expect("load embeddings index");
    let refs = load_refs(&verses);
    let db = BibleDb::open_readonly(&PathBuf::from(&db_path)).expect("open bible db (read-only)");

    let mut semantic = SemanticDetector::new(Box::new(embedder), Box::new(index));
    semantic.set_use_synonyms(true);
    let mut pipeline = DetectionPipeline::new();
    pipeline.set_semantic(semantic);

    // Per-category tallies and global confusion counts.
    let mut tp = 0usize; // expected verse, correct verse fired
    let mut fp = 0usize; // something fired that was wrong (noise or wrong verse)
    let mut fn_ = 0usize; // expected verse, nothing correct fired
    let mut tn = 0usize; // noise, nothing fired
    let mut by_cat: HashMap<&str, (usize, usize)> = HashMap::new(); // cat -> (hits, total)

    println!("Per-case outcome at threshold {:.0}%:\n", threshold * 100.0);
    for (category, text, expected) in CASES {
        // Mirror the live auto-live path: direct parsing on the fragment, plus
        // hybrid FTS5 + vector search (the explicit-reference and quote/paraphrase
        // strategies the real STT pipeline runs).
        let mut detections = pipeline.process_direct(text);
        let fts = db.search_verses_bm25(text, 10).unwrap_or_default();
        detections.extend(pipeline.process_hybrid_with_fts(text, &fts));
        // Auto-live fires the highest-confidence detection at/above threshold.
        let fired = detections
            .iter()
            .filter(|d| d.detection.confidence >= threshold)
            .max_by(|a, b| {
                a.detection
                    .confidence
                    .partial_cmp(&b.detection.confidence)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

        let fired_ref = fired.and_then(|d| detection_ref(&d.detection, &refs));
        let fired_conf = fired.map(|d| d.detection.confidence);

        let entry = by_cat.entry(category).or_insert((0, 0));
        entry.1 += 1;

        let outcome = match (expected, &fired_ref) {
            (Some(exp), Some(got)) if ref_eq(exp, got) => {
                tp += 1;
                entry.0 += 1;
                format!("OK  fired {} ({:.0}%)", got, fired_conf.unwrap() * 100.0)
            }
            (Some(_), Some(got)) => {
                fp += 1;
                fn_ += 1;
                format!("WRONG fired {} ({:.0}%)", got, fired_conf.unwrap() * 100.0)
            }
            (Some(_), None) => {
                fn_ += 1;
                "miss (held for review, nothing fired)".to_string()
            }
            (None, Some(got)) => {
                fp += 1;
                format!("FALSE-FIRE {} ({:.0}%)", got, fired_conf.unwrap() * 100.0)
            }
            (None, None) => {
                tn += 1;
                entry.0 += 1;
                "OK  silent".to_string()
            }
        };
        let want = expected.unwrap_or("(noise)");
        println!("[{category:>6}] want {want:<22} -> {outcome}");
    }

    let total = CASES.len();
    let precision = if tp + fp == 0 { 1.0 } else { tp as f64 / (tp + fp) as f64 };
    let positives = CASES.iter().filter(|(_, _, e)| e.is_some()).count();
    let recall = if positives == 0 { 0.0 } else { tp as f64 / positives as f64 };
    let accuracy = (tp + tn) as f64 / total as f64;

    println!("\nBy category (correct / total):");
    for cat in ["direct", "spoken", "quote", "para", "noise"] {
        if let Some((hit, tot)) = by_cat.get(cat) {
            println!("  {cat:>6}  {hit}/{tot}");
        }
    }

    println!("\nConfusion at {:.0}% threshold:", threshold * 100.0);
    println!("  true positives (correct verse live): {tp}");
    println!("  false positives (wrong/noise live):  {fp}");
    println!("  false negatives (missed, held back):  {fn_}");
    println!("  true negatives (correctly silent):   {tn}");
    println!("\nHeadline metrics ({total} cases, threshold {:.0}%):", threshold * 100.0);
    println!("  Precision (of what goes live, % correct): {:.1}%", precision * 100.0);
    println!("  Recall    (of spoken verses, % caught):   {:.1}%", recall * 100.0);
    println!("  Accuracy  (correct decisions overall):    {:.1}%", accuracy * 100.0);
}

/// Build a (book, chapter, verse) reference string for a detection: direct
/// detections carry the `verse_ref`; semantic detections carry only a
/// `verse_id`, which we resolve through the verses-for-embedding map.
fn detection_ref(
    detection: &rhema_detection::types::Detection,
    refs: &HashMap<i64, String>,
) -> Option<String> {
    // Direct and FTS5 detections carry a populated verse_ref; pure vector
    // semantic detections carry only a verse_id resolved via the verse map.
    if detection.verse_ref.book_number > 0 {
        return Some(format!(
            "{} {}:{}",
            detection.verse_ref.book_name,
            detection.verse_ref.chapter,
            detection.verse_ref.verse_start
        ));
    }
    detection.verse_id.and_then(|id| refs.get(&id).cloned())
}

/// Compare two references for the same verse, tolerant of book-name spelling
/// (`1`/`I`/`First` Corinthians, `Psalm`/`Psalms`).
fn ref_eq(a: &str, b: &str) -> bool {
    normalize_ref(a) == normalize_ref(b)
}

fn normalize_ref(s: &str) -> Option<(String, String)> {
    // Split "Book Chapter:Verse" into (normalized book, "chapter:verse").
    let (book, loc) = s.rsplit_once(' ')?;
    let book = book.trim().to_lowercase();
    let mut parts = book.splitn(2, ' ');
    let first = parts.next().unwrap_or("");
    let rest = parts.next();
    let num = match first {
        "1" | "i" | "first" => Some("1"),
        "2" | "ii" | "second" => Some("2"),
        "3" | "iii" | "third" => Some("3"),
        _ => None,
    };
    let normalized_book = match (num, rest) {
        (Some(n), Some(r)) => format!("{n} {}", singularize(r)),
        _ => singularize(&book),
    };
    Some((normalized_book, loc.trim().to_string()))
}

fn singularize(book: &str) -> String {
    // Only Psalms varies between singular/plural in practice here.
    match book {
        "psalm" => "psalms".to_string(),
        other => other.to_string(),
    }
}

fn load_refs(path: &str) -> HashMap<i64, String> {
    #[derive(serde::Deserialize)]
    struct Entry {
        id: i64,
        r#ref: String,
    }
    let Ok(json) = std::fs::read_to_string(path) else {
        eprintln!("warning: could not read {path}; semantic matches cannot be scored");
        return HashMap::new();
    };
    serde_json::from_str::<Vec<Entry>>(&json)
        .map(|entries| entries.into_iter().map(|e| (e.id, e.r#ref)).collect())
        .unwrap_or_default()
}

fn arg(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}
