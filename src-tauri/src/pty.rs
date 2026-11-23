//! The app side of terminals. The terminals themselves live in the keeper (see host.rs),
//! so they survive when the app closes. This file finds or starts the keeper and passes bytes along.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{AppHandle, Emitter, State};
use tokio::net::windows::named_pipe::ClientOptions;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio::sync::oneshot;

use crate::agents::which;
use crate::wire::{self, DATA, JSON};

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>>;
type Channels = Arc<Mutex<HashMap<String, Channel<InvokeResponseBody>>>>;

struct Conn {
    tx: UnboundedSender<(u8, Vec<u8>)>,
    pending: Pending,
    next: AtomicU64,
    alive: Arc<AtomicBool>,
    pid: AtomicU64,
}

pub struct Terms {
    app: AppHandle,
    integration: PathBuf,
    data_dir: PathBuf,
    conn: tokio::sync::Mutex<Option<Arc<Conn>>>,
    channels: Channels,
    keep_alive: AtomicBool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TermExit {
    id: String,
    code: Option<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeeperInfo {
    pid: u64,
    sessions: usize,
    keep_alive: bool,
}

pub fn write_integration(data_dir: &Path) -> std::io::Result<PathBuf> {
    let dir = data_dir.join("shell");
    std::fs::create_dir_all(&dir)?;
    let path = dir.join("integration.ps1");
    std::fs::write(&path, include_str!("integration.ps1"))?;
    Ok(path)
}

fn shell_program() -> String {
    which("pwsh")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "powershell.exe".into())
}

/// The key that proves to the keeper that a caller is this app. It sits in the app's own data folder.
fn keeper_key(data_dir: &Path) -> String {
    let path = data_dir.join("keeper.key");
    if let Ok(k) = std::fs::read_to_string(&path) {
        if k.trim().len() >= 32 {
            return k.trim().to_string();
        }
    }
    let k = format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple());
    let _ = std::fs::write(&path, &k);
    k
}

/// Starts the keeper from a copy of this program, so a rebuild or update can replace the program while terminals run.
fn spawn_keeper(data_dir: &Path, key: &str) -> std::io::Result<()> {
    let exe = std::env::current_exe()?;
    let bin = data_dir.join("bin");
    std::fs::create_dir_all(&bin)?;
    let copy = bin.join(format!("switchyard-keeper-v{}.exe", wire::PROTO));
    // The copy fails while an old keeper still runs from it. Then the old copy is used.
    let _ = std::fs::copy(&exe, &copy);
    let target = if copy.is_file() { copy } else { exe };

    let mut cmd = std::process::Command::new(target);
    cmd.arg("--pty-host")
        .env("SWITCHYARD_HOST_KEY", key)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x0100_0000;
        // Breaking away from the launcher's job keeps the keeper alive when the launcher closes. Some jobs forbid it.
        cmd.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_BREAKAWAY_FROM_JOB);
        if cmd.spawn().is_ok() {
            return Ok(());
        }
        cmd.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }
    cmd.spawn().map(|_| ())
}

impl Terms {
    pub fn new(app: AppHandle, integration: PathBuf, data_dir: PathBuf) -> Self {
        Self {
            app,
            integration,
            data_dir,
            conn: tokio::sync::Mutex::new(None),
            channels: Arc::default(),
            keep_alive: AtomicBool::new(true),
        }
    }

    async fn open_pipe() -> std::io::Result<tokio::net::windows::named_pipe::NamedPipeClient> {
        const ERROR_PIPE_BUSY: i32 = 231;
        let name = wire::pipe_name();
        for _ in 0..40 {
            match ClientOptions::new().open(&name) {
                Ok(c) => return Ok(c),
                Err(e) if e.raw_os_error() == Some(ERROR_PIPE_BUSY) => tokio::time::sleep(Duration::from_millis(50)).await,
                Err(e) => return Err(e),
            }
        }
        Err(std::io::Error::other("The terminal keeper is busy."))
    }

