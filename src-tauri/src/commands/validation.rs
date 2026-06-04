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
