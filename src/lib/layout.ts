/**
 * Pane layout for one track. A track is a tree: a split holds two or more children side by side
 * ('row') or stacked ('column'), each with a share of the space. Every function is pure and
 * returns null when a change is not allowed, so callers keep the old tree.
 */
export type Dir = 'row' | 'column';
export type Edge = 'left' | 'right' | 'top' | 'bottom';
export type Zone = Edge | 'center';
export type Way = 'left' | 'right' | 'up' | 'down';

export type Tree =
  | { type: 'pane'; id: string }
  | { type: 'split'; id: string; dir: Dir; kids: Tree[]; sizes: number[] };

/** Most nodes (panes plus splits) in one track. */
export const MAX_NODES = 64;
/** Deepest nesting in one track. */
export const MAX_DEPTH = 16;
/** Most panes side by side in one row. A fifth one wraps the row in two. */
export const MAX_ROW = 4;
/** Most tracks in one folder. */
export const MAX_TABS = 32;
/** Width of the gap a divider takes, in pixels. */
export const DIVIDER_PX = 8;
/** Smallest pane, in pixels, when the split has room for it. */
export const MIN_PANE_PX = 140;
/** A split this size or smaller does not resize. */
export const RESIZE_FLOOR_PX = 280;
/** Share of a pair one arrow key moves a divider. */
export const KEY_STEP = 0.04;
/** Pointer inside this share of a pane's edge docks to that edge. */
export const EDGE_ZONE = 0.25;
/** Pointer travel before a header drag starts. */
export const DRAG_START_PX = 6;

export type MakeId = () => string;
const newId: MakeId = () => crypto.randomUUID();

export const leaf = (id: string): Tree => ({ type: 'pane', id });

export const evenSizes = (n: number) => Array.from({ length: n }, () => 1 / Math.max(1, n));

