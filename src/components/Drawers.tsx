import { confirm } from '@tauri-apps/plugin-dialog';
import { useCallback, useEffect, useState } from 'react';
import { api, errorText, type Entry, type FileChange, type GitStatus, type Worktree } from '../lib/api';
import { dropFileOnPane, pasteToFocused, pathToFocused, startShell } from '../lib/actions';
import { pressToDrag } from '../lib/drag';
import { useHistory } from '../lib/useHistory';
import { slug } from '../lib/signals';
import { uid, useStore, type Prompt, type Tab } from '../store';
import { Field, Sheet } from './ui';

export function Drawers({ wsId, tab }: { wsId: string; tab?: Tab }) {
  const drawer = useStore((s) => s.drawer);
  const root = useStore((s) => s.workspaces.find((w) => w.id === wsId)?.root ?? '');
  const focusedCwd = useStore((s) => (tab?.focus ? s.panes[tab.focus]?.cwd : undefined));
  if (drawer === 'git') return <GitDrawer root={focusedCwd || root} wsRoot={root} tab={tab} />;
  if (drawer === 'files') return <FilesDrawer root={root} wsId={wsId} />;
  if (drawer === 'prompts') return <PromptsDrawer />;
  return null;
}

function GitDrawer({ root, wsRoot, tab }: { root: string; wsRoot: string; tab?: Tab }) {
  const toast = useStore((s) => s.setToast);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [message, setMessage] = useState('');
  const [diff, setDiff] = useState<{ title: string; text: string } | null>(null);
  const [newBranch, setNewBranch] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const st = await api.gitStatus(root);
      setStatus(st);
      setWorktrees(st.isRepo ? await api.gitWorktrees(root) : []);
    } catch (e) {
      toast(errorText(e));
    }
  }, [root, toast]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [refresh]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(errorText(e));
    }
    setBusy(false);
    void refresh();
  }

  if (!status) return <h2 className="drawer-title">Git</h2>;
  if (!status.isRepo) {
    return (
      <div className="drawer-body">
        <h2 className="drawer-title">Git</h2>
        <p className="muted">This folder is not a Git repository.</p>
      </div>
    );
  }
  const staged = status.files.filter((f) => f.staged !== ' ' && f.staged !== '?');
  const unstaged = status.files.filter((f) => f.unstaged !== ' ');
  const untracked = (f: FileChange) => f.staged === '?';

  const openDiff = async (f: FileChange, isStaged: boolean) => {
    try {
      setDiff({ title: f.path, text: await api.gitDiff(root, f.path, isStaged, untracked(f)) });
    } catch (e) {
      toast(errorText(e));
    }
  };

  return (
    <div className="drawer-body">
      <div className="drawer-row">
        <h2 className="drawer-title">{status.branch || 'Git'}</h2>
        <span className="muted small">
          {status.ahead > 0 && `${status.ahead} to push `}
          {status.behind > 0 && `${status.behind} to pull`}
        </span>
        <span className="grow" />
        <button className="text-btn" disabled={busy} onClick={() => void act(() => api.gitPull(root))}>
          Pull
        </button>
        <button className="text-btn" disabled={busy} onClick={() => void act(() => api.gitPush(root))}>
          Push
        </button>
      </div>

      {status.files.length === 0 && <p className="muted">No changes.</p>}

      {staged.length > 0 && (
        <>
          <h3>Staged</h3>
          {staged.map((f) => (
            <div key={`s${f.path}`} className="file-row">
              <button className="file-name truncate" onClick={() => void openDiff(f, true)} title={f.path}>
                <b>{f.staged}</b> {f.path}
              </button>
              <button className="text-btn" onClick={() => void act(() => api.gitUnstage(root, [f.path]))}>
                Unstage
              </button>
            </div>
          ))}
        </>
      )}

      {unstaged.length > 0 && (
        <>
          <div className="drawer-row">
            <h3>Changes</h3>
            <span className="grow" />
            <button className="text-btn" onClick={() => void act(() => api.gitStage(root, unstaged.map((f) => f.path)))}>
              Stage all
            </button>
          </div>
          {unstaged.map((f) => (
            <div key={`u${f.path}`} className="file-row">
              <button className="file-name truncate" onClick={() => void openDiff(f, false)} title={f.path}>
                <b>{f.unstaged === '?' ? 'U' : f.unstaged}</b> {f.path}
              </button>
              <button
                className="text-btn"
                onClick={async () => {
                  if (await confirm(`Throw away your changes to ${f.path}?`, { title: 'Discard', kind: 'warning' })) {
                    void act(() => api.gitDiscard(root, f.path, untracked(f)));
                  }
                }}
              >
                Discard
              </button>
              <button className="text-btn" onClick={() => void act(() => api.gitStage(root, [f.path]))}>
                Stage
              </button>
            </div>
          ))}
        </>
      )}

      {staged.length > 0 && (
        <div className="commit">
          <textarea rows={2} placeholder="Commit message" value={message} onChange={(e) => setMessage(e.target.value)} />
          <button
            className="btn"
            disabled={!message.trim() || busy}
            onClick={() =>
              void act(async () => {
                await api.gitCommit(root, message);
                setMessage('');
              })
            }
          >
            Commit
          </button>
        </div>
      )}

      <div className="drawer-row">
        <h3>Worktrees</h3>
        <span className="grow" />
        <button className="text-btn" onClick={() => setNewBranch('')}>
          New
        </button>
      </div>
      {worktrees.map((w) => (
        <div key={w.path} className="file-row">
          <span className="file-name truncate" title={w.path}>
            {w.branch}
          </span>
          <button
            className="text-btn"
            onClick={() => {
              const s = useStore.getState();
              if (!tab) return;
              const id = s.split(tab.focus, 'row', { cwd: w.path });
              startShell(id, undefined, w.branch);
            }}
          >
            Open
          </button>
          {!w.isMain && (
            <button
              className="text-btn"
              onClick={async () => {
                if (await confirm(`Remove the worktree for ${w.branch}? Its branch stays.`, { title: 'Remove worktree', kind: 'warning' })) {
                  void act(() => api.gitWorktreeRemove(wsRoot, w.path, false));
                }
              }}
            >
              Remove
            </button>
          )}
        </div>
      ))}

      {newBranch !== null && (
        <Sheet title="New worktree" onClose={() => setNewBranch(null)}>
          <Field label="Branch name">
            <input autoFocus value={newBranch} onChange={(e) => setNewBranch(e.target.value)} />
          </Field>
          <div className="row end">
            <button className="btn-quiet" onClick={() => setNewBranch(null)}>
              Cancel
            </button>
            <button
              className="btn"
              disabled={!slug(newBranch)}
              onClick={() => {
                const name = newBranch.trim();
                setNewBranch(null);
                void act(() => api.gitWorktreeAdd(wsRoot, name));
              }}
            >
              Create
            </button>
          </div>
        </Sheet>
      )}

      {diff && (
        <Sheet title={diff.title} onClose={() => setDiff(null)} wide>
          <DiffText text={diff.text} />
        </Sheet>
      )}
    </div>
  );
}

