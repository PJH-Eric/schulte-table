/* 房間邏輯單元測試（假時鐘、假傳輸）：node --test tests/rooms.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Rules = require('../public/js/rules.js');
const { createHub, CONST } = require('../lib/rooms.js');

function setup(opt) {
  let t = 1000000;
  const inbox = {};
  const io = { send(id, m) { (inbox[id] = inbox[id] || []).push(m); }, cleared() {} };
  const hub = createHub(io, Object.assign({ now: () => t, countdownMs: 3000, breakMs: 3000 }, opt));
  const P = id => ({ id, name: id });
  return {
    hub, inbox, P,
    adv(ms) { t += ms; hub.tick(); },
    get now() { return t; },
    last(id, type) { const l = (inbox[id] || []).filter(m => m.type === type); return l[l.length - 1]; },
    room(id) { return hub.roomFor(id); }
  };
}
/** 兩到三人開房、準備、開始，回傳房間 */
function play(s, settings, ids) {
  ids = ids || ['a', 'b'];
  const room = s.hub.create(s.P(ids[0]), { name: ids[0], settings });
  ids.slice(1).forEach(id => { s.hub.join(s.P(id), { roomId: room.id, name: id }); s.hub.setReady(s.P(id), true); });
  s.hub.start(s.P(ids[0]));
  return room;
}
const target = room => Rules.cellOfStep(room.match.game.board, room.match.mode === 'grab' ? room.match.game.step : 0);

test('開房、加入、準備才能開始；至少兩人', () => {
  const s = setup();
  const room = s.hub.create(s.P('a'), { name: 'A', settings: { mode: 'grab', content: 'letter', tier: 4 } });
  assert.equal(room.settings.tier, 2, '字母最大 5×5，自動拉回');
  s.hub.start(s.P('a'));
  assert.equal(s.last('a', 'error').code, 'start_need_players');
  s.hub.join(s.P('b'), { roomId: room.id, name: 'B' });
  s.hub.start(s.P('a'));
  assert.equal(s.last('a', 'error').code, 'start_not_ready');
  s.hub.start(s.P('b'));
  assert.equal(room.status, 'waiting', '非房主不能開始');
  s.hub.setReady(s.P('b'), true);
  s.hub.start(s.P('a'));
  assert.equal(room.status, 'playing');
  assert.equal(room.match.game.board.size, 5);
});

test('搶點：倒數期間拒絕；同時點擊以到達順序裁定；連擊與分數', () => {
  const s = setup();
  const room = play(s, { mode: 'grab', content: 'number', tier: 1, rounds: 1 });
  const c0 = target(room);
  s.hub.tap(s.P('a'), { idx: c0, seq: 1 });
  assert.equal(s.last('a', 'ack').ok, false, '倒數中');
  s.adv(3000);
  s.hub.tap(s.P('b'), { idx: c0, seq: 1 });
  s.hub.tap(s.P('a'), { idx: c0, seq: 2 });
  const grab = s.last('a', 'grab');
  assert.equal(grab.by, 'b'); assert.equal(grab.delta, 1);
  const ack = s.last('a', 'ack');
  assert.equal(ack.hit, false); assert.equal(ack.late, true, '慢一步：差一點');
  for (let i = 0; i < 4; i++) s.hub.tap(s.P('b'), { idx: target(room) });
  assert.equal(room.match.game.players.b.combo, 5);
  assert.equal(room.match.game.players.b.score, 1 + 1 + 2 + 2 + 2);
  s.hub.tap(s.P('a'), { idx: target(room) });
  assert.equal(room.match.game.players.b.combo, 0, '被搶走歸零');
  while (room.status === 'playing') s.hub.tap(s.P('a'), { idx: target(room) });
  assert.equal(room.status, 'waiting');
  assert.ok(room.match.standing[0].id === 'a');
  assert.ok(s.last('b', 'matchEnd'));
});

test('越界、重複、速率限制一律拒絕', () => {
  const s = setup();
  const room = play(s, { mode: 'grab', content: 'number', tier: 0, rounds: 1 });
  s.adv(3000);
  s.hub.tap(s.P('a'), { idx: 99 });
  assert.equal(s.last('a', 'ack').ok, false);
  s.hub.tap(s.P('a'), { idx: 'x' });
  assert.equal(s.last('a', 'ack').ok, false);
  s.adv(1001);
  const before = s.inbox.a.length;
  for (let i = 0; i < 30; i++) s.hub.tap(s.P('a'), { idx: (target(room) + 1) % 9 });
  const acks = s.inbox.a.slice(before).filter(m => m.type === 'ack').length;
  assert.equal(acks, Rules.TAP_RATE, '每秒最多 20 次');
});

