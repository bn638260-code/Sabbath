use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use rhema_bible::{BibleDb, Translation};

pub struct AppState {
    pub bible_db: Option<BibleDb>,
    pub active_translation_id: i64,
    pub audio_active: Arc<AtomicBool>,
    pub stt_active: Arc<AtomicBool>,
    pub detection_paused: Arc<AtomicBool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            bible_db: None,
            active_translation_id: 1, // Default to first translation (KJV)
            audio_active: Arc::new(AtomicBool::new(false)),
            stt_active: Arc::new(AtomicBool::new(false)),
            detection_paused: Arc::new(AtomicBool::new(false)),
        }
    }
}

pub fn initial_translation_id(translations: &[Translation]) -> Option<i64> {
    translations
        .iter()
        .find(|translation| translation.abbreviation.eq_ignore_ascii_case("KJV"))
        .or_else(|| translations.first())
        .map(|translation| translation.id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn translation(id: i64, abbreviation: &str) -> Translation {
        Translation {
            id,
            abbreviation: abbreviation.to_string(),
            title: abbreviation.to_string(),
            language: "English".to_string(),
            is_copyrighted: false,
            is_downloaded: true,
        }
    }

    #[test]
    fn initial_translation_id_prefers_kjv_when_available() {
        let translations = [translation(4, "NIV"), translation(7, "KJV")];

        assert_eq!(initial_translation_id(&translations), Some(7));
    }

    #[test]
    fn initial_translation_id_falls_back_to_first_translation() {
        let translations = [translation(4, "NIV"), translation(7, "ESV")];

        assert_eq!(initial_translation_id(&translations), Some(4));
    }
}
