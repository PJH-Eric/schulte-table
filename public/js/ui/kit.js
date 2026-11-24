/* ===== ui/kit.js — 自訂元件：彈窗、開關、分段選擇、滑桿、選單、提示 =====
 * 全部用 button／div＋ARIA 自己畫，不用原生 select、checkbox、range 外觀。
 */
(function (root) {
  'use strict';
  var doc = root.document;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(n, c) { return root.Icons.icon(n, c); }
  function t(k, p) { return root.I18N.t(k, p); }

  /** 秒數顯示到小數第二位：12.34、1:02.34 */
  function fmtTime(ms) {
    ms = Math.max(0, Math.round(ms || 0));
    var cs = Math.floor(ms / 10), s = Math.floor(cs / 100), m = Math.floor(s / 60);
    var sec = (m ? String(s % 60).padStart(2, '0') : String(s)) + '.' + String(cs % 100).padStart(2, '0');
    return m ? m + ':' + sec : sec;
  }

  /* ---------- 提示 ---------- */
  function toast(text, kind, ms) {
    var box = $('toasts'); if (!box) return;
    var el = doc.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.setAttribute('role', 'status');
    el.innerHTML = icon(kind === 'bad' ? 'cross' : kind === 'good' ? 'check' : 'info') + '<span>' + esc(text) + '</span>';
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 300); }, ms || 2600);
  }

  /* ---------- 彈窗（焦點鎖定、Esc 關閉、背景 inert） ---------- */
  var stack = [];
  function modal(o) {
    var layer = doc.createElement('div');
    layer.className = 'modal-layer';
    var id = 'mdl-' + Math.random().toString(36).slice(2, 7);
    layer.innerHTML = '<div class="modal ' + (o.cls || '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
      '<div class="modal-head"><h2 id="' + id + '" class="modal-title">' + (o.icon ? icon(o.icon) : '') + '<span>' + esc(o.title) + '</span></h2>' +
      (o.noClose ? '' : '<button type="button" class="icon-btn small m-close" aria-label="' + esc(t('common.close')) + '">' + icon('close') + '</button>') + '</div>' +
      '<div class="modal-body scroll">' + (o.body || '') + '</div>' +
      (o.actions && o.actions.length ? '<div class="modal-actions">' + o.actions.map(function (a, i) {
        return '<button type="button" class="btn ' + (a.kind || '') + '" data-mi="' + i + '">' + (a.icon ? icon(a.icon) : '') + '<span>' + esc(a.label) + '</span></button>';
      }).join('') + '</div>' : '') + '</div>';
    var prev = doc.activeElement;
    var app = $('app');
    var inertBefore = app ? app.inert : false;
    if (app && !stack.length) app.inert = true;
    stack.forEach(function (s) { s.layer.inert = true; });
    doc.body.appendChild(layer);
    var api = {
      el: layer.querySelector('.modal'), layer: layer, closed: false,
      close: function (why) {
        if (api.closed) return; api.closed = true;
        layer.classList.add('out');
        setTimeout(function () { layer.remove(); }, 160);
        var i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        if (stack.length) stack[stack.length - 1].layer.inert = false;
        else if (app) app.inert = inertBefore;
        doc.removeEventListener('keydown', onKey, true);
        if (o.onClose) o.onClose(why);
        if (prev && prev.isConnected && prev.focus) try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    };
    stack.push(api);
    function focusables() { return Array.prototype.filter.call(layer.querySelectorAll('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"]),input:not([disabled])'), function (x) { return x.offsetParent !== null; }); }
    function onKey(e) {
      if (stack[stack.length - 1] !== api) return;
      if (e.key === 'Escape' && !o.noClose) { e.preventDefault(); e.stopPropagation(); api.close('esc'); }
      else if (e.key === 'Tab') {
        var f = focusables(); if (!f.length) return;
        var i = f.indexOf(doc.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    }
    doc.addEventListener('keydown', onKey, true);
    layer.addEventListener('click', function (e) {
      if (e.target === layer && !o.noClose && !o.sticky) { api.close('backdrop'); return; }
      var c = e.target.closest('.m-close'); if (c) { api.close('x'); return; }
      var b = e.target.closest('[data-mi]');
      if (b) {
        var a = o.actions[Number(b.getAttribute('data-mi'))];
        if (a.onClick) a.onClick(api);
        if (a.close !== false) api.close('action');
      }
    });
    var first = layer.querySelector(o.focus || '.modal-actions .btn.primary') || focusables()[0];
    setTimeout(function () { if (first && !api.closed) first.focus({ preventScroll: true }); }, 30);
    return api;
  }
  function confirm(title, text, okLabel, onOk, danger) {
    return modal({ title: title, icon: 'info', cls: 'small', body: '<p class="m-text">' + esc(text) + '</p>', actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: onOk }
    ] });
  }
  function topModal() { return stack[stack.length - 1] || null; }
  function closeAll() { stack.slice().reverse().forEach(function (m) { m.close('all'); }); }

  /* ---------- 開關 ---------- */
  function switchHtml(id, on, label) {
    return '<button type="button" class="switch" id="' + id + '" role="switch" aria-checked="' + !!on + '" aria-label="' + esc(label) + '"><i class="sw-track"><i class="sw-knob"></i></i><span class="sw-txt">' + esc(on ? t('common.on') : t('common.off')) + '</span></button>';
  }
  function bindSwitch(el, fn) {
    if (!el) return;
    el.addEventListener('click', function () {
      var v = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', v);
      el.querySelector('.sw-txt').textContent = v ? t('common.on') : t('common.off');
      fn(v);
    });
  }

  /* ---------- 分段選擇（radiogroup，方向鍵移動） ---------- */
  function segHtml(id, opts, value, aria, cls) {
    return '<div class="seg ' + (cls || '') + '" id="' + id + '" role="radiogroup" aria-label="' + esc(aria) + '">' + opts.map(function (o) {
      var on = String(o.value) === String(value);
      return '<button type="button" role="radio" class="seg-btn" data-v="' + esc(o.value) + '" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '"' + (o.disabled ? ' disabled' : '') + '>' +
        (o.html || '') + (o.icon ? icon(o.icon) : '') + '<span class="seg-txt">' + esc(o.label) + '</span>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function bindSeg(el, fn) {
    if (!el) return;
    var btns = function () { return Array.prototype.slice.call(el.querySelectorAll('.seg-btn')); };
    if (!btns().some(function (b) { return b.tabIndex === 0; })) { var f = btns().filter(function (b) { return !b.disabled; })[0]; if (f) f.tabIndex = 0; }
    function pick(b) {
      if (!b || b.disabled) return;
      btns().forEach(function (x) { x.setAttribute('aria-checked', x === b); x.tabIndex = x === b ? 0 : -1; });
      fn(b.getAttribute('data-v'), b);
    }
    el.addEventListener('click', function (e) { pick(e.target.closest('.seg-btn')); });
    el.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var list = btns().filter(function (b) { return !b.disabled; });
      var i = list.indexOf(doc.activeElement);
      var n = list[(i + d + list.length) % list.length];
      if (n) { n.focus(); pick(n); }
    });
  }

  /* ---------- 滑桿 ---------- */
  function sliderHtml(id, value, label) {
    var pct = Math.round(value * 100);
    return '<div class="slider" id="' + id + '" role="slider" tabindex="0" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-valuetext="' + pct + '%" style="--v:' + value + '">' +
      '<i class="sl-track"><i class="sl-fill"></i><i class="sl-thumb"></i></i><b class="sl-num">' + pct + '</b></div>';
  }
  function bindSlider(el, fn) {
    if (!el) return;
    var track = el.querySelector('.sl-track');
    function setV(v, commit) {
      v = Math.max(0, Math.min(1, Math.round(v * 20) / 20));
      el.style.setProperty('--v', v);
      var p = Math.round(v * 100);
      el.setAttribute('aria-valuenow', p); el.setAttribute('aria-valuetext', p + '%');
      el.querySelector('.sl-num').textContent = p;
      fn(v, commit);
    }
    function fromX(x) { var r = track.getBoundingClientRect(); return (x - r.left) / r.width; }
    el.addEventListener('pointerdown', function (e) {
      el.setPointerCapture(e.pointerId); setV(fromX(e.clientX));
      function mv(ev) { setV(fromX(ev.clientX)); }
      function up() { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); fn(Number(el.style.getPropertyValue('--v')), true); }
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    el.addEventListener('keydown', function (e) {
      var v = Number(el.style.getPropertyValue('--v')) || 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += 0.05; else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= 0.05;
      else if (e.key === 'Home') v = 0; else if (e.key === 'End') v = 1; else return;
      e.preventDefault(); setV(v, true);
    });
  }

  /* ---------- 彈出選單（語言） ---------- */
  var openMenu = null;
  function menu(anchor, items, onPick) {
    closeMenu();
    var box = doc.createElement('div');
    box.className = 'pop-menu';
    box.setAttribute('role', 'listbox');
    box.innerHTML = items.map(function (it, i) {
      return '<button type="button" role="option" class="pm-item" data-i="' + i + '" aria-selected="' + !!it.on + '">' + (it.on ? icon('check') : '<i class="ico-sp"></i>') + '<span>' + esc(it.label) + '</span></button>';
    }).join('');
    doc.body.appendChild(box);
    var r = anchor.getBoundingClientRect();
    var w = box.offsetWidth;
    box.style.top = Math.round(r.bottom + 6) + 'px';
    box.style.left = Math.round(Math.max(8, Math.min(root.innerWidth - w - 8, r.right - w))) + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    var btns = Array.prototype.slice.call(box.querySelectorAll('.pm-item'));
    (btns.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0] || btns[0]).focus();
    function onKey(e) {
      var i = btns.indexOf(doc.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); anchor.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
      else if (e.key === 'Tab') closeMenu();
    }
    function onDown(e) { if (!box.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) closeMenu(); }
    box.addEventListener('click', function (e) { var b = e.target.closest('.pm-item'); if (!b) return; var it = items[Number(b.getAttribute('data-i'))]; closeMenu(); anchor.focus(); onPick(it); });
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('pointerdown', onDown, true);
    openMenu = { box: box, anchor: anchor, off: function () { doc.removeEventListener('keydown', onKey, true); doc.removeEventListener('pointerdown', onDown, true); } };
  }
  function closeMenu() {
    if (!openMenu) return;
    openMenu.off(); openMenu.box.remove(); openMenu.anchor.setAttribute('aria-expanded', 'false'); openMenu = null;
  }

  /* ---------- 玩家徽章（顏色＋形狀） ---------- */
  function badge(seat, cls) { return '<i class="pbadge p' + (seat % 6) + ' ' + (cls || '') + '" aria-hidden="true">' + root.Icons.playerShape(seat) + '</i>'; }

  root.Kit = {
    $: $, esc: esc, icon: icon, fmtTime: fmtTime, toast: toast, modal: modal, confirm: confirm, topModal: topModal, closeAll: closeAll,
    switchHtml: switchHtml, bindSwitch: bindSwitch, segHtml: segHtml, bindSeg: bindSeg, sliderHtml: sliderHtml, bindSlider: bindSlider,
    menu: menu, closeMenu: closeMenu, badge: badge
  };
})(typeof self !== 'undefined' ? self : this);
