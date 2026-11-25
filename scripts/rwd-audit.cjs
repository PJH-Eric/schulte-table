/* ===== scripts/rwd-audit.cjs — 全畫面 RWD 巡檢（開發用，需要 playwright 與執行中的伺服器）=====
 * 用法：node scripts/rwd-audit.cjs <round> [scene,scene...]
 *   環境變數：BASE（預設 http://localhost:3120/）、LANGS（預設 zh-Hant,en）、THEMES（預設 wood）、VIEWS_JSON、PW_CHROME
 * 輸出 tmp/audit/<round>/*.png 與 report.json。
 * 每個「畫面 × 裝置 × 語言 × 主題」檢查：JS 錯誤、水平溢出、文字被截斷、頂列互相重疊、原生控制項外露、
 * 主要操作在可視範圍或可捲動容器內、盤面格子 ≥ 44px 且整個盤面在畫面內。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const round = process.argv[2] || 'r';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const out = path.join(__dirname, '..', 'tmp', 'audit', round);
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:3120/';
const VIEWS = process.env.VIEWS_JSON ? JSON.parse(process.env.VIEWS_JSON) : [['phoneS', 360, 640], ['phone', 390, 844], ['phoneL', 844, 390], ['tabP', 820, 1180], ['tabL', 1180, 820], ['desk', 1440, 900]];
const LANGS = (process.env.LANGS || 'zh-Hant,en').split(',');
const THEMES = (process.env.THEMES || 'wood').split(',');

const tapOnline = async (pg, n) => { for (let i = 0; i < n; i++) { await pg.evaluate(() => OnlineUI._tapNext()); await pg.waitForTimeout(60); } };
const solo = (o) => async p => { await p.evaluate(o => Solo.start(Object.assign({ skipCountdown: true }, o)), o); await p.waitForTimeout(150); };
const tapN = (n) => async p => p.evaluate(n => { const c = Solo.current; for (let i = 0; i < n; i++) Solo._tap(Rules.cellOfStep(c.board, c.game.players.me.step)); }, n);
const finish = async p => { await p.evaluate(() => { const c = Solo.current; while (c.phase === 'playing') Solo._tap(Rules.cellOfStep(c.board, c.game.players.me.step)); }); await p.waitForTimeout(900); };

let BROWSER = null;
const extraPages = [];
/* 線上場景：另開分頁當第二位玩家 */
async function second(p, name, extra) {
  const id = await p.evaluate(() => OnlineUI.room && OnlineUI.room.id);
  const ctx = await BROWSER.newContext({ viewport: { width: 800, height: 600 } });
  const q = await ctx.newPage();
  await q.goto(BASE); await q.waitForTimeout(300);
  await q.evaluate(() => OnlineUI.enterLobby()); await q.waitForTimeout(700);
  await q.evaluate(a => Net.send({ type: 'join', roomId: a[0], name: a[1], want: 'player' }), [id, name || '第二位玩家很長的名字']); await q.waitForTimeout(400);
  await q.evaluate(() => Net.send({ type: 'ready', value: true })); await q.waitForTimeout(200);
  if (extra) await extra(q);
  extraPages.push(ctx);
  return q;
}
async function createRoom(p, settings) {
  await p.evaluate(() => OnlineUI.enterLobby()); await p.waitForTimeout(900);
  await p.evaluate(s => Net.send({ type: 'create', name: '測試玩家名字很長很長', settings: s }), settings); await p.waitForTimeout(700);
}

