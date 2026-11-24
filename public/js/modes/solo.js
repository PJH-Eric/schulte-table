/* ===== modes/solo.js — 單機：經典、逆序、隨機、闖關、每日挑戰 =====
 * 開局 3-2-1 倒數；暫停遮蓋盤面並凍結計時，回來後重新倒數 3 秒。
 * 中途放棄不記成績；每日挑戰每天每個難度只有第一次計入。
 */
(function (root) {
  'use strict';
  var R = root.Rules;
  var K, G;
  var cur = null;   // { spec, board, game, phase:'draw'|'countdown'|'playing'|'paused'|'done', acc, runAt, startedOnce, key }
  var COUNTDOWN_MS = 3000;

  function t(k, p) { return root.I18N.t(k, p); }
  function now() { return performance.now(); }
  function app() { return root.App; }

  function init() {
    K = root.Kit; G = root.GameView;
    root.document.addEventListener('visibilitychange', function () {
      if (root.document.hidden && cur && (cur.phase === 'playing' || cur.phase === 'countdown')) pause();
    });
  }

  /** 由模式規格產生盤面規格 */
  function boardSpec(spec) {
    if (spec.mode === 'level') return R.levelSpec(spec.level);
    if (spec.mode === 'daily') return R.dailySpec(spec.date, spec.tier);
    if (spec.mode === 'random') return spec.drawn || R.drawRandom(spec.tier);
    var tier = R.tier(spec.tier);
    return { tier: spec.tier, size: tier.size, content: spec.content, order: spec.mode === 'reverse' ? 'desc' : 'asc', chaos: 0, seed: R.newSeed() };
  }

  function titleOf(spec, bs) {
    var m = t('mode.' + spec.mode);
    if (spec.mode === 'level') return t('game.levelTitle', { n: spec.level });
    return m + '・' + t('tier.' + R.tier(bs.tier).key);
  }

  /**
   * spec: { mode:'classic'|'reverse'|'random'|'level'|'daily', content, tier, level, date, skipCountdown }
   * reuse：重新開始時沿用的盤面規格（每日、闖關固定排列）
   */
  function start(spec, reuse) {
    if (spec.mode === 'daily' && !spec.date) spec.date = R.taipeiDate();
    var bs = reuse || boardSpec(spec);
    if (spec.mode === 'random' && !reuse) spec.drawn = bs;
    var board = R.makeBoard(bs);
    var game = R.createGame(board, 'solo', ['me']);
    var counted = spec.mode !== 'daily' || root.Store.daily()[spec.date] == null || root.Store.daily()[spec.date][spec.tier] == null;
    cur = { spec: spec, bs: bs, board: board, game: game, phase: 'idle', acc: 0, runAt: 0, key: Math.random(), counted: counted };
    app().show('game', { title: titleOf(spec, bs), sub: subOf(bs) });
    G.open({ kind: 'solo', board: board, onTap: onTap });
    G.setNext(R.targetValue(board, 0), board.shapes[R.cellOfStep(board, 0)]);
    summary();
    if (root.GameAnalytics) root.GameAnalytics.start({ mode: 'solo', difficulty: R.tier(bs.tier).key, content_type: bs.content, variant: spec.mode }, cur.key);
    if (spec.mode === 'random' && !reuse && !spec.skipCountdown) { cur.phase = 'draw'; G.draw(bs, function () { if (cur && cur.board === board) begin(spec.skipCountdown); }); }
    else begin(spec.skipCountdown);
  }
  function subOf(bs) {
    return t('content.' + bs.content) + '・' + bs.size + '×' + bs.size + '・' + t('order.' + bs.order);
  }

  /** 倒數後開始（或從暫停回來） */
  function begin(skip) {
    var c = cur; if (!c) return;
    c.phase = 'countdown';
    G.board.lock(true);
    var go = function () {
      if (cur !== c || c.phase !== 'countdown') return;
      if (!c.game.startAt) R.start(c.game, 1);
      c.phase = 'playing';
      c.runAt = now();
      G.board.lock(false);
      G.board.focus();
      G.startClock(elapsed);
    };
    if (skip) { G.cancelCountdown(); go(); return; }
    G.countdown(Date.now() + COUNTDOWN_MS, go);
  }
  function elapsed() { var c = cur; if (!c) return 0; return c.acc + (c.phase === 'playing' ? now() - c.runAt : 0); }

  function onTap(idx) {
    var c = cur; if (!c || c.phase !== 'playing') return;
    if (G.board.isDone(idx)) return;                 // 點到已點過的格子：不算錯，也不提示
    var r = R.tap(c.game, 'me', idx, 2);
    if (!r.ok) return;
    var b = c.board, p = c.game.players.me;
    if (!r.hit) {
      G.board.wrong(idx);
      root.Sound.play('wrong'); root.Sound.vibrate(35);
      var h = R.kidHint(c.game, 'me');
      if (h >= 0) G.board.hint(h);
      summary();
      return;
    }
    G.board.setDone(idx, null, true);
    G.board.hint(-1);
    root.Sound.play('tap', r.step);
    G.setProgress(p.step, b.n);
    if (r.finished) { finish(); return; }
    var nx = R.cellOfStep(b, p.step);
    G.setNext(R.targetValue(b, p.step), b.shapes[nx]);
    summary();
  }

  function pause() {
    var c = cur; if (!c || (c.phase !== 'playing' && c.phase !== 'countdown')) return;
    if (c.phase === 'playing') c.acc += now() - c.runAt;
    c.phase = 'paused';
    G.cancelCountdown();
    G.stopClock(c.acc);
    G.board.lock(true);
    G.showPause({ resume: resume, restart: restart, home: quit });
  }
  function resume() {
    var c = cur; if (!c || c.phase !== 'paused') return;
    G.hidePause();
    begin(false);
  }
  /** 重新開始：重新倒數並換新排列（每日挑戰與闖關保持同一排列） */
  function restart() {
    var c = cur; if (!c) return;
    G.hidePause(); root.Result.hide();
    var keep = c.spec.mode === 'daily' || c.spec.mode === 'level';
    var bs = keep ? c.bs : Object.assign({}, c.bs, { seed: R.newSeed() });
    if (root.GameAnalytics) root.GameAnalytics.reset();
    start(c.spec, bs);
  }
  function quit() { stop(); app().show('home'); }
  function stop() { if (cur) { cur.phase = 'done'; } G.close(); cur = null; if (root.GameAnalytics) root.GameAnalytics.reset(); }
  function active() { return !!cur && cur.phase !== 'done'; }
  function playing() { return !!cur && (cur.phase === 'playing' || cur.phase === 'countdown' || cur.phase === 'draw'); }

  function finish() {
    var c = cur;
    c.acc += now() - c.runAt;
    c.phase = 'done';
    var ms = Math.round(c.acc);
    G.stopClock(ms);
    G.board.lock(true);
    G.setNext(null);
    root.Sound.play('done');
    var bs = c.bs, spec = c.spec;
    var rk = R.recordKey(bs.content, bs.tier, bs.order);
    var flags = [], stars = null, rec = null, lvl = null, counted = true;
    root.Store.bump('soloGames');
    if (spec.mode === 'level') {
      stars = R.stars(ms / 1000, bs.tier);
      lvl = root.Store.saveLevel(spec.level, stars, ms);
      if (lvl.isBest && lvl.prevMs) flags.push(t('res.newBest'));
    } else if (spec.mode === 'daily') {
      counted = c.counted && root.Store.saveDaily(spec.date, spec.tier, ms);
      if (!counted) flags.push(t('res.practice'));
    } else {
      rec = root.Store.saveBest(rk, ms);
      if (rec.isBest && rec.prev) flags.push(t('res.newBest'));
      if (spec.mode === 'random') root.Store.bump('randomGames');
    }
    if (root.GameAnalytics) root.GameAnalytics.end({ result: 'complete' }, c.key);
    summary();
    var misses = c.game.players.me.misses;
    function build() {
      var o = {
        tone: stars === 3 || (rec && rec.isBest && rec.prev) ? 'win' : 'good',
        title: spec.mode === 'level' ? t('res.levelClear', { n: spec.level }) : (rec && rec.isBest && rec.prev ? t('res.recordTitle') : t('res.doneTitle')),
        sub: t('mode.' + spec.mode) + '・' + t('tier.' + R.tier(bs.tier).key) + '・' + t('content.' + bs.content) + '・' + t('order.' + bs.order),
        big: K.fmtTime(ms), bigLabel: t('res.time'), flags: flags, stars: stars,
        lines: [[t('res.misses'), String(misses)]],
        home: { onClick: quit }
      };
      if (spec.mode === 'level') {
        o.lines.push([t('res.target'), K.fmtTime(R.targetSeconds(bs.tier) * 1000)]);
        o.lines.push([t('res.levelBest'), K.fmtTime(root.Store.levels()[spec.level].ms)]);
        if (spec.level < R.LEVELS) o.again = { label: t('res.nextLevel'), icon: 'play', onClick: function () { root.Result.hide(); start({ mode: 'level', level: spec.level + 1 }); } };
        o.extra = { label: t('res.retry'), icon: 'refresh', onClick: restart };
        o.back = { label: t('res.toLevels'), icon: 'flag', onClick: function () { stop(); app().show('levels'); } };
      } else if (spec.mode === 'daily') {
        o.lines.push([t('res.dailyStreak'), t('daily.days', { n: root.Store.dailyStreak(R.taipeiDate()) })]);
        o.again = { label: t('res.practiceAgain'), onClick: restart };
        o.back = { label: t('res.toDaily'), icon: 'calendar', onClick: function () { stop(); app().show('daily'); } };
      } else {
        var best = root.Store.best(rk);
        o.lines.push([t('res.best'), best ? K.fmtTime(best) : '—']);
        if (spec.mode === 'random') o.lines.push([t('res.randomCount'), String(root.Store.stats().randomGames || 0)]);
        o.again = spec.mode === 'random'
          ? { label: t('res.redraw'), icon: 'dice', onClick: function () { root.Result.hide(); start({ mode: 'random', tier: spec.tier }); } }
          : { label: t('res.again'), onClick: restart };
        o.back = { label: t('res.toModes'), icon: 'grid', onClick: function () { stop(); app().show('solo'); } };
      }
      return o;
    }
    setTimeout(function () { if (cur === c) root.Result.show(build(), build); }, root.Store.settings().reduceMotion ? 150 : 550);
  }

  /** 側欄摘要（寬版左側；窄版抽屜） */
  function summary() {
    var c = cur; if (!c) return;
    var bs = c.bs, p = c.game.players.me, K2 = K;
    var rk = R.recordKey(bs.content, bs.tier, bs.order);
    var best = c.spec.mode === 'level' ? (root.Store.levels()[c.spec.level] || {}).ms : c.spec.mode === 'daily' ? null : root.Store.best(rk);
    var rows = [
      [t('sum.mode'), t('mode.' + c.spec.mode) + (c.spec.mode === 'level' ? ' ' + c.spec.level : '')],
      [t('sum.tier'), t('tier.' + R.tier(bs.tier).key) + ' ' + bs.size + '×' + bs.size],
      [t('sum.content'), t('content.' + bs.content)],
      [t('sum.order'), t('order.' + bs.order)],
      [t('sum.misses'), String(p.misses)]
    ];
    if (c.spec.mode === 'level') rows.push([t('sum.target'), K2.fmtTime(R.targetSeconds(bs.tier) * 1000)]);
    if (best) rows.push([t('sum.best'), K2.fmtTime(best)]);
    if (c.spec.mode === 'daily') rows.push([t('sum.daily'), c.counted ? t('sum.dailyCounts') : t('sum.dailyPractice')]);
    var html = '<dl class="sum-list">' + rows.map(function (r) { return '<div><dt>' + K2.esc(r[0]) + '</dt><dd>' + K2.esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
    if (bs.size === 3) html += '<p class="sum-tip">' + K2.icon('info') + '<span>' + K2.esc(t('sum.kidTip')) + '</span></p>';
    html += '<p class="sum-tip">' + K2.icon('keyboard') + '<span>' + K2.esc(t('sum.keys')) + '</span></p>';
    root.document.getElementById('summary').innerHTML = html;
    G.setFoot('<span>' + K2.esc(t('sum.misses')) + ' <b>' + p.misses + '</b></span>' + (best ? '<span>' + K2.esc(t('sum.best')) + ' <b>' + K2.esc(K2.fmtTime(best)) + '</b></span>' : '') +
      (c.spec.mode === 'level' ? '<span>' + K2.esc(t('sum.target')) + ' <b>' + K2.esc(K2.fmtTime(R.targetSeconds(bs.tier) * 1000)) + '</b></span>' : ''));
  }

  root.Solo = {
    init: init, start: start, pause: pause, resume: resume, restart: restart, quit: quit, stop: stop, active: active, playing: playing,
    relang: function () { if (cur) { summary(); app().setTitle(titleOf(cur.spec, cur.bs), subOf(cur.bs)); } },
    get current() { return cur; }, _tap: onTap, _elapsed: elapsed
  };
})(typeof self !== 'undefined' ? self : this);
