import { Channel } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { openUrl } from '@tauri-apps/plugin-opener';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { api, errorText, type LiveTerm } from './api';
import { deliveryFor, pastedImage, promptInput, quotePath, sendPlan, stageableImage, type PromptInput } from './clipboard';
import {
  autoPrompt,
  ECHO_MS,
  nextAutoStep,
  QUIET_MS,
  readMark,
  screenAsks,
  type Signal,
} from './signals';
import { useStore } from '../store';

const THEME = {
  background: '#0d0e11',
  foreground: '#e6e9ef',
  cursor: '#6d9bf5',
  cursorAccent: '#0d0e11',
  selectionBackground: '#6d9bf544',
  black: '#20232a',
  red: '#e0604c',
  green: '#86c28a',
  yellow: '#e8b65a',
  blue: '#7fa8c9',
  magenta: '#c08bb4',
  cyan: '#79b8ad',
  white: '#d9d1c2',
  brightBlack: '#6f685b',
  brightRed: '#f07f6c',
  brightGreen: '#a3d6a6',
  brightYellow: '#f4cd80',
  brightBlue: '#9cc1dd',
  brightMagenta: '#d6a6cc',
  brightCyan: '#97d0c6',
  brightWhite: '#f5efe3',
};

interface Live {
  term: Terminal;
  fit: FitAddon;
  host: HTMLDivElement;
  token: string;
  started: boolean;
  lastOutput: number;
  lastInput: number;
  /** A person or Switchyard has sent this agent work. Its first quiet moment after start does not count. */
  hadTurn: boolean;
  commandStart: number;
  lastExit: number;
  taskReported?: boolean;
  /** No sounds or notices before this time. A rejoined terminal replays old output that must not ring again. */
  silentUntil: number;
  /** Bytes received, for tests. */
  bytes: number;
  /** Old output is being drawn again. Answers the terminal gives to old questions in it must not reach the shell. */
  replaying: boolean;
  /** When the agent's command started. Its start-up counts as done only after output that follows this. */
  launchedAt: number;
  createdAt: number;
  /** The last few things the terminal sent or held back, for tests. */
  sent: string[];
  resizeTimer?: ReturnType<typeof setTimeout>;
}

const live = new Map<string, Live>();
/** Terminals the keeper kept running while Switchyard was closed. Each waits for its pane to rejoin it. */
const survivors = new Map<string, LiveTerm>();

export function screenText(paneId: string): string {
  const l = live.get(paneId);
  if (!l) return '';
  const buf = l.term.buffer.active;
  const lines: string[] = [];
  const start = Math.max(0, buf.baseY + buf.viewportY);
  for (let i = start; i < start + l.term.rows; i++) {
    lines.push(buf.getLine(i)?.translateToString(true) ?? '');
  }
  return lines.join('\n');
}

const pane = (id: string) => useStore.getState().panes[id];
const patch = (id: string, p: Parameters<ReturnType<typeof useStore.getState>['patchPane']>[1]) =>
  useStore.getState().patchPane(id, p);

let audio: AudioContext | undefined;
function chime(needs: boolean) {
  try {
    audio ??= new AudioContext();
    const notes = needs ? [660, 880] : [520];
    notes.forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      const at = audio!.currentTime + i * 0.14;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.09, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(gain).connect(audio!.destination);
      osc.start(at);
      osc.stop(at + 0.24);
    });
  } catch {
    // Sound is a nicety. The lamp and the activity list still show the change.
  }
}

async function nativeNotice(title: string) {
  try {
    if (await getCurrentWindow().isFocused()) return;
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    if (granted) sendNotification({ title: 'Switchyard', body: title });
  } catch {
    // The in-app activity list still has this notice.
  }
}

function announce(paneId: string, signal: Signal, text: string) {
  const l = live.get(paneId);
  if (l && Date.now() < l.silentUntil) return;
  useStore.getState().log(signal, text, paneId);
  if (signal === 'needs' || signal === 'ready' || signal === 'failed') chime(signal === 'needs');
  void nativeNotice(text);
}

