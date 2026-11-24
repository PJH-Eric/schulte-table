/* ===== scripts/build-glyphs.cjs — 把 Noto Sans TC（SIL OFL 1.1）的字形轉成 SVG 路徑 =====
 * 用法：node scripts/build-glyphs.cjs [字型路徑]
 *   預設讀環境變數 SCHULTE_FONT；輸出 public/js/art/glyphs.js。
 * 只取遊戲用得到的字：0–9、A–Y、注音 ㄅ～ㄥ（36 個，不含 ㄦ）。
 * 轉成路徑後瀏覽器不需要任何系統字型，也不必載入字型檔；授權見 licenses/NotoSansTC-OFL.txt。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FONT = process.argv[2] || process.env.SCHULTE_FONT;
if (!FONT || !fs.existsSync(FONT)) {
  console.error('請指定 Noto Sans TC Regular（TrueType）字型路徑：node scripts/build-glyphs.cjs <NotoSansTC-Regular.ttf>');
  process.exit(1);
}
const CHARS = '0123456789' + 'ABCDEFGHIJKLMNOPQRSTUVWXY' + 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥ';

const b = fs.readFileSync(FONT);
const tables = {};
for (let i = 0, n = b.readUInt16BE(4); i < n; i++) {
  const o = 12 + i * 16;
  tables[b.toString('ascii', o, o + 4)] = { off: b.readUInt32BE(o + 8), len: b.readUInt32BE(o + 12) };
}
for (const t of ['cmap', 'glyf', 'loca', 'head', 'hmtx', 'hhea', 'maxp']) if (!tables[t]) throw new Error('字型缺少 ' + t + ' 表（需要 TrueType 外框）');

const longLoca = b.readInt16BE(tables.head.off + 50) === 1;
const numGlyphs = b.readUInt16BE(tables.maxp.off + 4);
const numHMetrics = b.readUInt16BE(tables.hhea.off + 34);

function locaOf(gid) {
  const o = tables.loca.off;
  return longLoca ? [b.readUInt32BE(o + gid * 4), b.readUInt32BE(o + gid * 4 + 4)] : [b.readUInt16BE(o + gid * 2) * 2, b.readUInt16BE(o + gid * 2 + 2) * 2];
}
function advance(gid) {
  const o = tables.hmtx.off;
  return b.readUInt16BE(o + Math.min(gid, numHMetrics - 1) * 4);
}

/* cmap：找 (3,1) format 4 或 (3,10) format 12 */
function buildCmap() {
  const base = tables.cmap.off;
  const n = b.readUInt16BE(base + 2);
  let fmt4 = null, fmt12 = null;
  for (let i = 0; i < n; i++) {
    const p = b.readUInt16BE(base + 4 + i * 8), e = b.readUInt16BE(base + 6 + i * 8), off = base + b.readUInt32BE(base + 8 + i * 8);
    const f = b.readUInt16BE(off);
    if (p === 3 && e === 10 && f === 12) fmt12 = off;
    if (p === 3 && e === 1 && f === 4) fmt4 = off;
  }
  return function lookup(cp) {
    if (fmt12) {
      const groups = b.readUInt32BE(fmt12 + 12);
      for (let i = 0; i < groups; i++) {
        const g = fmt12 + 16 + i * 12;
        const s = b.readUInt32BE(g), e = b.readUInt32BE(g + 4);
        if (cp >= s && cp <= e) return b.readUInt32BE(g + 8) + cp - s;
      }
    }
    if (fmt4) {
      const segX2 = b.readUInt16BE(fmt4 + 6);
      const ends = fmt4 + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
      for (let i = 0; i < segX2 / 2; i++) {
        const end = b.readUInt16BE(ends + i * 2), start = b.readUInt16BE(starts + i * 2);
        if (cp < start || cp > end) continue;
        const delta = b.readInt16BE(deltas + i * 2), ro = b.readUInt16BE(ranges + i * 2);
        if (!ro) return (cp + delta) & 0xffff;
        const gi = b.readUInt16BE(ranges + i * 2 + ro + (cp - start) * 2);
        return gi ? (gi + delta) & 0xffff : 0;
      }
    }
    return 0;
  };
}

