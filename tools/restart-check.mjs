// Checks that terminals survive a real app restart. tools/live-restart.ps1 runs it twice:
//   node tools/restart-check.mjs before   (opens a shell and leaves a mark in it)
//   node tools/restart-check.mjs after    (after the app was killed and started again)
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const stateFile = join(here, 'logs', 'restart-state.json');
const phase = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed++;
  console.log(`${cond ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${name}${!cond && extra ? `  (${extra})` : ''}`);
};

async function target() {
  for (let i = 0; i < 300; i++) {
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
await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
let seq = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
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
async function until(expr, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await js(expr).catch(() => false);
    if (v) return v;
    await sleep(200);
  }
  return false;
}
async function shot(name) {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  mkdirSync(join(here, 'logs', 'shots'), { recursive: true });
  writeFileSync(join(here, 'logs', 'shots', `${name}.png`), Buffer.from(r.result.data, 'base64'));
  console.log(`  screenshot: tools/logs/shots/${name}.png`);
}
const S = '__sy.useStore.getState()';
await cdp('Page.enable');
await until('typeof __sy !== "undefined" && __sy.useStore.getState().ready', 60000);

if (phase === 'before') {
  const folder = mkdtempSync(join(tmpdir(), 'sy-restart-'));
  await js(`${S}.addWorkspace(${JSON.stringify(folder)})`);
  await sleep(500);
  const wsId = await js(`${S}.activeWs`);
  const pane = await js(`Object.values(${S}.panes).find(p => p.wsId === ${JSON.stringify(wsId)}).id`);
  await js(`__sy.actions.startShell(${JSON.stringify(pane)})`);
  ok('shell starts', await until(`${S}.panes[${JSON.stringify(pane)}]?.signal === 'ready'`, 20000));
  await js(`__sy.api.termWrite(${JSON.stringify(pane)}, "$syRestart = 'survived-' + $PID; echo before-restart\\r")`);
  ok('shell runs a command', await until(`__sy.terminals.screenText(${JSON.stringify(pane)}).includes('before-restart')`));
  const keeper = await js(`__sy.api.termKeeper()`);
  ok('keeper is running', keeper?.pid > 0);
  // Give the session saver time to write the pane to disk.
  await sleep(1500);
  writeFileSync(stateFile, JSON.stringify({ folder, wsId, pane, keeperPid: keeper?.pid }));
  await shot('09-before-restart');
} else {
  const st = JSON.parse(readFileSync(stateFile, 'utf8'));
  const P = JSON.stringify(st.pane);
  ok('pane came back', await until(`!!${S}.panes[${P}]`, 20000));
  ok('pane did not go to sleep', await js(`${S}.panes[${P}]?.asleep !== true`));
  await js(`${S}.jumpToPane(${P})`);
  ok('old output is back on screen', await until(`__sy.terminals.screenText(${P}).includes('before-restart')`, 20000));
  await js(`__sy.api.termWrite(${P}, 'echo "v=$syRestart"\\r')`);
  ok('the same shell kept running', await until(`/v=survived-\\d+/.test(__sy.terminals.screenText(${P}))`, 15000));
  const keeper = await js(`__sy.api.termKeeper()`);
  ok('the same keeper served both runs', keeper?.pid === st.keeperPid, `${keeper?.pid} vs ${st.keeperPid}`);
  await shot('10-after-restart');
  // Clean up the test folder.
  await js(`(() => { __sy.terminals.destroy(${P}); ${S}.removeWorkspace(${JSON.stringify(st.wsId)}); })()`);
  await sleep(800);
}

ws.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
