/* ===== art/render.js — 把格子的值畫成 SVG（字形來自 art/glyphs.js，圖案來自 art/icons.js）===== */
(function (root) {
  'use strict';
  var G = root.SchulteGlyphs;
  var R = root.Rules;
  /* 各內容固定的垂直範圍（字型單位），同一盤字高一致 */
  var VBOX_Y = { number: [-790, 830], letter: [-790, 860], zhuyin: [-860, 940] };

  function glyphs(text, content) {
    var chars = Array.from(text), x = 0, d = '', x0 = Infinity, x1 = -Infinity;
    /* 兩位數：字距收一點，看起來像一個整體 */
    var track = chars.length > 1 ? -40 : 0;
    chars.forEach(function (ch, i) {
      var g = G[ch];
      if (!g) return;
      d += '<path transform="translate(' + x + ' 0)" d="' + g.d + '"/>';
      x0 = Math.min(x0, x + g.b[0]); x1 = Math.max(x1, x + g.b[2]);
      x += g.a + (i < chars.length - 1 ? track : 0);
    });
    var pad = 70, vy = VBOX_Y[content] || VBOX_Y.number;
    var w = Math.round(x1 - x0 + pad * 2);
    return '<svg class="glyph" viewBox="' + Math.round(x0 - pad) + ' ' + vy[0] + ' ' + w + ' ' + vy[1] + '" style="aspect-ratio:' + w + '/' + vy[1] + '" aria-hidden="true" focusable="false">' + d + '</svg>';
  }

  /** 一格的內容（不含格子本身） */
  function cell(content, v, shape) {
    if (content === 'icon') return root.Icons.pics(v + 1, shape);
    return glyphs(R.label(content, v), content);
  }
  /** 只畫文字（頂列「下一個」、結算等） */
  function token(content, v, shape) { return cell(content, v, shape); }

  root.Art = { glyphs: glyphs, cell: cell, token: token };
})(typeof self !== 'undefined' ? self : this);
