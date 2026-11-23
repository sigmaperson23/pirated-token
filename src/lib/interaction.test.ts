import { describe, expect, it } from 'vitest';
import {
  cleanText,
  deliveryFor,
  dropPaths,
  dropText,
  imageFormat,
  isSafeRelative,
  mentionText,
  pastedImage,
  promptInput,
  readFilesEntry,
  sendPlan,
  stageableImage,
} from './clipboard';
import { DEPTH, historyKey, SLACK, TextHistory } from './history';
import { readKey, type KeyLike } from './keys';

const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  code: /^[a-z]$/i.test(k) ? `Key${k.toUpperCase()}` : k === '[' ? 'BracketLeft' : k === ']' ? 'BracketRight' : k,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  isComposing: false,
  ...mods,
});
const out = { inTerminal: false, inDialog: false };
const term = { inTerminal: true, inDialog: false };

describe('shortcuts', () => {
  it('maps the layout keys', () => {
    expect(readKey(key('d', { ctrlKey: true }), out)).toEqual({ do: 'split', dir: 'row' });
    expect(readKey(key('D', { ctrlKey: true, shiftKey: true }), out)).toEqual({ do: 'split', dir: 'column' });
    expect(readKey(key('w', { ctrlKey: true }), out)).toEqual({ do: 'closePane' });
    expect(readKey(key('W', { ctrlKey: true, shiftKey: true }), out)).toEqual({ do: 'closeTab' });
    expect(readKey(key('t', { ctrlKey: true }), out)).toEqual({ do: 'newTab', fromTerminal: false });
    expect(readKey(key(']', { ctrlKey: true }), out)).toEqual({ do: 'focusStep', offset: 1 });
    expect(readKey(key('{', { ctrlKey: true, shiftKey: true, code: 'BracketLeft' }), out)).toEqual({ do: 'tabStep', offset: -1 });
    expect(readKey(key('[', { ctrlKey: true, altKey: true }), out)).toEqual({ do: 'swap', offset: -1 });
    expect(readKey(key('ArrowLeft', { ctrlKey: true, altKey: true }), out)).toEqual({ do: 'focusWay', way: 'left' });
    expect(readKey(key('=', { ctrlKey: true, altKey: true }), out)).toEqual({ do: 'equalize' });
  });

  it('leaves plain Ctrl keys to the shell inside a terminal, except Ctrl+N', () => {
    expect(readKey(key('d', { ctrlKey: true }), term)).toBeNull();
    expect(readKey(key('w', { ctrlKey: true }), term)).toBeNull();
    expect(readKey(key('c', { ctrlKey: true }), term)).toBeNull();
    expect(readKey(key('n', { ctrlKey: true }), term)).toEqual({ do: 'newTab', fromTerminal: true });
    expect(readKey(key('D', { ctrlKey: true, shiftKey: true }), term)).toEqual({ do: 'split', dir: 'column' });
  });

  it('zooms from anywhere with exactly Ctrl', () => {
    expect(readKey(key('=', { ctrlKey: true }), term)).toEqual({ do: 'zoom', step: 1 });
    expect(readKey(key('-', { ctrlKey: true }), out)).toEqual({ do: 'zoom', step: -1 });
    expect(readKey(key('0', { ctrlKey: true }), out)).toEqual({ do: 'zoom', step: 0 });
    expect(readKey(key('=', { ctrlKey: true, metaKey: true }), out)?.do).not.toBe('zoom');
  });

  it('swallows held layout keys and ignores keys typed while composing', () => {
    expect(readKey(key('d', { ctrlKey: true, repeat: true }), out)).toEqual({ do: 'swallow' });
    expect(readKey(key('[', { ctrlKey: true, altKey: true, repeat: true }), out)).toBeNull();
    expect(readKey(key('d', { ctrlKey: true, isComposing: true }), out)).toBeNull();
  });

  it('keeps Files out of terminals and leaves dialogs alone', () => {
    expect(readKey(key('f', { ctrlKey: true, altKey: true }), out)).toEqual({ do: 'showFiles' });
    expect(readKey(key('f', { ctrlKey: true, altKey: true }), term)).toBeNull();
    expect(readKey(key('B', { ctrlKey: true, shiftKey: true }), term)).toEqual({ do: 'toggleDrawer' });
    expect(readKey(key('Escape'), { inTerminal: false, inDialog: true })).toBeNull();
  });
});

