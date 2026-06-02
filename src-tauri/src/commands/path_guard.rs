use std::path::{Component, Path};

pub fn has_url_scheme(path: &str) -> bool {
    let Some(colon_idx) = path.find(':') else {
        return false;
    };
    if colon_idx == 0 {
        return false;
    }
    let scheme = &path[..colon_idx];
    let rest = &path[colon_idx + 1..];
    // Windows drive letter (e.g. C:\ or C:/) is not a URL scheme.
    if scheme.len() == 1
        && scheme.chars().all(|ch| ch.is_ascii_alphabetic())
        && rest.starts_with(['\\', '/'])
    {
        return false;
    }
    let first = scheme.chars().next().unwrap_or_default();
    if !first.is_ascii_alphabetic() {
        return false;
    }
    scheme
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.'))
}

pub fn is_network_path(path: &str) -> bool {
    path.starts_with("\\\\") || path.starts_with("//")
}

pub fn is_blocked_system_path(path: &str) -> bool {
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

pub fn path_contains_parent_traversal(path: &str) -> bool {
    Path::new(path)
        .components()
        .any(|component| matches!(component, Component::ParentDir))
}

pub fn reject_unsafe_path_surface(path: &str) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".into());
    }
    if is_network_path(trimmed) {
        return Err("Network paths are not allowed".into());
    }
    if path_contains_parent_traversal(trimmed) {
        return Err("Parent directory traversal is not allowed".into());
    }
    if has_url_scheme(trimmed) {
        return Err("URL paths are not allowed".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_url_network_and_traversal_surfaces() {
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
    fn blocks_system_paths() {
        assert!(is_blocked_system_path("C:\\Windows\\system32\\config.json"));
        assert!(is_blocked_system_path("/etc/theme.json"));
        assert!(!is_blocked_system_path("C:\\Users\\me\\theme.json"));
    }
}
