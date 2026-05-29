#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]

use std::path::{Component, Path, PathBuf};

use base64::Engine as _;
use tauri::command;

const MAX_THEME_BYTES: u64 = 1_000_000; // 1 MB
const MAX_IMAGE_BYTES: u64 = 10_000_000; // 10 MB
const MAX_JSON_DEPTH: usize = 32;
const MAX_JSON_NODES: usize = 20_000;

fn file_size(path: &Path) -> Result<u64, String> {
    Ok(std::fs::metadata(path)
        .map_err(|e| format!("Could not read file metadata: {e}"))?
        .len())
}

fn reject_unsafe_path_surface(path: &str) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".into());
    }
    if trimmed.starts_with("\\\\") || trimmed.starts_with("//") {
        return Err("Network paths are not allowed".into());
    }
    if Path::new(trimmed)
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
        return Err("Parent directory traversal is not allowed".into());
    }
    // URL scheme (allow Windows drive letters like C:\ or C:/)
    if let Some(idx) = trimmed.find(':') {
        let scheme = &trimmed[..idx];
        let rest = &trimmed[idx + 1..];
        let is_drive = scheme.len() == 1
            && scheme.chars().all(|c| c.is_ascii_alphabetic())
            && rest.starts_with(['\\', '/']);
        if !is_drive
            && !scheme.is_empty()
            && scheme
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
        {
            return Err("URL paths are not allowed".into());
        }
    }
    Ok(())
}

fn is_blocked_system_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/").to_ascii_lowercase();
    if normalized.starts_with("/etc/")
        || normalized.starts_with("/bin/")
        || normalized.starts_with("/sbin/")
        || normalized.starts_with("/usr/")
        || normalized.starts_with("/var/")
        || normalized.starts_with("/system/")
        || normalized.starts_with("/library/")
    {
        return true;
    }

    let Some((drive, rest)) = normalized.split_once(":/") else {
        return false;
    };
    if drive.len() != 1 || !drive.chars().all(|ch| ch.is_ascii_alphabetic()) {
        return false;
    }
    rest.starts_with("windows/")
        || rest.starts_with("program files/")
        || rest.starts_with("program files (x86)/")
        || rest.starts_with("programdata/")
}

/// Validate a path we will READ. Rejects unsafe surfaces and symlinks.
fn validate_readable_path(path: &str) -> Result<std::path::PathBuf, String> {
    reject_unsafe_path_surface(path)?;
    if is_blocked_system_path(path) {
        return Err("System paths are not allowed".into());
    }
    let meta = std::fs::symlink_metadata(path)
        .map_err(|e| format!("Could not read file metadata: {e}"))?;
    if meta.file_type().is_symlink() {
        return Err("Symlinked paths are not allowed".into());
    }
    if !meta.is_file() {
        return Err("Path is not a file".into());
    }
    Ok(Path::new(path).to_path_buf())
}

/// Validate a path we will WRITE. Rejects unsafe surfaces, system paths, and symlink targets.
fn validate_writable_path(path: &str) -> Result<PathBuf, String> {
    reject_unsafe_path_surface(path)?;
    if is_blocked_system_path(path) {
        return Err("System paths are not allowed".into());
    }

    let candidate = PathBuf::from(path);
    if let Ok(meta) = std::fs::symlink_metadata(&candidate) {
        if meta.file_type().is_symlink() {
            return Err("Symlinked paths are not allowed".into());
        }
        if !meta.is_file() {
            return Err("Path is not a file".into());
        }
    }

    let parent = candidate
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let parent_meta = std::fs::symlink_metadata(parent)
        .map_err(|e| format!("Could not read parent directory metadata: {e}"))?;
    if parent_meta.file_type().is_symlink() {
        return Err("Symlinked paths are not allowed".into());
    }
    if !parent_meta.is_dir() {
        return Err("Parent path is not a directory".into());
    }

    Ok(candidate)
}

fn enforce_json_limits(value: &serde_json::Value) -> Result<(), String> {
    fn walk(v: &serde_json::Value, depth: usize, nodes: &mut usize) -> Result<(), String> {
        *nodes += 1;
        if *nodes > MAX_JSON_NODES {
            return Err("Theme JSON is too large/complex".into());
        }
        if depth > MAX_JSON_DEPTH {
            return Err("Theme JSON is too deeply nested".into());
        }
        match v {
            serde_json::Value::Array(arr) => {
                for item in arr {
                    walk(item, depth + 1, nodes)?;
                }
            }
            serde_json::Value::Object(map) => {
                for (_k, val) in map {
                    walk(val, depth + 1, nodes)?;
                }
            }
            _ => {}
        }
        Ok(())
    }

    let mut nodes = 0usize;
    walk(value, 0, &mut nodes)
}

