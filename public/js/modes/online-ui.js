/* ===== modes/online-ui.js — 線上大廳、房間、對局（同盤搶點／同題競速）、觀戰 =====
 * 只有按「線上對戰」或打開邀請連結才連線；離開線上模式就關閉連線與背景工作。
 * 伺服器權威：用戶端只送點擊意圖。搶點先樂觀顯示，被別人搶走就還原並提示「差一點」。
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var R = root.Rules;
  var K, G, Net;
  var room = null;          // 最新房間快照
  var rooms = [];
  var online = null;
  var invite = null;        // 待確認的邀請 { room, token }
  var clockOffset = 0;      // 伺服器時間 − 本機時間
  var chatMsgs = [];
  var boardKey = '';        // 目前畫面上的盤面（局號＋局數＋種子）
  var board = null;         // 本局盤面（與伺服器同種子重建）
  var local = null;         // 競速：自己的本機進度
  var seq = 0;
  var shownRound = '';      // 已顯示的「本局結果」
  var shownMatch = 0;       // 已顯示總結算的場次
  var recorded = {};        // 已記錄戰績的場次
  var pending = {};         // 搶點：樂觀顯示中的格子
  var wantResult = false;   // 對局結束後是否還停在遊戲畫面看結算
  var started = false;

  function $(id) { return doc.getElementById(id); }
  function t(k, p) { return root.I18N.t(k, p); }
  function esc(s) { return K.esc(s); }
  function app() { return root.App; }
  function sNow() { return Date.now() + clockOffset; }
  function myName() { return root.Store.get('nickname') || ''; }
  function me() { return room && room.you; }
  function isHost() { return !!(room && room.you.host); }
  function isPlayer() { return !!(room && room.you.role === 'player'); }

  /** 暱稱可留空：用隨機可愛名 */
  function cuteName() {
    var a = t('cute.adj').split(','), b = t('cute.animal').split(',');
    return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)];
  }
  function nameForJoin() {
    var nm = $('lb-name') ? $('lb-name').value.trim() : myName();
    if (!nm) { nm = root.Store.get('autoName') || cuteName(); root.Store.set('autoName', nm); }
    return nm.slice(0, 16);
  }
  function saveName() { var el = $('lb-name'); if (el) root.Store.set('nickname', el.value.trim().slice(0, 16)); }

  /* ---------- 大廳聊天室（左下氣泡） ---------- */
  function initLobbyChat() {
    if (!root.LobbyChat || root.LobbyChatUI) return;
    var chat = root.LobbyChatUI = root.LobbyChat.create({
      game: 'schulte-table',
      mount: '#app',
      watch: '#scr-lobby',
      lang: function () { return root.I18N.lang === 'en' ? 'en' : root.I18N.lang === 'zh-Hans' ? 'zh-CN' : 'zh-TW'; },
      getName: function () { return nameForJoin(); },
      setName: function (n) { root.Store.set('nickname', n.slice(0, 16)); var nm = $('lb-name'); if (nm) nm.value = n.slice(0, 16); Net.send({ type: 'name', name: n }); },
      join: function (name) { Net.send({ type: 'lobbychat', op: 'join', name: name }); },
      leave: function () { Net.send({ type: 'lobbychat', op: 'leave' }); },
      send: function (text, name) { Net.send({ type: 'lobbychat', op: 'send', text: text, name: name }); },
      joinRoom: function (code) { saveName(); Net.send({ type: 'join', roomId: code, name: nameForJoin(), want: 'player' }); }
    });
    chat.setConnected(Net.status === 'open');
    Net.on('status', function () { chat.setConnected(Net.status === 'open'); });
    Net.on('lobbychat', function (m) {
      if (m.op === 'history') chat.history(m.history, m.online);
      else if (m.op === 'msg') chat.add(m.msg);
      else if (m.op === 'online') chat.online(m.online);
      else if (m.op === 'error') chat.error(m.code);
    });
    root.I18N.onChange(function () { if (chat.refresh) chat.refresh(); });
  }

  /* ---------- 進出 ---------- */
  function enterLobby(inv) {
    if (inv) invite = inv;
    if (!Net.enabled) { app().show('lobby'); return; }
    Net.connect(nameForJoin());
    app().show('lobby');
    if (Net.status === 'open') Net.send({ type: 'lobby' });
  }
  function exitLobby() {
    if (room) { back(); return; }
    Net.close();
    invite = null; rooms = []; online = null;
    app().show('home');
  }
  function inRoom() { return !!room; }
  function leaveRoom(toHome) {
    Net.send({ type: 'leave' });
    clearRoom();
    if (toHome) { Net.close(); app().show('home'); } else app().show('lobby');
  }
  function clearRoom() {
    if (root.GameBackend && root.GameBackend.forgetRoom) root.GameBackend.forgetRoom();
    room = null; chatMsgs = []; boardKey = ''; board = null; local = null; pending = {}; wantResult = false;
    root.GameView.close(); root.Result.hide();
    $('chatbox').hidden = true;
  }
  /** 返回鍵：房間 → 確認離開；遊戲中 → 確認放棄 */
  function back() {
    if (!room) { exitLobby(); return; }
    var scr = app().screen;
    if (scr === 'game' && (room.status === 'waiting' || !isPlayer()) && !(room.status !== 'waiting' && isPlayer())) {
      if (!isPlayer() && room.status !== 'waiting') { K.confirm(t('room.leaveTitle'), t('room.leaveSpec'), t('room.leaveOk'), function () { leaveRoom(false); }); return; }
      wantResult = false; root.Result.hide(); app().show('room'); return;
    }
    var playing = room.status !== 'waiting' && isPlayer();
    K.confirm(t('room.leaveTitle'), playing ? t('room.leavePlaying') : t('room.leaveText'), t('room.leaveOk'), function () { leaveRoom(false); }, playing);
  }

  /* ---------- 大廳 ---------- */
  function statusLine() {
    if (!Net.enabled) return '<div class="net-status bad">' + K.icon('cross') + '<span>' + esc(t('net.disabled')) + '</span></div>';
    var s = Net.status;
    if (s === 'open') return '<div class="net-status ok">' + K.icon('wifi') + '<span>' + esc(t('net.open')) + '</span>' +
      (online != null ? '<span class="online-count" aria-live="polite">' + K.icon('users') + '<span>' + esc(t('lobby.online', { n: online })) + '</span></span>' : '') + '</div>';
    if (s === 'failed') return '<div class="net-status bad">' + K.icon('cross') + '<span>' + esc(t('net.failed')) + '</span><button type="button" class="btn small" id="net-retry">' + K.icon('refresh') + '<span>' + esc(t('net.retry')) + '</span></button></div>';
    return '<div class="net-status wake">' + K.icon('wifi') + '<span>' + esc(s === 'retrying' ? t('net.retrying', { n: Net.statusN || 1 }) : t('net.connecting')) + '</span></div>';
  }
  function roomTitle(r) { return t('online.' + r.mode) + '・' + t('content.' + r.content) + '・' + t('tier.' + R.tier(r.tier).key) + '・' + t('order.' + r.order) + '・' + t('room.roundsN', { n: r.rounds }); }
  function roomRow(r) {
    var full = r.players >= r.cap, busy = r.status !== 'waiting';
    return '<li class="room-row"><span class="rr-ico">' + K.icon(r.mode === 'grab' ? 'hand' : 'bolt') + '</span>' +
      '<span class="rr-main"><b>' + esc(t('lobby.roomOf', { n: r.hostName || '—' })) + '</b><small>#' + esc(r.id) + '・' + esc(roomTitle(r)) + '</small></span>' +
      '<span class="rr-meta"><i>' + K.icon('users') + r.players + '/' + r.cap + '</i><i>' + K.icon('eye') + r.spectators + '</i><i class="st st-' + r.status + '">' + esc(t('rs.' + r.status)) + '</i></span>' +
      '<span class="rr-act"><button type="button" class="btn small primary" data-join="' + esc(r.id) + '"' + (full || busy ? ' disabled' : '') + '>' + esc(t('lobby.join')) + '</button>' +
      '<button type="button" class="btn small ghost" data-watch="' + esc(r.id) + '"' + (r.specFull ? ' disabled' : '') + '>' + K.icon('eye') + '<span>' + esc(t('lobby.watch')) + '</span></button></span></li>';
  }
  function renderLobby() {
    if (app().screen !== 'lobby') return;
    var ok = Net.enabled && Net.status === 'open';
    var focusId = doc.activeElement && doc.activeElement.id;
    var nameVal = $('lb-name') ? $('lb-name').value : myName();
    var html = '<div class="page lobby"><h1 class="page-title">' + K.icon('users') + '<span>' + esc(t('title.lobby')) + '</span></h1>' + statusLine() +
      '<section class="panel profile"><h2 class="box-title">' + K.icon('user') + esc(t('lobby.profile')) + '</h2>' +
      '<div class="field"><label class="f-label" for="lb-name">' + esc(t('lobby.name')) + '</label><div class="row-btns"><span class="input-wrap" style="flex:1 1 200px"><input id="lb-name" type="text" maxlength="16" autocomplete="nickname" value="' + esc(nameVal) + '" placeholder="' + esc(t('lobby.namePh')) + '"></span>' +
      '<button type="button" class="btn" id="lb-dice">' + K.icon('dice') + '<span>' + esc(t('lobby.randomName')) + '</span></button></div></div></section>';
    if (invite) {
      html += '<section class="panel invite-box" aria-live="polite"><h2 class="box-title">' + K.icon('link') + esc(t('lobby.invited', { id: invite.room })) + '</h2><p>' + esc(t('lobby.invitedSub')) + '</p>' +
        '<div class="row-btns"><button type="button" class="btn primary" id="inv-play"' + (ok ? '' : ' disabled') + '>' + K.icon('play') + '<span>' + esc(t('lobby.invPlay')) + '</span></button>' +
        '<button type="button" class="btn" id="inv-watch"' + (ok ? '' : ' disabled') + '>' + K.icon('eye') + '<span>' + esc(t('lobby.invWatch')) + '</span></button>' +
        '<button type="button" class="btn ghost" id="inv-cancel">' + esc(t('common.cancel')) + '</button></div></section>';
    }
    html += '<div class="lobby-actions">' +
      '<button type="button" class="big-btn b-solo" id="lb-quick"' + (ok ? '' : ' disabled') + '><span class="bb-ico">' + K.icon('bolt') + '</span><span class="bb-txt"><b>' + esc(t('lobby.quick')) + '</b><small>' + esc(t('lobby.quickSub')) + '</small></span></button>' +
      '<button type="button" class="big-btn b-online" id="lb-create"' + (ok ? '' : ' disabled') + '><span class="bb-ico">' + K.icon('plus') + '</span><span class="bb-txt"><b>' + esc(t('lobby.create')) + '</b><small>' + esc(t('lobby.createSub')) + '</small></span></button></div>' +
      '<section class="panel"><h2 class="box-title">' + K.icon('grid') + esc(t('lobby.rooms')) + '<button type="button" class="link-btn" id="lb-refresh"' + (ok ? '' : ' disabled') + ' style="margin-left:auto">' + K.icon('refresh') + esc(t('lobby.refresh')) + '</button></h2>' +
      (rooms.length ? '<ul class="room-list">' + rooms.map(roomRow).join('') + '</ul>' : '<p class="empty-note">' + esc(ok ? t('lobby.empty') : t('lobby.waitConn')) + '</p>') + '</section></div>';
    $('scr-lobby').innerHTML = html;
    var nm = $('lb-name');
    nm.addEventListener('change', function () { saveName(); Net.send({ type: 'name', name: nameForJoin() }); });
    if (focusId === 'lb-name') { nm.focus(); }
    $('lb-dice').onclick = function () { nm.value = cuteName(); saveName(); Net.send({ type: 'name', name: nm.value }); };
    if ($('net-retry')) $('net-retry').onclick = function () { Net.connect(nameForJoin()); renderLobby(); };
    $('lb-quick').onclick = function () { saveName(); Net.send({ type: 'quick', name: nameForJoin(), settings: lastSettings() }); };
    $('lb-create').onclick = function () { saveName(); Net.send({ type: 'create', name: nameForJoin(), settings: lastSettings() }); };
    $('lb-refresh').onclick = function () { Net.send({ type: 'lobby' }); };
    if (invite) {
      $('inv-play').onclick = function () { saveName(); Net.send({ type: 'join', roomId: invite.room, token: invite.token, name: nameForJoin(), want: 'player' }); };
      $('inv-watch').onclick = function () { saveName(); Net.send({ type: 'join', roomId: invite.room, token: invite.token, name: nameForJoin(), want: 'spectator' }); };
      $('inv-cancel').onclick = function () { invite = null; clearInviteUrl(); renderLobby(); };
    }
    $('scr-lobby').querySelector('.lobby').addEventListener('click', function (e) {
      var j = e.target.closest('[data-join]'), w = e.target.closest('[data-watch]');
      if (!j && !w) return;
      saveName();
      if (root.LobbyChatUI && root.LobbyChatUI.closeNarrow) root.LobbyChatUI.closeNarrow();
      Net.send({ type: 'join', roomId: (j || w).getAttribute(j ? 'data-join' : 'data-watch'), name: nameForJoin(), want: j ? 'player' : 'spectator' });
    });
    if (root.LobbyChatUI) root.LobbyChatUI.refresh();
  }
  function lastSettings() { return root.Store.get('roomSettings') || { mode: 'grab', content: 'number', tier: 1, order: 'asc', rounds: 3 }; }
  function clearInviteUrl() { try { var u = new URL(root.location.href); u.searchParams.delete('room'); u.searchParams.delete('invite'); u.searchParams.delete('backend'); root.history.replaceState(root.history.state, '', u.pathname + u.search + u.hash); } catch (e) { /* ignore */ } }

  /* ---------- 房間 ---------- */
  function seatRow(s, i) {
    if (!s) return '<li class="seat empty">' + K.badge(i) + '<span class="seat-name"><b>' + esc(t('room.emptySeat')) + '</b></span><span></span></li>';
    var tags = '';
    if (s.id === room.hostId) tags += '<span class="tag host">' + K.icon('crown') + esc(t('room.host')) + '</span>';
    else if (s.ready) tags += '<span class="tag ready">' + K.icon('check') + esc(t('room.ready')) + '</span>';
    if (!s.connected) tags += '<span class="tag off">' + esc(t('room.offline')) + '</span>';
    var kick = isHost() && s.id !== room.you.id ? '<button type="button" class="icon-btn small" data-kick="' + esc(s.id) + '" aria-label="' + esc(t('room.kickN', { n: s.name })) + '" title="' + esc(t('room.kick')) + '">' + K.icon('kick') + '</button>' : '';
    return '<li class="seat p' + i + '">' + K.badge(i) + '<span class="seat-name"><b>' + esc(s.name) + (s.id === room.you.id ? ' ' + esc(t('room.me')) : '') + '</b><small>' + esc(t('room.seatN', { n: i + 1 })) + '</small></span><span class="seat-tags">' + tags + kick + '</span></li>';
  }
  function settingsPanel() {
    var st = room.settings;
    if (!isHost() || room.status !== 'waiting') {
      return '<dl class="cfg-read">' + [
        [t('room.mode'), t('online.' + st.mode)], [t('setup.content'), t('content.' + st.content)], [t('setup.tier'), t('tier.' + R.tier(st.tier).key) + ' ' + R.tier(st.tier).size + '×' + R.tier(st.tier).size],
        [t('room.order'), t('order.' + st.order)], [t('room.rounds'), t('room.roundsN', { n: st.rounds })], [t('room.privacy'), st.isPrivate ? t('room.private') : t('room.public')]
      ].map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' + (isHost() ? '' : '<p class="hint-line">' + K.icon('info') + '<span>' + esc(t('room.hostSets')) + '</span></p>');
    }
    return '<div class="cfg-grid">' +
      '<div><span class="f-label">' + esc(t('room.mode')) + '</span>' + K.segHtml('cfg-mode', [{ value: 'grab', label: t('online.grab'), icon: 'hand' }, { value: 'race', label: t('online.race'), icon: 'bolt' }], st.mode, t('room.mode'), 'seg-tabs') + '<p class="hint-line">' + esc(t('room.modeSub.' + st.mode)) + '</p></div>' +
      '<div><span class="f-label">' + esc(t('setup.content')) + '</span>' + K.segHtml('cfg-content', R.CONTENTS.map(function (c) { return { value: c, label: t('content.' + c) }; }), st.content, t('setup.content'), 'seg-tabs') + '</div>' +
      '<div><span class="f-label">' + esc(t('setup.tier')) + '</span>' + K.segHtml('cfg-tier', R.tierIdsFor(st.content).map(function (id) { var tr = R.tier(id); return { value: id, label: t('tier.' + tr.key), sub: tr.size + '×' + tr.size }; }), st.tier, t('setup.tier'), 'seg-tiers') + '</div>' +
      '<div><span class="f-label">' + esc(t('room.order')) + '</span>' + K.segHtml('cfg-order', [{ value: 'asc', label: t('order.asc') }, { value: 'desc', label: t('order.desc') }], st.order, t('room.order'), 'seg-tabs') + '</div>' +
      '<div><span class="f-label">' + esc(t('room.rounds')) + '</span>' + K.segHtml('cfg-rounds', R.ROUNDS.map(function (n) { return { value: n, label: t('room.roundsN', { n: n }) }; }), st.rounds, t('room.rounds'), 'seg-tabs') + '</div>' +
      '<div class="set-row" style="border:0;padding:0"><div class="set-label"><b>' + esc(t('room.privateRoom')) + '</b><small>' + esc(t('room.privateSub')) + '</small></div>' + K.switchHtml('cfg-private', st.isPrivate, t('room.privateRoom')) + '</div></div>';
  }
  function invitePanel() {
    if (!room.invite) return '';
    var inv = room.invite, url = inviteUrl();
    var exp = new Date(inv.expiresAt).toLocaleString(root.I18N.lang === 'en' ? 'en-US' : root.I18N.lang, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return '<section class="panel invite-box"><h2 class="box-title">' + K.icon('link') + esc(t('room.invite')) + '</h2>' +
      (inv.revoked ? '<p class="hint-line">' + K.icon('cross') + '<span>' + esc(t('room.inviteRevoked')) + '</span></p>'
        : '<div class="inv-url"><code id="inv-url">' + esc(url) + '</code><button type="button" class="btn small primary" id="inv-copy">' + K.icon('copy') + '<span>' + esc(t('room.copy')) + '</span></button></div><p class="hint-line">' + K.icon('timer') + '<span>' + esc(t('room.inviteExp', { d: exp })) + '</span></p>') +
      '<div class="row-btns" style="margin-top:8px"><button type="button" class="btn small" id="inv-new">' + K.icon('refresh') + '<span>' + esc(t('room.inviteNew')) + '</span></button>' +
      (inv.revoked ? '' : '<button type="button" class="btn small ghost" id="inv-revoke">' + K.icon('cross') + '<span>' + esc(t('room.inviteRevoke')) + '</span></button>') + '</div></section>';
  }
  function inviteUrl() {
    if (!room || !room.invite) return '';
    var url = root.location.origin + root.location.pathname + '?room=' + room.id + '&invite=' + encodeURIComponent(room.invite.token);
    /* 主備後端：邀請連結釘選目前這台，朋友才會連到同一個房間 */
    try { if (root.GameBackend && root.GameBackend.pinInvite) url = root.GameBackend.pinInvite(url); } catch (e) { /* ignore */ }
    return url;
  }
  function chatPanel(id) {
    return '<section class="panel chatbox room-chat" aria-label="' + esc(t('chat.title')) + '"><h2 class="box-title">' + K.icon('chat') + esc(t('chat.title')) + '</h2>' +
      '<ul class="chat-list scroll" id="' + id + '-list" aria-live="polite"></ul><div class="chat-quick" id="' + id + '-quick"></div>' +
      '<form class="chat-form" id="' + id + '-form" autocomplete="off"><span class="input-wrap"><input id="' + id + '-input" type="text" maxlength="120" placeholder="' + esc(t('chat.ph')) + '" aria-label="' + esc(t('chat.ph')) + '"></span>' +
      '<button type="submit" class="btn small primary icon-only" aria-label="' + esc(t('chat.send')) + '">' + K.icon('send') + '</button></form></section>';
  }
  function renderRoom() {
    if (app().screen !== 'room' || !room) return;
    var r = room, n = r.seats.filter(Boolean).length;
    var mySeat = r.seats[r.you.seat];
    var others = r.seats.filter(function (s) { return s && s.id !== r.hostId; });
    var allReady = others.length > 0 && others.every(function (s) { return s.ready; });
    var focusId = doc.activeElement && doc.activeElement.id;
    var acts = '';
    if (r.status !== 'waiting') acts += '<button type="button" class="btn primary" id="rm-togame">' + K.icon('play') + '<span>' + esc(t('room.toGame')) + '</span></button>';
    else if (isPlayer()) {
      if (isHost()) acts += '<button type="button" class="btn primary big" id="rm-start"' + (n >= 2 && allReady ? '' : ' disabled') + '>' + K.icon('play') + '<span>' + esc(t('room.start')) + '</span></button>';
      else acts += '<button type="button" class="btn ' + (mySeat.ready ? '' : 'primary') + ' big" id="rm-ready">' + K.icon(mySeat.ready ? 'cross' : 'check') + '<span>' + esc(mySeat.ready ? t('room.unready') : t('room.readyBtn')) + '</span></button>';
      acts += '<button type="button" class="btn" id="rm-stand">' + K.icon('eye') + '<span>' + esc(t('room.toSpec')) + '</span></button>';
    } else if (r.seats.some(function (s) { return !s; })) acts += '<button type="button" class="btn primary" id="rm-sit">' + K.icon('user') + '<span>' + esc(t('room.sit')) + '</span></button>';
    if (r.match && r.match.standing) acts += '<button type="button" class="btn" id="rm-last">' + K.icon('trophy') + '<span>' + esc(t('room.lastResult')) + '</span></button>';
    acts += '<button type="button" class="btn ghost" id="rm-leave">' + K.icon('door') + '<span>' + esc(t('room.leave')) + '</span></button>';
    var hint = r.status === 'waiting' ? (isHost() ? (n < 2 ? t('room.needPlayers') : allReady ? t('room.canStart') : t('room.waitReady')) : isPlayer() ? (mySeat.ready ? t('room.waitHost') : t('room.pressReady')) : t('room.specWait')) : t('room.inProgress');
    $('scr-room').innerHTML = '<div class="page room-page"><h1 class="page-title">' + K.icon(r.settings.mode === 'grab' ? 'hand' : 'bolt') + '<span>' + esc(t('online.' + r.settings.mode)) + '</span></h1>' +
      '<div class="room-head"><span>' + esc(t('room.code')) + '</span><b class="room-code">' + esc(r.id) + '</b><span class="tag">' + esc(r.settings.isPrivate ? t('room.private') : t('room.public')) + '</span><span class="tag">' + esc(t('rs.' + (r.status === 'waiting' ? 'waiting' : 'playing'))) + '</span>' + (Net.status !== 'open' ? '<span class="tag off">' + esc(t('net.reconnecting')) + '</span>' : '') + '</div>' +
      '<div class="room-actions">' + acts + '</div><p class="hint-line" style="justify-content:center;color:var(--on-bg-muted)">' + K.icon('info') + '<span>' + esc(hint) + '</span></p>' +
      '<div class="room-grid"><div><section class="panel"><h2 class="box-title">' + K.icon('users') + esc(t('room.players', { n: n, m: r.maxPlayers })) + '</h2><ul class="seat-list">' + r.seats.map(seatRow).join('') + '</ul>' +
      '<p class="spec-line">' + K.icon('eye') + '<span>' + esc(t('room.specs', { n: r.specs.length, m: r.specMax })) + (r.specs.length ? '：' + r.specs.map(function (s) { return s.name; }).join('、') : '') + '</span>' +
      (isHost() ? r.specs.map(function (s) { return '<button type="button" class="link-btn" data-kick="' + esc(s.id) + '" aria-label="' + esc(t('room.kickN', { n: s.name })) + '">' + K.icon('kick') + esc(s.name) + '</button>'; }).join('') : '') + '</p></section>' +
      chatPanel('rc') + '</div><div><section class="panel"><h2 class="box-title">' + K.icon('gear') + esc(t('room.settings')) + '</h2>' + settingsPanel() + '</section>' + invitePanel() + '</div></div></div>';
    bindRoom();
    renderChat();
    if (focusId && $(focusId)) try { $(focusId).focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function bindRoom() {
    var on = function (id, fn) { var el = $(id); if (el) el.onclick = fn; };
    on('rm-start', function () { Net.send({ type: 'start' }); });
    on('rm-ready', function () { Net.send({ type: 'ready', value: !room.seats[room.you.seat].ready }); });
    on('rm-stand', function () { Net.send({ type: 'stand' }); });
    on('rm-sit', function () { Net.send({ type: 'sit' }); });
    on('rm-leave', function () { back(); });
    on('rm-togame', function () { syncGame(true); });
    on('rm-last', function () { showMatchResult(true); });
    on('inv-copy', copyInvite);
    on('inv-new', function () { Net.send({ type: 'invite_new' }); });
    on('inv-revoke', function () { Net.send({ type: 'invite_revoke' }); });
    $('scr-room').querySelectorAll('[data-kick]').forEach(function (b) {
      b.onclick = function () { var id = b.getAttribute('data-kick'); var who = (room.seats.filter(Boolean).concat(room.specs)).filter(function (s) { return s.id === id; })[0]; K.confirm(t('room.kick'), t('room.kickConfirm', { n: who ? who.name : '' }), t('room.kick'), function () { Net.send({ type: 'kick', target: id }); }, true); };
    });
    var sendCfg = function (patch) { var st = Object.assign({}, room.settings, patch); root.Store.set('roomSettings', st); Net.send({ type: 'settings', settings: st }); };
    K.bindSeg($('cfg-mode'), function (v) { sendCfg({ mode: v }); });
    K.bindSeg($('cfg-content'), function (v) { var tier = room.settings.tier; if (!R.allowed(v, tier)) tier = R.tierIdsFor(v).slice(-1)[0]; sendCfg({ content: v, tier: tier }); });
    K.bindSeg($('cfg-tier'), function (v) { sendCfg({ tier: Number(v) }); });
    K.bindSeg($('cfg-order'), function (v) { sendCfg({ order: v }); });
    K.bindSeg($('cfg-rounds'), function (v) { sendCfg({ rounds: Number(v) }); });
    K.bindSwitch($('cfg-private'), function (v) { sendCfg({ isPrivate: v }); });
    bindChat('rc');
  }
  function copyInvite() {
    var url = inviteUrl();
    var done = function () { K.toast(t('room.copied'), 'good'); };
    try {
      if (root.navigator.clipboard && root.isSecureContext) { root.navigator.clipboard.writeText(url).then(done, fallback); return; }
    } catch (e) { /* ignore */ }
    fallback();
    function fallback() {
      var sel = root.getSelection(), code = $('inv-url');
      if (!code) return;
      var range = doc.createRange(); range.selectNodeContents(code); sel.removeAllRanges(); sel.addRange(range);
      try { if (doc.execCommand('copy')) { done(); return; } } catch (e) { /* ignore */ }
      K.toast(t('room.copyManual'));
    }
  }

  /* ---------- 房間聊天（房間頁與遊戲側欄共用） ---------- */
  function chatLine(m) {
    var who = m.seat >= 0 ? K.badge(m.seat) : K.icon('eye');
    return '<li>' + who + ' <b class="cn">' + esc(m.name) + '</b>' + (m.role === 'spectator' ? '<span class="spec-tag">' + esc(t('chat.spec')) + '</span> ' : '') + '<span>' + esc(m.text) + '</span></li>';
  }
  function renderChat() {
    ['rc-list', 'chat-list'].forEach(function (id) {
      var el = $(id); if (!el) return;
      var atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
      el.innerHTML = chatMsgs.length ? chatMsgs.map(chatLine).join('') : '<li class="sys">' + esc(t('chat.empty')) + '</li>';
      if (atBottom || true) el.scrollTop = el.scrollHeight;
    });
    ['rc-quick', 'chat-quick'].forEach(function (id) {
      var el = $(id); if (!el || el.dataset.lang === root.I18N.lang) return;
      el.dataset.lang = root.I18N.lang;
      el.innerHTML = t('chat.phrases').split('|').map(function (p) { return '<button type="button" data-q="' + esc(p) + '">' + esc(p) + '</button>'; }).join('');
    });
  }
  function bindChat(prefix) {
    var form = $(prefix + '-form'), input = $(prefix + '-input'), quick = $(prefix + '-quick');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value.trim(); if (!v) return; Net.send({ type: 'chat', text: v }); input.value = ''; });
    quick.addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (b) Net.send({ type: 'chat', text: b.getAttribute('data-q') }); });
  }

  /* ---------- 對局畫面 ---------- */
  function specOf() { return room.match && room.match.spec; }
  function keyOf() { var m = room.match; return m && m.spec ? m.no + ':' + m.round + ':' + m.spec.seed : ''; }
  function playersView() {
    var m = room.match;
    return m.players.map(function (p) { var s = room.seats[p.seat]; return { id: p.id, seat: p.seat, name: p.name, score: p.score, combo: p.combo, step: p.step, finished: p.finished, me: p.id === room.you.id, connected: !p.left && !!(s && s.id === p.id && s.connected), left: p.left, out: p.out, total: p.points }; });
  }
  /** 依房間快照決定要不要進遊戲畫面、要不要重建盤面 */
  function syncGame(force) {
    var m = room.match;
    if (!m || !m.spec) return;
    var live = room.status === 'playing' || room.status === 'roundEnd';
    if (!live && !wantResult && !force) return;
    var key = keyOf();
    if (app().screen !== 'game') app().show('game', { title: t('online.' + m.mode), sub: subTitle() });
    var scr = $('scr-game');
    scr.classList.toggle('race-watch', m.mode === 'race' && !isPlayer());
    if (key !== boardKey) {
      boardKey = key;
      pending = {};
      board = R.makeBoard(m.spec);
      var spectator = !isPlayer() || m.players.every(function (p) { return p.id !== room.you.id; });
      local = null;
      if (m.mode === 'race' && !spectator) {
        local = R.createGame(board, 'solo', ['me']);
        R.start(local, 0);
        (m.myDone || []).forEach(function (d) { if (d) local.players.me.step++; });
        local.done.me = (m.myDone || []).slice();
      }
      root.GameView.open({ kind: m.mode, board: board, spectator: spectator, onTap: onTap, done: local ? local.done.me : null, owners: m.mode === 'grab' ? m.owner : null });
      $('chatbox').hidden = false;
      bindChat('chat');
      renderChat();
      shownRound = '';
      if (room.status === 'playing') {
        var localStart = m.startAt - clockOffset;
        var lock = function (v) { root.GameView.board.lock(v || spectator); };
        if (localStart > Date.now()) { lock(true); root.GameView.countdown(localStart, function () { lock(false); root.GameView.board.focus(); }); }
        else lock(false);
        root.GameView.startClock(function () { return Math.max(0, sNow() - m.startAt); });
        if (root.GameAnalytics) root.GameAnalytics.start({ mode: 'online', players: m.players.length, variant: m.mode, content_type: m.spec.content, spectator: spectator }, 'm' + m.no);
      }
    }
    refreshHud();
    summary();
    app().setTitle(t('online.' + m.mode) + '・' + t('room.roundOf', { a: Math.max(1, m.round), b: m.total }), subTitle());
    if (room.status === 'roundEnd') roundOverlay();
    else root.Result.hideRound();
    if (room.status === 'waiting' && m.standing) showMatchResult(false);
  }
  function subTitle() { var s = specOf(); return s ? t('content.' + s.content) + '・' + s.size + '×' + s.size + '・' + t('order.' + s.order) : ''; }
  function myPlayer() { var m = room.match; return m && m.players.filter(function (p) { return p.id === room.you.id; })[0]; }

  function refreshHud() {
    var m = room.match; if (!m || !board) return;
    var G2 = root.GameView, list = playersView();
    if (m.mode === 'grab') {
      G2.setProgress(m.step || 0, board.n);
      var nx = (m.step || 0) < board.n ? R.targetValue(board, m.step || 0) : null;
      G2.setNext(nx, nx != null ? board.shapes[R.cellOfStep(board, m.step || 0)] : 0);
      G2.setScores(list.slice().sort(function (a, b) { return b.score - a.score; }));
    } else {
      var mine = local ? local.players.me.step : 0;
      G2.setProgress(local ? mine : Math.max.apply(null, list.map(function (p) { return p.step; }).concat([0])), board.n);
      if (local) { var nv = mine < board.n ? R.targetValue(board, mine) : null; G2.setNext(nv, nv != null ? board.shapes[R.cellOfStep(board, mine)] : 0); }
      G2.setRace(list.map(function (p) { return { seat: p.seat, name: p.name, done: p.id === room.you.id && local ? local.players.me.step : p.step, n: board.n, me: p.me, finished: p.finished }; }));
    }
    if (room.status !== 'playing') G2.stopClock();
  }
  function summary() {
    var m = room.match; if (!m) return;
    var html = '<dl class="sum-list">' + [
      [t('room.code'), room.id], [t('room.mode'), t('online.' + m.mode)], [t('room.round'), Math.max(1, m.round) + '/' + m.total],
      [t('sum.content'), t('content.' + m.spec.content)], [t('sum.tier'), R.tier(R.TIERS.filter(function (x) { return x.size === m.spec.size; })[0].id) ? t('tier.' + R.TIERS.filter(function (x) { return x.size === m.spec.size; })[0].key) + ' ' + m.spec.size + '×' + m.spec.size : ''],
      [t('sum.order'), t('order.' + m.spec.order)]
    ].map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<ul class="sum-players">' + playersView().map(function (p) { return '<li>' + K.badge(p.seat) + '<span class="sp-name">' + esc(p.name) + (p.me ? ' ' + esc(t('room.me')) : '') + (p.left ? '（' + esc(t('room.leftShort')) + '）' : '') + '</span><b>' + esc(t('room.pts', { n: p.total })) + '</b></li>'; }).join('') + '</ul>' +
      (m.mode === 'grab' ? '<p class="sum-tip">' + K.icon('bolt') + '<span>' + esc(t('sum.comboTip')) + '</span></p>' : '<p class="sum-tip">' + K.icon('info') + '<span>' + esc(t('sum.raceTip')) + '</span></p>');
    $('summary').innerHTML = html;
    root.GameView.setFoot('<span>' + esc(t('room.round')) + ' <b>' + Math.max(1, m.round) + '/' + m.total + '</b></span><span>' + esc(t('room.code')) + ' <b>' + esc(room.id) + '</b></span>');
  }

  function onTap(idx) {
    if (!room || !board || room.status !== 'playing' || !isPlayer()) return;
    var m = room.match;
    if (sNow() < m.startAt) return;
    var B = root.GameView.board;
    if (B.isDone(idx) || pending[idx]) return;
    if (m.mode === 'grab') {
      var want = R.cellOfStep(board, m.step || 0);
      if (idx !== want) { B.wrong(idx); root.Sound.play('wrong'); root.Sound.vibrate(30); return; }
      pending[idx] = true;
      B.pending(idx);
      root.Sound.play('tap', m.step || 0);
      Net.send({ type: 'tap', idx: idx, seq: ++seq });
      return;
    }
    if (!local) return;
    var r = R.tap(local, 'me', idx, 1);
    if (!r.ok) return;
    if (!r.hit) { B.wrong(idx); root.Sound.play('wrong'); root.Sound.vibrate(30); return; }
    B.setDone(idx, null, true);
    root.Sound.play('tap', r.step);
    Net.send({ type: 'tap', idx: idx, seq: ++seq });
    if (r.finished) { root.Sound.play('done'); B.lock(true); }
    refreshHud();
  }

  /** 搶點：伺服器裁定的結果 */
  function onGrab(e) {
    if (!room || !room.match || !board) return;
    var m = room.match;
    m.step = e.step;
    if (m.owner) m.owner[e.idx] = e.seat;
    m.players.forEach(function (p) {
      if (p.id === e.by) { p.score = e.score; p.combo = e.combo; }
      else (e.reset || []).forEach(function (r) { if (r[0] === p.seat) p.combo = r[1]; });
    });
    var B = root.GameView.board;
    var mine = e.by === room.you.id;
    if (pending[e.idx] && !mine) { delete pending[e.idx]; almost(); }
    delete pending[e.idx];
    B.setDone(e.idx, e.seat, true);
    if (!mine && !isPlayer()) root.Sound.play('tap', e.step);
    if (mine && e.combo >= 3 && e.combo % 3 === 0) root.GameView.flash(t('online.comboN', { n: e.combo }), 'good');
    refreshHud();
  }
  function almost() { root.Sound.play('wrong'); root.GameView.flash(t('online.almost'), 'bad'); }
  function onAck(a) {
    if (!room || !room.match || !board) return;
    var B = root.GameView.board;
    if (room.match.mode === 'grab') {
      if (!a.hit && pending[a.idx]) { delete pending[a.idx]; B.unpending(a.idx); if (a.late) almost(); }
      return;
    }
    if (a.ok && a.hit === false && B.isDone(a.idx)) { boardKey = ''; Net.send({ type: 'lobby' }); }   // 不同步：重建盤面
  }
  function onProgress(e) {
    if (!room || !room.match) return;
    room.match.players.forEach(function (p) { if (p.id === e.by) { p.step = e.step; p.finished = !!e.finished; } });
    refreshHud();
  }

  /* ---------- 本局結果、總結算 ---------- */
  function nameOf(id) { var p = room.match.players.filter(function (x) { return x.id === id; })[0]; return p || { name: '?', seat: 0 }; }
  function infoOf(mode, e) {
    if (mode === 'grab') return t('online.ptsScore', { p: e.points, s: e.score });
    if (e.finished || e.time != null) return t('online.ptsTime', { p: e.points, t: K.fmtTime(e.time) });
    return t('online.ptsStep', { p: e.points, s: e.step });
  }
  function roundOverlay() {
    var m = room.match, last = m.rounds[m.rounds.length - 1];
    if (!last) return;
    var k = m.no + ':' + m.rounds.length;
    if (shownRound === k) return;
    shownRound = k;
    root.GameView.stopClock();
    root.GameView.board.lock(true);
    root.Result.round({
      title: t('online.roundResult', { n: m.rounds.length, m: m.total }),
      ranking: last.map(function (e) { var p = nameOf(e.id); return { rank: e.rank, seat: p.seat, name: p.name, info: infoOf(m.mode, e), me: e.id === room.you.id }; }),
      nextAt: m.nextAt - clockOffset, now: Date.now, onNext: isHost() ? function () { Net.send({ type: 'next' }); } : null
    });
  }
  function showMatchResult(force) {
    var m = room && room.match;
    if (!m || !m.standing) return;
    if (!force && shownMatch === m.no) return;
    shownMatch = m.no;
    root.Result.hideRound();
    var meS = m.standing.filter(function (s) { return s.id === room.you.id; })[0];
    if (meS && !recorded[m.no]) {
      recorded[m.no] = true;
      root.Store.saveOnline(m.mode, meS.rank === 1);
      if (root.GameAnalytics) root.GameAnalytics.end({ result: meS.rank === 1 ? 'win' : 'lose' }, 'm' + m.no);
    }
    if (app().screen !== 'game') { wantResult = true; boardKey = ''; syncGame(true); }
    root.GameView.stopClock();
    root.GameView.board.lock(true);
    root.Sound.play('done');
    function build() {
      var champ = m.standing[0];
      return {
        tone: meS && meS.rank === 1 ? 'win' : 'good',
        title: meS ? (meS.rank === 1 ? t('online.youWin') : t('online.youPlace', { n: meS.rank })) : t('online.matchOver'),
        sub: t('online.' + m.mode) + '・' + t('room.roundsN', { n: m.total }) + '・' + t('online.winner', { n: champ.name }),
        lines: meS ? [[t('online.totalPts'), String(meS.points)], m.mode === 'grab' ? [t('online.totalScore'), String(meS.score)] : [t('online.bestTime'), meS.bestTime != null ? K.fmtTime(meS.bestTime) : '—']] : [],
        ranking: m.standing.map(function (s) { return { rank: s.rank, seat: s.seat, name: s.name + (s.left ? '（' + t('room.leftShort') + '）' : ''), me: s.id === room.you.id, info: m.mode === 'grab' ? t('online.ptsScore', { p: s.points, s: s.score }) : t('online.ptsTotalTime', { p: s.points, t: K.fmtTime(s.time) }) }; }),
        again: isPlayer() ? { label: t('res.again'), onClick: function () { wantResult = false; root.Result.hide(); if (!isHost()) Net.send({ type: 'ready', value: true }); app().show('room'); } } : null,
        back: { label: t('res.room'), icon: 'users', onClick: function () { wantResult = false; root.Result.hide(); app().show('room'); } },
        home: { onClick: function () { leaveRoom(true); } }
      };
    }
    root.Result.show(build(), build);
    app().updateTop();
  }

  /* ---------- 伺服器訊息 ---------- */
  function onRoom(m) {
    var r = m.room;
    clockOffset = r.serverNow - Date.now() + (Net.rtt ? Net.rtt / 2 : 0);
    var first = !room;
    var prevStatus = room && room.status;
    room = r;
    chatMsgs = r.chat.slice();
    if (first) { if (root.GameBackend && root.GameBackend.rememberRoom) root.GameBackend.rememberRoom(); invite = null; clearInviteUrl(); if (root.LobbyChatUI && root.LobbyChatUI.closeNarrow) root.LobbyChatUI.closeNarrow(); }
    var live = r.status === 'playing' || r.status === 'roundEnd';
    if (live) { wantResult = false; syncGame(false); }
    else if (prevStatus && prevStatus !== 'waiting' && r.match && r.match.standing) { wantResult = true; syncGame(true); }
    else if (app().screen === 'game' && wantResult) { refreshHud(); summary(); }
    else if (app().screen !== 'room') { boardKey = ''; app().show('room'); }
    if (app().screen === 'room') renderRoom();
    renderChat();
  }
  function onClosed(m) {
    var was = room;
    clearRoom();
    if (!was) return;
    K.toast(t('closed.' + (m.reason || 'no_players')), 'bad', 3500);
    app().show('lobby');
    Net.send({ type: 'lobby' });
  }

  function init() {
    K = root.Kit; G = root.GameView; Net = root.Net;
    Net.on('welcome', function (m) { if (m.serverNow) clockOffset = m.serverNow - Date.now(); });
    Net.on('status', function () {
      if (app().screen === 'lobby') renderLobby();
      if (app().screen === 'room') renderRoom();
      if (Net.status === 'retrying' && room) K.toast(t('net.lost'), 'bad');
    });
    Net.on('lobby', function (m) { rooms = m.rooms || []; online = m.online; if (!room && app().screen === 'lobby') renderLobby(); });
    Net.on('room', onRoom);
    Net.on('closed', onClosed);
    Net.on('left', function () { /* 已在 leaveRoom 處理 */ });
    Net.on('grab', onGrab);
    Net.on('ack', onAck);
    Net.on('progress', onProgress);
    Net.on('chat', function (m) { chatMsgs.push(m.msg); if (chatMsgs.length > 60) chatMsgs.shift(); renderChat(); if ($('app').getAttribute('data-side') !== 'open' && app().screen === 'game' && m.msg.id !== (room && room.you.id)) { var b = $('side-badge'); b.hidden = false; b.textContent = String((Number(b.textContent) || 0) + 1); } });
    Net.on('toast', function (m) { K.toast(t('toast.' + m.code, m.params), /idle|dc|kick|left/.test(m.code) ? 'bad' : '', 2600); });
    Net.on('error', function (m) { K.toast(t('err.' + m.code), 'bad', 3000); if (/^(invite_|room_missing|room_private)/.test(m.code) && invite) { invite = null; clearInviteUrl(); renderLobby(); } });
    Net.on('matchEnd', function () { wantResult = true; });
    $('btn-side').addEventListener('click', function () { var b = $('side-badge'); b.hidden = true; b.textContent = '0'; });
    initLobbyChat();
    started = true;
  }
  function relang() {
    if (!room || !room.match || app().screen !== 'game') return;
    summary(); refreshHud();
    app().setTitle(t('online.' + room.match.mode) + '・' + t('room.roundOf', { a: Math.max(1, room.match.round), b: room.match.total }), subTitle());
    renderChat();
  }

  root.OnlineUI = {
    init: init, enterLobby: enterLobby, exitLobby: exitLobby, inRoom: inRoom, back: back, renderLobby: renderLobby, renderRoom: renderRoom, relang: relang,
    get room() { return room; },
    /* 測試用：點下一個正確格子 */
    _tapNext: function () {
      if (!room || !room.match || !board) return;
      var m = room.match;
      var idx = m.mode === 'grab' ? R.cellOfStep(board, m.step || 0) : local ? R.cellOfStep(board, local.players.me.step) : -1;
      if (idx >= 0) { if (m.mode === 'grab') { pending = {}; } onTap(idx); }
    }
  };
})(typeof self !== 'undefined' ? self : this);
