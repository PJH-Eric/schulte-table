/* ===== scripts/failover-check.cjs — 主備後端切換測試（開發用，需要 playwright 與執行中的本機伺服器）=====
 * 把頁面當成 https://pjh-eric.github.io/schulte-table/ 開啟（內容來自本機），
 *   情境 1：Render 正常 → 連 Render；
 *   情境 2：Render 連不上 → 自動改連 Cloudflare 備援，邀請連結帶 backend=cloudflare；
 *   情境 3：開邀請連結（backend=cloudflare）→ 直接連備援，不先試 Render。
 * 兩台「後端」都由 playwright 轉接到本機伺服器，記錄實際連到哪一台。
 */
'use strict';
const { chromium } = require('playwright');
const assert = require('assert/strict');
const LOCAL = process.env.BASE || 'http://localhost:3120/';
const SITE = 'https://pjh-eric.github.io/schulte-table/';
const RENDER = 'schulte-table.onrender.com';
const CF = 'schulte-table-backup.eric-games.workers.dev';

async function open(b, renderUp, query) {
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } });
  const p = await ctx.newPage();
  const hits = [];
  await ctx.route(SITE + '**', async route => {
    const u = new URL(route.request().url());
    const r = await fetch(LOCAL + u.pathname.replace('/schulte-table/', '') + u.search);
    let body = Buffer.from(await r.arrayBuffer());
    if (/\/config\.js$/.test(u.pathname)) body = Buffer.from(body.toString().replace("var INJECTED = '';", "var INJECTED = 'https://" + RENDER + "';"));
    await route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'text/html' }, body });
  });
  await ctx.route('https://www.googletagmanager.com/**', r => r.abort());
  await ctx.route(/onrender\.com\/health|workers\.dev\/health/, async route => {
    const host = new URL(route.request().url()).host;
    if (host === RENDER && !renderUp) return route.abort('connectionrefused');
    const r = await fetch(LOCAL + 'health');
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: await r.text() });
  });
  await ctx.routeWebSocket(/onrender\.com|workers\.dev/, ws => {
    const host = new URL(ws.url()).host;
    hits.push(host);
    if (host === RENDER && !renderUp) { ws.close({ code: 1006 }); return; }
    const up = new WebSocket(LOCAL.replace('http', 'ws') + 'ws');
    const queue = [];
    up.onopen = () => { queue.splice(0).forEach(m => up.send(m)); };
    up.onmessage = e => ws.send(e.data);
    up.onclose = () => { try { ws.close(); } catch (e) { /* ignore */ } };
    ws.onMessage(m => { if (up.readyState === 1) up.send(m); else queue.push(m); });
    ws.onClose(() => up.close());
  });
  await p.goto(SITE + (query || ''));
  await p.waitForTimeout(400);
  return { ctx, p, hits };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
  const ok = [];
  try {
    /* 1. Render 正常 */
    let s = await open(b, true);
    assert.ok(await s.p.evaluate(() => !!window.GameBackend), '正式網址啟用主備切換');
    await s.p.evaluate(() => OnlineUI.enterLobby());
    await s.p.waitForFunction(() => Net.status === 'open', null, { timeout: 15000 });
    assert.equal(s.hits.filter(h => h === CF).length, 0, '主機正常時不連備援');
    ok.push('primary');
    await s.ctx.close();

    /* 2. Render 掛掉 → Cloudflare */
    s = await open(b, false);
    await s.p.evaluate(() => OnlineUI.enterLobby());
    await s.p.waitForFunction(() => Net.status === 'open', null, { timeout: 40000 });
    assert.ok(s.hits.includes(CF), '改連備援');
    await s.p.evaluate(() => Net.send({ type: 'create', name: '備援房主' }));
    await s.p.waitForFunction(() => !!OnlineUI.room, null, { timeout: 5000 });
    await s.p.waitForTimeout(300);
    const inv = await s.p.evaluate(() => document.getElementById('inv-url').textContent);
    assert.match(inv, /backend=cloudflare/, '邀請連結釘選備援');
    ok.push('failover');

    /* 3. 用邀請連結開啟 → 直接連備援 */
    const q = inv.slice(inv.indexOf('?'));
    const g = await open(b, true, q);
    await g.p.waitForFunction(() => Net.status === 'open', null, { timeout: 15000 });
    assert.deepEqual(Array.from(new Set(g.hits)), [CF], '邀請連結只連備援');
    await g.p.click('#inv-play');
    await g.p.waitForFunction(() => OnlineUI.room && OnlineUI.room.seats.filter(Boolean).length === 2, null, { timeout: 5000 });
    ok.push('pinnedInvite');
    await g.ctx.close(); await s.ctx.close();
    console.log('failover-check OK:', ok.join(', '));
  } catch (e) {
    console.error('failover-check FAILED after [' + ok.join(', ') + ']:', e.message.split('\n')[0]);
    process.exitCode = 1;
  } finally { await b.close(); }
})();