test('競速：各自進度、第一個完成即結束、多局名次分累計、局間自動下一局', () => {
  const s = setup();
  const room = play(s, { mode: 'race', content: 'number', tier: 0, rounds: 3 }, ['a', 'b', 'c']);
  s.adv(3000);
  const g = () => room.match.game;
  const step = id => Rules.cellOfStep(g().board, g().players[id].step);
  for (let i = 0; i < 4; i++) s.hub.tap(s.P('b'), { idx: step('b') });
  for (let i = 0; i < 9; i++) s.hub.tap(s.P('a'), { idx: step('a') });
  assert.equal(room.status, 'roundEnd');
  const r1 = room.match.rounds[0].placed;
  assert.deepEqual(r1.map(e => [e.id, e.rank, e.points]), [['a', 1, 3], ['b', 2, 2], ['c', 3, 1]]);
  assert.ok(s.last('c', 'progress'), '觀戰與對手收到進度');
  s.adv(3000);
  assert.equal(room.status, 'playing', '休息後自動下一局');
  s.adv(3000);
  for (let i = 0; i < 9; i++) s.hub.tap(s.P('c'), { idx: step('c') });
  s.hub.next(s.P('a'));
  assert.equal(room.status, 'playing', '房主可提前下一局');
  s.adv(3000);
  for (let i = 0; i < 9; i++) s.hub.tap(s.P('a'), { idx: step('a') });
  assert.equal(room.status, 'waiting');
  const st = room.match.standing;
  assert.equal(st[0].id, 'a'); assert.equal(st[0].points, 3 + 2 + 3);
});

test('觀戰：人滿或對局中自動轉觀戰；觀戰者不能點；上限 20', () => {
  const s = setup();
  const room = play(s, { mode: 'grab', content: 'number', tier: 0, rounds: 1 });
  s.hub.join(s.P('v'), { roomId: room.id, name: 'V' });
  assert.ok(room.specs.has('v'));
  s.adv(3000);
  s.hub.tap(s.P('v'), { idx: target(room) });
  assert.equal(room.match.game.step, 0);
  const snap = s.hub.snapshot(room, 'v');
  assert.equal(snap.you.role, 'spectator');
  assert.ok(Array.isArray(snap.match.owner));
  for (let i = 0; i < CONST.SPEC_MAX; i++) s.hub.join(s.P('s' + i), { roomId: room.id, want: 'spectator' });
  assert.equal(room.specs.size, CONST.SPEC_MAX);
  assert.equal(s.last('s19', 'error').code, 'spec_full');
});

test('競速時玩家看不到對手的盤面完成格，只看到進度', () => {
  const s = setup();
  const room = play(s, { mode: 'race', content: 'number', tier: 0, rounds: 1 });
  s.adv(3000);
  s.hub.tap(s.P('a'), { idx: Rules.cellOfStep(room.match.game.board, 0) });
  const va = s.hub.snapshot(room, 'a').match, vb = s.hub.snapshot(room, 'b').match;
  assert.equal(va.myDone.filter(Boolean).length, 1);
  assert.equal(vb.myDone.filter(Boolean).length, 0);
  assert.equal(vb.players.find(p => p.id === 'a').step, 1);
});

test('邀請連結：錯誤、撤銷、過期；私人房不列出、無邀請不能進', () => {
  const s = setup();
  const room = s.hub.create(s.P('a'), { name: 'A', settings: { isPrivate: true } });
  assert.equal(s.hub.listRooms().length, 0);
  s.hub.join(s.P('b'), { roomId: room.id });
  assert.equal(s.last('b', 'error').code, 'room_private');
  s.hub.join(s.P('b'), { roomId: room.id, token: 'nope' });
  assert.equal(s.last('b', 'error').code, 'invite_invalid');
  const tok = room.invite.token;
  s.hub.join(s.P('b'), { roomId: room.id, token: tok });
  assert.equal(s.hub.roomFor('b'), room);
  s.hub.inviteRevoke(s.P('a'));
  s.hub.join(s.P('c'), { roomId: room.id, token: tok });
  assert.equal(s.last('c', 'error').code, 'invite_revoked');
  s.hub.inviteNew(s.P('a'));
  s.adv(CONST.INVITE_TTL_MS + 1);
  s.hub.join(s.P('c'), { roomId: room.id, token: room.invite.token });
  assert.equal(s.last('c', 'error').code, 'invite_expired');
  assert.equal(s.hub.snapshot(room, 'b').invite, null, '只有房主看得到邀請');
});

