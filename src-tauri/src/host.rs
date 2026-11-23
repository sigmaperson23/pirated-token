//! The terminal keeper. It is the same program started with `--pty-host`.
//!
//! It owns every terminal, so terminals keep running when the app closes, crashes or updates.
//! The app talks to it over a named pipe. The keeper keeps the last output of each terminal,
//! so a returning app can draw the screen again. It quits by itself when it has no terminals
//! and no app for a while.

use std::collections::{HashMap, HashSet, VecDeque};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::net::windows::named_pipe::ServerOptions;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};

use crate::wire::{self, DATA, JSON};

/// How much output each terminal keeps for a returning app.
const KEEP_BYTES: usize = 1024 * 1024;
/// How long the keeper waits with nothing to do before it quits.
const IDLE_QUIT: Duration = Duration::from_secs(45);

type Out = UnboundedSender<(u8, Vec<u8>)>;

struct Sess {
    token: String,
    cwd: String,
    started: u64,
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    ring: VecDeque<u8>,
    subs: HashSet<u64>,
}

#[derive(Default)]
struct Keeper {
    sessions: Mutex<HashMap<String, Sess>>,
    clients: Mutex<HashMap<u64, Out>>,
    next_client: AtomicU64,
    last_busy: Mutex<Option<Instant>>,
}

