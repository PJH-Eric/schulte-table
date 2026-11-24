/* ===== art/icons.js — 自繪 UI 圖示、玩家形狀、圖案小圖（全部 SVG，不用 emoji）===== */
(function (root) {
  'use strict';

  /* UI 圖示：24×24、線條用 currentColor */
  var P = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h4v-5h4v5h4v-9"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/><circle cx="12" cy="12" r="6.4"/>',
    globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8M12 3.4c2.6 2.6 3.6 5.5 3.6 8.6s-1 6-3.6 8.6c-2.6-2.6-3.6-5.5-3.6-8.6s1-6 3.6-8.6z"/>',
    pause: '<path d="M9 5.5v13M15 5.5v13"/>',
    play: '<path d="M8 5.2l11 6.8-11 6.8z" fill="currentColor" stroke-linejoin="round"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cross: '<path d="M7 7l10 10M17 7L7 17"/>',
    star: '<path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" fill="currentColor" stroke-linejoin="round"/>',
    'star-empty': '<path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" stroke-linejoin="round"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.4M16 6h3v1.5a3 3 0 0 1-3 2.9M12 13v4M8.5 20h7M9.5 17h5"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.4l2.8 1.8M9.5 2.8h5M12 2.8v2.6"/>',
    grid: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>',
    shuffle: '<path d="M4 7h3.5c4.5 0 5.5 10 10 10H20M4 17h3.5c1.8 0 3-1.5 4-3.4M16.5 4L20 7l-3.5 3M16.5 14l3.5 3-3.5 3M13.4 9.6C14.4 8 15.5 7 17.5 7H20"/>',
    reverse: '<path d="M7 4v15M4 16l3 3 3-3M17 20V5M14 8l3-3 3 3"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><rect x="8" y="13" width="3" height="3" rx=".6" fill="currentColor" stroke="none"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2.5"/>',
    flag: '<path d="M6 21V4M6 4.5c4-2 7 2 12 0v8.5c-5 2-8-2-12 0"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M16 14.4c2.4.1 4 1.6 4.5 4.6"/>',
    user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/>',
    eye: '<path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
    chat: '<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5h0a2 2 0 0 1-2-2z"/>',
    send: '<path d="M4 12L20 4l-6 16-2.5-6.5z" stroke-linejoin="round"/><path d="M11.5 13.5L20 4"/>',
    panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    crown: '<path d="M4 17.5l-.8-9.5 5 4 3.8-6.5 3.8 6.5 5-4-.8 9.5z" stroke-linejoin="round"/><path d="M4.5 20.5h15"/>',
    flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.6 3.2-5.4 3.6-9 2.2 1.3 3.5 3.3 3.6 5.4 1-.7 1.6-1.8 1.8-3 2.3 1.7 4 4 4 6.6 0 3.4-2.6 6-6.5 6z" stroke-linejoin="round"/>',
    book: '<path d="M4 5.5c3-1.3 5.6-1.1 8 .8 2.4-1.9 5-2.1 8-.8v13c-3-1.3-5.6-1.1-8 .8-2.4-1.9-5-2.1-8-.8z" stroke-linejoin="round"/><path d="M12 6.3v13"/>',
    chart: '<path d="M4 20h16"/><rect x="5.5" y="12" width="3" height="6" rx=".8"/><rect x="10.5" y="7" width="3" height="11" rx=".8"/><rect x="15.5" y="9.5" width="3" height="8.5" rx=".8"/>',
    volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    copy: '<rect x="8" y="8" width="11.5" height="11.5" rx="2"/><path d="M15.5 8V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2"/>',
    kick: '<circle cx="10" cy="8.5" r="3.4"/><path d="M3.5 20c.7-3.8 3.3-5.7 6.5-5.7 1.4 0 2.6.3 3.7 1M16 13.5l5 5M21 13.5l-5 5"/>',
    door: '<path d="M14 4H6.5v16H14M10 12h10M17 8.5l3.5 3.5-3.5 3.5"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
    sparkle: '<path d="M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9z" stroke-linejoin="round"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    hand: '<path d="M8.5 12.5V6.2a1.5 1.5 0 0 1 3 0v5M11.5 11V4.8a1.5 1.5 0 0 1 3 0V11M14.5 11V6.5a1.5 1.5 0 0 1 3 0v7.2c0 4-2.4 6.8-6 6.8-2.6 0-4.1-1.3-5.4-3.4l-2-3.3a1.5 1.5 0 0 1 2.5-1.6l1.9 2.3"/>',
    bolt: '<path d="M13.5 3L5.5 13.5h6L10.5 21l8-10.5h-6z" stroke-linejoin="round"/>',
    info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.5M12 7.6v.1"/>',
    palette: '<path d="M12 3.6a8.4 8.4 0 0 0 0 16.8c1.3 0 1.7-1 1.2-2-.6-1.2.2-2.4 1.5-2.4h2.2a3.5 3.5 0 0 0 3.5-3.6c0-4.8-3.8-8.8-8.4-8.8z"/><circle cx="8" cy="11" r="1.2" fill="currentColor"/><circle cx="11" cy="7.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/>',
    wifi: '<path d="M3 9.5a13 13 0 0 1 18 0M6 12.8a8.6 8.6 0 0 1 12 0M9 16a4.2 4.2 0 0 1 6 0"/><circle cx="12" cy="19" r="1.1" fill="currentColor"/>',
    keyboard: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7 10.5h.1M10.4 10.5h.1M13.8 10.5h.1M17 10.5h.1M8 14h8"/>'
  };
  function icon(name, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' + (P[name] || P.info) + '</svg>';
  }

  /* 形狀路徑（以 cx,cy 為中心、半徑 r） */
  function poly(cx, cy, r, n, rot, inner) {
    var pts = [], k = inner ? n * 2 : n;
    for (var i = 0; i < k; i++) {
      var rr = inner && i % 2 ? r * inner : r;
      var a = (rot || -90) * Math.PI / 180 + i * 2 * Math.PI / k;
      pts.push((cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1));
    }
    return 'M' + pts.join('L') + 'Z';
  }
  function circle(cx, cy, r) { return 'M' + (cx - r).toFixed(1) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r).toFixed(1) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r).toFixed(1) + ' 0Z'; }
  function f(n) { return n.toFixed(1); }
  /* 圖案小圖 12 種：形狀彼此差異明顯 */
  var PIP = [
    function (x, y, r) { return circle(x, y, r * 0.92); },                                              // 圓
    function (x, y, r) { var s = r * 0.8; return 'M' + f(x - s) + ' ' + f(y - s) + 'h' + f(2 * s) + 'v' + f(2 * s) + 'h' + f(-2 * s) + 'Z'; }, // 方
    function (x, y, r) { return poly(x, y + r * 0.15, r * 1.08, 3, -90); },                              // 三角
    function (x, y, r) { return poly(x, y, r * 1.05, 4, -90); },                                         // 菱形
    function (x, y, r) { return poly(x, y + r * 0.08, r * 1.12, 5, -90, 0.45); },                        // 星
    function (x, y, r) {                                                                                   // 愛心
      var s = r * 0.95;
      return 'M' + f(x) + ' ' + f(y + s) + 'C' + f(x - s * 1.6) + ' ' + f(y) + ' ' + f(x - s * 0.9) + ' ' + f(y - s * 1.3) + ' ' + f(x) + ' ' + f(y - s * 0.45) +
        'C' + f(x + s * 0.9) + ' ' + f(y - s * 1.3) + ' ' + f(x + s * 1.6) + ' ' + f(y) + ' ' + f(x) + ' ' + f(y + s) + 'Z';
    },
    function (x, y, r) { return poly(x, y, r, 6, 0); },                                                 // 六角
    function (x, y, r) {                                                                                   // 水滴
      return 'M' + f(x) + ' ' + f(y - r * 1.1) + 'C' + f(x + r * 0.9) + ' ' + f(y - r * 0.1) + ' ' + f(x + r * 0.95) + ' ' + f(y + r) + ' ' + f(x) + ' ' + f(y + r) +
        'C' + f(x - r * 0.95) + ' ' + f(y + r) + ' ' + f(x - r * 0.9) + ' ' + f(y - r * 0.1) + ' ' + f(x) + ' ' + f(y - r * 1.1) + 'Z';
    },
    function (x, y, r) {                                                                                   // 月亮
      return 'M' + f(x + r * 0.35) + ' ' + f(y - r * 0.95) + 'A' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(x + r * 0.35) + ' ' + f(y + r * 0.95) +
        'A' + f(r * 0.78) + ' ' + f(r * 0.78) + ' 0 1 1 ' + f(x + r * 0.35) + ' ' + f(y - r * 0.95) + 'Z';
    },
    function (x, y, r) { var q = r * 0.5; return circle(x, y - q, q) + circle(x, y + q, q) + circle(x - q, y, q) + circle(x + q, y, q); }, // 花
    function (x, y, r) { var a = r * 0.36, b = r; return 'M' + f(x - a) + ' ' + f(y - b) + 'h' + f(2 * a) + 'v' + f(b - a) + 'h' + f(b - a) + 'v' + f(2 * a) + 'h' + f(a - b) + 'v' + f(b - a) + 'h' + f(-2 * a) + 'v' + f(a - b) + 'h' + f(a - b) + 'v' + f(-2 * a) + 'h' + f(b - a) + 'Z'; }, // 十字
    function (x, y, r) {                                                                                   // 葉子
      return 'M' + f(x - r) + ' ' + f(y + r) + 'C' + f(x - r) + ' ' + f(y - r * 0.6) + ' ' + f(x - r * 0.2) + ' ' + f(y - r) + ' ' + f(x + r) + ' ' + f(y - r) +
        'C' + f(x + r) + ' ' + f(y + r * 0.2) + ' ' + f(x + r * 0.6) + ' ' + f(y + r) + ' ' + f(x - r) + ' ' + f(y + r) + 'Z';
    }
  ];

  /* 骰子式（1～6）與五顆一列（7 以上） */
  var DICE = {
    1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]], 6: [[30, 22], [70, 22], [30, 50], [70, 50], [30, 78], [70, 78]]
  };
  function pipPositions(count) {
    if (DICE[count]) return { r: count <= 2 ? 15 : count <= 4 ? 12.5 : 11, pts: DICE[count] };
    var rows = Math.ceil(count / 5), gap = 18.5, out = [];
    var y0 = 50 - (rows - 1) * gap / 2;
    for (var i = 0; i < count; i++) {
      var row = Math.floor(i / 5), col = i % 5;
      out.push([13 + col * 18.5, y0 + row * gap]);
    }
    return { r: 7.4, pts: out };
  }
  function pips(count, shape) {
    var pos = pipPositions(count), fn = PIP[(shape || 0) % PIP.length], d = '';
    pos.pts.forEach(function (p) { d += fn(p[0], p[1], pos.r); });
    return '<svg class="pips" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="' + d + '" fill="currentColor"/></svg>';
  }

  /* 玩家形狀（色彩輔助）：圓、方、三角、菱形、星、六角 */
  var PLAYER_SHAPES = [0, 1, 2, 3, 4, 6];
  function playerShape(seat, cls) {
    var fn = PIP[PLAYER_SHAPES[seat % PLAYER_SHAPES.length]];
    return '<svg class="pshape ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + fn(12, 12, 8) + '" fill="currentColor"/></svg>';
  }

  root.Icons = { icon: icon, pips: pips, pipPositions: pipPositions, playerShape: playerShape, PIP_COUNT: PIP.length, names: Object.keys(P) };
})(typeof self !== 'undefined' ? self : this);
