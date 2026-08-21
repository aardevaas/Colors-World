/**
 * Captures the README product screenshots by driving Chrome over the DevTools
 * Protocol.
 *
 * Chrome's plain `--screenshot` flag can't run JavaScript before capturing,
 * which makes it useless for any tab whose interesting state lives in
 * localStorage (the Harmonic Dock) or has to be seeded first. CDP gives us
 * navigate → evaluate → capture, with zero npm dependencies: Node 24 ships a
 * global WebSocket.
 *
 * Usage:  node scripts/capture-screenshots.mjs [baseUrl]
 * Writes: docs/assets/{library,builder,studio}.png
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const OUT_DIR = 'docs/assets';
const WIDTH = 1440;
const HEIGHT = 900;
const SCALE = 2; // retina

const CHROME = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium_headless_shell-1228',
  'chrome-headless-shell-mac-arm64/chrome-headless-shell'
);

/** A few real colors so /builder renders actual scales instead of its empty state. */
const DOCK_SEED = {
  items: [
    { hex: '#5A3F73', oklch: { l: 0.41, c: 0.077, h: 305.6 }, addedAt: 1 },
    { hex: '#19D368', oklch: { l: 0.76, c: 0.21, h: 149.3 }, addedAt: 2 },
    { hex: '#CFA15D', oklch: { l: 0.73, c: 0.098, h: 78.2 }, addedAt: 3 },
  ],
  primaryAnchorHex: '#5A3F73',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * chrome-headless-shell starts with no page target at all, so /json/list is
 * empty and there is nothing to attach to. Connect to the *browser* endpoint
 * from /json/version instead, create a target explicitly, then attach to it.
 */
async function browserEndpoint(port) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const { webSocketDebuggerUrl } = await res.json();
      if (webSocketDebuggerUrl) return webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error('Chrome DevTools browser endpoint never came up');
}

function cdpClient(ws) {
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  return (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const port = 9333;
  const chrome = spawn(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    '--user-data-dir=/tmp/cw-cdp-shot',
  ]);
  chrome.stderr.on('data', () => {});

  const wsUrl = await browserEndpoint(port);
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const raw = cdpClient(ws);

  const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => raw(method, params, sessionId);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: SCALE,
    mobile: false,
  });

  async function goto(url, settleMs = 3500) {
    await send('Page.navigate', { url });
    await sleep(settleMs);
  }

  async function evaluate(expression) {
    return send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  }

  async function shoot(name) {
    // Next.js dev-tools badge would otherwise sit in every screenshot.
    await evaluate(`
      (() => { const p = document.querySelector('nextjs-portal'); if (p) p.style.display='none'; })()
    `);
    await sleep(250);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const path = join(OUT_DIR, `${name}.png`);
    writeFileSync(path, Buffer.from(data, 'base64'));
    console.log(`  ✓ ${path}`);
  }

  console.log(`Capturing from ${BASE}`);

  // Establish an origin so localStorage is writable, then seed the dock.
  await goto(`${BASE}/library`, 4000);
  await evaluate(
    `localStorage.setItem('colorsworld.dock.v1', ${JSON.stringify(JSON.stringify(DOCK_SEED))})`
  );

  await goto(`${BASE}/library`, 4500);
  await shoot('library');

  await goto(`${BASE}/builder`, 5000);
  await shoot('builder');

  await goto(`${BASE}/studio`, 5000);
  await shoot('studio');

  ws.close();
  chrome.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