/// Adds bytes to a terminal's saved output and drops the oldest part past `cap`.
/// After a drop it starts at a line break when one is near, so the replay does not begin mid-sequence.
pub fn push_ring(ring: &mut VecDeque<u8>, bytes: &[u8], cap: usize) {
    ring.extend(bytes);
    if ring.len() <= cap {
        return;
    }
    let extra = ring.len() - cap;
    ring.drain(..extra);
    if let Some(pos) = ring.iter().take(4096).position(|&b| b == b'\n') {
        ring.drain(..=pos);
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartArgs {
    id: String,
    cwd: String,
    program: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    #[serde(default)]
    env_remove: Vec<String>,
    token: String,
    cols: u16,
    rows: u16,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize { rows: rows.max(2), cols: cols.max(2), pixel_width: 0, pixel_height: 0 }
}

impl Keeper {
    fn send_to(&self, client: u64, kind: u8, body: Vec<u8>) {
        if let Some(tx) = self.clients.lock().unwrap().get(&client) {
            let _ = tx.send((kind, body));
        }
    }

    fn broadcast(&self, v: &Value) {
        let body = v.to_string().into_bytes();
        for tx in self.clients.lock().unwrap().values() {
            let _ = tx.send((JSON, body.clone()));
        }
    }

    fn start(self: &Arc<Self>, client: u64, a: StartArgs) -> Result<Value, String> {
        if self.sessions.lock().unwrap().contains_key(&a.id) {
            return Err("This pane already has a terminal.".into());
        }
        if !std::path::Path::new(&a.cwd).is_dir() {
            return Err(format!("This folder does not exist: {}", a.cwd));
        }
        let pair = native_pty_system().openpty(size(a.cols, a.rows)).map_err(|e| e.to_string())?;
        let mut cmd = CommandBuilder::new(&a.program);
        cmd.args(&a.args);
        cmd.cwd(&a.cwd);
        for (k, v) in &a.env {
            cmd.env(k, v);
        }
        for k in &a.env_remove {
            cmd.env_remove(k);
        }
        let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        drop(pair.slave);
        let killer = child.clone_killer();
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

        let mut subs = HashSet::new();
        subs.insert(client);
        self.sessions.lock().unwrap().insert(
            a.id.clone(),
            Sess {
                token: a.token,
                cwd: a.cwd,
                started: now_ms(),
                master: pair.master,
                writer: Arc::new(Mutex::new(writer)),
                killer,
                ring: VecDeque::new(),
                subs,
            },
        );

        let me = self.clone();
        let id = a.id.clone();
        std::thread::spawn(move || {
            let mut buf = vec![0u8; 64 * 1024];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => me.on_output(&id, &buf[..n]),
                }
            }
        });

        let me = self.clone();
        let id = a.id;
        std::thread::spawn(move || {
            let code = child.wait().ok().map(|s| s.exit_code());
            // Dropping the session closes the terminal, which also ends the reader above.
            me.sessions.lock().unwrap().remove(&id);
            me.broadcast(&json!({ "ev": "exit", "id": id, "code": code }));
            me.touch();
        });
        Ok(json!({}))
    }

    fn on_output(&self, id: &str, bytes: &[u8]) {
        let mut sessions = self.sessions.lock().unwrap();
        let Some(s) = sessions.get_mut(id) else { return };
        push_ring(&mut s.ring, bytes, KEEP_BYTES);
        if s.subs.is_empty() {
            return;
        }
        let body = wire::data_body(id, bytes);
        let clients = self.clients.lock().unwrap();
        for c in &s.subs {
            if let Some(tx) = clients.get(c) {
                let _ = tx.send((DATA, body.clone()));
            }
        }
    }

    /// Sends the saved output, then live output, to `client`. Both happen under one lock, so no bytes are lost between them.
    fn attach(&self, client: u64, id: &str) -> Result<Value, String> {
        let mut sessions = self.sessions.lock().unwrap();
        let s = sessions.get_mut(id).ok_or("This terminal is closed.")?;
        let saved: Vec<u8> = s.ring.iter().copied().collect();
        if !saved.is_empty() {
            self.send_to(client, DATA, wire::data_body(id, &saved));
        }
        s.subs.insert(client);
        Ok(json!({ "bytes": saved.len() }))
    }

    fn write(&self, id: &str, bytes: &[u8]) {
        let writer = self.sessions.lock().unwrap().get(id).map(|s| s.writer.clone());
        if let Some(w) = writer {
            let mut w = w.lock().unwrap();
            let _ = w.write_all(bytes).and_then(|_| w.flush());
        }
    }

    fn handle(self: &Arc<Self>, client: u64, v: &Value) -> Result<Value, String> {
        let op = v["op"].as_str().unwrap_or_default();
        let id = v["id"].as_str().unwrap_or_default();
        match op {
            "start" => {
                let a: StartArgs = serde_json::from_value(v.clone()).map_err(|e| e.to_string())?;
                self.start(client, a)
            }
            "attach" => self.attach(client, id),
            "detach" => {
                if let Some(s) = self.sessions.lock().unwrap().get_mut(id) {
                    s.subs.remove(&client);
                }
                Ok(json!({}))
            }
            "resize" => {
                let cols = v["cols"].as_u64().unwrap_or(80) as u16;
                let rows = v["rows"].as_u64().unwrap_or(24) as u16;
                let sessions = self.sessions.lock().unwrap();
                let s = sessions.get(id).ok_or("This terminal is closed.")?;
                s.master.resize(size(cols, rows)).map_err(|e| e.to_string())?;
                Ok(json!({}))
            }
            "kill" => {
                if let Some(s) = self.sessions.lock().unwrap().get_mut(id) {
                    let _ = s.killer.kill();
                }
                Ok(json!({}))
            }
            "killAll" => {
                for s in self.sessions.lock().unwrap().values_mut() {
                    let _ = s.killer.kill();
                }
                Ok(json!({}))
            }
            "list" => {
                let sessions = self.sessions.lock().unwrap();
                let list: Vec<Value> = sessions
                    .iter()
                    .map(|(id, s)| json!({ "id": id, "token": s.token, "cwd": s.cwd, "started": s.started }))
                    .collect();
                Ok(json!({ "sessions": list }))
            }
            _ => Err(format!("Unknown request: {op}")),
        }
    }

    fn touch(&self) {
        *self.last_busy.lock().unwrap() = Some(Instant::now());
    }

    fn idle_too_long(&self) -> bool {
        if !self.sessions.lock().unwrap().is_empty() || !self.clients.lock().unwrap().is_empty() {
            self.touch();
            return false;
        }
        self.last_busy.lock().unwrap().map(|t| t.elapsed() > IDLE_QUIT).unwrap_or(false)
    }

    fn drop_client(&self, client: u64) {
        self.clients.lock().unwrap().remove(&client);
        for s in self.sessions.lock().unwrap().values_mut() {
            s.subs.remove(&client);
        }
        self.touch();
    }
}

