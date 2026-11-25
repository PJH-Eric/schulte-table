/* 規則核心單元測試：node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/js/rules.js');

const solve = (g, id, now) => { const out = []; for (let s = 0; s < g.board.n; s++) out.push(R.tap(g, id, R.cellOfStep(g.board, g.kind === 'grab' ? g.step : g.players[id].step), now)); return out; };

test('序列與標籤：四種內容、正逆序', () => {
  assert.equal(R.label('number', 0), '1');
  assert.equal(R.label('letter', 24), 'Y');
  assert.equal(R.label('zhuyin', 0), 'ㄅ');
  assert.equal(R.label('zhuyin', 35), 'ㄥ');
  assert.equal(R.label('zhuyin', 36), 'ㄦ');
  assert.equal(R.ZHUYIN.length, 37);
  assert.equal(R.label('letter', 25), 'Z');
  assert.equal(R.LETTERS.length, 26);
  assert.equal(R.label('icon', 4), '5');
  const asc = R.makeBoard({ size: 4, content: 'number', order: 'asc', seed: 's' });
  const desc = R.makeBoard({ size: 4, content: 'number', order: 'desc', seed: 's' });
  assert.equal(R.targetValue(asc, 0), 0);
  assert.equal(R.targetValue(desc, 0), 15);
  assert.equal(R.targetValue(desc, 15), 0);
});

test('各內容的盤面上限', () => {
  assert.ok(R.allowed('number', 4));
  assert.ok(!R.allowed('letter', 3));
  assert.ok(R.allowed('letter', 2));
  assert.ok(R.allowed('zhuyin', 3));
  assert.ok(!R.allowed('zhuyin', 4));
  assert.ok(!R.allowed('icon', 3));
  assert.deepEqual(R.contentsFor(4), ['number']);
  assert.deepEqual(R.contentsFor(3), ['number', 'zhuyin']);
  assert.deepEqual(R.contentsFor(0), ['number', 'zhuyin', 'letter', 'icon']);
  assert.throws(() => R.makeBoard({ size: 6, content: 'letter', seed: 1 }));
  assert.throws(() => R.makeBoard({ size: 7, content: 'zhuyin', seed: 1 }));
});

test('種子可重現、排列是 0..N-1 的置換', () => {
  const a = R.makeBoard({ size: 7, content: 'number', seed: 'abc', chaos: 3 });
  const b = R.makeBoard({ size: 7, content: 'number', seed: 'abc', chaos: 3 });
  const c = R.makeBoard({ size: 7, content: 'number', seed: 'abd', chaos: 3 });
  assert.deepEqual(a.cells, b.cells);
  assert.deepEqual(a.colors, b.colors);
  assert.deepEqual(a.scales, b.scales);
  assert.notDeepEqual(a.cells, c.cells);
  assert.deepEqual(a.cells.slice().sort((x, y) => x - y), Array.from({ length: 49 }, (_, i) => i));
  const z = R.makeBoard({ size: 3, content: 'number', seed: 'x', chaos: 0 });
  assert.ok(z.colors.every(v => v === -1) && z.scales.every(v => v === 1));
  const c3 = R.makeBoard({ size: 7, content: 'number', seed: 'x', chaos: 3 });
  assert.ok(c3.colors.every(v => v >= 0 && v < R.CHAOS_COLORS_NEAR));
  assert.ok(new Set(c3.scales).size > 1);
});

test('單機：倒數期間拒絕、點錯狀態不變、依序完成', () => {
  const b = R.makeBoard({ size: 3, content: 'number', seed: 1 });
  const g = R.createGame(b, 'solo');
  assert.equal(R.tap(g, 'me', 0, 0).ok, false, '未開始拒絕');
  R.start(g, 1000);
  assert.equal(R.tap(g, 'me', R.cellOfStep(b, 0), 900).ok, false, '倒數中拒絕');
  const wrong = b.cells.indexOf(5);
  const r = R.tap(g, 'me', wrong, 1100);
  assert.equal(r.ok, true); assert.equal(r.hit, false);
  assert.equal(g.players.me.step, 0);
  assert.equal(R.tap(g, 'me', 99, 1100).ok, false, '越界拒絕');
  const res = solve(g, 'me', 2000);
  assert.ok(res.every(x => x.hit));
  assert.equal(res[res.length - 1].finished, true);
  assert.equal(g.phase, 'ended');
  assert.equal(R.tap(g, 'me', 0, 2100).ok, false, '結束後拒絕');
});

test('幼幼班連續點錯 3 次才提示，點對歸零', () => {
  const b = R.makeBoard({ size: 3, content: 'number', order: 'desc', seed: 2 });
  const g = R.start(R.createGame(b, 'solo'), 0);
  const want = R.cellOfStep(b, 0);
  assert.equal(b.cells[want], 8, '逆序先點 9');
  const wrong = (want + 1) % 9;
  R.tap(g, 'me', wrong, 1); R.tap(g, 'me', wrong, 2);
  assert.equal(R.kidHint(g, 'me'), -1);
  R.tap(g, 'me', wrong, 3);
  assert.equal(R.kidHint(g, 'me'), want);
  R.tap(g, 'me', want, 4);
  assert.equal(R.kidHint(g, 'me'), -1);
  const big = R.start(R.createGame(R.makeBoard({ size: 4, content: 'number', seed: 3 }), 'solo'), 0);
  for (let i = 0; i < 5; i++) R.tap(big, 'me', R.cellOfStep(big.board, 1), 1);
  assert.equal(R.kidHint(big, 'me'), -1, '只有 3×3 才提示');
});

test('搶點：共用目標、先到先得、連擊與歸零', () => {
  const b = R.makeBoard({ size: 4, content: 'number', seed: 9 });
  const g = R.start(R.createGame(b, 'grab', ['a', 'b']), 0);
  const next = () => R.cellOfStep(b, g.step);
  const pts = [];
  for (let i = 0; i < 10; i++) pts.push(R.tap(g, 'a', next(), 1).scoreDelta);
  assert.deepEqual(pts, [1, 1, 2, 2, 2, 3, 3, 3, 4, 4]);
  assert.equal(g.players.a.combo, 10);
  const cell = next();
  const first = R.tap(g, 'b', cell, 2);
  assert.equal(first.hit, true); assert.equal(first.scoreDelta, 1);
  assert.equal(g.players.a.combo, 0, '被搶走連擊歸零');
  const late = R.tap(g, 'a', cell, 2);
  assert.equal(late.hit, false, '同一格第二個人不得分');
  assert.equal(late.taken, true);
  assert.equal(g.owner[cell], 'b');
  while (g.phase === 'playing') R.tap(g, 'b', next(), 3);
  assert.equal(g.phase, 'ended');
  const rank = R.rankGrab(g);
  assert.equal(rank[0].id, 'a'); assert.equal(rank[0].points, 2); assert.equal(rank[1].points, 1);
  assert.equal(g.players.a.score, 25);
});

test('競速：各自進度、第一個完成即結束、未完成依進度並列', () => {
  const b = R.makeBoard({ size: 3, content: 'number', seed: 5 });
  const g = R.start(R.createGame(b, 'race', ['a', 'b', 'c']), 1000);
  for (let i = 0; i < 4; i++) R.tap(g, 'b', R.cellOfStep(b, g.players.b.step), 1500);
  for (let i = 0; i < 4; i++) R.tap(g, 'c', R.cellOfStep(b, g.players.c.step), 1500);
  assert.equal(R.raceOver(g), false);
  solve(g, 'a', 3000);
  assert.equal(R.raceOver(g), true);
  const rank = R.rankRace(g);
  assert.equal(rank[0].id, 'a'); assert.equal(rank[0].time, 2000); assert.equal(rank[0].rank, 1);
  assert.equal(rank[1].rank, 2); assert.equal(rank[2].rank, 2, '進度相同並列');
  assert.equal(rank[1].points, 2); assert.equal(rank[2].points, 2);
});

test('多局累計：名次分、平手比總分／總耗時', () => {
  const g = R.matchStanding('grab', ['a', 'b'], [
    { placed: [{ id: 'a', rank: 1, points: 2, score: 20 }, { id: 'b', rank: 2, points: 1, score: 5 }] },
    { placed: [{ id: 'b', rank: 1, points: 2, score: 30 }, { id: 'a', rank: 2, points: 1, score: 10 }] }
  ]);
  assert.equal(g[0].id, 'b'); assert.equal(g[0].rank, 1); assert.equal(g[1].rank, 2);
  const r = R.matchStanding('race', ['a', 'b'], [
    { roundMs: 9000, placed: [{ id: 'a', rank: 1, points: 2, time: 5000 }, { id: 'b', rank: 2, points: 1, time: null }] },
    { roundMs: 4000, placed: [{ id: 'b', rank: 1, points: 2, time: 4000 }, { id: 'a', rank: 2, points: 1, time: null }] }
  ]);
  assert.equal(r[0].id, 'a', 'a 總耗時 9000 < b 13000');
  assert.equal(r[0].bestTime, 5000);
  const tie = R.matchStanding('race', ['a', 'b'], [{ roundMs: 1, placed: [{ id: 'a', rank: 1, points: 2, time: 5 }, { id: 'b', rank: 1, points: 2, time: 5 }] }]);
  assert.equal(tie[1].rank, 1);
});

test('闖關 50 關：每段難度、內容輪替、正逆交替、混亂度遞增、神話只有數字', () => {
  assert.equal(R.levelSpec(0), null); assert.equal(R.levelSpec(51), null);
  for (let n = 1; n <= 50; n++) {
    const s = R.levelSpec(n);
    assert.equal(s.size, 3 + Math.floor((n - 1) / 10));
    assert.ok(R.allowed(s.content, s.tier), 'level ' + n);
    assert.ok(s.chaos >= 0 && s.chaos <= 3);
    if (n > 1 && (n - 1) % 10) assert.ok(s.chaos >= R.levelSpec(n - 1).chaos);
    R.makeBoard(s);
  }
  assert.equal(R.levelSpec(1).chaos, 0); assert.equal(R.levelSpec(10).chaos, 3);
  assert.equal(R.levelSpec(1).order, 'asc'); assert.equal(R.levelSpec(2).order, 'desc');
  for (let n = 41; n <= 50; n++) assert.equal(R.levelSpec(n).content, 'number');
  assert.deepEqual(R.makeBoard(R.levelSpec(7)).cells, R.makeBoard(R.levelSpec(7)).cells, '同關排列固定');
});

test('星數門檻', () => {
  assert.equal(R.targetSeconds(0), 22.5);
  assert.equal(R.stars(22.5, 0), 3);
  assert.equal(R.stars(30, 0), 2);
  assert.equal(R.stars(40, 0), 1);
});

test('每日挑戰：台北時間切日、五難度各一題且在允許範圍、可重現', () => {
  assert.equal(R.taipeiDate(Date.UTC(2026, 10, 24, 15, 59)), '2026-11-24');
  assert.equal(R.taipeiDate(Date.UTC(2026, 10, 24, 16, 0)), '2026-11-25');
  for (let t = 0; t < 5; t++) {
    const a = R.dailySpec('2026-11-24', t), b = R.dailySpec('2026-11-24', t);
    assert.deepEqual(a, b);
    assert.ok(R.allowed(a.content, t));
    assert.equal(a.seed, '2026-11-24:' + t);
  }
});

test('隨機模式只抽該難度允許的內容', () => {
  for (let t = 0; t < 5; t++) for (let i = 0; i < 200; i++) {
    const s = R.drawRandom(t);
    assert.ok(R.allowed(s.content, t));
    assert.ok(s.order === 'asc' || s.order === 'desc');
  }
});

test('英文與注音最高難度放完整序列（A～Z、ㄅ～ㄦ），較小難度取前 N×N 個', () => {
  const az = R.makeBoard({ content: 'letter', size: 5, seed: 's' });
  assert.equal(az.n, 26); assert.equal(az.cells.length, 26);
  assert.deepEqual(az.cells.slice().sort((a, b) => a - b).map(v => R.label('letter', v)).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const zy = R.makeBoard({ content: 'zhuyin', size: 6, seed: 's', order: 'desc' });
  assert.equal(zy.n, 37); assert.equal(R.label('zhuyin', R.targetValue(zy, 0)), 'ㄦ'); assert.equal(R.label('zhuyin', R.targetValue(zy, 36)), 'ㄅ');
  assert.equal(R.makeBoard({ content: 'letter', size: 4, seed: 's' }).n, 16);
  assert.equal(R.makeBoard({ content: 'zhuyin', size: 5, seed: 's' }).n, 25);
  assert.equal(R.makeBoard({ content: 'number', size: 7, seed: 's' }).n, 49);
  const g = R.createGame(az, 'solo', ['me']); R.start(g, 0);
  for (let k = 0; k < 26; k++) R.tap(g, 'me', R.cellOfStep(az, k), 1000 + k);
  assert.equal(g.players.me.step, 26);
});
