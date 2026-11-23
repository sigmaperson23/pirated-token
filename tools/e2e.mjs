// Drives the real running app through its debug port and checks what happens.
// Start tools/live-dev.ps1 first. Usage: node tools/e2e.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, 'logs', 'shots');
mkdirSync(shots, { recursive: true });
const fakeAgent = join(here, 'fake-agent.mjs').replaceAll('\\', '/');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${name}${!cond && extra ? `  (${extra})` : ''}`);
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
const consoleErrors = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text);
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
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
async function shot(name) {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(shots, `${name}.png`), Buffer.from(r.result.data, 'base64'));
  console.log(`  screenshot: tools/logs/shots/${name}.png`);
}
async function until(what, expr, ms = 15000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await js(expr);
    if (last) return last;
    await sleep(150);
  }
  return false;
}
const S = '__sy.useStore.getState()';
const signal = (id) => js(`${S}.panes[${JSON.stringify(id)}]?.signal`);
const signalIs = (id, s, ms) => until(s, `${S}.panes[${JSON.stringify(id)}]?.signal === ${JSON.stringify(s)}`, ms);
const screen = (id) => js(`__sy.terminals.screenText(${JSON.stringify(id)})`);
const type = (id, text) => js(`__sy.api.termWrite(${JSON.stringify(id)}, ${JSON.stringify(text)})`);

await cdp('Runtime.enable');
await cdp('Page.enable');
await until('hooks', 'typeof __sy !== "undefined" && __sy.useStore.getState().ready', 30000);

const project = mkdtempSync(join(tmpdir(), 'sy-e2e-'));
const repo = join(project, 'demo-shop');
mkdirSync(repo);
const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' });
git('init', '-b', 'main');
git('config', 'user.email', 'e2e@example.com');
git('config', 'user.name', 'e2e');
writeFileSync(join(repo, 'README.md'), '# Demo shop\n');
git('add', '.');
git('commit', '-m', 'first');

try {
  step('Workspace and launcher');
  await js(`${S}.addWorkspace(${JSON.stringify(repo)})`);
  await sleep(600);
  const wsId = await js(`${S}.activeWs`);
  ok('workspace added', !!wsId);
  const first = await js(`Object.values(${S}.panes).find(p => p.wsId === ${JSON.stringify(wsId)}).id`);
  ok('launcher lists real tools', await until('launcher', `document.querySelector('.launcher-list')?.textContent.includes('Claude Code')`));
  await shot('01-launcher');

  step('Shell pane with marks');
  await js(`__sy.actions.startShell(${JSON.stringify(first)})`);
  // The machine can be busy, and a shell profile can be slow, so start-up gets a long wait.
  ok('shell reaches its prompt', await signalIs(first, 'ready', 60000), await signal(first));
  ok('shell reports its folder', (await js(`${S}.panes[${JSON.stringify(first)}].cwd`)).includes('demo-shop'));
  await type(first, 'echo hello-yard\r');
  ok('command output shows', await until('echo', `__sy.terminals.screenText(${JSON.stringify(first)}).includes('hello-yard')`));
  ok('last command is read from the mark', await until('cmd', `${S}.panes[${JSON.stringify(first)}].lastCommand === 'echo hello-yard'`));
  await type(first, 'cmd /c exit 3\r');
  ok('failed command turns the lamp red', await signalIs(first, 'failed'), await signal(first));
  await type(first, 'echo ok-again\r');
  await sleep(1200);
  await type(first, `Write-Host "$([char]27)]133;A;fakeToken$([char]7)"\r`);
  await sleep(600);
  ok('a mark with the wrong token changes nothing', (await signal(first)) !== 'ended');
  await type(first, "$syKeep = 'kept-42'\r");
  await sleep(600);
  await shot('02-shell');
  console.log(
    '  terminal areas:',
    await js(`JSON.stringify([...document.querySelectorAll('.term-host, .xterm, .xterm-screen, .xterm-viewport, .xterm-scrollable-element, .term-slot')].map(x => [x.className.split(' ')[0], x.getBoundingClientRect().height, x.scrollHeight, x.getBoundingClientRect().width, x.scrollWidth, getComputedStyle(x).overflowX, getComputedStyle(x).overflowY]))`),
  );

  step('Split and agent signals');
  const agentPane = await js(`${S}.split(${JSON.stringify(first)}, 'row')`);
  await js(`${S}.patchPane(${JSON.stringify(agentPane)}, { kind: 'agent', title: 'Fake agent', startup: 'node "${fakeAgent}"', asleep: false })`);
  ok('agent settles after start', await signalIs(agentPane, 'ready', 60000), await signal(agentPane));
  await js(`__sy.terminals.sendText(${JSON.stringify(agentPane)}, 'build the thing')`);
  ok('agent shows working', await signalIs(agentPane, 'working'), await signal(agentPane));
  ok('agent goes ready after its turn', await signalIs(agentPane, 'ready', 15000), await signal(agentPane));
  ok('turn end is in Activity', await js(`${S}.activity.some(a => a.title.includes('finished its turn'))`));
  await js(`__sy.terminals.sendText(${JSON.stringify(agentPane)}, 'do something risky')`);
  ok('agent question turns the lamp amber', await signalIs(agentPane, 'needs', 15000), await signal(agentPane));
  ok('rail lists it under Needs you', await until('rail', `document.querySelector('.waiting')?.textContent.includes('Fake agent')`));
  await shot('03-needs-you');
  await type(agentPane, 'y\r');
  ok('answering moves it on', await signalIs(agentPane, 'ready', 15000), await signal(agentPane));
  ok('rail clears', await until('rail', `!document.querySelector('.waiting')`));

  step('Auto');
  await js(`${S}.patchPane(${JSON.stringify(agentPane)}, { auto: { goal: 'finish the demo', rounds: 0, max: 5 } })`);
  ok('Auto runs until the agent says done', await until('auto', `!${S}.panes[${JSON.stringify(agentPane)}].auto`, 40000));
  ok('Auto used 2 rounds of goal work', (await screen(agentPane)).includes('Goal round 2'), (await screen(agentPane)).slice(-200));
  ok('Auto finish is in Activity', await js(`${S}.activity.some(a => a.title.includes('finished its goal'))`));

  step('Agent quits');
  await js(`__sy.terminals.sendText(${JSON.stringify(agentPane)}, 'bye')`);
  ok('lamp shows stopped when the agent quits', await signalIs(agentPane, 'ended', 15000), await signal(agentPane));
  ok('pane falls back to a shell', (await js(`${S}.panes[${JSON.stringify(agentPane)}].kind`)) === 'shell');

  step('Task board and worktree');
  await js(`__sy.engines.ENGINES.push({ id: 'fake', name: 'Fake', command: 'node "${fakeAgent}"', install: '' })`);
  const task = await js(`__sy.api.taskCreate(${JSON.stringify(repo)}, 'Fix the login page', 'Make it faster')`);
  ok('task created', !!task?.id);
  await js(`${S}.setView('board')`);
  ok('board shows the task', await until('board', `document.querySelector('.column-todo')?.textContent.includes('Fix the login page')`));
  await shot('04-board');
  await js(`__sy.actions.dispatchTask(${JSON.stringify(task)}, 'fake')`);
  const after = async () => (await js(`__sy.api.tasks(${JSON.stringify(repo)})`))[0];
  ok('task moved to review after the agent finished', await until('review', `__sy.api.tasks(${JSON.stringify(repo)}).then(t => t[0].status === 'review')`, 75000));
  const moved = await after();
  ok('task got its own branch', moved.branch?.startsWith('task/fix-the-login-page'), moved.branch);
  ok('worktree sits beside the repo', moved.worktree?.includes('demo-shop-worktrees'), moved.worktree);
  const taskPane = await js(`Object.values(${S}.panes).find(p => p.taskId === ${JSON.stringify(task.id)}).id`);
  ok('agent received the task', await until('task text', `__sy.terminals.screenText(${JSON.stringify(taskPane)}).includes('Fix the login')`, 20000));
  await shot('05-task-agent');

  step('Task board over MCP');
  const db = join(process.env.APPDATA, 'app.switchyard.desktop', 'switchyard.sqlite3');
  const bin = join(here, '..', 'src-tauri', 'target', 'debug', 'switchyard-tasks.exe');
  const lines = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_tasks', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_task', arguments: { title: 'Made by an agent' } } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'update_task', arguments: { id: 'missing', status: 'done' } } },
  ];
  const run = spawnSync(bin, ['--db', db, '--workspace', repo], { input: lines.map((l) => JSON.stringify(l)).join('\n') + '\n', encoding: 'utf8' });
  const replies = run.stdout.trim().split('\n').map((l) => JSON.parse(l));
  ok('MCP answers every request, not the notice', replies.length === 5, `${replies.length} ${run.stderr}`);
  ok('MCP lists 4 tools', replies[1].result?.tools?.length === 4);
  ok('MCP sees the task', replies[2].result?.content?.[0]?.text.includes('Fix the login page'));
  ok('MCP reports a bad id as a tool error', replies[4].result?.isError === true);
  await js(`${S}.setView('board')`);
  ok('board shows the agent task', await until('board', `document.querySelector('.column-todo')?.textContent.includes('Made by an agent')`));

  step('Git and files drawers');
  writeFileSync(join(repo, 'new-file.txt'), 'hello\n');
  await js(`${S}.selectWorkspace(${JSON.stringify(wsId)}); ${S}.jumpToPane(${JSON.stringify(first)}); ${S}.setDrawer('git')`);
  ok('git drawer shows the change', await until('git', `document.querySelector('.drawer')?.textContent.includes('new-file.txt')`));
  await shot('06-git');
  await js(`${S}.setDrawer('files')`);
  ok('files drawer lists the project', await until('files', `document.querySelector('.drawer')?.textContent.includes('README.md')`));
  await js(`${S}.setDrawer('files')`);

  step('Real coding tool');
  const installed = await js(`${S}.installed`);
  ok('finds Claude Code on this computer', installed.claude === true);
  const real = await js(`${S}.split(${JSON.stringify(first)}, 'column')`);
  await js(`__sy.actions.startAgent(${JSON.stringify(real)}, 'claude')`);
  ok('Claude Code draws in a pane', await until('claude', `__sy.terminals.screenText(${JSON.stringify(real)}).trim().length > 40`, 30000));
  await sleep(4000);
  await shot('07-real-claude');
  await js(`__sy.terminals.destroy(${JSON.stringify(real)}); ${S}.closePane(${JSON.stringify(real)})`);

  step('Reload rejoins running terminals');
  const keeper = await js(`__sy.api.termKeeper()`);
  ok('terminal keeper runs', keeper?.pid > 0, JSON.stringify(keeper));
  await sleep(1000);
  await js(`location.reload()`);
  await sleep(1500);
  await until('hooks', 'typeof __sy !== "undefined" && __sy.useStore.getState().ready', 30000);
  ok('workspace came back', await js(`${S}.workspaces.some(w => w.root === ${JSON.stringify(repo)})`));
  ok('agent pane did not go to sleep', await js(`${S}.panes[${JSON.stringify(taskPane)}]?.asleep !== true`));
  await js(`${S}.jumpToPane(${JSON.stringify(taskPane)})`);
  ok('agent screen came back', await until('replay', `__sy.terminals.screenText(${JSON.stringify(taskPane)}).includes('Fix the login')`, 15000));
  await js(`${S}.jumpToPane(${JSON.stringify(first)})`);
  ok('shell screen came back', await until('replay', `__sy.terminals.screenText(${JSON.stringify(first)}).includes('hello-yard')`, 15000));
  await type(first, 'echo "v=$syKeep"\r');
  ok('same shell is still running', await until('same', `__sy.terminals.screenText(${JSON.stringify(first)}).includes('v=kept-42')`, 15000));
  await sleep(1000);
  await js(`__sy.terminals.sendText(${JSON.stringify(taskPane)}, 'after reload')`);
  ok('rejoined agent still answers', await until('answer', `__sy.terminals.screenText(${JSON.stringify(taskPane)}).includes('Did: after reload')`, 15000));
  ok('no stale notice after rejoin', await js(`!${S}.activity.some(a => a.title.includes('failed in'))`));
  await shot('08-restored');

  step('Errors on the page');
  const real_errors = consoleErrors.filter((e) => e && !/WebSocket|HMR|vite/i.test(e));
  ok('no page errors', real_errors.length === 0, real_errors.slice(0, 3).join(' | '));
} finally {
  // Leave the app clean: drop the test folder and its tasks.
  try {
    await js(`(async () => {
      const s = __sy.useStore.getState();
      const w = s.workspaces.find(w => w.root === ${JSON.stringify(repo)});
      for (const t of await __sy.api.tasks(${JSON.stringify(repo)})) await __sy.api.taskUpdate(t.id, { archived: true });
      if (w) { s.removeWorkspace(w.id); }
      await __sy.api.termKillAll();
    })()`);
    await sleep(900);
  } catch (e) {
    console.log('cleanup problem:', e.message);
  }
  ws.close();
  try {
    rmSync(project, { recursive: true, force: true });
  } catch {
    // A terminal may still hold the folder for a moment. It is only a temp folder.
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
