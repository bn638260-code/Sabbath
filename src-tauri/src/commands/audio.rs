use std::sync::Mutex;

use tauri::State;

use crate::state::AppState;
use rhema_audio::{AudioError, DeviceInfo};

fn map_audio_error(error: AudioError) -> String {
    error.to_string()
}

/// List all available audio input devices.
#[tauri::command]
pub fn get_audio_devices(_state: State<'_, Mutex<AppState>>) -> Result<Vec<DeviceInfo>, String> {
    rhema_audio::device::enumerate_devices().map_err(map_audio_error)
}

#[cfg(test)]
mod tests {
    use super::map_audio_error;
    use rhema_audio::AudioError;

    #[test]
    fn maps_audio_error_variants_to_stable_strings() {
        assert_eq!(
            map_audio_error(AudioError::DeviceNotFound("mic-1".into())),
            "device not found: mic-1"
        );
        assert_eq!(
            map_audio_error(AudioError::NoInputDevices),
            "no input devices available"
        );
        assert_eq!(
            map_audio_error(AudioError::StreamError("underrun".into())),
            "stream error: underrun"
        );
        assert_eq!(
            map_audio_error(AudioError::ChannelError("closed".into())),
            "channel error: closed"
        );
    }
}
