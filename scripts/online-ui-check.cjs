/* ===== scripts/online-ui-check.cjs — 線上介面邊界情境（開發用，需要 playwright 與執行中的伺服器）=====
 * 被踢回大廳、重新整理自動回房並還原盤面、房主中途離開時其他人看到總結算、零真人關房通知觀戰者。 */
'use strict';
const { chromium } = require('playwright');
const assert = require('assert/strict');
const BASE = process.env.BASE || 'http://localhost:3120/';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
  const mk = async () => { const c = await b.newContext({ viewport: { width: 1180, height: 820 } }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.goto(BASE); await p.waitForTimeout(300); await p.evaluate(() => OnlineUI.enterLobby()); await p.waitForFunction(() => Net.status === 'open'); return p; };
  const ok = [];
  try {
    const h = await mk(), g = await mk(), v = await mk();
    await h.evaluate(() => Net.send({ type: 'create', name: 'Host', settings: { mode: 'grab', content: 'number', tier: 1, rounds: 3 } }));
    await h.waitForFunction(() => App.screen === 'room');
    const id = await h.evaluate(() => OnlineUI.room.id);
    await g.evaluate(id => Net.send({ type: 'join', roomId: id, name: 'Guest' }), id);
    await g.waitForFunction(() => App.screen === 'room');
    /* 被踢 */
    await h.click('[data-kick]'); await h.click('.modal-actions .btn.danger');
    await g.waitForFunction(() => App.screen === 'lobby' && !OnlineUI.room);
    assert.ok(await g.evaluate(() => /房主|removed/.test(document.getElementById('toasts').textContent)));
    ok.push('kicked');
    /* 再加入、開始；重新整理回房 */
    await g.evaluate(id => Net.send({ type: 'join', roomId: id, name: 'Guest' }), id);
    await g.waitForFunction(() => App.screen === 'room');
    await g.click('#rm-ready'); await h.waitForTimeout(200); await h.click('#rm-start');
    await g.waitForFunction(() => App.screen === 'game');
    await v.evaluate(id => Net.send({ type: 'join', roomId: id, name: 'Viewer', want: 'spectator' }), id);
    await g.waitForTimeout(3300);
    for (let i = 0; i < 3; i++) { await g.evaluate(() => OnlineUI._tapNext()); await g.waitForTimeout(80); }
    await g.reload(); await g.waitForTimeout(400);
    await g.waitForFunction(() => App.screen === 'game' && document.querySelectorAll('#scr-game .cell.done').length === 3, null, { timeout: 8000 });
    ok.push('reloadRestore');
    /* 房主中途離開 → 只剩一人，結束並顯示總結算 */
    await h.evaluate(() => { Net.send({ type: 'leave' }); });
    await g.waitForFunction(() => Result.visible(), null, { timeout: 5000 });
    assert.equal(await g.evaluate(() => OnlineUI.room.you.host), true, '房主轉給留下的人');
    ok.push('hostLeft');
    /* 最後一位玩家離開 → 觀戰者收到關房 */
    await g.evaluate(() => Net.send({ type: 'leave' }));
    await v.waitForFunction(() => App.screen === 'lobby' && !OnlineUI.room, null, { timeout: 5000 });
    ok.push('closedForSpectator');
    for (const p of [h, g, v]) assert.deepEqual(p.errs, []);
    console.log('online-ui-check OK:', ok.join(', '));
  } catch (e) { console.error('online-ui-check FAILED after [' + ok.join(', ') + ']:', e.message.split('\n')[0]); process.exitCode = 1; }
  finally { await b.close(); }
})();
