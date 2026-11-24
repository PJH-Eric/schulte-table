/* ===== server.js — 舒爾特方格：靜態檔案 ＋ 房間伺服器（零依賴）=====
 * 靜態檔案用 Node 內建 http，連線用 lib/ws.js（自己寫的原生 WebSocket），
 * 不需要 npm install，雙擊 .bat 就能玩，丟到 Render 也一樣。
 *
 *   lib/rooms.js       房間／席位／觀戰／邀請／聊天／對局（純邏輯，規則核心與前端共用 public/js/rules.js）
 *   lib/lobby-chat.js  大廳聊天室（與 guess-ab 共用）
 *   這一支              HTTP、WebSocket、身分（同一個瀏覽器分頁斷線重連是同一個人）、心跳與計時
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ws = require('./lib/ws.js');
const { createHub, cleanName } = require('./lib/rooms.js');

const PORT = Number(process.env.PORT) || 3120;
const ROOT = path.join(__dirname, 'public');
const ALLOW_ORIGIN = process.env.GAME_ALLOWED_ORIGIN || process.env.ALLOW_ORIGIN || '*';
const GAME_ID = 'schulte-table';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};

function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}
function json(res, code, data) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }

/** personId → { socket, person } */
const people = new Map();
const io = {
  send(personId, msg) { const it = people.get(personId); if (it && it.socket.alive) it.socket.sendJSON(msg); },
  cleared(personId) { const it = people.get(personId); if (it) it.person.roomId = null; }
};
const hub = createHub(io);

/* 大廳聊天室（與房間聊天分開；即時傳送，不載入歷史訊息） */
const lobbyChat = require('./lib/lobby-chat.js').createHub({ send: (id, msg) => io.send(id, msg), key: 'type' });
function announceNewRoom(person, before) {
  const room = hub.roomFor(person.id);
  if (room && room.id !== before && room.hostId === person.id && room.seats.filter(Boolean).length === 1 && !room.settings.isPrivate) {
    lobbyChat.roomOpened({ code: room.id, host: room.seats[0] ? room.seats[0].name : person.name });
  }
}

function lobbyIds() { const out = []; for (const [id, it] of people) if (!hub.roomFor(id) && it.person.ready) out.push(id); return out; }
function sendLobby(pid) { io.send(pid, { type: 'lobby', rooms: hub.listRooms(), online: Array.from(people.values()).filter(it => it.person.ready).length }); }
function broadcastLobby() { for (const id of lobbyIds()) sendLobby(id); }

/* 對局計時 20ms 一個 tick；心跳每秒、大廳更新每 0.5 秒 */
setInterval(() => { hub.tick(); }, 20).unref();
let beat = 0;
setInterval(() => {
  if (++beat % 2 === 0) for (const it of people.values()) { it.socket.ping(); it.socket.sendJSON({ type: 'hb' }); }
  if (hub.popDirty()) broadcastLobby();
}, 500).unref();

function handle(person, msg) {
  if (!msg || typeof msg.type !== 'string') return;
  switch (msg.type) {
    case 'ping': io.send(person.id, { type: 'pong', t: msg.t, s: Date.now() }); return;
    case 'hb': return;
    case 'name': person.name = cleanName(msg.name, person.name); return;
    case 'lobby': sendLobby(person.id); return;
    case 'create': { const before = hub.roomFor(person.id) && hub.roomFor(person.id).id; hub.create(person, msg); announceNewRoom(person, before); return; }
    case 'quick': { const before = hub.roomFor(person.id) && hub.roomFor(person.id).id; hub.quick(person, msg); announceNewRoom(person, before); return; }
    case 'lobbychat': lobbyChat.handle(person.id, msg); return;
    case 'join': hub.join(person, msg); return;
    case 'leave': hub.leave(person.id); io.send(person.id, { type: 'left' }); sendLobby(person.id); return;
    case 'sit': hub.sit(person); return;
    case 'stand': hub.stand(person); return;
    case 'ready': hub.setReady(person, msg.value); return;
    case 'start': hub.start(person); return;
    case 'next': hub.next(person); return;
    case 'tap': hub.tap(person, msg); return;
    case 'settings': hub.settings(person, msg.settings || msg); return;
    case 'invite_new': hub.inviteNew(person); return;
    case 'invite_revoke': hub.inviteRevoke(person); return;
    case 'kick': hub.kick(person, String(msg.target || '')); return;
    case 'chat': hub.chat(person, msg.text); return;
    default: return;
  }
}

