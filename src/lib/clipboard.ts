/** Rules for what goes into a terminal from the clipboard, a drop, or a saved prompt. */

/** Largest image a paste may stage, in bytes (25 MiB). */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
/** Most paths one drop may insert. */
export const MAX_DROP_PATHS = 20;
/** Longest path a drop may insert. */
export const MAX_PATH_CHARS = 32768;
/** Format name for a Files drawer entry dragged inside Switchyard. */
export const FILES_ENTRY_TYPE = 'application/x-switchyard-files-entry';

export const BRACKET_START = '\x1b[200~';
export const BRACKET_END = '\x1b[201~';

/** True for one http or https address with no spaces. */
export function isSingleUrl(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/u.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp';

export function imageFormat(mime: string): ImageFormat | null {
  switch (mime.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpeg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'image/bmp':
    case 'image/x-ms-bmp':
      return 'bmp';
    default:
      return null;
  }
}

interface ItemLike {
  kind: string;
  type: string;
  getAsFile(): File | null;
}
interface ClipLike {
  items: ArrayLike<ItemLike>;
  getData(type: string): string;
}

/** An image to paste, when the clipboard holds one and its text is empty or only a link. */
export function pastedImage(data: ClipLike): File | null {
  const file = Array.from(data.items)
    .filter((i) => i.kind === 'file' && i.type.toLowerCase().startsWith('image/'))
    .map((i) => i.getAsFile())
    .find((f) => f !== null);
  if (!file) return null;
  const text = data.getData('text/plain').trim();
  return text.length === 0 || isSingleUrl(text) ? file : null;
}

/** Checks an image can be staged. Returns its format, or null. */
export function stageableImage(file: { type: string; size: number }): ImageFormat | null {
  const format = imageFormat(file.type);
  return format && file.size > 0 && file.size <= MAX_IMAGE_BYTES ? format : null;
}

/** Quotes a path for a shell prompt when it has spaces. */
export function quotePath(path: string): string {
  return /\s/u.test(path) ? `"${path}"` : path;
}

const CONTROL = /[\u0000-\u001f\u007f]/u;

/** Paths from an OS drop, or null when the drop is not allowed. */
export function dropPaths(paths: string[]): string[] | null {
  if (paths.length < 1 || paths.length > MAX_DROP_PATHS) return null;
  if (paths.some((p) => p.length < 1 || p.length > MAX_PATH_CHARS || CONTROL.test(p))) return null;
  return paths;
}

/** Text typed for dropped paths: each quoted when needed, joined by spaces, with a space after. */
export function dropText(paths: string[]): string {
  return paths.map(quotePath).join(' ') + ' ';
}

export interface FilesEntry {
  workspaceId: string;
  relativePath: string;
  kind: 'file' | 'directory';
}

/** A relative path inside a folder: no leading slash, no drive, no control characters, no empty, . or .. parts. */
export function isSafeRelative(path: string): boolean {
  if (path.length < 1 || path.length > 4096) return false;
  if (/^[\\/]/u.test(path) || /^[A-Za-z]:/u.test(path) || /[\u0000-\u001f\u007f\\]/u.test(path)) return false;
  return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

export function readFilesEntry(raw: string): FilesEntry | null {
  if (raw.length > 8192) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v?.workspaceId !== 'string' || !v.workspaceId) return null;
    if (v.kind !== 'file' && v.kind !== 'directory') return null;
    if (typeof v.relativePath !== 'string' || !isSafeRelative(v.relativePath)) return null;
    return { workspaceId: v.workspaceId, relativePath: v.relativePath, kind: v.kind };
  } catch {
    return null;
  }
}

/** Mention text for an entry: folders end in /, and a path with spaces goes in quotes. */
export function mentionText(e: Pick<FilesEntry, 'relativePath' | 'kind'>): string {
  const p = e.kind === 'directory' ? `${e.relativePath}/` : e.relativePath;
  return /\s/u.test(p) ? `@"${p}"` : `@${p}`;
}

/** Cleans prompt text: line ends become \n; other control characters except tab go, and so do C1 codes. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/gu, '\n')
    .split('')
    .filter((c) => {
      const n = c.codePointAt(0)!;
      return c === '\n' || c === '\t' || (n >= 32 && !(n >= 127 && n <= 159));
    })
    .join('');
}

export type PromptInput = { kind: 'write'; data: string } | { kind: 'refused'; reason: 'empty' | 'multiline' };

/**
 * What a saved prompt types into a terminal, without pressing Enter. A program that accepts
 * pastes gets the whole text as one paste. Otherwise only one line can go in.
 */
export function promptInput(text: string, bracketed: boolean): PromptInput {
  const t = cleanText(text).replace(/\s+$/u, '');
  if (t.trim().length === 0) return { kind: 'refused', reason: 'empty' };
  if (bracketed) return { kind: 'write', data: `${BRACKET_START}${t}${BRACKET_END}` };
  if (t.includes('\n')) return { kind: 'refused', reason: 'multiline' };
  return { kind: 'write', data: t.replace(/\t/gu, ' ') };
}

export interface Delivery {
  /** Wait before Enter, so the agent finishes reading the paste. */
  enterDelayMs: number;
  /** Wrap even one line as a paste. */
  bracketSingleLine: boolean;
}

/** How each engine takes a sent prompt. */
export function deliveryFor(engine: string | undefined): Delivery {
  if (engine === 'claude' || engine === 'cursor') return { enterDelayMs: 250, bracketSingleLine: true };
  if (engine === 'codex') return { enterDelayMs: 200, bracketSingleLine: false };
  if (!engine) return { enterDelayMs: 0, bracketSingleLine: false };
  return { enterDelayMs: 150, bracketSingleLine: false };
}

/** The bytes to write for a sent prompt, then Enter after the engine's delay. */
export function sendPlan(text: string, bracketed: boolean, d: Delivery): { data: string; enterAfterMs: number } {
  const t = cleanText(text);
  const wrap = bracketed && (t.includes('\n') || d.bracketSingleLine);
  return { data: wrap ? `${BRACKET_START}${t}${BRACKET_END}` : t, enterAfterMs: d.enterDelayMs };
}
