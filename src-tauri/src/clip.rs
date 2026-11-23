//! Saves images pasted into a terminal, so the agent in it can open them by path.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::ipc::{InvokeBody, Request};
use tauri::Manager;

/// Largest image a paste may save (25 MiB).
pub const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
/// Saved images older than this are removed the next time one is saved.
const KEEP_SECS: u64 = 7 * 24 * 60 * 60;

pub fn extension(format: &str) -> Option<&'static str> {
    match format {
        "png" => Some("png"),
        "jpeg" => Some("jpg"),
        "gif" => Some("gif"),
        "webp" => Some("webp"),
        "bmp" => Some("bmp"),
        _ => None,
    }
}

/// Writes `bytes` into `dir` under a new name and returns the full path.
pub fn save_image(dir: &Path, bytes: &[u8], format: &str) -> Result<PathBuf, String> {
    let ext = extension(format).ok_or("This image type cannot be pasted.")?;
    if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
        return Err("This image is empty or larger than 25 MB.".into());
    }
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    prune(dir);
    let path = dir.join(format!("paste-{}.{ext}", uuid::Uuid::new_v4().simple()));
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

fn prune(dir: &Path) {
    let Ok(items) = fs::read_dir(dir) else { return };
    for item in items.flatten() {
        let old = item
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.elapsed().ok())
            .is_some_and(|age| age.as_secs() > KEEP_SECS);
        if old {
            let _ = fs::remove_file(item.path());
        }
    }
}

/// Body: the raw image bytes. Header `x-format`: png, jpeg, gif, webp or bmp.
#[tauri::command]
pub fn clip_image_save(app: tauri::AppHandle, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("The image did not arrive.".into());
    };
    let format = request
        .headers()
        .get("x-format")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("pastes");
    save_image(&dir, bytes, format).map(|p| p.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_known_formats_only() {
        let dir = tempfile::tempdir().unwrap();
        let p = save_image(dir.path(), &[1, 2, 3], "png").unwrap();
        assert_eq!(fs::read(&p).unwrap(), vec![1, 2, 3]);
        assert!(p.extension().unwrap() == "png");
        assert!(save_image(dir.path(), &[1], "tiff").is_err());
        assert!(save_image(dir.path(), &[], "png").is_err());
    }
}
