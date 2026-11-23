import { describe, expect, it } from 'vitest';
import {
  asPaste,
  autoPrompt,
  nextAutoStep,
  nextDaily,
  readMark,
  screenAsks,
  screenSaysAutoDone,
  slug,
  worstSignal,
} from './signals';

describe('screenAsks', () => {
  it('sees a permission question near the bottom', () => {
    expect(screenAsks('Bash(rm -rf build)\nDo you want to proceed?\n 1. Yes\n 2. No\n')).toBe(true);
    expect(screenAsks('Overwrite file? (y/n)')).toBe(true);
  });
  it('ignores a question that has scrolled away', () => {
    const old = 'Do you want to proceed?\n' + Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    expect(screenAsks(old)).toBe(false);
  });
  it('ignores a plain question once it has an answer below it', () => {
    expect(screenAsks('Do you want to proceed? (y/n) y\nStep 1\nStep 2\nStep 3\n> ')).toBe(false);
  });
  it('sees an answer menu a few lines up', () => {
    const menu = 'Do you want to make this edit?\n> 1. Yes\n  2. Yes, always\n  3. No\n\n  Esc to cancel\n';
    expect(screenAsks(menu)).toBe(true);
  });
  it('stays quiet on normal output', () => {
    expect(screenAsks('Done. Tests pass.\n> ')).toBe(false);
  });
});

describe('auto mode', () => {
  it('prompt never contains the finish word', () => {
    for (const round of [0, 1]) expect(screenSaysAutoDone(autoPrompt('fix the login', round))).toBe(false);
  });
  it('finish word must sit on its own line', () => {
    expect(screenSaysAutoDone('all good\n  AUTO-DONE  \n')).toBe(true);
    expect(screenSaysAutoDone('│ AUTO-DONE │')).toBe(true);
    expect(screenSaysAutoDone('I will print AUTO-DONE later')).toBe(false);
  });
  it('picks the next step', () => {
    expect(nextAutoStep('ready', 'x', 0, 3)).toBe('send');
    expect(nextAutoStep('ready', 'AUTO-DONE', 0, 3)).toBe('finish');
    expect(nextAutoStep('ready', 'x', 3, 3)).toBe('limit');
    expect(nextAutoStep('needs', 'x', 0, 3)).toBe('pause');
    expect(nextAutoStep('ended', 'x', 0, 3)).toBe('pause');
    expect(nextAutoStep('working', 'x', 0, 3)).toBe('wait');
  });
});

describe('readMark', () => {
  it('needs the right token', () => {
    expect(readMark('A;secret', 'secret')).toEqual({ kind: 'prompt' });
    expect(readMark('A;other', 'secret')).toBeNull();
    expect(readMark('A', 'secret')).toBeNull();
  });
  it('reads the exit code', () => {
    expect(readMark('D;3;secret', 'secret')).toEqual({ kind: 'finished', exitCode: 3 });
    expect(readMark('D;0;secret', 'secret')).toEqual({ kind: 'finished', exitCode: 0 });
  });
});

describe('helpers', () => {
  it('shows the most urgent lamp', () => {
    expect(worstSignal(['working', 'needs', 'ready'])).toBe('needs');
    expect(worstSignal([])).toBe('off');
  });
  it('makes branch-safe names', () => {
    expect(slug('Fix the  Login page!')).toBe('fix-the-login-page');
    expect(slug('---')).toBe('');
  });
  it('strips escape codes from pasted text', () => {
    expect(asPaste('a\x1b[201~b')).toBe('\x1b[200~a[201~b\x1b[201~');
  });
  it('fires today if the time is ahead, else tomorrow', () => {
    const from = new Date(2026, 10, 7, 8, 0, 0);
    expect(nextDaily('09:30', from).getDate()).toBe(7);
    expect(nextDaily('07:30', from).getDate()).toBe(8);
    expect(nextDaily('08:00', from).getDate()).toBe(8);
  });
});
