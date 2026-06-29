#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::commands::assets::MAX_MEDIA_SIZE_BYTES;
use crate::commands::path_guard::{is_blocked_system_path, reject_unsafe_path_surface};

const SUPPORTED_VIDEO_EXTENSIONS: &[&str] = &["mp4", "webm"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoPathValidation {
    pub label: String,
    pub size_bytes: u64,
    pub mime_type: String,
}

fn file_name_from_path(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or("Video")
        .to_string()
}

fn extension_from_path(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default()
}

fn mime_type_from_extension(extension: &str) -> &'static str {
    match extension {
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        _ => "application/octet-stream",
    }
}

fn validate_video_path_inner(path: &str) -> Result<VideoPathValidation, String> {
    let trimmed = path.trim();
    reject_unsafe_path_surface(trimmed)?;
    if is_blocked_system_path(trimmed) {
        return Err("System paths are not allowed".to_string());
    }

    let extension = extension_from_path(trimmed);
    if !SUPPORTED_VIDEO_EXTENSIONS.contains(&extension.as_str()) {
        return Err("Unsupported video extension".to_string());
    }

    let link_metadata =
        std::fs::symlink_metadata(trimmed).map_err(|_| "Video path does not exist".to_string())?;
    if link_metadata.file_type().is_symlink() {
        return Err("Symlinked paths are not allowed".to_string());
    }

    let canonical = PathBuf::from(trimmed)
        .canonicalize()
        .map_err(|_| "Video path does not exist".to_string())?;
    let metadata = canonical
        .metadata()
        .map_err(|_| "Unable to read video metadata".to_string())?;
    if !metadata.is_file() {
        return Err("Video path is not a file".to_string());
    }
    if metadata.len() > MAX_MEDIA_SIZE_BYTES {
        return Err("Video exceeds size limit".to_string());
    }

    Ok(VideoPathValidation {
        label: file_name_from_path(trimmed),
        size_bytes: metadata.len(),
        mime_type: mime_type_from_extension(&extension).to_string(),
    })
}

#[tauri::command]
pub fn validate_video_path(path: String) -> Result<VideoPathValidation, String> {
    validate_video_path_inner(&path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    fn temp_file(name: &str, bytes: &[u8]) -> (std::path::PathBuf, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!(
            "sabbathcue-video-{}-{}",
            std::process::id(),
            name.replace('.', "-")
        ));
        fs::create_dir_all(&dir).expect("temp dir");
        let file_path = dir.join(name);
        let mut file = fs::File::create(&file_path).expect("create file");
        file.write_all(bytes).expect("write file");
        (dir, file_path)
    }

    #[test]
    fn accepts_mp4_video() {
        let (dir, file_path) = temp_file("sample.mp4", b"video");
        let validated =
            validate_video_path_inner(file_path.to_str().expect("utf-8 path")).expect("valid");
        assert_eq!(validated.label, "sample.mp4");
        assert_eq!(validated.mime_type, "video/mp4");
        assert_eq!(validated.size_bytes, 5);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn accepts_webm_video() {
        let (dir, file_path) = temp_file("sample.webm", b"video");
        let validated =
            validate_video_path_inner(file_path.to_str().expect("utf-8 path")).expect("valid");
        assert_eq!(validated.mime_type, "video/webm");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_traversal_network_url_system_and_bad_extension() {
        assert_eq!(
            validate_video_path_inner("../sample.mp4").unwrap_err(),
            "Parent directory traversal is not allowed"
        );
        assert_eq!(
            validate_video_path_inner("\\\\server\\share\\sample.mp4").unwrap_err(),
            "Network paths are not allowed"
        );
        assert_eq!(
            validate_video_path_inner("file:///tmp/sample.mp4").unwrap_err(),
            "URL paths are not allowed"
        );
        assert_eq!(
            validate_video_path_inner("C:\\Windows\\sample.mp4").unwrap_err(),
            "System paths are not allowed"
        );
        let (dir, file_path) = temp_file("sample.mov", b"video");
        assert_eq!(
            validate_video_path_inner(file_path.to_str().expect("utf-8 path")).unwrap_err(),
            "Unsupported video extension"
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_video() {
        let dir =
            std::env::temp_dir().join(format!("sabbathcue-video-symlink-{}", std::process::id()));
        fs::create_dir_all(&dir).expect("temp dir");
        let target = dir.join("real.mp4");
        fs::write(&target, b"video").expect("write target");
        let link = dir.join("link.mp4");
        std::os::unix::fs::symlink(&target, &link).expect("symlink");
        assert_eq!(
            validate_video_path_inner(link.to_str().expect("utf-8 path")).unwrap_err(),
            "Symlinked paths are not allowed"
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_oversize_video() {
        let dir =
            std::env::temp_dir().join(format!("sabbathcue-video-large-{}", std::process::id()));
        fs::create_dir_all(&dir).expect("temp dir");
        let file_path = dir.join("large.mp4");
        let file = fs::File::create(&file_path).expect("create file");
        file.set_len(MAX_MEDIA_SIZE_BYTES + 1)
            .expect("set file size");
        assert_eq!(
            validate_video_path_inner(file_path.to_str().expect("utf-8 path")).unwrap_err(),
            "Video exceeds size limit"
        );
        let _ = fs::remove_dir_all(dir);
    }
}