describe('undo history', () => {
  const snap = (text: string) => ({ text, start: text.length, end: text.length });

  it('joins quick edits in one place and splits slow ones', () => {
    const h = new TextHistory();
    h.record(snap(''), snap('a'), 0);
    h.record(snap('a'), snap('ab'), 100);
    h.record(snap('ab'), snap('abc'), 1000);
    expect(h.size).toBe(2);
    expect(h.undo()?.text).toBe('ab');
    expect(h.undo()?.text).toBe('');
    expect(h.undo()).toBeNull();
  });

  it('starts a new step for an edit somewhere else, even when quick', () => {
    const h = new TextHistory();
    h.record(snap('hello world'), snap('hello worldX'), 0);
    h.record(snap('hello worldX'), snap('Yhello worldX'), 50);
    expect(h.size).toBe(2);
  });

  it('clears redo on a new edit', () => {
    const h = new TextHistory();
    h.record(snap(''), snap('a'), 0);
    h.undo();
    expect(h.canRedo).toBe(true);
    h.record(snap(''), snap('b'), 5000);
    expect(h.canRedo).toBe(false);
  });

  it('keeps at most the depth plus slack, then cuts back to the depth', () => {
    const h = new TextHistory();
    let text = '';
    for (let i = 0; i < DEPTH + SLACK + 1; i++) {
      const next = `${text}x`;
      h.record(snap(text), snap(next), i * 1000);
      text = `${next}\n`.padStart(next.length + 1);
    }
    expect(h.size).toBe(DEPTH);
  });

  it('reads the undo and redo keys', () => {
    const k = (key: string, shiftKey = false) => ({ key, ctrlKey: true, metaKey: false, shiftKey, altKey: false });
    expect(historyKey(k('z'))).toBe('undo');
    expect(historyKey(k('Z', true))).toBe('redo');
    expect(historyKey(k('y'))).toBe('redo');
    expect(historyKey(k('я'))).toBe('undo');
    expect(historyKey({ ...k('z'), ctrlKey: false })).toBeNull();
  });
});

describe('clipboard and drops', () => {
  const clip = (items: { kind: string; type: string }[], text = '') => ({
    items: items.map((i) => ({ ...i, getAsFile: () => new File([new Uint8Array([1])], 'x', { type: i.type }) })),
    getData: () => text,
  });

  it('pastes an image only when the text is empty or one link', () => {
    expect(pastedImage(clip([{ kind: 'file', type: 'image/png' }]))).not.toBeNull();
    expect(pastedImage(clip([{ kind: 'file', type: 'image/png' }], 'https://x.dev/a.png'))).not.toBeNull();
    expect(pastedImage(clip([{ kind: 'file', type: 'image/png' }], 'some words'))).toBeNull();
    expect(pastedImage(clip([{ kind: 'file', type: 'text/plain' }]))).toBeNull();
  });

  it('accepts five image types up to 25 MiB', () => {
    expect(['image/png', 'image/jpg', 'image/gif', 'image/webp', 'image/x-ms-bmp', 'image/tiff'].map(imageFormat)).toEqual([
      'png',
      'jpeg',
      'gif',
      'webp',
      'bmp',
      null,
    ]);
    expect(stageableImage({ type: 'image/png', size: 0 })).toBeNull();
    expect(stageableImage({ type: 'image/png', size: 25 * 1024 * 1024 + 1 })).toBeNull();
  });

  it('checks dropped paths and quotes ones with spaces', () => {
    expect(dropPaths([])).toBeNull();
    expect(dropPaths(Array.from({ length: 21 }, () => 'a'))).toBeNull();
    expect(dropPaths(['C:\\a\u0007b'])).toBeNull();
    expect(dropText(['C:\\a b\\c.txt', 'C:\\d.txt'])).toBe('"C:\\a b\\c.txt" C:\\d.txt ');
  });

  it('checks Files entries', () => {
    expect(isSafeRelative('src/app.ts')).toBe(true);
    for (const bad of ['/etc', '\\x', 'C:/x', 'a//b', 'a/../b', './a', 'a\\b']) expect(isSafeRelative(bad)).toBe(false);
    expect(readFilesEntry(JSON.stringify({ workspaceId: 'w', relativePath: 'src', kind: 'directory' }))).toEqual({
      workspaceId: 'w',
      relativePath: 'src',
      kind: 'directory',
    });
    expect(readFilesEntry('{')).toBeNull();
    expect(mentionText({ relativePath: 'src', kind: 'directory' })).toBe('@src/');
    expect(mentionText({ relativePath: 'my file.ts', kind: 'file' })).toBe('@"my file.ts"');
  });

  it('cleans prompt text', () => {
    expect(cleanText('a\r\nb\rc\x1b[31m\x85\td')).toBe('a\nb\nc[31m\td');
  });

  it('types a saved prompt as one paste, or one line when pastes are not marked', () => {
    expect(promptInput('  \n ', true)).toEqual({ kind: 'refused', reason: 'empty' });
    expect(promptInput('a\nb\n\n', true)).toEqual({ kind: 'write', data: '\x1b[200~a\nb\x1b[201~' });
    expect(promptInput('a\nb', false)).toEqual({ kind: 'refused', reason: 'multiline' });
    expect(promptInput('a\tb  ', false)).toEqual({ kind: 'write', data: 'a b' });
  });

  it('sends prompts with each engine’s wait before Enter', () => {
    expect(deliveryFor('claude')).toEqual({ enterDelayMs: 250, bracketSingleLine: true });
    expect(deliveryFor('codex').enterDelayMs).toBe(200);
    expect(deliveryFor('gemini').enterDelayMs).toBe(150);
    expect(deliveryFor(undefined).enterDelayMs).toBe(0);
    expect(sendPlan('hi', true, deliveryFor('claude')).data).toBe('\x1b[200~hi\x1b[201~');
    expect(sendPlan('hi', true, deliveryFor('codex')).data).toBe('hi');
    expect(sendPlan('a\nb', true, deliveryFor('codex')).data).toBe('\x1b[200~a\nb\x1b[201~');
    expect(sendPlan('a\nb', false, deliveryFor('codex')).data).toBe('a\nb');
  });
});
