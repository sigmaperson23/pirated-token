use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

pub struct Db {
    store: Mutex<Store>,
    data_dir: PathBuf,
}

impl Db {
    pub fn new(store: Store, data_dir: PathBuf) -> Self {
        Self { store: Mutex::new(store), data_dir }
    }
}

pub struct Store {
    conn: Connection,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub workspace: String,
    pub title: String,
    pub body: String,
    pub status: String,
    pub engine: Option<String>,
    pub branch: Option<String>,
    pub worktree: Option<String>,
    pub archived: bool,
    pub created: i64,
    pub updated: i64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TaskPatch {
    pub title: Option<String>,
    pub body: Option<String>,
    pub status: Option<String>,
    pub engine: Option<String>,
    pub branch: Option<String>,
    pub worktree: Option<String>,
    pub archived: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: i64,
    pub task_id: String,
    pub author: String,
    pub text: String,
    pub created: i64,
}

pub const STATUSES: [&str; 4] = ["todo", "doing", "review", "done"];

fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

fn new_id() -> String {
    let n = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("t{n:x}")
}

fn row_to_task(r: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: r.get(0)?,
        workspace: r.get(1)?,
        title: r.get(2)?,
        body: r.get(3)?,
        status: r.get(4)?,
        engine: r.get(5)?,
        branch: r.get(6)?,
        worktree: r.get(7)?,
        archived: r.get::<_, i64>(8)? != 0,
        created: r.get(9)?,
        updated: r.get(10)?,
    })
}

const TASK_COLUMNS: &str =
    "id, workspace, title, body, status, engine, branch, worktree, archived, created, updated";

impl Store {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS documents (
                key TEXT PRIMARY KEY,
                json TEXT NOT NULL,
                updated INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                workspace TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'todo',
                engine TEXT,
                branch TEXT,
                worktree TEXT,
                archived INTEGER NOT NULL DEFAULT 0,
                created INTEGER NOT NULL,
                updated INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace, archived);
             CREATE TABLE IF NOT EXISTS task_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                author TEXT NOT NULL,
                text TEXT NOT NULL,
                created INTEGER NOT NULL
             );",
        )?;
        Ok(Self { conn })
    }

    pub fn doc_get(&self, key: &str) -> rusqlite::Result<Option<String>> {
        self.conn
            .query_row("SELECT json FROM documents WHERE key = ?1", [key], |r| r.get(0))
            .optional()
    }

    pub fn doc_set(&self, key: &str, json: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT INTO documents (key, json, updated) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated = excluded.updated",
            params![key, json, now_ms()],
        )?;
        Ok(())
    }

    pub fn doc_delete(&self, key: &str) -> rusqlite::Result<()> {
        self.conn.execute("DELETE FROM documents WHERE key = ?1", [key])?;
        Ok(())
    }

    pub fn tasks_list(&self, workspace: Option<&str>, include_archived: bool) -> rusqlite::Result<Vec<Task>> {
        let sql = format!(
            "SELECT {TASK_COLUMNS} FROM tasks
             WHERE (?1 IS NULL OR workspace = ?1) AND (?2 = 1 OR archived = 0)
             ORDER BY created DESC"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params![workspace, include_archived as i64], row_to_task)?;
        rows.collect()
    }

    pub fn task_get(&self, id: &str) -> rusqlite::Result<Option<Task>> {
        let sql = format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1");
        self.conn.query_row(&sql, [id], row_to_task).optional()
    }

    pub fn task_create(&self, workspace: &str, title: &str, body: &str) -> rusqlite::Result<Task> {
        let (id, now) = (new_id(), now_ms());
        self.conn.execute(
            "INSERT INTO tasks (id, workspace, title, body, created, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![id, workspace, title, body, now],
        )?;
        Ok(self.task_get(&id)?.expect("task was just inserted"))
    }

    pub fn task_update(&self, id: &str, patch: &TaskPatch) -> Result<Task, String> {
        if let Some(s) = &patch.status {
            if !STATUSES.contains(&s.as_str()) {
                return Err(format!("Unknown status: {s}. Use one of {}.", STATUSES.join(", ")));
            }
        }
        let changed = self
            .conn
            .execute(
                "UPDATE tasks SET
                    title = COALESCE(?2, title),
                    body = COALESCE(?3, body),
                    status = COALESCE(?4, status),
                    engine = COALESCE(?5, engine),
                    branch = COALESCE(?6, branch),
                    worktree = COALESCE(?7, worktree),
                    archived = COALESCE(?8, archived),
                    updated = ?9
                 WHERE id = ?1",
                params![
                    id,
                    patch.title,
                    patch.body,
                    patch.status,
                    patch.engine,
                    patch.branch,
                    patch.worktree,
                    patch.archived.map(|a| a as i64),
                    now_ms()
                ],
            )
            .map_err(|e| e.to_string())?;
        if changed == 0 {
            return Err(format!("No task has the id {id}."));
        }
        self.task_get(id).map_err(|e| e.to_string())?.ok_or_else(|| "Task vanished.".to_string())
    }

    pub fn comment_add(&self, task_id: &str, author: &str, text: &str) -> Result<Comment, String> {
        if self.task_get(task_id).map_err(|e| e.to_string())?.is_none() {
            return Err(format!("No task has the id {task_id}."));
        }
        let now = now_ms();
        self.conn
            .execute(
                "INSERT INTO task_comments (task_id, author, text, created) VALUES (?1, ?2, ?3, ?4)",
                params![task_id, author, text, now],
            )
            .map_err(|e| e.to_string())?;
        Ok(Comment {
            id: self.conn.last_insert_rowid(),
            task_id: task_id.into(),
            author: author.into(),
            text: text.into(),
            created: now,
        })
    }

    pub fn comments(&self, task_id: &str) -> rusqlite::Result<Vec<Comment>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, task_id, author, text, created FROM task_comments WHERE task_id = ?1 ORDER BY id",
        )?;
        let rows = stmt.query_map([task_id], |r| {
            Ok(Comment {
                id: r.get(0)?,
                task_id: r.get(1)?,
                author: r.get(2)?,
                text: r.get(3)?,
                created: r.get(4)?,
            })
        })?;
        rows.collect()
    }
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command(async)]
pub fn doc_get(db: State<'_, Db>, key: String) -> Result<Option<String>, String> {
    db.store.lock().unwrap().doc_get(&key).map_err(err)
}