fn validate_theme_shape(value: &serde_json::Value) -> Result<(), String> {
    let obj = value
        .as_object()
        .ok_or_else(|| "Theme JSON must be an object".to_string())?;

    for key in ["id", "name", "background", "layout", "resolution"] {
        if !obj.contains_key(key) {
            return Err(format!("Invalid theme: missing required field '{key}'"));
        }
    }

    Ok(())
}

fn theme_from_bytes(bytes: &[u8]) -> Result<serde_json::Value, String> {
    let value: serde_json::Value =
        serde_json::from_slice(bytes).map_err(|e| format!("Invalid JSON: {e}"))?;
    enforce_json_limits(&value)?;
    validate_theme_shape(&value)?;
    Ok(value)
}

#[command]
pub fn import_theme_from_path(path: String) -> Result<serde_json::Value, String> {
    let p = validate_readable_path(&path)?;
    let size = file_size(&p)?;
    if size > MAX_THEME_BYTES {
        return Err(format!(
            "Theme file is too large ({size} bytes). Max is {MAX_THEME_BYTES} bytes."
        ));
    }
    let bytes = std::fs::read(&p).map_err(|e| format!("Could not read theme file: {e}"))?;
    theme_from_bytes(&bytes)
}

#[command]
pub fn export_theme_to_path(path: String, theme: serde_json::Value) -> Result<(), String> {
    enforce_json_limits(&theme)?;
    validate_theme_shape(&theme)?;
    let p = validate_writable_path(&path)?;

    let json = serde_json::to_string_pretty(&theme)
        .map_err(|e| format!("Could not serialize theme: {e}"))?;
    if json.len() as u64 > MAX_THEME_BYTES {
        return Err("Theme JSON is too large to export".into());
    }
    std::fs::write(&p, json).map_err(|e| format!("Could not write theme file: {e}"))
}

fn image_mime_for_extension(ext: &str) -> Option<&'static str> {
    match ext {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        "bmp" => Some("image/bmp"),
        // Intentionally no SVG for now.
        _ => None,
    }
}