    async fn connect(&self) -> Result<Arc<Conn>, String> {
        let key = keeper_key(&self.data_dir);
        let pipe = match Self::open_pipe().await {
            Ok(p) => p,
            Err(_) => {
                spawn_keeper(&self.data_dir, &key).map_err(|e| format!("Could not start the terminal keeper: {e}"))?;
                let mut found = None;
                for _ in 0..100 {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    if let Ok(p) = Self::open_pipe().await {
                        found = Some(p);
                        break;
                    }
                }
                found.ok_or("The terminal keeper did not start.")?
            }
        };

        let (mut rd, mut wr) = tokio::io::split(pipe);
        let (tx, mut rx) = unbounded_channel::<(u8, Vec<u8>)>();
        let conn = Arc::new(Conn {
            tx,
            pending: Arc::default(),
            next: AtomicU64::new(1),
            alive: Arc::new(AtomicBool::new(true)),
            pid: AtomicU64::new(0),
        });

        tauri::async_runtime::spawn(async move {
            while let Some((kind, body)) = rx.recv().await {
                if wire::write_frame(&mut wr, kind, &body).await.is_err() {
                    break;
                }
            }
        });

        let pending = conn.pending.clone();
        let alive = conn.alive.clone();
        let channels = self.channels.clone();
        let app = self.app.clone();
        tauri::async_runtime::spawn(async move {
            while let Ok((kind, body)) = wire::read_frame(&mut rd).await {
                if kind == DATA {
                    if let Some((id, bytes)) = wire::split_data(&body) {
                        if let Some(ch) = channels.lock().unwrap().get(id) {
                            let _ = ch.send(InvokeResponseBody::Raw(bytes.to_vec()));
                        }
                    }
                    continue;
                }
                let Ok(v) = serde_json::from_slice::<Value>(&body) else { continue };
                if let Some(req) = v["req"].as_u64() {
                    if let Some(done) = pending.lock().unwrap().remove(&req) {
                        let _ = done.send(v);
                    }
                } else if v["ev"] == "exit" {
                    let id = v["id"].as_str().unwrap_or_default().to_string();
                    channels.lock().unwrap().remove(&id);
                    let code = v["code"].as_u64().map(|c| c as u32);
                    let _ = app.emit("term-exit", TermExit { id, code });
                }
            }
            // The keeper went away, and its terminals with it.
            alive.store(false, Ordering::SeqCst);
            pending.lock().unwrap().clear();
            let gone: Vec<String> = channels.lock().unwrap().drain().map(|(k, _)| k).collect();
            for id in gone {
                let _ = app.emit("term-exit", TermExit { id, code: None });
            }
        });

        let hello = Self::ask(&conn, json!({ "op": "hello", "key": key, "proto": wire::PROTO })).await?;
        conn.pid.store(hello["pid"].as_u64().unwrap_or(0), Ordering::SeqCst);
        Ok(conn)
    }

    async fn conn(&self) -> Result<Arc<Conn>, String> {
        let mut slot = self.conn.lock().await;
        if let Some(c) = slot.as_ref() {
            if c.alive.load(Ordering::SeqCst) {
                return Ok(c.clone());
            }
        }
        let c = self.connect().await?;
        *slot = Some(c.clone());
        Ok(c)
    }

    /// The connection only if one is open. Used where starting a keeper would be pointless.
    async fn existing(&self) -> Option<Arc<Conn>> {
        self.conn.lock().await.as_ref().filter(|c| c.alive.load(Ordering::SeqCst)).cloned()
    }

    async fn ask(conn: &Conn, mut v: Value) -> Result<Value, String> {
        let req = conn.next.fetch_add(1, Ordering::Relaxed);
        v["req"] = json!(req);
        let (done, wait) = oneshot::channel();
        conn.pending.lock().unwrap().insert(req, done);
        conn.tx.send((JSON, v.to_string().into_bytes())).map_err(|_| "The terminal keeper closed.")?;
        let reply = tokio::time::timeout(Duration::from_secs(15), wait)
            .await
            .map_err(|_| "The terminal keeper did not answer.")?
            .map_err(|_| "The terminal keeper closed.")?;
        if reply["ok"] == true {
            Ok(reply)
        } else {
            Err(reply["error"].as_str().unwrap_or("The terminal keeper refused.").to_string())
        }
    }

    async fn request(&self, v: Value) -> Result<Value, String> {
        let conn = self.conn().await?;
        Self::ask(&conn, v).await
    }

    fn tell(conn: &Conn, v: Value) {
        let _ = conn.tx.send((JSON, v.to_string().into_bytes()));
    }

