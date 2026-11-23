// Drives the real running app with real key presses and mouse drags, and checks the
// layout, shortcut, clipboard and undo rules. Start tools/live-dev.ps1 first.
// Usage: node tools/e2e-interaction.mjs
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'logs', 'shots');
mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${name}${!cond && extra !== '' ? `  (${extra})` : ''}`);
};
const step = (t) => console.log(`\n\x1b[36m== ${t} ==\x1b[0m`);

async function target() {
  for (let i = 0; i < 240; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9333/json')).json();
      const page = list.find((t) => t.type === 'page' && t.url.includes('1520'));
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // The app is still building.
    }
    if (i % 10 === 0) console.log('Waiting for the app...');
    await sleep(1000);
  }
  throw new Error('The app did not open its debug port.');
}

const ws = new WebSocket(await target());
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let seq = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text);
  }
};
const cdp = (method, params = {}) =>
  new Promise((res) => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
async function js(expr) {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'page error');
  return r.result?.result?.value;
}
async function until(expr, ms = 8000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await js(expr);
    if (last) return last;
    await sleep(120);
  }
  return false;
}
async function shot(name) {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(shots, `${name}.png`), Buffer.from(r.result.data, 'base64'));
  console.log(`  screenshot: tools/logs/shots/${name}.png`);
}

const S = '__sy.useStore.getState()';
const TAB = `(() => { const s = ${S}; return s.tabs[s.activeWs].find(t => t.id === s.activeTab[s.activeWs]); })()`;
// Panes are named p0, p1... in the order they were made in this run, so old panes do not shift the names.
const shape = `(() => { const made = window.__syMade ?? []; const f = (t) => t.type === 'pane' ? 'p' + made.indexOf(t.id) : t.dir + '(' + t.kids.map(f).join(',') + ')'; return f(${TAB}.tree); })()`;
const remember = () => js(`(() => { const f = (t) => t.type === 'pane' ? [t.id] : t.kids.flatMap(f); window.__syMade ??= []; for (const id of f(${TAB}.tree)) if (!window.__syMade.includes(id)) window.__syMade.push(id); return true; })()`);
const ids = `(() => { const f = (t) => t.type === 'pane' ? [t.id] : t.kids.flatMap(f); return f(${TAB}.tree); })()`;
const count = async () => (await js(ids)).length;
const focus = () => js(`${TAB}.focus`);

const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
const CODES = { '[': ['BracketLeft', 219], ']': ['BracketRight', 221], '=': ['Equal', 187], '-': ['Minus', 189], Escape: ['Escape', 27], Enter: ['Enter', 13] };
/** Presses a key the way a keyboard does. `mods` is a list like ['ctrl', 'shift']. */
async function press(key, mods = []) {
  const modifiers = mods.reduce((n, m) => n | MOD[m], 0);
  const letter = /^[a-z0-9]$/i.test(key);
  const [code, keyCode] = CODES[key] ?? (letter ? [/\d/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`, key.toUpperCase().charCodeAt(0)] : [key, 0]);
  const shown = letter && mods.includes('shift') ? key.toUpperCase() : key;
  const base = { modifiers, key: shown, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await sleep(250);
}
async function mouse(type, x, y, extra = {}) {
  await cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
}
async function drag(from, to, steps = 12) {
  await mouse('mousePressed', from.x, from.y);
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await sleep(16);
  }
  await sleep(80);
  await mouse('mouseReleased', to.x, to.y);
  await sleep(300);
}
const rectOf = (sel) => js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const blur = () => js(`document.activeElement?.blur(); document.body.focus(); true`);

await cdp('Runtime.enable');
await cdp('Page.enable');
await until('typeof __sy !== "undefined" && __sy.useStore.getState().ready', 30000);

const folder = mkdtempSync(join(tmpdir(), 'sy-keys-'));
writeFileSync(join(folder, 'notes file.txt'), 'hello\n');

