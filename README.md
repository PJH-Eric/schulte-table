# 舒爾特方格（schulte-table）

依序點完方格裡被打亂的內容，練專注力。數字、注音、英文字母、圖案（水果與動物，依數量點數）四種內容，五段難度（幼幼班 3×3～神話 7×7）。

- **單機**：經典計時、逆序、隨機（只選難度，內容與順序隨機抽）、闖關 50 關（1～3 星、混亂度逐關升高）、每日挑戰（台北時間換日，五難度各一題、只計第一次）
- **線上**：同盤搶點（共用目標、先到先得、連擊加成）、同題競速（同排列各自一盤、先完成者勝）；2～6 人、觀戰 20 人、1／3／5 局名次分累計
- 三套主題（木質麻將牌／糖果彩虹／科技深色）、繁中／简中／English、自訂元件與捲軸、鍵盤操作、減少動態、色彩輔助
- 沒有 AI 電腦對手；本機紀錄存在瀏覽器（`schulte:v1:*`）

## 啟動

需要 Node.js 26.12.1 以上的 26.x，**不需要 `npm install`**（伺服器零依賴）。

- Windows：雙擊 `啟動遊戲.bat`，會開啟 <http://localhost:3120>
- 其他：`npm start`，再開 <http://localhost:3120>
- 只玩單機也可以直接開 `public/index.html`（線上模式需要伺服器）

## 測試

| 指令 | 內容 | 需要 |
| --- | --- | --- |
| `npm test` | 規則核心、房間邏輯單元測試＋真的開伺服器跑多客戶端線上流程 | 只要 Node |
| `node scripts/flow-check.cjs` | 單機流程、紀錄、闖關解鎖、每日只計第一次、單機零連線 | playwright、執行中的伺服器 |
| `node scripts/rwd-audit.cjs <輪次> [畫面,…]` | 全畫面 × 6 種裝置 × 語言 × 主題的 RWD 巡檢與截圖（`tmp/audit/`） | 同上 |
| `node scripts/failover-check.cjs` | 正式網址的後端路由（只連 Cloudflare、不碰 Render）與邀請連結釘選 | 同上 |
| `node cloudflare/smoke.mjs` | 打包後的 Cloudflare 備援後端在模擬 Durable Object 中跑完一局 | 先 `node cloudflare/build-worker.cjs` |

playwright 不在本專案依賴中；開發時用 `NODE_PATH` 指向已安裝的 playwright，`PW_CHROME` 可指定瀏覽器執行檔。

## 架構

```
server.js            靜態檔＋WebSocket（lib/ws.js 自寫，零依賴）、身分、心跳
lib/rooms.js         房間、席位、觀戰、邀請（可撤銷、24 小時過期）、聊天、對局（伺服器權威）
lib/lobby-chat.js    大廳聊天室（與其他遊戲共用）
public/js/rules.js   規則核心：種子排列、判定、連擊、名次分、闖關、每日（瀏覽器與伺服器共用）
public/js/art/       字形（Noto Sans TC 轉 SVG 路徑）、圖示、圖案小圖
public/js/ui/        盤面、遊戲畫面、結算、自訂元件
public/js/modes/     單機、線上
cloudflare/          備援後端打包（Durable Object）
```

字形：`node scripts/build-glyphs.cjs <NotoSansTC-Regular.ttf>` 重新產生 `public/js/art/glyphs.js`（授權見 `licenses/NotoSansTC-OFL.txt`）。
圖示與分享圖：`node scripts/build-art.cjs`（伺服器執行中）。

## 部署

- **遊玩網址**：<https://pjh-eric.github.io/schulte-table/>（也列在遊戲大廳 <https://pjh-eric.github.io/game-lobby/>）
- **前端**：GitHub Pages（`.github/workflows/pages.yml`），推到 `main` 自動部署。repo Variable `GAME_SERVER_URL` 建置時注入 `public/js/config.js`，並執行 `scripts/inject-seo.js` 注入 GA4／SEO。
- **後端**：Cloudflare Worker `schulte-table-backup`（<https://schulte-table-backup.eric-games.workers.dev>，`wrangler.toml`）。更新方式：`cd cloudflare && npm ci && node build-worker.cjs`，回到根目錄 `wrangler deploy`。
- **Render**：免費額度已滿，目前沒有建立 Render 服務，`public/js/backend-routing.js` 設定為只用 Cloudflare。要恢復「Render 主、Cloudflare 備援」：用 `render.yaml` 建立 `schulte-table` 服務（`region: singapore`），把 `backend-routing.js` 的 `[null, '/ws']` 改成 `['<Render 服務名稱>', '/ws']`，並把 `GAME_SERVER_URL` 改成 Render 網址。
- **路由**：`backend-routing.js` 只在 `https://pjh-eric.github.io` 生效；邀請連結帶 `?backend=` 釘選同一台，進房後記在 sessionStorage，重新整理回到同一台。本機與 `?server=` 測試網址直接連線。
- 首頁與單機完全不連線；只有進入線上大廳或打開邀請連結才連線。
