import { create } from 'zustand';
import { api } from './lib/api';
import {
  dock,
  equalize,
  focusAfterClose,
  fromSaved,
  leaf,
  MAX_TABS,
  paneIds,
  removePane,
  resize,
  splitPane,
  stepFrom,
  swapPanes,
  tidy,
  tile,
  type Dir,
  type Tree,
  type Zone,
} from './lib/layout';
import type { Signal } from './lib/signals';

export interface Workspace {
  id: string;
  name: string;
  root: string;
}

export interface Pane {
  id: string;
  wsId: string;
  kind: 'empty' | 'shell' | 'agent';
  title: string;
  cwd: string;
  signal: Signal;
  engine?: string;
  startup?: string;
  /** Typed in after the agent is ready. */
  prompt?: string;
  /** Typed in a shell without pressing Enter, for you to check first. */
  draft?: string;
  /** Came back from the last session. It waits for you before starting. */
  asleep?: boolean;
  lastCommand?: string;
  taskId?: string;
  auto?: { goal: string; rounds: number; max: number };
  note?: string;
}

export interface Tab {
  id: string;
  name: string;
  tree: Tree;
  focus: string;
  /** The pane that fills the whole track, if any. */
  full?: string | null;
}

export interface Seat {
  kind: 'agent' | 'shell';
  engine?: string;
  command?: string;
  prompt?: string;
}
export interface Lineup {
  id: string;
  name: string;
  seats: Seat[];
}
export interface CrewMember {
  id: string;
  name: string;
  engine: string;
  purpose: string;
  memory: string;
}
export interface Prompt {
  id: string;
  title: string;
  text: string;
}
export interface Routine {
  id: string;
  name: string;
  wsId: string;
  engine: string;
  prompt: string;
  time: string;
  enabled: boolean;
  nextRun: number;
  lastRun?: number;
}
export interface Activity {
  id: string;
  time: number;
  signal: Signal;
  title: string;
  paneId?: string;
  read: boolean;
}

export type View = 'yard' | 'board' | 'crew' | 'lineups' | 'routines' | 'activity' | 'agents' | 'settings';

export interface Settings {
  /** Terminals keep running in the keeper after Switchyard closes, and come back when it opens. */
  keepTerminals: boolean;
}
const DEFAULT_SETTINGS: Settings = { keepTerminals: true };
export type Drawer = 'none' | 'git' | 'files' | 'prompts';

export const uid = () => crypto.randomUUID();

interface State {
  ready: boolean;
  workspaces: Workspace[];
  activeWs: string | null;
  tabs: Record<string, Tab[]>;
  activeTab: Record<string, string>;
  panes: Record<string, Pane>;
  installed: Record<string, boolean>;
  lineups: Lineup[];
  crew: CrewMember[];
  prompts: Prompt[];
  routines: Routine[];
  activity: Activity[];
  view: View;
  drawer: Drawer;
  drawerWidth: number;
  toast: string | null;
  settings: Settings;

  setSettings: (patch: Partial<Settings>) => void;
  setView: (v: View) => void;
  setDrawer: (d: Drawer) => void;
  setDrawerWidth: (n: number) => void;
  setToast: (t: string | null) => void;
  setInstalled: (m: Record<string, boolean>) => void;
  addWorkspace: (root: string) => void;
  removeWorkspace: (id: string) => void;
  selectWorkspace: (id: string) => void;
  newTab: (wsId: string, pane?: Partial<Pane>) => string;
  renameTab: (wsId: string, tabId: string, name: string) => void;
  selectTab: (wsId: string, tabId: string) => void;
  closeTab: (wsId: string, tabId: string) => string[];
  addLineupTab: (wsId: string, name: string, panes: Partial<Pane>[]) => void;
  focusPane: (paneId: string) => void;
  jumpToPane: (paneId: string) => void;
  split: (paneId: string, dir: Dir, pane?: Partial<Pane>) => string;
  closePane: (paneId: string) => void;
  updateTree: (wsId: string, tabId: string, tree: Tree) => void;
  patchPane: (id: string, patch: Partial<Pane>) => void;
  log: (signal: Signal, title: string, paneId?: string) => void;
  markAllRead: () => void;
  setLineups: (l: Lineup[]) => void;
  setCrew: (c: CrewMember[]) => void;
  setPrompts: (p: Prompt[]) => void;
  setRoutines: (r: Routine[]) => void;

