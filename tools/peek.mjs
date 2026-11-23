// Runs one line of script inside the running app and prints the answer. Usage: node tools/peek.mjs "<expression>"
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find((t) => t.type === 'page' && t.url.includes('1520'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id === 1) {
    console.log(JSON.stringify(msg.result?.result?.value ?? msg.result, null, 1));
    process.exit(0);
  }
};
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: process.argv[2], awaitPromise: true, returnByValue: true } }));
