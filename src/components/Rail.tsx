import { open } from '@tauri-apps/plugin-dialog';
import { paneIds } from '../lib/layout';
import { worstSignal } from '../lib/signals';
import { removeWorkspace } from '../lib/actions';
import { useStore, type View } from '../store';
import { Lamp } from './ui';

const LINKS: { view: View; label: string }[] = [
  { view: 'board', label: 'Board' },
  { view: 'crew', label: 'Crew' },
  { view: 'lineups', label: 'Lineups' },
  { view: 'routines', label: 'Routines' },
  { view: 'agents', label: 'Coding tools' },
  { view: 'activity', label: 'Activity' },
  { view: 'settings', label: 'Settings' },
];

function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 1024 1024" aria-hidden="true" fill="none" strokeLinecap="round" strokeWidth="84">
      <path d="M250 800V224" stroke="#efe8da" />
      <path d="M250 610C250 470 512 500 512 330V224" stroke="#efe8da" />
      <path d="M250 610C250 500 774 560 774 330V224" stroke="#f0a23a" />
    </svg>
  );
}

export function Rail() {
  const s = useStore();
  const allPanes = Object.values(s.panes);
  const waiting = allPanes.filter((p) => p.signal === 'needs');
  const unread = s.activity.filter((a) => !a.read).length;

  async function addFolder() {
    const picked = await open({ directory: true, title: 'Add a folder' });
    if (typeof picked === 'string') s.addWorkspace(picked);
  }

  return (
    <nav className="rail">
      <div className="brand">
        <Mark />
        <span>Switchyard</span>
      </div>

      {waiting.length > 0 && (
        <section className="waiting">
          <h3>Needs you</h3>
          {waiting.map((p) => (
            <button key={p.id} className="waiting-row" onClick={() => s.jumpToPane(p.id)}>
              <Lamp signal="needs" />
              <span>{p.title}</span>
            </button>
          ))}
        </section>
      )}

      <section className="line">
        {s.workspaces.map((w) => {
          const tabs = s.tabs[w.id] ?? [];
          const ids = tabs.flatMap((t) => paneIds(t.tree));
          const panes = ids.map((id) => s.panes[id]).filter((p) => p && p.kind !== 'empty');
          const active = s.activeWs === w.id && s.view === 'yard';
          const open_ = s.activeWs === w.id;
          return (
            <div key={w.id} className={`station ${active ? 'is-active' : ''}`}>
              <div className="station-head">
                <button className="station-name" title={w.root} onClick={() => s.selectWorkspace(w.id)}>
                  <span className="node">
                    <Lamp signal={worstSignal(panes.map((p) => p.signal))} size={11} />
                  </span>
                  <span className="truncate">{w.name}</span>
                </button>
                <button className="station-x" aria-label={`Remove ${w.name}`} onClick={() => void removeWorkspace(w.id)}>
                  Remove
                </button>
              </div>
              {open_ &&
                panes.map((p) => (
                  <button key={p.id} className="spur" onClick={() => s.jumpToPane(p.id)} title={p.cwd}>
                    <Lamp signal={p.signal} size={7} />
                    <span className="truncate">{p.title}</span>
                  </button>
                ))}
            </div>
          );
        })}
        <button className="add-folder" onClick={() => void addFolder()}>
          Add a folder
        </button>
      </section>

      <section className="links">
        {LINKS.map((l) => (
          <button
            key={l.view}
            className={s.view === l.view ? 'is-active' : ''}
            onClick={() => {
              s.setView(l.view);
              if (l.view === 'activity') s.markAllRead();
            }}
          >
            {l.label}
            {l.view === 'activity' && unread > 0 && <span className="count">{unread}</span>}
          </button>
        ))}
      </section>
    </nav>
  );
}