#[command]
pub fn read_image_as_data_url(path: String) -> Result<String, String> {
    let p = validate_readable_path(&path)?;
    let size = file_size(&p)?;
    if size > MAX_IMAGE_BYTES {
        return Err(format!(
            "Image file is too large ({size} bytes). Max is {MAX_IMAGE_BYTES} bytes."
        ));
    }

    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = image_mime_for_extension(&ext).ok_or_else(|| {
        "Unsupported image format. Allowed: PNG, JPEG, WebP, GIF, BMP.".to_string()
    })?;

    let bytes = std::fs::read(p).map_err(|e| format!("Could not read image: {e}"))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    fn test_temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sabbathcue-theme-files-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn enforces_json_depth_limit() {
        // Create a JSON structure that exceeds MAX_JSON_DEPTH
        let mut value = serde_json::Value::Null;
        for _ in 0..=MAX_JSON_DEPTH {
            value = serde_json::json!({ "nested": value });
        }

        let result = enforce_json_limits(&value);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too deeply nested"));
    }

    #[test]
    fn accepts_json_at_depth_limit() {
        // Create a JSON structure exactly at MAX_JSON_DEPTH
        let mut value = serde_json::Value::Null;
        for _ in 0..MAX_JSON_DEPTH {
            value = serde_json::json!({ "nested": value });
        }

        let result = enforce_json_limits(&value);
        assert!(result.is_ok());
    }

    #[test]
    fn enforces_json_nodes_limit() {
        // Create a JSON structure that exceeds MAX_JSON_NODES
        let large_array: Vec<serde_json::Value> =
            (0..=MAX_JSON_NODES).map(|i| serde_json::json!(i)).collect();
        let value = serde_json::Value::Array(large_array);

        let result = enforce_json_limits(&value);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too large"));
    }

    #[test]
    fn accepts_json_at_nodes_limit() {
        // Create a JSON structure exactly at MAX_JSON_NODES
        // Array itself counts as 1 node, so we need MAX_JSON_NODES - 1 elements
        let large_array: Vec<serde_json::Value> = (0..(MAX_JSON_NODES - 1))
            .map(|i| serde_json::json!(i))
            .collect();
        let value = serde_json::Value::Array(large_array);

        let result = enforce_json_limits(&value);
        assert!(result.is_ok());
    }

    #[test]
    fn accepts_valid_theme_shape() {
        let valid_theme = serde_json::json!({
            "id": "test-theme",
            "name": "Test Theme",
            "background": "#ffffff",
            "layout": "standard",
            "resolution": "1080p"
        });

        let result = validate_theme_shape(&valid_theme);
        assert!(result.is_ok());
    }

    #[test]
    fn rejects_missing_required_field() {
        let invalid_theme = serde_json::json!({
            "id": "test-theme",
            "name": "Test Theme",
            "background": "#ffffff"
            // Missing "layout" and "resolution"
        });

        let result = validate_theme_shape(&invalid_theme);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("missing required field"));
    }

    #[test]
    fn rejects_url_and_network_and_traversal() {
        assert!(reject_unsafe_path_surface("file:///etc/passwd").is_err());
        assert!(reject_unsafe_path_surface("\\\\srv\\share\\x.json").is_err());
        assert!(reject_unsafe_path_surface("../secret.json").is_err());
    }

    #[test]
    fn allows_plain_and_drive_paths() {
        assert!(reject_unsafe_path_surface("theme.json").is_ok());
        assert!(reject_unsafe_path_surface("C:\\Users\\me\\theme.json").is_ok());
    }

    #[test]
    fn rejects_system_paths() {
        assert!(validate_readable_path("C:\\Windows\\system32\\config.json").is_err());
        assert!(validate_writable_path("/etc/theme.json").is_err());
    }

    #[test]
    fn import_rejects_directory_path() {
        let dir = test_temp_dir("directory");
        let err = import_theme_from_path(dir.to_string_lossy().into_owned()).unwrap_err();
        assert_eq!(err, "Path is not a file");
        let _ = fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn import_rejects_symlink_path() {
        let dir = test_temp_dir("symlink-read");
        let target = dir.join("theme.json");
        fs::write(
            &target,
            r##"{"id":"t","name":"T","background":"#000","layout":"x","resolution":"1080p"}"##,
        )
        .expect("write target");
        let link = dir.join("theme-link.json");
        std::os::unix::fs::symlink(&target, &link).expect("create symlink");

        let err = import_theme_from_path(link.to_string_lossy().into_owned()).unwrap_err();
        assert_eq!(err, "Symlinked paths are not allowed");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn export_writes_valid_theme_to_plain_path() {
        let dir = test_temp_dir("export-ok");
        let path = dir.join("theme.json");
        let theme = serde_json::json!({
            "id": "test-theme",
            "name": "Test Theme",
            "background": "#ffffff",
            "layout": "standard",
            "resolution": "1080p"
        });

        export_theme_to_path(path.to_string_lossy().into_owned(), theme).expect("export theme");
        let written = fs::read_to_string(&path).expect("read export");
        assert!(written.contains("\"id\": \"test-theme\""));
        let _ = fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn export_rejects_symlink_target() {
        let dir = test_temp_dir("symlink-write");
        let target = dir.join("real-theme.json");
        fs::write(&target, "{}").expect("write target");
        let link = dir.join("theme-link.json");
        std::os::unix::fs::symlink(&target, &link).expect("create symlink");
        let theme = serde_json::json!({
            "id": "test-theme",
            "name": "Test Theme",
            "background": "#ffffff",
            "layout": "standard",
            "resolution": "1080p"
        });

        let err = export_theme_to_path(link.to_string_lossy().into_owned(), theme).unwrap_err();
        assert_eq!(err, "Symlinked paths are not allowed");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn read_image_rejects_directory_path() {
        let dir = test_temp_dir("image-directory");
        let err = read_image_as_data_url(dir.to_string_lossy().into_owned()).unwrap_err();
        assert_eq!(err, "Path is not a file");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn read_image_accepts_plain_png_path() {
        let dir = test_temp_dir("image-ok");
        let path = dir.join("image.png");
        let mut file = fs::File::create(&path).expect("create image");
        file.write_all(b"png").expect("write image");

        let data_url = read_image_as_data_url(path.to_string_lossy().into_owned()).expect("read image");
        assert!(data_url.starts_with("data:image/png;base64,"));
        let _ = fs::remove_dir_all(dir);
    }
}
