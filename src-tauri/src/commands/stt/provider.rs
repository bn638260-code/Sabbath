use tauri::AppHandle;

use crate::asset_paths;
use crate::commands::secrets;
use rhema_stt::{DeepgramClient, SttConfig, SttProvider, VoskProvider};

pub(crate) fn build_stt_provider(
    provider_name: &str,
    app: &AppHandle,
    device_id: Option<&str>,
    gain: Option<f32>,
) -> Result<Box<dyn SttProvider>, String> {
    match provider_name {
        "vosk" | "whisper" => {
            let model_path = asset_paths::vosk_model_path(app);
            if !model_path.exists() {
                return Err(format!(
                    "Vosk model not found at {}. Install the small English Vosk model at C:\\Users\\fanel\\Downloads\\vosk-model-small-en-us, set SABBATHCUE_VOSK_MODEL_DIR, or place it into models/vosk/vosk-model-small-en-us.",
                    model_path.display()
                ));
            }
            let worker_path = asset_paths::vosk_worker_path(app);
            if !worker_path.exists() {
                return Err(format!(
                    "Vosk worker not found at {}",
                    worker_path.display()
                ));
            }

            log::info!(
                "Starting Vosk transcription: model={}, worker={}, device_id={device_id:?}",
                model_path.display(),
                worker_path.display()
            );

            let provider = VoskProvider::new(model_path, worker_path);
            provider
                .check_ready()
                .map_err(|e| format!("Vosk startup check failed: {e}"))?;

            Ok(Box::new(provider))
        }
        #[cfg(feature = "whisper")]
        "legacy-whisper" => {
            let model_path = asset_paths::vosk_model_path(app);
            Err(format!(
                "Legacy Whisper is no longer the local provider. Use Vosk; expected Vosk model at {}.",
                model_path.display()
            ))
        }
        "faster-whisper" => Err("faster-whisper has been removed. Choose Vosk or Deepgram.".into()),
        _ => {
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
    }
}
