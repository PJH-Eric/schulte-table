/* ===== ui/game.js — 遊戲畫面：頂列（時間／進度／下一個／分數）、盤面、倒數、暫停遮蓋 =====
 * 單機與線上共用。計時數字只由這裡的 rAF 迴圈更新（單一來源，不閃爍）。
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var K, board = null, clockFn = null, raf = 0, cdTimer = 0, cdKey = 0;
  var state = { kind: 'solo', content: 'number', players: [], spectator: false };

  function $(id) { return doc.getElementById(id); }
  function t(k, p) { return root.I18N.t(k, p); }

  function init() {
    K = root.Kit;
    board = new root.BoardView($('board-wrap'));
  }

  /** 開一局的畫面。o: { kind, board, title, spectator, onTap, players:[{id,seat,name}], meId } */
  function open(o) {
    state = { kind: o.kind || 'solo', content: o.board.content, players: o.players || [], meId: o.meId, spectator: !!o.spectator, n: o.board.n };
    var sc = $('scr-game');
    sc.setAttribute('data-kind', state.kind);
    sc.classList.toggle('spectating', state.spectator);
    $('hud-scores').hidden = state.kind !== 'grab';
    $('hud-race').hidden = state.kind !== 'race';
    $('hud-next').hidden = !nextVisible();
    $('watch-note').hidden = !state.spectator;
    board.render(o.board, { onTap: o.onTap, done: o.done, owners: o.owners });
    board.lock(true);
    hidePause();
    setProgress(0, o.board.n);
    setTime(0);
    stopClock();
  }
  function nextVisible() { return root.Store.settings().showNext && !state.spectator || (state.spectator && state.kind === 'grab'); }
  function refreshNext() { $('hud-next').hidden = !nextVisible(); }

  /* ---------- 計時（單一來源） ---------- */
  function setTime(ms) { var el = $('hud-time-num'); if (el) el.textContent = K.fmtTime(ms); }
  function startClock(fn) {
    clockFn = fn; cancelAnimationFrame(raf);
    var last = '';
    (function loop() {
      if (!clockFn) return;
      var s = K.fmtTime(clockFn());
      if (s !== last) { last = s; $('hud-time-num').textContent = s; }
      raf = requestAnimationFrame(loop);
    })();
  }
  function stopClock(finalMs) { clockFn = null; cancelAnimationFrame(raf); if (finalMs != null) setTime(finalMs); }

  function setProgress(k, n) {
    $('hud-prog-num').textContent = k + '/' + n;
    $('hud-prog').style.setProperty('--p', n ? k / n : 0);
    $('hud-prog').setAttribute('aria-label', t('hud.progressAria', { k: k, n: n }));
  }
  /** v＝下一個值（null＝完成） */
  function setNext(v, shape) {
    var el = $('hud-next-val');
    if (v == null) { el.innerHTML = root.Kit.icon('check'); el.setAttribute('aria-label', t('hud.allDone')); return; }
    el.innerHTML = root.Art.token(state.content, v, shape);
    el.setAttribute('aria-label', root.Rules.label(state.content, v));
  }

  /** 搶點分數列：[{seat,name,score,combo,me,connected}] */
  function setScores(list) {
    $('hud-scores').innerHTML = list.map(function (p) {
      return '<li class="sc-chip p' + (p.seat % 6) + (p.me ? ' me' : '') + (p.connected === false ? ' off' : '') + '">' + K.badge(p.seat) +
        '<span class="sc-name">' + K.esc(p.name) + '</span><b class="sc-pts">' + p.score + '</b>' +
        (p.combo >= 3 ? '<i class="sc-combo">' + K.icon('bolt') + '×' + p.combo + '</i>' : '') + '</li>';
    }).join('');
  }
  /** 競速進度條：[{seat,name,done,n,me,finished}] */
  function setRace(list) {
    $('hud-race').innerHTML = list.map(function (p) {
      return '<li class="rc-row p' + (p.seat % 6) + (p.me ? ' me' : '') + '">' + K.badge(p.seat) + '<span class="rc-name">' + K.esc(p.name) + '</span>' +
        '<span class="rc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + p.n + '" aria-valuenow="' + p.done + '" aria-label="' + K.esc(p.name) + '"><i style="--p:' + (p.n ? p.done / p.n : 0) + '"></i></span>' +
        '<b class="rc-num">' + (p.finished ? K.icon('check') : p.done + '/' + p.n) + '</b></li>';
    }).join('');
  }

  /* ---------- 開局倒數：3 → 2 → 1 → 開始！（依 startAt 對齊） ---------- */
  function countdown(startAt, onGo, nowFn) {
    nowFn = nowFn || Date.now;
    var key = ++cdKey, el = $('countdown'), num = el.querySelector('.cd-num');
    clearTimeout(cdTimer);
    el.hidden = false;
    var shown = null;
    (function step() {
      if (key !== cdKey) return;
      var left = startAt - nowFn();
      if (left <= 0) {
        num.textContent = t('cd.go'); num.className = 'cd-num go';
        root.Sound.play('go');
        if (onGo) onGo();
        cdTimer = setTimeout(function () { if (key === cdKey) el.hidden = true; }, 600);
        return;
      }
      var n = Math.ceil(left / 1000);
      if (n !== shown) {
        shown = n; num.textContent = n > 3 ? 3 : n;
        num.className = 'cd-num'; void num.offsetWidth; num.className = 'cd-num tick';
        root.Sound.play('tick');
      }
      cdTimer = setTimeout(step, Math.min(50, left));
    })();
  }
  function cancelCountdown() { cdKey++; clearTimeout(cdTimer); $('countdown').hidden = true; }

  /* ---------- 暫停（單機）：盤面遮蓋 ---------- */
  function showPause(h) {
    var el = $('pause-layer');
    el.hidden = false;
    el.innerHTML = '<div class="pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-title"><h2 id="pause-title">' + K.icon('pause') + '<span>' + K.esc(t('pause.title')) + '</span></h2>' +
      '<p>' + K.esc(t('pause.sub')) + '</p><div class="pause-actions">' +
      '<button type="button" class="btn primary big" data-p="resume">' + K.icon('play') + '<span>' + K.esc(t('pause.resume')) + '</span></button>' +
      '<button type="button" class="btn" data-p="restart">' + K.icon('refresh') + '<span>' + K.esc(t('pause.restart')) + '</span></button>' +
      '<button type="button" class="btn ghost" data-p="home">' + K.icon('home') + '<span>' + K.esc(t('pause.home')) + '</span></button></div></div>';
    $('scr-game').classList.add('paused');
    el.onclick = function (e) { var b = e.target.closest('[data-p]'); if (b && h[b.getAttribute('data-p')]) h[b.getAttribute('data-p')](); };
    el.onkeydown = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (h.resume) h.resume(); }
      if (e.key === 'Tab') {
        var f = Array.prototype.slice.call(el.querySelectorAll('button')); var i = f.indexOf(doc.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    setTimeout(function () { var b = el.querySelector('[data-p="resume"]'); if (b) b.focus(); }, 20);
  }
  function hidePause() { var el = $('pause-layer'); el.hidden = true; el.innerHTML = ''; $('scr-game').classList.remove('paused'); }
  function paused() { return !$('pause-layer').hidden; }

  /* 抽籤動畫（隨機模式）：約 1 秒翻出內容與順序 */
  function draw(spec, done) {
    var el = $('draw-layer');
    var contents = root.Rules.contentsFor(spec.tier);
    el.hidden = false;
    el.innerHTML = '<div class="draw-card" role="status" aria-live="assertive"><p class="draw-title">' + K.icon('dice') + '<span>' + K.esc(t('draw.title')) + '</span></p>' +
      '<div class="draw-slots"><div class="draw-slot" id="draw-c"></div><div class="draw-slot" id="draw-o"></div></div></div>';
    var i = 0, reduce = root.Store.settings().reduceMotion;
    $('hud-next').style.visibility = 'hidden';   // 抽籤結束前不透露內容
    var total = reduce ? 1 : 9;
    (function spin() {
      var last = i >= total - 1;
      var c = last ? spec.content : contents[i % contents.length];
      var o = last ? spec.order : (i % 2 ? 'desc' : 'asc');
      $('draw-c').innerHTML = '<span class="dc-ico">' + root.Art.token(c, c === 'icon' ? 2 : 0, 0) + '</span><b>' + K.esc(t('content.' + c)) + '</b>';
      $('draw-o').innerHTML = '<span class="dc-ico">' + K.icon(o === 'desc' ? 'reverse' : 'flag') + '</span><b>' + K.esc(t('order.' + o)) + '</b>';
      if (last) {
        el.querySelector('.draw-card').classList.add('landed');
        root.Sound.play('pop');
        setTimeout(function () { el.hidden = true; el.innerHTML = ''; $('hud-next').style.visibility = ''; done(); }, reduce ? 900 : 700);
        return;
      }
      i++;
      setTimeout(spin, 50 + i * 12);
    })();
  }

  /** 遊戲中的短提示（連擊、差一點）：疊在頂列上，不蓋住盤面 */
  var flashT = 0;
  function flash(text, kind) {
    var el = $('g-flash'); if (!el) return;
    el.textContent = text; el.className = 'g-flash ' + (kind || ''); el.hidden = false;
    clearTimeout(flashT); flashT = setTimeout(function () { el.hidden = true; }, 1100);
  }
  function setFoot(html) { var el = $('g-foot'); if (el) el.innerHTML = html || ''; }
  function close() { stopClock(); cancelCountdown(); hidePause(); var d = $('draw-layer'); d.hidden = true; d.innerHTML = ''; $('hud-next').style.visibility = ''; }

  root.GameView = {
    init: init, open: open, startClock: startClock, stopClock: stopClock, setTime: setTime, setProgress: setProgress, setNext: setNext,
    setScores: setScores, setRace: setRace, countdown: countdown, cancelCountdown: cancelCountdown, showPause: showPause, hidePause: hidePause,
    paused: paused, draw: draw, close: close, refreshNext: refreshNext, setFoot: setFoot, flash: flash,
    get board() { return board; }, get state() { return state; }
  };
})(typeof self !== 'undefined' ? self : this);
