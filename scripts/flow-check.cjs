/* ===== scripts/flow-check.cjs — 單機流程與紀錄測試（開發用，需要 playwright 與執行中的伺服器）=====
 * 經典完整一局＋再來一局、暫停與重新倒數、闖關解鎖與星數、每日挑戰只計第一次、
 * 隨機模式共用最佳紀錄並累計局數、重新開始是否換排列、幼幼班提示、首頁與單機沒有任何後端連線。
 */
'use strict';
const { chromium } = require('playwright');
const assert = require('assert/strict');
const BASE = process.env.BASE || 'http://localhost:3120/';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 } });
  const p = await ctx.newPage();
  const errs = [], net = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); });
  p.on('request', r => { const u = r.url(); if (/\/(ws|health|api)\b/.test(u)) net.push(u); });
  p.on('websocket', w => net.push('ws ' + w.url()));
  await p.goto(BASE); await p.waitForTimeout(300);
  const ok = [];
  const solveAll = () => p.evaluate(() => { const c = Solo.current; while (c.phase === 'playing') Solo._tap(Rules.cellOfStep(c.board, c.game.players.me.step)); });

  /* 1. 經典：倒數期間不能點，完整一局 → 結算 → 再來一局換新排列 */
  await p.evaluate(() => Solo.start({ mode: 'classic', content: 'letter', tier: 1 }));
  await p.waitForTimeout(300);
  const before = await p.evaluate(() => { const c = Solo.current; Solo._tap(Rules.cellOfStep(c.board, 0)); return c.game.players.me.step; });
  assert.equal(before, 0, '倒數期間點擊無效');
  await p.waitForTimeout(3000);
  const layout1 = await p.evaluate(() => Solo.current.board.cells.join(','));
  await solveAll(); await p.waitForTimeout(800);
  assert.ok(await p.evaluate(() => Result.visible()), '結算出現');
  assert.ok(await p.evaluate(() => Store.best('letter:1:asc') > 0), '存最佳紀錄');
  await p.click('[data-act="again"]'); await p.waitForTimeout(200);
  const layout2 = await p.evaluate(() => Solo.current.board.cells.join(','));
  assert.notEqual(layout1, layout2, '再來一局換新排列');
  ok.push('classic');

  /* 2. 暫停：計時凍結、盤面遮蓋；繼續後重新倒數 */
  await p.waitForTimeout(3200);
  await p.waitForTimeout(400);
  await p.keyboard.press('Escape');
  const t1 = await p.evaluate(() => Solo._elapsed()); await p.waitForTimeout(600);
  const t2 = await p.evaluate(() => Solo._elapsed());
  assert.equal(t1, t2, '暫停時計時凍結');
  assert.ok(await p.evaluate(() => !document.getElementById('pause-layer').hidden));
  await p.click('[data-p="resume"]'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => Solo.current.phase), 'countdown', '繼續後重新倒數');
  ok.push('pause');

  /* 3. 闖關：第 1 關通過才解鎖第 2 關；星數；重新開始排列不變 */
  await p.evaluate(() => { Store.set('levels', {}); App.show('levels'); });
  assert.equal(await p.evaluate(() => Store.unlockedLevel()), 1);
  await p.click('[data-lv="2"]', { force: true }); assert.equal(await p.evaluate(() => App.screen), 'levels', '未解鎖不能玩');
  await p.click('[data-lv="1"]'); await p.waitForTimeout(3300);
  const lv1 = await p.evaluate(() => Solo.current.board.cells.join(','));
  await p.evaluate(() => Solo.restart()); await p.waitForTimeout(3300);
  assert.equal(await p.evaluate(() => Solo.current.board.cells.join(',')), lv1, '闖關重開排列相同');
  await solveAll(); await p.waitForTimeout(800);
  const lv = await p.evaluate(() => Store.levels()[1]);
  assert.equal(lv.stars, 3, '很快完成 3 星');
  assert.equal(await p.evaluate(() => Store.unlockedLevel()), 2);
  await p.click('[data-act="again"]'); await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => Solo.current.spec.level), 2, '下一關');
  ok.push('levels');

  /* 4. 每日：第一次計入，之後練習不計入 */
  await p.evaluate(() => { Store.set('daily', {}); Solo.start({ mode: 'daily', tier: 0, skipCountdown: true }); });
  await solveAll(); await p.waitForTimeout(800);
  const d1 = await p.evaluate(() => Store.daily()[Rules.taipeiDate()][0]);
  assert.ok(d1 > 0);
  await p.evaluate(() => Solo.restart()); await p.waitForTimeout(3300);
  await p.waitForTimeout(500);
  await solveAll(); await p.waitForTimeout(800);
  assert.equal(await p.evaluate(() => Store.daily()[Rules.taipeiDate()][0]), d1, '只記第一次');
  assert.ok(await p.evaluate(() => document.querySelector('.res-flags').textContent.length > 0), '顯示練習');
  assert.equal(await p.evaluate(() => Store.dailyStreak(Rules.taipeiDate())), 1);
  ok.push('daily');

  /* 5. 隨機：只抽允許的內容；共用最佳紀錄；累計局數；再抽一局 */
  const rc0 = await p.evaluate(() => Store.stats().randomGames || 0);
  await p.evaluate(() => Solo.start({ mode: 'random', tier: 4, skipCountdown: true }));
  const sp = await p.evaluate(() => Solo.current.bs);
  assert.equal(sp.content, 'number', '神話只會抽到數字');
  await solveAll(); await p.waitForTimeout(800);
  assert.equal(await p.evaluate(() => Store.stats().randomGames), rc0 + 1);
  assert.ok(await p.evaluate(k => Store.best(k) > 0, 'number:4:' + sp.order), '共用最佳紀錄');
  await p.click('[data-act="again"]'); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => !document.getElementById('draw-layer').hidden), '再抽一局有抽籤動畫');
  ok.push('random');

  /* 6. 幼幼班提示：連續點錯 3 次閃動正確格，點對後消失 */
  await p.evaluate(() => Solo.start({ mode: 'classic', content: 'number', tier: 0, skipCountdown: true }));
  const hint = await p.evaluate(() => { const c = Solo.current, want = Rules.cellOfStep(c.board, 0), w = (want + 1) % 9; Solo._tap(w); Solo._tap(w); const a = document.querySelectorAll('.cell.hint').length; Solo._tap(w); const el = document.querySelector('.cell.hint'); const b = el && Number(el.dataset.i) === want; Solo._tap(want); return [a, b, document.querySelectorAll('.cell.hint').length]; });
  assert.deepEqual(hint, [0, true, 0]);
  ok.push('kidHint');

  /* 7. 點已點過的格子不算錯 */
  const miss = await p.evaluate(() => { const c = Solo.current; const d = Rules.cellOfStep(c.board, 0); Solo._tap(d); return c.game.players.me.misses; });
  assert.equal(miss, 3);
  ok.push('doneCellNoMiss');

  /* 8. 首頁與單機不連線 */
  assert.deepEqual(net, [], '單機沒有後端連線');
  assert.deepEqual(errs, []);
  ok.push('offline');
  console.log('flow-check OK:', ok.join(', '));
  await b.close();
})().catch(e => { console.error('flow-check FAILED:', e.message); process.exit(1); });
