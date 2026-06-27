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

fn is_minilm_onnx(path: &str) -> bool {
    path.contains("models/minilm-l6-v2")
        && std::path::Path::new(path)
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("onnx"))
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
fn resources_bundle_only_int8_minilm_onnx_model() {
    let resources = tauri_bundle_resources();
    let minilm_model_resources = resources
        .iter()
        .filter_map(|(source, target)| {
            let target = target.as_str()?;
            (is_minilm_onnx(source) || is_minilm_onnx(target)).then_some((source.as_str(), target))
        })
        .collect::<Vec<_>>();

    assert_eq!(
        minilm_model_resources,
        vec![(
            "../models/minilm-l6-v2-int8/onnx/model_quantized.onnx",
            "models/minilm-l6-v2-int8/onnx/model_quantized.onnx"
        )],
        "production bundle must ship only the INT8 MiniLM ONNX model"
    );
}
