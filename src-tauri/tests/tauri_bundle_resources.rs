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

#[test]
fn resources_bundle_only_quantized_gte_small_onnx_model() {
    let resources = tauri_bundle_resources();
    let onnx_model_resources = resources
        .iter()
        .filter_map(|(source, target)| {
            let target = target.as_str()?;
            (source.ends_with(".onnx") || target.ends_with(".onnx"))
                .then_some((source.as_str(), target))
        })
        .collect::<Vec<_>>();

    assert_eq!(
        onnx_model_resources,
        vec![(
            "../models/gte-small/onnx/model_quantized.onnx",
            "models/gte-small/onnx/model_quantized.onnx"
        )],
        "production bundle must ship only the quantized gte-small ONNX model"
    );
}
