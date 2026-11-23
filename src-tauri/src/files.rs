use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

const MAX_TEXT_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFile {
    pub text: String,
    pub modified: u64,
}

/// Joins a relative path to a workspace root and refuses anything that leaves the root.
pub fn resolve(root: &str, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel_path.components().any(|c| !matches!(c, Component::Normal(_) | Component::CurDir)) {
        return Err("This path leaves the workspace.".into());
    }
    let root = fs::canonicalize(root).map_err(|_| "This workspace folder does not exist.".to_string())?;
    let joined = root.join(rel_path);
    // A link inside the workspace can still point out of it.
    let mut existing = joined.as_path();
    while !existing.exists() {
        existing = existing.parent().ok_or("This path leaves the workspace.")?;
    }
    let real = fs::canonicalize(existing).map_err(|e| e.to_string())?;
    if !real.starts_with(&root) {
        return Err("This path leaves the workspace.".into());
    }
    Ok(joined)
}

fn modified_ms(path: &Path) -> Result<u64, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    let time = meta.modified().map_err(|e| e.to_string())?;
    Ok(time.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0))
}

#[tauri::command(async)]
pub fn files_list(root: String, rel: String) -> Result<Vec<Entry>, String> {
    let dir = resolve(&root, &rel)?;
    let mut out = Vec::new();
    for item in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let item = item.map_err(|e| e.to_string())?;
        let name = item.file_name().to_string_lossy().into_owned();
        if name == ".git" {
            continue;
        }
        let meta = item.metadata().map_err(|e| e.to_string())?;
        let path = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        out.push(Entry { name, path, is_dir: meta.is_dir(), size: meta.len() });
    }
    out.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

#[tauri::command(async)]
pub fn files_read(root: String, rel: String) -> Result<TextFile, String> {
    let path = resolve(&root, &rel)?;
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_TEXT_BYTES {
        return Err("This file is too big to open here.".into());
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let text = String::from_utf8(bytes).map_err(|_| "This file is not text.".to_string())?;
    Ok(TextFile { text, modified: modified_ms(&path)? })
}

/// Saves a file. If it changed on disk since it was read, the save stops, so an agent's edit is not lost.
#[tauri::command(async)]
pub fn files_write(root: String, rel: String, text: String, expected_modified: Option<u64>) -> Result<u64, String> {
    let path = resolve(&root, &rel)?;
    if let Some(expected) = expected_modified {
        if path.exists() && modified_ms(&path)? != expected {
            return Err("This file changed on disk. Reopen it first.".into());
        }
    }
    fs::write(&path, text).map_err(|e| e.to_string())?;
    modified_ms(&path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> (tempfile::TempDir, String) {
        let d = tempfile::tempdir().unwrap();
        let s = d.path().to_string_lossy().into_owned();
        (d, s)
    }

    #[test]
    fn refuses_paths_that_leave_the_root() {
        let (_d, r) = root();
        assert!(resolve(&r, "../secret.txt").is_err());
        assert!(resolve(&r, "a/../../secret.txt").is_err());
        assert!(resolve(&r, "C:\\Windows\\win.ini").is_err());
        assert!(resolve(&r, "ok.txt").is_ok());
        assert!(resolve(&r, "new/deep/ok.txt").is_ok());
    }

    #[test]
    fn write_stops_when_the_file_changed_on_disk() {
        let (_d, r) = root();
        let first = files_write(r.clone(), "a.txt".into(), "one".into(), None).unwrap();
        assert_eq!(files_read(r.clone(), "a.txt".into()).unwrap().text, "one");
        let stale = first.saturating_sub(5000);
        assert!(files_write(r.clone(), "a.txt".into(), "two".into(), Some(stale)).is_err());
        assert_eq!(files_read(r.clone(), "a.txt".into()).unwrap().text, "one");
        files_write(r.clone(), "a.txt".into(), "two".into(), Some(first)).unwrap();
        assert_eq!(files_read(r, "a.txt".into()).unwrap().text, "two");
    }

    #[test]
    fn list_puts_folders_first_and_hides_git() {
        let (d, r) = root();
        fs::create_dir(d.path().join(".git")).unwrap();
        fs::create_dir(d.path().join("zed")).unwrap();
        fs::write(d.path().join("alpha.txt"), "x").unwrap();
        let names: Vec<String> = files_list(r, "".into()).unwrap().into_iter().map(|e| e.name).collect();
        assert_eq!(names, vec!["zed", "alpha.txt"]);
    }

    #[test]
    fn binary_files_do_not_open_as_text() {
        let (d, r) = root();
        fs::write(d.path().join("b.bin"), [0xff, 0xfe, 0x00]).unwrap();
        assert!(files_read(r, "b.bin".into()).is_err());
    }
}
