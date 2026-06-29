#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::AppHandle;

use crate::asset_paths;
use crate::commands::path_guard::{is_blocked_system_path, reject_unsafe_path_surface};

const MAX_LIBRARY_IMAGE_BYTES: u64 = 10_000_000;
const SUPPORTED_IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "bmp"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedLibraryImage {
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    pub mime_type: String,
}

fn validate_library_image_source(path: &str) -> Result<PathBuf, String> {
    reject_unsafe_path_surface(path)?;
    if is_blocked_system_path(path) {
        return Err("System paths are not allowed".into());
    }
    let metadata = std::fs::symlink_metadata(path)
        .map_err(|e| format!("Could not read image metadata: {e}"))?;
    if metadata.file_type().is_symlink() {
        return Err("Symlinked paths are not allowed".into());
    }
    if !metadata.is_file() {
        return Err("Path is not a file".into());
    }
    if metadata.len() > MAX_LIBRARY_IMAGE_BYTES {
        return Err("Image exceeds size limit".into());
    }

    let extension = extension_from_path(path);
    if !SUPPORTED_IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err("Unsupported image format".into());
    }

    Ok(PathBuf::from(path))
}

fn extension_from_path(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default()
}

fn mime_for_extension(extension: &str) -> String {
    match extension {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn random_file_name(extension: &str) -> String {
    let random: u64 = rand::random();
    format!("{}-{random:016x}.{extension}", chrono_like_timestamp())
}

fn chrono_like_timestamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis())
}

fn safe_library_file_name(file_name: &str) -> Result<&str, String> {
    if file_name.trim().is_empty()
        || file_name.contains('/')
        || file_name.contains('\\')
        || file_name.contains("..")
    {
        return Err("Invalid library file name".into());
    }
    Ok(file_name)
}

fn image_dimensions(bytes: &[u8], extension: &str) -> (u32, u32) {
    match extension {
        "png" if bytes.len() >= 24 && &bytes[0..8] == b"\x89PNG\r\n\x1a\n" => (
            u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]),
            u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]),
        ),
        "gif" if bytes.len() >= 10 => (
            u16::from_le_bytes([bytes[6], bytes[7]]).into(),
            u16::from_le_bytes([bytes[8], bytes[9]]).into(),
        ),
        "bmp" if bytes.len() >= 26 => (
            u32::from_le_bytes([bytes[18], bytes[19], bytes[20], bytes[21]]),
            u32::from_le_bytes([bytes[22], bytes[23], bytes[24], bytes[25]]),
        ),
        "webp" => webp_dimensions(bytes).unwrap_or((0, 0)),
        "jpg" | "jpeg" => jpeg_dimensions(bytes).unwrap_or((0, 0)),
        _ => (0, 0),
    }
}

fn jpeg_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.len() < 4 || bytes[0] != 0xff || bytes[1] != 0xd8 {
        return None;
    }
    let mut index = 2usize;
    while index + 9 < bytes.len() {
        if bytes[index] != 0xff {
            index += 1;
            continue;
        }
        let marker = bytes[index + 1];
        index += 2;
        if marker == 0xd9 || marker == 0xda {
            break;
        }
        if index + 2 > bytes.len() {
            break;
        }
        let length = usize::from(u16::from_be_bytes([bytes[index], bytes[index + 1]]));
        if length < 2 || index + length > bytes.len() {
            break;
        }
        if matches!(marker, 0xc0..=0xc3) && length >= 7 {
            let height = u32::from(u16::from_be_bytes([bytes[index + 3], bytes[index + 4]]));
            let width = u32::from(u16::from_be_bytes([bytes[index + 5], bytes[index + 6]]));
            return Some((width, height));
        }
        index += length;
    }
    None
}

fn webp_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.len() < 30 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WEBP" {
        return None;
    }
    match &bytes[12..16] {
        b"VP8X" if bytes.len() >= 30 => {
            let width = 1 + u32::from_le_bytes([bytes[24], bytes[25], bytes[26], 0]);
            let height = 1 + u32::from_le_bytes([bytes[27], bytes[28], bytes[29], 0]);
            Some((width, height))
        }
        b"VP8 " if bytes.len() >= 30 => Some((
            u32::from(u16::from_le_bytes([bytes[26], bytes[27]])) & 0x3fff,
            u32::from(u16::from_le_bytes([bytes[28], bytes[29]])) & 0x3fff,
        )),
        _ => None,
    }
}

#[tauri::command]
pub fn save_library_image(app: AppHandle, path: String) -> Result<SavedLibraryImage, String> {
    let source = validate_library_image_source(&path)?;
    let extension = extension_from_path(&path);
    let bytes = std::fs::read(&source).map_err(|e| format!("Could not read image: {e}"))?;
    let (width, height) = image_dimensions(&bytes, &extension);
    let file_name = random_file_name(&extension);
    let target = asset_paths::library_media_dir(&app)?.join(&file_name);
    std::fs::write(&target, bytes).map_err(|e| format!("Could not save image: {e}"))?;
    Ok(SavedLibraryImage {
        file_name,
        width,
        height,
        mime_type: mime_for_extension(&extension),
    })
}

#[tauri::command]
pub fn delete_library_image(app: AppHandle, file_name: String) -> Result<(), String> {
    let safe_name = safe_library_file_name(&file_name)?;
    let path = asset_paths::library_media_dir(&app)?.join(safe_name);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| format!("Could not delete image: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[test]
    fn rejects_url_network_traversal_and_system_paths() {
        assert!(validate_library_image_source("file:///tmp/x.png").is_err());
        assert!(validate_library_image_source("\\\\srv\\share\\x.png").is_err());
        assert!(validate_library_image_source("../x.png").is_err());
        assert!(validate_library_image_source("C:\\Windows\\x.png").is_err());
    }

    #[test]
    fn rejects_unsupported_extension() {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("image.svg");
        fs::write(&path, b"svg").expect("write svg");
        assert_eq!(
            validate_library_image_source(path.to_str().unwrap()).unwrap_err(),
            "Unsupported image format"
        );
    }

    #[test]
    fn accepts_supported_image_under_size_limit() {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("image.png");
        let mut file = fs::File::create(&path).expect("create png");
        file.write_all(b"\x89PNG\r\n\x1a\n").expect("write png");
        assert!(validate_library_image_source(path.to_str().unwrap()).is_ok());
    }

    #[test]
    fn rejects_unsafe_delete_file_names() {
        assert!(safe_library_file_name("../x.png").is_err());
        assert!(safe_library_file_name("folder/x.png").is_err());
        assert!(safe_library_file_name("x.png").is_ok());
    }

    #[test]
    fn reads_png_dimensions() {
        let bytes = [
            b"\x89PNG\r\n\x1a\n".as_slice(),
            &[0, 0, 0, 13],
            b"IHDR",
            &1920u32.to_be_bytes(),
            &1080u32.to_be_bytes(),
            &[8, 2, 0, 0, 0],
        ]
        .concat();
        assert_eq!(image_dimensions(&bytes, "png"), (1920, 1080));
    }
}
