export type Signal = 'off' | 'starting' | 'working' | 'ready' | 'needs' | 'failed' | 'ended';

/** How long an agent must stay quiet before its turn counts as over. */
export const QUIET_MS = 2500;
/** Output this soon after a key press is the agent echoing the key, not new work. */
export const ECHO_MS = 400;

/** A menu of answers. Agents draw these above their input box, so they can sit a few lines up. */
const ASKING_MENU = [
  /\b1\.\s*yes\b/i,
  /allow (once|always)/i,
  /esc to (cancel|deny|reject)/i,
  /approval (required|needed)/i,
  /permission (required|needed)/i,
  /trust (this|the) (folder|files|directory)/i,
];
/** A plain question. It counts only at the very bottom, or an answered question would keep the lamp on. */
const ASKING_LINE = [
  /do you want to/i,
  /\by\/n\b/i,
  /\[y\/n\]/i,
  /\bapprove\b/i,
  /press enter to (continue|confirm)/i,
  /waiting for (your )?(input|approval|confirmation)/i,
];

export function screenAsks(screen: string): boolean {
  const lines = screen.split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const menu = lines.slice(-12).join('\n');
  const line = lines.slice(-2).join('\n');
  return ASKING_MENU.some((r) => r.test(menu)) || ASKING_LINE.some((r) => r.test(line));
}

/** The word Auto mode asks an agent to print. Auto never prints it, so it cannot match its own prompt. */
export const AUTO_DONE_WORD = 'AUTO' + '-' + 'DONE';

export function autoPrompt(goal: string, round: number): string {
  const how = 'When the goal is fully met, print the word auto, a hyphen and the word done, in capitals, on its own line.';
  if (round === 0) return `Goal: ${goal}\n\nWork until this goal is met. ${how}`;
  return `Keep going on the goal: ${goal}\n\nIf anything is left, do it now. ${how}`;
}

export function screenSaysAutoDone(screen: string): boolean {
  return screen.split('\n').some((l) => l.replace(/[^A-Za-z-]/g, '') === AUTO_DONE_WORD);
}

export type AutoStep = 'send' | 'finish' | 'pause' | 'limit' | 'wait';

export function nextAutoStep(signal: Signal, screen: string, rounds: number, max: number): AutoStep {
  if (signal === 'needs' || signal === 'failed' || signal === 'ended') return 'pause';
  if (signal !== 'ready') return 'wait';
  if (screenSaysAutoDone(screen)) return 'finish';
  if (rounds >= max) return 'limit';
  return 'send';
}

const URGENCY: Record<Signal, number> = { needs: 5, failed: 4, ended: 3, ready: 2, working: 1, starting: 1, off: 0 };

/** The lamp a whole workspace shows: its most urgent pane. */
export function worstSignal(signals: Signal[]): Signal {
  return signals.reduce<Signal>((best, s) => (URGENCY[s] > URGENCY[best] ? s : best), 'off');
}

export const SIGNAL_LABEL: Record<Signal, string> = {
  off: 'Not started',
  starting: 'Starting',
  working: 'Working',
  ready: 'Ready',
  needs: 'Needs you',
  failed: 'Failed',
  ended: 'Stopped',
};

export interface Marks {
  kind: 'prompt' | 'command' | 'finished' | 'other';
  exitCode?: number;
}

/** Reads the body of an OSC 133 mark. Marks without this pane's token are ignored, so a program cannot fake them. */
export function readMark(body: string, token: string): Marks | null {
  const parts = body.split(';');
  const code = parts[0];
  if (parts[parts.length - 1] !== token || parts.length < 2) return null;
  if (code === 'A') return { kind: 'prompt' };
  if (code === 'C') return { kind: 'command' };
  if (code === 'D') {
    const n = Number(parts[1]);
    return { kind: 'finished', exitCode: Number.isFinite(n) ? n : 1 };
  }
  return { kind: 'other' };
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Wraps text as a paste, so a line break does not send the message early. */
export function asPaste(text: string): string {
  return `\x1b[200~${text.replace(/\x1b/g, '')}\x1b[201~`;
}

/** The time a daily routine should next fire, at or after `from`. */
export function nextDaily(time: string, from: Date): Date {
  const [h, m] = time.split(':').map(Number);
  const next = new Date(from);
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}