const server = http.createServer((req, res) => {
  let url = '/';
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { url = '/'; }
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (url === '/health') {
    const c = hub.stats();
    json(res, 200, { ok: true, game: GAME_ID, rooms: c.rooms, players: c.players, spectators: c.spectators, online: people.size, time: Date.now() });
    return;
  }
  if (url === '/') url = '/index.html';
  const file = path.join(ROOT, path.normalize(url).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Forbidden'); return; }
  sendFile(res, file);
});

/** clientId（瀏覽器分頁自己產生的祕密）→ 公開的 personId。斷線重連就是靠這個認出同一個人 */
const idFrom = clientId => 'p' + crypto.createHash('sha256').update(GAME_ID + '|' + clientId).digest('hex').slice(0, 12);

ws.attach(server, {
  path: '/ws',
  onConnection(socket) {
    const person = { id: 'tmp' + crypto.randomBytes(5).toString('hex'), name: '', roomId: null, ready: false };
    people.set(person.id, { socket, person });
    socket.sendJSON({ type: 'hello', game: GAME_ID });
    socket.on('message', text => {
      if (text.length > 4096) return;
      let msg = null;
      try { msg = JSON.parse(text); } catch (e) { return; }
      try {
        if (msg && msg.type === 'hello' && !person.ready) {
          const cid = String(msg.clientId || '').slice(0, 64);
          const newId = cid.length >= 8 ? idFrom(cid) : 'p' + crypto.randomBytes(6).toString('hex');
          const old = people.get(newId);
          people.delete(person.id);
          if (old && old.socket !== socket) { old.socket.data.replaced = true; try { old.socket.close(); } catch (e) { /* ignore */ } }
          person.id = newId; person.ready = true; person.name = cleanName(msg.name);
          people.set(newId, { socket, person });
          socket.sendJSON({ type: 'welcome', personId: newId, name: person.name, reconnectMs: hub.CONST.RECONNECT_MS, serverNow: Date.now() });
          const room = hub.reconnect(person);
          if (!room) { if (hub.roomFor(newId)) hub.sendRoom(newId); else sendLobby(newId); }
          broadcastLobby();
          return;
        }
        if (!person.ready) return;
        handle(person, msg);
      } catch (e) {
        console.error('[proto] ' + (msg && msg.type) + ' 出錯：', e && e.stack || e);
        io.send(person.id, { type: 'error', code: 'server', params: {} });
      }
    });
    socket.on('close', () => {
      const it = people.get(person.id);
      if (!it || it.socket !== socket) return;
      people.delete(person.id);
      if (!person.ready) return;
      lobbyChat.drop(person.id);
      hub.markDisconnected(person.id);
      broadcastLobby();
    });
  }
});

function localAddresses() {
  const out = [], nets = os.networkInterfaces();
  for (const name in nets) for (const net of nets[name] || []) if (net.family === 'IPv4' && !net.internal) out.push(net.address);
  return out;
}

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('舒爾特方格（schulte-table）已啟動');
    console.log('  本機：http://localhost:' + PORT);
    for (const ip of localAddresses()) console.log('  同網路：http://' + ip + ':' + PORT);
    console.log('  健康檢查：http://localhost:' + PORT + '/health');
  });
}

module.exports = { server, hub, io, people, PORT };
