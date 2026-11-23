// A pretend coding agent for tests. It costs nothing and behaves the same way every time.
process.stdin.setRawMode?.(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

const say = (t) => process.stdout.write(t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let buffer = '';
let asking = false;
let goalRounds = 0;

async function work(label) {
  for (let i = 1; i <= 4; i++) {
    say(`${label} step ${i}\r\n`);
    await sleep(300);
  }
  say('> ');
}

async function onLine(line) {
  say('\r\n');
  if (asking) {
    asking = false;
    await work(line.trim() === 'y' ? 'Approved, doing it' : 'Skipped');
    return;
  }
  if (line.includes('risky')) {
    await work('Looking');
    say('\r\nDo you want to proceed? (y/n) ');
    asking = true;
    return;
  }
  if (line.includes('Goal:') || line.includes('Keep going')) {
    goalRounds++;
    await work(`Goal round ${goalRounds}`);
    if (goalRounds >= 2) say('\r\nAUTO' + '-DONE\r\n> ');
    return;
  }
  if (line.includes('bye')) process.exit(0);
  await work(`Did: ${line.slice(0, 50)}`);
}

process.stdin.on('data', (data) => {
  const clean = data.replace(/\x1b\[20[01]~/g, '');
  for (const ch of clean) {
    if (ch === '\r') {
      const line = buffer;
      buffer = '';
      void onLine(line);
    } else if (ch === '\u0003') {
      process.exit(130);
    } else {
      buffer += ch;
      say(ch === '\n' ? '\r\n' : ch);
    }
  }
});

say('Fake agent ready\r\n> ');
