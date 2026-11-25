/* ===== app.js — 畫面切換、頂列、首頁、模式選擇、設定 Modal、我的紀錄、怎麼玩 =====
 * 「回遊戲大廳」只放首頁左上角；首頁按上一頁也回遊戲大廳。
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var R = root.Rules;
  var K, Store;
  var SCREENS = ['home', 'solo', 'setup', 'levels', 'daily', 'records', 'help', 'lobby', 'room', 'game'];
  var screen = 'boot';
  var setup = { mode: 'classic', content: 'number', tier: 1 };
  var recTab = 'number';
  var title = { main: '', sub: '' };

  function $(id) { return doc.getElementById(id); }
  function t(k, p) { return root.I18N.t(k, p); }
  function esc(s) { return K.esc(s); }

  /* ---------- 畫面切換 ---------- */
  function show(name, opt) {
    opt = opt || {};
    if (SCREENS.indexOf(name) < 0) name = 'home';
    var prev = screen;
    screen = name;
    $('app').setAttribute('data-screen', name);
    SCREENS.forEach(function (s) { var el = $('scr-' + s); if (el) el.hidden = s !== name; });
    if (name !== 'game') { root.Result.hide(); closeSide(); if (root.Solo.active()) root.Solo.stop(); }
    if (name === 'game') { title.main = opt.title || ''; title.sub = opt.sub || ''; }
    var r = RENDER[name]; if (r) r();
    updateTop();
    root.Sound.startBgm();
    if (root.ServerOutage) root.ServerOutage.setScreen(name === 'lobby' || name === 'room' ? name : (name === 'game' && root.OnlineUI && root.OnlineUI.inRoom() ? 'room' : name));
    if (root.GameAnalytics) root.GameAnalytics.pageView(name);
    if (!opt.fromPop && prev !== name) { try { root.history.pushState({ s: name }, ''); } catch (e) { /* ignore */ } }
    var main = $('scr-' + name);
    if (main && main.scrollTop) main.scrollTop = 0;
    if (opt.focus !== false && name !== 'game') {
      var h = main && main.querySelector('h1, h2');
      if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
  }
  function setTitle(main, sub) { title.main = main; title.sub = sub || ''; updateTop(); }

  function updateTop() {
    var home = screen === 'home';
    var lobbyUrl = root.LobbyLink && root.LobbyLink.url;
    var lb = $('btn-lobby');
    lb.hidden = !(home && lobbyUrl);
    if (lobbyUrl) lb.href = lobbyUrl;
    $('btn-back').hidden = home;
    var inGame = screen === 'game';
    $('btn-side').hidden = !inGame;
    var soloPlay = inGame && root.Solo.active() && !root.Result.visible();
    $('btn-pause').hidden = !soloPlay;
    var tt = $('top-title');
    if (home) tt.innerHTML = '';
    else if (inGame) tt.innerHTML = '<b>' + esc(title.main) + '</b>' + (title.sub ? '<small>' + esc(title.sub) + '</small>' : '');
    else tt.innerHTML = '<b>' + esc(t('title.' + screen)) + '</b>';
  }

  function goBack() {
    if (K.topModal()) { K.topModal().close('back'); return; }
    if ($('app').getAttribute('data-side') === 'open') { closeSide(); return; }
    switch (screen) {
      case 'game':
        if (root.OnlineUI && root.OnlineUI.inRoom()) { root.OnlineUI.back(); return; }
        if (root.Solo.playing()) {
          root.Solo.pause();
          /* 抽籤動畫階段無法暫停（pause 會直接略過），此時不能吞掉上一頁，要往下直接離開 */
          if (root.GameView.paused()) return;
        }
        /* 暫停中再按上一頁：直接離開回上一層（繼續請按暫停選單的「繼續」，resume 會重新倒數，看起來像重新開始） */
        var cur = root.Solo.current;
        var to = cur && cur.spec.mode === 'level' ? 'levels' : cur && cur.spec.mode === 'daily' ? 'daily' : 'solo';
        show(to); return;
      case 'setup': show('solo'); return;
      case 'levels': case 'daily': show('solo'); return;
      case 'lobby': root.OnlineUI.exitLobby(); return;
      case 'room': root.OnlineUI.back(); return;
      default: show('home');
    }
  }
  function onPop(e) {
    var st = e.state && e.state.s;
    if (screen === 'home' || st === 'root') {
      if (K.topModal()) { K.topModal().close('back'); try { root.history.pushState({ s: 'home' }, ''); } catch (er) { /* ignore */ } return; }
      if (root.LobbyLink && root.LobbyLink.url) { root.location.href = root.LobbyLink.url; return; }
      try { root.history.pushState({ s: 'home' }, ''); } catch (er) { /* ignore */ }
      if (screen !== 'home') show('home', { fromPop: true });
      return;
    }
    try { root.history.pushState({ s: screen }, ''); } catch (er) { /* ignore */ }
    goBack();
  }

  /* ---------- 側欄（窄版抽屜） ---------- */
  function openSide() { $('app').setAttribute('data-side', 'open'); $('btn-side').setAttribute('aria-expanded', 'true'); $('side-backdrop').hidden = false; setTimeout(function () { $('side-close').focus(); }, 30); }
  function closeSide() {
    if ($('app').getAttribute('data-side') !== 'open') return;
    $('app').setAttribute('data-side', 'closed'); $('btn-side').setAttribute('aria-expanded', 'false'); $('side-backdrop').hidden = true;
    var b = $('btn-side'); if (b && !b.hidden && screen === 'game') try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }

  /* ---------- 首頁 ---------- */
  function heroBoard() {
    var b = R.makeBoard({ size: 3, content: 'number', seed: 'hero', chaos: 0 });
    var html = '<div class="hero-board board s3 ct-number" aria-hidden="true" style="--n:3">';
    for (var r = 0; r < 3; r++) {
      html += '<div class="row">';
      for (var c = 0; c < 3; c++) {
        var i = r * 3 + c, v = b.cells[i];
        html += '<span class="cell' + (v < 3 ? ' done' : '') + (v === 3 ? ' hint-soft' : '') + '"><span class="cell-face">' + root.Art.cell('number', v, 0) + '</span></span>';
      }
      html += '</div>';
    }
    return html + '</div>';
  }
  function renderHome() {
    var st = Store.stats();
    $('scr-home').innerHTML = '<div class="page home">' +
      '<div class="hero">' + heroBoard() + '<div class="hero-text"><h1 class="game-title">' + esc(t('home.title')) + '</h1><p class="tagline">' + esc(t('home.tagline')) + '</p></div></div>' +
      '<nav class="home-menu" aria-label="' + esc(t('home.menu')) + '">' +
      bigBtn('home-solo', 'b-solo', 'play', t('home.solo'), t('home.soloSub')) +
      bigBtn('home-online', 'b-online', 'users', t('home.online'), t('home.onlineSub')) +
      bigBtn('home-records', 'b-rec', 'chart', t('home.records'), t('home.recordsSub', { n: (st.soloGames || 0) })) +
      bigBtn('home-help', 'b-help', 'book', t('home.help'), t('home.helpSub')) +
      '</nav></div>';
    $('home-solo').onclick = function () { show('solo'); };
    $('home-online').onclick = function () { root.OnlineUI.enterLobby(); };
    $('home-records').onclick = function () { show('records'); };
    $('home-help').onclick = function () { show('help'); };
  }
  function bigBtn(id, cls, ico, label, sub) {
    return '<button type="button" class="big-btn ' + cls + '" id="' + id + '"><span class="bb-ico">' + K.icon(ico) + '</span><span class="bb-txt"><b>' + esc(label) + '</b><small>' + esc(sub) + '</small></span></button>';
  }

  /* ---------- 單機模式選擇 ---------- */
  function renderSolo() {
    var today = R.taipeiDate(), dd = Store.daily()[today] || {};
    var modes = [
      ['classic', 'timer', t('solo.classicSub')],
      ['reverse', 'reverse', t('solo.reverseSub')],
      ['random', 'dice', t('solo.randomSub')],
      ['level', 'flag', t('solo.levelSub', { s: Store.totalStars(), n: Store.unlockedLevel() })],
      ['daily', 'calendar', t('solo.dailySub', { n: Object.keys(dd).length })]
    ];
    $('scr-solo').innerHTML = '<div class="page"><h1 class="page-title">' + esc(t('title.solo')) + '</h1><div class="mode-grid">' +
      modes.map(function (m) { return '<button type="button" class="mode-card m-' + m[0] + '" data-mode="' + m[0] + '"><span class="mc-ico">' + K.icon(m[1]) + '</span><b>' + esc(t('mode.' + m[0])) + '</b><small>' + esc(m[2]) + '</small></button>'; }).join('') +
      '</div></div>';
    $('scr-solo').querySelector('.mode-grid').onclick = function (e) {
      var b = e.target.closest('[data-mode]'); if (!b) return;
      var m = b.getAttribute('data-mode');
      if (m === 'level') show('levels'); else if (m === 'daily') show('daily'); else openSetup(m);
    };
  }

  /* ---------- 內容與難度選擇 ---------- */
  function openSetup(mode) {
    var last = Store.get('setup') || {};
    setup.mode = mode;
    if (R.isContent(last.content)) setup.content = last.content;
    if (R.tier(last.tier)) setup.tier = last.tier;
    show('setup');
  }
  function contentOpts() {
    return R.CONTENTS.map(function (c) { return { value: c, label: t('content.' + c), html: '<span class="seg-art">' + root.Art.token(c, c === 'icon' ? 2 : 0, 4) + '</span>' }; });
  }
  function tierOpts(content) {
    var ids = content ? R.tierIdsFor(content) : [0, 1, 2, 3, 4];
    return ids.map(function (id) { var tr = R.tier(id); return { value: id, label: t('tier.' + tr.key), sub: tr.size + '×' + tr.size }; });
  }
  function renderSetup() {
    var random = setup.mode === 'random';
    if (!random && !R.allowed(setup.content, setup.tier)) setup.tier = Math.min(setup.tier, R.tierIdsFor(setup.content).slice(-1)[0]);
    var html = '<div class="page setup"><h1 class="page-title">' + K.icon(setup.mode === 'reverse' ? 'reverse' : setup.mode === 'random' ? 'dice' : 'timer') + '<span>' + esc(t('mode.' + setup.mode)) + '</span></h1>' +
      '<p class="page-sub">' + esc(t('setup.' + setup.mode + 'Sub')) + '</p>';
    if (!random) html += '<section class="panel"><h2 class="box-title">' + esc(t('setup.content')) + '</h2>' + K.segHtml('set-content', contentOpts(), setup.content, t('setup.content'), 'seg-cards') + '</section>';
    html += '<section class="panel"><h2 class="box-title">' + esc(t('setup.tier')) + '</h2>' + K.segHtml('set-tier', tierOpts(random ? null : setup.content), setup.tier, t('setup.tier'), 'seg-tiers') +
      (random ? '<p class="hint-line">' + K.icon('info') + '<span>' + esc(t('setup.randomPool', { list: R.contentsFor(setup.tier).map(function (c) { return t('content.' + c); }).join('、') })) + '</span></p>' : '') + '</section>';
    var best = random ? null : Store.best(R.recordKey(setup.content, setup.tier, setup.mode === 'reverse' ? 'desc' : 'asc'));
    html += '<div class="setup-go">' + (random ? '<p class="best-line">' + K.icon('dice') + '<span>' + esc(t('setup.randomCount', { n: Store.stats().randomGames || 0 })) + '</span></p>'
      : '<p class="best-line">' + K.icon('trophy') + '<span>' + esc(t('setup.best')) + '</span><b>' + (best ? esc(K.fmtTime(best)) : '—') + '</b></p>') +
      '<button type="button" class="btn primary big" id="setup-start">' + K.icon('play') + '<span>' + esc(random ? t('setup.draw') : t('setup.start')) + '</span></button></div></div>';
    $('scr-setup').innerHTML = html;
    K.bindSeg($('set-content'), function (v) { setup.content = v; Store.set('setup', { content: setup.content, tier: setup.tier }); renderSetup(); var b = $('set-content').querySelector('[aria-checked="true"]'); if (b) b.focus(); });
    K.bindSeg($('set-tier'), function (v) { setup.tier = Number(v); Store.set('setup', { content: setup.content, tier: setup.tier }); renderSetup(); var b = $('set-tier').querySelector('[aria-checked="true"]'); if (b) b.focus(); });
    $('setup-start').onclick = function () { root.Solo.start({ mode: setup.mode, content: setup.content, tier: setup.tier }); };
  }

  /* ---------- 闖關選關 ---------- */
  function renderLevels() {
    var lv = Store.levels(), open = Store.unlockedLevel();
    var html = '<div class="page levels"><h1 class="page-title">' + K.icon('flag') + '<span>' + esc(t('title.levels')) + '</span></h1>' +
      '<p class="page-sub">' + K.icon('star') + '<span>' + esc(t('levels.stars', { s: Store.totalStars(), m: R.LEVELS * 3 })) + '</span></p>';
    for (var tierId = 0; tierId < 5; tierId++) {
      var tr = R.tier(tierId), segStars = 0;
      var tiles = '';
      for (var i = 1; i <= 10; i++) {
        var no = tierId * 10 + i, rec = lv[no], locked = no > open, s = rec ? rec.stars : 0;
        segStars += s;
        var spec = R.levelSpec(no);
        tiles += '<button type="button" class="lv-tile' + (locked ? ' locked' : '') + (rec ? ' clear' : '') + (no === open && !rec ? ' current' : '') + '" data-lv="' + no + '"' + (locked ? ' aria-disabled="true"' : '') +
          ' aria-label="' + esc(t('levels.aria', { n: no, s: s }) + (locked ? '，' + t('levels.locked') : '')) + '">' +
          '<b class="lv-no">' + no + '</b><span class="lv-ct">' + (locked ? K.icon('lock', 'lock-ico') : root.Art.token(spec.content, spec.content === 'icon' ? 2 : 0, 1)) + '</span>' +
          '<span class="lv-stars">' + [0, 1, 2].map(function (k) { return K.icon(k < s ? 'star' : 'star-empty', k < s ? 'on' : ''); }).join('') + '</span>' +
          '<small class="lv-time">' + (rec ? esc(K.fmtTime(rec.ms)) : spec.order === 'desc' ? esc(t('order.desc')) : '') + '</small></button>';
      }
      html += '<section class="lv-seg"><h2 class="box-title">' + esc(t('tier.' + tr.key)) + ' <small>' + tr.size + '×' + tr.size + '・' + esc(t('levels.range', { a: tierId * 10 + 1, b: tierId * 10 + 10 })) + '</small><span class="lv-seg-stars">' + K.icon('star') + segStars + '/30</span></h2><div class="lv-grid">' + tiles + '</div></section>';
    }
    $('scr-levels').innerHTML = html + '</div>';
    $('scr-levels').querySelector('.levels').onclick = function (e) {
      var b = e.target.closest('[data-lv]'); if (!b) return;
      if (b.classList.contains('locked')) { K.toast(t('levels.lockedToast'), 'bad'); return; }
      root.Solo.start({ mode: 'level', level: Number(b.getAttribute('data-lv')) });
    };
    var cur = $('scr-levels').querySelector('.lv-tile.current');
    if (cur) setTimeout(function () { try { cur.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ } }, 0);
  }

  /* ---------- 每日挑戰 ---------- */
  function monthCalendar(today) {
    var d = Store.daily();
    var y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
    var first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    var days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var wk = t('cal.week').split(',');
    var html = '<div class="cal" role="table" aria-label="' + esc(t('daily.calendar')) + '"><div class="cal-row cal-head" role="row">' + wk.map(function (w) { return '<span role="columnheader">' + esc(w) + '</span>'; }).join('') + '</div><div class="cal-grid">';
    for (var i = 0; i < first; i++) html += '<span class="cal-day empty"></span>';
    for (var k = 1; k <= days; k++) {
      var key = today.slice(0, 8) + String(k).padStart(2, '0');
      var n = d[key] ? Object.keys(d[key]).length : 0;
      html += '<span class="cal-day' + (key === today ? ' today' : '') + (n ? ' has' : '') + (n === 5 ? ' all' : '') + '" aria-label="' + esc(key + '：' + t('daily.doneN', { n: n })) + '"><b>' + k + '</b>' + (n ? '<i class="cal-dots">' + new Array(n + 1).join('<i></i>') + '</i>' : '') + '</span>';
    }
    return html + '</div></div>';
  }
  function renderDaily() {
    var today = R.taipeiDate(), day = Store.daily()[today] || {};
    var html = '<div class="page daily"><h1 class="page-title">' + K.icon('calendar') + '<span>' + esc(t('title.daily')) + '</span></h1>' +
      '<p class="page-sub"><span>' + esc(t('daily.today', { d: today })) + '</span><span class="streak">' + K.icon('flame') + esc(t('daily.streak', { n: Store.dailyStreak(today) })) + '</span></p><div class="daily-grid">';
    for (var id = 0; id < 5; id++) {
      var sp = R.dailySpec(today, id), tr = R.tier(id), done = day[id] != null;
      html += '<button type="button" class="daily-card' + (done ? ' done' : '') + '" data-tier="' + id + '"><span class="dc-art">' + root.Art.token(sp.content, sp.content === 'icon' ? 2 : 0, id) + '</span>' +
        '<span class="dc-txt"><b>' + esc(t('tier.' + tr.key)) + ' <small>' + tr.size + '×' + tr.size + '</small></b><small>' + esc(t('content.' + sp.content) + '・' + t('order.' + sp.order)) + '</small></span>' +
        '<span class="dc-state">' + (done ? K.icon('check') + '<b>' + esc(K.fmtTime(day[id])) + '</b>' : '<i>' + esc(t('daily.play')) + '</i>') + '</span></button>';
    }
    html += '</div><p class="hint-line">' + K.icon('info') + '<span>' + esc(t('daily.rule')) + '</span></p>' +
      '<section class="panel"><h2 class="box-title">' + esc(t('daily.calendar')) + '</h2>' + monthCalendar(today) + '</section></div>';
    $('scr-daily').innerHTML = html;
    $('scr-daily').querySelector('.daily-grid').onclick = function (e) {
      var b = e.target.closest('[data-tier]'); if (!b) return;
      root.Solo.start({ mode: 'daily', tier: Number(b.getAttribute('data-tier')), date: today });
    };
  }

  /* ---------- 我的紀錄 ---------- */
  function renderRecords() {
    var st = Store.stats(), on = Store.online(), today = R.taipeiDate();
    var tiers = R.tierIdsFor(recTab);
    var html = '<div class="page records"><h1 class="page-title">' + K.icon('chart') + '<span>' + esc(t('title.records')) + '</span></h1>' +
      '<div class="stat-tiles">' +
      tile('play', t('rec.soloGames'), st.soloGames || 0) + tile('dice', t('rec.randomGames'), st.randomGames || 0) +
      tile('star', t('rec.levelStars'), Store.totalStars() + '/' + R.LEVELS * 3) + tile('flame', t('rec.streak'), t('daily.days', { n: Store.dailyStreak(today) })) + '</div>' +
      '<section class="panel"><h2 class="box-title">' + K.icon('trophy') + esc(t('rec.best')) + '</h2>' +
      K.segHtml('rec-tab', R.CONTENTS.map(function (c) { return { value: c, label: t('content.' + c) }; }), recTab, t('rec.best'), 'seg-tabs') +
      '<div class="table-wrap scroll"><table class="rec-table"><thead><tr><th scope="col">' + esc(t('rec.tier')) + '</th><th scope="col">' + esc(t('order.asc')) + '</th><th scope="col">' + esc(t('order.desc')) + '</th></tr></thead><tbody>' +
      tiers.map(function (id) {
        var a = Store.best(R.recordKey(recTab, id, 'asc')), d = Store.best(R.recordKey(recTab, id, 'desc'));
        return '<tr><th scope="row">' + esc(t('tier.' + R.tier(id).key)) + ' <small>' + R.tier(id).size + '×' + R.tier(id).size + '</small></th><td>' + (a ? esc(K.fmtTime(a)) : '—') + '</td><td>' + (d ? esc(K.fmtTime(d)) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="panel"><h2 class="box-title">' + K.icon('users') + esc(t('rec.online')) + '</h2><div class="stat-tiles small">' +
      tile('hand', t('online.grab'), t('rec.gw', { g: (on.grab || {}).games || 0, w: (on.grab || {}).wins || 0 })) +
      tile('bolt', t('online.race'), t('rec.gw', { g: (on.race || {}).games || 0, w: (on.race || {}).wins || 0 })) + '</div></section>' +
      '<section class="panel"><h2 class="box-title">' + K.icon('calendar') + esc(t('daily.calendar')) + '</h2>' + monthCalendar(today) + '</section>' +
      '<p class="rec-foot">' + (Store.persistent ? '' : '<span class="warn">' + esc(t('rec.noStorage')) + '</span>') +
      '<button type="button" class="btn ghost small" id="rec-clear">' + K.icon('cross') + '<span>' + esc(t('rec.clear')) + '</span></button></p></div>';
    $('scr-records').innerHTML = html;
    K.bindSeg($('rec-tab'), function (v) { recTab = v; renderRecords(); var b = $('rec-tab').querySelector('[aria-checked="true"]'); if (b) b.focus(); });
    $('rec-clear').onclick = function () { K.confirm(t('rec.clear'), t('rec.clearConfirm'), t('rec.clearOk'), function () { Store.clearRecords(); renderRecords(); K.toast(t('rec.cleared'), 'good'); }, true); };
  }
  function tile(ico, label, val) { return '<div class="stat-tile">' + K.icon(ico) + '<small>' + esc(label) + '</small><b>' + esc(val) + '</b></div>'; }

  /* ---------- 怎麼玩（靜態圖文） ---------- */
  function miniBoard(content, order, doneN) {
    var b = R.makeBoard({ size: 3, content: content, order: order, seed: 'help-' + content });
    var html = '<div class="mini-board board s3 ct-' + content + '" aria-hidden="true" style="--n:3">';
    for (var r = 0; r < 3; r++) {
      html += '<div class="row">';
      for (var c = 0; c < 3; c++) {
        var i = r * 3 + c, step = R.stepOfCell(b, i);
        html += '<span class="cell' + (step < doneN ? ' done' : '') + (step === doneN ? ' hint-soft' : '') + '"><span class="cell-face">' + root.Art.cell(content, b.cells[i], i) + '</span></span>';
      }
      html += '</div>';
    }
    return html + '</div>';
  }
  function renderHelp() {
    var sec = function (ico, h, body, art) { return '<section class="panel help-sec">' + (art ? '<div class="help-art">' + art + '</div>' : '') + '<div class="help-txt"><h2 class="box-title">' + K.icon(ico) + esc(h) + '</h2>' + body + '</div></section>'; };
    var p = function (k, params) { return '<p>' + esc(t(k, params)) + '</p>'; };
    var combo = '<table class="combo-table"><thead><tr><th scope="col">' + esc(t('help.comboCol')) + '</th><th scope="col">' + esc(t('help.ptsCol')) + '</th></tr></thead><tbody>' +
      [['1–2', 1], ['3–5', 2], ['6–8', 3], ['9+', 4]].map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>';
    var contents = '<div class="help-contents">' + R.CONTENTS.map(function (c) {
      var max = R.MAX_SIZE[c];
      return '<div class="hc-item"><span class="hc-art">' + root.Art.token(c, c === 'icon' ? 3 : 0, 4) + '</span><b>' + esc(t('content.' + c)) + '</b><small>' + esc(t('help.contentMax', { n: max })) + '</small><small>' + esc(t('help.seq.' + c)) + '</small></div>';
    }).join('') + '</div>';
    var tiers = '<ul class="help-tiers">' + R.TIERS.map(function (tr) { return '<li><b>' + esc(t('tier.' + tr.key)) + '</b><span>' + tr.size + '×' + tr.size + '</span></li>'; }).join('') + '</ul>';
    $('scr-help').innerHTML = '<div class="page help"><h1 class="page-title">' + K.icon('book') + '<span>' + esc(t('title.help')) + '</span></h1>' +
      sec('target', t('help.goalH'), p('help.goal1') + p('help.goal2') + p('help.goal3'), miniBoard('number', 'asc', 4)) +
      sec('grid', t('help.contentH'), contents + p('help.contentNote')) +
      sec('reverse', t('help.tierH'), tiers + p('help.tierNote') + p('help.reverse'), miniBoard('letter', 'desc', 2)) +
      sec('play', t('help.soloH'), '<ul class="help-list"><li>' + ['classic', 'reverse', 'random', 'level', 'daily'].map(function (m) { return '<b>' + esc(t('mode.' + m)) + '</b>：' + esc(t('help.mode.' + m)); }).join('</li><li>') + '</li></ul>' + p('help.kid'), miniBoard('icon', 'asc', 3)) +
      sec('hand', t('help.grabH'), p('help.grab1') + p('help.grab2') + combo) +
      sec('bolt', t('help.raceH'), p('help.race1') + p('help.race2')) +
      sec('trophy', t('help.rankH'), p('help.rank1') + p('help.rank2')) +
      sec('keyboard', t('help.keysH'), p('help.keys1') + p('help.keys2')) +
      '<p class="help-foot"><small>' + esc(t('help.font')) + '</small></p></div>';
  }

  /* ---------- 設定 Modal ---------- */
  function row(id, label, ctrl, sub) {
    return '<div class="set-row"><div class="set-label"><b id="' + id + '-l">' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><div class="set-ctrl">' + ctrl + '</div></div>';
  }
  function openSettings() {
    var s = Store.settings();
    var lc = root.LobbyChatUI;
    var body =
      '<h3 class="set-h">' + K.icon('volume') + esc(t('set.sound')) + '</h3>' +
      row('set-bgm', t('set.bgm'), K.switchHtml('set-bgm', s.bgm, t('set.bgm')) + K.sliderHtml('set-bgmv', s.bgmVol, t('set.bgmVol'))) +
      row('set-sfx', t('set.sfx'), K.switchHtml('set-sfx', s.sfx, t('set.sfx')) + K.sliderHtml('set-sfxv', s.sfxVol, t('set.sfxVol'))) +
      '<h3 class="set-h">' + K.icon('palette') + esc(t('set.look')) + '</h3>' +
      row('set-theme', t('set.theme'), K.segHtml('set-theme', Store.THEMES.map(function (th) { return { value: th, label: t('theme.' + th), html: '<i class="theme-chip tc-' + th + '"><i></i><i></i><i></i></i>' }; }), s.theme, t('set.theme'), 'seg-theme'), t('set.themeSub')) +
      row('set-lang', t('set.lang'), K.segHtml('set-lang', root.I18N.LANGS.map(function (l) { return { value: l, label: t('lang.' + l) }; }), root.I18N.lang, t('set.lang'), 'seg-lang')) +
      '<h3 class="set-h">' + K.icon('target') + esc(t('set.play')) + '</h3>' +
      row('set-next', t('set.next'), K.switchHtml('set-next', s.showNext, t('set.next')), t('set.nextSub')) +
      row('set-vib', t('set.vibrate'), K.switchHtml('set-vib', s.vibrate, t('set.vibrate')), t('set.vibrateSub')) +
      row('set-rm', t('set.motion'), K.switchHtml('set-rm', s.reduceMotion, t('set.motion')), t('set.motionSub')) +
      row('set-ca', t('set.assist'), K.switchHtml('set-ca', s.colorAssist, t('set.assist')), t('set.assistSub')) +
      (lc ? row('set-lobbychat', lc.text('set'), K.switchHtml('set-lobbychat', lc.isEnabled(), lc.text('set')), lc.text('setSub')) : '');
    K.modal({ title: t('set.title'), icon: 'gear', cls: 'settings', body: body, focus: '#set-bgm', actions: [
      { label: t('set.reset'), kind: 'ghost', icon: 'refresh', close: false, onClick: function (api) { Store.resetSettings(); if (root.LobbyChatUI) root.LobbyChatUI.setEnabled(true); api.close(); applySettings(); openSettings(); } },
      { label: t('common.done'), kind: 'primary', icon: 'check' }
    ] });
    K.bindSwitch($('set-bgm'), function (v) { Store.setSetting('bgm', v); applySettings(); });
    K.bindSwitch($('set-sfx'), function (v) { Store.setSetting('sfx', v); applySettings(); });
    K.bindSlider($('set-bgmv'), function (v, commit) { root.Sound.configure({ bgmVol: v }); if (commit) Store.setSetting('bgmVol', v); });
    K.bindSlider($('set-sfxv'), function (v, commit) { root.Sound.configure({ sfxVol: v }); if (commit) { Store.setSetting('sfxVol', v); root.Sound.play('tap', 3); } });
    K.bindSeg($('set-theme'), function (v) { Store.setSetting('theme', v); applySettings(); root.Sound.play('pop'); });
    K.bindSeg($('set-lang'), function (v) { root.I18N.setLang(v); });
    K.bindSwitch($('set-next'), function (v) { Store.setSetting('showNext', v); applySettings(); });
    K.bindSwitch($('set-vib'), function (v) { Store.setSetting('vibrate', v); if (v) root.Sound.vibrate(30); });
    K.bindSwitch($('set-rm'), function (v) { Store.setSetting('reduceMotion', v); applySettings(); });
    K.bindSwitch($('set-ca'), function (v) { Store.setSetting('colorAssist', v); applySettings(); });
    if (lc) K.bindSwitch($('set-lobbychat'), function (v) { lc.setEnabled(v); });
  }
  function applySettings() {
    var s = Store.settings();
    var app = $('app');
    app.setAttribute('data-theme', s.theme);
    doc.documentElement.setAttribute('data-theme', s.theme);
    app.classList.toggle('reduce-motion', s.reduceMotion);
    app.classList.toggle('color-assist', s.colorAssist);
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', { wood: '#3a2414', candy: '#ffe9f3', tech: '#070d1c' }[s.theme]);
    root.Sound.configure({ theme: s.theme, bgm: s.bgm, sfx: s.sfx, bgmVol: s.bgmVol, sfxVol: s.sfxVol });
    if (root.GameView) root.GameView.refreshNext();
  }
  function openLangMenu() {
    K.menu($('btn-lang'), root.I18N.LANGS.map(function (l) { return { value: l, label: t('lang.' + l), on: l === root.I18N.lang }; }), function (it) { root.I18N.setLang(it.value); });
  }

  function onLang() {
    var r = RENDER[screen];
    if (r && screen !== 'game') r();
    if (screen === 'game') { root.Solo.relang(); if (root.OnlineUI) root.OnlineUI.relang(); }
    root.Result.relang();
    updateTop();
    var top = K.topModal();
    if (top && top.el.classList.contains('settings')) { top.close('relang'); openSettings(); setTimeout(function () { var b = $('set-lang') && $('set-lang').querySelector('[aria-checked="true"]'); if (b) b.focus(); }, 40); }
    if (root.Latency) root.Latency.refresh();
  }

  var RENDER = {
    home: renderHome, solo: renderSolo, setup: renderSetup, levels: renderLevels, daily: renderDaily, records: renderRecords, help: renderHelp,
    lobby: function () { root.OnlineUI.renderLobby(); }, room: function () { root.OnlineUI.renderRoom(); }
  };

  function boot() {
    K = root.Kit; Store = root.Store;
    root.I18N.init();
    root.GameView.init();
    root.Solo.init();
    if (root.OnlineUI) root.OnlineUI.init();
    applySettings();
    $('btn-settings').addEventListener('click', openSettings);
    $('btn-lang').addEventListener('click', openLangMenu);
    $('btn-back').addEventListener('click', goBack);
    $('btn-side').addEventListener('click', function () {
      /* 寬版：左欄收合／展開（記住）；窄版：抽屜 */
      if (root.matchMedia('(min-width: 1000px) and (min-aspect-ratio: 1/1)').matches) {
        var c = !$('app').classList.contains('side-collapsed');
        $('app').classList.toggle('side-collapsed', c); Store.set('sideCollapsed', c);
        $('btn-side').setAttribute('aria-expanded', String(!c));
        return;
      }
      if ($('app').getAttribute('data-side') === 'open') closeSide(); else openSide();
    });
    if (Store.get('sideCollapsed')) $('app').classList.add('side-collapsed');
    $('side-close').addEventListener('click', closeSide);
    $('side-backdrop').addEventListener('click', closeSide);
    $('btn-pause').addEventListener('click', function () { root.Solo.pause(); });
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || K.topModal() || doc.querySelector('.pop-menu') || doc.querySelector('.result-share-dialog-layer:not([hidden])')) return;
      if ($('app').getAttribute('data-side') === 'open') { closeSide(); return; }
      if (screen === 'game' && !root.Result.visible() && root.Solo.playing()) { e.preventDefault(); root.Solo.pause(); }
    });
    root.I18N.onChange(onLang);
    root.addEventListener('popstate', onPop);
    try { root.history.replaceState({ s: 'root' }, ''); root.history.pushState({ s: 'home' }, ''); } catch (e) { /* ignore */ }
    $('boot').hidden = true;
    var q = new URLSearchParams(root.location.search);
    show('home', { fromPop: true, focus: false });
    /* 邀請連結：?room=XXXX&invite=token → 先到大廳確認暱稱再加入 */
    if (q.get('room') && root.OnlineUI) root.OnlineUI.enterLobby({ room: q.get('room').toUpperCase().slice(0, 8), token: q.get('invite') || '' });
  }

  root.App = { show: show, setTitle: setTitle, openSetup: openSetup, openSettings: openSettings, applySettings: applySettings, goBack: goBack, openSide: openSide, closeSide: closeSide, updateTop: updateTop, get screen() { return screen; } };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof self !== 'undefined' ? self : this);
