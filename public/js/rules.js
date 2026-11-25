/* ===== rules.js — 舒爾特方格規則核心（瀏覽器與伺服器共用，不碰計時、畫面與網路）=====
 *
 * 盤面：size（3～7）、content（number／zhuyin／letter／icon）、order（asc／desc）、seed、chaos（0～3）
 *   cells[i]   第 i 格的「值」（0..N-1；數字 v＋1、字母 LETTERS[v]、注音 ZHUYIN[v]、圖案 v＋1 顆）
 *   colors[i]  混亂色索引（-1＝主題預設色）  scales[i] 大小級距（1＝原尺寸）  shapes[i] 圖案小圖索引
 * 序列：第 k 步（0 起算）要點的值 = 正序 k、逆序 N-1-k。
 *
 * 三種局：
 *   solo  單機（只有一位玩家）       race  同題競速（每人各自 step）      grab  同盤搶點（全場共用 step）
 * tap(state, player, cellIndex, now) → { ok, hit, scoreDelta, combo, finished, step }
 *   ok=false：不收（倒數中、已結束、越界、該玩家已完成）；hit=false：點錯，狀態不變。
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Rules = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONTENTS = ['number', 'zhuyin', 'letter', 'icon'];
  var ZHUYIN = 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ';
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var MAX_SIZE = { number: 7, zhuyin: 6, letter: 5, icon: 5 };
  /** 五段難度：幼幼班 3×3／簡單 4×4／普通 5×5／困難 6×6／神話 7×7 */
  var TIERS = [
    { id: 0, key: 'kid', size: 3, secPerCell: 2.5 },
    { id: 1, key: 'easy', size: 4, secPerCell: 1.6 },
    { id: 2, key: 'normal', size: 5, secPerCell: 1.3 },
    { id: 3, key: 'hard', size: 6, secPerCell: 1.2 },
    { id: 4, key: 'myth', size: 7, secPerCell: 1.1 }
  ];
  var ICON_SHAPES = 12;
  var CHAOS_COLORS = 6;        // 混亂度 1～2 用的顏色數
  var CHAOS_COLORS_NEAR = 10;  // 混亂度 3 再加 4 個近似色
  var CHAOS_SCALES = [[1], [1], [0.78, 1], [0.68, 0.84, 1]];
  var LEVELS = 50;
  var LEVELS_PER_TIER = 10;
  var KID_HINT_MISSES = 3;     // 幼幼班單機：連續點錯 3 次就提示
  var ROUNDS = [1, 3, 5];
  var TAP_RATE = 20;           // 線上每人每秒最多 20 次 tap

  /* ---------- 種子亂數（可重現） ---------- */
  function hashSeed(str) {
    str = String(str);
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  /** mulberry32：回傳 0 ≤ x < 1 */
  function rng(seed) {
    var a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(r, n) { return Math.floor(r() * n); }
  function shuffle(arr, r) {
    for (var i = arr.length - 1; i > 0; i--) { var j = randInt(r, i + 1); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function newSeed() { return Math.floor(Math.random() * 4294967296).toString(36) + Date.now().toString(36).slice(-4); }

  /* ---------- 內容與難度 ---------- */
  function tier(id) { return TIERS[id] || null; }
  function isContent(c) { return CONTENTS.indexOf(c) >= 0; }
  function allowed(content, tierId) { var t = tier(tierId); return !!t && isContent(content) && t.size <= MAX_SIZE[content]; }
  function contentsFor(tierId) { return CONTENTS.filter(function (c) { return allowed(c, tierId); }); }
  function tierIdsFor(content) { return TIERS.filter(function (t) { return allowed(content, t.id); }).map(function (t) { return t.id; }); }
  /** 值 v 的顯示文字（圖案回傳數量字串，給螢幕閱讀器與分享） */
  function label(content, v) {
    if (content === 'letter') return LETTERS.charAt(v);
    if (content === 'zhuyin') return ZHUYIN.charAt(v);
    return String(v + 1);
  }
  /** 盤面格數：英文、注音在最高難度放完整序列（A～Z 26 格、ㄅ～ㄦ 37 格＝正方形再多 1 格，放在最下面一列置中） */
  var SEQ = { letter: LETTERS, zhuyin: ZHUYIN };
  function cellCount(content, size) { return SEQ[content] && size === MAX_SIZE[content] ? SEQ[content].length : size * size; }
  function targetValue(board, step) { return board.order === 'desc' ? board.n - 1 - step : step; }

  /* ---------- 盤面 ---------- */
  function makeBoard(opt) {
    var size = Number(opt.size);
    var content = opt.content;
    if (!isContent(content)) throw new Error('bad content');
    if (!(size >= 3 && size <= MAX_SIZE[content])) throw new Error('size not allowed for content');
    var order = opt.order === 'desc' ? 'desc' : 'asc';
    var chaos = Math.max(0, Math.min(3, Number(opt.chaos) || 0));
    var seed = opt.seed == null ? newSeed() : String(opt.seed);
    var n = cellCount(content, size);
    var r = rng('layout|' + seed + '|' + size + '|' + content);
    var cells = [];
    for (var i = 0; i < n; i++) cells.push(i);
    shuffle(cells, r);
    var r2 = rng('chaos|' + seed);
    var colors = [], scales = [], shapes = [];
    var palette = chaos >= 3 ? CHAOS_COLORS_NEAR : CHAOS_COLORS;
    var sc = CHAOS_SCALES[chaos];
    for (var k = 0; k < n; k++) {
      colors.push(chaos >= 1 ? randInt(r2, palette) : -1);
      scales.push(sc[randInt(r2, sc.length)]);
      shapes.push(randInt(r2, ICON_SHAPES));
    }
    return { size: size, n: n, content: content, order: order, chaos: chaos, seed: seed, cells: cells, colors: colors, scales: scales, shapes: shapes };
  }
  /** 第 step 步的正確格子索引 */
  function cellOfStep(board, step) { return board.cells.indexOf(targetValue(board, step)); }
  /** 某格的值是序列中的第幾步 */
  function stepOfCell(board, idx) { var v = board.cells[idx]; return board.order === 'desc' ? board.n - 1 - v : v; }
  /** 輕量盤面規格（線上廣播用；用戶端以同一份規則重建） */
  function boardSpec(board) { return { size: board.size, content: board.content, order: board.order, chaos: board.chaos, seed: board.seed }; }

  /* ---------- 局狀態 ---------- */
  function createGame(board, kind, players) {
    kind = kind === 'grab' || kind === 'race' ? kind : 'solo';
    var list = players && players.length ? players : ['me'];
    var g = { kind: kind, board: board, phase: 'waiting', startAt: 0, endedAt: 0, players: {}, order: list.slice() };
    list.forEach(function (id) { g.players[id] = { id: id, step: 0, score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, streakMiss: 0, finishedAt: 0 }; });
    if (kind === 'grab') { g.step = 0; g.owner = new Array(board.n).fill(null); g.lastBy = null; }
    else g.done = {};   // 每位玩家已點過的格子（solo／race）
    if (kind !== 'grab') list.forEach(function (id) { g.done[id] = new Array(board.n).fill(false); });
    return g;
  }
  /** 開始：startAt 之前（倒數）一律拒絕 tap */
  function start(g, startAt) { g.phase = 'playing'; g.startAt = startAt; return g; }

  function comboPoints(combo) { return combo <= 2 ? 1 : combo <= 5 ? 2 : combo <= 8 ? 3 : 4; }

  function tap(g, playerId, cellIndex, now) {
    var no = { ok: false, hit: false, scoreDelta: 0, combo: 0, finished: false, step: -1 };
    if (!g || g.phase !== 'playing') return no;
    if (now != null && now < g.startAt) return no;
    var p = g.players[playerId];
    if (!p) return no;
    var b = g.board;
    if (!(Number.isInteger(cellIndex) && cellIndex >= 0 && cellIndex < b.n)) return no;

    if (g.kind === 'grab') {
      var want = cellOfStep(b, g.step);
      if (cellIndex !== want) {
        p.misses++;
        return { ok: true, hit: false, scoreDelta: 0, combo: p.combo, finished: false, step: g.step, taken: g.owner[cellIndex] != null };
      }
      /* 連擊：同一人連續搶到才累計，被別人搶走就歸零 */
      if (g.lastBy !== playerId) {
        if (g.lastBy != null && g.players[g.lastBy]) g.players[g.lastBy].combo = 0;
        p.combo = 0;
      }
      p.combo++;
      p.bestCombo = Math.max(p.bestCombo, p.combo);
      var pts = comboPoints(p.combo);
      p.score += pts; p.hits++;
      g.owner[cellIndex] = playerId;
      g.lastBy = playerId;
      var stepDone = g.step;
      g.step++;
      var fin = g.step >= b.n;
      if (fin) { g.phase = 'ended'; g.endedAt = now || 0; }
      return { ok: true, hit: true, scoreDelta: pts, combo: p.combo, finished: fin, step: stepDone, by: playerId, cell: cellIndex };
    }

    /* solo／race：每人各自的 step */
    if (p.finishedAt) return no;
    var target = cellOfStep(b, p.step);
    if (cellIndex !== target) {
      p.misses++; p.streakMiss++;
      return { ok: true, hit: false, scoreDelta: 0, combo: 0, finished: false, step: p.step };
    }
    g.done[playerId][cellIndex] = true;
    p.hits++; p.streakMiss = 0;
    var s = p.step;
    p.step++;
    var finished = p.step >= b.n;
    if (finished) {
      p.finishedAt = now || 1;
      if (g.kind === 'solo') { g.phase = 'ended'; g.endedAt = now || 0; }
    }
    return { ok: true, hit: true, scoreDelta: 0, combo: 0, finished: finished, step: s, by: playerId, cell: cellIndex };
  }

  /** 幼幼班提示：單機連續點錯 3 次後回傳正確格子，否則 -1 */
  function kidHint(g, playerId) {
    if (!g || g.kind !== 'solo' || g.board.size !== 3) return -1;
    var p = g.players[playerId];
    return p && p.streakMiss >= KID_HINT_MISSES && !p.finishedAt ? cellOfStep(g.board, p.step) : -1;
  }

  /* ---------- 名次 ---------- */
  /** entries 已排好順序；same(a,b) 為 true 的相鄰項目並列同名次 */
  function placeSorted(entries, same) {
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var rank = i > 0 && same(entries[i - 1], entries[i]) ? out[i - 1].rank : i + 1;
      out.push(Object.assign({}, entries[i], { rank: rank }));
    }
    return out;
  }
  /** 名次分＝人數 − 名次 ＋ 1 */
  function placePoints(rank, count) { return count - rank + 1; }

  /** 搶點本局：依得分排名（高到低） */
  function rankGrab(g) {
    var list = g.order.map(function (id) { var p = g.players[id]; return { id: id, score: p.score, bestCombo: p.bestCombo, hits: p.hits }; });
    list.sort(function (a, b) { return b.score - a.score; });
    var placed = placeSorted(list, function (a, b) { return a.score === b.score; });
    placed.forEach(function (e) { e.points = placePoints(e.rank, list.length); });
    return placed;
  }
  /** 競速本局：完成者依完成時間；未完成者依進度；進度相同並列 */
  function rankRace(g) {
    var list = g.order.map(function (id) {
      var p = g.players[id];
      return { id: id, step: p.step, finished: !!p.finishedAt, time: p.finishedAt ? p.finishedAt - g.startAt : null, misses: p.misses };
    });
    list.sort(function (a, b) {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.time - b.time;
      return b.step - a.step;
    });
    var placed = placeSorted(list, function (a, b) {
      return a.finished === b.finished && (a.finished ? a.time === b.time : a.step === b.step);
    });
    placed.forEach(function (e) { e.points = placePoints(e.rank, list.length); });
    return placed;
  }
  /** 競速：第一個完成者出現即結束該局（假設 3） */
  function raceOver(g) {
    if (g.kind !== 'race') return false;
    return g.order.some(function (id) { return g.players[id].finishedAt; });
  }

  /**
   * 多局累計：rounds＝[{ placed:[{id,rank,points,score?,time?}], roundMs }]
   * 名次分最高者勝；平手比總得分（搶點，越高越好）或總耗時（競速，越少越好；未完成以該局長度計）。
   */
  function matchStanding(kind, ids, rounds) {
    var map = {};
    ids.forEach(function (id) { map[id] = { id: id, points: 0, score: 0, time: 0, perRound: [], bestTime: null }; });
    rounds.forEach(function (r) {
      r.placed.forEach(function (e) {
        var m = map[e.id]; if (!m) return;
        m.points += e.points;
        m.perRound.push({ rank: e.rank, points: e.points });
        if (kind === 'grab') m.score += e.score || 0;
        else {
          var t = e.time != null ? e.time : (r.roundMs || 0);
          m.time += t;
          if (e.time != null && (m.bestTime == null || e.time < m.bestTime)) m.bestTime = e.time;
        }
      });
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      return kind === 'grab' ? b.score - a.score : a.time - b.time;
    });
    return placeSorted(list, function (a, b) {
      return a.points === b.points && (kind === 'grab' ? a.score === b.score : a.time === b.time);
    });
  }

  /* ---------- 闖關（50 關） ---------- */
  function levelSpec(no) {
    no = Number(no);
    if (!(Number.isInteger(no) && no >= 1 && no <= LEVELS)) return null;
    var tierId = Math.floor((no - 1) / LEVELS_PER_TIER);
    var i = (no - 1) % LEVELS_PER_TIER;
    var list = contentsFor(tierId);
    var t = tier(tierId);
    return {
      level: no, tier: tierId, size: t.size, content: list[i % list.length], order: i % 2 ? 'desc' : 'asc',
      chaos: Math.floor(i * 4 / LEVELS_PER_TIER), seed: 'level:' + no, target: targetSeconds(tierId)
    };
  }
  function targetSeconds(tierId) { var t = tier(tierId); return Math.round(t.size * t.size * t.secPerCell * 10) / 10; }
  /** 3 星 ≤ 目標、2 星 ≤ 目標×1.5、通關 1 星 */
  function stars(seconds, tierId) {
    var tg = targetSeconds(tierId);
    return seconds <= tg ? 3 : seconds <= tg * 1.5 ? 2 : 1;
  }

  /* ---------- 每日挑戰（台北時間切日） ---------- */
  function taipeiDate(now) {
    var d = new Date((now == null ? Date.now() : now) + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  function dailySpec(date, tierId) {
    var r = rng('daily|' + date + ':' + tierId);
    var list = contentsFor(tierId);
    return { tier: tierId, size: tier(tierId).size, content: list[randInt(r, list.length)], order: r() < 0.5 ? 'asc' : 'desc', chaos: 0, seed: date + ':' + tierId, date: date };
  }

  /* ---------- 隨機模式 ---------- */
  function drawRandom(tierId, r) {
    r = r || Math.random;
    var list = contentsFor(tierId);
    return { tier: tierId, size: tier(tierId).size, content: list[randInt(r, list.length)], order: r() < 0.5 ? 'asc' : 'desc', chaos: 0, seed: newSeed() };
  }

  /** 紀錄 key：內容×難度×順序 */
  function recordKey(content, tierId, order) { return content + ':' + tierId + ':' + (order === 'desc' ? 'desc' : 'asc'); }

  return {
    CONTENTS: CONTENTS, cellCount: cellCount, ZHUYIN: ZHUYIN, LETTERS: LETTERS, MAX_SIZE: MAX_SIZE, TIERS: TIERS, ICON_SHAPES: ICON_SHAPES,
    CHAOS_COLORS: CHAOS_COLORS, CHAOS_COLORS_NEAR: CHAOS_COLORS_NEAR, LEVELS: LEVELS, LEVELS_PER_TIER: LEVELS_PER_TIER,
    KID_HINT_MISSES: KID_HINT_MISSES, ROUNDS: ROUNDS, TAP_RATE: TAP_RATE,
    hashSeed: hashSeed, rng: rng, shuffle: shuffle, newSeed: newSeed,
    tier: tier, isContent: isContent, allowed: allowed, contentsFor: contentsFor, tierIdsFor: tierIdsFor, label: label,
    makeBoard: makeBoard, targetValue: targetValue, cellOfStep: cellOfStep, stepOfCell: stepOfCell, boardSpec: boardSpec,
    createGame: createGame, start: start, tap: tap, comboPoints: comboPoints, kidHint: kidHint,
    rankGrab: rankGrab, rankRace: rankRace, raceOver: raceOver, placePoints: placePoints, matchStanding: matchStanding,
    levelSpec: levelSpec, targetSeconds: targetSeconds, stars: stars, taipeiDate: taipeiDate, dailySpec: dailySpec,
    drawRandom: drawRandom, recordKey: recordKey
  };
});
