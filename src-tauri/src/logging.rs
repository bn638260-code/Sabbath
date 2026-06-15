//! Log plugin configuration.
//!
//! The tauri-plugin-log defaults are `RotationStrategy::KeepOne` with a 40 KB
//! cap, which deletes the previous session's log on the next launch as soon as
//! it grew past 40 KB. That made post-hoc diagnosis (Vosk startup failures,
//! broadcast window timing) impossible. We keep several dated log files and
//! allow each to grow large enough to hold a full service session.

pub const MAX_LOG_FILE_BYTES: u128 = 10 * 1024 * 1024;
pub const KEPT_LOG_FILES: usize = 10;

pub fn rotation_strategy() -> tauri_plugin_log::RotationStrategy {
    tauri_plugin_log::RotationStrategy::KeepSome(KEPT_LOG_FILES)
}

pub fn build_log_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_log::Builder::new()
        .level(tauri_plugin_log::log::LevelFilter::Info)
        .rotation_strategy(rotation_strategy())
        .max_file_size(MAX_LOG_FILE_BYTES)
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rotation_keeps_previous_session_logs() {
        // KeepOne deletes the prior session's log at startup; any regression
        // back to it (or to KeepAll-less defaults) loses diagnostic history.
        assert!(
            matches!(
                rotation_strategy(),
                tauri_plugin_log::RotationStrategy::KeepSome(count) if count >= 2
            ),
            "log rotation must retain at least the previous session's log"
        );
    }

    #[expect(
        clippy::assertions_on_constants,
        reason = "This regression test documents the intended log retention cap"
    )]
    #[test]
    fn max_log_file_size_holds_a_full_session() {
        // The plugin default (40 KB) overflows within minutes of transcription
        // logging, which is what triggered the destructive rotation.
        assert!(
            MAX_LOG_FILE_BYTES >= 1024 * 1024,
            "log file cap must be at least 1 MiB to hold a service session"
        );
    }
}
