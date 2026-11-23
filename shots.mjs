// Laguna Azul v2 — screenshot runner v2 (fresh, written for this entry).
// Serves game/ on localhost, drives headless Chrome over CDP with Node's
// built-in WebSocket: navigate, wait for window.__gameReady, capture a
// real render. No editing, no compositing.
// Usage: node shots.mjs [port]
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname);
const GAME = join(ROOT, 'game');
const OUT = join(ROOT, 'screenshots');
const PORT = parseInt(process.argv[2] || '8123', 10);
const CDP_PORT = 9222;
const CHROME = process.env.CHROME_BIN ||
  (process.env.HOME + '/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(GAME, path === '/' ? 'index.html' : path);
  if (!file.startsWith(GAME) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

const SHOTS = [
  { name: '1-hero.jpg', query: '?shot=hero&seed=1', settleMs: 3500 },
  { name: '2-foot.jpg', query: '?shot=foot&seed=1', settleMs: 2500 },
  { name: '3-market.jpg', query: '?shot=market&seed=1', settleMs: 2500 },
  { name: '4-start.jpg', query: '?shot=start&seed=1', settleMs: 2500 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--window-size=1280,720',
    '--remote-debugging-port=' + CDP_PORT, '--remote-debugging-address=127.0.0.1',
    'about:blank',
  ], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch (e) { /* not up yet */ }
    await sleep(500);
  }
  if (!target) throw new Error('CDP did not come up');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  return {
    chrome, send, evalJs,
    async shot(s) {
      await send('Page.enable');
      await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html${s.query}` });
      // wait for the game to signal readiness (max 60s)
      let ready = false, errors = [];
      for (let i = 0; i < 120; i++) {
        await sleep(500);
        ready = await evalJs('window.__gameReady === true');
        if (ready) break;
        const err = await evalJs('window.__gameError || null');
        if (err) { errors.push(err); break; }
      }
      await sleep(s.settleMs);
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
      const data = shot.result && shot.result.data;
      if (!data) throw new Error('no screenshot data for ' + s.name);
      writeFileSync(join(OUT, s.name), Buffer.from(data, 'base64'));
      const errs = await evalJs('(window.__consoleErrors||[]).join(" | ")');
      console.log(s.name + ': ' + statSync(join(OUT, s.name)).size + ' bytes, ready=' + ready +
        (errs ? ', console errors: ' + String(errs).slice(0, 300) : ', console clean'));
      return { ready, errs };
    },
    close() { try { ws.close(); } catch (e) {} chrome.kill('SIGKILL'); },
  };
}

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
console.log('serving game/ on http://127.0.0.1:' + PORT);
const client = await cdp();
try {
  for (const s of SHOTS) await client.shot(s);
} finally {
  client.close();
  server.close();
}
console.log('done');