function setSignal(paneId: string, signal: Signal) {
  const p = pane(paneId);
  if (!p || p.signal === signal) return;
  const l = live.get(paneId);
  patch(paneId, { signal });
  if (signal === 'needs') announce(paneId, 'needs', `${p.title} needs you`);
  if (signal === 'ready' && l?.hadTurn && !p.auto) announce(paneId, 'ready', `${p.title} finished its turn`);
  if (signal === 'ready' && l?.hadTurn && p.taskId && !l.taskReported) {
    // Only the first finished turn moves the card, so later chat cannot undo a move you made by hand.
    l.taskReported = true;
    void onTaskTurnEnd(p.taskId);
  }
}

async function onTaskTurnEnd(taskId: string) {
  try {
    await api.taskUpdate(taskId, { status: 'review' });
  } catch (e) {
    useStore.getState().setToast(errorText(e));
  }
}

/** Runs every half second. It reads each agent's quiet time, then moves its lamp and its Auto run. */
function tick() {
  const now = Date.now();
  for (const [id, l] of live) {
    const p = pane(id);
    if (!p || !l.started || p.kind !== 'agent') continue;
    // A slow shell profile can be quiet before the agent even starts. Wait for the agent's own output, up to a minute.
    const launching = p.signal === 'starting' && (!l.launchedAt || l.lastOutput <= l.launchedAt + 50);
    if (launching && now - l.createdAt < 60_000) continue;
    if (p.signal === 'starting' || p.signal === 'working' || p.signal === 'ready' || p.signal === 'needs') {
      const quiet = now - l.lastOutput;
      if (quiet < QUIET_MS) continue;
      const screen = screenText(id);
      const asks = screenAsks(screen);
      if (p.signal === 'working' || p.signal === 'starting') setSignal(id, asks ? 'needs' : 'ready');
      else if (p.signal === 'needs' && !asks) setSignal(id, 'ready');
    }
    const fresh = pane(id);
    if (!fresh) continue;
    if (fresh.prompt && fresh.signal === 'ready') {
      const text = fresh.prompt;
      patch(id, { prompt: undefined });
      sendText(id, text);
      continue;
    }
    if (fresh.auto) runAuto(id);
  }
}

function runAuto(id: string) {
  const p = pane(id);
  if (!p?.auto) return;
  const screen = screenText(id);
  const step = nextAutoStep(p.signal, screen, p.auto.rounds, p.auto.max);
  if (step === 'wait') return;
  if (step === 'send') {
    sendText(id, autoPrompt(p.auto.goal, p.auto.rounds));
    patch(id, { auto: { ...p.auto, rounds: p.auto.rounds + 1 } });
    return;
  }
  patch(id, { auto: undefined });
  const words = { finish: 'finished its goal', pause: 'stopped Auto, it needs you', limit: 'used all its Auto rounds' };
  const signal: Signal = step === 'finish' ? 'ready' : 'needs';
  announce(id, signal, `${p.title} ${words[step]}`);
}

/** True when the program in the pane has asked for pastes to be marked, as agents and modern shells do. */
export function isBracketed(paneId: string): boolean {
  return live.get(paneId)?.term.modes.bracketedPasteMode ?? false;
}

/**
 * Types text into a pane and presses Enter. Multi-line text goes in as one paste, and each
 * engine gets its own short wait before Enter so it finishes reading the paste.
 */
export function sendText(paneId: string, text: string) {
  const l = live.get(paneId);
  if (!l) return;
  l.hadTurn = true;
  l.lastOutput = Date.now();
  patch(paneId, { signal: 'working' });
  const plan = sendPlan(text, isBracketed(paneId), deliveryFor(pane(paneId)?.engine));
  void api.termWrite(paneId, plan.data);
  setTimeout(() => void api.termWrite(paneId, '\r'), plan.enterAfterMs);
}

/** Types a saved prompt in without Enter. Returns why it was refused, if it was. */
export function insertPrompt(paneId: string, text: string): PromptInput {
  const input = promptInput(text, isBracketed(paneId));
  if (input.kind === 'write') void api.termWrite(paneId, input.data);
  return input;
}

/** Types short text such as a path in, marked as a paste when the program asks for that. */
export function typeIn(paneId: string, text: string) {
  if (!live.has(paneId)) return;
  void api.termWrite(paneId, isBracketed(paneId) ? `\x1b[200~${text}\x1b[201~` : text);
}

