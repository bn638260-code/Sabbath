use super::OPERATOR_DETECTION_THRESHOLD;

pub(super) const DEFAULT_SEMANTIC_VISIBILITY_THRESHOLD: f64 = 0.65;
const AUTO_QUEUE_DISABLED_THRESHOLD: f64 = f64::INFINITY;

pub(super) fn apply_detection_settings_to_merger(
    merger: &mut rhema_detection::DetectionMerger,
    auto_threshold: Option<f64>,
    semantic_threshold: f64,
    cooldown_ms: u64,
) {
    merger.set_confidence_threshold(OPERATOR_DETECTION_THRESHOLD);
    merger.set_semantic_confidence_threshold(semantic_threshold);
    merger.set_auto_queue_threshold(auto_threshold.unwrap_or(AUTO_QUEUE_DISABLED_THRESHOLD));
    merger.set_cooldown_ms(cooldown_ms.clamp(250, 60_000));
}