function normalize(sizes: number[]): number[] {
  const clean = sizes.map((s) => (Number.isFinite(s) && s > 0 ? s : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  return sum > 0 ? clean.map((s) => s / sum) : evenSizes(sizes.length);
}

const without = <T>(list: T[], i: number) => [...list.slice(0, i), ...list.slice(i + 1)];
const insertAt = <T>(list: T[], i: number, item: T) => [...list.slice(0, i), item, ...list.slice(i)];
const replaceAt = <T>(list: T[], i: number, item: T) => list.map((x, k) => (k === i ? item : x));

/** Pane ids in reading order. This order drives focus, swap and close. */
export function paneIds(t: Tree): string[] {
  return t.type === 'pane' ? [t.id] : t.kids.flatMap(paneIds);
}

export function contains(t: Tree, id: string): boolean {
  return t.type === 'pane' ? t.id === id : t.kids.some((k) => contains(k, id));
}

function countNodes(t: Tree): number {
  return t.type === 'pane' ? 1 : 1 + t.kids.reduce((n, k) => n + countNodes(k), 0);
}

function depth(t: Tree): number {
  return t.type === 'pane' ? 1 : 1 + Math.max(...t.kids.map(depth));
}

/** True when the tree is one Switchyard can draw and save. */
export function isValid(t: Tree): boolean {
  if (countNodes(t) > MAX_NODES || depth(t) > MAX_DEPTH) return false;
  const ok = (n: Tree): boolean => {
    if (n.type === 'pane') return true;
    if (n.kids.length < 2 || n.kids.length > MAX_NODES || n.sizes.length !== n.kids.length) return false;
    if (n.sizes.some((s) => !(s > 0) || !Number.isFinite(s))) return false;
    if (Math.abs(n.sizes.reduce((a, b) => a + b, 0) - 1) > 0.001) return false;
    return n.kids.every(ok);
  };
  return ok(t) && new Set(paneIds(t)).size === paneIds(t).length;
}

/** Returns `next` when it is valid, else null. */
export const checked = (next: Tree | null): Tree | null => (next && isValid(next) ? next : null);

/** Wraps a row that grew past four panes into two stacked rows: the first four, then the rest. */
function wrapRow(rowId: string, kids: Tree[], makeId: MakeId): Tree {
  const row = (items: Tree[], id: string): Tree =>
    items.length === 1 ? items[0] : { type: 'split', id, dir: 'row', kids: items, sizes: evenSizes(items.length) };
  return {
    type: 'split',
    id: makeId(),
    dir: 'column',
    kids: [row(kids.slice(0, MAX_ROW), rowId), row(kids.slice(MAX_ROW), makeId())],
    sizes: [0.5, 0.5],
  };
}

/**
 * Puts a new pane right after `target` along `dir`. When the target already sits in a split
 * of that direction, the new pane joins it and all shares even out.
 */
export function splitPane(t: Tree, target: string, dir: Dir, added: string, makeId: MakeId = newId): Tree | null {
  const walk = (n: Tree): Tree | null => {
    if (n.type === 'pane') {
      return n.id === target ? { type: 'split', id: makeId(), dir, kids: [n, leaf(added)], sizes: [0.5, 0.5] } : null;
    }
    if (n.dir === dir) {
      const at = n.kids.findIndex((k) => k.type === 'pane' && k.id === target);
      if (at >= 0) {
        const kids = insertAt(n.kids, at + 1, leaf(added));
        return dir === 'row' && kids.length > MAX_ROW ? wrapRow(n.id, kids, makeId) : { ...n, kids, sizes: evenSizes(kids.length) };
      }
    }
    for (let i = 0; i < n.kids.length; i++) {
      const done = walk(n.kids[i]);
      if (!done) continue;
      // A wrapped row inside a column joins that column instead of nesting a column in a column.
      if (n.dir === 'column' && done.type === 'split' && done.dir === 'column') {
        const kids = [...n.kids.slice(0, i), ...done.kids, ...n.kids.slice(i + 1)];
        return { ...n, kids, sizes: evenSizes(kids.length) };
      }
      return { ...n, kids: replaceAt(n.kids, i, done) };
    }
    return null;
  };
  return checked(walk(t));
}

/** Takes a pane out. Its siblings share its space. Returns null when the tree is left empty. */
export function removePane(t: Tree, target: string): Tree | null {
  if (t.type === 'pane') return t.id === target ? null : t;
  const at = t.kids.findIndex((k) => contains(k, target));
  if (at < 0) return t;
  const inner = removePane(t.kids[at], target);
  if (inner) return { ...t, kids: replaceAt(t.kids, at, inner) };
  const kids = without(t.kids, at);
  if (kids.length === 1) return kids[0];
  return { ...t, kids, sizes: normalize(without(t.sizes, at)) };
}

/** Where focus goes after a pane closes: the pane before it in reading order, else the first. */
export function focusAfterClose(before: Tree, after: Tree, closed: string, focus: string): string {
  if (focus !== closed) return focus;
  const left = paneIds(after);
  const at = paneIds(before).indexOf(closed);
  return left[Math.min(Math.max(at - 1, 0), left.length - 1)];
}

/** Merges a split into its parent when both run the same way, keeping each pane's real share. */
export function flatten(t: Tree): Tree {
  if (t.type === 'pane') return t;
  const kids: Tree[] = [];
  const sizes: number[] = [];
  t.kids.forEach((k, i) => {
    const f = flatten(k);
    const share = t.sizes[i] ?? 0;
    if (f.type === 'split' && f.dir === t.dir) {
      f.kids.forEach((g, j) => {
        kids.push(g);
        sizes.push(share * (f.sizes[j] ?? 0));
      });
    } else {
      kids.push(f);
      sizes.push(share);
    }
  });
  return { ...t, kids, sizes: normalize(sizes) };
}

/** A text form of the arrangement without sizes, used to tell if a move changed anything. */
export function shape(t: Tree): string {
  return t.type === 'pane' ? t.id : `${t.dir}(${t.kids.map(shape).join(',')})`;
}

function placeBeside(t: Tree, target: string, moved: Tree, dir: Dir, after: boolean, makeId: MakeId): Tree | null {
  if (t.type === 'pane') {
    if (t.id !== target) return null;
    return { type: 'split', id: makeId(), dir, kids: after ? [t, moved] : [moved, t], sizes: [0.5, 0.5] };
  }
  if (t.dir === dir) {
    const at = t.kids.findIndex((k) => k.type === 'pane' && k.id === target);
    if (at >= 0) {
      const kids = insertAt(t.kids, after ? at + 1 : at, moved);
      return dir === 'row' && kids.length > MAX_ROW ? null : { ...t, kids, sizes: evenSizes(kids.length) };
    }
  }
  const at = t.kids.findIndex((k) => contains(k, target));
  if (at < 0) return null;
  const inner = placeBeside(t.kids[at], target, moved, dir, after, makeId);
  return inner ? { ...t, kids: replaceAt(t.kids, at, inner) } : null;
}

/**
 * Moves `source` to the `edge` of `target`. Refused when a row would pass four panes,
 * and when the arrangement would come out the same.
 */
export function dock(t: Tree, source: string, target: string, edge: Edge, makeId: MakeId = newId): Tree | null {
  if (source === target || !contains(t, target) || !contains(t, source)) return null;
  const rest = removePane(t, source);
  if (!rest) return null;
  const dir: Dir = edge === 'left' || edge === 'right' ? 'row' : 'column';
  const next = placeBeside(flatten(rest), target, leaf(source), dir, edge === 'right' || edge === 'bottom', makeId);
  if (!next || shape(next) === shape(flatten(t))) return null;
  return checked(next);
}

/** What a drop does: dock on an edge when that works, else swap the two panes. */
export function dropAction(t: Tree, source: string, target: string, zone: Zone): { kind: 'dock'; edge: Edge } | { kind: 'swap' } | null {
  if (source === target || !contains(t, source) || !contains(t, target)) return null;
  if (zone !== 'center' && dock(t, source, target, zone, () => 'preview')) return { kind: 'dock', edge: zone };
  return { kind: 'swap' };
}

/** Which part of a pane the pointer is over. The header always counts as the centre. */
export function dropZone(rect: { left: number; top: number; width: number; height: number }, x: number, y: number, onHeader = false): Zone {
  if (onHeader || !(rect.width > 0) || !(rect.height > 0)) return 'center';
  const fx = (x - rect.left) / rect.width;
  const fy = (y - rect.top) / rect.height;
  const near: [Edge, number][] = [
    ['left', fx],
    ['right', 1 - fx],
    ['top', fy],
    ['bottom', 1 - fy],
  ];
  const [edge, dist] = near.reduce((best, c) => (c[1] < best[1] ? c : best));
  return dist < EDGE_ZONE ? edge : 'center';
}

/** Trades the places of two panes. */
export function swapPanes(t: Tree, x: string, y: string): Tree {
  if (x === y) return t;
  if (t.type === 'pane') return t.id === x ? leaf(y) : t.id === y ? leaf(x) : t;
  return { ...t, kids: t.kids.map((k) => swapPanes(k, x, y)) };
}

/** The pane `offset` steps from `id` in reading order, wrapping at both ends. */
export function stepFrom(ids: string[], id: string, offset: number): string | null {
  if (ids.length < 2) return null;
  const at = ids.indexOf(id);
  if (at < 0) return null;
  return ids[(at + offset + ids.length) % ids.length];
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * The pane to move focus to with an arrow. It must lie fully past the current pane's edge.
 * Panes that overlap on the other axis win; then the smallest gap; then the closest centre.
 */
export function nearestPane(panes: { id: string; rect: Rect }[], from: string, way: Way): string | null {
  const me = panes.find((p) => p.id === from)?.rect;
  if (!me) return null;
  const cx = me.left + me.width / 2;
  const cy = me.top + me.height / 2;
  const beyond = panes.filter(({ id, rect: r }) => {
    if (id === from) return false;
    if (way === 'left') return r.right <= me.left + 1;
    if (way === 'right') return r.left >= me.right - 1;
    if (way === 'up') return r.bottom <= me.top + 1;
    return r.top >= me.bottom - 1;
  });
  if (beyond.length === 0) return null;
  const sideways = way === 'left' || way === 'right';
  const overlap = beyond.filter(({ rect: r }) =>
    sideways ? r.bottom > me.top && r.top < me.bottom : r.right > me.left && r.left < me.right,
  );
  const pool = overlap.length > 0 ? overlap : beyond;
  const gap = (r: Rect) =>
    way === 'left' ? me.left - r.right : way === 'right' ? r.left - me.right : way === 'up' ? me.top - r.bottom : r.top - me.bottom;
  const centre = (r: Rect) => Math.abs(r.left + r.width / 2 + (r.top + r.height / 2) - (cx + cy));
  let best = pool[0];
  for (const c of pool.slice(1)) {
    const a = gap(c.rect);
    const b = gap(best.rect);
    if (Math.abs(a - b) > 0.5 ? a < b : centre(c.rect) < centre(best.rect)) best = c;
  }
  return best.id;
}

/** Smallest share one side of a split may get, in pixels. */
export const minPanePx = (extentPx: number, count: number) => Math.min(MIN_PANE_PX, extentPx / Math.max(1, count));

/** The usable length of a split: its size minus the dividers. */
export const splitExtent = (sizePx: number, count: number) => sizePx - DIVIDER_PX * (count - 1);

/**
 * Sets the share of child `index` in split `splitId`. Only that child and the next one change,
 * and their total stays the same. Each keeps at least its minimum size.
 */
export function resize(t: Tree, splitId: string, index: number, share: number, extentPx: number): Tree {
  if (t.type === 'pane') return t;
  if (t.id !== splitId) {
    const kids = t.kids.map((k) => resize(k, splitId, index, share, extentPx));
    return kids.every((k, i) => k === t.kids[i]) ? t : { ...t, kids };
  }
  if (index < 0 || index + 1 >= t.sizes.length || !Number.isFinite(extentPx) || extentPx <= RESIZE_FLOOR_PX) return t;
  const pair = t.sizes[index] + t.sizes[index + 1];
  const floor = Math.min(minPanePx(extentPx, t.kids.length) / extentPx, pair / 2);
  const first = Math.min(Math.max(share, floor), pair - floor);
  const sizes = [...t.sizes];
  sizes[index] = first;
  sizes[index + 1] = pair - first;
  return { ...t, sizes };
}

/** Gives every child of every split an equal share. The arrangement stays as it is. */
export function equalize(t: Tree): Tree {
  return t.type === 'pane' ? t : { ...t, kids: t.kids.map(equalize), sizes: evenSizes(t.kids.length) };
}

/** How many panes go in one row of a fresh grid. */
export function perRow(n: number): number {
  if (n <= 4) return 2;
  if (n <= 6) return 3;
  return Math.min(MAX_ROW, Math.max(2, Math.ceil(Math.sqrt((n * 16) / 9))));
}

/** Lays panes out as rows, in order: 2 side by side, 3 as two over one, 4 as 2x2, 5 as three over two. */
export function tile(ids: string[], makeId: MakeId = newId): Tree {
  if (ids.length === 0) throw new Error('tile needs at least one pane');
  if (ids.length === 1) return leaf(ids[0]);
  const per = perRow(ids.length);
  const rows: Tree[] = [];
  for (let i = 0; i < ids.length; i += per) {
    const chunk = ids.slice(i, i + per).map(leaf);
    rows.push(chunk.length === 1 ? chunk[0] : { type: 'split', id: makeId(), dir: 'row', kids: chunk, sizes: evenSizes(chunk.length) });
  }
  return rows.length === 1 ? rows[0] : { type: 'split', id: makeId(), dir: 'column', kids: rows, sizes: evenSizes(rows.length) };
}

/** Lays the same panes out again as a fresh grid, in reading order. */
export const tidy = (t: Tree, makeId: MakeId = newId) => tile(paneIds(t), makeId);

/** Reads a saved tree, including the older two-child form. Returns null when it cannot be used. */
export function fromSaved(raw: unknown, makeId: MakeId = newId): Tree | null {
  const read = (n: any): Tree | null => {
    if (!n || typeof n !== 'object') return null;
    if (n.type === 'pane' && typeof n.id === 'string') return leaf(n.id);
    if (n.type !== 'split') return null;
    const dir: Dir = n.dir === 'column' ? 'column' : 'row';
    if (Array.isArray(n.kids)) {
      const kids = n.kids.map(read);
      if (kids.some((k: Tree | null) => !k)) return null;
      const sizes = Array.isArray(n.sizes) && n.sizes.length === kids.length ? normalize(n.sizes) : evenSizes(kids.length);
      return { type: 'split', id: typeof n.id === 'string' ? n.id : makeId(), dir, kids, sizes };
    }
    // The older form had exactly two children, a and b, and one ratio.
    const a = read(n.a);
    const b = read(n.b);
    if (!a || !b) return null;
    const r = Number.isFinite(n.ratio) ? Math.min(0.9, Math.max(0.1, n.ratio)) : 0.5;
    return { type: 'split', id: makeId(), dir, kids: [a, b], sizes: [r, 1 - r] };
  };
  const t = read(raw);
  return t ? checked(flatten(t)) : null;
}
