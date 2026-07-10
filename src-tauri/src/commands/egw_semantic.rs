//! On-device EGW semantic (context) search.
//!
//! Unlike Bible verses, EGW paragraph embeddings are not shipped as an
//! asset: the index is built once on the user's machine from the imported
//! EGW library using the same `MiniLM` model, persisted to the app data dir,
//! and loaded from disk on later launches.

#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]

use std::io::Write as _;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use super::validation::{bounded_optional_limit, bounded_text, MAX_QUERY_BYTES};
use crate::asset_paths;
use crate::state::AppState;
use rhema_bible::EgwParagraph;
use rhema_detection::semantic::embedder::TextEmbedder;
use rhema_detection::semantic::index::VectorIndex;
use rhema_detection::{DetectionPipeline, HnswVectorIndex};

pub const EVENT_EGW_SEMANTIC_PROGRESS: &str = "egw-semantic-progress";
pub const EVENT_EGW_SEMANTIC_READY: &str = "egw-semantic-ready";
pub const EVENT_EGW_SEMANTIC_ERROR: &str = "egw-semantic-error";

const PROGRESS_EVERY: usize = 25;

#[derive(Default)]
pub struct EgwSemanticState {
    index: Option<HnswVectorIndex>,
    building: bool,
}

#[derive(Serialize)]
#[expect(
    clippy::struct_excessive_bools,
    reason = "Tauri status DTO mirrors frontend boolean readiness flags"
)]
pub struct EgwSemanticStatus {
    pub ready: bool,
    pub building: bool,
    pub model_available: bool,
    pub has_content: bool,
}

#[derive(Serialize, Clone)]
struct EgwSemanticProgress {
    embedded: usize,
    total: usize,
}

/// Content fingerprint persisted next to the on-disk EGW index so a stale
/// index (built from a different corpus revision) can be detected and
/// discarded on load.
#[derive(serde::Serialize, serde::Deserialize, PartialEq, Eq, Debug)]
struct EgwIndexMeta {
    count: i64,
    #[serde(rename = "idSum")]
    id_sum: i64,
}

/// Fingerprint of the currently imported EGW corpus, or `None` if the database
/// is unavailable.
fn current_egw_meta(app: &AppHandle) -> Option<EgwIndexMeta> {
    let app_state = app.state::<Mutex<AppState>>();
    let state = app_state.lock().ok()?;
    let (count, id_sum) = state.bible_db.as_ref()?.egw_content_fingerprint().ok()?;
    Some(EgwIndexMeta { count, id_sum })
}

