import { useEffect, useRef, useState } from 'react';
import { closePane, closeTab, dropFileOnPane, installEngine, launchLineup, startAgent, startCrew, startShell } from '../lib/actions';
import { pressToDrag, useDrag, type Hover, type Payload } from '../lib/drag';
import { engineById, ENGINES } from '../lib/engines';
import { KEY_STEP, paneIds, RESIZE_FLOOR_PX, resize, splitExtent, type Tree } from '../lib/layout';
import { SIGNAL_LABEL } from '../lib/signals';
import { attach, fitNow, focusTerm, stopAuto } from '../lib/terminals';
import { useStore, type Drawer, type Pane, type Tab } from '../store';
import { CloseIcon, Field, Lamp, Sheet, SplitIcon } from './ui';
import { Drawers } from './Drawers';

const DRAWERS: { id: Drawer; label: string }[] = [
  { id: 'git', label: 'Git' },
  { id: 'files', label: 'Files' },
  { id: 'prompts', label: 'Prompts' },
];

/** Runs a finished drag: a pane moves or swaps, a file's path is typed into a terminal. */
function onDrop(hover: Hover, drag: Payload) {
  const s = useStore.getState();
  if (drag.kind === 'file') {
    if (hover.paneId) dropFileOnPane(hover.paneId, drag);
    return;
  }
  if (hover.onTabbar) s.extractPane(drag.paneId);
  else if (hover.paneId && hover.paneId !== drag.paneId) s.dropPane(drag.paneId, hover.paneId, hover.zone);
}

export function Yard({ wsId }: { wsId: string }) {
  const tabs = useStore((s) => s.tabs[wsId]) ?? [];
  const activeId = useStore((s) => s.activeTab[wsId]);
  const drawer = useStore((s) => s.drawer);
  const drawerWidth = useStore((s) => s.drawerWidth);
  const newTab = useStore((s) => s.newTab);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="yard">
      <div className="yard-main">
        <TabBar wsId={wsId} tabs={tabs} active={active} />
        <div className="grid">
          {active ? (
            active.full && paneIds(active.tree).includes(active.full) ? (
              <PaneView paneId={active.full} focused full />
            ) : (
              <Node tree={active.tree} wsId={wsId} tab={active} />
            )
          ) : (
            <div className="launcher">
              <h2>No tracks open.</h2>
              <button className="btn" onClick={() => newTab(wsId)}>
                New track
              </button>
            </div>
          )}
        </div>
      </div>
      {drawer !== 'none' && (
        <>
          <DrawerHandle />
          <aside className="drawer" style={{ width: drawerWidth }}>
            <Drawers wsId={wsId} tab={active} />
          </aside>
        </>
      )}
      <DragGhost />
    </div>
  );
}

/** A label that follows the pointer while something is dragged. */
function DragGhost() {
  const { payload, x, y, hover } = useDrag();
  const title = useStore((s) => (payload?.kind === 'pane' ? s.panes[payload.paneId]?.title : undefined));
  if (!payload) return null;
  const label = payload.kind === 'pane' ? title : payload.label;
  const where = hover?.onTabbar
    ? payload.kind === 'pane'
      ? 'New track'
      : ''
    : hover?.paneId
      ? payload.kind === 'file'
        ? 'Type path'
        : hover.zone === 'center'
          ? 'Swap'
          : `Move ${hover.zone}`
      : '';
  return (
    <div className="drag-ghost" style={{ left: x + 14, top: y + 12 }}>
      <span className="truncate">{label}</span>
      {where && <span className="drag-where">{where}</span>}
    </div>
  );
}

