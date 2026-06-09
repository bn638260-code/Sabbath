use thiserror::Error;

#[non_exhaustive]
#[derive(Error, Debug, Clone)]
pub enum SttError {
    #[error("connection failed: {0}")]
    ConnectionFailed(String),

    #[error("WebSocket error: {0}")]
    WebSocketError(String),

    #[error("API key is missing")]
    ApiKeyMissing,

    #[error("send error: {0}")]
    SendError(String),

    #[error("parse error: {0}")]
    ParseError(String),

    #[error("model not found: {0}")]
    ModelNotFound(String),
}

#[cfg(test)]
mod tests {
    use super::SttError;

    #[test]
    fn display_messages_are_stable_for_all_variants() {
        assert_eq!(
            SttError::ConnectionFailed("timeout".into()).to_string(),
            "connection failed: timeout"
        );
        assert_eq!(
            SttError::WebSocketError("closed".into()).to_string(),
            "WebSocket error: closed"
        );
        assert_eq!(SttError::ApiKeyMissing.to_string(), "API key is missing");
        assert_eq!(
            SttError::SendError("busy".into()).to_string(),
            "send error: busy"
        );
        assert_eq!(
            SttError::ParseError("json".into()).to_string(),
            "parse error: json"
        );
        assert_eq!(
            SttError::ModelNotFound("tiny".into()).to_string(),
            "model not found: tiny"
        );
    }
}
