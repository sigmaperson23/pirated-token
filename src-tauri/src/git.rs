use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use serde::Serialize;

#[derive(Debug, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub is_repo: bool,
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub files: Vec<FileChange>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub staged: char,
    pub unstaged: char,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    pub path: String,
    pub branch: String,
    pub is_main: bool,
}

fn git(root: &str, args: &[&str]) -> Result<Output, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(root).args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // no console window
    }
    cmd.output().map_err(|e| format!("Git could not start: {e}"))
}

fn run(root: &str, args: &[&str]) -> Result<String, String> {
    let out = git(root, args)?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        let err = String::from_utf8_lossy(&out.stderr);
        let text = err.trim();
        Err(if text.is_empty() { "Git stopped with an error.".into() } else { text.to_string() })
    }
}

pub fn parse_status(raw: &str) -> Status {
    let mut status = Status { is_repo: true, ..Default::default() };
    let mut parts = raw.split('\0').filter(|p| !p.is_empty());
    while let Some(part) = parts.next() {
        if let Some(head) = part.strip_prefix("## ") {
            let (name, rest) = head.split_once(' ').unwrap_or((head, ""));
            let name = name.strip_prefix("No commits yet on ").unwrap_or(name);
            status.branch = head
                .strip_prefix("No commits yet on ")
                .unwrap_or(name.split("...").next().unwrap_or(name))
                .to_string();
            for (key, slot) in [("ahead ", &mut status.ahead), ("behind ", &mut status.behind)] {
                if let Some(i) = rest.find(key) {
                    let digits: String = rest[i + key.len()..].chars().take_while(char::is_ascii_digit).collect();
                    *slot = digits.parse().unwrap_or(0);
                }
            }
            continue;
        }
        let mut chars = part.chars();
        let (Some(x), Some(y)) = (chars.next(), chars.next()) else { continue };
        let path = part.get(3..).unwrap_or("").to_string();
        // A renamed file has its old name as the next item.
        if x == 'R' || x == 'C' {
            parts.next();
        }
        status.files.push(FileChange { path, staged: x, unstaged: y });
    }
    status
}

pub fn parse_worktrees(raw: &str) -> Vec<Worktree> {
    let mut out = Vec::new();
    for (i, block) in raw.split("\n\n").filter(|b| !b.trim().is_empty()).enumerate() {
        let mut path = String::new();
        let mut branch = String::from("(no branch)");
        for line in block.lines() {
            if let Some(p) = line.strip_prefix("worktree ") {
                path = p.to_string();
            } else if let Some(b) = line.strip_prefix("branch ") {
                branch = b.trim_start_matches("refs/heads/").to_string();
            }
        }
        out.push(Worktree { path, branch, is_main: i == 0 });
    }
    out
}

/// A folder name for a new worktree, beside the repository so it stays out of the repository's own files.
pub fn worktree_path(root: &str, branch: &str) -> Result<PathBuf, String> {
    let root = Path::new(root);
    let name = root.file_name().ok_or("This workspace has no folder name.")?.to_string_lossy();
    let parent = root.parent().ok_or("This workspace has no parent folder.")?;
    let slug: String =
        branch.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' }).collect();
    Ok(parent.join(format!("{name}-worktrees")).join(slug))
}

#[tauri::command(async)]
pub fn git_status(root: String) -> Result<Status, String> {
    let out = git(&root, &["status", "--porcelain=v1", "-b", "-z", "-uall"])?;
    if !out.status.success() {
        return Ok(Status::default());
    }
    Ok(parse_status(&String::from_utf8_lossy(&out.stdout)))
}

#[tauri::command(async)]
pub fn git_diff(root: String, path: String, staged: bool, untracked: bool) -> Result<String, String> {
    if untracked {
        // --no-index exits with 1 when the files differ, so a failure code is normal here.
        let empty = if cfg!(windows) { "NUL" } else { "/dev/null" };
        let out = git(&root, &["diff", "--no-index", "--", empty, &path])?;
        return Ok(String::from_utf8_lossy(&out.stdout).into_owned());
    }
    if staged {
        run(&root, &["diff", "--cached", "--", &path])
    } else {
        run(&root, &["diff", "--", &path])
    }
}

fn with_paths<'a>(base: &[&'a str], paths: &'a [String]) -> Vec<&'a str> {
    let mut args = base.to_vec();
    args.push("--");
    args.extend(paths.iter().map(String::as_str));
    args
}

#[tauri::command(async)]
pub fn git_stage(root: String, paths: Vec<String>) -> Result<(), String> {
    run(&root, &with_paths(&["add"], &paths)).map(|_| ())
}

#[tauri::command(async)]
pub fn git_unstage(root: String, paths: Vec<String>) -> Result<(), String> {
    run(&root, &with_paths(&["restore", "--staged"], &paths)).map(|_| ())
}

