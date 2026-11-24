/* ===== tests/online-check.js — 真的開一台伺服器，用多個 WebSocket 用戶端跑完線上流程（零依賴，Node 22 內建 WebSocket）=====
 * 同盤搶點同時點擊裁定、同題競速、多局、觀戰、邀請撤銷、斷線重連、零真人關房、大廳聊天公告。
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert/strict');
const Rules = require('../public/js/rules.js');

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = 'ws://127.0.0.1:' + PORT + '/ws';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function client(cid, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BASE);
    const c = { ws, msgs: [], room: null, cid, name };
    c.send = o => ws.send(JSON.stringify(o));
    c.last = type => { for (let i = c.msgs.length - 1; i >= 0; i--) if (c.msgs[i].type === type) return c.msgs[i]; return null; };
    c.wait = async (pred, ms) => { const end = Date.now() + (ms || 4000); while (Date.now() < end) { const m = c.msgs.find(pred); if (m) return m; await sleep(10); } throw new Error(name + ' timeout: ' + pred); };
    c.board = () => Rules.makeBoard(c.room.match.spec);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'hb') { c.send({ type: 'hb' }); return; }
      if (m.type === 'room') c.room = m.room;
      if (m.type === 'closed') c.room = null;
      c.msgs.push(m);
    };
    ws.onopen = () => c.send({ type: 'hello', clientId: cid, name });
    ws.onerror = reject;
    const iv = setInterval(() => { if (c.msgs.some(m => m.type === 'welcome')) { clearInterval(iv); resolve(c); } }, 10);
  });
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), SCHULTE_COUNTDOWN_MS: '300', SCHULTE_RECONNECT_MS: '1500' }), stdio: 'ignore' });
  const ok = [];
  try {
    for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/health'); if (r.ok) break; } catch (e) { /* 還沒好 */ } await sleep(100); }

    /* 1. 開房、加入、準備、開始；大廳聊天公告新房 */
    const a = await client('client-aaaa-1', 'A'), b = await client('client-bbbb-2', 'B');
    b.send({ type: 'lobbychat', op: 'join', name: 'B' });
    a.send({ type: 'create', name: 'A', settings: { mode: 'grab', content: 'number', tier: 0, rounds: 3 } });
    await a.wait(m => m.type === 'room');
    const id = a.room.id;
    await b.wait(m => m.type === 'lobbychat' && m.op === 'msg');
    b.send({ type: 'join', roomId: id, name: 'B', want: 'player' });
    await b.wait(m => m.type === 'room');
    b.send({ type: 'ready', value: true }); await sleep(80);
    a.send({ type: 'start' });
    await a.wait(m => m.type === 'room' && m.room.status === 'playing');
    await b.wait(m => m.type === 'room' && m.room.status === 'playing');
    ok.push('room');

    /* 2. 搶點：倒數期間拒絕；兩人同時點第一格只有一人得分 */
    const board = a.board();
    a.send({ type: 'tap', idx: Rules.cellOfStep(board, 0), seq: 1 });
    await a.wait(m => m.type === 'ack' && m.ok === false);
    await sleep(350);
    a.send({ type: 'tap', idx: Rules.cellOfStep(board, 0), seq: 2 });
    b.send({ type: 'tap', idx: Rules.cellOfStep(board, 0), seq: 1 });
    const g1 = await b.wait(m => m.type === 'grab');
    await sleep(100);
    assert.equal(a.msgs.filter(m => m.type === 'grab').length, 1, '只裁定一次');
    const loser = g1.by === a.room.you.id ? b : a;
    assert.ok(loser.msgs.some(m => m.type === 'ack' && m.late), '慢的人收到差一點');
    for (let s = 1; s < 9; s++) { a.send({ type: 'tap', idx: Rules.cellOfStep(board, s) }); await a.wait(m => m.type === 'grab' && m.step === s + 1); }
    await a.wait(m => m.type === 'room' && m.room.status === 'roundEnd');
    ok.push('grab');

    /* 3. 局間自動下一局（新盤面），打完兩局總結算 */
    let prevSeed = board.seed;
    for (const rd of [2, 3]) {
      await a.wait(m => m.type === 'room' && m.room.status === 'playing' && m.room.match.round === rd, 6000);
      assert.notEqual(a.room.match.spec.seed, prevSeed, '每局新盤面');
      await sleep(350);
      const bd = a.board(); prevSeed = bd.seed;
      const before = b.msgs.length;
      for (let s = 0; s < 9; s++) { b.send({ type: 'tap', idx: Rules.cellOfStep(bd, s) }); await b.wait(m => b.msgs.indexOf(m) >= before && m.type === 'grab' && m.step === s + 1); }
    }
    await a.wait(m => m.type === 'matchEnd');
    await sleep(80);
    assert.equal(a.room.status, 'waiting');
    assert.equal(a.room.match.standing.length, 2);
    assert.equal(a.room.match.standing[0].id, b.room.you.id, 'B 贏兩局');
    assert.equal(a.room.match.standing[0].points, 2 + 2 + 1);
    ok.push('rounds');

    /* 4. 觀戰者加入（對局中自動觀戰）、聊天 */
    const v = await client('client-vvvv-3', 'V');
    a.send({ type: 'settings', settings: { mode: 'race', rounds: 1 } }); await sleep(60);
    b.send({ type: 'ready', value: true }); await sleep(60);
    a.send({ type: 'start' });
    await a.wait(m => m.type === 'room' && m.room.status === 'playing' && m.room.match.mode === 'race');
    v.send({ type: 'join', roomId: id, name: 'V', want: 'player' });
    await v.wait(m => m.type === 'room');
    assert.equal(v.room.you.role, 'spectator');
    v.send({ type: 'chat', text: '加油' });
    await a.wait(m => m.type === 'chat' && m.msg.text === '加油');
    ok.push('spectate');

    /* 5. 競速：各自進度，觀戰收到進度，第一個完成就結束 */
    await sleep(350);
    const rb = a.board();
    for (let s = 0; s < 3; s++) b.send({ type: 'tap', idx: Rules.cellOfStep(rb, s) });
    await v.wait(m => m.type === 'progress' && m.step === 3);
    for (let s = 0; s < 9; s++) a.send({ type: 'tap', idx: Rules.cellOfStep(rb, s) });
    await a.wait(m => m.type === 'matchEnd' && m.no === 2);
    await sleep(60);
    const st = a.room.match.standing;
    assert.equal(st[0].id, a.room.you.id);
    ok.push('race');

    /* 6. 邀請：撤銷後不能用 */
    const tok = a.room.invite.token;
    a.send({ type: 'invite_revoke' }); await sleep(60);
    const c = await client('client-cccc-4', 'C');
    c.send({ type: 'join', roomId: id, token: tok, name: 'C' });
    await c.wait(m => m.type === 'error' && m.code === 'invite_revoked');
    ok.push('invite');

    /* 7. 斷線重連：同一個 clientId 回到同一席位 */
    const bid = b.room.you.id;
    b.ws.close(); await sleep(200);
    assert.equal(a.room.seats.find(s => s && s.id === bid).connected, false);
    const b3 = await client('client-bbbb-2', 'B');
    await b3.wait(m => m.type === 'room');
    assert.equal(b3.room.you.id, bid);
    assert.equal(b3.room.you.role, 'player');
    ok.push('reconnect');

    /* 8. 斷線超過寬限就離開；真人都離開 → 關房並通知觀戰者 */
    b3.ws.close();
    await a.wait(m => m.type === 'toast' && m.code === 'dcLoss', 4000);
    a.send({ type: 'leave' });
    await v.wait(m => m.type === 'closed' && m.reason === 'no_players');
    const h = await (await fetch('http://127.0.0.1:' + PORT + '/health')).json();
    assert.equal(h.rooms, 0);
    ok.push('closeEmpty');

    console.log('online-check OK:', ok.join(', '));
    [a, v, c].forEach(x => x.ws.close());
  } catch (e) {
    console.error('online-check FAILED after [' + ok.join(', ') + ']:', e.message);
    process.exitCode = 1;
  } finally {
    srv.kill();
  }
})();
