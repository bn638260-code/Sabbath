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
fn resources_do_not_include_removed_sherpa_assets() {
    let resources = tauri_bundle_resources();

    assert!(
        resources.iter().all(|(key, value)| !key.contains("sherpa")
            && !value
                .as_str()
                .is_some_and(|target| target.contains("sherpa"))),
        "Sherpa assets must not be bundled after provider removal"
    );
}
