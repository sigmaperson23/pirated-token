import { confirm } from '@tauri-apps/plugin-dialog';
import { api, errorText, type Task } from './api';
import { engineById } from './engines';
import { paneIds } from './layout';
import { dropPaths, dropText, isSafeRelative, quotePath } from './clipboard';
import type { Payload } from './drag';
import { nextDaily, slug } from './signals';
import { destroy, insertPrompt, reset, sendText, typeIn } from './terminals';
import { useStore, type CrewMember, type Lineup, type Pane, type Routine, type Seat } from '../store';

const store = () => useStore.getState();
const say = (e: unknown) => store().setToast(errorText(e));

export function refreshInstalled() {
  const commands = ['claude', 'codex', 'opencode', 'grok', 'gemini', 'copilot', 'cursor-agent', 'aider', 'kimi', 'droid', 'amp'];
  void api.detect(commands).then(store().setInstalled).catch(say);
}

interface AgentOptions {
  prompt?: string;
  resume?: boolean;
  title?: string;
  cwd?: string;
  taskId?: string;
}

export function startAgent(paneId: string, engineId: string, o: AgentOptions = {}) {
  const engine = engineById(engineId);
  if (!engine) return;
  reset(paneId);
  store().patchPane(paneId, {
    kind: 'agent',
    engine: engineId,
    title: o.title ?? engine.name,
    startup: o.resume && engine.resume ? engine.resume : engine.command,
    prompt: o.prompt,
    taskId: o.taskId,
    asleep: false,
    note: undefined,
    signal: 'off',
    ...(o.cwd ? { cwd: o.cwd } : {}),
  });
}

export function startShell(paneId: string, command?: string, title?: string) {
  reset(paneId);
  store().patchPane(paneId, {
    kind: 'shell',
    engine: undefined,
    title: title ?? (command ? command.split(' ')[0] : 'Shell'),
    startup: command,
    asleep: false,
    note: undefined,
    signal: 'off',
  });
}

/** Opens a shell with the install command typed in. You read it and press Enter. */
export function installEngine(engineId: string) {
  const engine = engineById(engineId);
  const ws = store().activeWs;
  if (!engine) return;
  if (!ws) {
    store().setToast('Add a folder first.');
    return;
  }
  const id = store().newTab(ws, { kind: 'shell', title: `Install ${engine.name}`, draft: engine.install });
  store().selectWorkspace(ws);
  store().jumpToPane(id);
}

export function crewPrompt(c: CrewMember): string {
  const parts = [`Your name is ${c.name}.`, c.purpose.trim()];
  if (c.memory.trim()) parts.push(`Notes from your earlier work:\n${c.memory.trim()}`);
  parts.push('Say hello in one line, then wait for my first request.');
  return parts.filter(Boolean).join('\n\n');
}

export function startCrew(paneId: string, c: CrewMember) {
  startAgent(paneId, c.engine, { title: c.name, prompt: crewPrompt(c) });
}

function seatToPane(s: Seat): Partial<Pane> {
  if (s.kind === 'agent' && s.engine) {
    const engine = engineById(s.engine);
    return { kind: 'agent', engine: s.engine, title: engine?.name ?? s.engine, startup: engine?.command, prompt: s.prompt };
  }
  return { kind: 'shell', title: s.command ? s.command.split(' ')[0] : 'Shell', startup: s.command };
}

export function launchLineup(l: Lineup, wsId: string) {
  if (l.seats.length === 0) return;
  store().addLineupTab(wsId, l.name, l.seats.map(seatToPane));
}

export async function closePane(paneId: string) {
  const p = store().panes[paneId];
  if (!p) return;
  const busy = p.signal === 'working' || p.signal === 'needs';
  if (busy && !(await confirm(`${p.title} is still running. Close it?`, { title: 'Close pane', kind: 'warning' }))) return;
  destroy(paneId);
  store().closePane(paneId);
}

export async function closeTab(wsId: string, tabId: string) {
  const tab = (store().tabs[wsId] ?? []).find((t) => t.id === tabId);
  if (!tab) return;
  const ids = paneIds(tab.tree);
  const running = ids.filter((id) => store().panes[id]?.signal === 'working').length;
  if (running > 0 && !(await confirm(`${running} running in this track. Close it?`, { title: 'Close track', kind: 'warning' }))) return;
  ids.forEach(destroy);
  store().closeTab(wsId, tabId);
}

export async function removeWorkspace(wsId: string) {
  const s = store();
  const ws = s.workspaces.find((w) => w.id === wsId);
  if (!ws) return;
  const ok = await confirm(`Remove ${ws.name} from the list? Its files stay on disk. Its terminals close.`, {
    title: 'Remove folder',
    kind: 'warning',
  });
  if (!ok) return;
  (s.tabs[wsId] ?? []).flatMap((t) => paneIds(t.tree)).forEach(destroy);
  s.removeWorkspace(wsId);
}

function focusedTerminal() {
  const s = store();
  const ws = s.activeWs;
  if (!ws) return null;
  const tab = (s.tabs[ws] ?? []).find((t) => t.id === s.activeTab[ws]);
  const target = tab?.focus ? s.panes[tab.focus] : undefined;
  if (!target || target.kind === 'empty' || target.asleep) {
    s.setToast('Open a terminal in the focused pane first.');
    return null;
  }
  return target;
}

/** Puts a saved prompt into the focused terminal. `send` also presses Enter. */
export function pasteToFocused(text: string, send: boolean) {
  const target = focusedTerminal();
  if (!target) return;
  if (send) {
    sendText(target.id, text);
    return;
  }
  const result = insertPrompt(target.id, text);
  if (result.kind === 'refused') {
    store().setToast(result.reason === 'empty' ? 'This prompt is empty.' : 'Start an agent in this pane to paste a prompt with several lines.');
  }
}

