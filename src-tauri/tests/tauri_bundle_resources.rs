use serde_json::Value;

fn tauri_bundle_resources() -> serde_json::Map<String, Value> {
    let config: Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).expect("valid tauri config JSON");
    config
        .pointer("/bundle/resources")
        .and_then(Value::as_object)
        .cloned()
        .expect("bundle.resources must be a JSON object")
}

#[test]
fn resources_include_sherpa_onedir_sidecar() {
    let resources = tauri_bundle_resources();

    assert_eq!(
        resources
            .get("../sidecars/sherpa_worker")
            .and_then(Value::as_str),
        Some("scripts/sherpa_worker")
    );
}

#[test]
fn resources_do_not_require_legacy_sherpa_file_glob() {
    let resources = tauri_bundle_resources();

    assert!(
        !resources.contains_key("../sidecars/sherpa_worker.*"),
        "the legacy top-level Sherpa sidecar glob breaks clean CI checkouts"
    );
}
