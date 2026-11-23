/**
 * Undo and redo for a text box. Edits close together in time and place join one step.
 * The history lives in memory only and ends when the box goes away.
 */

/** Most undo steps kept. */
export const DEPTH = 100;
/** Extra steps allowed before old ones are cut, so trimming does not run on every edit. */
export const SLACK = 20;
/** Edits further apart than this start a new step. */
export const GROUP_MS = 500;

export interface Snap {
  text: string;
  start: number;
  end: number;
}

interface Step {
  before: Snap;
  after: Snap;
  /** Where the edit touched the text, after it happened. */
  from: number;
  to: number;
  time: number;
}

/** The changed range between two texts: the part that differs after the common start and end. */
export function changedRange(a: string, b: string): { from: number; toA: number; toB: number } {
  let from = 0;
  while (from < a.length && from < b.length && a[from] === b[from]) from++;
  let endA = a.length;
  let endB = b.length;
  while (endA > from && endB > from && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  return { from, toA: endA, toB: endB };
}

export class TextHistory {
  private done: Step[] = [];
  private undone: Step[] = [];

  /** Records a change from `before` to `after`. Any new change clears redo. */
  record(before: Snap, after: Snap, now = Date.now()): void {
    if (before.text === after.text) return;
    const { from, toB } = changedRange(before.text, after.text);
    const last = this.done[this.done.length - 1];
    // Join the last step when it is recent and this edit touches the range it changed.
    const joins = last && now - last.time <= GROUP_MS && from <= last.to && toB >= last.from;
    if (joins) {
      last.after = after;
      last.from = Math.min(last.from, from);
      last.to = Math.max(from, toB, Math.min(last.to, after.text.length));
      last.time = now;
    } else {
      this.done.push({ before, after, from, to: toB, time: now });
      if (this.done.length > DEPTH + SLACK) this.done = this.done.slice(-DEPTH);
    }
    this.undone = [];
  }

  /** Returns the state to show after undo, or null when there is nothing to undo. */
  undo(): Snap | null {
    const step = this.done.pop();
    if (!step) return null;
    this.undone.push(step);
    return step.before;
  }

  redo(): Snap | null {
    const step = this.undone.pop();
    if (!step) return null;
    this.done.push({ ...step, time: 0 });
    return step.after;
  }

  get canUndo() {
    return this.done.length > 0;
  }
  get canRedo() {
    return this.undone.length > 0;
  }
  get size() {
    return this.done.length;
  }
}

/** Which history key this is: Ctrl+Z undoes; Ctrl+Shift+Z and Ctrl+Y redo. Cyrillic Я works like Z. */
export function historyKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): 'undo' | 'redo' | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const k = e.key.toLowerCase();
  if (k === 'z' || k === 'я') return e.shiftKey ? 'redo' : 'undo';
  if (k === 'y' && !e.shiftKey) return 'redo';
  return null;
}
