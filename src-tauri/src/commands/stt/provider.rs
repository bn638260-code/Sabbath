use std::path::Path;

use tauri::AppHandle;

use crate::asset_paths;
use crate::commands::secrets;
#[cfg(feature = "whisper")]
use rhema_stt::WhisperProvider;
use rhema_stt::{
    DeepgramClient, GladiaClient, SherpaProvider, SttConfig, SttProvider, VoskProvider,
};

pub(crate) fn missing_sherpa_model_error(model_path: &Path) -> String {
    format!(
        "Sherpa model not found at {}. Reinstall the app, run `bun run download:sherpa`, place the model in <app data>\\models\\sherpa\\{} (or set SABBATHCUE_SHERPA_MODEL_DIR).",
        model_path.display(),
        asset_paths::SHERPA_MODEL_DIRNAME
    )
}

pub(crate) fn missing_sherpa_worker_error(worker_path: &Path) -> String {
    format!(
        "Sherpa worker not found at {}. Reinstall the app to restore scripts\\sherpa_worker\\sherpa_worker.exe.",
        worker_path.display()
    )
}

pub(crate) fn missing_whisper_model_error(model_path: &Path) -> String {
    format!(
        "Whisper model not found at {}. Run `bun run download:whisper` to fetch {}, or set SABBATHCUE_WHISPER_MODEL to an existing model file.",
        model_path.display(),
        asset_paths::WHISPER_MODEL_FILENAME
    )
}

pub(crate) fn missing_vosk_model_error(model_path: &Path) -> String {
    format!(
        "Vosk model not found at {}. Reinstall the app, or place the small English Vosk model in <app data>\\models\\vosk\\{} (or set SABBATHCUE_VOSK_MODEL_DIR).",
        model_path.display(),
        asset_paths::VOSK_MODEL_DIRNAME
    )
}

pub(crate) fn missing_vosk_worker_error(worker_path: &Path) -> String {
    format!(
        "Vosk worker not found at {}. Reinstall the app to restore scripts\\vosk_worker.exe.",
        worker_path.display()
    )
}

async fn build_sherpa_provider(
    app: &AppHandle,
    device_id: Option<&str>,
) -> Result<Box<dyn SttProvider>, String> {
    let model_path = asset_paths::sherpa_model_path(app);
    if !model_path.exists() {
        let error = missing_sherpa_model_error(&model_path);
        log::error!("[STT-sherpa] {error}");
        return Err(error);
    }
    let worker_path = asset_paths::sherpa_worker_path(app);
    if !worker_path.exists() {
        let error = missing_sherpa_worker_error(&worker_path);
        log::error!("[STT-sherpa] {error}");
        return Err(error);
    }

    log::info!(
        "Starting Sherpa transcription: model={}, worker={}, device_id={device_id:?}",
        model_path.display(),
        worker_path.display()
    );

    Ok(Box::new(SherpaProvider::new(model_path, worker_path)))
}

async fn build_vosk_provider(
    app: &AppHandle,
    device_id: Option<&str>,
) -> Result<Box<dyn SttProvider>, String> {
    let model_path = asset_paths::vosk_model_path(app);
    if !model_path.exists() {
        let error = missing_vosk_model_error(&model_path);
        log::error!("[STT-vosk] {error}");
        return Err(error);
    }
    let worker_path = asset_paths::vosk_worker_path(app);
    if !worker_path.exists() {
        let error = missing_vosk_worker_error(&worker_path);
        log::error!("[STT-vosk] {error}");
        return Err(error);
    }

    log::info!(
        "Starting Vosk transcription: model={}, worker={}, device_id={device_id:?}",
        model_path.display(),
        worker_path.display()
    );

    let preflight = VoskProvider::new(model_path.clone(), worker_path.clone());
    tauri::async_runtime::spawn_blocking(move || preflight.check_ready())
        .await
        .map_err(|e| {
            let error = format!("Vosk startup check task failed: {e}");
            log::error!("[STT-vosk] {error}");
            error
        })?
        .map_err(|e| {
            let error = format!("Vosk startup check failed: {e}");
            log::error!("[STT-vosk] {error}");
            error
        })?;

    Ok(Box::new(VoskProvider::new(model_path, worker_path)))
}

/// Choose a thread count for Whisper inference: leave one core free for the
/// rest of the app, clamped to a sensible range.
#[cfg(feature = "whisper")]
fn whisper_thread_count() -> i32 {
    let available = std::thread::available_parallelism()
        .map(std::num::NonZeroUsize::get)
        .unwrap_or(4);
    let threads = available.saturating_sub(1).clamp(1, 8);
    i32::try_from(threads).unwrap_or(4)
}

#[cfg(feature = "whisper")]
async fn build_whisper_provider(
    app: &AppHandle,
    whisper_profile: Option<&str>,
) -> Result<Box<dyn SttProvider>, String> {
    let model_path = asset_paths::whisper_model_path(app);
    if !model_path.exists() {
        let error = missing_whisper_model_error(&model_path);
        log::error!("[STT-whisper] {error}");
        return Err(error);
    }

    let threads = whisper_thread_count();
    log::info!(
        "Starting legacy Whisper transcription: model={}, profile={whisper_profile:?}, threads={threads}",
        model_path.display(),
    );

    Ok(Box::new(WhisperProvider::new(
        model_path,
        Some("en".to_string()),
        threads,
        whisper_profile,
    )))
}

