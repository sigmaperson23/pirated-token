//! Task board for coding agents. A small MCP server that reads JSON-RPC lines on stdin.
//! Usage: switchyard-tasks --db <path> --workspace <folder>

use std::io::{self, BufRead, Write};
use std::path::PathBuf;

use serde_json::{json, Value};
use switchyard_lib::db::{Store, TaskPatch, STATUSES};

fn tools() -> Value {
    json!([
        {
            "name": "list_tasks",
            "description": "List the tasks on this workspace's board.",
            "inputSchema": { "type": "object", "properties": {
                "status": { "type": "string", "enum": STATUSES }
            }}
        },
        {
            "name": "create_task",
            "description": "Add a task to the board.",
            "inputSchema": { "type": "object", "required": ["title"], "properties": {
                "title": { "type": "string" },
                "body": { "type": "string" }
            }}
        },
        {
            "name": "update_task",
            "description": "Change a task's title, body or status.",
            "inputSchema": { "type": "object", "required": ["id"], "properties": {
                "id": { "type": "string" },
                "title": { "type": "string" },
                "body": { "type": "string" },
                "status": { "type": "string", "enum": STATUSES }
            }}
        },
        {
            "name": "add_comment",
            "description": "Add a progress note to a task.",
            "inputSchema": { "type": "object", "required": ["id", "text"], "properties": {
                "id": { "type": "string" },
                "text": { "type": "string" }
            }}
        }
    ])
}

fn text(args: &Value, key: &str) -> Option<String> {
    args.get(key).and_then(Value::as_str).map(str::to_string)
}

fn need(args: &Value, key: &str) -> Result<String, String> {
    text(args, key).ok_or_else(|| format!("{key} is required."))
}

fn call(store: &Store, workspace: &str, name: &str, args: &Value) -> Result<Value, String> {
    let e = |e: rusqlite::Error| e.to_string();
    match name {
        "list_tasks" => {
            let status = text(args, "status");
            let tasks = store.tasks_list(Some(workspace), false).map_err(e)?;
            let tasks: Vec<_> =
                tasks.into_iter().filter(|t| status.as_ref().is_none_or(|s| &t.status == s)).collect();
            serde_json::to_value(tasks).map_err(|e| e.to_string())
        }
        "create_task" => {
            let body = text(args, "body").unwrap_or_default();
            let task = store.task_create(workspace, &need(args, "title")?, &body).map_err(e)?;
            serde_json::to_value(task).map_err(|e| e.to_string())
        }
        "update_task" => {
            let patch = TaskPatch {
                title: text(args, "title"),
                body: text(args, "body"),
                status: text(args, "status"),
                ..Default::default()
            };
            let task = store.task_update(&need(args, "id")?, &patch)?;
            serde_json::to_value(task).map_err(|e| e.to_string())
        }
        "add_comment" => {
            let c = store.comment_add(&need(args, "id")?, "Agent", &need(args, "text")?)?;
            serde_json::to_value(c).map_err(|e| e.to_string())
        }
        other => Err(format!("Unknown tool: {other}")),
    }
}

fn handle(store: &Store, workspace: &str, msg: &Value) -> Option<Value> {
    let id = msg.get("id")?.clone();
    let method = msg.get("method").and_then(Value::as_str).unwrap_or("");
    let params = msg.get("params").cloned().unwrap_or(Value::Null);
    let result = match method {
        "initialize" => json!({
            "protocolVersion": params.get("protocolVersion").cloned().unwrap_or(json!("2025-06-18")),
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "switchyard-tasks", "version": env!("CARGO_PKG_VERSION") }
        }),
        "ping" => json!({}),
        "tools/list" => json!({ "tools": tools() }),
        "tools/call" => {
            let name = params.get("name").and_then(Value::as_str).unwrap_or("");
            let empty = json!({});
            let args = params.get("arguments").unwrap_or(&empty);
            match call(store, workspace, name, args) {
                Ok(v) => json!({ "content": [{ "type": "text", "text": v.to_string() }] }),
                Err(err) => json!({ "content": [{ "type": "text", "text": err }], "isError": true }),
            }
        }
        _ => {
            return Some(json!({
                "jsonrpc": "2.0", "id": id,
                "error": { "code": -32601, "message": format!("Unknown method: {method}") }
            }))
        }
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut db_path: Option<PathBuf> = None;
    let mut workspace: Option<String> = None;
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--db" => db_path = args.next().map(PathBuf::from),
            "--workspace" => workspace = args.next(),
            _ => {}
        }
    }
    let db_path = db_path.ok_or("--db is required")?;
    let workspace = match workspace {
        Some(w) => w,
        None => std::env::current_dir()?.to_string_lossy().into_owned(),
    };
    let store = Store::open(&db_path)?;

    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let reply = match serde_json::from_str::<Value>(&line) {
            Ok(msg) => handle(&store, &workspace, &msg),
            Err(e) => Some(json!({
                "jsonrpc": "2.0", "id": null,
                "error": { "code": -32700, "message": e.to_string() }
            })),
        };
        if let Some(reply) = reply {
            writeln!(stdout, "{reply}")?;
            stdout.flush()?;
        }
    }
    Ok(())
}