async fn serve_client(keeper: Arc<Keeper>, pipe: tokio::net::windows::named_pipe::NamedPipeServer, key: String) {
    let (mut rd, mut wr) = tokio::io::split(pipe);

    // The first frame must carry the key the app wrote to its data folder. Other programs get nothing.
    let Ok((JSON, first)) = wire::read_frame(&mut rd).await else { return };
    let Ok(hello) = serde_json::from_slice::<Value>(&first) else { return };
    if hello["op"] != "hello" || hello["key"].as_str() != Some(key.as_str()) {
        return;
    }

    let (tx, mut rx) = unbounded_channel::<(u8, Vec<u8>)>();
    let client = keeper.next_client.fetch_add(1, Ordering::Relaxed) + 1;
    keeper.clients.lock().unwrap().insert(client, tx.clone());
    let reply = json!({ "req": hello["req"], "ok": true, "proto": wire::PROTO, "pid": std::process::id() });
    let _ = tx.send((JSON, reply.to_string().into_bytes()));

    let writer = tokio::spawn(async move {
        while let Some((kind, body)) = rx.recv().await {
            if wire::write_frame(&mut wr, kind, &body).await.is_err() {
                break;
            }
        }
    });

    while let Ok((kind, body)) = wire::read_frame(&mut rd).await {
        if kind == DATA {
            if let Some((id, bytes)) = wire::split_data(&body) {
                keeper.write(id, bytes);
            }
            continue;
        }
        let Ok(v) = serde_json::from_slice::<Value>(&body) else { continue };
        let k = keeper.clone();
        // Starting a terminal can take a moment, so it runs off the pipe's own task.
        let result = tokio::task::spawn_blocking(move || k.handle(client, &v).map(|r| (v["req"].clone(), r)))
            .await
            .unwrap_or_else(|_| Err("The keeper hit a problem.".into()));
        let msg = match result {
            Ok((req, mut r)) => {
                if req.is_null() {
                    continue;
                }
                r["req"] = req;
                r["ok"] = json!(true);
                r
            }
            Err(e) => {
                let req = serde_json::from_slice::<Value>(&body).ok().map(|v| v["req"].clone()).unwrap_or(Value::Null);
                if req.is_null() {
                    continue;
                }
                json!({ "req": req, "ok": false, "error": e })
            }
        };
        let _ = tx.send((JSON, msg.to_string().into_bytes()));
    }

    keeper.drop_client(client);
    drop(tx);
    writer.abort();
}

/// Runs the keeper until it has been idle for a while. Returns the process exit code.
pub fn run() -> i32 {
    let key = std::env::var("SWITCHYARD_HOST_KEY").unwrap_or_default();
    std::env::remove_var("SWITCHYARD_HOST_KEY");
    if key.len() < 16 {
        return 2;
    }
    let rt = match tokio::runtime::Builder::new_multi_thread().worker_threads(2).enable_all().build() {
        Ok(rt) => rt,
        Err(_) => return 3,
    };
    rt.block_on(async move {
        let name = wire::pipe_name();
        // first_pipe_instance fails when a keeper already runs, so only one keeper serves this name.
        let Ok(mut server) = ServerOptions::new().first_pipe_instance(true).create(&name) else { return 0 };
        let keeper = Arc::new(Keeper::default());
        keeper.touch();

        let watch = keeper.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(5)).await;
                if watch.idle_too_long() {
                    std::process::exit(0);
                }
            }
        });

        loop {
            if server.connect().await.is_err() {
                continue;
            }
            let Ok(next) = ServerOptions::new().create(&name) else { return 4 };
            let conn = std::mem::replace(&mut server, next);
            tokio::spawn(serve_client(keeper.clone(), conn, key.clone()));
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ring_keeps_the_newest_bytes() {
        let mut r = VecDeque::new();
        push_ring(&mut r, b"aaaa", 10);
        push_ring(&mut r, b"bbbb", 10);
        assert_eq!(r.len(), 8);
        push_ring(&mut r, b"cccccc", 10);
        let s: Vec<u8> = r.iter().copied().collect();
        assert_eq!(s, b"bbbbcccccc");
    }

    #[test]
    fn ring_starts_after_a_line_break_once_trimmed() {
        let mut r = VecDeque::new();
        push_ring(&mut r, b"old line\nnew line\n", 12);
        let s: Vec<u8> = r.iter().copied().collect();
        assert_eq!(s, b"new line\n");
    }
}