/** 讀一個字形的所有輪廓（點座標，含 on/off curve） */
function contoursOf(gid, dx, dy) {
  dx = dx || 0; dy = dy || 0;
  if (gid >= numGlyphs) return [];
  const [s, e] = locaOf(gid);
  if (e <= s) return [];
  const o = tables.glyf.off + s;
  const nc = b.readInt16BE(o);
  if (nc < 0) {
    /* 複合字形：只處理平移（遊戲用到的字不會縮放） */
    let p = o + 10, out = [], flags;
    do {
      flags = b.readUInt16BE(p); const comp = b.readUInt16BE(p + 2); p += 4;
      let a1, a2;
      if (flags & 1) { a1 = b.readInt16BE(p); a2 = b.readInt16BE(p + 2); p += 4; } else { a1 = b.readInt8(p); a2 = b.readInt8(p + 1); p += 2; }
      if (flags & 8) p += 2; else if (flags & 0x40) p += 4; else if (flags & 0x80) p += 8;
      out = out.concat(contoursOf(comp, dx + ((flags & 2) ? a1 : 0), dy + ((flags & 2) ? a2 : 0)));
    } while (flags & 0x20);
    return out;
  }
  const endPts = [];
  for (let i = 0; i < nc; i++) endPts.push(b.readUInt16BE(o + 10 + i * 2));
  const nPts = nc ? endPts[nc - 1] + 1 : 0;
  let p = o + 10 + nc * 2;
  p += 2 + b.readUInt16BE(p);
  const flags = [];
  while (flags.length < nPts) {
    const f = b[p++]; flags.push(f);
    if (f & 8) { let r = b[p++]; while (r--) flags.push(f); }
  }
  const xs = [], ys = [];
  let v = 0;
  for (let i = 0; i < nPts; i++) {
    const f = flags[i];
    if (f & 2) { const d = b[p++]; v += (f & 16) ? d : -d; } else if (!(f & 16)) { v += b.readInt16BE(p); p += 2; }
    xs.push(v);
  }
  v = 0;
  for (let i = 0; i < nPts; i++) {
    const f = flags[i];
    if (f & 4) { const d = b[p++]; v += (f & 32) ? d : -d; } else if (!(f & 32)) { v += b.readInt16BE(p); p += 2; }
    ys.push(v);
  }
  const out = [];
  let st = 0;
  for (const end of endPts) {
    const c = [];
    for (let i = st; i <= end; i++) c.push({ x: xs[i] + dx, y: ys[i] + dy, on: !!(flags[i] & 1) });
    out.push(c); st = end + 1;
  }
  return out;
}

/** 輪廓 → SVG path（y 軸翻轉，二次貝茲） */
function toPath(contours) {
  const r = n => Math.round(n);
  let d = '';
  for (const c of contours) {
    if (!c.length) continue;
    /* 起點必須是 on-curve；全是 off-curve 時取前兩點中點 */
    let startIdx = c.findIndex(pt => pt.on);
    let pts;
    if (startIdx < 0) {
      const m = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2, on: true };
      pts = [m].concat(c.slice(1), c.slice(0, 1));
    } else pts = c.slice(startIdx).concat(c.slice(0, startIdx));
    d += 'M' + r(pts[0].x) + ' ' + r(-pts[0].y);
    for (let i = 1; i <= pts.length; i++) {
      const cur = pts[i % pts.length];
      if (cur.on) { if (i < pts.length || true) d += 'L' + r(cur.x) + ' ' + r(-cur.y); continue; }
      const nxt = pts[(i + 1) % pts.length];
      const end = nxt.on ? nxt : { x: (cur.x + nxt.x) / 2, y: (cur.y + nxt.y) / 2 };
      d += 'Q' + r(cur.x) + ' ' + r(-cur.y) + ' ' + r(end.x) + ' ' + r(-end.y);
      if (nxt.on) i++;
    }
    d += 'Z';
  }
  return d.replace(/L(-?\d+) (-?\d+)Z/g, 'Z');
}

const cmap = buildCmap();
const out = {};
for (const ch of CHARS) {
  const gid = cmap(ch.codePointAt(0));
  if (!gid) throw new Error('字型沒有這個字：' + ch);
  const cs = contoursOf(gid);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of cs) for (const pt of c) { x0 = Math.min(x0, pt.x); x1 = Math.max(x1, pt.x); y0 = Math.min(y0, -pt.y); y1 = Math.max(y1, -pt.y); }
  out[ch] = { d: toPath(cs), a: advance(gid), b: [x0, y0, x1, y1] };
}

const js = '/* art/glyphs.js — 由 scripts/build-glyphs.cjs 從 Noto Sans TC（SIL Open Font License 1.1）產生，請勿手改。\n' +
  ' * 授權全文：licenses/NotoSansTC-OFL.txt。每個字：d＝SVG 路徑（字型單位、y 向下）、a＝字寬、b＝外框 [x0,y0,x1,y1]。 */\n' +
  '(function (root) {\n  \'use strict\';\n  root.SchulteGlyphs = ' + JSON.stringify(out) + ';\n})(typeof self !== \'undefined\' ? self : this);\n';
fs.writeFileSync(path.join(__dirname, '..', 'public', 'js', 'art', 'glyphs.js'), js);
console.log('已輸出 ' + Object.keys(out).length + ' 個字形，' + js.length + ' bytes');