  /** Moves focus `offset` panes along reading order in the active track, wrapping. */
  focusStep: (offset: number) => void;
  /** Selects the track `offset` places away, wrapping. */
  tabStep: (offset: number) => void;
  /** Trades the focused pane with its neighbour in reading order. */
  swapStep: (offset: number) => void;
  /** Swaps two panes, or docks `source` on an edge of `target`. */
  dropPane: (source: string, target: string, zone: Zone) => void;
  /** Moves a pane into a track of its own. Needs at least two panes in its track. */
  extractPane: (paneId: string) => void;
  equalizeTab: () => void;
  tidyTab: () => void;
  toggleFull: (paneId: string) => void;
  /** Ends full-pane view. Returns false when nothing was full. */
  exitFull: () => boolean;
  resizeSplit: (wsId: string, tabId: string, splitId: string, index: number, share: number, extentPx: number) => void;
  moveTab: (wsId: string, tabId: string, toIndex: number) => void;
  zoom: number;
  setZoom: (percent: number) => void;
  stepZoom: (direction: 1 | -1) => void;
}

const UNSAFE = 'That layout change was not safe, so nothing moved.';
const TAB_LIMIT = `A folder holds at most ${MAX_TABS} tracks.`;
export const clampZoom = (n: number) => Math.min(200, Math.max(60, Math.round(n)));

/** The active track of the active folder. */
export function activeTabOf(s: { activeWs: string | null; tabs: Record<string, Tab[]>; activeTab: Record<string, string> }) {
  if (!s.activeWs) return undefined;
  return (s.tabs[s.activeWs] ?? []).find((t) => t.id === s.activeTab[s.activeWs!]);
}

type SetFn = (fn: (s: State) => Partial<State> | State) => void;
/** Changes the active track with `fn`. `fn` returns null to leave it alone. */
function editActive(set: SetFn, get: () => State, fn: (t: Tab) => Tab | null) {
  const s = get();
  const t = activeTabOf(s);
  if (!s.activeWs || !t) return;
  const next = fn(t);
  if (!next) return;
  const ws = s.activeWs;
  set((st) => ({ tabs: { ...st.tabs, [ws]: (st.tabs[ws] ?? []).map((x) => (x.id === t.id ? next : x)) } }));
}

const emptyPane = (wsId: string, cwd: string, extra?: Partial<Pane>): Pane => ({
  id: uid(),
  wsId,
  kind: 'empty',
  title: 'New pane',
  cwd,
  signal: 'off',
  ...extra,
});

const wsRoot = (s: { workspaces: Workspace[] }, id: string) => s.workspaces.find((w) => w.id === id)?.root ?? '';

