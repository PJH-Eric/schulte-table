/* ===== storage.js — 本機紀錄（localStorage，key 前綴 schulte:v1，全部 try/catch）=====
 * 無痕模式或儲存被擋時退回記憶體，遊戲照樣可玩。壞資料回預設。
 *   settings  設定        nickname  暱稱       best     各「內容×難度×順序」最佳紀錄
 *   levels    闖關星數與最佳                   daily    每日挑戰第一次成績     stats  局數與線上戰績
 */
(function (root) {
  'use strict';
  var PREFIX = 'schulte:v1:';
  var mem = {};
  var ls = null;
  try { ls = root.localStorage; var k = PREFIX + '__t'; ls.setItem(k, '1'); ls.removeItem(k); } catch (e) { ls = null; }

  var DEFAULTS = {
    theme: 'wood', bgm: true, sfx: true, bgmVol: 0.45, sfxVol: 0.8,
    showNext: true, vibrate: true, reduceMotion: false, colorAssist: false
  };
  var THEMES = ['wood', 'candy', 'tech'];

  function raw(key) {
    try { if (ls) return ls.getItem(PREFIX + key); } catch (e) { /* ignore */ }
    return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
  }
  function get(key, def) {
    var s = raw(key);
    if (s == null) return def === undefined ? null : def;
    try { return JSON.parse(s); } catch (e) { return def === undefined ? null : def; }
  }
  function set(key, val) {
    var s = JSON.stringify(val);
    mem[key] = s;
    try { if (ls) ls.setItem(PREFIX + key, s); } catch (e) { /* 存不下就只放記憶體 */ }
  }
  function del(key) { delete mem[key]; try { if (ls) ls.removeItem(PREFIX + key); } catch (e) { /* ignore */ } }
  function obj(key) { var v = get(key); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

  function settings() {
    var s = Object.assign({}, DEFAULTS, obj('settings'));
    if (THEMES.indexOf(s.theme) < 0) s.theme = DEFAULTS.theme;
    ['bgm', 'sfx', 'showNext', 'vibrate', 'reduceMotion', 'colorAssist'].forEach(function (k) { s[k] = !!s[k]; });
    ['bgmVol', 'sfxVol'].forEach(function (k) { var v = Number(s[k]); s[k] = isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULTS[k]; });
    return s;
  }
  function setSetting(k, v) { var s = settings(); s[k] = v; set('settings', s); return s; }
  function resetSettings() { set('settings', Object.assign({}, DEFAULTS)); }

  /** 同一個分頁固定的身分（線上斷線重連用），放 sessionStorage */
  function clientId() {
    var id = null;
    try { id = root.sessionStorage.getItem('schulte.cid'); } catch (e) { /* ignore */ }
    if (!id) {
      id = (mem.__cid) || ('c' + Math.random().toString(36).slice(2) + Date.now().toString(36));
      mem.__cid = id;
      try { root.sessionStorage.setItem('schulte.cid', id); } catch (e) { /* ignore */ }
    }
    return id;
  }

  /* ---------- 單機紀錄 ---------- */
  /** 回傳 { isBest, prev }；ms 越少越好 */
  function saveBest(key, ms) {
    var best = obj('best');
    var prev = best[key] && Number(best[key].ms) > 0 ? Number(best[key].ms) : null;
    var isBest = prev == null || ms < prev;
    if (isBest) { best[key] = { ms: ms, at: Date.now() }; set('best', best); }
    return { isBest: isBest, prev: prev };
  }
  function best(key) { var b = obj('best')[key]; return b && Number(b.ms) > 0 ? Number(b.ms) : null; }
  function allBest() { return obj('best'); }

  function bump(key, n) { var st = obj('stats'); st[key] = (Number(st[key]) || 0) + (n || 1); set('stats', st); return st[key]; }
  function stats() { return obj('stats'); }

  /* 闖關：{ "1": { stars, ms } }；解鎖＝已通關的下一關 */
  function levels() { return obj('levels'); }
  function saveLevel(no, stars, ms) {
    var lv = levels();
    var cur = lv[no] || {};
    var better = !cur.ms || ms < cur.ms;
    lv[no] = { stars: Math.max(Number(cur.stars) || 0, stars), ms: better ? ms : cur.ms };
    set('levels', lv);
    return { newStars: stars > (Number(cur.stars) || 0), isBest: better, prevMs: cur.ms || null };
  }
  function unlockedLevel() {
    var lv = levels(), n = 1;
    while (n < 50 && lv[n] && lv[n].stars > 0) n++;
    return n;
  }
  function totalStars() { var lv = levels(), s = 0; for (var k in lv) s += Number(lv[k].stars) || 0; return s; }

  /* 每日：{ "2026-11-24": { "0": ms, ... } } 只記第一次 */
  function daily() { return obj('daily'); }
  function saveDaily(date, tier, ms) {
    var d = daily();
    var day = d[date] || {};
    if (day[tier] != null) return false;
    day[tier] = ms; d[date] = day; set('daily', d);
    return true;
  }
  function dailyStreak(today) {
    var d = daily(), n = 0;
    var t = Date.parse(today + 'T00:00:00Z');
    /* 今天還沒玩不算斷：從今天或昨天往回數 */
    if (!d[today]) t -= 86400000;
    for (;;) {
      var key = new Date(t).toISOString().slice(0, 10);
      if (!d[key] || !Object.keys(d[key]).length) break;
      n++; t -= 86400000;
    }
    return n;
  }

  /* 線上戰績：{ grab:{games,wins}, race:{games,wins} } */
  function saveOnline(mode, won) {
    var o = obj('online');
    var m = o[mode] || { games: 0, wins: 0 };
    m.games++; if (won) m.wins++;
    o[mode] = m; set('online', o);
  }
  function online() { return obj('online'); }

  function clearRecords() { ['best', 'levels', 'daily', 'stats', 'online'].forEach(del); }

  root.Store = {
    get: get, set: set, del: del, settings: settings, setSetting: setSetting, resetSettings: resetSettings, DEFAULTS: DEFAULTS, THEMES: THEMES,
    clientId: clientId, saveBest: saveBest, best: best, allBest: allBest, bump: bump, stats: stats,
    levels: levels, saveLevel: saveLevel, unlockedLevel: unlockedLevel, totalStars: totalStars,
    daily: daily, saveDaily: saveDaily, dailyStreak: dailyStreak, saveOnline: saveOnline, online: online, clearRecords: clearRecords,
    get persistent() { return !!ls; }
  };
})(typeof self !== 'undefined' ? self : this);
