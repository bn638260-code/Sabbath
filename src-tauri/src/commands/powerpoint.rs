//! Convert PowerPoint decks to PDF via a local LibreOffice (`soffice`) runtime.
//!
//! The frontend renders the returned PDF to slide images lazily with
//! `pdfjs-dist`; this module only performs the validated, sandboxed conversion.

#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]

use std::io::Read as _;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use base64::Engine as _;
use serde::Serialize;
use tauri::command;

use crate::asset_paths;
use crate::commands::path_guard::{is_blocked_system_path, reject_unsafe_path_surface};

/// Reject decks larger than this before handing them to LibreOffice.
const MAX_DECK_SIZE_BYTES: u64 = 100 * 1024 * 1024;
/// Cap the produced PDF so an unexpectedly huge conversion cannot exhaust memory.
const MAX_PDF_SIZE_BYTES: u64 = 200 * 1024 * 1024;
/// Maximum time to wait for a single LibreOffice conversion.
const CONVERSION_TIMEOUT: Duration = Duration::from_secs(120);
const POLL_INTERVAL: Duration = Duration::from_millis(100);
const SUPPORTED_DECK_EXTENSIONS: &[&str] = &["ppt", "pptx"];

/// Error returned when LibreOffice cannot be located. Names the override env
/// var without leaking any local filesystem paths.
const MISSING_CONVERTER_ERROR: &str =
    "LibreOffice (soffice) was not found. Install LibreOffice or set SABBATHCUE_SOFFICE_PATH to the soffice executable.";

/// Base64-encoded PDF produced from a PowerPoint deck.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerPointConversion {
    pub file_name: String,
    pub pdf_base64: String,
}

#[cfg(windows)]
fn suppress_console_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn suppress_console_window(_command: &mut Command) {}

fn first_nonempty_line(text: &str) -> Option<String> {
    text.lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

/// Validate a deck path we will read and hand to LibreOffice. Rejects URLs,
/// network shares, parent traversal, system paths, symlinks, directories,
/// unsupported extensions, and oversized files.
fn validate_deck_path(path: &str) -> Result<PathBuf, String> {
    reject_unsafe_path_surface(path)?;
    if is_blocked_system_path(path) {
        return Err("System paths are not allowed".into());
    }

    let extension = Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if !SUPPORTED_DECK_EXTENSIONS.contains(&extension.as_str()) {
        return Err("Select a PowerPoint .ppt or .pptx file.".into());
    }

    let metadata = std::fs::symlink_metadata(path)
        .map_err(|_| "PowerPoint file does not exist".to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("Symlinked paths are not allowed".into());
    }
    if !metadata.is_file() {
        return Err("Path is not a file".into());
    }
    if metadata.len() > MAX_DECK_SIZE_BYTES {
        return Err("PowerPoint file exceeds the size limit".into());
    }

    Ok(PathBuf::from(path))
}

/// Run LibreOffice headless to convert `input` into a PDF inside `out_dir`.
fn run_soffice(soffice: &Path, input: &Path, out_dir: &Path) -> Result<(), String> {
    let mut command = Command::new(soffice);
    suppress_console_window(&mut command);
    command
        .arg("--headless")
        .arg("--convert-to")
        .arg("pdf")
        .arg("--outdir")
        .arg(out_dir)
        .arg(input)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to launch LibreOffice: {e}"))?;

    let deadline = Instant::now() + CONVERSION_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("PowerPoint conversion timed out.".into());
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(e) => return Err(format!("LibreOffice wait failed: {e}")),
        }
    };

    if status.success() {
        return Ok(());
    }

    let mut stderr = String::new();
    if let Some(mut handle) = child.stderr.take() {
        let _ = handle.read_to_string(&mut stderr);
    }
    let detail = first_nonempty_line(&stderr).unwrap_or_else(|| format!("exit {status}"));
    Err(format!("LibreOffice could not convert the deck: {detail}"))
}

