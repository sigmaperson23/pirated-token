/**
 * Keyboard shortcuts. `readKey` turns a key press into a command without touching any state,
 * so the rules can be tested on their own. App.tsx runs the command.
 */
export type Command =
  | { do: 'zoom'; step: 1 | -1 | 0 }
  | { do: 'escape' }
  | { do: 'toggleDrawer' }
  | { do: 'showFiles' }
  | { do: 'swap'; offset: 1 | -1 }
  | { do: 'focusWay'; way: 'left' | 'right' | 'up' | 'down' }
  | { do: 'equalize' }
  | { do: 'split'; dir: 'row' | 'column' }
  | { do: 'newTab'; fromTerminal: boolean }
  | { do: 'closePane' }
  | { do: 'closeTab' }
  | { do: 'tabStep'; offset: 1 | -1 }
  | { do: 'focusStep'; offset: 1 | -1 }
  | { do: 'nextWaiting' }
  | { do: 'board' }
  | { do: 'swallow' };

export interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  isComposing: boolean;
}

export interface KeyContext {
  /** Focus is inside a terminal. */
  inTerminal: boolean;
  /** Focus is inside a dialog or menu, which keeps its own keys. */
  inDialog: boolean;
}

const mod = (e: KeyLike) => e.ctrlKey || e.metaKey;

/** Ctrl+N, also on layouts where N is not a Latin letter. */
export function isNewTabKey(e: KeyLike): boolean {
  if (!mod(e) || e.shiftKey || e.altKey) return false;
  const k = e.key.toLowerCase();
  return k === 'n' || (e.code === 'KeyN' && !/^[a-z]$/.test(k));
}

/** Plain Ctrl and a letter, typed in a terminal, belongs to the shell. Ctrl+N is the one exception. */
export function belongsToShell(e: KeyLike, ctx: KeyContext): boolean {
  return e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && ctx.inTerminal && !isNewTabKey(e);
}

/** Held keys that would repeat a layout change are swallowed instead. */
const REPEAT_GUARDED = new Set(['t', 'd', 'b', 'f', 'a', 'w', '=', '+', '[', ']']);

/** Zoom keys. They work everywhere, terminals included. Exactly one of Ctrl or Cmd, and no Alt. */
export function readZoom(e: KeyLike): 0 | 1 | -1 | null {
  if (e.isComposing || e.altKey || !e.ctrlKey || e.metaKey) return null;
  if (e.key === '+' || e.key === '=') return 1;
  if (e.key === '-') return -1;
  if (e.key === '0') return 0;
  return null;
}

export function readKey(e: KeyLike, ctx: KeyContext): Command | null {
  if (e.isComposing) return null;
  const zoom = readZoom(e);
  if (zoom !== null) return { do: 'zoom', step: zoom };
  if (e.key === 'Escape') return ctx.inDialog ? null : { do: 'escape' };
  if (ctx.inDialog) return null;

  const key = e.key.toLowerCase();
  if (mod(e) && e.shiftKey && !e.altKey && key === 'b') return { do: 'toggleDrawer' };
  if (mod(e) && e.altKey && !e.shiftKey && (key === 'f' || e.code === 'KeyF')) return ctx.inTerminal ? null : { do: 'showFiles' };
  // Switchyard's own: jump to the next agent that needs you, and open the board.
  if (mod(e) && e.shiftKey && !e.altKey && key === 'j') return { do: 'nextWaiting' };
  if (mod(e) && e.shiftKey && !e.altKey && key === 'o') return { do: 'board' };

  if (!mod(e) || belongsToShell(e, ctx)) return null;
  const bracket = e.code === 'BracketLeft' ? -1 : e.code === 'BracketRight' ? 1 : key === '[' ? -1 : key === ']' ? 1 : 0;

  if (((e.metaKey && e.ctrlKey) || (e.ctrlKey && e.altKey && !e.metaKey)) && bracket) {
    return e.repeat ? null : { do: 'swap', offset: bracket as 1 | -1 };
  }
  if (e.altKey && key.startsWith('arrow')) return { do: 'focusWay', way: key.slice(5) as 'left' | 'right' | 'up' | 'down' };
  if (e.altKey && (key === '=' || key === '+')) return e.repeat ? { do: 'swallow' } : { do: 'equalize' };
  if (key === 'd') return e.repeat ? { do: 'swallow' } : { do: 'split', dir: e.shiftKey ? 'column' : 'row' };
  if (isNewTabKey(e)) return e.repeat ? { do: 'swallow' } : { do: 'newTab', fromTerminal: ctx.inTerminal };
  if (key === 't' && !e.shiftKey) return e.repeat ? { do: 'swallow' } : { do: 'newTab', fromTerminal: false };
  if (key === 'w') return e.repeat ? { do: 'swallow' } : e.shiftKey ? { do: 'closeTab' } : { do: 'closePane' };
  if (bracket && e.shiftKey) return { do: 'tabStep', offset: bracket as 1 | -1 };
  if (bracket) return { do: 'focusStep', offset: bracket as 1 | -1 };
  if (e.repeat && REPEAT_GUARDED.has(key)) return { do: 'swallow' };
  return null;
}
