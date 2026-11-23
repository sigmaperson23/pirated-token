pub mod agents;
pub mod clip;
pub mod db;
pub mod files;
pub mod git;
pub mod host;
pub mod pty;
pub mod wire;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            let store = db::Store::open(&data.join("switchyard.sqlite3"))?;
            app.manage(db::Db::new(store, data.clone()));
            app.manage(pty::Terms::new(app.handle().clone(), pty::write_integration(&data)?, data.clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            agents::agents_detect,
            clip::clip_image_save,
            db::doc_get,
            db::doc_set,
            db::doc_delete,
            db::tasks_list,
            db::task_create,
            db::task_update,
            db::task_comments,
            db::task_comment_add,
            db::task_board_config,
            files::files_list,
            files::files_read,
            files::files_write,
            git::git_status,
            git::git_diff,
            git::git_stage,
            git::git_unstage,
            git::git_discard,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_merge,
            git::git_worktrees,
            git::git_worktree_add,
            git::git_worktree_remove,
            pty::term_start,
            pty::term_attach,
            pty::term_list,
            pty::term_keep_alive,
            pty::term_keeper,
            pty::term_write,
            pty::term_resize,
            pty::term_kill,
            pty::term_kill_all,
        ])
        .build(tauri::generate_context!())
        .expect("Switchyard could not start")
        .run(|handle, event| {
            if let tauri::RunEvent::Exit = event {
                handle.state::<pty::Terms>().on_quit();
            }
        });
}
