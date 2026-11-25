/* ===== scripts/build-art.cjs — 產生 favicon 系列圖示與 SEO 分享圖、cover（開發用，需要 playwright 與執行中的伺服器）=====
 * 圖示來源：public/favicon.svg → favicon-96.png、apple-touch-icon.png(180，實底)、icons/icon-192/512.png、favicon.ico(16/32/48)
 * 分享圖：用遊戲本身的 CSS 與字形畫三種主題的盤面 → assets/images/seo.webp（1200×630）、cover.webp（1200×675）
 *         原圖 PNG 留在 docs/marketing/。
 * 用法：node scripts/build-art.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const BASE = process.env.BASE || 'http://localhost:3120/';

function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(([size, buf], i) => {
    const e = 6 + i * 16;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([head].concat(pngs.map(p => p[1])));
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
  const svg = fs.readFileSync(path.join(pub, 'favicon.svg'), 'utf8');
  async function icon(size, pad, bg) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    const inner = Math.round(size * (1 - pad * 2));
    await p.setContent('<body style="margin:0;width:' + size + 'px;height:' + size + 'px;background:' + (bg || 'transparent') + ';display:grid;place-items:center">' + svg.replace('<svg ', '<svg width="' + inner + '" height="' + inner + '" ') + '</body>');
    const buf = await p.screenshot({ omitBackground: !bg });
    await p.close();
    return buf;
  }
  fs.mkdirSync(path.join(pub, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(pub, 'favicon-96.png'), await icon(96, 0));
  fs.writeFileSync(path.join(pub, 'apple-touch-icon.png'), await icon(180, 0.08, '#3a2414'));
  fs.writeFileSync(path.join(pub, 'icons', 'icon-192.png'), await icon(192, 0.1, '#3a2414'));
  fs.writeFileSync(path.join(pub, 'icons', 'icon-512.png'), await icon(512, 0.1, '#3a2414'));
  fs.writeFileSync(path.join(pub, 'favicon.ico'), ico([[16, await icon(16, 0)], [32, await icon(32, 0)], [48, await icon(48, 0)]]));

  /* 分享圖：真正的遊戲樣式 */
  async function poster(w, h, name) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(BASE);
    await p.waitForTimeout(300);
    const dataUrl = await p.evaluate(([w, h]) => {
      const R = Rules;
      function board(theme, content, size, seed, done, rot, bs) {
        const bd = R.makeBoard({ size, content, seed, chaos: theme === 'tech' ? 1 : 0 });
        let html = '<div data-theme="' + theme + '" style="background:none;transform:rotate(' + rot + 'deg);filter:drop-shadow(0 18px 26px rgba(0,0,0,.45))"><div class="board s' + size + ' ct-' + content + '" style="--n:' + size + ';--bs:' + bs + 'px">';
        for (let r = 0; r < size; r++) {
          html += '<div class="row">';
          for (let c = 0; c < size; c++) {
            const i = r * size + c, step = R.stepOfCell(bd, i);
            html += '<span class="cell' + (bd.colors[i] >= 0 ? ' cc' + bd.colors[i] : '') + (step < done ? ' done' : '') + '"><span class="cell-face">' + Art.cell(content, bd.cells[i], bd.shapes[i]) + '</span></span>';
          }
          html += '</div>';
        }
        return html + '</div></div>';
      }
      document.body.innerHTML = '<div id="poster" data-theme="wood" style="position:fixed;inset:0;width:' + w + 'px;height:' + h + 'px;overflow:hidden;background:var(--bg-img);background-color:var(--bg);font-family:var(--font)">' +
        '<div style="position:absolute;left:64px;top:' + (h / 2 - 150) + 'px;width:470px;color:#f7e9cf">' +
        '<div style="font-size:84px;font-weight:900;letter-spacing:.06em;line-height:1.05;text-shadow:0 4px 0 rgba(0,0,0,.25)">舒爾特方格</div>' +
        '<div style="margin-top:18px;font-size:30px;font-weight:700;color:#ffd9a0">依序點完方格，練出好專注</div>' +
        '<div style="margin-top:22px;display:flex;flex-wrap:wrap;gap:10px;font-size:21px;font-weight:700">' +
        ['數字・注音・字母・圖案', '六段難度・闖關 60 關', '線上搶點・同題競速'].map(s => '<span style="padding:8px 16px;border-radius:999px;background:rgba(255,246,228,.14);border:1.5px solid rgba(255,220,170,.4)">' + s + '</span>').join('') + '</div></div>' +
        '<div style="position:absolute;left:560px;top:' + (h / 2 - 250) + 'px">' + board('wood', 'number', 5, 'seo-a', 6, -5, 300) + '</div>' +
        '<div style="position:absolute;left:885px;top:' + (h / 2 - 255) + 'px">' + board('candy', 'icon', 3, 'seo-b', 2, 6, 230) + '</div>' +
        '<div style="position:absolute;left:880px;top:' + (h / 2 + 15) + 'px;padding:14px;border-radius:14px;background:#070d1c" data-theme="tech">' + board('tech', 'zhuyin', 4, 'seo-c', 3, 0, 210) + '</div>' +
        '</div>';
      return true;
    }, [w, h]);
    await p.waitForTimeout(400);
    const png = await p.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
    const webp = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', 0.92).split(',')[1];
    }, png.toString('base64'));
    fs.mkdirSync(path.join(root, 'docs', 'marketing'), { recursive: true });
    fs.mkdirSync(path.join(pub, 'assets', 'images'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'marketing', name + '.png'), png);
    fs.writeFileSync(path.join(pub, 'assets', 'images', name + '.webp'), Buffer.from(webp, 'base64'));
    await p.close();
    void dataUrl;
  }
  await poster(1200, 630, 'seo');
  await poster(1200, 675, 'cover');
  await b.close();
  console.log('icons + seo.webp + cover.webp 已產生');
})();
