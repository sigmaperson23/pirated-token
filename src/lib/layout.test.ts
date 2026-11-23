import { describe, expect, it } from 'vitest';
import {
  dock,
  dropAction,
  dropZone,
  equalize,
  flatten,
  focusAfterClose,
  fromSaved,
  isValid,
  leaf,
  nearestPane,
  paneIds,
  perRow,
  removePane,
  resize,
  shape,
  splitPane,
  stepFrom,
  swapPanes,
  tile,
  type Rect,
  type Tree,
} from './layout';

let n = 0;
const id = () => `s${++n}`;
const must = (t: Tree | null): Tree => {
  if (!t) throw new Error('expected a tree');
  return t;
};
const split = (t: Tree, target: string, dir: 'row' | 'column', added: string) => must(splitPane(t, target, dir, added, id));
const rect = (left: number, top: number, width: number, height: number): Rect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe('splitting', () => {
  it('puts the new pane right after the target', () => {
    const t = split(split(leaf('a'), 'a', 'row', 'b'), 'a', 'row', 'c');
    expect(paneIds(t)).toEqual(['a', 'c', 'b']);
    expect(shape(t)).toBe('row(a,c,b)');
  });

  it('evens out shares when a pane joins a split', () => {
    const t = split(split(leaf('a'), 'a', 'row', 'b'), 'b', 'row', 'c');
    expect(t.type === 'split' && t.sizes).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('wraps a row of five into four over one', () => {
    let t: Tree = leaf('a');
    for (const x of ['b', 'c', 'd']) t = split(t, paneIds(t).at(-1)!, 'row', x);
    t = split(t, 'd', 'row', 'e');
    expect(shape(t)).toBe('column(row(a,b,c,d),e)');
    expect(t.type === 'split' && t.sizes).toEqual([0.5, 0.5]);
  });

  it('refuses a split that would break the limits', () => {
    let t: Tree = leaf('p0');
    for (let i = 1; i < 40; i++) {
      const next = splitPane(t, `p${i - 1}`, i % 2 ? 'row' : 'column', `p${i}`, id);
      if (!next) {
        expect(isValid(t)).toBe(true);
        return;
      }
      t = next;
    }
    throw new Error('the depth limit never stopped the splits');
  });
});

describe('closing', () => {
  it('lets the siblings share the space and drops a split left with one child', () => {
    const t = split(leaf('a'), 'a', 'row', 'b');
    expect(removePane(t, 'b')).toEqual(leaf('a'));
    expect(removePane(leaf('a'), 'a')).toBeNull();
    const three = split(t, 'b', 'row', 'c');
    const left = must(removePane(three, 'b'));
    expect(left.type === 'split' && left.sizes).toEqual([0.5, 0.5]);
  });

  it('moves focus to the pane before the closed one, else the first', () => {
    const t = tile(['a', 'b', 'c']);
    expect(focusAfterClose(t, must(removePane(t, 'b')), 'b', 'b')).toBe('a');
    expect(focusAfterClose(t, must(removePane(t, 'a')), 'a', 'a')).toBe('b');
    expect(focusAfterClose(t, must(removePane(t, 'c')), 'c', 'a')).toBe('a');
  });
});

describe('grids', () => {
  it('chooses panes per row from the count', () => {
    expect([2, 3, 4, 5, 6, 7, 9, 12].map(perRow)).toEqual([2, 2, 2, 3, 3, 4, 4, 4]);
  });

  it('lays out rows in order', () => {
    expect(shape(tile(['a']))).toBe('a');
    expect(shape(tile(['a', 'b']))).toBe('row(a,b)');
    expect(shape(tile(['a', 'b', 'c']))).toBe('column(row(a,b),c)');
    expect(shape(tile(['a', 'b', 'c', 'd', 'e']))).toBe('column(row(a,b,c),row(d,e))');
    for (let k = 1; k <= 12; k++) {
      const ids = Array.from({ length: k }, (_, i) => `p${i}`);
      expect(paneIds(tile(ids))).toEqual(ids);
    }
    expect(() => tile([])).toThrow();
  });

  it('equalizes shares without changing the arrangement', () => {
    const t = must(resize(split(split(leaf('a'), 'a', 'row', 'b'), 'b', 'column', 'c'), 'x', 0, 0.2, 1000) as Tree);
    const even = equalize(t);
    expect(shape(even)).toBe(shape(t));
  });
});

describe('moving panes', () => {
  it('swaps and steps through panes with wrap-around', () => {
    const t = tile(['a', 'b', 'c']);
    expect(paneIds(swapPanes(t, 'a', 'c'))).toEqual(['c', 'b', 'a']);
    expect(stepFrom(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(stepFrom(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(stepFrom(['a'], 'a', 1)).toBeNull();
  });

  it('docks a pane on an edge of another', () => {
    const t = tile(['a', 'b', 'c', 'd']);
    expect(shape(must(dock(t, 'd', 'a', 'left', id)))).toBe('column(row(d,a,b),c)');
    // c sits in a row, so docking below it nests a column in that row.
    expect(shape(must(dock(t, 'a', 'c', 'bottom', id)))).toBe('column(b,row(column(c,a),d))');
  });

  it('refuses a dock that changes nothing or overfills a row', () => {
    const t = tile(['a', 'b']);
    expect(dock(t, 'a', 'b', 'left', id)).toBeNull();
    const row4 = tile(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(dock(row4, 'e', 'a', 'right', id)).toBeNull();
    expect(dropAction(row4, 'e', 'a', 'right')).toEqual({ kind: 'swap' });
  });

  it('treats the centre and the header as a swap, and the outer quarter as an edge', () => {
    const r = { left: 0, top: 0, width: 100, height: 100 };
    expect(dropZone(r, 10, 50)).toBe('left');
    expect(dropZone(r, 90, 50)).toBe('right');
    expect(dropZone(r, 50, 5)).toBe('top');
    expect(dropZone(r, 50, 50)).toBe('center');
    expect(dropZone(r, 10, 50, true)).toBe('center');
  });

  it('finds the nearest pane in an arrow direction', () => {
    const panes = [
      { id: 'a', rect: rect(0, 0, 100, 100) },
      { id: 'b', rect: rect(100, 0, 100, 50) },
      { id: 'c', rect: rect(100, 50, 100, 50) },
      { id: 'd', rect: rect(0, 100, 200, 100) },
    ];
    expect(nearestPane(panes, 'a', 'right')).toBe('b');
    expect(nearestPane(panes, 'c', 'left')).toBe('a');
    expect(nearestPane(panes, 'a', 'down')).toBe('d');
    expect(nearestPane(panes, 'a', 'up')).toBeNull();
  });
});

describe('resizing', () => {
  const t = (): Tree => ({ type: 'split', id: 'x', dir: 'row', kids: [leaf('a'), leaf('b')], sizes: [0.5, 0.5] });

  it('changes only the pair and keeps its total', () => {
    const r = resize(t(), 'x', 0, 0.3, 1000);
    expect(r.type === 'split' && r.sizes).toEqual([0.3, 0.7]);
  });

  it('keeps each side at least 140 px', () => {
    const r = resize(t(), 'x', 0, 0.01, 1000);
    expect(r.type === 'split' && r.sizes[0]).toBeCloseTo(0.14);
  });

  it('does not resize a split of 280 px or less', () => {
    expect(resize(t(), 'x', 0, 0.3, 280)).toEqual(t());
  });
});

describe('saved layouts', () => {
  it('reads the older two-child form', () => {
    const old = { type: 'split', dir: 'row', ratio: 0.3, a: { type: 'pane', id: 'a' }, b: { type: 'split', dir: 'row', ratio: 0.5, a: { type: 'pane', id: 'b' }, b: { type: 'pane', id: 'c' } } };
    const t = must(fromSaved(old, id));
    expect(shape(t)).toBe('row(a,b,c)');
    expect(t.type === 'split' && t.sizes.map((x) => Math.round(x * 100))).toEqual([30, 35, 35]);
  });

  it('refuses broken input', () => {
    expect(fromSaved(null)).toBeNull();
    expect(fromSaved({ type: 'split', a: { type: 'pane', id: 'a' } })).toBeNull();
  });

  it('flattens same-direction nesting', () => {
    const nested: Tree = { type: 'split', id: 'o', dir: 'row', sizes: [0.5, 0.5], kids: [leaf('a'), { type: 'split', id: 'i', dir: 'row', sizes: [0.5, 0.5], kids: [leaf('b'), leaf('c')] }] };
    expect(shape(flatten(nested))).toBe('row(a,b,c)');
  });
});