const SCENES = {
  home: async p => {},
  solo: async p => p.evaluate(() => App.show('solo')),
  setup: async p => p.evaluate(() => App.openSetup('classic')),
  setupRandom: async p => p.evaluate(() => App.openSetup('random')),
  levels: async p => p.evaluate(() => App.show('levels')),
  daily: async p => p.evaluate(() => App.show('daily')),
  records: async p => p.evaluate(() => App.show('records')),
  help: async p => p.evaluate(() => App.show('help')),
  settings: async p => { await p.click('#btn-settings'); await p.waitForTimeout(250); },
  langMenu: async p => { await p.click('#btn-lang'); },
  confirm: async p => { await p.evaluate(() => App.show('records')); await p.click('#rec-clear'); await p.waitForTimeout(200); },
  game: async p => { await solo({ mode: 'classic', content: 'number', tier: 2 })(p); await tapN(6)(p); },
  gameMyth: async p => { await solo({ mode: 'classic', content: 'number', tier: 4 })(p); await tapN(3)(p); },
  gameKing: async p => { await solo({ mode: 'classic', content: 'number', tier: 5 })(p); await tapN(3)(p); },
  gameKid: async p => { await solo({ mode: 'reverse', content: 'zhuyin', tier: 0 })(p); await p.evaluate(() => { const c = Solo.current; const w = (Rules.cellOfStep(c.board, 0) + 1) % 9; Solo._tap(w); Solo._tap(w); Solo._tap(w); }); },
  gameAZ: async p => { await solo({ mode: 'classic', content: 'letter', tier: 2 })(p); await tapN(3)(p); },
  gameZhuyinFull: async p => { await solo({ mode: 'reverse', content: 'zhuyin', tier: 3 })(p); await tapN(2)(p); },
  gameIcon: async p => { await solo({ mode: 'classic', content: 'icon', tier: 2 })(p); await tapN(4)(p); },
  gameChaos: async p => { await solo({ mode: 'level', level: 40 })(p); await tapN(4)(p); },
  countdown: async p => { await p.evaluate(() => Solo.start({ mode: 'classic', content: 'letter', tier: 1 })); await p.waitForTimeout(400); },
  draw: async p => { await p.evaluate(() => Solo.start({ mode: 'random', tier: 3 })); await p.waitForTimeout(250); },
  pause: async p => { await SCENES.game(p); await p.evaluate(() => Solo.pause()); },
  side: async p => { await SCENES.game(p); await p.evaluate(() => App.openSide()); },
  result: async p => { await solo({ mode: 'classic', content: 'number', tier: 1 })(p); await finish(p); },
  resultLevel: async p => { await solo({ mode: 'level', level: 12 })(p); await finish(p); },
  resultDaily: async p => { await solo({ mode: 'daily', tier: 2 })(p); await finish(p); },
  /* 線上 */
  lobby: async p => { await p.evaluate(() => OnlineUI.enterLobby()); await p.waitForTimeout(900); },
  invite: async p => { await createRoom(p, { mode: 'grab' }); const r = await p.evaluate(() => [OnlineUI.room.id, OnlineUI.room.invite.token]); await p.evaluate(() => { Net.send({ type: 'leave' }); }); await p.waitForTimeout(300); await p.goto(BASE + '?room=' + r[0] + '&invite=' + r[1]); await p.waitForTimeout(1200); },
  room: async p => { await createRoom(p, { mode: 'grab', content: 'zhuyin', tier: 3, rounds: 5 }); },
  roomGuest: async p => { await createRoom(p, { mode: 'race' }); await second(p); await p.evaluate(() => Net.send({ type: 'invite_new' })); await p.waitForTimeout(300); },
  grab: async p => { await createRoom(p, { mode: 'grab', content: 'number', tier: 2, rounds: 3 }); await second(p); await p.evaluate(() => Net.send({ type: 'start' })); await p.waitForTimeout(4200); await tapOnline(p, 6); await p.waitForTimeout(500); },
  race: async p => { await createRoom(p, { mode: 'race', content: 'letter', tier: 2, rounds: 1 }); const q = await second(p); await p.evaluate(() => Net.send({ type: 'start' })); await p.waitForTimeout(4200); await tapOnline(q, 9); await tapOnline(p, 4); await p.waitForTimeout(500); },
  roundEnd: async p => { await createRoom(p, { mode: 'grab', content: 'number', tier: 0, rounds: 3 }); await second(p); await p.evaluate(() => Net.send({ type: 'start' })); await p.waitForTimeout(4200); await tapOnline(p, 9); await p.waitForTimeout(700); },
  matchEnd: async p => { await createRoom(p, { mode: 'race', content: 'number', tier: 0, rounds: 1 }); await second(p); await p.evaluate(() => Net.send({ type: 'start' })); await p.waitForTimeout(4200); await tapOnline(p, 9); await p.waitForTimeout(1200); },
  spectate: async p => {
    await createRoom(p, { mode: 'grab', content: 'number', tier: 1, rounds: 3 }); const id = await p.evaluate(() => OnlineUI.room.id); await second(p);
    await p.evaluate(() => Net.send({ type: 'start' })); await p.waitForTimeout(4300); await tapOnline(p, 5);
    const ctx = await BROWSER.newContext({ viewport: p.viewportSize() }); const s = await ctx.newPage(); extraPages.push(ctx);
    await s.goto(BASE); await s.waitForTimeout(300); await s.evaluate(() => OnlineUI.enterLobby()); await s.waitForTimeout(700);
    await s.evaluate(id => Net.send({ type: 'join', roomId: id, name: '觀眾', want: 'spectator' }), id); await s.waitForTimeout(700);
    return s;
  },
  spectateRace: async p => {
    await createRoom(p, { mode: 'race', content: 'number', tier: 2, rounds: 3 }); const id = await p.evaluate(() => OnlineUI.room.id); await second(p);
    await p.evaluate(() => Net.send({ type: 'start' })); await p.waitForTimeout(4300); await tapOnline(p, 5);
    const ctx = await BROWSER.newContext({ viewport: p.viewportSize() }); const s = await ctx.newPage(); extraPages.push(ctx);
    await s.goto(BASE); await s.waitForTimeout(300); await s.evaluate(() => OnlineUI.enterLobby()); await s.waitForTimeout(700);
    await s.evaluate(id => Net.send({ type: 'join', roomId: id, name: '觀眾', want: 'spectator' }), id); await s.waitForTimeout(700);
    return s;
  },
  roomChat: async p => { await SCENES.grab(p); await p.evaluate(() => { App.openSide(); }); await p.waitForTimeout(200); }
};

