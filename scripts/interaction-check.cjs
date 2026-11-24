/* ===== scripts/interaction-check.cjs — 互動巡檢（開發用，需要 playwright 與執行中的伺服器）=====
 * 純鍵盤玩完一局、遊戲中切換語言、遊戲中旋轉裝置、設定保存、減少動態、瀏覽器上一頁、結算分享圖片。
 */
'use strict';
const { chromium } = require('playwright');
const assert = require('assert/strict');
const BASE = process.env.BASE || 'http://localhost:3120/';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
  const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const ok = [];
  try {
    await p.goto(BASE + '?lobby=https://example.com/hub/'); await p.waitForTimeout(300);

    /* 1. 純鍵盤：Tab 到單機 → 經典 → 開始，方向鍵＋Enter 點完 3×3 */
    await p.evaluate(() => App.openSetup('classic'));
    await p.evaluate(() => { document.querySelector('#set-tier [data-v="0"]').click(); document.querySelector('#set-content [data-v="number"]').click(); });
    await p.focus('#setup-start'); await p.keyboard.press('Enter');
    await p.waitForTimeout(3300);
    for (let s = 0; s < 9; s++) {
      const [want, cur] = await p.evaluate(() => [Rules.cellOfStep(Solo.current.board, Solo.current.game.players.me.step), Number(document.activeElement.dataset.i)]);
      const dr = Math.floor(want / 3) - Math.floor(cur / 3), dc = want % 3 - cur % 3;
      for (let k = 0; k < Math.abs(dr); k++) await p.keyboard.press(dr > 0 ? 'ArrowDown' : 'ArrowUp');
      for (let k = 0; k < Math.abs(dc); k++) await p.keyboard.press(dc > 0 ? 'ArrowRight' : 'ArrowLeft');
      await p.keyboard.press('Enter');
    }
    await p.waitForTimeout(900);
    assert.ok(await p.evaluate(() => Result.visible()), '鍵盤可玩完');
    assert.equal(await p.evaluate(() => document.activeElement.dataset.act), 'again', '結算焦點在再來一局');
    ok.push('keyboard');

    /* 2. 結算分享圖片 */
    await p.click('.result-share-trigger');
    await p.waitForSelector('.result-share-image', { timeout: 15000 });
    const img = await p.evaluate(() => { const i = document.querySelector('.result-share-image'); return i.naturalWidth; });
    assert.ok(img > 200, '分享圖片產生');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok.push('shareImage');

    /* 3. 遊戲中切換語言：頂列、側欄、結算一起更新 */
    await p.evaluate(() => Solo.start({ mode: 'level', level: 5, skipCountdown: true }));
    await p.evaluate(() => I18N.setLang('en'));
    assert.match(await p.evaluate(() => document.getElementById('top-title').textContent), /Level 5/);
    assert.match(await p.evaluate(() => document.getElementById('summary').textContent), /Mode/);
    await p.evaluate(() => I18N.setLang('zh-Hans'));
    assert.match(await p.evaluate(() => document.getElementById('summary').textContent), /模式/);
    assert.equal(await p.evaluate(() => document.documentElement.lang), 'zh-Hans');
    ok.push('relang');

    /* 4. 遊戲中旋轉：盤面重新取最大正方形且在畫面內 */
    for (const [w, h] of [[1180, 820], [390, 844], [844, 390], [820, 1180]]) {
      await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250);
      const r = await p.evaluate(() => { const b = document.querySelector('#scr-game .board').getBoundingClientRect(); return [b.width, b.height, b.bottom <= innerHeight + 1, b.right <= innerWidth + 1]; });
      assert.ok(Math.abs(r[0] - r[1]) < 2 && r[2] && r[3], 'rotate ' + w + 'x' + h + ' ' + r);
    }
    ok.push('rotate');

    /* 5. 設定保存（重新整理後還在）、減少動態 */
    await p.evaluate(() => { Store.setSetting('theme', 'tech'); Store.setSetting('reduceMotion', true); I18N.setLang('en'); });
    await p.reload(); await p.waitForTimeout(400);
    assert.deepEqual(await p.evaluate(() => [document.getElementById('app').dataset.theme, document.getElementById('app').classList.contains('reduce-motion'), I18N.lang]), ['tech', true, 'en']);
    await p.click('#btn-settings'); await p.waitForTimeout(200);
    await p.click('.modal-actions .btn.ghost'); await p.waitForTimeout(300);   // 恢復預設
    assert.equal(await p.evaluate(() => document.getElementById('app').dataset.theme), 'wood');
    await p.keyboard.press('Escape');
    ok.push('settings');

    /* 6. 上一頁：子畫面回上一層；遊戲中變暫停；首頁回遊戲大廳 */
    await p.evaluate(() => App.show('solo')); await p.evaluate(() => App.openSetup('reverse'));
    await p.goBack(); await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => App.screen), 'solo');
    await p.evaluate(() => Solo.start({ mode: 'classic', content: 'number', tier: 1, skipCountdown: true }));
    await p.goBack(); await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => Solo.current.phase), 'paused', '遊戲中上一頁＝暫停');
    await p.evaluate(() => Solo.quit()); await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => App.screen), 'home');
    assert.ok(await p.evaluate(() => !document.getElementById('btn-lobby').hidden), '首頁左上有遊戲大廳');
    const nav = p.waitForURL(/example\.com/, { timeout: 5000 }).then(() => true, () => false);
    await p.route('https://example.com/**', r => r.fulfill({ body: 'hub' }));
    await p.goBack();
    assert.ok(await nav, '首頁上一頁回遊戲大廳');
    ok.push('back');

    assert.deepEqual(errs, []);
    console.log('interaction-check OK:', ok.join(', '));
  } catch (e) {
    console.error('interaction-check FAILED after [' + ok.join(', ') + ']:', e.message.split('\n')[0], errs);
    process.exitCode = 1;
  } finally { await b.close(); }
})();
