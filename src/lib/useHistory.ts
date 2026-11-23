import { useRef } from 'react';
import { historyKey, TextHistory, type Snap } from './history';

/**
 * Gives a controlled text box Switchyard's own undo and redo. Spread the result on the
 * <textarea> or <input>. `setText` receives the text to show after an undo or redo.
 */
export function useHistory(text: string, setText: (t: string) => void) {
  const history = useRef(new TextHistory());
  const last = useRef<Snap>({ text, start: text.length, end: text.length });
  const restore = useRef<Snap | null>(null);

  const apply = (el: HTMLTextAreaElement | HTMLInputElement, snap: Snap | null) => {
    if (!snap) return;
    restore.current = snap;
    last.current = snap;
    setText(snap.text);
    requestAnimationFrame(() => el.setSelectionRange(snap.start, snap.end));
  };

  return {
    onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
      const which = historyKey(e);
      if (!which) return;
      e.preventDefault();
      apply(e.currentTarget, which === 'undo' ? history.current.undo() : history.current.redo());
    },
    // The edit menu and some keyboards send these instead of keys. They always use this history.
    onBeforeInput(e: React.FormEvent<HTMLTextAreaElement | HTMLInputElement>) {
      const type = (e.nativeEvent as InputEvent).inputType;
      if (type !== 'historyUndo' && type !== 'historyRedo') return;
      e.preventDefault();
      apply(e.currentTarget, type === 'historyUndo' ? history.current.undo() : history.current.redo());
    },
    onSelect(e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) {
      const el = e.currentTarget;
      if (el.value === last.current.text) last.current = { text: el.value, start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
    },
    onInput(e: React.FormEvent<HTMLTextAreaElement | HTMLInputElement>) {
      const el = e.currentTarget;
      const after = { text: el.value, start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
      if (restore.current?.text === after.text) {
        restore.current = null;
        return;
      }
      history.current.record(last.current, after);
      last.current = after;
    },
  };
}