async function check(p, view) {
  return p.evaluate(view => {
    const W = innerWidth, H = innerHeight, issues = [];
    const sideEl = document.querySelector('.side');
    const sideHidden = sideEl && getComputedStyle(sideEl).position === 'fixed' && document.getElementById('app').getAttribute('data-side') !== 'open';
    const vis = el => {
      if (el.closest('[hidden]')) return false;
      const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') return false;
      const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false;
      if (sideHidden && el.closest('.side')) return false;
      return true;
    };
    const name = el => (el.id ? '#' + el.id : '') + '.' + String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className).split(' ').slice(0, 2).join('.') + ' "' + (el.textContent || '').trim().slice(0, 24) + '"';
    /* 水平溢出：可見元素右緣超出視窗（可捲動容器內的除外） */
    const all = Array.from(document.querySelectorAll('body *')).filter(el => !el.closest('svg') || el.tagName === 'svg');
    for (const el of all) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > W + 1.5 || r.left < -1.5) {
        let sc = el.parentElement, inScroll = false;
        while (sc && sc !== document.body) { const s = getComputedStyle(sc); if (/(auto|scroll)/.test(s.overflowX) && sc.scrollWidth > sc.clientWidth) { inScroll = true; break; } if (s.position === 'fixed' && s.transform !== 'none') { inScroll = true; break; } sc = sc.parentElement; }
        if (!inScroll && !el.closest('.lc-root') && !el.closest('.toasts')) issues.push('overflowX ' + name(el) + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']');
      }
    }
    /* 文字被截斷（按鈕、標題；名字類允許省略號） */
    for (const el of document.querySelectorAll('.btn span, .seg-btn .seg-txt, .big-btn b, .big-btn small, .mode-card b, .mode-card small, .box-title, .page-title, .top-title b, .hud-cell, .pill-btn span, .res-title, .sum-list dd, .tag, .net-status, .stat-tile b, .stat-tile small, .dc-txt b, .modal-title span, .set-label b, .pm-item span, .lv-time, .res-flag, .switch .sw-txt, .room-code')) {
      if (!vis(el)) continue;
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') issues.push('clipped ' + name(el));
      const r = el.getBoundingClientRect(), pr = el.parentElement.getBoundingClientRect();
      if (r.right > pr.right + 2 && !el.closest('.scroll')) issues.push('spill ' + name(el));
    }
    /* 頂列：按鈕與標題互相重疊 */
    const top = Array.from(document.querySelectorAll('#topbar .icon-btn, #topbar .pill-btn, #topbar .top-title b, #topbar .top-title small, #topbar .lat:not(.hidden)')).filter(vis).map(el => [el, el.getBoundingClientRect()]);
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
      const a = top[i][1], b = top[j][1];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) issues.push('topOverlap ' + name(top[i][0]) + ' × ' + name(top[j][0]));
    }
    /* 原生控制項 */
    for (const el of document.querySelectorAll('select, input[type=range], input[type=checkbox], input[type=radio], textarea')) if (vis(el)) issues.push('native ' + name(el));
    for (const el of document.querySelectorAll('input[type=text]')) if (vis(el) && !el.closest('.input-wrap') && !el.closest('.lc-root')) issues.push('nativeInput ' + name(el));
    /* 盤面 */
    const board = document.querySelector('#scr-game:not([hidden]) .board');
    if (board && vis(board) && !document.querySelector('#pause-layer:not([hidden])')) {
      const br = board.getBoundingClientRect();
      if (br.width < 60) issues.push('boardTiny ' + Math.round(br.width));
      if (br.bottom > H + 1 || br.right > W + 1 || br.top < 0) issues.push('boardOut ' + JSON.stringify([br.left, br.top, br.right, br.bottom].map(Math.round)));
      const c = board.querySelector('.cell').getBoundingClientRect();
      if (board.querySelectorAll('.cell').length >= 64 ? (c.width < 39.5 || c.height < 39.5) : (c.width < 43.5 || c.height < 40)) issues.push('cellSmall ' + Math.round(c.width) + 'x' + Math.round(c.height));
      /* 正方形盤面；完整序列（A～Z、ㄅ～ㄦ）多一列時，高度＝格高×列數＋間距，且多出的格子置中、與其他格同寬 */
      const rowsEl = board.querySelectorAll('.row'), tailRow = board.querySelector('.row.tail');
      if (!tailRow) { if (Math.abs(br.width - br.height) > 2) issues.push('boardNotSquare'); }
      else {
        const r0 = rowsEl[0].getBoundingClientRect(), r1 = rowsEl[1].getBoundingClientRect(), gapY = r1.top - r0.bottom;
        const want = r0.height * rowsEl.length + gapY * (rowsEl.length - 1);
        if (Math.abs(br.height - want) > 3) issues.push('boardTailHeight ' + Math.round(br.height) + '≠' + Math.round(want));
        const tc = tailRow.querySelector('.cell').getBoundingClientRect(), c0 = board.querySelector('.cell').getBoundingClientRect();
        if (Math.abs((tc.left + tc.right) / 2 - (br.left + br.right) / 2) > 2 || Math.abs(tc.width - c0.width) > 1.5) issues.push('tailCellOff');
      }
      const hud = document.getElementById('hud').getBoundingClientRect();
      if (hud.width && hud.bottom > br.top + 1 && hud.right > br.left + 1 && hud.left < br.right - 1) issues.push('hudOverBoard');
    }
    /* 彈窗／結算卡必須塞得進畫面（內部可捲） */
    for (const sel of ['.modal', '.result-card', '.pause-card', '.round-card', '.pop-menu', '.server-outage-panel']) {
      const el = document.querySelector(sel);
      if (el && vis(el)) { const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1) issues.push('overlayOut ' + sel + ' ' + JSON.stringify([r.top, r.bottom].map(Math.round))); }
    }
    /* 小於 40px 的可點按鈕 */
    for (const el of document.querySelectorAll('button, a[href], [role=slider], [role=switch]')) {
      if (!vis(el) || el.closest('.lc-root') || el.closest('.result-share') || el.closest('.cell') || el.classList.contains('cell')) continue;
      const r = el.getBoundingClientRect();
      if (r.width && (r.height < 31 || r.width < 31)) issues.push('smallTarget ' + name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    return Array.from(new Set(issues));
  }, view);
}