try {
  step('Start');
  await js(`${S}.setZoom(100)`);
  await js(`${S}.addWorkspace(${JSON.stringify(folder)})`);
  await sleep(500);
  const first = (await js(ids))[0];
  await js(`__sy.actions.startShell(${JSON.stringify(first)})`);
  ok('shell starts', await until(`${S}.panes[${JSON.stringify(first)}].signal === 'ready'`, 60000));

  step('Keys inside a terminal');
  await js(`__sy.terminals.focusTerm(${JSON.stringify(first)})`);
  await press('d', ['ctrl']);
  ok('Ctrl+D in a terminal goes to the shell, not a split', (await count()) === 1);
  await js(`window.__syMade = []`);
  await remember();
  await press('d', ['ctrl', 'shift']);
  await remember();
  ok('Ctrl+Shift+D splits down even from a terminal', (await js(shape)).startsWith('column('), await js(shape));
  ok('the new pane takes focus', (await focus()) !== first);

  step('Layout keys');
  await blur();
  await press('d', ['ctrl']);
  await remember();
  ok('Ctrl+D splits right, after the focused pane', (await js(shape)) === 'column(p0,row(p1,p2))', await js(shape));
  const third = await focus();
  await press('[', ['ctrl']);
  ok('Ctrl+[ steps focus back', (await focus()) !== third);
  await press(']', ['ctrl']);
  await press(']', ['ctrl']);
  ok('Ctrl+] wraps from the last pane to the first', (await focus()) === first, await focus());
  const before = await js(ids);
  await blur();
  await press(']', ['ctrl', 'alt']);
  const after = await js(ids);
  ok('Ctrl+Alt+] swaps with the next pane', after[0] === before[1] && after[1] === before[0], JSON.stringify(after));
  ok('focus stays on the same spot', (await focus()) === after[0]);
  await blur();
  await press('ArrowDown', ['ctrl', 'alt']);
  ok('Ctrl+Alt+Down moves focus to the pane below', (await focus()) !== after[0]);
  await shot('k01-three-panes');

  step('Divider');
  const tree0 = await js(`${TAB}.tree.sizes.join(',')`);
  const div = await rectOf('.grid > .split > .divider');
  await drag({ x: div.x + div.w / 2, y: div.y + div.h / 2 }, { x: div.x + div.w / 2, y: div.y + 120 });
  const tree1 = await js(`${TAB}.tree.sizes`);
  ok('dragging the divider changes the shares', tree1.join(',') !== tree0, tree1.join(','));
  ok('the pair keeps its total', Math.abs(tree1[0] + tree1[1] - 1) < 0.001);
  await drag({ x: div.x + div.w / 2, y: div.y + 120 }, { x: div.x + div.w / 2, y: 2 });
  const grid = await rectOf('.grid > .split');
  const top = (await js(`${TAB}.tree.sizes`))[0] * (grid.h - 8);
  ok('a pane never goes below 140 px', top >= 139, Math.round(top));
  await js(`document.querySelector('.grid > .split > .divider').focus()`);
  const k0 = (await js(`${TAB}.tree.sizes`))[0];
  await press('ArrowDown');
  const k1 = (await js(`${TAB}.tree.sizes`))[0];
  ok('an arrow key moves the divider by 4% of the pair', Math.abs(k1 - k0 - 0.04) < 0.002, `${k0} -> ${k1}`);
  await blur();
  await press('=', ['ctrl', 'alt']);
  ok('Ctrl+Alt+= evens the shares', (await js(`${TAB}.tree.sizes.every(x => Math.abs(x - 0.5) < 1e-9)`)) === true);

  step('Full pane');
  const head = await rectOf('[data-pane-id] .pane-title');
  await mouse('mousePressed', head.x + 4, head.y + 4, { clickCount: 1 });
  await mouse('mouseReleased', head.x + 4, head.y + 4, { clickCount: 1 });
  await mouse('mousePressed', head.x + 4, head.y + 4, { clickCount: 2 });
  await mouse('mouseReleased', head.x + 4, head.y + 4, { clickCount: 2 });
  ok('double-clicking a header fills the track', await until(`!!${TAB}.full && document.querySelectorAll('.grid [data-pane-id]').length === 1`));
  await shot('k02-full');
  await blur();
  await press('Escape');
  ok('Escape shows all panes again', await until(`!${TAB}.full && document.querySelectorAll('.grid [data-pane-id]').length === 3`));

  step('Drag a pane');
  const shapeBefore = await js(shape);
  const panes = await js(`[...document.querySelectorAll('.grid [data-pane-id]')].map(e => { const r = e.getBoundingClientRect(); const h = e.querySelector('.pane-title').getBoundingClientRect(); return { id: e.dataset.paneId, x: r.left, y: r.top, w: r.width, h: r.height, hx: h.left + 6, hy: h.top + h.height / 2 }; })`);
  const src = panes[2];
  const dst = panes[0];
  await drag({ x: src.hx, y: src.hy }, { x: dst.x + 12, y: dst.y + dst.h / 2 });
  ok('dropping on the left edge docks the pane there', (await js(shape)) !== shapeBefore && (await js(ids))[0] === src.id, await js(shape));
  ok('the moved pane takes focus', (await focus()) === src.id);
  const tabsBefore = await js(`${S}.tabs[${S}.activeWs].length`);
  const p2 = await js(`(() => { const e = document.querySelector('.grid [data-pane-id]:last-of-type .pane-title') ?? document.querySelectorAll('.grid .pane-title')[2]; const r = e.getBoundingClientRect(); return { x: r.left + 6, y: r.top + r.height / 2 }; })()`);
  const bar = await rectOf('.tabbar .tabs');
  await drag(p2, { x: bar.x + bar.w - 60, y: bar.y + bar.h / 2 });
  ok('dropping on the track bar moves the pane to a new track', (await js(`${S}.tabs[${S}.activeWs].length`)) === tabsBefore + 1);
  ok('the new track holds that one pane', (await count()) === 1);
  await press('[', ['ctrl', 'shift']);
  ok('Ctrl+Shift+[ selects the track before', (await count()) === 2);

  step('Close');
  const order = await js(ids);
  await js(`${S}.focusPane(${JSON.stringify(order[1])})`);
  await blur();
  await press('w', ['ctrl']);
  ok('Ctrl+W closes the focused pane', (await count()) === 1, await count());
  ok('focus goes to the pane before it', (await focus()) === order[0]);

  step('Zoom');
  await press('=', ['ctrl']);
  ok('Ctrl+= zooms in by 10 percent', (await js(`${S}.zoom`)) === 110, await js(`${S}.zoom`));
  await press('0', ['ctrl']);
  ok('Ctrl+0 resets zoom', (await js(`${S}.zoom`)) === 100);

  step('Clipboard');
  // A fresh track with its own shell, so the steps above cannot have moved or closed it.
  const shell = await js(`${S}.newTab(${S}.activeWs)`);
  await js(`__sy.actions.startShell(${JSON.stringify(shell)})`);
  ok('a second shell starts', await until(`${S}.panes[${JSON.stringify(shell)}].signal === 'ready'`, 60000));
  await js(`__sy.terminals.focusTerm(${JSON.stringify(shell)})`);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await js(`(() => {
    const bytes = Uint8Array.from(atob(${JSON.stringify(png)}), c => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
    document.querySelector('[data-pane-id="${shell}"] .term-host textarea, [data-pane-id="${shell}"] .term-host')
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    return true;
  })()`);
  ok('a pasted image is saved and its path typed in', await until(`__sy.terminals.screenText(${JSON.stringify(shell)}).includes('paste-') && __sy.terminals.screenText(${JSON.stringify(shell)}).includes('.png')`));
  await press('c', ['ctrl']);
  await js(`__sy.api.termWrite(${JSON.stringify(shell)}, 'cls\\r')`);
  await sleep(600);
  await js(`${S}.setDrawer('prompts')`);
  await sleep(200);
  await js(`__sy.actions.pasteToFocused('line one\\nline two', false)`);
  const toast = await until(`document.querySelector('.toast')?.textContent`);
  const bracketed = await js(`__sy.terminals.isBracketed(${JSON.stringify(shell)})`);
  ok(
    bracketed ? 'a multi-line prompt goes in as one paste' : 'a multi-line prompt is refused with a reason',
    bracketed ? !toast || !toast.includes('several lines') : String(toast).includes('several lines'),
    String(toast),
  );

  step('Undo');
  await js(`[...document.querySelectorAll('.drawer button')].find(b => b.textContent === 'New').click()`);
  await sleep(300);
  await js(`document.querySelector('.sheet textarea').focus()`);
  await cdp('Input.insertText', { text: 'first' });
  await sleep(700);
  await cdp('Input.insertText', { text: ' second' });
  await sleep(100);
  await press('z', ['ctrl']);
  ok('Ctrl+Z undoes the last group of typing', (await js(`document.querySelector('.sheet textarea').value`)) === 'first', await js(`document.querySelector('.sheet textarea').value`));
  await press('y', ['ctrl']);
  ok('Ctrl+Y redoes it', (await js(`document.querySelector('.sheet textarea').value`)) === 'first second');
  await press('z', ['ctrl']);
  await press('z', ['ctrl']);
  ok('undo walks back to empty', (await js(`document.querySelector('.sheet textarea').value`)) === '');
  await shot('k03-prompt-undo');
  await press('Escape');

  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  failed++;
  console.log('\x1b[31mERROR\x1b[0m', e.message);
} finally {
  try {
    const wsId = await js(`${S}.activeWs`);
    await js(`(() => { const s = ${S}; (s.tabs[s.activeWs] ?? []).flatMap(t => { const f = (n) => n.type === 'pane' ? [n.id] : n.kids.flatMap(f); return f(t.tree); }).forEach(id => __sy.terminals.reset?.(id)); s.removeWorkspace(${JSON.stringify(wsId)}); s.setDrawer(s.drawer); })()`);
  } catch {
    // Cleanup is best effort.
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  ws.close();
  process.exit(failed ? 1 : 0);
}
