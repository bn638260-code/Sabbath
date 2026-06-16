mod asset_paths;
mod commands;
mod events;
mod logging;
mod memstats;
mod state;

use std::io;
use std::panic;
use std::sync::{Mutex, Once};

static PANIC_HOOK: Once = Once::new();

fn install_panic_hook() {
    PANIC_HOOK.call_once(|| {
        let default_hook = panic::take_hook();
        panic::set_hook(Box::new(move |info| {
            eprintln!("Unhandled panic: {info}");
            log::error!("Unhandled panic: {info}");
            default_hook(info);
        }));
    });
}

fn poisoned_lock_error(name: &str) -> io::Error {
    io::Error::other(format!("{name} lock was poisoned"))
}

#[expect(clippy::too_many_lines, reason = "app setup is inherently complex")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file — try src-tauri/.env first, then project root ../.env
    dotenvy::dotenv().ok();
    dotenvy::from_filename("../.env").ok();
    install_panic_hook();
    let detection_cooldown = rhema_detection::AutoQueueCooldown::default();
    let run_result = tauri::Builder::default()
        .plugin(logging::build_log_plugin())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Mutex::new(state::AppState::new()))
        .manage(Mutex::new(rhema_detection::DetectionPipeline::with_cooldown(
            detection_cooldown.clone(),
        )))
        .manage(Mutex::new(rhema_broadcast::ndi::NdiRuntime::default()))
        .manage(Mutex::new(rhema_detection::DirectDetector::new()))
        .manage(Mutex::new(rhema_detection::DetectionMerger::with_cooldown(
            detection_cooldown,
        )))
        .manage(Mutex::new(rhema_detection::ReadingMode::new()))
        .manage(Mutex::new(commands::remote::OscRuntime::new()))
        .manage(Mutex::new(commands::remote::HttpRuntime::new()))
        .invoke_handler(tauri::generate_handler![
            commands::bible::list_translations,
            commands::bible::list_books,
            commands::bible::get_chapter,
            commands::bible::get_verse,
            commands::bible::search_verses,
            commands::bible::get_translation_verses_for_search,
            commands::bible::get_cross_references,
            commands::bible::get_active_translation,
            commands::bible::set_active_translation,
            commands::egw::egw_list_books,
            commands::egw::egw_list_chapters,
            commands::egw::egw_get_chapter,
            commands::egw::egw_get_paragraph,
            commands::egw::egw_search,
            commands::detection::detect_verses,
            commands::detection::detection_status,
            commands::detection::semantic_search,
            commands::detection::toggle_paraphrase_detection,
            commands::detection::reading_mode_status,
            commands::detection::stop_reading_mode,
            commands::detection::update_detection_settings,
            commands::detection::set_detection_paused,
            commands::detection::detection_control_status,
            commands::assets::asset_status,
            commands::assets::get_service_attachment_limits,
            commands::assets::validate_service_attachment_path,
            commands::audio::get_audio_devices,
            commands::stt::start_transcription,
            commands::stt::stop_transcription,
            commands::broadcast::list_monitors,
            commands::broadcast::ensure_broadcast_window,
            commands::broadcast::open_broadcast_window,
            commands::broadcast::close_broadcast_window,
            commands::broadcast::start_ndi,
            commands::broadcast::stop_ndi,
            commands::broadcast::get_ndi_status,
            commands::broadcast::push_ndi_frame,
            commands::remote::start_osc,
            commands::remote::stop_osc,
            commands::remote::get_osc_status,
            commands::remote::start_http,
            commands::remote::stop_http,
            commands::remote::get_http_status,
            commands::remote::update_remote_status,
            commands::secrets::has_deepgram_api_key,
            commands::secrets::set_deepgram_api_key,
            commands::secrets::clear_deepgram_api_key,
            commands::secrets::has_gladia_api_key,
            commands::secrets::set_gladia_api_key,
            commands::secrets::clear_gladia_api_key,
            commands::secrets::has_remote_http_token,
            commands::secrets::rotate_remote_http_token,
            commands::secrets::has_verification_token,
            commands::secrets::set_verification_token,
            commands::secrets::get_verification_token,
            commands::secrets::rotate_verification_token,
            commands::secrets::clear_verification_token,
            commands::theme_files::import_theme_from_path,
            commands::theme_files::export_theme_to_path,
            commands::theme_files::read_image_as_data_url,
            commands::powerpoint::convert_powerpoint_to_pdf,
        ])
        .setup(|app| {
            use tauri::Manager;

            // Startup banner: guarantees the session log is never empty and
            // records the resolved STT asset paths for offline diagnosis.
            log::info!(
                "SabbathCue v{} starting (pid {})",
                app.package_info().version,
                std::process::id()
            );
            let whisper_model = asset_paths::whisper_model_path(app.handle());
            log::info!(
                "Resolved Whisper model path: {} (exists={}) — default local STT",
                whisper_model.display(),
                whisper_model.exists()
            );
            let vosk_model = asset_paths::vosk_model_path(app.handle());
            let vosk_worker = asset_paths::vosk_worker_path(app.handle());
            log::info!(
                "Resolved Vosk model path: {} (exists={})",
                vosk_model.display(),
                vosk_model.exists()
            );
            log::info!(
                "Resolved Vosk worker path: {} (exists={})",
                vosk_worker.display(),
                vosk_worker.exists()
            );

            memstats::spawn();

            let db_path = asset_paths::bible_db_path(app.handle());

            if db_path.exists() {
                let bible_db = if app
                    .path()
                    .resource_dir()
                    .ok()
                    .is_some_and(|dir| db_path.starts_with(dir))
                {
                    rhema_bible::BibleDb::open_readonly(&db_path)
                } else {
                    rhema_bible::BibleDb::open(&db_path)
                };

                match bible_db {
                    Ok(bible_db) => {
                        let managed_state = app.state::<Mutex<state::AppState>>();
                        let mut state = managed_state
                            .lock()
                            .map_err(|_| poisoned_lock_error("App state"))?;
                        if let Ok(translations) = bible_db.list_translations() {
                            if let Some(translation_id) =
                                state::initial_translation_id(&translations)
                            {
                                state.active_translation_id = translation_id;
                            }
                        }
                        state.bible_db = Some(bible_db);
                        drop(state);
                        log::info!("Bible database loaded from {}", db_path.display());
                    }
                    Err(error) => {
                        log::error!("Failed to open Bible database at {}: {error}", db_path.display());
                    }
                }
            } else {
                log::warn!("Bible database not found at {}", db_path.display());
            }

            let model_path = asset_paths::onnx_model_path(app.handle());
            let tokenizer_path = asset_paths::tokenizer_path(app.handle());
            let embeddings_path = asset_paths::embeddings_path(app.handle());
            let ids_path = asset_paths::embedding_ids_path(app.handle());

            log::info!("Resolved ONNX model path: {}", model_path.display());
            log::info!("Resolved tokenizer path: {}", tokenizer_path.display());
            log::info!("Resolved embeddings path: {}", embeddings_path.display());
            log::info!("Resolved embedding ids path: {}", ids_path.display());

            if model_path.exists() && tokenizer_path.exists() {
                use rhema_detection::semantic::embedder::TextEmbedder;
                use rhema_detection::semantic::index::VectorIndex;
                match rhema_detection::OnnxEmbedder::load(&model_path, &tokenizer_path) {
                    Ok(embedder) => {
                        log::info!("ONNX embedding model loaded");
                        let managed_pipeline = app.state::<Mutex<rhema_detection::DetectionPipeline>>();
                        let mut pipeline = managed_pipeline
                            .lock()
                            .map_err(|_| poisoned_lock_error("Detection pipeline"))?;

                        // If pre-computed embeddings exist, load the vector index
                        if embeddings_path.exists() && ids_path.exists() {
                            let dim = embedder.dimension();
                            match rhema_detection::HnswVectorIndex::load(&embeddings_path, &ids_path, dim) {
                                Ok(index) => {
                                    let semantic_corpus = if embeddings_path
                                        .file_name()
                                        .and_then(|name| name.to_str())
                                        == Some(asset_paths::PREFERRED_EMBEDDINGS_FILENAME)
                                    {
                                        "KJV/NKJV/NLT canonical blend"
                                    } else {
                                        "KJV canonical legacy"
                                    };
                                    log::info!(
                                        "Verse embeddings loaded ({} vectors, corpus={semantic_corpus}; semantic hits resolve to active translation)",
                                        index.len(),
                                    );
                                    pipeline.set_semantic(
                                        rhema_detection::SemanticDetector::new(
                                            Box::new(embedder),
                                            Box::new(index),
                                        ),
                                    );
                                }
                                Err(e) => {
                                    log::warn!("Failed to load verse embeddings: {e}");
                                }
                            }
                        } else {
                            log::info!("No pre-computed verse embeddings found. Run 'bun run export:verses' then the precompute binary.");
                        }
                    }
                    Err(e) => {
                        log::warn!("Failed to load ONNX model: {e}");
                    }
                }
            } else {
                log::info!("ONNX model not found. Semantic search disabled. Run 'bun run download:model' to download.");
            }

            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(error) = run_result {
        log::error!("Tauri application exited with error: {error}");
    }
}