#[tauri::command(async)]
pub fn doc_set(db: State<'_, Db>, key: String, json: String) -> Result<(), String> {
    db.store.lock().unwrap().doc_set(&key, &json).map_err(err)
}

#[tauri::command(async)]
pub fn doc_delete(db: State<'_, Db>, key: String) -> Result<(), String> {
    db.store.lock().unwrap().doc_delete(&key).map_err(err)
}

#[tauri::command(async)]
pub fn tasks_list(db: State<'_, Db>, workspace: Option<String>) -> Result<Vec<Task>, String> {
    db.store.lock().unwrap().tasks_list(workspace.as_deref(), false).map_err(err)
}

#[tauri::command(async)]
pub fn task_create(db: State<'_, Db>, workspace: String, title: String, body: String) -> Result<Task, String> {
    db.store.lock().unwrap().task_create(&workspace, &title, &body).map_err(err)
}

#[tauri::command(async)]
pub fn task_update(db: State<'_, Db>, id: String, patch: TaskPatch) -> Result<Task, String> {
    db.store.lock().unwrap().task_update(&id, &patch)
}

#[tauri::command(async)]
pub fn task_comments(db: State<'_, Db>, id: String) -> Result<Vec<Comment>, String> {
    db.store.lock().unwrap().comments(&id).map_err(err)
}

#[tauri::command(async)]
pub fn task_comment_add(db: State<'_, Db>, id: String, text: String) -> Result<Comment, String> {
    db.store.lock().unwrap().comment_add(&id, "You", &text)
}

/// Returns the settings a coding agent needs to reach the task board.
#[tauri::command(async)]
pub fn task_board_config(db: State<'_, Db>, workspace: String) -> Result<String, String> {
    let exe = std::env::current_exe().map_err(err)?;
    let name = if cfg!(windows) { "switchyard-tasks.exe" } else { "switchyard-tasks" };
    let bin = exe.with_file_name(name);
    let config = serde_json::json!({
        "mcpServers": {
            "switchyard-tasks": {
                "command": bin,
                "args": ["--db", db.data_dir.join("switchyard.sqlite3"), "--workspace", workspace]
            }
        }
    });
    serde_json::to_string_pretty(&config).map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> (tempfile::TempDir, Store) {
        let dir = tempfile::tempdir().unwrap();
        let s = Store::open(&dir.path().join("t.sqlite3")).unwrap();
        (dir, s)
    }

    #[test]
    fn documents_round_trip_and_overwrite() {
        let (_d, s) = store();
        assert_eq!(s.doc_get("a").unwrap(), None);
        s.doc_set("a", "1").unwrap();
        s.doc_set("a", "2").unwrap();
        assert_eq!(s.doc_get("a").unwrap().as_deref(), Some("2"));
        s.doc_delete("a").unwrap();
        assert_eq!(s.doc_get("a").unwrap(), None);
    }

    #[test]
    fn tasks_filter_by_workspace_and_hide_archived() {
        let (_d, s) = store();
        let a = s.task_create("C:/one", "first", "").unwrap();
        s.task_create("C:/two", "second", "").unwrap();
        assert_eq!(s.tasks_list(None, false).unwrap().len(), 2);
        assert_eq!(s.tasks_list(Some("C:/one"), false).unwrap().len(), 1);
        s.task_update(&a.id, &TaskPatch { archived: Some(true), ..Default::default() }).unwrap();
        assert_eq!(s.tasks_list(Some("C:/one"), false).unwrap().len(), 0);
        assert_eq!(s.tasks_list(Some("C:/one"), true).unwrap().len(), 1);
    }

    #[test]
    fn task_update_keeps_other_fields_and_rejects_bad_input() {
        let (_d, s) = store();
        let t = s.task_create("C:/one", "title", "body").unwrap();
        let u = s
            .task_update(&t.id, &TaskPatch { status: Some("review".into()), ..Default::default() })
            .unwrap();
        assert_eq!((u.status.as_str(), u.title.as_str(), u.body.as_str()), ("review", "title", "body"));
        assert!(s.task_update(&t.id, &TaskPatch { status: Some("nope".into()), ..Default::default() }).is_err());
        assert!(s.task_update("missing", &TaskPatch::default()).is_err());
    }

    #[test]
    fn comments_need_a_real_task() {
        let (_d, s) = store();
        let t = s.task_create("C:/one", "title", "").unwrap();
        s.comment_add(&t.id, "agent", "working").unwrap();
        assert_eq!(s.comments(&t.id).unwrap().len(), 1);
        assert!(s.comment_add("missing", "agent", "x").is_err());
    }
}
