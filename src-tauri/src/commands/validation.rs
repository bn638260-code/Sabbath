pub const MAX_QUERY_BYTES: usize = 10 * 1024;
pub const MAX_STATUS_TEXT_BYTES: usize = 2 * 1024;
pub const MAX_SEARCH_LIMIT: usize = 100;
pub const MAX_TRANSCRIPT_BYTES: usize = 64 * 1024;
pub const MAX_QUEUE_LENGTH: usize = 10_000;

pub fn bounded_text(value: &str, field: &str, max_bytes: usize) -> Result<(), String> {
    if value.len() > max_bytes {
        return Err(format!(
            "{field} is too large ({} bytes). Max is {max_bytes} bytes.",
            value.len()
        ));
    }
    Ok(())
}

pub fn bounded_limit(limit: usize) -> Result<usize, String> {
    if limit == 0 {
        return Err("limit must be greater than 0".into());
    }
    Ok(limit.min(MAX_SEARCH_LIMIT))
}

pub fn bounded_optional_limit(limit: Option<usize>, default: usize) -> Result<usize, String> {
    bounded_limit(limit.unwrap_or(default))
}

pub fn valid_confidence_threshold(value: f32) -> Result<f32, String> {
    if !value.is_finite() {
        return Err("confidence_threshold must be finite".into());
    }
    Ok(value.clamp(0.0, 1.0))
}

pub fn valid_port(port: Option<u16>, default: u16) -> Result<u16, String> {
    let port = port.unwrap_or(default);
    if port == 0 {
        return Err("port must be between 1 and 65535".into());
    }
    Ok(port)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_text_accepts_within_limit_and_rejects_over() {
        assert!(bounded_text("hello", "query", 10).is_ok());
        assert!(bounded_text("", "query", 0).is_ok());
        let err = bounded_text("toolong", "query", 3).unwrap_err();
        assert!(err.contains("query"));
        assert!(err.contains("Max is 3 bytes"));
    }

    #[test]
    fn bounded_limit_rejects_zero_and_caps_at_max() {
        assert!(bounded_limit(0).is_err());
        assert_eq!(bounded_limit(5).unwrap(), 5);
        assert_eq!(bounded_limit(MAX_SEARCH_LIMIT).unwrap(), MAX_SEARCH_LIMIT);
        assert_eq!(bounded_limit(MAX_SEARCH_LIMIT + 50).unwrap(), MAX_SEARCH_LIMIT);
    }

    #[test]
    fn bounded_optional_limit_uses_default_when_none() {
        assert_eq!(bounded_optional_limit(None, 15).unwrap(), 15);
        assert_eq!(bounded_optional_limit(Some(3), 15).unwrap(), 3);
        assert!(bounded_optional_limit(Some(0), 15).is_err());
    }

    #[test]
    fn valid_confidence_threshold_clamps_and_rejects_non_finite() {
        assert!((valid_confidence_threshold(0.5).unwrap() - 0.5).abs() < f32::EPSILON);
        assert!((valid_confidence_threshold(-1.0).unwrap() - 0.0).abs() < f32::EPSILON);
        assert!((valid_confidence_threshold(2.0).unwrap() - 1.0).abs() < f32::EPSILON);
        assert!(valid_confidence_threshold(f32::NAN).is_err());
        assert!(valid_confidence_threshold(f32::INFINITY).is_err());
    }

    #[test]
    fn valid_port_rejects_zero_and_passes_through() {
        assert!(valid_port(Some(0), 8080).is_err());
        assert_eq!(valid_port(Some(9000), 8080).unwrap(), 9000);
        assert_eq!(valid_port(None, 8080).unwrap(), 8080);
    }
}