    /// Ends every terminal unless you chose to keep them. Runs when the app quits.
    pub fn on_quit(&self) {
        if self.keep_alive.load(Ordering::SeqCst) {
            return;
        }
        tauri::async_runtime::block_on(async {
            if let Some(c) = self.existing().await {
                let _ = tokio::time::timeout(Duration::from_secs(3), Self::ask(&c, json!({ "op": "killAll" }))).await;
            }
        });
    }
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn term_start(
    terms: State<'_, Terms>,
    id: String,
    cwd: String,
    startup: Option<String>,
    token: String,
    cols: u16,
    rows: u16,
    on_data: Channel<InvokeResponseBody>,
) -> Result<(), String> {
    let mut env = HashMap::from([
        ("TERM".to_string(), "xterm-256color".to_string()),
        ("COLORTERM".to_string(), "truecolor".to_string()),
        ("SWITCHYARD_PANE".to_string(), id.clone()),
        ("SWITCHYARD_TOKEN".to_string(), token.clone()),
    ]);
    if let Some(s) = &startup {
        env.insert("SWITCHYARD_STARTUP".into(), s.clone());
    }
    let integration = terms.integration.to_string_lossy().into_owned();
    let args = ["-NoLogo", "-NoExit", "-ExecutionPolicy", "Bypass", "-File", &integration];
    terms.channels.lock().unwrap().insert(id.clone(), on_data);
    let result = terms
        .request(json!({
            "op": "start",
            "id": id,
            "cwd": cwd,
            "program": shell_program(),
            "args": args,
            "env": env,
            // An agent started under another agent can refuse to run, so drop these markers.
            "envRemove": ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SSE_PORT", "SWITCHYARD_HOST_KEY"],
            "token": token,
            "cols": cols,
            "rows": rows,
        }))
        .await;
    if result.is_err() {
        terms.channels.lock().unwrap().remove(&id);
    }
    result.map(|_| ())
}

/// Joins a terminal that is still running in the keeper. Its saved output arrives first on `on_data`.
#[tauri::command]
pub async fn term_attach(terms: State<'_, Terms>, id: String, on_data: Channel<InvokeResponseBody>) -> Result<u64, String> {
    terms.channels.lock().unwrap().insert(id.clone(), on_data);
    let result = terms.request(json!({ "op": "attach", "id": id })).await;
    if result.is_err() {
        terms.channels.lock().unwrap().remove(&id);
    }
    // How many saved bytes come first on the channel. They can arrive after this answer.
    result.map(|r| r["bytes"].as_u64().unwrap_or(0))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveTerm {
    id: String,
    token: String,
    cwd: String,
    started: u64,
}

#[tauri::command]
pub async fn term_list(terms: State<'_, Terms>) -> Result<Vec<LiveTerm>, String> {
    let reply = terms.request(json!({ "op": "list" })).await?;
    let list = reply["sessions"].as_array().cloned().unwrap_or_default();
    Ok(list
        .into_iter()
        .map(|s| LiveTerm {
            id: s["id"].as_str().unwrap_or_default().into(),
            token: s["token"].as_str().unwrap_or_default().into(),
            cwd: s["cwd"].as_str().unwrap_or_default().into(),
            started: s["started"].as_u64().unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn term_write(terms: State<'_, Terms>, id: String, data: String) -> Result<(), String> {
    let conn = terms.existing().await.ok_or("This terminal is closed.")?;
    conn.tx.send((DATA, wire::data_body(&id, data.as_bytes()))).map_err(|_| "This terminal is closed.".into())
}

#[tauri::command]
pub async fn term_resize(terms: State<'_, Terms>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    if let Some(c) = terms.existing().await {
        Terms::tell(&c, json!({ "op": "resize", "id": id, "cols": cols, "rows": rows }));
    }
    Ok(())
}

#[tauri::command]
pub async fn term_kill(terms: State<'_, Terms>, id: String) -> Result<(), String> {
    if let Some(c) = terms.existing().await {
        Terms::tell(&c, json!({ "op": "kill", "id": id }));
    }
    Ok(())
}

#[tauri::command]
pub async fn term_kill_all(terms: State<'_, Terms>) -> Result<(), String> {
    terms.request(json!({ "op": "killAll" })).await.map(|_| ())
}

#[tauri::command]
pub async fn term_keep_alive(terms: State<'_, Terms>, on: bool) -> Result<(), String> {
    terms.keep_alive.store(on, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn term_keeper(terms: State<'_, Terms>) -> Result<KeeperInfo, String> {
    let conn = terms.conn().await?;
    let reply = Terms::ask(&conn, json!({ "op": "list" })).await?;
    Ok(KeeperInfo {
        pid: conn.pid.load(Ordering::SeqCst),
        sessions: reply["sessions"].as_array().map(|a| a.len()).unwrap_or(0),
        keep_alive: terms.keep_alive.load(Ordering::SeqCst),
    })
}
