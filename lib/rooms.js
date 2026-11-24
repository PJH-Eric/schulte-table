/* ===== lib/rooms.js — 房間、席位、觀戰、邀請、聊天、對局（純邏輯，不碰 socket）=====
 * 對外只有 createHub(io)：io.send(personId, msg) 負責送訊息給某個人，其餘全在這裡。
 *
 * 兩種線上玩法（沒有電腦席位、不組隊）：
 *   grab 同盤搶點：全場共用同一個目標，伺服器依到達順序裁定，第一個合法點擊得分（每格 1 分＋連擊加成）。
 *   race 同題競速：每人同一個種子、同一個排列，各自走自己的進度；第一個完成者出現該局立刻結束。
 * 局數 1／3／5；每局依名次給名次分（人數 − 名次 ＋ 1），多局累計。耗時以伺服器收到點擊的時間為準。
 *
 * 房間生命週期（以「真人玩家」為準，觀戰者不算）：
 *   - 真人玩家數降到 0 → 立即關房：邀請失效、從大廳移除、通知觀戰者。
 *   - 斷線保留席位 30 秒；回來依伺服器狀態還原盤面。
 *   - 對局中 60 秒沒點擊先警告，90 秒視為棄權（該場不再參加，名次依當下進度）。
 */
'use strict';

const crypto = require('crypto');
const Rules = require('../public/js/rules.js');

const CONST = {
  MAX_PLAYERS: 6,
  SPEC_MAX: 20,
  RECONNECT_MS: 30000,
  IDLE_WARN_MS: 60000,
  IDLE_MS: 90000,
  ROUND_MAX_MS: 5 * 60 * 1000,
  COUNTDOWN_MS: 3000,
  ROUND_BREAK_MS: 3500,
  INVITE_TTL_MS: 24 * 3600 * 1000,
  CHAT_KEEP: 60,
  CHAT_MAX: 120,
  CHAT_GAP_MS: 400
};
if (process.env.SCHULTE_COUNTDOWN_MS != null && process.env.SCHULTE_COUNTDOWN_MS !== '') CONST.COUNTDOWN_MS = Math.max(0, Number(process.env.SCHULTE_COUNTDOWN_MS) || 0);
if (process.env.SCHULTE_RECONNECT_MS) CONST.RECONNECT_MS = Number(process.env.SCHULTE_RECONNECT_MS);

const ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function cleanName(raw, fallback) {
  let s = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, 16).join('');
  return s || fallback || ('玩家' + (100 + Math.floor(Math.random() * 900)));
}
function cleanText(raw) {
  return Array.from(String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()).slice(0, CONST.CHAT_MAX).join('');
}

/** 房間設定（伺服器端驗證）：不支援的內容×難度組合自動拉回允許範圍 */
function normSettings(raw, prev) {
  raw = raw || {};
  prev = prev || { mode: 'grab', content: 'number', tier: 1, order: 'asc', rounds: 3, isPrivate: false };
  const mode = raw.mode === 'race' || raw.mode === 'grab' ? raw.mode : prev.mode;
  const content = Rules.isContent(raw.content) ? raw.content : prev.content;
  let tier = Number.isInteger(Number(raw.tier)) && Rules.tier(Number(raw.tier)) ? Number(raw.tier) : prev.tier;
  if (!Rules.allowed(content, tier)) tier = Rules.tierIdsFor(content).slice(-1)[0];
  const order = raw.order === 'desc' || raw.order === 'asc' ? raw.order : prev.order;
  const rounds = Rules.ROUNDS.indexOf(Number(raw.rounds)) >= 0 ? Number(raw.rounds) : prev.rounds;
  const isPrivate = raw.isPrivate != null ? raw.isPrivate === true : !!prev.isPrivate;
  return { mode, content, tier, order, rounds, isPrivate };
}

