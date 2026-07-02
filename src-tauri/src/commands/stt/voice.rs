use std::sync::atomic::Ordering;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

use crate::state::AppState;
use rhema_detection::DirectDetector;

/// Check for voice commands like "stop transcribing" and "start transcribing".
pub(crate) fn check_stt_voice_command(app: &AppHandle, transcript: &str) -> bool {
    let detector_state: State<'_, Mutex<DirectDetector>> = app.state();
    let Ok(detector) = detector_state.lock() else {
        return false;
    };
    let command = detector.detect_stt_voice_command(transcript);
    drop(detector);

    match command {
        Some(rhema_detection::direct::detector::SttVoiceCommand::Stop) => {
            let managed: State<'_, Mutex<AppState>> = app.state();
            let Ok(app_state) = managed.lock() else {
                return true;
            };
            if app_state.stt_active.load(Ordering::Relaxed) {
                app_state.stt_active.store(false, Ordering::SeqCst);
                app_state.audio_active.store(false, Ordering::SeqCst);
                log::info!("[STT] Voice command: stop transcribing");
                let _ = app.emit("stt_voice_control", "stop");
                let _ = app.emit("stt_disconnected", ());
            }
            true
        }
        Some(rhema_detection::direct::detector::SttVoiceCommand::Start) => {
            // This can only be heard while STT is already running. A true
            // wake-from-stopped command needs a separate always-listening path.
            log::info!("[STT] Voice command: start transcribing ignored; STT is already listening");
            let _ = app.emit("stt_voice_control", "start_ignored");
            true
        }
        None => false,
    }
}

/// Check for voice translation commands like "read in NIV", "switch to ESV".
pub(crate) fn check_translation_command(app: &AppHandle, transcript: &str) {
    #[derive(serde::Serialize, Clone)]
    struct TranslationSwitch {
        abbreviation: String,
        translation_id: i64,
    }

    let detector_state: State<'_, Mutex<DirectDetector>> = app.state();
    let Ok(detector) = detector_state.lock() else {
        return;
    };

    if let Some(abbrev) = detector.detect_translation_command(transcript) {
        drop(detector);

        // Find the translation ID for this abbreviation
        let managed: State<'_, Mutex<AppState>> = app.state();
        let Ok(mut app_state) = managed.lock() else {
            return;
        };

        if let Some(ref db) = app_state.bible_db {
            if let Ok(translations) = db.list_translations() {
                if let Some(t) = translations
                    .iter()
                    .find(|t| t.abbreviation.eq_ignore_ascii_case(&abbrev))
                {
                    if t.is_copyrighted || !t.is_downloaded {
                        log::info!(
                            "[STT] Voice command: {abbrev} is locked until licensing is ready"
                        );
                        return;
                    }
                    if app_state.active_translation_id == t.id {
                        log::debug!("[STT] Voice command: {abbrev} already active");
                        return;
                    }

                    app_state.active_translation_id = t.id;
                    log::info!("[STT] Voice command: switched to {abbrev} (id={})", t.id);
                    drop(app_state);

                    let _ = app.emit(
                        "translation_command",
                        TranslationSwitch {
                            abbreviation: abbrev,
                            translation_id: t.id,
                        },
                    );
                }
            }
        }
    }
}
