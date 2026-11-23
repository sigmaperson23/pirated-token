import { Channel, invoke } from '@tauri-apps/api/core';

export interface Task {
  id: string;
  workspace: string;
  title: string;
  body: string;
  status: TaskStatus;
  engine?: string | null;
  branch?: string | null;
  worktree?: string | null;
  archived: boolean;
  created: number;
  updated: number;
}
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
export type TaskPatch = Partial<Pick<Task, 'title' | 'body' | 'status' | 'engine' | 'branch' | 'worktree' | 'archived'>>;
export interface Comment {
  id: number;
  taskId: string;
  author: string;
  text: string;
  created: number;
}
export interface FileChange {
  path: string;
  staged: string;
  unstaged: string;
}
export interface GitStatus {
  isRepo: boolean;
  branch: string;
  ahead: number;
  behind: number;
  files: FileChange[];
}
export interface Worktree {
  path: string;
  branch: string;
  isMain: boolean;
}
export interface Entry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export interface LiveTerm {
  id: string;
  token: string;
  cwd: string;
  started: number;
}
export interface KeeperInfo {
  pid: number;
  sessions: number;
  keepAlive: boolean;
}

export const api = {
  detect: (commands: string[]) => invoke<Record<string, boolean>>('agents_detect', { commands }),

  docGet: async <T,>(key: string, fallback: T): Promise<T> => {
    const raw = await invoke<string | null>('doc_get', { key });
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  docSet: (key: string, value: unknown) => invoke<void>('doc_set', { key, json: JSON.stringify(value) }),
  docDelete: (key: string) => invoke<void>('doc_delete', { key }),

  tasks: (workspace: string) => invoke<Task[]>('tasks_list', { workspace }),
  taskCreate: (workspace: string, title: string, body: string) => invoke<Task>('task_create', { workspace, title, body }),
  taskUpdate: (id: string, patch: TaskPatch) => invoke<Task>('task_update', { id, patch }),
  taskComments: (id: string) => invoke<Comment[]>('task_comments', { id }),
  taskCommentAdd: (id: string, text: string) => invoke<Comment>('task_comment_add', { id, text }),
  taskBoardConfig: (workspace: string) => invoke<string>('task_board_config', { workspace }),

  filesList: (root: string, rel: string) => invoke<Entry[]>('files_list', { root, rel }),
  filesRead: (root: string, rel: string) => invoke<{ text: string; modified: number }>('files_read', { root, rel }),
  filesWrite: (root: string, rel: string, text: string, expectedModified: number | null) =>
    invoke<number>('files_write', { root, rel, text, expectedModified }),

  gitStatus: (root: string) => invoke<GitStatus>('git_status', { root }),
  gitDiff: (root: string, path: string, staged: boolean, untracked: boolean) =>
    invoke<string>('git_diff', { root, path, staged, untracked }),
  gitStage: (root: string, paths: string[]) => invoke<void>('git_stage', { root, paths }),
  gitUnstage: (root: string, paths: string[]) => invoke<void>('git_unstage', { root, paths }),
  gitDiscard: (root: string, path: string, untracked: boolean) => invoke<void>('git_discard', { root, path, untracked }),
  gitCommit: (root: string, message: string) => invoke<string>('git_commit', { root, message }),
  gitPush: (root: string) => invoke<string>('git_push', { root }),
  gitPull: (root: string) => invoke<string>('git_pull', { root }),
  gitMerge: (root: string, branch: string) => invoke<string>('git_merge', { root, branch }),
  gitWorktrees: (root: string) => invoke<Worktree[]>('git_worktrees', { root }),
  gitWorktreeAdd: (root: string, branch: string) => invoke<string>('git_worktree_add', { root, branch }),
  gitWorktreeRemove: (root: string, path: string, force: boolean) =>
    invoke<void>('git_worktree_remove', { root, path, force }),

  termStart: (args: {
    id: string;
    cwd: string;
    startup: string | null;
    token: string;
    cols: number;
    rows: number;
    onData: Channel<ArrayBuffer | number[]>;
  }) => invoke<void>('term_start', args),
  termAttach: (id: string, onData: Channel<ArrayBuffer | number[]>) => invoke<number>('term_attach', { id, onData }),
  termList: () => invoke<LiveTerm[]>('term_list'),
  termKeepAlive: (on: boolean) => invoke<void>('term_keep_alive', { on }),
  termKeeper: () => invoke<KeeperInfo>('term_keeper'),
  termWrite: (id: string, data: string) => invoke<void>('term_write', { id, data }),
  termResize: (id: string, cols: number, rows: number) => invoke<void>('term_resize', { id, cols, rows }),
  termKill: (id: string) => invoke<void>('term_kill', { id }),
  termKillAll: () => invoke<void>('term_kill_all'),

  /** Saves a pasted image and returns its full path. */
  clipImageSave: (bytes: Uint8Array, format: string) =>
    invoke<string>('clip_image_save', bytes, { headers: { 'x-format': format } }),
};

export function errorText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : 'Something went wrong.';
}