/** Saves a pasted image to a file and types its path in, so the agent can read it. */
async function pasteImage(paneId: string, file: File) {
  const format = stageableImage(file);
  if (!format) throw new Error('unsupported image');
  const path = await api.clipImageSave(new Uint8Array(await file.arrayBuffer()), format);
  typeIn(paneId, `${quotePath(path)} `);
}

export function stopAuto(paneId: string) {
  patch(paneId, { auto: undefined });
}

function onOutput(paneId: string, n = 0) {
  const l = live.get(paneId);
  const p = pane(paneId);
  if (!l || !p) return;
  l.bytes += n;
  const now = Date.now();
  l.lastOutput = now;
  if (p.kind !== 'agent') return;
  if (now - l.lastInput < ECHO_MS) return;
  if (p.signal === 'ready' || p.signal === 'needs') setSignal(paneId, 'working');
}

function onMark(paneId: string, body: string): boolean {
  const l = live.get(paneId);
  const p = pane(paneId);
  if (!l || !p) return true;
  const mark = readMark(body, l.token);
  if (!mark) return true;
  if (mark.kind === 'prompt') {
    if (p.kind === 'agent') {
      // The agent quit and its shell came back. The pane is a plain shell from now on.
      patch(paneId, { kind: 'shell', auto: undefined, signal: 'ended' });
      useStore.getState().log('ended', `${p.title} stopped`, paneId);
      void nativeNotice(`${p.title} stopped`);
      return true;
    }
    if (p.signal === 'off' || p.signal === 'starting' || p.signal === 'working') {
      patch(paneId, { signal: l.lastExit !== 0 ? 'failed' : 'ready' });
    }
  } else if (mark.kind === 'command') {
    l.commandStart = Date.now();
    if (p.kind === 'agent' && !l.launchedAt) l.launchedAt = l.commandStart;
    if (p.kind === 'shell') patch(paneId, { signal: 'working' });
  } else if (mark.kind === 'finished') {
    l.lastExit = mark.exitCode ?? 0;
    const ms = Date.now() - l.commandStart;
    if (p.kind === 'shell' && ms > 10_000) {
      const ok = l.lastExit === 0;
      announce(paneId, ok ? 'ready' : 'failed', `${p.lastCommand ?? 'A command'} ${ok ? 'finished' : 'failed'} in ${p.title}`);
    }
  }
  return true;
}

function onOwnMark(paneId: string, body: string): boolean {
  const l = live.get(paneId);
  if (!l) return true;
  const [kind, token, ...rest] = body.split(';');
  if (token !== l.token) return true;
  const value = rest.join(';');
  if (kind === 'cwd') patch(paneId, { cwd: value });
  if (kind === 'cmd') {
    try {
      const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
      patch(paneId, { lastCommand: new TextDecoder().decode(bytes) });
    } catch {
      // A broken mark only loses the command name in the header.
    }
  }
  return true;
}

