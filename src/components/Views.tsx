import { useCallback, useEffect, useState } from 'react';
import { api, errorText, type Comment, type KeeperInfo, type Task, type TaskStatus } from '../lib/api';
import { dispatchTask, installEngine, launchLineup, mergeTask, refreshInstalled, reviewTask, runRoutine, startCrew } from '../lib/actions';
import { engineById, ENGINES } from '../lib/engines';
import { nextDaily } from '../lib/signals';
import { uid, useStore, type CrewMember, type Lineup, type Routine, type Seat } from '../store';
import { Field, Lamp, Sheet, timeAgo } from './ui';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'Doing' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

function useReadyEngines() {
  const installed = useStore((s) => s.installed);
  return ENGINES.filter((e) => installed[e.command]);
}

export function BoardView() {
  const ws = useStore((s) => s.workspaces.find((w) => w.id === s.activeWs));
  const toast = useStore((s) => s.setToast);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState<string | null>(null);
  const root = ws?.root;

  const refresh = useCallback(() => {
    if (root) api.tasks(root).then(setTasks).catch((e) => toast(errorText(e)));
  }, [root, toast]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!ws || !root) return <EmptyView text="Add a folder to start a board." title="Board" />;

  const open = tasks.find((t) => t.id === openId);
  const move = (id: string, status: TaskStatus) => {
    api.taskUpdate(id, { status }).then(refresh).catch((e) => toast(errorText(e)));
  };

  return (
    <div className="view">
      <div className="view-head">
        <h1>{ws.name} board</h1>
        <span className="grow" />
        <button
          className="text-btn"
          onClick={() => api.taskBoardConfig(root).then(setShowConfig).catch((e) => toast(errorText(e)))}
        >
          Connect agents
        </button>
      </div>
      <form
        className="new-task"
        onSubmit={(e) => {
          e.preventDefault();
          const title = newTitle.trim();
          if (!title) return;
          setNewTitle('');
          api.taskCreate(root, title, '').then(refresh).catch((err) => toast(errorText(err)));
        }}
      >
        <input placeholder="New task" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
      </form>
      <div className="board">
        {COLUMNS.map((c) => (
          <section
            key={c.status}
            className={`column column-${c.status}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/task');
              if (id) move(id, c.status);
            }}
          >
            <h3>
              {c.label} <span className="muted">{tasks.filter((t) => t.status === c.status).length}</span>
            </h3>
            {tasks
              .filter((t) => t.status === c.status)
              .map((t) => (
                <button
                  key={t.id}
                  className="task"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/task', t.id)}
                  onClick={() => setOpenId(t.id)}
                >
                  <span>{t.title}</span>
                  {t.branch && <small className="truncate">{t.branch}</small>}
                </button>
              ))}
          </section>
        ))}
      </div>
      {open && <TaskSheet task={open} onClose={() => setOpenId(null)} refresh={refresh} />}
      {showConfig && (
        <Sheet title="Connect agents" onClose={() => setShowConfig(null)} wide>
          <p className="muted">Add this to a coding tool's MCP settings. It can then read and change this board.</p>
          <pre className="diff">{showConfig}</pre>
          <div className="row end">
            <button
              className="btn"
              onClick={() => {
                void navigator.clipboard.writeText(showConfig);
                toast('Copied.');
              }}
            >
              Copy
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function TaskSheet({ task, onClose, refresh }: { task: Task; onClose: () => void; refresh: () => void }) {
  const toast = useStore((s) => s.setToast);
  const ready = useReadyEngines();
  const [title, setTitle] = useState(task.title);
  const [body, setBody] = useState(task.body);
  const [engine, setEngine] = useState(task.engine ?? ready[0]?.id ?? '');
  const [comments, setComments] = useState<Comment[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    api.taskComments(task.id).then(setComments).catch(() => undefined);
  }, [task.id]);

  const saveText = async () => {
    if (title.trim() && (title !== task.title || body !== task.body)) {
      await api.taskUpdate(task.id, { title: title.trim(), body }).catch((e) => toast(errorText(e)));
    }
  };

  return (
    <Sheet title="Task" onClose={onClose} wide>
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => void saveText().then(refresh)} />
      </Field>
      <Field label="Details">
        <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => void saveText().then(refresh)} />
      </Field>
      {task.branch && <p className="muted small">Branch: {task.branch}</p>}

      {comments.map((c) => (
        <p key={c.id} className="comment">
          <b>{c.author}</b> {c.text} <span className="muted small">{timeAgo(c.created)}</span>
        </p>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          api
            .taskCommentAdd(task.id, note.trim())
            .then((c) => setComments((x) => [...x, c]))
            .catch((err) => toast(errorText(err)));
          setNote('');
        }}
      >
        <input placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} />
      </form>

      <div className="row end">
        <button
          className="btn-quiet"
          onClick={() => {
            api.taskUpdate(task.id, { archived: true }).then(refresh).catch((e) => toast(errorText(e)));
            onClose();
          }}
        >
          Archive
        </button>
        <span className="grow" />
        {(task.status === 'review' || task.status === 'doing') && task.engine && (
          <button
            className="btn-quiet"
            onClick={() => {
              reviewTask(task);
              onClose();
            }}
          >
            Second review
          </button>
        )}
        {task.status === 'review' && (
          <button
            className="btn"
            onClick={() => {
              void mergeTask(task).then((ok) => {
                refresh();
                if (ok) onClose();
              });
            }}
          >
            {task.branch ? 'Merge' : 'Mark done'}
          </button>
        )}
        {task.status === 'todo' && (
          <>
            <select value={engine} onChange={(e) => setEngine(e.target.value)} aria-label="Coding tool">
              {ready.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={!engine}
              onClick={async () => {
                await saveText();
                onClose();
                await dispatchTask({ ...task, title: title.trim() || task.title, body }, engine);
                refresh();
              }}
            >
              Send to agent
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function CrewView() {
  const crew = useStore((s) => s.crew);
  const setCrew = useStore((s) => s.setCrew);
  const activeWs = useStore((s) => s.activeWs);
  const ready = useReadyEngines();
  const [edit, setEdit] = useState<CrewMember | null>(null);

  function launch(c: CrewMember) {
    const s = useStore.getState();
    if (!activeWs) {
      s.setToast('Add a folder first.');
      return;
    }
    const id = s.newTab(activeWs);
    startCrew(id, c);
    s.jumpToPane(id);
  }

  return (
    <div className="view narrow">
      <div className="view-head">
        <h1>Crew</h1>
        <span className="grow" />
        <button className="btn" onClick={() => setEdit({ id: uid(), name: '', engine: ready[0]?.id ?? 'claude', purpose: '', memory: '' })}>
          Add someone
        </button>
      </div>
      {crew.length === 0 && <p className="muted">No crew yet.</p>}
      {crew.map((c) => (
        <div key={c.id} className="list-row">
          <button className="list-main" onClick={() => setEdit(c)}>
            <b>{c.name}</b>
            <span className="muted">{engineById(c.engine)?.name}</span>
          </button>
          <button className="text-btn" onClick={() => launch(c)}>
            Start
          </button>
        </div>
      ))}
      {edit && (
        <Sheet title={edit.name || 'New crew member'} onClose={() => setEdit(null)} wide>
          <Field label="Name">
            <input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </Field>
          <Field label="Coding tool">
            <select value={edit.engine} onChange={(e) => setEdit({ ...edit, engine: e.target.value })}>
              {ENGINES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Job">
            <textarea rows={4} value={edit.purpose} onChange={(e) => setEdit({ ...edit, purpose: e.target.value })} />
          </Field>
          <Field label="Memory">
            <textarea rows={6} value={edit.memory} onChange={(e) => setEdit({ ...edit, memory: e.target.value })} />
          </Field>
          <div className="row end">
            {crew.some((c) => c.id === edit.id) && (
              <button
                className="btn-quiet"
                onClick={() => {
                  setCrew(crew.filter((c) => c.id !== edit.id));
                  setEdit(null);
                }}
              >
                Delete
              </button>
            )}
            <button
              className="btn"
              disabled={!edit.name.trim()}
              onClick={() => {
                setCrew([...crew.filter((c) => c.id !== edit.id), edit]);
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

export function LineupsView() {
  const lineups = useStore((s) => s.lineups);
  const setLineups = useStore((s) => s.setLineups);
  const activeWs = useStore((s) => s.activeWs);
  const ready = useReadyEngines();
  const [edit, setEdit] = useState<Lineup | null>(null);
  const firstEngine = ready[0]?.id ?? 'claude';

  const setSeat = (i: number, patch: Partial<Seat>) =>
    edit && setEdit({ ...edit, seats: edit.seats.map((s, n) => (n === i ? { ...s, ...patch } : s)) });

  return (
    <div className="view narrow">
      <div className="view-head">
        <h1>Lineups</h1>
        <span className="grow" />
        <button className="btn" onClick={() => setEdit({ id: uid(), name: '', seats: [{ kind: 'agent', engine: firstEngine }] })}>
          New lineup
        </button>
      </div>
      {lineups.length === 0 && <p className="muted">No lineups yet.</p>}
      {lineups.map((l) => (
        <div key={l.id} className="list-row">
          <button className="list-main" onClick={() => setEdit(l)}>
            <b>{l.name}</b>
            <span className="muted">
              {l.seats.length} {l.seats.length === 1 ? 'seat' : 'seats'}
            </span>
          </button>
          <button
            className="text-btn"
            disabled={!activeWs}
            onClick={() => activeWs && launchLineup(l, activeWs)}
          >
            Start
          </button>
        </div>
      ))}
      {edit && (
        <Sheet title={edit.name || 'New lineup'} onClose={() => setEdit(null)} wide>
          <Field label="Name">
            <input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </Field>
          {edit.seats.map((seat, i) => (
            <div key={i} className="seat">
              <select
                aria-label={`Seat ${i + 1}`}
                value={seat.kind === 'shell' ? '__shell' : seat.engine}
                onChange={(e) =>
                  e.target.value === '__shell'
                    ? setSeat(i, { kind: 'shell', engine: undefined, prompt: undefined })
                    : setSeat(i, { kind: 'agent', engine: e.target.value, command: undefined })
                }
              >
                {ENGINES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
                <option value="__shell">Shell command</option>
              </select>
              {seat.kind === 'shell' ? (
                <input placeholder="npm run dev" value={seat.command ?? ''} onChange={(e) => setSeat(i, { command: e.target.value })} />
              ) : (
                <input placeholder="Opening prompt" value={seat.prompt ?? ''} onChange={(e) => setSeat(i, { prompt: e.target.value })} />
              )}
              <button
                className="text-btn"
                onClick={() => setEdit({ ...edit, seats: edit.seats.filter((_, n) => n !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="text-btn"
            disabled={edit.seats.length >= 12}
            onClick={() => setEdit({ ...edit, seats: [...edit.seats, { kind: 'agent', engine: firstEngine }] })}
          >
            Add a seat
          </button>
          <div className="row end">
            {lineups.some((l) => l.id === edit.id) && (
              <button
                className="btn-quiet"
                onClick={() => {
                  setLineups(lineups.filter((l) => l.id !== edit.id));
                  setEdit(null);
                }}
              >
                Delete
              </button>
            )}
            <button
              className="btn"
              disabled={!edit.name.trim() || edit.seats.length === 0}
              onClick={() => {
                setLineups([...lineups.filter((l) => l.id !== edit.id), edit]);
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

export function RoutinesView() {
  const routines = useStore((s) => s.routines);
  const setRoutines = useStore((s) => s.setRoutines);
  const workspaces = useStore((s) => s.workspaces);
  const activeWs = useStore((s) => s.activeWs);
  const ready = useReadyEngines();
  const [edit, setEdit] = useState<Routine | null>(null);

  const save = (r: Routine) => setRoutines([...routines.filter((x) => x.id !== r.id), r]);

  return (
    <div className="view narrow">
      <div className="view-head">
        <h1>Routines</h1>
        <span className="grow" />
        <button
          className="btn"
          disabled={!activeWs}
          onClick={() =>
            setEdit({ id: uid(), name: '', wsId: activeWs!, engine: ready[0]?.id ?? 'claude', prompt: '', time: '09:00', enabled: true, nextRun: 0 })
          }
        >
          New routine
        </button>
      </div>
      {routines.length === 0 && <p className="muted">No routines yet.</p>}
      {routines.map((r) => (
        <div key={r.id} className="list-row">
          <button className="list-main" onClick={() => setEdit(r)}>
            <b>{r.name}</b>
            <span className="muted">
              {r.enabled ? `Daily at ${r.time}` : 'Paused'} in {workspaces.find((w) => w.id === r.wsId)?.name ?? 'a removed folder'}
            </span>
          </button>
          <button className="text-btn" onClick={() => save({ ...r, enabled: !r.enabled, nextRun: nextDaily(r.time, new Date()).getTime() })}>
            {r.enabled ? 'Pause' : 'Resume'}
          </button>
          <button
            className="text-btn"
            onClick={() => {
              runRoutine(r);
              useStore.getState().setView('yard');
            }}
          >
            Run now
          </button>
        </div>
      ))}
      {edit && (
        <Sheet title={edit.name || 'New routine'} onClose={() => setEdit(null)} wide>
          <Field label="Name">
            <input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </Field>
          <div className="row">
            <Field label="Folder">
              <select value={edit.wsId} onChange={(e) => setEdit({ ...edit, wsId: e.target.value })}>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Coding tool">
              <select value={edit.engine} onChange={(e) => setEdit({ ...edit, engine: e.target.value })}>
                {ENGINES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Time each day">
              <input type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} />
            </Field>
          </div>
          <Field label="Prompt">
            <textarea rows={6} value={edit.prompt} onChange={(e) => setEdit({ ...edit, prompt: e.target.value })} />
          </Field>
          <p className="muted small">Routines run only while Switchyard is open.</p>
          <div className="row end">
            {routines.some((r) => r.id === edit.id) && (
              <button
                className="btn-quiet"
                onClick={() => {
                  setRoutines(routines.filter((r) => r.id !== edit.id));
                  setEdit(null);
                }}
              >
                Delete
              </button>
            )}
            <button
              className="btn"
              disabled={!edit.name.trim() || !edit.prompt.trim() || !edit.time}
              onClick={() => {
                save({ ...edit, nextRun: nextDaily(edit.time, new Date()).getTime() });
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

export function ActivityView() {
  const activity = useStore((s) => s.activity);
  const jump = useStore((s) => s.jumpToPane);
  const panes = useStore((s) => s.panes);
  return (
    <div className="view narrow">
      <div className="view-head">
        <h1>Activity</h1>
      </div>
      {activity.length === 0 && <p className="muted">Nothing yet.</p>}
      {activity.map((a) => (
        <button
          key={a.id}
          className="activity-row"
          disabled={!a.paneId || !panes[a.paneId]}
          onClick={() => a.paneId && jump(a.paneId)}
        >
          <Lamp signal={a.signal} />
          <span className="grow truncate">{a.title}</span>
          <span className="muted small">{timeAgo(a.time)}</span>
        </button>
      ))}
    </div>
  );
}

export function AgentsView() {
  const installed = useStore((s) => s.installed);
  return (
    <div className="view narrow">
      <div className="view-head">
        <h1>Coding tools</h1>
        <span className="grow" />
        <button className="text-btn" onClick={refreshInstalled}>
          Check again
        </button>
      </div>
      {ENGINES.map((e) => (
        <div key={e.id} className="list-row">
          <div className="list-main static">
            <b>{e.name}</b>
            <code className="muted">{installed[e.command] ? e.command : e.install}</code>
          </div>
          {installed[e.command] ? (
            <span className="muted small">Installed</span>
          ) : (
            <button className="text-btn" onClick={() => installEngine(e.id)}>
              Install
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function EmptyView({ title, text }: { title: string; text: string }) {
  return (
    <div className="view narrow">
      <div className="view-head">
        <h1>{title}</h1>
      </div>
      <p className="muted">{text}</p>
    </div>
  );
}

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [keeper, setKeeper] = useState<KeeperInfo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const read = () =>
      api
        .termKeeper()
        .then((k) => alive && (setKeeper(k), setProblem(null)))
        .catch((e) => alive && setProblem(errorText(e)));
    void read();
    const t = setInterval(read, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="view narrow">
      <div className="view-head">
        <h1>Settings</h1>
      </div>
      <div className="list-row">
        <div className="list-main static">
          <b>Keep terminals running after Switchyard closes</b>
          <span className="muted">
            Shells and agents carry on in the background. When Switchyard opens again, each pane picks up where it was.
          </span>
        </div>
        <button className="text-btn" onClick={() => setSettings({ keepTerminals: !settings.keepTerminals })}>
          {settings.keepTerminals ? 'On' : 'Off'}
        </button>
      </div>
      <div className="list-row">
        <div className="list-main static">
          <b>Terminal keeper</b>
          <span className="muted">
            {problem
              ? problem
              : keeper
                ? `Running as process ${keeper.pid}, holding ${keeper.sessions} terminal${keeper.sessions === 1 ? '' : 's'}.`
                : 'Checking...'}
          </span>
        </div>
      </div>
    </div>
  );
}
