use std::collections::HashMap;
use std::env;
use std::path::PathBuf;

/// Finds a program on PATH without starting a process, so no window flashes.
pub fn which(name: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    let exts: Vec<String> = if cfg!(windows) {
        env::var("PATHEXT")
            .unwrap_or_else(|_| ".EXE;.CMD;.BAT;.PS1".into())
            .split(';')
            .map(|s| s.to_ascii_lowercase())
            .chain([".ps1".to_string()])
            .collect()
    } else {
        vec![String::new()]
    };
    for dir in env::split_paths(&path) {
        for ext in &exts {
            let candidate = dir.join(format!("{name}{ext}"));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

#[tauri::command(async)]
pub fn agents_detect(commands: Vec<String>) -> HashMap<String, bool> {
    commands
        .into_iter()
        .map(|c| {
            let found = which(&c).is_some();
            (c, found)
        })
        .collect()
}