test('斷線 30 秒內重連保留席位並還原盤面；超過就離開', () => {
  const s = setup();
  const room = play(s, { mode: 'race', content: 'number', tier: 0, rounds: 1 }, ['a', 'b', 'c']);
  s.adv(3000);
  s.hub.tap(s.P('b'), { idx: Rules.cellOfStep(room.match.game.board, 0) });
  s.hub.markDisconnected('b');
  s.adv(CONST.RECONNECT_MS - 1000);
  assert.equal(s.hub.reconnect(s.P('b')), room);
  assert.equal(s.hub.snapshot(room, 'b').match.myDone.filter(Boolean).length, 1);
  s.hub.markDisconnected('c');
  s.adv(CONST.RECONNECT_MS + 100);
  assert.equal(room.seats.filter(Boolean).length, 2);
  assert.equal(room.match.info.c.left, true);
});

test('真人玩家全數離開立刻關房、撤銷邀請並通知觀戰者', () => {
  const s = setup();
  const room = s.hub.create(s.P('a'), { name: 'A' });
  s.hub.join(s.P('v'), { roomId: room.id, want: 'spectator' });
  const tok = room.invite.token;
  s.hub.leave('a');
  assert.equal(s.hub.rooms.size, 0);
  assert.equal(s.last('v', 'closed').reason, 'no_players');
  s.hub.join(s.P('x'), { roomId: room.id, token: tok });
  assert.equal(s.last('x', 'error').code, 'room_missing');
});

test('對局中只剩一人就結束；房主可踢人；換房主', () => {
  const s = setup();
  const room = play(s, { mode: 'grab', content: 'number', tier: 0, rounds: 3 });
  s.adv(3000);
  s.hub.leave('b');
  assert.equal(room.status, 'waiting');
  assert.ok(room.match.standing);
  s.hub.join(s.P('c'), { roomId: room.id });
  s.hub.kick(s.P('c'), 'a');
  assert.ok(s.hub.roomFor('a'), '非房主不能踢');
  s.hub.kick(s.P('a'), 'c');
  assert.equal(s.hub.roomFor('c'), null);
  assert.equal(s.last('c', 'closed').reason, 'kicked');
  s.hub.join(s.P('d'), { roomId: room.id });
  s.hub.leave('a');
  assert.equal(room.hostId, 'd', '房主離開換人');
});

test('快速加入：有空房就加入，沒有就開新房並告知', () => {
  const s = setup();
  const r1 = s.hub.quick(s.P('a'), { name: 'A' });
  assert.equal(s.last('a', 'toast').code, 'quickCreated');
  const r2 = s.hub.quick(s.P('b'), { name: 'B' });
  assert.equal(r1, r2);
});

test('閒置：60 秒警告、90 秒棄權', () => {
  const s = setup();
  const room = play(s, { mode: 'race', content: 'number', tier: 0, rounds: 1 }, ['a', 'b', 'c']);
  s.adv(3000);
  for (let k = 0; k < 7; k++) { s.adv(10000); s.hub.tap(s.P('a'), { idx: (Rules.cellOfStep(room.match.game.board, room.match.game.players.a.step) + 1) % 9 }); s.hub.tap(s.P('b'), { idx: (Rules.cellOfStep(room.match.game.board, room.match.game.players.b.step) + 1) % 9 }); }
  assert.equal(s.last('c', 'toast').code, 'idleWarn');
  for (let k = 0; k < 3; k++) { s.adv(10000); s.hub.tap(s.P('a'), { idx: (Rules.cellOfStep(room.match.game.board, room.match.game.players.a.step) + 1) % 9 }); s.hub.tap(s.P('b'), { idx: (Rules.cellOfStep(room.match.game.board, room.match.game.players.b.step) + 1) % 9 }); }
  assert.equal(room.match.info.c.out, true);
  assert.equal(room.status, 'playing', '還有兩人繼續');
});
