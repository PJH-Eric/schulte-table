/* ===== ui/result.js — 結算 overlay（疊在遊戲畫面上）與線上「本局結果」小卡 =====
 * data-result-share：共用的 result-share.js 會在卡片底部加上「分享結果」，把整張結算卡做成圖片。
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var last = null, builder = null, onKey = null, roundTimer = 0;
  function $(id) { return doc.getElementById(id); }
  function t(k, p) { return root.I18N.t(k, p); }

  function btn(act, cls, ico, label) {
    var K = root.Kit;
    return '<button type="button" class="btn ' + cls + '" data-act="' + act + '">' + K.icon(ico) + '<span>' + K.esc(label) + '</span></button>';
  }

  /**
   * o: { tone:'win'|'good'|'plain', title, sub, big, bigLabel, flags:[text], stars, lines:[[label,value]], ranking:[{rank,seat,name,info,me}],
   *      again:{label,onClick}, back:{label,icon,onClick}, home:{onClick} }
   * build：切換語言時重新產生 o 的函式（可省略）
   */
  function show(o, build) {
    builder = build || null;
    last = o;
    render(o, false);
  }
  function render(o, relang) {
    var K = root.Kit;
    var layer = $('result-layer');
    var keep = relang && doc.activeElement && layer.contains(doc.activeElement) ? doc.activeElement.getAttribute('data-act') : null;
    var html = '<div class="result-card tone-' + (o.tone || 'plain') + '" role="dialog" aria-modal="true" aria-labelledby="res-title" data-result-share>' +
      '<div class="res-head"><span class="res-trophy">' + K.icon(o.tone === 'win' ? 'trophy' : o.tone === 'good' ? 'sparkle' : 'flag') + '</span>' +
      '<div class="res-titles"><h2 id="res-title" class="res-title">' + K.esc(o.title) + '</h2>' + (o.sub ? '<p class="res-sub">' + K.esc(o.sub) + '</p>' : '') + '</div></div>';
    if (o.big != null) html += '<div class="res-big"><small>' + K.esc(o.bigLabel || '') + '</small><b>' + K.esc(o.big) + '</b></div>';
    if (o.flags && o.flags.length) html += '<p class="res-flags">' + o.flags.map(function (f) { return '<span class="res-flag">' + K.icon('sparkle') + K.esc(f) + '</span>'; }).join('') + '</p>';
    if (o.stars != null) {
      html += '<div class="res-stars" role="img" aria-label="' + K.esc(t('res.starsAria', { n: o.stars })) + '">';
      for (var i = 0; i < 3; i++) html += '<i class="' + (i < o.stars ? 'on' : '') + '" style="--d:' + (i * 0.16) + 's">' + K.icon(i < o.stars ? 'star' : 'star-empty') + '</i>';
      html += '</div>';
    }
    if (o.lines && o.lines.length) html += '<dl class="res-lines">' + o.lines.map(function (l) { return '<div><dt>' + K.esc(l[0]) + '</dt><dd>' + K.esc(l[1]) + '</dd></div>'; }).join('') + '</dl>';
    if (o.ranking && o.ranking.length) {
      html += '<ol class="res-ranks scroll">' + o.ranking.map(function (r) {
        return '<li class="' + (r.me ? 'me' : '') + '"><b class="rk">' + r.rank + '</b>' + K.badge(r.seat) + '<span class="rk-name">' + K.esc(r.name) + '</span><span class="rk-info">' + K.esc(r.info) + '</span></li>';
      }).join('') + '</ol>';
    }
    html += '<div class="res-actions">' +
      (o.again ? btn('again', 'primary', o.again.icon || 'refresh', o.again.label || t('res.again')) : '') +
      (o.extra ? btn('extra', '', o.extra.icon || 'refresh', o.extra.label) : '') +
      (o.back ? btn('back', '', o.back.icon || 'grid', o.back.label) : '') +
      btn('home', 'ghost', 'home', t('res.home')) + '</div></div>';
    layer.innerHTML = html;
    layer.hidden = false;
    layer.classList.toggle('relang', !!relang);
    layer.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.getAttribute('data-act');
      var h = a === 'again' ? o.again : a === 'back' ? o.back : a === 'extra' ? o.extra : o.home;
      if (h && h.onClick) h.onClick();
    };
    if (onKey) doc.removeEventListener('keydown', onKey, true);
    onKey = function (e) {
      if (layer.hidden || root.Kit.topModal() || doc.querySelector('.result-share-dialog-layer:not([hidden])')) return;
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(layer.querySelectorAll('button:not([disabled])'));
      var i = f.indexOf(doc.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    };
    doc.addEventListener('keydown', onKey, true);
    var focus = layer.querySelector(keep ? '[data-act="' + keep + '"]' : '[data-act="again"]') || layer.querySelector('[data-act]');
    setTimeout(function () { if (focus && !layer.hidden) focus.focus({ preventScroll: true }); }, relang ? 0 : 60);
  }
  function hide() {
    var layer = $('result-layer');
    layer.hidden = true; layer.innerHTML = ''; last = null; builder = null;
    if (onKey) { doc.removeEventListener('keydown', onKey, true); onKey = null; }
    hideRound();
  }
  function visible() { return !$('result-layer').hidden; }
  function relang() { if (!last) return; if (builder) last = builder(); render(last, true); }

  /** 線上：本局結果小卡，約 3 秒後自動進下一局；房主可提前 */
  function round(o) {
    var K = root.Kit, el = $('round-layer');
    clearInterval(roundTimer);
    el.hidden = false;
    el.innerHTML = '<div class="round-card" role="status" aria-live="polite"><h2>' + K.esc(o.title) + '</h2>' +
      '<ol class="res-ranks">' + o.ranking.map(function (r) {
        return '<li class="' + (r.me ? 'me' : '') + '"><b class="rk">' + r.rank + '</b>' + K.badge(r.seat) + '<span class="rk-name">' + K.esc(r.name) + '</span><span class="rk-info">' + K.esc(r.info) + '</span></li>';
      }).join('') + '</ol><p class="round-next"><span id="round-left"></span>' +
      (o.onNext ? '<button type="button" class="btn small primary" id="round-go">' + K.icon('play') + '<span>' + K.esc(t('round.nextNow')) + '</span></button>' : '') + '</p></div>';
    var go = $('round-go'); if (go) go.onclick = o.onNext;
    function tick() {
      var left = Math.max(0, Math.ceil((o.nextAt - o.now()) / 1000));
      var s = $('round-left'); if (s) s.textContent = t('round.nextIn', { n: left });
    }
    tick(); roundTimer = setInterval(tick, 250);
  }
  function hideRound() { clearInterval(roundTimer); var el = $('round-layer'); if (el) { el.hidden = true; el.innerHTML = ''; } }

  root.Result = { show: show, hide: hide, visible: visible, relang: relang, round: round, hideRound: hideRound };
})(typeof self !== 'undefined' ? self : this);