/** Types a path into the focused terminal, quoted when it has spaces. */
export function pathToFocused(path: string) {
  const target = focusedTerminal();
  if (target) typeIn(target.id, `${quotePath(path)} `);
}

function joinPath(root: string, rel: string) {
  const sep = root.includes('\\') ? '\\' : '/';
  return root.replace(/[\\/]+$/, '') + sep + rel.split('/').join(sep);
}

/** A Files drawer entry dropped on a pane: its full path is typed into that pane's terminal. */
export function dropFileOnPane(paneId: string, drag: Extract<Payload, { kind: 'file' }>) {
  const s = store();
  const pane = s.panes[paneId];
  const ws = s.workspaces.find((w) => w.id === drag.wsId);
  if (!pane || !ws || pane.kind === 'empty' || pane.asleep || !isSafeRelative(drag.relativePath)) return;
  s.focusPane(paneId);
  typeIn(paneId, `${quotePath(joinPath(ws.root, drag.relativePath))} `);
}

/** Files dropped from the computer onto a pane: their paths are typed into its terminal. */
export function dropPathsOnPane(paneId: string, paths: string[]) {
  const s = store();
  const pane = s.panes[paneId];
  if (!pane || pane.kind === 'empty' || pane.asleep) return;
  const ok = dropPaths(paths);
  if (!ok) {
    s.setToast('Drop between 1 and 20 files at a time.');
    return;
  }
  s.focusPane(paneId);
  typeIn(paneId, dropText(ok));
}

export async function dispatchTask(task: Task, engineId: string) {
  const s = store();
  const ws = s.workspaces.find((w) => w.root === task.workspace);
  const engine = engineById(engineId);
  if (!ws || !engine) {
    s.setToast('This task belongs to a folder that is no longer listed.');
    return;
  }
  try {
    const status = await api.gitStatus(ws.root);
    let cwd = ws.root;
    let branch: string | null = null;
    if (status.isRepo) {
      branch = `task/${slug(task.title) || 'work'}-${task.id.slice(-5)}`;
      cwd = await api.gitWorktreeAdd(ws.root, branch);
    }
    await api.taskUpdate(task.id, { status: 'doing', engine: engineId, branch, worktree: branch ? cwd : null });
    const lines = [`Task: ${task.title}`];
    if (task.body.trim()) lines.push(task.body.trim());
    lines.push(branch ? `You are in your own branch, ${branch}. Commit your work here when it is done.` : 'Tell me when it is done.');
    const paneId = store().newTab(ws.id);
    store().renameTab(ws.id, store().activeTab[ws.id], task.title.slice(0, 28));
    startAgent(paneId, engineId, { prompt: lines.join('\n\n'), cwd, title: `${engine.name}: ${task.title.slice(0, 24)}`, taskId: task.id });
    store().selectWorkspace(ws.id);
    store().jumpToPane(paneId);
  } catch (e) {
    say(e);
  }
}

export function reviewTask(task: Task) {
  const s = store();
  const ws = s.workspaces.find((w) => w.root === task.workspace);
  if (!ws || !task.engine) return;
  const paneId = s.newTab(ws.id);
  store().renameTab(ws.id, store().activeTab[ws.id], `Review ${task.title.slice(0, 20)}`);
  const prompt = [
    `Review the work done for this task: ${task.title}`,
    task.branch ? `It is on the branch ${task.branch}. Compare it with the branch it came from.` : 'Look at the recent changes.',
    'Read the diff and run the tests. List real problems only, then say if it is ready to merge.',
  ].join('\n\n');
  startAgent(paneId, task.engine, { prompt, cwd: task.worktree ?? ws.root, title: `Reviewer: ${task.title.slice(0, 22)}` });
  store().selectWorkspace(ws.id);
  store().jumpToPane(paneId);
}

export async function mergeTask(task: Task): Promise<boolean> {
  if (!task.branch) {
    await api.taskUpdate(task.id, { status: 'done' });
    return true;
  }
  const ok = await confirm(`Merge ${task.branch} into the branch that is open in ${task.workspace}?`, { title: 'Merge', kind: 'warning' });
  if (!ok) return false;
  try {
    await api.gitMerge(task.workspace, task.branch);
    if (task.worktree) await api.gitWorktreeRemove(task.workspace, task.worktree, false);
    await api.taskUpdate(task.id, { status: 'done' });
    return true;
  } catch (e) {
    say(e);
    return false;
  }
}

export function runRoutine(r: Routine) {
  const s = store();
  if (!s.workspaces.some((w) => w.id === r.wsId)) {
    s.setToast(`${r.name} has no folder to run in.`);
    return;
  }
  const paneId = s.newTab(r.wsId);
  store().renameTab(r.wsId, store().activeTab[r.wsId], r.name.slice(0, 28));
  startAgent(paneId, r.engine, { prompt: r.prompt, title: r.name });
  store().log('working', `${r.name} started`, paneId);
}

/** Fires any routine that is due. Routines run only while Switchyard is open. */
export function checkRoutines(now = new Date()) {
  const s = store();
  let changed = false;
  const next = s.routines.map((r) => {
    if (!r.enabled || r.nextRun > now.getTime()) return r;
    changed = true;
    runRoutine(r);
    return { ...r, lastRun: now.getTime(), nextRun: nextDaily(r.time, now).getTime() };
  });
  if (changed) s.setRoutines(next);
}