function DrawerHandle() {
  const setWidth = useStore((s) => s.setDrawerWidth);
  return (
    <div
      className="drawer-handle"
      onMouseDown={(e) => {
        e.preventDefault();
        const move = (m: MouseEvent) => setWidth(window.innerWidth - m.clientX);
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}
    />
  );
}

function TabBar({ wsId, tabs, active }: { wsId: string; tabs: Tab[]; active?: Tab }) {
  const s = useStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const hover = useDrag((d) => d.hover);
  const draggingPane = useDrag((d) => d.payload?.kind === 'pane');
  const many = active ? paneIds(active.tree).length > 1 : false;
  return (
    <div className={`tabbar ${draggingPane && hover?.onTabbar && many ? 'is-drop' : ''}`}>
      <div className="tabs">
        {tabs.map((t) => (
          <div key={t.id} className={`tab ${t.id === active?.id ? 'is-active' : ''}`}>
            {renaming === t.id ? (
              <input
                autoFocus
                defaultValue={t.name}
                maxLength={100}
                onBlur={(e) => {
                  s.renameTab(wsId, t.id, e.target.value.trim().slice(0, 100) || t.name);
                  setRenaming(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setRenaming(null);
                }}
              />
            ) : (
              <button className="tab-name" onClick={() => s.selectTab(wsId, t.id)} onDoubleClick={() => setRenaming(t.id)} title="Double-click to rename">
                {t.name}
              </button>
            )}
            <button className="tab-x" aria-label={`Close ${t.name}`} title="Close track (Ctrl+Shift+W)" onClick={() => void closeTab(wsId, t.id)}>
              <CloseIcon />
            </button>
          </div>
        ))}
        <button className="tab-new" aria-label="New track" title="New track (Ctrl+T)" onClick={() => s.newTab(wsId)}>
          +
        </button>
      </div>
      <div className="drawer-links">
        <button disabled={!many} onClick={() => s.tidyTab()} title="Lay the panes out as an even grid">
          Tidy
        </button>
        <button disabled={!many} onClick={() => s.equalizeTab()} title="Give every pane an equal share (Ctrl+Alt+=)">
          Even
        </button>
        <span className="drawer-sep" />
        {DRAWERS.map((d) => (
          <button key={d.id} className={s.drawer === d.id ? 'is-active' : ''} onClick={() => s.setDrawer(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Node({ tree, wsId, tab }: { tree: Tree; wsId: string; tab: Tab }) {
  if (tree.type === 'pane') return <PaneView paneId={tree.id} focused={tab.focus === tree.id} />;
  const parts: React.ReactNode[] = [];
  tree.kids.forEach((kid, i) => {
    if (i > 0) parts.push(<Divider key={`d${i}`} split={tree} index={i - 1} wsId={wsId} tabId={tab.id} />);
    parts.push(
      <div key={kid.type === 'pane' ? kid.id : kid.id} className="split-side" style={{ flex: `${tree.sizes[i]} 1 0` }} data-side={i}>
        <Node tree={kid} wsId={wsId} tab={tab} />
      </div>,
    );
  });
  return (
    <div className={`split split-${tree.dir}`} data-split-id={tree.id}>
      {parts}
    </div>
  );
}

/**
 * The bar between two children of a split. Dragging moves it live and saves on release.
 * Arrow keys move it by a small step. Splits too small to share stay as they are.
 */
function Divider({ split, index, wsId, tabId }: { split: Extract<Tree, { type: 'split' }>; index: number; wsId: string; tabId: string }) {
  const resizeSplit = useStore((s) => s.resizeSplit);
  const row = split.dir === 'row';
  const measure = (el: HTMLElement) => {
    const box = el.parentElement!;
    const sides = Array.from(box.children).filter((c) => c.classList.contains('split-side')) as HTMLElement[];
    const size = row ? box.clientWidth : box.clientHeight;
    return { sides, extent: splitExtent(size, split.kids.length) };
  };

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { sides, extent } = measure(el);
    if (extent <= RESIZE_FLOOR_PX) return;
    const a = sides[index].getBoundingClientRect();
    const b = sides[index + 1].getBoundingClientRect();
    const start = row ? a.left : a.top;
    const span = row ? b.right - a.left : b.bottom - a.top;
    const pair = split.sizes[index] + split.sizes[index + 1];
    let next = split;
    let frame = 0;
    el.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      const share = (((row ? m.clientX : m.clientY) - start) / Math.max(1, span)) * pair;
      next = resize(split, split.id, index, share, extent) as typeof split;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        sides[index].style.flex = `${next.sizes[index]} 1 0`;
        sides[index + 1].style.flex = `${next.sizes[index + 1]} 1 0`;
      });
    };
    const up = () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (next !== split) resizeSplit(wsId, tabId, split.id, index, next.sizes[index], extent);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const back = row ? 'ArrowLeft' : 'ArrowUp';
    const fwd = row ? 'ArrowRight' : 'ArrowDown';
    if (e.key !== back && e.key !== fwd) return;
    e.preventDefault();
    const { extent } = measure(e.currentTarget);
    const pair = split.sizes[index] + split.sizes[index + 1];
    const share = split.sizes[index] + (e.key === fwd ? KEY_STEP : -KEY_STEP) * pair;
    resizeSplit(wsId, tabId, split.id, index, share, extent);
  }

  return (
    <div
      className="divider"
      role="separator"
      tabIndex={0}
      aria-orientation={row ? 'vertical' : 'horizontal'}
      aria-label={row ? 'Drag to change pane widths' : 'Drag to change pane heights'}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}

function PaneView({ paneId, focused, full = false }: { paneId: string; focused: boolean; full?: boolean }) {
  const pane = useStore((s) => s.panes[paneId]);
  const split = useStore((s) => s.split);
  const focusPane = useStore((s) => s.focusPane);
  const toggleFull = useStore((s) => s.toggleFull);
  const hover = useDrag((d) => (d.hover?.paneId === paneId ? d.hover : null));
  const dragKind = useDrag((d) => d.payload?.kind);
  const draggingMe = useDrag((d) => d.payload?.kind === 'pane' && d.payload.paneId === paneId);
  const slot = useRef<HTMLDivElement>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const hasTerm = pane && pane.kind !== 'empty' && !pane.asleep;
  const runKey = pane ? `${pane.kind}:${pane.startup ?? ''}:${pane.asleep ?? false}:${pane.title}` : '';

  useEffect(() => {
    if (!hasTerm || !slot.current) return;
    attach(paneId, slot.current);
    const el = slot.current;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitNow(paneId));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [paneId, hasTerm, runKey]);

  useEffect(() => {
    if (focused && hasTerm) focusTerm(paneId);
  }, [focused, hasTerm, paneId]);

  if (!pane) return null;
  const engine = engineById(pane.engine);
  const canRestart = pane.kind === 'shell' && pane.signal === 'ended' && engine;
  const showDrop = hover && !draggingMe && (dragKind === 'pane' || (dragKind === 'file' && hasTerm));
  const zone = dragKind === 'file' ? 'center' : hover?.zone;

  return (
    <div
      className={`pane signal-${pane.signal} ${focused ? 'is-focused' : ''} ${draggingMe ? 'is-dragged' : ''}`}
      data-pane-id={paneId}
      tabIndex={-1}
      onMouseDownCapture={() => focusPane(paneId)}
    >
      <header
        className="pane-head"
        onPointerDown={(e) => pressToDrag(e, { kind: 'pane', paneId }, onDrop)}
        onDoubleClick={(e) => !(e.target as Element).closest('button') && toggleFull(paneId)}
      >
        <Lamp signal={pane.signal} />
        <span className="pane-title truncate">{pane.title}</span>
        <span className="pane-state">{pane.kind === 'empty' ? '' : SIGNAL_LABEL[pane.signal]}</span>
        {pane.auto && (
          <button className="chip-auto" onClick={() => stopAuto(paneId)} title="Stop Auto">
            Auto {pane.auto.rounds}/{pane.auto.max}
          </button>
        )}
        {pane.lastCommand && pane.kind === 'shell' ? (
          <span className="pane-cwd is-command truncate" title={pane.lastCommand}>
            {pane.lastCommand}
          </span>
        ) : (
          <span className="pane-cwd truncate" title={pane.cwd}>
            <bdi>{pane.cwd}</bdi>
          </span>
        )}
        <div className="pane-actions">
          {canRestart && (
            <button className="text-btn" onClick={() => startAgent(paneId, engine.id, { title: pane.title })}>
              Start again
            </button>
          )}
          {pane.kind === 'agent' && !pane.asleep && !pane.auto && (
            <button className="text-btn" onClick={() => setAutoOpen(true)}>
              Auto
            </button>
          )}
          {!full && (
            <>
              <button aria-label="Split right" title="Split right (Ctrl+D)" onClick={() => split(paneId, 'row')}>
                <SplitIcon dir="row" />
              </button>
              <button aria-label="Split down" title="Split down (Ctrl+Shift+D)" onClick={() => split(paneId, 'column')}>
                <SplitIcon dir="column" />
              </button>
            </>
          )}
          <button
            aria-label={full ? 'Show all panes' : 'Fill the track'}
            title={full ? 'Show all panes (Esc)' : 'Fill the track (double-click the header)'}
            onClick={() => toggleFull(paneId)}
          >
            <FullIcon full={full} />
          </button>
          <button aria-label="Close pane" title="Close pane (Ctrl+W)" onClick={() => void closePane(paneId)}>
            <CloseIcon />
          </button>
        </div>
      </header>
      <div className="pane-body">
        {pane.kind === 'empty' && <Launcher paneId={paneId} />}
        {pane.asleep && <Asleep pane={pane} />}
        {hasTerm && <div ref={slot} className="term-slot" />}
        {showDrop && <div className={`drop-mark drop-${zone}`} />}
      </div>
      {autoOpen && <AutoSheet paneId={paneId} onClose={() => setAutoOpen(false)} />}
    </div>
  );
}

function FullIcon({ full }: { full: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      {full ? <path d="M5.5 1.5v4h-4M8.5 1.5v4h4M5.5 12.5v-4h-4M8.5 12.5v-4h4" /> : <path d="M1.5 5V1.5H5M9 1.5h3.5V5M1.5 9v3.5H5M12.5 9v3.5H9" />}
    </svg>
  );
}

function Launcher({ paneId }: { paneId: string }) {
  const installed = useStore((s) => s.installed);
  const crew = useStore((s) => s.crew);
  const lineups = useStore((s) => s.lineups);
  const pane = useStore((s) => s.panes[paneId]);
  const ready = ENGINES.filter((e) => installed[e.command]);
  const missing = ENGINES.filter((e) => !installed[e.command]);
  return (
    <div className="launcher">
      <h2>What runs on this track?</h2>
      <div className="launcher-list">
        {ready.map((e) => (
          <button key={e.id} onClick={() => startAgent(paneId, e.id)}>
            {e.name}
          </button>
        ))}
        <button onClick={() => startShell(paneId)}>Plain shell</button>
      </div>
      {crew.length > 0 && (
        <>
          <h3>Crew</h3>
          <div className="launcher-list">
            {crew.map((c) => (
              <button key={c.id} onClick={() => startCrew(paneId, c)}>
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
      {lineups.length > 0 && (
        <>
          <h3>Lineups</h3>
          <div className="launcher-list">
            {lineups.map((l) => (
              <button key={l.id} onClick={() => launchLineup(l, pane.wsId)}>
                {l.name}
              </button>
            ))}
          </div>
        </>
      )}
      {missing.length > 0 && (
        <p className="launcher-missing">
          Not on this computer:{' '}
          {missing.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              <button className="link" onClick={() => installEngine(e.id)}>
                {e.name}
              </button>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function Asleep({ pane }: { pane: Pane }) {
  const engine = engineById(pane.engine);
  return (
    <div className="launcher">
      <h2>{pane.title} ran here last time.</h2>
      <div className="row">
        {engine?.resume && (
          <button className="btn" onClick={() => startAgent(pane.id, engine.id, { resume: true, title: pane.title })}>
            Continue the last chat
          </button>
        )}
        {engine ? (
          <button className={engine.resume ? 'btn-quiet' : 'btn'} onClick={() => startAgent(pane.id, engine.id, { title: pane.title })}>
            Start fresh
          </button>
        ) : (
          <button className="btn" onClick={() => startShell(pane.id, pane.startup, pane.title)}>
            Run it again
          </button>
        )}
      </div>
    </div>
  );
}

function AutoSheet({ paneId, onClose }: { paneId: string; onClose: () => void }) {
  const patchPane = useStore((s) => s.patchPane);
  const [goal, setGoal] = useState('');
  const [max, setMax] = useState(8);
  return (
    <Sheet title="Auto" onClose={onClose}>
      <Field label="Goal">
        <textarea autoFocus rows={4} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </Field>
      <Field label="Most rounds">
        <input type="number" min={1} max={50} value={max} onChange={(e) => setMax(Number(e.target.value) || 1)} />
      </Field>
      <div className="row end">
        <button className="btn-quiet" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn"
          disabled={!goal.trim()}
          onClick={() => {
            patchPane(paneId, { auto: { goal: goal.trim(), rounds: 0, max } });
            onClose();
          }}
        >
          Start Auto
        </button>
      </div>
    </Sheet>
  );
}
