import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open } from '@tauri-apps/plugin-dialog';
import { useEffect } from 'react';
import { checkRoutines, closePane, closeTab, dropPathsOnPane, refreshInstalled } from './lib/actions';
import { useDrag } from './lib/drag';
import { readKey, type Command } from './lib/keys';
import { nearestPane } from './lib/layout';
import { bootTerminals, dropUnclaimed, focusTerm } from './lib/terminals';
import { activeTabOf, loadSession, useStore, watchSession } from './store';
import { Rail } from './components/Rail';
import { ActivityView, AgentsView, BoardView, CrewView, LineupsView, RoutinesView, SettingsView } from './components/Views';
import { Yard } from './components/Yard';

function focusedPaneId(): string | undefined {
  return activeTabOf(useStore.getState())?.focus;
}

function nextWaiting() {
  const s = useStore.getState();
  const waiting = Object.values(s.panes).filter((p) => p.signal === 'needs');
  if (waiting.length === 0) return;
  const here = waiting.findIndex((p) => p.id === focusedPaneId());
  s.jumpToPane(waiting[(here + 1) % waiting.length].id);
}

const inside = (e: Event, selector: string) => e.target instanceof Element && e.target.closest(selector) !== null;

/** Focus moves to a pane by arrow, picking the nearest pane on screen in that direction. */
function focusWay(way: 'left' | 'right' | 'up' | 'down') {
  const from = focusedPaneId();
  if (!from) return;
  const panes = Array.from(document.querySelectorAll<HTMLElement>('.grid [data-pane-id]')).map((el) => ({
    id: el.dataset.paneId!,
    rect: el.getBoundingClientRect(),
  }));
  const to = nearestPane(panes, from, way);
  if (!to) return;
  useStore.getState().focusPane(to);
  focusTerm(to);
}

/** Runs one command. Returns false when the key should go on to the page as usual. */
function run(c: Command, e: KeyboardEvent): boolean {
  const s = useStore.getState();
  const id = focusedPaneId();
  switch (c.do) {
    case 'zoom':
      if (c.step === 0) s.setZoom(100);
      else s.stepZoom(c.step);
      e.stopPropagation();
      return true;
    case 'escape':
      // A drag cancels itself; a terminal keeps Escape for its program.
      if (useDrag.getState().payload) return false;
      if (inside(e, '.xterm')) return false;
      return s.exitFull();
    case 'toggleDrawer':
      s.setDrawer(s.drawer === 'none' ? 'files' : s.drawer);
      return true;
    case 'showFiles':
      if (s.drawer !== 'files') s.setDrawer('files');
      return true;
    case 'swap':
      if (id) s.swapStep(c.offset);
      return true;
    case 'focusWay':
      focusWay(c.way);
      return true;
    case 'equalize':
      s.equalizeTab();
      return true;
    case 'split':
      if (id) s.split(id, c.dir);
      else if (s.activeWs) s.newTab(s.activeWs);
      return true;
    case 'newTab':
      if (c.fromTerminal) e.stopPropagation();
      if (s.activeWs) s.newTab(s.activeWs);
      return true;
    case 'closePane':
      if (id) void closePane(id);
      return true;
    case 'closeTab': {
      const t = activeTabOf(s);
      if (t && s.activeWs) void closeTab(s.activeWs, t.id);
      return true;
    }
    case 'tabStep':
      s.tabStep(c.offset);
      return true;
    case 'focusStep':
      s.focusStep(c.offset);
      return true;
    case 'nextWaiting':
      nextWaiting();
      return true;
    case 'board':
      s.setView('board');
      return true;
    case 'swallow':
      return true;
  }
}

function shortcuts(e: KeyboardEvent) {
  const s = useStore.getState();
  if (!s.ready) return;
  const c = readKey(e, {
    inTerminal: inside(e, '.xterm'),
    inDialog: inside(e, '[role="dialog"], .scrim, .menu'),
  });
  // Layout keys belong to the yard. Zoom, the drawer and the board work from every view.
  const yardOnly = c && !['zoom', 'toggleDrawer', 'showFiles', 'nextWaiting', 'board', 'escape'].includes(c.do);
  if (!c || (yardOnly && s.view !== 'yard')) return;
  if (run(c, e)) e.preventDefault();
}

/** Applies the zoom level to the whole window. */
function useZoom() {
  const zoom = useStore((s) => s.zoom);
  useEffect(() => {
    void getCurrentWebview()
      .setZoom(zoom / 100)
      .catch(() => undefined);
  }, [zoom]);
}

/** Files dragged in from the computer type their paths into the pane they land on. */
function useFileDrops() {
  useEffect(() => {
    let stop: (() => void) | undefined;
    let gone = false;
    void getCurrentWebview()
      .onDragDropEvent(async (event) => {
        if (event.payload.type !== 'drop') return;
        const scale = window.devicePixelRatio || 1;
        const { x, y } = event.payload.position;
        const el = document.elementFromPoint(x / scale, y / scale);
        const paneId = el?.closest<HTMLElement>('[data-pane-id]')?.dataset.paneId;
        if (paneId) dropPathsOnPane(paneId, event.payload.paths);
      })
      .then((un) => (gone ? un() : (stop = un)));
    return () => {
      gone = true;
      stop?.();
    };
  }, []);
}

export function App() {
  const ready = useStore((s) => s.ready);
  const view = useStore((s) => s.view);
  const activeWs = useStore((s) => s.activeWs);
  const toast = useStore((s) => s.toast);
  const setToast = useStore((s) => s.setToast);
  useZoom();
  useFileDrops();

  useEffect(() => {
    void bootTerminals()
      .then(loadSession)
      .then(() => {
        dropUnclaimed(new Set(Object.keys(useStore.getState().panes)));
        watchSession();
      });
    refreshInstalled();
    window.addEventListener('keydown', shortcuts, true);
    const routines = setInterval(() => checkRoutines(), 20_000);
    return () => {
      window.removeEventListener('keydown', shortcuts, true);
      clearInterval(routines);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  if (!ready) return <div className="app" />;

  return (
    <div className="app">
      <Rail />
      <main className="stage">
        {view === 'yard' && (activeWs ? <Yard key={activeWs} wsId={activeWs} /> : <Welcome />)}
        {view === 'board' && <BoardView />}
        {view === 'crew' && <CrewView />}
        {view === 'lineups' && <LineupsView />}
        {view === 'routines' && <RoutinesView />}
        {view === 'activity' && <ActivityView />}
        {view === 'agents' && <AgentsView />}
        {view === 'settings' && <SettingsView />}
      </main>
      {toast && (
        <button className="toast" onClick={() => setToast(null)}>
          {toast}
        </button>
      )}
    </div>
  );
}

function Welcome() {
  const addWorkspace = useStore((s) => s.addWorkspace);
  return (
    <div className="welcome">
      <h1>Bring a project into the yard.</h1>
      <button
        className="btn"
        onClick={async () => {
          const picked = await open({ directory: true, title: 'Add a folder' });
          if (typeof picked === 'string') addWorkspace(picked);
        }}
      >
        Add a folder
      </button>
    </div>
  );
}