export const useStore = create<State>((set, get) => ({
  ready: false,
  workspaces: [],
  activeWs: null,
  tabs: {},
  activeTab: {},
  panes: {},
  installed: {},
  lineups: [],
  crew: [],
  prompts: [],
  routines: [],
  activity: [],
  view: 'yard',
  drawer: 'none',
  drawerWidth: 380,
  toast: null,
  settings: DEFAULT_SETTINGS,
  zoom: 100,

  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void api.docSet('settings', settings);
    void api.termKeepAlive(settings.keepTerminals).catch(() => undefined);
  },
  setView: (view) => set({ view }),
  setDrawer: (drawer) => set((s) => ({ drawer: s.drawer === drawer ? 'none' : drawer })),
  setDrawerWidth: (drawerWidth) => set({ drawerWidth: Math.min(760, Math.max(280, drawerWidth)) }),
  setToast: (toast) => set({ toast }),
  setInstalled: (installed) => set({ installed }),

  addWorkspace: (root) => {
    const existing = get().workspaces.find((w) => w.root.toLowerCase() === root.toLowerCase());
    if (existing) {
      get().selectWorkspace(existing.id);
      return;
    }
    const name = root.split(/[\\/]/).filter(Boolean).pop() ?? root;
    const ws: Workspace = { id: uid(), name, root };
    set((s) => ({ workspaces: [...s.workspaces, ws], activeWs: ws.id, view: 'yard' }));
    get().newTab(ws.id);
  },

  removeWorkspace: (id) =>
    set((s) => {
      const gone = new Set((s.tabs[id] ?? []).flatMap((t) => paneIds(t.tree)));
      const panes = Object.fromEntries(Object.entries(s.panes).filter(([k]) => !gone.has(k)));
      const workspaces = s.workspaces.filter((w) => w.id !== id);
      const { [id]: _t, ...tabs } = s.tabs;
      const { [id]: _a, ...activeTab } = s.activeTab;
      return { workspaces, panes, tabs, activeTab, activeWs: s.activeWs === id ? (workspaces[0]?.id ?? null) : s.activeWs };
    }),

  selectWorkspace: (id) => set({ activeWs: id, view: 'yard' }),

  newTab: (wsId, extra) => {
    const s = get();
    if ((s.tabs[wsId] ?? []).length >= MAX_TABS) {
      s.setToast(TAB_LIMIT);
      return '';
    }
    const pane = emptyPane(wsId, wsRoot(s, wsId), extra);
    const count = (s.tabs[wsId] ?? []).length;
    const tab: Tab = { id: uid(), name: `Track ${count + 1}`, tree: leaf(pane.id), focus: pane.id };
    set((st) => ({
      panes: { ...st.panes, [pane.id]: pane },
      tabs: { ...st.tabs, [wsId]: [...(st.tabs[wsId] ?? []), tab] },
      activeTab: { ...st.activeTab, [wsId]: tab.id },
    }));
    return pane.id;
  },

  renameTab: (wsId, tabId, name) =>
    set((s) => ({ tabs: { ...s.tabs, [wsId]: (s.tabs[wsId] ?? []).map((t) => (t.id === tabId ? { ...t, name } : t)) } })),

  selectTab: (wsId, tabId) =>
    set((s) => ({
      activeTab: { ...s.activeTab, [wsId]: tabId },
      tabs: { ...s.tabs, [wsId]: (s.tabs[wsId] ?? []).map((t) => (t.full ? { ...t, full: null } : t)) },
    })),

  closeTab: (wsId, tabId) => {
    const s = get();
    const list = s.tabs[wsId] ?? [];
    const tab = list.find((t) => t.id === tabId);
    if (!tab) return [];
    const ids = paneIds(tab.tree);
    const at = list.indexOf(tab);
    const rest = list.filter((t) => t.id !== tabId);
    // The track that slides into the closed one's place becomes active, else the last one.
    const next = rest[Math.min(at, rest.length - 1)]?.id ?? '';
    set((st) => ({
      panes: Object.fromEntries(Object.entries(st.panes).filter(([k]) => !ids.includes(k))),
      tabs: { ...st.tabs, [wsId]: rest },
      activeTab: { ...st.activeTab, [wsId]: st.activeTab[wsId] === tabId ? next : st.activeTab[wsId] },
    }));
    return ids;
  },

  addLineupTab: (wsId, name, extras) => {
    const s = get();
    const made = extras.map((e) => emptyPane(wsId, wsRoot(s, wsId), e));
    const tab: Tab = { id: uid(), name, tree: tile(made.map((p) => p.id), uid), focus: made[0].id };
    set((st) => ({
      panes: { ...st.panes, ...Object.fromEntries(made.map((p) => [p.id, p])) },
      tabs: { ...st.tabs, [wsId]: [...(st.tabs[wsId] ?? []), tab] },
      activeTab: { ...st.activeTab, [wsId]: tab.id },
      activeWs: wsId,
      view: 'yard',
    }));
  },

  focusPane: (paneId) =>
    set((s) => {
      const pane = s.panes[paneId];
      if (!pane) return s;
      const list = s.tabs[pane.wsId] ?? [];
      return {
        tabs: {
          ...s.tabs,
          [pane.wsId]: list.map((t) => (paneIds(t.tree).includes(paneId) ? { ...t, focus: paneId } : t)),
        },
      };
    }),

  jumpToPane: (paneId) =>
    set((s) => {
      const pane = s.panes[paneId];
      if (!pane) return s;
      const list = s.tabs[pane.wsId] ?? [];
      const tab = list.find((t) => paneIds(t.tree).includes(paneId));
      if (!tab) return s;
      return {
        view: 'yard',
        activeWs: pane.wsId,
        activeTab: { ...s.activeTab, [pane.wsId]: tab.id },
        tabs: { ...s.tabs, [pane.wsId]: list.map((t) => (t.id === tab.id ? { ...t, focus: paneId } : t)) },
      };
    }),

  split: (paneId, dir, extra) => {
    const s = get();
    const source = s.panes[paneId];
    if (!source) return '';
    const tab = (s.tabs[source.wsId] ?? []).find((t) => paneIds(t.tree).includes(paneId));
    if (!tab) return '';
    const pane = emptyPane(source.wsId, source.cwd, extra);
    const tree = splitPane(tab.tree, paneId, dir, pane.id, uid);
    if (!tree) {
      s.setToast(UNSAFE);
      return '';
    }
    set((st) => ({
      panes: { ...st.panes, [pane.id]: pane },
      activeTab: { ...st.activeTab, [source.wsId]: tab.id },
      tabs: {
        ...st.tabs,
        [source.wsId]: (st.tabs[source.wsId] ?? []).map((t) => (t.id === tab.id ? { ...t, tree, focus: pane.id, full: null } : t)),
      },
    }));
    return pane.id;
  },

  closePane: (paneId) => {
    const s = get();
    const pane = s.panes[paneId];
    if (!pane) return;
    const list = s.tabs[pane.wsId] ?? [];
    const tab = list.find((t) => paneIds(t.tree).includes(paneId));
    if (!tab) return;
    const tree = removePane(tab.tree, paneId);
    if (!tree) {
      get().closeTab(pane.wsId, tab.id);
      return;
    }
    set((st) => {
      const { [paneId]: _gone, ...panes } = st.panes;
      return {
        panes,
        tabs: {
          ...st.tabs,
          [pane.wsId]: (st.tabs[pane.wsId] ?? []).map((t) =>
            t.id === tab.id
              ? {
                  ...t,
                  tree,
                  focus: focusAfterClose(tab.tree, tree, paneId, tab.focus),
                  full: st.activeTab[pane.wsId] === tab.id ? null : t.full,
                }
              : t,
          ),
        },
      };
    });
  },

  updateTree: (wsId, tabId, tree) =>
    set((s) => ({ tabs: { ...s.tabs, [wsId]: (s.tabs[wsId] ?? []).map((t) => (t.id === tabId ? { ...t, tree } : t)) } })),

  patchPane: (id, patch) =>
    set((s) => (s.panes[id] ? { panes: { ...s.panes, [id]: { ...s.panes[id], ...patch } } } : s)),

  log: (signal, title, paneId) =>
    set((s) => ({
      activity: [{ id: uid(), time: Date.now(), signal, title, paneId, read: false }, ...s.activity].slice(0, 200),
    })),
  markAllRead: () => set((s) => ({ activity: s.activity.map((a) => ({ ...a, read: true })) })),

  focusStep: (offset) =>
    editActive(set, get, (t) => {
      const next = stepFrom(paneIds(t.tree), t.focus, offset);
      return next ? { ...t, focus: next, full: null } : null;
    }),

  tabStep: (offset) => {
    const s = get();
    const ws = s.activeWs;
    const list = ws ? (s.tabs[ws] ?? []) : [];
    if (!ws || list.length < 2) return;
    const at = list.findIndex((t) => t.id === s.activeTab[ws]);
    if (at < 0) return;
    s.selectTab(ws, list[(at + offset + list.length) % list.length].id);
  },

  swapStep: (offset) =>
    editActive(set, get, (t) => {
      const other = stepFrom(paneIds(t.tree), t.focus, offset);
      if (!other) return null;
      // Focus stays on the same spot, which now holds the neighbour.
      return { ...t, tree: swapPanes(t.tree, t.focus, other), focus: other, full: null };
    }),

  dropPane: (source, target, zone) => {
    const s = get();
    const pane = s.panes[source];
    if (!pane || source === target) return;
    const tab = (s.tabs[pane.wsId] ?? []).find((t) => paneIds(t.tree).includes(source) && paneIds(t.tree).includes(target));
    if (!tab) return;
    const docked = zone === 'center' ? null : dock(tab.tree, source, target, zone, uid);
    // A dock moves the dragged pane and focuses it. A swap keeps focus on the spot the drag started from.
    const tree = docked ?? swapPanes(tab.tree, source, target);
    const focus = docked ? source : target;
    set((st) => ({
      activeTab: { ...st.activeTab, [pane.wsId]: tab.id },
      tabs: { ...st.tabs, [pane.wsId]: (st.tabs[pane.wsId] ?? []).map((t) => (t.id === tab.id ? { ...t, tree, focus, full: null } : t)) },
    }));
  },

  extractPane: (paneId) => {
    const s = get();
    const pane = s.panes[paneId];
    if (!pane) return;
    const list = s.tabs[pane.wsId] ?? [];
    const tab = list.find((t) => paneIds(t.tree).includes(paneId));
    if (!tab || paneIds(tab.tree).length < 2) return;
    if (list.length >= MAX_TABS) {
      s.setToast(TAB_LIMIT);
      return;
    }
    const rest = removePane(tab.tree, paneId)!;
    const moved: Tab = { id: uid(), name: (pane.title || pane.kind).slice(0, 100), tree: leaf(paneId), focus: paneId };
    set((st) => ({
      activeTab: { ...st.activeTab, [pane.wsId]: moved.id },
      tabs: {
        ...st.tabs,
        [pane.wsId]: [
          ...(st.tabs[pane.wsId] ?? []).map((t) =>
            t.id === tab.id ? { ...t, tree: rest, focus: focusAfterClose(tab.tree, rest, paneId, tab.focus), full: null } : t,
          ),
          moved,
        ],
      },
    }));
  },

  equalizeTab: () => editActive(set, get, (t) => (paneIds(t.tree).length < 2 ? null : { ...t, tree: equalize(t.tree), full: null })),

  tidyTab: () => editActive(set, get, (t) => (paneIds(t.tree).length < 2 ? null : { ...t, tree: tidy(t.tree, uid), full: null })),

  toggleFull: (paneId) =>
    editActive(set, get, (t) => (paneIds(t.tree).includes(paneId) ? { ...t, full: t.full === paneId ? null : paneId, focus: paneId } : null)),

  exitFull: () => {
    const t = activeTabOf(get());
    if (!t?.full) return false;
    editActive(set, get, (x) => ({ ...x, full: null }));
    return true;
  },

  resizeSplit: (wsId, tabId, splitId, index, share, extentPx) =>
    set((s) => ({
      tabs: {
        ...s.tabs,
        [wsId]: (s.tabs[wsId] ?? []).map((t) =>
          t.id === tabId ? { ...t, tree: resize(t.tree, splitId, index, share, extentPx), full: null } : t,
        ),
      },
    })),

  moveTab: (wsId, tabId, toIndex) =>
    set((s) => {
      const list = s.tabs[wsId] ?? [];
      const from = list.findIndex((t) => t.id === tabId);
      if (from < 0 || !Number.isInteger(toIndex)) return s;
      const to = Math.min(Math.max(toIndex, 0), list.length - 1);
      if (to === from) return s;
      const next = list.filter((t) => t.id !== tabId);
      next.splice(to, 0, list[from]);
      return { tabs: { ...s.tabs, [wsId]: next } };
    }),

  setZoom: (percent) => {
    const zoom = clampZoom(percent);
    set({ zoom });
    void api.docSet('zoom', zoom);
  },
  stepZoom: (direction) => get().setZoom(direction > 0 ? get().zoom * 1.1 : get().zoom / 1.1),

  setLineups: (lineups) => {
    set({ lineups });
    void api.docSet('lineups', lineups);
  },
  setCrew: (crew) => {
    set({ crew });
    void api.docSet('crew', crew);
  },
  setPrompts: (prompts) => {
    set({ prompts });
    void api.docSet('prompts', prompts);
  },
  setRoutines: (routines) => {
    set({ routines });
    void api.docSet('routines', routines);
  },
}));