function createHub(io, opt) {
  opt = opt || {};
  const now = opt.now || (() => Date.now());
  const COUNTDOWN_MS = opt.countdownMs != null ? opt.countdownMs : CONST.COUNTDOWN_MS;
  const BREAK_MS = opt.breakMs != null ? opt.breakMs : CONST.ROUND_BREAK_MS;
  const rooms = new Map();
  const where = new Map();       // personId → roomId
  const tapLog = new Map();      // personId → [時間戳]（速率限制）
  let dirty = true;

  const send = (pid, msg) => { try { io.send(pid, msg); } catch (e) { /* 對方已斷線 */ } };
  const markDirty = () => { dirty = true; };
  const seatOf = (room, pid) => room.seats.findIndex(s => s && s.id === pid);
  const humans = room => room.seats.filter(Boolean);
  const members = room => humans(room).concat(Array.from(room.specs.values()));
  const roleOf = (room, pid) => seatOf(room, pid) >= 0 ? 'player' : room.specs.has(pid) ? 'spectator' : null;
  const busy = room => room.status === 'playing' || room.status === 'roundEnd';

  function newRoomId() {
    for (let k = 0; k < 50; k++) {
      let id = '';
      for (let i = 0; i < 4; i++) id += ID_CHARS[crypto.randomInt(ID_CHARS.length)];
      if (!rooms.has(id)) return id;
    }
    return 'R' + Date.now().toString(36).toUpperCase();
  }
  const newInvite = () => ({ token: crypto.randomBytes(12).toString('base64url'), revoked: false, expiresAt: now() + CONST.INVITE_TTL_MS });

  /* ---------- 快照 ---------- */
  function matchView(room, pid) {
    const m = room.match;
    if (!m) return null;
    const g = m.game;
    const role = roleOf(room, pid);
    const v = {
      no: m.no, round: m.rounds.length + (room.status === 'playing' ? 1 : 0), total: m.total, mode: m.mode,
      spec: g ? Rules.boardSpec(g.board) : null, startAt: m.startAt, nextAt: m.nextAt || 0, phase: room.status,
      players: m.ids.map(id => {
        const p = g && g.players[id];
        const info = m.info[id];
        return {
          id, seat: info.seat, name: info.name, left: !!info.left, out: !!info.out,
          score: p ? p.score : 0, combo: p ? p.combo : 0, step: p ? p.step : 0, finished: !!(p && p.finishedAt),
          time: p && p.finishedAt ? p.finishedAt - g.startAt : null, points: m.points[id] || 0, total: m.totals[id] || 0
        };
      }),
      rounds: m.rounds.map(r => r.placed.map(e => ({ id: e.id, rank: e.rank, points: e.points, score: e.score, time: e.time, step: e.step, finished: e.finished })))
    };
    if (g && m.mode === 'grab') { v.step = g.step; v.owner = g.owner.map(id => id == null ? -1 : m.info[id].seat); }
    if (g && m.mode === 'race' && role === 'player' && g.done[pid]) v.myDone = g.done[pid].map(Boolean);
    if (m.standing) v.standing = m.standing;
    return v;
  }
  function snapshot(room, pid) {
    return {
      id: room.id, status: room.status, version: room.version, serverNow: now(),
      you: { id: pid, role: roleOf(room, pid), seat: seatOf(room, pid), host: room.hostId === pid },
      hostId: room.hostId,
      seats: room.seats.map((s, i) => s && { id: s.id, seat: i, name: s.name, connected: s.connected, ready: !!s.ready }),
      specs: Array.from(room.specs.values()).map(s => ({ id: s.id, name: s.name })),
      specMax: CONST.SPEC_MAX, maxPlayers: CONST.MAX_PLAYERS,
      settings: Object.assign({}, room.settings),
      match: matchView(room, pid),
      invite: room.hostId === pid ? { token: room.invite.token, revoked: room.invite.revoked, expiresAt: room.invite.expiresAt } : null,
      chat: room.chat.slice(-30)
    };
  }
  function broadcast(room) {
    if (room.closed) return;
    room.version++;
    for (const m of members(room)) if (m.connected) send(m.id, { type: 'room', room: snapshot(room, m.id) });
    markDirty();
  }
  function emit(room, msg) { for (const m of members(room)) if (m.connected) send(m.id, msg); }
  function toast(room, code, params) { emit(room, { type: 'toast', code, params: params || {} }); }

  function listRooms() {
    const out = [];
    for (const r of rooms.values()) {
      if (r.settings.isPrivate) continue;
      const host = humans(r).find(s => s.id === r.hostId) || humans(r)[0];
      out.push({
        id: r.id, hostName: host ? host.name : '', players: humans(r).length, cap: CONST.MAX_PLAYERS, spectators: r.specs.size,
        status: busy(r) ? 'playing' : 'waiting', mode: r.settings.mode, content: r.settings.content, tier: r.settings.tier,
        order: r.settings.order, rounds: r.settings.rounds, specFull: r.specs.size >= CONST.SPEC_MAX
      });
    }
    out.sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1) || a.id.localeCompare(b.id));
    return out;
  }

  /* ---------- 建立、加入、離開 ---------- */
  function detach(pid) { where.delete(pid); tapLog.delete(pid); if (io.cleared) io.cleared(pid); }

  function closeRoom(room, reason) {
    if (room.closed) return;
    room.closed = true;
    room.invite.revoked = true;
    room.status = 'closed';
    for (const m of members(room)) {
      if (m.connected) send(m.id, { type: 'closed', roomId: room.id, reason: reason || 'no_players' });
      detach(m.id);
    }
    rooms.delete(room.id);
    markDirty();
  }

  function create(p, msg) {
    if (where.has(p.id)) leave(p.id, true);
    const room = {
      id: newRoomId(), hostId: p.id, version: 0, status: 'waiting', closed: false, gameNo: 0,
      seats: new Array(CONST.MAX_PLAYERS).fill(null), specs: new Map(), chat: [], lastChatAt: new Map(),
      settings: normSettings(msg && msg.settings), invite: newInvite(), match: null
    };
    room.seats[0] = { id: p.id, name: cleanName(msg && msg.name, p.name), connected: true, ready: false, dcAt: 0 };
    rooms.set(room.id, room);
    where.set(p.id, room.id);
    broadcast(room);
    return room;
  }

  /** 快速加入：找等待中、有空位的公開房；沒有就自己開一間並告知 */
  function quick(p, msg) {
    for (const r of rooms.values()) {
      if (r.closed || r.settings.isPrivate || busy(r)) continue;
      if (r.seats.some(s => !s) && !roleOf(r, p.id)) return join(p, { roomId: r.id, name: msg && msg.name, want: 'player' });
    }
    const room = create(p, { name: msg && msg.name, settings: msg && msg.settings });
    send(p.id, { type: 'toast', code: 'quickCreated', params: {} });
    return room;
  }

  function join(p, msg) {
    const room = rooms.get(String(msg && msg.roomId || '').toUpperCase());
    if (!room || room.closed) return fail(p, 'room_missing');
    const name = cleanName(msg.name, p.name);
    if (roleOf(room, p.id)) { restore(room, p.id, name); return room; }
    if (msg.token != null && msg.token !== '') {
      if (String(msg.token) !== room.invite.token) return fail(p, 'invite_invalid');
      if (room.invite.revoked) return fail(p, 'invite_revoked');
      if (now() > room.invite.expiresAt) return fail(p, 'invite_expired');
    } else if (room.settings.isPrivate) return fail(p, 'room_private');
    if (where.has(p.id)) leave(p.id, true);
    const free = room.seats.findIndex(s => !s);
    if (msg.want !== 'spectator' && free >= 0 && !busy(room)) {
      room.seats[free] = { id: p.id, name, connected: true, ready: false, dcAt: 0 };
      where.set(p.id, room.id);
      if (!room.hostId || seatOf(room, room.hostId) < 0) room.hostId = p.id;
    } else {
      if (room.specs.size >= CONST.SPEC_MAX) return fail(p, 'spec_full');
      room.specs.set(p.id, { id: p.id, name, connected: true, dcAt: 0 });
      where.set(p.id, room.id);
      if (msg.want !== 'spectator') send(p.id, { type: 'toast', code: free < 0 ? 'fullToSpec' : 'busyToSpec', params: {} });
    }
    toast(room, roleOf(room, p.id) === 'player' ? 'joinedPlay' : 'joinedSpec', { n: name });
    broadcast(room);
    return room;
  }

  function restore(room, pid, name) {
    const s = room.seats[seatOf(room, pid)] || room.specs.get(pid);
    if (!s) return;
    s.connected = true; s.dcAt = 0; if (name) s.name = name;
    where.set(pid, room.id);
    broadcast(room);
  }

  function sit(p) {
    const room = roomFor(p.id); if (!room || !room.specs.has(p.id)) return;
    if (busy(room)) return fail(p, 'busy_sit');
    const free = room.seats.findIndex(s => !s);
    if (free < 0) return fail(p, 'full');
    const sp = room.specs.get(p.id);
    room.specs.delete(p.id);
    room.seats[free] = { id: p.id, name: sp.name, connected: true, ready: false, dcAt: 0 };
    if (!room.hostId || seatOf(room, room.hostId) < 0) room.hostId = p.id;
    unready(room);
    broadcast(room);
  }
  function stand(p) {
    const room = roomFor(p.id); if (!room) return;
    const seat = seatOf(room, p.id); if (seat < 0) return;
    if (busy(room)) return fail(p, 'busy_sit');
    if (room.specs.size >= CONST.SPEC_MAX) return fail(p, 'spec_full');
    const s = room.seats[seat];
    freeSeat(room, seat);
    room.specs.set(p.id, { id: p.id, name: s.name, connected: true, dcAt: 0 });
    afterMembership(room);
  }
  function unready(room) { for (const s of room.seats) if (s) s.ready = false; }

  function leave(pid, silent) {
    const room = roomFor(pid); if (!room) { where.delete(pid); return; }
    const seat = seatOf(room, pid);
    if (seat >= 0) {
      const name = room.seats[seat].name;
      dropFromMatch(room, pid, 'left');
      freeSeat(room, seat);
      if (!silent) toast(room, 'leftRoom', { n: name });
    } else room.specs.delete(pid);
    detach(pid);
    afterMembership(room);
  }
  function freeSeat(room, idx) {
    const s = room.seats[idx];
    room.seats[idx] = null;
    if (s && room.hostId === s.id) { const nx = humans(room)[0]; room.hostId = nx ? nx.id : ''; }
    if (!busy(room)) unready(room);
  }
  /** 人員變動後：沒有真人玩家就關房；對局中只剩一人就結束 */
  function afterMembership(room) {
    if (room.closed) return;
    if (humans(room).length === 0) { closeRoom(room, 'no_players'); return; }
    if (busy(room)) checkAlone(room);
    broadcast(room);
  }

  function kick(p, targetId) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id || targetId === p.id) return;
    if (!roleOf(room, targetId)) return;
    const who = room.seats[seatOf(room, targetId)] || room.specs.get(targetId) || {};
    send(targetId, { type: 'closed', roomId: room.id, reason: 'kicked' });
    leave(targetId, true);
    if (!room.closed) toast(room, 'kicked', { n: who.name || '' });
  }

  function settings(p, msg) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id) return;
    if (busy(room)) return fail(p, 'busy_settings');
    room.settings = normSettings(msg, room.settings);
    unready(room);
    broadcast(room);
  }
  function inviteNew(p) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id) return;
    room.invite = newInvite();
    send(p.id, { type: 'toast', code: 'newInvite', params: {} });
    broadcast(room);
  }
  function inviteRevoke(p) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id) return;
    room.invite.revoked = true;
    send(p.id, { type: 'toast', code: 'inviteRevoked', params: {} });
    broadcast(room);
  }

  function chat(p, text) {
    const room = roomFor(p.id); if (!room) return;
    const t = cleanText(text); if (!t) return;
    const last = room.lastChatAt.get(p.id) || 0;
    if (now() - last < CONST.CHAT_GAP_MS) return;
    room.lastChatAt.set(p.id, now());
    const role = roleOf(room, p.id);
    const seat = seatOf(room, p.id);
    const who = room.seats[seat] || room.specs.get(p.id);
    const m = { id: p.id, name: who.name, seat: seat, role, text: t, t: now() };
    room.chat.push(m);
    if (room.chat.length > CONST.CHAT_KEEP) room.chat.shift();
    emit(room, { type: 'chat', msg: m });
  }

  /* ---------- 準備、開局 ---------- */
  function setReady(p, value) {
    const room = roomFor(p.id); if (!room) return;
    const seat = seatOf(room, p.id); if (seat < 0 || busy(room)) return;
    room.seats[seat].ready = value !== false;
    broadcast(room);
  }
  /** 房主按「開始」：至少兩人、其他玩家都已準備 */
  function start(p) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id || busy(room)) return;
    const ps = humans(room);
    if (ps.length < 2) return fail(p, 'start_need_players');
    if (ps.some(s => s.id !== room.hostId && !s.ready)) return fail(p, 'start_not_ready');
    if (ps.some(s => !s.connected)) return fail(p, 'start_offline');
    const ids = ps.map(s => s.id);
    const info = {};
    room.seats.forEach((s, i) => { if (s) info[s.id] = { seat: i, name: s.name, left: false, out: false }; });
    room.gameNo++;
    room.match = { no: room.gameNo, mode: room.settings.mode, total: room.settings.rounds, ids, info, rounds: [], points: {}, totals: {}, game: null, startAt: 0, nextAt: 0, standing: null, settings: Object.assign({}, room.settings) };
    startRound(room);
  }
  function startRound(room) {
    const m = room.match, st = m.settings;
    const board = Rules.makeBoard({ size: Rules.tier(st.tier).size, content: st.content, order: st.order, seed: Rules.newSeed() + crypto.randomBytes(3).toString('hex') });
    const active = m.ids.filter(id => !m.info[id].left && !m.info[id].out);
    const g = Rules.createGame(board, m.mode, m.ids);
    m.startAt = now() + COUNTDOWN_MS;
    Rules.start(g, m.startAt);
    g.active = active;
    m.game = g; m.nextAt = 0;
    m.lastAct = {};
    m.ids.forEach(id => { m.lastAct[id] = m.startAt; m.info[id].idleWarn = false; });
    room.status = 'playing';
    for (const s of room.seats) if (s) s.ready = false;
    broadcast(room);
  }

  /** 點擊：伺服器以到達順序裁定 */
  function tap(p, msg) {
    const room = roomFor(p.id); if (!room || room.status !== 'playing') return;
    const m = room.match, g = m && m.game; if (!g) return;
    const info = m.info[p.id]; if (!info || info.left || info.out) return;
    const t = now();
    /* 速率限制：每人每秒最多 20 次 */
    const log = (tapLog.get(p.id) || []).filter(x => t - x < 1000);
    if (log.length >= Rules.TAP_RATE) { tapLog.set(p.id, log); return; }
    log.push(t); tapLog.set(p.id, log);
    const idx = Number(msg && msg.idx);
    const seq = Number(msg && msg.seq) || 0;
    const r = Rules.tap(g, p.id, Number.isInteger(idx) ? idx : -1, t);
    if (!r.ok) { send(p.id, { type: 'ack', idx, seq, ok: false }); return; }
    m.lastAct[p.id] = t; info.idleWarn = false;
    if (m.mode === 'grab') {
      if (!r.hit) { send(p.id, { type: 'ack', idx, seq, ok: true, hit: false, late: !!r.taken, by: r.taken ? m.info[g.owner[idx]].seat : -1 }); return; }
      const pl = g.players[p.id];
      emit(room, { type: 'grab', idx, seat: info.seat, by: p.id, score: pl.score, combo: pl.combo, delta: r.scoreDelta, step: g.step, seq, reset: m.ids.filter(id => id !== p.id).map(id => [m.info[id].seat, g.players[id].combo]) });
      if (r.finished) endRound(room);
    } else {
      send(p.id, { type: 'ack', idx, seq, ok: true, hit: r.hit, step: g.players[p.id].step });
      if (!r.hit) return;
      emit(room, { type: 'progress', seat: info.seat, by: p.id, step: g.players[p.id].step, finished: r.finished });
      if (Rules.raceOver(g)) endRound(room);
    }
  }

  function endRound(room, why) {
    const m = room.match, g = m.game;
    if (!g || room.status !== 'playing') return;
    g.phase = 'ended';
    const placed = (m.mode === 'grab' ? Rules.rankGrab(g) : Rules.rankRace(g));
    const roundMs = now() - g.startAt;
    m.rounds.push({ placed, roundMs, why: why || 'done' });
    placed.forEach(e => { m.points[e.id] = (m.points[e.id] || 0) + e.points; m.totals[e.id] = (m.totals[e.id] || 0) + (m.mode === 'grab' ? e.score : (e.time != null ? e.time : roundMs)); });
    if (m.rounds.length >= m.total || activeIds(room).length < 2) { endMatch(room); return; }
    room.status = 'roundEnd';
    m.nextAt = now() + BREAK_MS;
    broadcast(room);
  }
  function endMatch(room) {
    const m = room.match;
    const standing = Rules.matchStanding(m.mode, m.ids, m.rounds);
    m.standing = standing.map(s => ({ id: s.id, rank: s.rank, points: s.points, score: s.score, time: s.time, bestTime: s.bestTime, seat: m.info[s.id].seat, name: m.info[s.id].name, left: m.info[s.id].left }));
    room.status = 'waiting';
    m.nextAt = 0;
    for (const s of room.seats) if (s) s.ready = false;
    emit(room, { type: 'matchEnd', no: m.no });
    broadcast(room);
  }
  function next(p) {
    const room = roomFor(p.id); if (!room || room.hostId !== p.id || room.status !== 'roundEnd') return;
    startRound(room);
  }
  function activeIds(room) { const m = room.match; return m ? m.ids.filter(id => !m.info[id].left && !m.info[id].out) : []; }
  /** 對局中離開：保留這局的成績，之後的局不再參加 */
  function dropFromMatch(room, pid, why) {
    const m = room.match;
    if (!m || !busy(room) || !m.info[pid]) return;
    m.info[pid].left = why === 'left' || why === 'dc';
    if (why === 'idle') m.info[pid].out = true;
  }
  function checkAlone(room) {
    if (!busy(room)) return;
    if (activeIds(room).length < 2) {
      if (room.status === 'playing') endRound(room, 'alone');
      else endMatch(room);
    }
  }

  /* ---------- 連線狀態 ---------- */
  function markDisconnected(pid) {
    const room = roomFor(pid); if (!room) return;
    const s = room.seats[seatOf(room, pid)] || room.specs.get(pid);
    if (!s) return;
    s.connected = false; s.dcAt = now();
    if (room.specs.has(pid)) { room.specs.delete(pid); detach(pid); }
    broadcast(room);
  }
  function reconnect(p) {
    const room = roomFor(p.id); if (!room) return null;
    const s = room.seats[seatOf(room, p.id)];
    if (!s) return null;
    s.connected = true; s.dcAt = 0;
    broadcast(room);
    return room;
  }

  /** 定期呼叫：斷線寬限、閒置、局間休息、單局上限 */
  function tick() {
    const t = now();
    for (const room of Array.from(rooms.values())) {
      if (room.closed) continue;
      let changed = false;
      for (let i = 0; i < room.seats.length; i++) {
        const s = room.seats[i];
        if (s && !s.connected && t - s.dcAt > CONST.RECONNECT_MS) {
          changed = true;
          dropFromMatch(room, s.id, 'dc');
          toast(room, 'dcLoss', { n: s.name });
          freeSeat(room, i);
          detach(s.id);
        }
      }
      if (humans(room).length === 0) { closeRoom(room, 'no_players'); continue; }
      const m = room.match;
      if (room.status === 'playing' && m && m.game) {
        for (const id of activeIds(room)) {
          const pl = m.game.players[id];
          if (m.mode === 'race' && pl.finishedAt) continue;
          const idle = t - Math.max(m.lastAct[id] || 0, m.startAt);
          if (idle > CONST.IDLE_MS) {
            m.info[id].out = true; changed = true;
            toast(room, 'idleOut', { n: m.info[id].name });
          } else if (idle > CONST.IDLE_WARN_MS && !m.info[id].idleWarn) {
            m.info[id].idleWarn = true;
            send(id, { type: 'toast', code: 'idleWarn', params: {} });
          }
        }
        if (activeIds(room).length < 2) { endRound(room, 'alone'); continue; }
        if (t - m.startAt > CONST.ROUND_MAX_MS) { endRound(room, 'timeout'); continue; }
      }
      if (room.status === 'roundEnd' && m && m.nextAt && t >= m.nextAt) { startRound(room); continue; }
      if (changed) { if (busy(room)) checkAlone(room); broadcast(room); }
    }
  }

  function roomFor(pid) { const id = where.get(pid); const r = id && rooms.get(id); return r && !r.closed ? r : null; }
  function fail(p, code, params) { if (p && p.id) send(p.id, { type: 'error', code, params: params || {} }); return null; }
  function sendRoom(pid) { const r = roomFor(pid); if (r) send(pid, { type: 'room', room: snapshot(r, pid) }); }
  function popDirty() { const d = dirty; dirty = false; return d; }
  function stats() {
    let players = 0, spectators = 0;
    for (const r of rooms.values()) { players += humans(r).filter(s => s.connected).length; spectators += r.specs.size; }
    return { rooms: rooms.size, players, spectators };
  }

  return {
    CONST, rooms, create, quick, join, sit, stand, leave, kick, settings, inviteNew, inviteRevoke, chat,
    setReady, start, next, tap, markDisconnected, reconnect, tick, listRooms, roomFor, sendRoom, snapshot, popDirty, stats, closeRoom
  };
}

module.exports = { createHub, CONST, cleanName, cleanText, normSettings };
