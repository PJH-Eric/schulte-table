/* ===== cloudflare/smoke.mjs — 在 Node 裡模擬 Durable Object，驗證打包後的備援後端能跑完一局 =====
 * 用法：node cloudflare/smoke.mjs（先 node cloudflare/build-worker.cjs 產生 dist/worker.mjs）
 * 只替換 cloudflare:workers 與 WebSocketPair；遊戲伺服器、規則與房間邏輯都是打包後的真實程式。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const Rules = createRequire(import.meta.url)('../public/js/rules.js');
const src = fs.readFileSync(path.join(here, 'dist', 'worker.mjs'), 'utf8');
const stub = 'data:text/javascript,' + encodeURIComponent('export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }');
const patched = src.replace(/from\s*"cloudflare:workers"/g, 'from"' + stub + '"').replace(/from\s*'cloudflare:workers'/g, "from'" + stub + "'");
const tmp = path.join(here, 'dist', 'worker.smoke.mjs');
fs.writeFileSync(tmp, patched);

/* 一對互相連通的 WebSocket（server 端給 DO，client 端給測試） */
class Side extends EventTarget {
  constructor() { super(); this.readyState = 1; this.peer = null; }
  accept() {}
  send(data) { if (this.readyState !== 1) throw new Error('closed'); const p = this.peer; queueMicrotask(() => p.dispatchEvent(Object.assign(new Event('message'), { data }))); }
  close() { if (this.readyState !== 1) return; this.readyState = 3; const p = this.peer; p.readyState = 3; queueMicrotask(() => { this.dispatchEvent(new Event('close')); p.dispatchEvent(new Event('close')); }); }
}
globalThis.WebSocketPair = function () { const a = new Side(), b = new Side(); a.peer = b; b.peer = a; return { 0: a, 1: b }; };
const NativeResponse = globalThis.Response;
globalThis.Response = class extends NativeResponse {
  constructor(body, init) { if (init && init.status === 101) { super(null, { status: 200 }); this.webSocket = init.webSocket; this.upgraded = true; return; } super(body, init); }
};

const mod = await import(pathToFileURL(tmp).href);
const lobby = new mod.GameLobby({ storage: {} }, {});
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function connect(cid, name) {
  const res = await lobby.fetch(new Request('https://x/ws', { headers: { Upgrade: 'websocket' } }));
  assert.ok(res.upgraded);
  const ws = res.webSocket, msgs = [];
  const c = { msgs, send: o => ws.send(JSON.stringify(o)), close: () => ws.close(), room: null };
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.type === 'room') c.room = m.room; msgs.push(m); });
  c.wait = async (pred, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { const m = msgs.find(pred); if (m) return m; await sleep(10); } throw new Error(name + ' timeout'); };
  c.send({ type: 'hello', clientId: cid, name });
  await c.wait(m => m.type === 'welcome');
  return c;
}

try {
  const health = await (await lobby.fetch(new Request('https://x/health'))).json();
  assert.equal(health.game, 'schulte-table');
  const a = await connect('smoke-client-a', 'A'), b = await connect('smoke-client-b', 'B');
  a.send({ type: 'create', name: 'A', settings: { mode: 'grab', content: 'zhuyin', tier: 0, rounds: 1 } });
  await a.wait(m => m.type === 'room');
  b.send({ type: 'join', roomId: a.room.id, name: 'B' });
  await b.wait(m => m.type === 'room');
  b.send({ type: 'ready', value: true }); await sleep(30);
  a.send({ type: 'start' });
  await a.wait(m => m.type === 'room' && m.room.status === 'playing');
  await sleep(3100);   // 備援後端用正式的 3 秒倒數
  const board = Rules.makeBoard(a.room.match.spec);
  for (let s = 0; s < 9; s++) { (s % 2 ? b : a).send({ type: 'tap', idx: Rules.cellOfStep(board, s) }); await a.wait(m => m.type === 'grab' && m.step === s + 1); }
  await a.wait(m => m.type === 'matchEnd');
  b.close(); await sleep(50);
  a.close(); await sleep(50);
  console.log('cloudflare smoke OK: health, room, grab match through the bundled worker');
} catch (e) {
  console.error('cloudflare smoke FAILED:', e.message);
  process.exitCode = 1;
} finally {
  fs.unlinkSync(tmp);
  setTimeout(() => process.exit(), 50);
}
