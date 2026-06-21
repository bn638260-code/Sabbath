//! Diagnostic bin: prints raw cosine similarity vs ensemble score for a set of
//! probe phrases, so the semantic operator floor can be validated against real
//! model output instead of a guess. Throwaway analysis tool — run manually; it
//! is not part of the app runtime.
//!
//! Usage (from repo root, so the default asset paths resolve):
//!   cargo run -p rhema-detection --features precompute-bin --bin score_distribution -- \
//!     [--model PATH] [--tokenizer PATH] [--embeddings PATH] [--ids PATH] \
//!     [--verses PATH] [--input PROBES.txt]
//!
//! `--input` adds one probe phrase per line (category "input"). The built-in
//! probes are grouped as: `quote` (near-verbatim verse), `para` (paraphrase),
//! `prose` (generic sermon text with no specific verse — the noise control).

use std::collections::HashMap;
use std::path::PathBuf;

use rhema_detection::semantic::embedder::TextEmbedder;
use rhema_detection::semantic::ensemble::EnsembleSearcher;
use rhema_detection::{HnswVectorIndex, OnnxEmbedder};

const SEARCH_K: usize = 5;
/// Current operator floor — applied to displayed confidence (raw best similarity).
const NEW_FLOOR: f64 = 0.78;
/// Previous operator floor — applied to the compressed ensemble score.
const OLD_SCORE_FLOOR: f64 = 0.55;
/// Mirror of the detector's displayed-confidence bonus for agreeing strategies.
const AGREEMENT_BONUS: f64 = 0.02;

const PROBES: &[(&str, &str)] = &[
    ("quote", "For God so loved the world that he gave his only begotten son"),
    ("quote", "The Lord is my shepherd I shall not want"),
    ("quote", "In the beginning God created the heaven and the earth"),
    ("quote", "I can do all things through Christ which strengtheneth me"),
    ("quote", "Trust in the Lord with all thine heart and lean not unto thine own understanding"),
    ("para", "God loved us so much that he sent his only son to save everyone who believes"),
    ("para", "the Lord looks after me like a shepherd so I never go without"),
    ("para", "we are rescued by grace when we believe, not by anything we earn"),
    ("para", "let your light shine in front of people so they notice your good works"),
    ("para", "give all your worries to God because he genuinely cares about you"),
    ("prose", "good morning church it is so wonderful to be together with you today"),
    ("prose", "as we continue our sermon series this morning let us settle our hearts"),
    ("prose", "the offering plates will be passed down each row in just a moment"),
    ("prose", "a big thank you to the worship team for leading us so beautifully"),
    ("prose", "please remember the fellowship lunch in the hall after the service"),
];

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn")).init();

    let args: Vec<String> = std::env::args().collect();
    let model = arg(&args, "--model")
        .unwrap_or_else(|| "models/minilm-l6-v2-int8/onnx/model_quantized.onnx".into());
    let tokenizer =
        arg(&args, "--tokenizer").unwrap_or_else(|| "models/minilm-l6-v2/tokenizer.json".into());
    let embeddings =
        arg(&args, "--embeddings").unwrap_or_else(|| "embeddings/kjv-nkjv-nlt-minilm-l6-v2.bin".into());
    let ids =
        arg(&args, "--ids").unwrap_or_else(|| "embeddings/kjv-nkjv-nlt-minilm-l6-v2-ids.bin".into());
    let verses = arg(&args, "--verses").unwrap_or_else(|| "data/verses-for-embedding.json".into());

    let embedder = OnnxEmbedder::load(&PathBuf::from(&model), &PathBuf::from(&tokenizer))
        .expect("load ONNX model + tokenizer");
    let dim = TextEmbedder::dimension(&embedder);
    let index = HnswVectorIndex::load(&PathBuf::from(&embeddings), &PathBuf::from(&ids), dim)
        .expect("load embeddings index");
    let refs = load_refs(&verses);

    let mut probes: Vec<(String, String)> =
        PROBES.iter().map(|(c, t)| ((*c).into(), (*t).into())).collect();
    if let Some(path) = arg(&args, "--input") {
        let text = std::fs::read_to_string(&path).expect("read --input file");
        for line in text.lines().map(str::trim).filter(|l| !l.is_empty()) {
            probes.push(("input".into(), line.into()));
        }
    }

    let mut ensemble = EnsembleSearcher::new();
    let mut by_category: HashMap<String, Vec<(f64, f64)>> = HashMap::new();

    println!("Per-probe top hit (raw = best cosine similarity, score = ensemble score, disp = shown confidence):\n");
    for (category, text) in &probes {
        let results = ensemble
            .search(text, &embedder, &index, SEARCH_K)
            .unwrap_or_default();
        let Some(top) = results.first() else {
            println!("[{category:>5}] (no match)  \"{}\"", truncate(text, 60));
            continue;
        };
        let disp = (top.best_similarity + agreement_bonus(top.sources.len())).min(1.0);
        let reference = refs.get(&top.verse_id).map_or("?", String::as_str);
        by_category
            .entry(category.clone())
            .or_default()
            .push((top.best_similarity, top.score));
        println!(
            "[{category:>5}] raw={:.3} score={:.3} disp={:.3}  -> {reference}   \"{}\"",
            top.best_similarity,
            top.score,
            disp,
            truncate(text, 50)
        );
    }

    println!("\nSummary by category (top-1 of each probe):");
    println!(
        "  {:<6} {:>4}  {:>17}  {:>14}  {:>16}",
        "cat", "n", "raw min/med/max", "pass raw>=0.78", "pass score>=0.55"
    );
    for category in ["quote", "para", "prose", "input"] {
        let Some(rows) = by_category.get(category) else {
            continue;
        };
        let mut raws: Vec<f64> = rows.iter().map(|(r, _)| *r).collect();
        raws.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let pass_raw = rows.iter().filter(|(r, _)| *r >= NEW_FLOOR).count();
        let pass_score = rows.iter().filter(|(_, s)| *s >= OLD_SCORE_FLOOR).count();
        println!(
            "  {:<6} {:>4}  {:>5.3}/{:>5.3}/{:>5.3}  {:>11}/{}  {:>13}/{}",
            category,
            rows.len(),
            raws[0],
            raws[raws.len() / 2],
            raws[raws.len() - 1],
            pass_raw,
            rows.len(),
            pass_score,
            rows.len(),
        );
    }

    println!(
        "\nRead: a good floor lets most quote/para probes pass while keeping prose (noise) out.\n\
         If quote/para pass-rates at 0.78 are low, the floor is too high (hurts recall); if prose\n\
         passes, it is too low. Compare raw>=0.78 (current) against the old score>=0.55 behavior."
    );
}

fn agreement_bonus(sources: usize) -> f64 {
    match sources {
        0 | 1 => 0.0,
        2 => AGREEMENT_BONUS,
        _ => AGREEMENT_BONUS * 2.0,
    }
}

fn load_refs(path: &str) -> HashMap<i64, String> {
    #[derive(serde::Deserialize)]
    struct Entry {
        id: i64,
        r#ref: String,
    }
    let Ok(json) = std::fs::read_to_string(path) else {
        eprintln!("warning: could not read {path}; top hits will show '?'");
        return HashMap::new();
    };
    serde_json::from_str::<Vec<Entry>>(&json)
        .map(|entries| entries.into_iter().map(|e| (e.id, e.r#ref)).collect())
        .unwrap_or_default()
}

fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let head: String = text.chars().take(max).collect();
    format!("{head}…")
}

fn arg(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}