fn convert_powerpoint_to_pdf_inner(path: &str) -> Result<PowerPointConversion, String> {
    let input = validate_deck_path(path)?;
    let soffice = asset_paths::resolve_soffice().ok_or_else(|| MISSING_CONVERTER_ERROR.to_string())?;

    let out_dir = tempfile::tempdir()
        .map_err(|e| format!("Could not create a temporary conversion directory: {e}"))?;

    run_soffice(&soffice, &input, out_dir.path())?;

    let stem = input
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| "PowerPoint file name is invalid".to_string())?;
    let pdf_path = out_dir.path().join(format!("{stem}.pdf"));

    let metadata = std::fs::metadata(&pdf_path)
        .map_err(|_| "LibreOffice did not produce a PDF.".to_string())?;
    if metadata.len() > MAX_PDF_SIZE_BYTES {
        return Err("Converted PDF exceeds the size limit".into());
    }

    let bytes = std::fs::read(&pdf_path).map_err(|e| format!("Could not read converted PDF: {e}"))?;
    let pdf_base64 = base64::engine::general_purpose::STANDARD.encode(bytes);

    let file_name = input
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Presentation")
        .to_string();

    Ok(PowerPointConversion {
        file_name,
        pdf_base64,
    })
}

/// Convert a local `.ppt`/`.pptx` deck to a base64-encoded PDF using LibreOffice.
#[command]
pub async fn convert_powerpoint_to_pdf(path: String) -> Result<PowerPointConversion, String> {
    tauri::async_runtime::spawn_blocking(move || convert_powerpoint_to_pdf_inner(&path))
        .await
        .map_err(|e| format!("PowerPoint conversion task failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write as _;

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("sabbathcue-pptx-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn rejects_url_network_and_traversal() {
        assert_eq!(
            validate_deck_path("file:///tmp/x.pptx").unwrap_err(),
            "URL paths are not allowed"
        );
        assert_eq!(
            validate_deck_path("\\\\server\\share\\x.pptx").unwrap_err(),
            "Network paths are not allowed"
        );
        assert_eq!(
            validate_deck_path("../secret.pptx").unwrap_err(),
            "Parent directory traversal is not allowed"
        );
    }

    #[test]
    fn rejects_system_path() {
        assert_eq!(
            validate_deck_path("C:\\Windows\\system32\\deck.pptx").unwrap_err(),
            "System paths are not allowed"
        );
    }

    #[test]
    fn rejects_unsupported_extension() {
        let dir = temp_dir("ext");
        let file = dir.join("notes.txt");
        let mut handle = fs::File::create(&file).expect("create file");
        handle.write_all(b"x").expect("write");
        assert_eq!(
            validate_deck_path(file.to_str().unwrap()).unwrap_err(),
            "Select a PowerPoint .ppt or .pptx file."
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_directory_path() {
        let dir = temp_dir("dir");
        let nested = dir.join("deck.pptx");
        fs::create_dir_all(&nested).expect("create nested dir");
        assert_eq!(
            validate_deck_path(nested.to_str().unwrap()).unwrap_err(),
            "Path is not a file"
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_oversized_deck() {
        let dir = temp_dir("oversize");
        let file = dir.join("deck.pptx");
        let handle = fs::File::create(&file).expect("create file");
        handle
            .set_len(MAX_DECK_SIZE_BYTES + 1)
            .expect("set file size");
        assert_eq!(
            validate_deck_path(file.to_str().unwrap()).unwrap_err(),
            "PowerPoint file exceeds the size limit"
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn accepts_valid_pptx() {
        let dir = temp_dir("ok");
        let file = dir.join("sermon.pptx");
        let mut handle = fs::File::create(&file).expect("create file");
        handle.write_all(b"PK\x03\x04").expect("write");
        let validated = validate_deck_path(file.to_str().unwrap()).expect("valid deck");
        assert_eq!(validated, file);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn missing_converter_error_names_override_without_local_paths() {
        assert!(MISSING_CONVERTER_ERROR.contains("SABBATHCUE_SOFFICE_PATH"));
        assert!(!MISSING_CONVERTER_ERROR.contains("Users\\"));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_deck() {
        let dir = temp_dir("symlink");
        let target = dir.join("real.pptx");
        fs::write(&target, b"PK").expect("write target");
        let link = dir.join("link.pptx");
        std::os::unix::fs::symlink(&target, &link).expect("symlink");
        assert_eq!(
            validate_deck_path(link.to_str().unwrap()).unwrap_err(),
            "Symlinked paths are not allowed"
        );
        let _ = fs::remove_dir_all(dir);
    }
}