function DiffText({ text }: { text: string }) {
  if (!text.trim()) return <p className="muted">No text changes to show.</p>;
  return (
    <pre className="diff">
      {text.split('\n').map((line, i) => {
        const kind = line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : line.startsWith('@@') ? 'hunk' : '';
        return (
          <div key={i} className={kind}>
            {line || ' '}
          </div>
        );
      })}
    </pre>
  );
}

function FilesDrawer({ root, wsId }: { root: string; wsId: string }) {
  const toast = useStore((s) => s.setToast);
  const [open, setOpen] = useState<{ path: string; text: string; saved: string; modified: number } | null>(null);

  async function openFile(path: string) {
    try {
      const f = await api.filesRead(root, path);
      setOpen({ path, text: f.text, saved: f.text, modified: f.modified });
    } catch (e) {
      toast(errorText(e));
    }
  }
  async function save() {
    if (!open) return;
    try {
      const modified = await api.filesWrite(root, open.path, open.text, open.modified);
      setOpen({ ...open, saved: open.text, modified });
    } catch (e) {
      toast(errorText(e));
    }
  }

  if (open) {
    const dirty = open.text !== open.saved;
    return (
      <div className="drawer-body editor">
        <div className="drawer-row">
          <button className="text-btn" onClick={() => setOpen(null)}>
            Back
          </button>
          <span className="truncate small grow" title={open.path}>
            {open.path}
          </span>
          <button className="text-btn" onClick={() => pathToFocused(open.path)}>
            Paste path
          </button>
          <button className="text-btn" disabled={!dirty} onClick={() => void save()}>
            {dirty ? 'Save' : 'Saved'}
          </button>
        </div>
        <FileText
          key={open.path}
          text={open.text}
          onText={(text) => setOpen((o) => (o ? { ...o, text } : o))}
          onSave={() => void save()}
        />
      </div>
    );
  }
  return (
    <div className="drawer-body">
      <h2 className="drawer-title">Files</h2>
      <Folder root={root} wsId={wsId} rel="" depth={0} onOpen={(p) => void openFile(p)} />
    </div>
  );
}

