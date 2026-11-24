/* ===== ui/board.js — 方格盤面：正方形、按下就判定、鍵盤方向鍵移動焦點 =====
 * 滑鼠／觸控／觸控筆：pointerdown 立即判定（不等放開）。
 * 鍵盤與螢幕閱讀器：按鈕的 click（detail＝0）判定；方向鍵移動焦點（roving tabindex）。
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var R = root.Rules;

  function Board(wrap) {
    this.wrap = wrap;
    this.el = doc.createElement('div');
    this.el.className = 'board';
    this.el.setAttribute('role', 'grid');
    wrap.appendChild(this.el);
    this.board = null; this.cells = []; this.locked = true; this.onTap = null; this.focusIdx = 0;
    var self = this;
    this.el.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      var c = e.target.closest('.cell'); if (!c || !self.el.contains(c)) return;
      e.preventDefault();
      self.focusIdx = Number(c.getAttribute('data-i'));
      self.rove();
      self.fire(self.focusIdx, e);
    });
    this.el.addEventListener('click', function (e) {
      if (e.detail !== 0) return;                       // 滑鼠點擊已在 pointerdown 處理
      var c = e.target.closest('.cell'); if (!c) return;
      self.fire(Number(c.getAttribute('data-i')), e);
    });
    this.el.addEventListener('keydown', function (e) {
      if (!self.board) return;
      var s = self.board.size, i = self.focusIdx;
      var map = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: s, ArrowUp: -s };
      if (e.key === 'Home') i = i - (i % s); else if (e.key === 'End') i = i - (i % s) + s - 1;
      else if (map[e.key] != null) {
        var n = i + map[e.key];
        if ((e.key === 'ArrowRight' && i % s === s - 1) || (e.key === 'ArrowLeft' && i % s === 0) || n < 0 || n >= self.board.n) n = i;
        i = n;
      } else return;
      e.preventDefault();
      self.focusIdx = i; self.rove(); self.cells[i].focus();
    });
    this.el.addEventListener('focusin', function (e) { var c = e.target.closest('.cell'); if (c) self.focusIdx = Number(c.getAttribute('data-i')); });
    this.el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    if (root.ResizeObserver) new root.ResizeObserver(function () { self.fit(); }).observe(wrap);
    root.addEventListener('resize', function () { self.fit(); });
  }

  Board.prototype.fire = function (idx, e) {
    if (this.locked || !this.onTap) return;
    this.onTap(idx, e);
  };

  /** 依剩餘空間取最大正方形 */
  Board.prototype.fit = function () {
    var w = this.wrap.clientWidth, h = this.wrap.clientHeight;
    if (!w || !h) return;
    var side = Math.floor(Math.min(w, h));
    this.el.style.setProperty('--bs', side + 'px');
  };

  Board.prototype.render = function (board, opt) {
    opt = opt || {};
    this.board = board;
    this.onTap = opt.onTap || null;
    this.el.className = 'board s' + board.size + ' ct-' + board.content + (board.chaos ? ' chaos' + board.chaos : '');
    this.el.style.setProperty('--n', board.size);
    this.el.setAttribute('aria-rowcount', board.size);
    this.el.setAttribute('aria-colcount', board.size);
    var html = '';
    for (var r = 0; r < board.size; r++) {
      html += '<div class="row" role="row">';
      for (var c = 0; c < board.size; c++) {
        var i = r * board.size + c, v = board.cells[i];
        var col = board.colors[i];
        var lab = R.label(board.content, v);
        html += '<button type="button" role="gridcell" class="cell' + (col >= 0 ? ' cc' + col : '') + '" data-i="' + i + '" tabindex="' + (i === 0 ? 0 : -1) + '" style="--sc:' + board.scales[i] + '" data-l="' + lab + '" aria-label="' + lab + '">' +
          '<span class="cell-face">' + root.Art.cell(board.content, v, board.shapes[i]) + '</span><i class="own" aria-hidden="true"></i></button>';
      }
      html += '</div>';
    }
    this.el.innerHTML = html;
    this.cells = Array.prototype.slice.call(this.el.querySelectorAll('.cell'));
    this.focusIdx = 0;
    if (opt.done) opt.done.forEach(function (d, i) { if (d) this.setDone(i, null, false); }, this);
    if (opt.owners) opt.owners.forEach(function (o, i) { if (o != null && o >= 0) this.setDone(i, o, false); }, this);
    this.fit();
  };

  Board.prototype.rove = function () {
    var f = this.focusIdx;
    this.cells.forEach(function (c, i) { c.tabIndex = i === f ? 0 : -1; });
  };

  Board.prototype.lock = function (v) {
    this.locked = !!v;
    this.el.classList.toggle('locked', this.locked);
    this.el.setAttribute('aria-disabled', this.locked ? 'true' : 'false');
  };

  /** 點過：變暗留在原位；seat 有值時加上搶到者的玩家色＋形狀標記 */
  Board.prototype.setDone = function (idx, seat, animate) {
    var c = this.cells[idx]; if (!c) return;
    c.classList.remove('wrong', 'hint', 'pending');
    c.classList.add('done');
    if (animate) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    var own = c.querySelector('.own');
    if (seat != null && seat >= 0) {
      own.className = 'own p' + (seat % 6);
      own.innerHTML = root.Icons.playerShape(seat);
      c.setAttribute('data-owner', seat);
    }
    c.setAttribute('aria-label', c.getAttribute('data-l') + ' · ' + root.I18N.t('board.done'));
  };
  /** 線上樂觀顯示：先暗下去，伺服器回報後才確定 */
  Board.prototype.pending = function (idx) { var c = this.cells[idx]; if (c) c.classList.add('pending'); };
  Board.prototype.unpending = function (idx) { var c = this.cells[idx]; if (c) c.classList.remove('pending'); };

  Board.prototype.wrong = function (idx) {
    var c = this.cells[idx]; if (!c) return;
    c.classList.remove('wrong'); void c.offsetWidth; c.classList.add('wrong');
    setTimeout(function () { c.classList.remove('wrong'); }, 420);
  };
  Board.prototype.hint = function (idx) {
    this.cells.forEach(function (c, i) { c.classList.toggle('hint', i === idx); });
  };
  Board.prototype.isDone = function (idx) { var c = this.cells[idx]; return !!c && c.classList.contains('done'); };
  Board.prototype.focus = function () { var c = this.cells[this.focusIdx] || this.cells[0]; if (c) try { c.focus({ preventScroll: true }); } catch (e) { /* ignore */ } };
  Board.prototype.clear = function () { this.el.innerHTML = ''; this.cells = []; this.board = null; };

  root.BoardView = Board;
})(typeof self !== 'undefined' ? self : this);