(async () => {
  BROWSER = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
  const report = {};
  let total = 0;
  const names = Object.keys(SCENES).filter(n => !only || only.includes(n));
  for (const theme of THEMES) for (const lang of LANGS) for (const [vn, w, h] of VIEWS) for (const sn of names) {
    const ctx = await BROWSER.newContext({ viewport: { width: w, height: h }, hasTouch: w < 900 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_CONNECTION|404/.test(m.text())) errs.push('console ' + m.text().slice(0, 160)); });
    await p.addInitScript(([lang, theme]) => {
      try { localStorage.setItem('schulte:v1:lang', JSON.stringify(lang)); localStorage.setItem('schulte:v1:settings', JSON.stringify({ theme: theme, bgm: false, sfx: false })); } catch (e) {}
    }, [lang, theme]);
    let shotPage = p;
    try {
      await p.goto(BASE); await p.waitForTimeout(250);
      const r = await SCENES[sn](p);
      if (r && r.screenshot) shotPage = r;
      await shotPage.waitForTimeout(350);
      /* 等有限長度的動畫／轉場結束再量（平行跑時 CPU 吃緊會量到抽屜滑入中途） */
      await shotPage.evaluate(() => Promise.race([
        Promise.all(document.getAnimations().filter(a => { const t = a.effect && a.effect.getComputedTiming(); return t && isFinite(t.endTime); }).map(a => a.finished.catch(() => {}))),
        new Promise(r => setTimeout(r, 1500))
      ]));
      const issues = (await check(shotPage, vn)).concat(errs);
      const key = [sn, vn, lang, theme].join('|');
      if (issues.length) { report[key] = issues; total += issues.length; }
      await shotPage.screenshot({ path: path.join(out, [sn, vn, lang, theme].join('_') + '.png') });
    } catch (e) {
      report[[sn, vn, lang, theme].join('|')] = ['scene failed: ' + e.message.split('\n')[0]].concat(errs); total++;
    }
    for (const c of extraPages.splice(0)) await c.close().catch(() => {});
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  console.log('scenes:', names.length, 'views:', VIEWS.length, 'langs:', LANGS.length, 'themes:', THEMES.length, '→ issues:', total);
  for (const k of Object.keys(report)) console.log(k, '\n   ' + report[k].join('\n   '));
  await BROWSER.close();
})();
