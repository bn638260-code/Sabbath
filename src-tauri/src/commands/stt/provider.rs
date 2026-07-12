use std::path::Path;

use tauri::AppHandle;

use crate::asset_paths;
use crate::commands::secrets;
use rhema_stt::{DeepgramClient, SonioxClient, SttConfig, SttProvider, VoskProvider};

pub(crate) fn missing_vosk_model_error(model_path: &Path) -> String {
    format!(
        "Vosk model not found at {}. Reinstall the app, or place the English Vosk model in <app data>\\models\\vosk\\{} (or set SABBATHCUE_VOSK_MODEL_DIR).",
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

async fn build_vosk_provider(
    app: &AppHandle,
    device_id: Option<&str>,
) -> Result<Box<dyn SttProvider>, String> {
    let model_path = asset_paths::vosk_model_path(app);
    if !model_path.exists() {
        let error = missing_vosk_model_error(&model_path);
        log::error!(
            "[STT-MODEL] failed provider=vosk model={} reason=missing_model",
            model_path.display()
        );
        return Err(error);
    }
    let worker_path = asset_paths::vosk_worker_path(app);
    if !worker_path.exists() {
        let error = missing_vosk_worker_error(&worker_path);
        log::error!(
            "[STT-MODEL] failed provider=vosk model={} reason=missing_worker worker={}",
            model_path.display(),
            worker_path.display()
        );
        return Err(error);
    }

    log::info!(
        "[STT-MODEL] selected provider=vosk model={} source=local worker={} device_id={device_id:?}",
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

fn removed_provider_error(provider_name: &str) -> String {
    format!(
        "The {provider_name} speech-to-text provider has been removed. Choose Vosk, Deepgram, or Soniox."
    )
}

fn deepgram_language_for(stt_language: Option<&str>) -> &'static str {
    match stt_language.unwrap_or("en") {
        "es" => "es",
        "fr" => "fr",
        "pt" => "pt",
        _ => "en-US",
    }
}

pub(crate) async fn build_stt_provider(
    provider_name: &str,
    app: &AppHandle,
    device_id: Option<&str>,
    gain: Option<f32>,
    stt_language: Option<&str>,
) -> Result<Box<dyn SttProvider>, String> {
    match provider_name {
        "vosk" => build_vosk_provider(app, device_id).await,
        "whisper" | "legacy-whisper" | "faster-whisper" | "gladia" => {
            log::warn!("[STT-MODEL] failed provider={provider_name} reason=removed_provider");
            Err(removed_provider_error(provider_name))
        }
        "deepgram" => {
            let resolved_api_key = secrets::get_deepgram_api_key_or_empty()?;

            if resolved_api_key.is_empty() {
                log::warn!(
                    "[STT-MODEL] failed provider=deepgram model=nova-3 reason=missing_api_key"
                );
                return Err("No Deepgram API key configured. Set it in Settings.".into());
            }

            let model = "nova-3";
            log::info!(
                "[STT-MODEL] selected provider=deepgram model={model} source=remote api_key_configured=true device_id={device_id:?} gain={gain:?}"
            );

            let stt_config = SttConfig {
                api_key: resolved_api_key,
                model: model.to_string(),
                sample_rate: 16_000,
                encoding: "linear16".to_string(),
                language: Some(deepgram_language_for(stt_language).to_string()),
            };

            Ok(Box::new(DeepgramClient::new(stt_config)))
        }
        "soniox" => {
            let resolved_api_key = secrets::get_soniox_api_key_or_empty()?;

            if resolved_api_key.is_empty() {
                log::warn!(
                    "[STT-MODEL] failed provider=soniox model=stt-rt-v5 reason=missing_api_key"
                );
                return Err("No Soniox API key configured. Set it in Settings.".into());
            }

            let model = rhema_stt::SONIOX_MODEL;
            let language = stt_language.unwrap_or("en");
            log::info!(
                "[STT-MODEL] selected provider=soniox model={model} language={language} source=remote api_key_configured=true device_id={device_id:?} gain={gain:?}"
            );

            let stt_config = SttConfig {
                api_key: resolved_api_key,
                model: model.to_string(),
                sample_rate: 16_000,
                encoding: "pcm_s16le".to_string(),
                language: Some(language.to_string()),
            };

            Ok(Box::new(SonioxClient::new(stt_config)))
        }
        _ => {
            log::warn!("[STT-MODEL] failed provider={provider_name} reason=unknown_provider");
            Err(format!(
                "Unknown speech-to-text provider \"{provider_name}\". Choose Vosk, Deepgram, or Soniox."
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn missing_model_error_mentions_path_and_recovery_steps() {
        let error = missing_vosk_model_error(&PathBuf::from("C:\\app\\models\\vosk\\missing"));
        assert!(error.contains("C:\\app\\models\\vosk\\missing"));
        assert!(error.contains("SABBATHCUE_VOSK_MODEL_DIR"));
        assert!(error.contains(asset_paths::VOSK_MODEL_DIRNAME));
        assert!(!error.contains("small English Vosk model"));
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

    #[test]
    fn removed_provider_error_points_to_supported_choices() {
        let error = removed_provider_error("faster-whisper");

        assert_eq!(
            error,
            "The faster-whisper speech-to-text provider has been removed. Choose Vosk, Deepgram, or Soniox."
        );
    }

    #[test]
    fn gladia_uses_removed_provider_error() {
        let error = removed_provider_error("gladia");

        assert_eq!(
            error,
            "The gladia speech-to-text provider has been removed. Choose Vosk, Deepgram, or Soniox."
        );
    }

    #[test]
    fn deepgram_language_for_supports_public_bible_languages() {
        assert_eq!(deepgram_language_for(Some("es")), "es");
        assert_eq!(deepgram_language_for(Some("fr")), "fr");
        assert_eq!(deepgram_language_for(Some("pt")), "pt");
        assert_eq!(deepgram_language_for(Some("en")), "en-US");
    }
}
