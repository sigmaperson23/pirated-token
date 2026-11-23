import { create } from 'zustand';
import { DRAG_START_PX, dropZone, type Zone } from './layout';

/** What is being dragged: a pane by its header, or an entry from the Files drawer. */
export type Payload = { kind: 'pane'; paneId: string } | { kind: 'file'; wsId: string; relativePath: string; isDir: boolean; label: string };

/** Where a drop would land. `paneId` null with `onTabbar` true means a new track. */
export interface Hover {
  paneId: string | null;
  zone: Zone;
  onTabbar: boolean;
}

interface DragState {
  payload: Payload | null;
  x: number;
  y: number;
  hover: Hover | null;
}

export const useDrag = create<DragState>(() => ({ payload: null, x: 0, y: 0, hover: null }));

/** Reads what lies under the pointer. Panes carry data-pane-id; the header counts as the centre. */
export function hoverAt(x: number, y: number): Hover | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  if (el.closest('.tabbar')) return { paneId: null, zone: 'center', onTabbar: true };
  const pane = el.closest<HTMLElement>('[data-pane-id]');
  if (!pane?.dataset.paneId) return null;
  const onHeader = !!el.closest('.pane-head');
  const body = pane.querySelector<HTMLElement>(':scope > .pane-body') ?? pane;
  return { paneId: pane.dataset.paneId, zone: dropZone(body.getBoundingClientRect(), x, y, onHeader), onTabbar: false };
}

const IGNORED = 'button, input, textarea, select, a';

/**
 * Starts watching a press that may become a drag. It becomes one after the pointer travels
 * a few pixels. Escape, leaving the window or a cancelled pointer stop it without a drop.
 */
export function pressToDrag(e: React.PointerEvent, payload: Payload, onDrop: (hover: Hover, payload: Payload) => void, fromButton = false) {
  if (e.button !== 0) return;
  if (!fromButton && (e.target as Element).closest(IGNORED)) return;
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;

  const end = () => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', end, true);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('blur', end);
    useDrag.setState({ payload: null, hover: null });
    document.body.classList.remove('is-dragging');
  };
  const move = (m: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(m.clientX - startX, m.clientY - startY) < DRAG_START_PX) return;
      dragging = true;
      document.body.classList.add('is-dragging');
    }
    useDrag.setState({ payload, x: m.clientX, y: m.clientY, hover: hoverAt(m.clientX, m.clientY) });
  };
  const up = (u: PointerEvent) => {
    const hover = dragging ? hoverAt(u.clientX, u.clientY) : null;
    end();
    if (hover) onDrop(hover, payload);
  };
  const key = (k: KeyboardEvent) => {
    if (k.key !== 'Escape' || !dragging) return;
    k.preventDefault();
    k.stopPropagation();
    end();
  };
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', end, true);
  window.addEventListener('keydown', key, true);
  window.addEventListener('blur', end);
}
