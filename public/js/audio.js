/* ===== audio.js — 三套主題各一套音效＋輕鬆背景音樂（Web Audio 即時合成，不載入音檔）=====
 * 木質＝麻將牌碰撞聲、糖果＝啵啵聲、科技＝電子短音。
 * 首次使用者手勢後才解鎖音訊；音效與音樂音量各自獨立。
 */
(function (root) {
  'use strict';
  var ctx = null, master = null, sfxBus = null, bgmBus = null, noiseBuf = null;
  var theme = 'wood', sfxOn = true, bgmOn = true, sfxVol = 0.8, bgmVol = 0.45;
  var bgmTimer = null, bgmStep = 0, bgmNext = 0, bgmWanted = false;

  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    var ch = noiseBuf.getChannelData(0);
    for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    applyVol();
    return ctx;
  }
  function applyVol() {
    if (!ctx) return;
    sfxBus.gain.value = sfxOn ? sfxVol * 0.9 : 0;
    bgmBus.gain.value = bgmOn ? bgmVol * 0.32 : 0;
  }
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    if (bgmWanted) startBgm();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { root.addEventListener && root.addEventListener(ev, unlock, { capture: true, passive: true }); });

  function tone(freq, t, dur, type, vol, bus, glide) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, freq, q, vol, type) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  /* 每套主題的音效 */
  var KIT = {
    wood: {
      tap: function (t, k) { noise(t, 0.05, 2400 + k * 40, 6, 0.55); tone(520 + k * 12, t, 0.07, 'triangle', 0.22); noise(t + 0.035, 0.04, 3200, 8, 0.25); },
      wrong: function (t) { tone(140, t, 0.16, 'triangle', 0.32); noise(t, 0.08, 500, 2, 0.25); },
      done: function (t) { [523, 659, 784, 1046].forEach(function (f, i) { noise(t + i * 0.09, 0.05, 2600, 6, 0.4); tone(f, t + i * 0.09, 0.2, 'triangle', 0.22); }); },
      tick: function (t, hi) { noise(t, 0.06, hi ? 3400 : 2200, 7, 0.5); tone(hi ? 880 : 440, t, 0.1, 'triangle', 0.2); }
    },
    candy: {
      tap: function (t, k) { tone(420 + k * 18, t, 0.09, 'sine', 0.38, null, 900 + k * 25); },
      wrong: function (t) { tone(300, t, 0.18, 'sine', 0.3, null, 150); },
      done: function (t) { [659, 784, 988, 1318].forEach(function (f, i) { tone(f * 0.6, t + i * 0.08, 0.14, 'sine', 0.3, null, f * 1.2); }); },
      tick: function (t, hi) { tone(hi ? 700 : 500, t, 0.12, 'sine', 0.32, null, hi ? 1400 : 900); }
    },
    tech: {
      tap: function (t, k) { tone(880 + k * 30, t, 0.05, 'square', 0.12); tone(1760 + k * 60, t + 0.025, 0.04, 'square', 0.06); },
      wrong: function (t) { tone(110, t, 0.18, 'sawtooth', 0.16, null, 70); },
      done: function (t) { [880, 1108, 1318, 1760].forEach(function (f, i) { tone(f, t + i * 0.07, 0.1, 'square', 0.1); }); tone(220, t, 0.5, 'sawtooth', 0.06, null, 440); },
      tick: function (t, hi) { tone(hi ? 1320 : 660, t, 0.08, 'square', 0.12); }
    }
  };

  /** name：tap（k＝第幾格，每 5 格略升高）、wrong、done、tick、go、pop */
  function play(name, k) {
    if (!sfxOn || !ensure() || ctx.state !== 'running') return;
    var kit = KIT[theme] || KIT.wood, t = ctx.currentTime + 0.005;
    try {
      if (name === 'tap') kit.tap(t, Math.floor((k || 0) / 5));
      else if (name === 'wrong') kit.wrong(t);
      else if (name === 'done') kit.done(t);
      else if (name === 'tick') kit.tick(t, false);
      else if (name === 'go') kit.tick(t, true);
      else if (name === 'pop') kit.tap(t, 2);
    } catch (e) { /* 音效失敗不影響遊戲 */ }
  }

  /* ---------- 背景音樂：每套主題一段四小節循環，音量很小、不搶注意力 ---------- */
  var SONG = {
    wood: { bpm: 78, wave: 'triangle', notes: [[392, 0], [440, 2], [523, 4], [440, 6], [392, 8], [330, 10], [294, 12], [330, 14]], bass: [196, 196, 147, 165], pad: 'sine' },
    candy: { bpm: 96, wave: 'sine', notes: [[523, 0], [659, 1], [784, 2], [659, 4], [587, 6], [523, 8], [440, 9], [523, 10], [587, 12], [659, 14]], bass: [262, 220, 175, 196], pad: 'sine' },
    tech: { bpm: 104, wave: 'square', notes: [[440, 0], [523, 2], [659, 3], [523, 6], [494, 8], [587, 10], [740, 11], [587, 14]], bass: [110, 110, 98, 123], pad: 'sawtooth' }
  };
  function scheduleBgm() {
    if (!ctx || !bgmOn) return;
    var song = SONG[theme] || SONG.wood, stepDur = 60 / song.bpm / 2;
    while (bgmNext < ctx.currentTime + 0.4) {
      var s = bgmStep % 16, bar = Math.floor(bgmStep / 16) % 4;
      song.notes.forEach(function (n) { if (n[1] === s) tone(n[0] * (bar === 3 ? 0.89 : 1), bgmNext, stepDur * 1.8, song.wave, theme === 'tech' ? 0.05 : 0.12, bgmBus); });
      if (s === 0 || s === 8) tone(song.bass[bar], bgmNext, stepDur * 7, song.pad, theme === 'tech' ? 0.05 : 0.1, bgmBus);
      bgmNext += stepDur; bgmStep++;
    }
  }
  function startBgm() {
    bgmWanted = true;
    if (!bgmOn || !ctx || ctx.state !== 'running' || bgmTimer) return;
    bgmNext = ctx.currentTime + 0.1;
    bgmTimer = setInterval(scheduleBgm, 120);
  }
  function stopBgm() { bgmWanted = false; clearInterval(bgmTimer); bgmTimer = null; }

  function vibrate(ms) {
    var s = root.Store ? root.Store.settings() : null;
    if (s && !s.vibrate) return;
    try { if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(ms); } catch (e) { /* ignore */ }
  }

  root.Sound = {
    play: play, vibrate: vibrate, startBgm: startBgm, stopBgm: stopBgm,
    configure: function (o) {
      if (o.theme) theme = o.theme;
      if (o.sfx != null) sfxOn = !!o.sfx;
      if (o.bgm != null) bgmOn = !!o.bgm;
      if (o.sfxVol != null) sfxVol = o.sfxVol;
      if (o.bgmVol != null) bgmVol = o.bgmVol;
      applyVol();
      if (!bgmOn) { clearInterval(bgmTimer); bgmTimer = null; }
      else if (bgmWanted) startBgm();
    },
    get unlocked() { return !!ctx && ctx.state === 'running'; }
  };
})(typeof self !== 'undefined' ? self : this);