/** The pieces of the session worth saving. Running terminals are not saved, only what to reopen. */
interface Saved {
  workspaces: Workspace[];
  activeWs: string | null;
  tabs: Record<string, Tab[]>;
  activeTab: Record<string, string>;
  panes: Record<string, Pane>;
  drawerWidth: number;
}

export function restoredPane(p: Pane, stillRunning = false): Pane {
  const { auto: _a, prompt: _p, draft: _d, note: _n, ...rest } = p;
  if (p.kind === 'empty') return { ...rest, signal: 'off' };
  // The keeper kept this terminal running, so the pane rejoins it as it is.
  if (stillRunning) return { ...rest, signal: p.kind === 'agent' ? 'working' : 'ready', asleep: false };
  // A plain shell reopens by itself. Agents and saved commands wait, so nothing runs twice by surprise.
  if (p.kind === 'shell' && !p.startup) return { ...rest, signal: 'off', asleep: false };
  return { ...rest, signal: 'off', asleep: true };
}

export async function loadSession(running: Set<string> = new Set()): Promise<void> {
  const [saved, lineups, crew, prompts, routines, settings, zoom] = await Promise.all([
    api.docGet<Saved | null>('session', null),
    api.docGet<Lineup[]>('lineups', []),
    api.docGet<CrewMember[]>('crew', []),
    api.docGet<Prompt[]>('prompts', []),
    api.docGet<Routine[]>('routines', []),
    api.docGet<Partial<Settings>>('settings', {}),
    api.docGet<number>('zoom', 100),
  ]);
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  void api.termKeepAlive(merged.keepTerminals).catch(() => undefined);
  const base = { lineups, crew, prompts, routines, settings: merged, ready: true, zoom: clampZoom(zoom) };
  if (!saved) {
    useStore.setState(base);
    return;
  }
  useStore.setState({
    ...base,
    workspaces: saved.workspaces,
    activeWs: saved.activeWs,
    tabs: readTabs(saved.tabs),
    activeTab: saved.activeTab,
    drawerWidth: saved.drawerWidth ?? 380,
    panes: Object.fromEntries(Object.entries(saved.panes).map(([k, p]) => [k, restoredPane(p, running.has(k))])),
  });
}