#[cfg(not(feature = "whisper"))]
async fn build_whisper_provider(
    app: &AppHandle,
    _whisper_profile: Option<&str>,
) -> Result<Box<dyn SttProvider>, String> {
    let model_path = asset_paths::whisper_model_path(app);
    Err(format!(
        "This build was compiled without legacy Whisper support. Expected model at {}.",
        model_path.display()
    ))
}

pub(crate) async fn build_stt_provider(
    provider_name: &str,
    app: &AppHandle,
    device_id: Option<&str>,
    gain: Option<f32>,
    whisper_profile: Option<&str>,
) -> Result<Box<dyn SttProvider>, String> {
    match provider_name {
        "sherpa" => build_sherpa_provider(app, device_id).await,
        "vosk" => build_vosk_provider(app, device_id).await,
        "whisper" | "legacy-whisper" => build_whisper_provider(app, whisper_profile).await,
        "faster-whisper" => Err(
            "faster-whisper has been removed. Choose Sherpa, Vosk, Deepgram, or Gladia.".into(),
        ),
        "gladia" => {
            let resolved_api_key = secrets::get_gladia_api_key_or_empty()?;

            if resolved_api_key.is_empty() {
                return Err("No Gladia API key configured. Set it in Settings.".into());
            }

            log::info!(
                "Starting Gladia transcription: api_key_configured=true, device_id={device_id:?}, gain={gain:?}"
            );

            let stt_config = SttConfig {
                api_key: resolved_api_key,
                model: "solaria-1".to_string(),
                sample_rate: 16_000,
                encoding: "wav/pcm".to_string(),
                language: Some("en".to_string()),
            };

            Ok(Box::new(GladiaClient::new(stt_config)))
        }
        "deepgram" => {
            let resolved_api_key = secrets::get_deepgram_api_key_or_empty()?;

            if resolved_api_key.is_empty() {
                return Err("No Deepgram API key configured. Set it in Settings.".into());
            }

            log::info!(
                "Starting Deepgram transcription: api_key_configured=true, device_id={device_id:?}, gain={gain:?}"
            );

            let stt_config = SttConfig {
                api_key: resolved_api_key,
                model: "nova-3".to_string(),
                sample_rate: 16_000,
                encoding: "linear16".to_string(),
                language: Some("en-US".to_string()),
            };

            Ok(Box::new(DeepgramClient::new(stt_config)))
        }
        _ => Err(format!(
            "Unknown speech-to-text provider \"{provider_name}\". Choose Sherpa, Vosk, Deepgram, or Gladia."
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn missing_sherpa_model_error_mentions_recovery_steps() {
        let error = missing_sherpa_model_error(&PathBuf::from("C:\\app\\models\\sherpa\\missing"));
        assert!(error.contains("SABBATHCUE_SHERPA_MODEL_DIR"));
        assert!(error.contains(asset_paths::SHERPA_MODEL_DIRNAME));
        assert!(error.contains("download:sherpa"));
    }

    #[test]
    fn missing_sherpa_worker_error_mentions_worker_name() {
        let error =
            missing_sherpa_worker_error(&PathBuf::from("C:\\app\\scripts\\sherpa_worker.exe"));
        assert!(error.contains("sherpa_worker.exe"));
    }

    #[test]
    fn missing_whisper_model_error_mentions_path_and_download_step() {
        let error = missing_whisper_model_error(&PathBuf::from(
            "C:\\app\\models\\whisper\\ggml-tiny.en.bin",
        ));
        assert!(error.contains("C:\\app\\models\\whisper\\ggml-tiny.en.bin"));
        assert!(error.contains("download:whisper"));
        assert!(error.contains(asset_paths::WHISPER_MODEL_FILENAME));
        assert!(error.contains("SABBATHCUE_WHISPER_MODEL"));
    }

    #[cfg(feature = "whisper")]
    #[test]
    fn whisper_thread_count_is_bounded() {
        let threads = whisper_thread_count();
        assert!((1..=8).contains(&threads));
    }

    #[test]
    fn missing_model_error_mentions_path_and_recovery_steps() {
        let error = missing_vosk_model_error(&PathBuf::from("C:\\app\\models\\vosk\\missing"));
        assert!(error.contains("C:\\app\\models\\vosk\\missing"));
        assert!(error.contains("SABBATHCUE_VOSK_MODEL_DIR"));
        assert!(error.contains(asset_paths::VOSK_MODEL_DIRNAME));
    }

    #[test]
    fn vosk_errors_do_not_hardcode_a_user_profile_path() {
        let model_error = missing_vosk_model_error(&PathBuf::from("C:\\anywhere"));
        let worker_error = missing_vosk_worker_error(&PathBuf::from("C:\\anywhere"));
        for error in [model_error, worker_error] {
            assert!(
                !error.contains("Users\\fanel") && !error.contains("Downloads"),
                "error message must not reference a developer machine path: {error}"
            );
        }
    }

    #[test]
    fn missing_worker_error_mentions_path() {
        let error = missing_vosk_worker_error(&PathBuf::from("C:\\app\\scripts\\vosk_worker.exe"));
        assert!(error.contains("vosk_worker.exe"));
    }
}