function create(paneId: string, token?: string): Live {
  const term = new Terminal({
    // Nerd fonts first, when installed, because many shell prompts draw their icons with them.
    fontFamily:
      '"JetBrainsMono NF", "JetBrainsMono Nerd Font", "CaskaydiaCove Nerd Font", "MesloLGS NF", "JetBrains Mono Variable", "Cascadia Mono", Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.18,
    cursorBlink: true,
    scrollback: 10000,
    allowProposedApi: true,
    theme: THEME,
    macOptionIsMeta: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon((_e, url) => void openUrl(url)));

  const host = document.createElement('div');
  host.className = 'term-host';
  // An image on the clipboard goes in as a saved file. Text pastes go on to the terminal as usual.
  host.addEventListener(
    'paste',
    (e) => {
      const file = e.clipboardData && pastedImage(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      pasteImage(paneId, file)
        .then(() => useStore.getState().setToast('Image saved and its path typed in.'))
        .catch(() => useStore.getState().setToast('That image could not be pasted.'));
    },
    true,
  );
  const l: Live = {
    term,
    fit,
    host,
    token: token ?? crypto.randomUUID().replaceAll('-', ''),
    started: false,
    lastOutput: Date.now(),
    lastInput: 0,
    hadTurn: false,
    commandStart: 0,
    lastExit: 0,
    silentUntil: 0,
    bytes: 0,
    replaying: false,
    launchedAt: 0,
    createdAt: Date.now(),
    sent: [],
  };
  live.set(paneId, l);

  term.parser.registerOscHandler(133, (body) => onMark(paneId, body));
  term.parser.registerOscHandler(5151, (body) => onOwnMark(paneId, body));
  term.onBell(() => {
    const p = pane(paneId);
    if (p?.kind === 'agent' && p.signal === 'working') setSignal(paneId, 'needs');
  });
  term.onData((data) => {
    l.sent = [...l.sent.slice(-19), `${l.replaying ? 'held' : 'sent'} ${JSON.stringify(data)}`];
    if (l.replaying) return;
    l.lastInput = Date.now();
    if (data === '\r') l.hadTurn = true;
    void api.termWrite(paneId, data).catch(() => undefined);
  });
  term.onResize(({ cols, rows }) => {
    clearTimeout(l.resizeTimer);
    l.resizeTimer = setTimeout(() => void api.termResize(paneId, cols, rows).catch(() => undefined), 60);
  });
  term.attachCustomKeyEventHandler((e) => terminalKey(e, term, paneId));
  return l;
}

const isKey = (e: KeyboardEvent, letter: string) => e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;

/**
 * Decides which keys the terminal keeps. Returning false leaves the key to the browser or to
 * Switchyard; returning true sends it to the program in the pane.
 */
function terminalKey(e: KeyboardEvent, term: Terminal, paneId: string): boolean {
  if (typeof e.key !== 'string') return true;
  // Switchyard already acted on this key.
  if (e.defaultPrevented) return false;
  const onlyCtrl = e.ctrlKey && !e.altKey && !e.metaKey;
  // Ctrl+V, Ctrl+Shift+V and Shift+Insert paste through the browser, which marks the paste for the program.
  if (!e.isComposing && ((onlyCtrl && isKey(e, 'v')) || (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && e.key === 'Insert'))) return false;
  // Ctrl+Shift+C copies the selection. The selection stays.
  if (onlyCtrl && e.shiftKey && isKey(e, 'c') && term.hasSelection()) {
    if (e.type === 'keydown') {
      e.preventDefault();
      void navigator.clipboard?.writeText(term.getSelection()).catch(() => undefined);
    }
    return false;
  }
  // Ctrl+C with a selection copies through the browser. With none it stops the program as usual.
  if (onlyCtrl && !e.shiftKey && !e.isComposing && isKey(e, 'c') && term.hasSelection()) return false;
  // Shift+Enter sends Escape and Enter, which agents read as a new line in their input.
  if (e.type === 'keydown' && e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    void api.termWrite(paneId, '\x1b\r').catch(() => undefined);
    return false;
  }
  return true;
}

/** Puts a pane's terminal in `slot`, and starts its shell the first time. The terminal outlives any screen change. */
export function attach(paneId: string, slot: HTMLElement) {
  const p = pane(paneId);
  if (!p || p.kind === 'empty' || p.asleep) return;
  let l = live.get(paneId);
  const firstTime = !l;
  const kept = firstTime ? survivors.get(paneId) : undefined;
  l ??= create(paneId, kept?.token);
  slot.appendChild(l.host);
  if (firstTime) {
    l.term.open(l.host);
    try {
      const gl = new WebglAddon();
      gl.onContextLoss(() => gl.dispose());
      l.term.loadAddon(gl);
    } catch {
      // The plain renderer still works.
    }
  }
  fitNow(paneId);
  if (kept) rejoin(paneId, l);
  else if (!l.started) start(paneId, l);
}

/** Joins a terminal that kept running while Switchyard was closed, and draws its last output again. */
function rejoin(paneId: string, l: Live) {
  const p = pane(paneId);
  if (!p) return;
  survivors.delete(paneId);
  l.started = true;
  l.silentUntil = Date.now() + QUIET_MS + 2500;
  l.lastOutput = Date.now();
  l.launchedAt = 1;
  l.replaying = true;
  let first = true;
  patch(paneId, { signal: p.kind === 'agent' ? 'working' : 'ready' });
  const onData = new Channel<ArrayBuffer | number[]>();
  onData.onmessage = (chunk) => {
    const bytes = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : new Uint8Array(chunk);
    if (first) {
      // The first message is the saved output. Old cursor questions in it would make the terminal answer the live shell.
      first = false;
      l.term.write(bytes, () => (l.replaying = false));
    } else {
      l.term.write(bytes);
    }
    onOutput(paneId, bytes.length);
  };
  api
    .termAttach(paneId, onData)
    .then((saved) => {
      // With no saved output there is nothing to replay. Otherwise the first message clears the flag.
      if (saved === 0) l.replaying = false;
      const { cols, rows } = l.term;
      if (p.kind !== 'agent') {
        void api.termResize(paneId, cols, rows);
        return;
      }
      // A size change makes a full-screen agent draw its screen again. Shells skip it: their line editor can drop a key.
      void api.termResize(paneId, Math.max(2, cols - 1), rows);
      setTimeout(() => void api.termResize(paneId, cols, rows), 120);
    })
    .catch((e) => {
      l.started = false;
      patch(paneId, { signal: 'failed', note: errorText(e) });
    });
}

export function fitNow(paneId: string) {
  const l = live.get(paneId);
  if (!l || !l.host.isConnected || l.host.clientWidth === 0) return;
  try {
    l.fit.fit();
  } catch {
    // Happens only while the pane has no size yet. The next resize fits it.
  }
}

export function focusTerm(paneId: string) {
  live.get(paneId)?.term.focus();
}

function start(paneId: string, l: Live) {
  const p = pane(paneId);
  if (!p) return;
  l.started = true;
  patch(paneId, { signal: 'starting' });
  const onData = new Channel<ArrayBuffer | number[]>();
  onData.onmessage = (chunk) => {
    const bytes = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : new Uint8Array(chunk);
    l.term.write(bytes);
    onOutput(paneId, bytes.length);
  };
  api
    .termStart({
      id: paneId,
      cwd: p.cwd,
      startup: p.startup ?? null,
      token: l.token,
      cols: l.term.cols,
      rows: l.term.rows,
      onData,
    })
    .then(() => {
      if (p.draft) {
        const draft = p.draft;
        patch(paneId, { draft: undefined });
        setTimeout(() => void api.termWrite(paneId, draft), 1200);
      }
    })
    .catch((e) => {
      l.started = false;
      patch(paneId, { signal: 'failed', note: errorText(e) });
      useStore.getState().log('failed', `${p.title} could not start: ${errorText(e)}`, paneId);
    });
}

/** Ends a pane's terminal and forgets it. */
export function destroy(paneId: string) {
  const l = live.get(paneId);
  if (survivors.delete(paneId) && !l) void api.termKill(paneId).catch(() => undefined);
  if (!l) return;
  live.delete(paneId);
  void api.termKill(paneId).catch(() => undefined);
  l.term.dispose();
  l.host.remove();
}

/** Throws away a pane's terminal so the next `attach` starts a new one with the pane's current settings. */
export function reset(paneId: string) {
  destroy(paneId);
}

/** Ends kept terminals that no pane claims, for example from a pane closed in an older session. */
export function dropUnclaimed(paneIds: Set<string>) {
  for (const id of [...survivors.keys()]) {
    if (paneIds.has(id)) continue;
    survivors.delete(id);
    void api.termKill(id).catch(() => undefined);
  }
}

let booted = false;
/** Connects to the terminal keeper. Returns the ids of terminals that kept running while Switchyard was closed. */
export async function bootTerminals(): Promise<Set<string>> {
  if (booted) return new Set(survivors.keys());
  booted = true;
  try {
    for (const t of await api.termList()) survivors.set(t.id, t);
  } catch (e) {
    useStore.getState().setToast(`Terminals may not start: ${errorText(e)}`);
  }
  await listen<{ id: string; code?: number | null }>('term-exit', ({ payload }) => {
    const l = live.get(payload.id);
    const p = pane(payload.id);
    if (!l || !p) return;
    l.started = false;
    l.term.write('\r\n\x1b[2m[This session closed]\x1b[0m\r\n');
    patch(payload.id, { signal: 'ended', auto: undefined, kind: p.kind === 'agent' ? 'shell' : p.kind, note: 'closed' });
    useStore.getState().log('ended', `${p.title} closed`, payload.id);
  });
  setInterval(tick, 500);
  return new Set(survivors.keys());
}

/** For tests: what a pane's terminal holds right now. */
export function liveInfo(paneId: string) {
  const l = live.get(paneId);
  if (!l) return null;
  return { started: l.started, bytes: l.bytes, cols: l.term.cols, rows: l.term.rows, connected: l.host.isConnected, sent: l.sent };
}