/** Reads saved tracks, turning older layouts into the current form. Tracks that cannot be read are dropped. */
export function readTabs(raw: Record<string, Tab[]>): Record<string, Tab[]> {
  return Object.fromEntries(
    Object.entries(raw ?? {}).map(([ws, list]) => [
      ws,
      (list ?? []).flatMap((t) => {
        const tree = fromSaved(t.tree, uid);
        if (!tree) return [];
        const ids = paneIds(tree);
        return [{ ...t, tree, focus: ids.includes(t.focus) ? t.focus : ids[0], full: null }];
      }),
    ]),
  );
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
export function watchSession(): void {
  useStore.subscribe((s, prev) => {
    if (!s.ready) return;
    if (
      s.workspaces === prev.workspaces &&
      s.tabs === prev.tabs &&
      s.panes === prev.panes &&
      s.activeWs === prev.activeWs &&
      s.activeTab === prev.activeTab &&
      s.drawerWidth === prev.drawerWidth
    )
      return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const c = useStore.getState();
      const saved: Saved = {
        workspaces: c.workspaces,
        activeWs: c.activeWs,
        tabs: c.tabs,
        activeTab: c.activeTab,
        panes: c.panes,
        drawerWidth: c.drawerWidth,
      };
      void api.docSet('session', saved);
    }, 600);
  });
}