/// Fingerprint recorded when the on-disk index was last built, or `None` if the
/// meta sidecar is missing or unreadable.
fn stored_egw_meta(app: &AppHandle) -> Option<EgwIndexMeta> {
    let path = asset_paths::egw_embeddings_meta_path(app);
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

#[derive(Serialize)]
pub struct EgwSemanticResult {
    pub paragraph: EgwParagraph,
    pub score: f64,
    pub source: String,
}

/// Load a previously built index from disk into state, if present.
fn ensure_index_loaded(app: &AppHandle) {
    {
        let egw_state = app.state::<Mutex<EgwSemanticState>>();
        let Ok(state) = egw_state.lock() else { return };
        if state.index.is_some() || state.building {
            return;
        }
    }

    let embeddings_path = asset_paths::egw_embeddings_path(app);
    let ids_path = asset_paths::egw_embedding_ids_path(app);
    if !embeddings_path.exists() || !ids_path.exists() {
        return;
    }

    // Discard an index built from a stale EGW corpus (a re-import renumbers
    // paragraph ids, so the persisted vectors would map to the wrong text).
    let fresh = match (stored_egw_meta(app), current_egw_meta(app)) {
        (Some(stored), Some(current)) => stored == current,
        _ => false,
    };
    if !fresh {
        log::info!(
            "[EGW-SEMANTIC] on-disk index is stale (content fingerprint mismatch) — discarding"
        );
        let _ = std::fs::remove_file(&embeddings_path);
        let _ = std::fs::remove_file(&ids_path);
        let _ = std::fs::remove_file(asset_paths::egw_embeddings_meta_path(app));
        return;
    }

    let dim = {
        let pipeline_state = app.state::<Mutex<DetectionPipeline>>();
        let Ok(pipeline) = pipeline_state.lock() else {
            return;
        };
        pipeline.embedding_dimension()
    };
    let Some(dim) = dim else { return };

    match HnswVectorIndex::load(&embeddings_path, &ids_path, dim) {
        Ok(index) => {
            log::info!("[EGW-SEMANTIC] loaded index ({} vectors)", index.len());
            let egw_state = app.state::<Mutex<EgwSemanticState>>();
            let Ok(mut state) = egw_state.lock() else {
                return;
            };
            state.index = Some(index);
        }
        Err(error) => {
            log::warn!("[EGW-SEMANTIC] failed to load index from disk: {error}");
        }
    }
}

#[tauri::command]
pub fn egw_semantic_status(app: AppHandle) -> Result<EgwSemanticStatus, String> {
    ensure_index_loaded(&app);

    let model_available = {
        let pipeline_state = app.state::<Mutex<DetectionPipeline>>();
        let pipeline = pipeline_state.lock().map_err(|e| e.to_string())?;
        pipeline.has_semantic()
    };

    let has_content = {
        let app_state = app.state::<Mutex<AppState>>();
        let state = app_state.lock().map_err(|e| e.to_string())?;
        state
            .bible_db
            .as_ref()
            .and_then(|db| db.list_egw_books().ok())
            .is_some_and(|books| !books.is_empty())
    };

    let egw_state = app.state::<Mutex<EgwSemanticState>>();
    let state = egw_state.lock().map_err(|e| e.to_string())?;
    Ok(EgwSemanticStatus {
        ready: state.index.is_some(),
        building: state.building,
        model_available,
        has_content,
    })
}

#[tauri::command]
pub fn egw_build_semantic_index(app: AppHandle) -> Result<(), String> {
    {
        let egw_state = app.state::<Mutex<EgwSemanticState>>();
        let mut state = egw_state.lock().map_err(|e| e.to_string())?;
        if state.building {
            return Err("EGW index build already in progress".to_string());
        }
        if state.index.is_some() {
            return Ok(());
        }
        state.building = true;
    }

    std::thread::spawn(move || {
        let result = build_index(&app);
        let egw_state = app.state::<Mutex<EgwSemanticState>>();
        match result {
            Ok(index) => {
                if let Ok(mut state) = egw_state.lock() {
                    state.index = Some(index);
                    state.building = false;
                }
                let _ = app.emit(EVENT_EGW_SEMANTIC_READY, ());
            }
            Err(error) => {
                if let Ok(mut state) = egw_state.lock() {
                    state.building = false;
                }
                log::warn!("[EGW-SEMANTIC] index build failed: {error}");
                let _ = app.emit(EVENT_EGW_SEMANTIC_ERROR, error);
            }
        }
    });

    Ok(())
}

/// Embed every EGW paragraph and persist the vectors, then load the index.
/// Runs on a background thread; emits progress events along the way.
fn build_index(app: &AppHandle) -> Result<HnswVectorIndex, String> {
    let paragraphs: Vec<(i64, String)> = {
        let app_state = app.state::<Mutex<AppState>>();
        let state = app_state.lock().map_err(|e| e.to_string())?;
        let db = state
            .bible_db
            .as_ref()
            .ok_or_else(|| "Bible database not loaded".to_string())?;
        db.list_egw_paragraph_texts().map_err(|e| e.to_string())?
    };
    if paragraphs.is_empty() {
        return Err("No EGW content imported".to_string());
    }

    // Load a dedicated embedder for the one-off build so the detection
    // pipeline is not locked for the duration.
    let model_path = asset_paths::onnx_model_path(app);
    let tokenizer_path = asset_paths::tokenizer_path(app);
    let embedder = rhema_detection::OnnxEmbedder::load(&model_path, &tokenizer_path)
        .map_err(|e| e.to_string())?;
    let dim = embedder.dimension();

    let embeddings_path = asset_paths::egw_embeddings_path(app);
    let ids_path = asset_paths::egw_embedding_ids_path(app);
    if let Some(parent) = embeddings_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Write to temp files first so a crash mid-build never leaves partial
    // files that would be mistaken for a complete index on next launch.
    let tmp_embeddings = embeddings_path.with_extension("tmp");
    let tmp_ids = ids_path.with_extension("tmp");
    {
        let mut emb_file = std::fs::File::create(&tmp_embeddings).map_err(|e| e.to_string())?;
        let mut ids_file = std::fs::File::create(&tmp_ids).map_err(|e| e.to_string())?;

        let total = paragraphs.len();
        for (i, (id, text)) in paragraphs.iter().enumerate() {
            match embedder.embed(text) {
                Ok(embedding) => {
                    // Same raw native-endian layout as `HnswVectorIndex::load`
                    // expects (and `precompute_embeddings` writes).
                    let emb_bytes: &[u8] = unsafe {
                        std::slice::from_raw_parts(
                            embedding.as_ptr().cast::<u8>(),
                            embedding.len() * std::mem::size_of::<f32>(),
                        )
                    };
                    emb_file.write_all(emb_bytes).map_err(|e| e.to_string())?;
                    ids_file
                        .write_all(&id.to_ne_bytes())
                        .map_err(|e| e.to_string())?;
                }
                Err(error) => {
                    log::warn!("[EGW-SEMANTIC] skipping paragraph {id}: embed failed: {error}");
                }
            }
            if (i + 1) % PROGRESS_EVERY == 0 || i + 1 == total {
                let _ = app.emit(
                    EVENT_EGW_SEMANTIC_PROGRESS,
                    EgwSemanticProgress {
                        embedded: i + 1,
                        total,
                    },
                );
            }
        }
    }
    std::fs::rename(&tmp_embeddings, &embeddings_path).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_ids, &ids_path).map_err(|e| e.to_string())?;

    // Record the corpus fingerprint so a later re-import can invalidate this
    // index. Best-effort: a missing meta file simply forces a rebuild.
    if let Some(meta) = current_egw_meta(app) {
        if let Ok(json) = serde_json::to_string(&meta) {
            let _ = std::fs::write(asset_paths::egw_embeddings_meta_path(app), json);
        }
    }

    HnswVectorIndex::load(&embeddings_path, &ids_path, dim).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn egw_semantic_search(
    app: AppHandle,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<EgwSemanticResult>, String> {
    bounded_text(&query, "query", MAX_QUERY_BYTES)?;
    let k = bounded_optional_limit(limit, 15)?;
    ensure_index_loaded(&app);

    let embedding = {
        let pipeline_state = app.state::<Mutex<DetectionPipeline>>();
        let pipeline = pipeline_state.lock().map_err(|e| e.to_string())?;
        pipeline.embed_text(&query)
    };

    let vector_hits: Vec<(i64, f64)> = match embedding {
        Some(embedding) => {
            let egw_state = app.state::<Mutex<EgwSemanticState>>();
            let state = egw_state.lock().map_err(|e| e.to_string())?;
            match state.index.as_ref() {
                Some(index) => index
                    .search(&embedding, k)
                    .map_err(|e| e.to_string())?
                    .into_iter()
                    .map(|r| (r.verse_id, r.similarity))
                    .collect(),
                None => vec![],
            }
        }
        None => vec![],
    };

    let app_state = app.state::<Mutex<AppState>>();
    let state = app_state.lock().map_err(|e| e.to_string())?;
    let db = state
        .bible_db
        .as_ref()
        .ok_or_else(|| "Bible database not loaded".to_string())?;

    let mut results: Vec<EgwSemanticResult> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for (id, score) in vector_hits {
        if let Ok(Some(paragraph)) = db.get_egw_paragraph_by_id(id) {
            if seen.insert(paragraph.id) {
                results.push(EgwSemanticResult {
                    paragraph,
                    score,
                    source: "semantic".to_string(),
                });
            }
        }
    }

    // Top up with keyword hits so context search still returns results for
    // exact-phrase queries the vector index ranks poorly.
    if results.len() < k {
        for paragraph in db.search_egw_bm25(&query, k).map_err(|e| e.to_string())? {
            if results.len() >= k {
                break;
            }
            if seen.insert(paragraph.id) {
                results.push(EgwSemanticResult {
                    paragraph,
                    score: 0.0,
                    source: "keyword".to_string(),
                });
            }
        }
    }

    Ok(results)
}