/** The file editor's text box, with Switchyard's undo and redo. */
function FileText({ text, onText, onSave }: { text: string; onText: (t: string) => void; onSave: () => void }) {
  const history = useHistory(text, onText);
  return (
    <textarea
      spellCheck={false}
      value={text}
      {...history}
      onChange={(e) => onText(e.target.value)}
      onKeyDown={(e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSave();
          return;
        }
        history.onKeyDown(e);
      }}
    />
  );
}

function Folder({ root, wsId, rel, depth, onOpen }: { root: string; wsId: string; rel: string; depth: number; onOpen: (path: string) => void }) {
  const toast = useStore((s) => s.setToast);
  const [items, setItems] = useState<Entry[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    api.filesList(root, rel).then(setItems).catch((e) => toast(errorText(e)));
  }, [root, rel, toast]);
  if (!items) return null;
  return (
    <>
      {items.map((e) => (
        <div key={e.path}>
          <button
            className={`tree-row ${e.isDir ? 'is-dir' : ''}`}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => (e.isDir ? setExpanded((x) => ({ ...x, [e.path]: !x[e.path] })) : onOpen(e.path))}
            onPointerDown={(p) => {
              // Drag an entry onto a terminal to type its path there.
              if (p.button !== 0) return;
              pressToDrag(
                p,
                { kind: 'file', wsId, relativePath: e.path, isDir: e.isDir, label: e.name },
                (hover, drag) => {
                  if (hover.paneId && drag.kind === 'file') dropFileOnPane(hover.paneId, drag);
                },
                true,
              );
            }}
            title="Click to open. Drag onto a terminal to type its path."
          >
            {e.name}
            {e.isDir && '/'}
          </button>
          {e.isDir && expanded[e.path] && <Folder root={root} wsId={wsId} rel={e.path} depth={depth + 1} onOpen={onOpen} />}
        </div>
      ))}
    </>
  );
}

function PromptsDrawer() {
  const prompts = useStore((s) => s.prompts);
  const setPrompts = useStore((s) => s.setPrompts);
  const [edit, setEdit] = useState<Prompt | null>(null);
  return (
    <div className="drawer-body">
      <div className="drawer-row">
        <h2 className="drawer-title">Prompts</h2>
        <span className="grow" />
        <button className="text-btn" onClick={() => setEdit({ id: uid(), title: '', text: '' })}>
          New
        </button>
      </div>
      {prompts.length === 0 && <p className="muted">No prompts yet.</p>}
      {prompts.map((p) => (
        <div key={p.id} className="prompt-row">
          <button className="file-name truncate" onClick={() => setEdit(p)} title={p.text}>
            {p.title}
          </button>
          <button className="text-btn" onClick={() => pasteToFocused(p.text, false)}>
            Paste
          </button>
          <button className="text-btn" onClick={() => pasteToFocused(p.text, true)}>
            Send
          </button>
        </div>
      ))}
      {edit && (
        <Sheet title={edit.title || 'New prompt'} onClose={() => setEdit(null)}>
          <Field label="Name">
            <input autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          </Field>
          <Field label="Prompt">
            <PromptText text={edit.text} onText={(text) => setEdit((x) => (x ? { ...x, text } : x))} />
          </Field>
          <div className="row end">
            {prompts.some((p) => p.id === edit.id) && (
              <button
                className="btn-quiet"
                onClick={() => {
                  setPrompts(prompts.filter((p) => p.id !== edit.id));
                  setEdit(null);
                }}
              >
                Delete
              </button>
            )}
            <button
              className="btn"
              disabled={!edit.title.trim() || !edit.text.trim()}
              onClick={() => {
                const others = prompts.filter((p) => p.id !== edit.id);
                setPrompts([...others, edit].sort((a, b) => a.title.localeCompare(b.title)));
                setEdit(null);
              }}
            >
              Save
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** The prompt editor's text box, with Switchyard's undo and redo. */
function PromptText({ text, onText }: { text: string; onText: (t: string) => void }) {
  const history = useHistory(text, onText);
  return <textarea rows={8} value={text} {...history} onChange={(e) => onText(e.target.value)} />;
}
