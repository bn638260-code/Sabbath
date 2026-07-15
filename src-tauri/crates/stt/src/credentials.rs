//! Read-only cloud credential checks used by the settings onboarding flow.

use std::time::Duration;

use reqwest::{Client, StatusCode};

const VALIDATION_TIMEOUT: Duration = Duration::from_secs(12);

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(VALIDATION_TIMEOUT)
        .build()
        .map_err(|error| format!("Could not prepare credential check: {error}"))
}

fn validate_response(provider: &str, response: &reqwest::Response) -> Result<(), String> {
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }

    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(format!(
            "{provider} rejected this API key. Check that it was copied completely and has transcription access."
        )),
        StatusCode::PAYMENT_REQUIRED => Err(format!(
            "{provider} accepted the account, but its balance or billing allowance is exhausted."
        )),
        StatusCode::TOO_MANY_REQUESTS => Err(format!(
            "{provider} is rate limiting checks right now. Wait a moment and try again."
        )),
        _ if status.is_server_error() => Err(format!(
            "{provider} is temporarily unavailable (HTTP {status}). Try again shortly."
        )),
        _ => Err(format!(
            "{provider} could not verify this key (HTTP {status})."
        )),
    }
}

pub async fn validate_deepgram_api_key(api_key: &str) -> Result<(), String> {
    let response = client()?
        .get("https://api.deepgram.com/v1/projects")
        .header("Authorization", format!("Token {api_key}"))
        .send()
        .await
        .map_err(|error| format!("Could not reach Deepgram: {error}"))?;
    validate_response("Deepgram", &response)
}

pub async fn validate_soniox_api_key(api_key: &str) -> Result<(), String> {
    let response = client()?
        .get("https://api.soniox.com/v1/models")
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|error| format!("Could not reach Soniox: {error}"))?;
    validate_response("Soniox", &response)
}

pub async fn validate_speechmatics_api_key(api_key: &str) -> Result<(), String> {
    let response = client()?
        .post("https://mp.speechmatics.com/v1/api_keys?type=rt")
        .bearer_auth(api_key)
        .json(&serde_json::json!({ "ttl": 60 }))
        .send()
        .await
        .map_err(|error| format!("Could not reach Speechmatics: {error}"))?;
    validate_response("Speechmatics", &response)
}