#[tauri::command(async)]
pub fn git_discard(root: String, path: String, untracked: bool) -> Result<(), String> {
    let paths = [path];
    if untracked {
        run(&root, &with_paths(&["clean", "-f"], &paths)).map(|_| ())
    } else {
        run(&root, &with_paths(&["restore", "--source=HEAD", "--staged", "--worktree"], &paths)).map(|_| ())
    }
}

#[tauri::command(async)]
pub fn git_commit(root: String, message: String) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("Write a commit message first.".into());
    }
    run(&root, &["commit", "-m", &message])
}

#[tauri::command(async)]
pub fn git_push(root: String) -> Result<String, String> {
    run(&root, &["push"])
}

#[tauri::command(async)]
pub fn git_pull(root: String) -> Result<String, String> {
    run(&root, &["pull", "--ff-only"])
}

#[tauri::command(async)]
pub fn git_merge(root: String, branch: String) -> Result<String, String> {
    run(&root, &["merge", "--no-ff", "--no-edit", &branch])
}

#[tauri::command(async)]
pub fn git_worktrees(root: String) -> Result<Vec<Worktree>, String> {
    Ok(parse_worktrees(&run(&root, &["worktree", "list", "--porcelain"])?))
}

#[tauri::command(async)]
pub fn git_worktree_add(root: String, branch: String) -> Result<String, String> {
    let path = worktree_path(&root, &branch)?;
    let path_str = path.to_string_lossy().into_owned();
    run(&root, &["worktree", "add", "-b", &branch, &path_str])?;
    Ok(path_str)
}

#[tauri::command(async)]
pub fn git_worktree_remove(root: String, path: String, force: bool) -> Result<(), String> {
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(&path);
    run(&root, &args).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_branch_counts_and_files() {
        let s = parse_status("## main...origin/main [ahead 2, behind 1]\0M  a.txt\0 M b.txt\0?? c.txt\0");
        assert_eq!((s.branch.as_str(), s.ahead, s.behind), ("main", 2, 1));
        let got: Vec<_> = s.files.iter().map(|f| (f.path.as_str(), f.staged, f.unstaged)).collect();
        assert_eq!(got, vec![("a.txt", 'M', ' '), ("b.txt", ' ', 'M'), ("c.txt", '?', '?')]);
    }

    #[test]
    fn reads_a_new_repo_and_a_rename() {
        let s = parse_status("## No commits yet on main\0R  new.txt\0old.txt\0A  z.txt\0");
        assert_eq!(s.branch, "main");
        let names: Vec<_> = s.files.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(names, vec!["new.txt", "z.txt"]);
    }

    #[test]
    fn reads_worktree_blocks() {
        let w = parse_worktrees(
            "worktree C:/r\nHEAD abc\nbranch refs/heads/main\n\nworktree C:/r-w/x\nHEAD def\nbranch refs/heads/task/x\n\n",
        );
        assert_eq!(w.len(), 2);
        assert!(w[0].is_main && !w[1].is_main);
        assert_eq!(w[1].branch, "task/x");
    }

    #[test]
    fn worktree_folder_sits_beside_the_repo() {
        let p = worktree_path("C:/code/shop", "task/fix login").unwrap();
        assert_eq!(p, Path::new("C:/code").join("shop-worktrees").join("task-fix-login"));
    }

    #[test]
    fn real_repo_status_commit_and_worktree() {
        let d = tempfile::tempdir().unwrap();
        let r = d.path().join("repo");
        std::fs::create_dir(&r).unwrap();
        let root = r.to_string_lossy().into_owned();
        run(&root, &["init", "-b", "main"]).unwrap();
        run(&root, &["config", "user.email", "t@example.com"]).unwrap();
        run(&root, &["config", "user.name", "t"]).unwrap();
        std::fs::write(r.join("a.txt"), "one\n").unwrap();

        assert!(git_status(root.clone()).unwrap().is_repo);
        assert!(!git_diff(root.clone(), "a.txt".into(), false, true).unwrap().is_empty());
        git_stage(root.clone(), vec!["a.txt".into()]).unwrap();
        git_commit(root.clone(), "first".into()).unwrap();
        assert!(git_commit(root.clone(), "  ".into()).is_err());
        assert!(git_status(root.clone()).unwrap().files.is_empty());

        let wt = git_worktree_add(root.clone(), "task/one".into()).unwrap();
        std::fs::write(Path::new(&wt).join("b.txt"), "two\n").unwrap();
        git_stage(wt.clone(), vec!["b.txt".into()]).unwrap();
        git_commit(wt.clone(), "from worktree".into()).unwrap();
        assert_eq!(git_worktrees(root.clone()).unwrap().len(), 2);
        git_merge(root.clone(), "task/one".into()).unwrap();
        assert!(r.join("b.txt").exists());
        git_worktree_remove(root.clone(), wt, false).unwrap();
        assert_eq!(git_worktrees(root).unwrap().len(), 1);
    }
}
