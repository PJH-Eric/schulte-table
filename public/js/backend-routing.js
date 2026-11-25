/* ===== backend-routing.js — 線上後端主備切換（沿用 game-lobby 的 backend-router，原樣複製）=====
 * 只在 https://pjh-eric.github.io 生效；本機與 ?server= 測試網址直接連線。
 * 目前只用 Cloudflare（https://schulte-table-backup.eric-games.workers.dev）：Render 免費額度已滿，無法新建服務。
 * 之後要恢復「Render 主、Cloudflare 備援」：建立 Render 服務後把下方 settings 的 null 改成 Render 服務名稱即可。
 * 邀請連結會帶上 ?backend= 釘選同一台後端；進房後記在 sessionStorage，重新整理回到同一台。
 */
(function (root, factory) {
  const createBackendRouter = factory();
  if (typeof module === 'object' && module.exports) module.exports = { createBackendRouter };
  else root.createBackendRouter = createBackendRouter;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function socketProbe(endpoint) {
    return new Promise(resolve => {
      let socket;
      let timer;
      let settled = false;

      function finish(available) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (socket && socket.readyState < 2) socket.close();
        resolve(available);
      }

      try {
        const url = new URL(endpoint.websocketPath, endpoint.url + '/');
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(url);
        socket.addEventListener('open', () => finish(true), { once: true });
        socket.addEventListener('error', () => finish(false), { once: true });
        socket.addEventListener('close', () => finish(false), { once: true });
        timer = setTimeout(() => finish(false), endpoint.timeoutMs);
      } catch {
        finish(false);
      }
    });
  }

  async function tryProbe(probe, endpoint) {
    try {
      return await probe(endpoint);
    } catch {
      return false;
    }
  }

  async function checkEndpoint(probe, endpoint) {
    if (!endpoint.wakeTimeoutMs) return tryProbe(probe, endpoint);

    const deadline = performance.now() + endpoint.wakeTimeoutMs;
    let remaining = deadline - performance.now();
    while (remaining > 0) {
      const timeoutMs = Math.min(endpoint.timeoutMs, remaining);
      if (await tryProbe(probe, { ...endpoint, timeoutMs })) return true;
      remaining = deadline - performance.now();
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(3000, remaining)));
      remaining = deadline - performance.now();
    }
    return false;
  }

  function createBackendRouter({ primary, standby, endpoints = [primary, standby], pinOnly = [], pin, probe = socketProbe }) {
    const candidates = endpoints.filter(Boolean);
    const pinned = [...candidates, ...pinOnly].find(endpoint => endpoint.id === pin);
    let selected = pinned;
    let pending;

    async function choose() {
      for (const endpoint of candidates) {
        if (endpoint.skipUntil > Date.now()) continue;
        if (await checkEndpoint(probe, endpoint)) {
          selected = endpoint;
          return selected.url;
        }
      }
      return null;
    }

    return {
      get url() {
        return (selected || candidates[0])?.url ?? null;
      },
      select() {
        if (selected) return Promise.resolve(selected.url);
        pending ??= choose().finally(() => { pending = undefined; });
        return pending;
      },
      pinInvite(url) {
        if (selected) url.searchParams.set('backend', selected.id);
        return url;
      }
    };
  }

  return createBackendRouter;
});

(function (window, oraclePilotOrigins) {
  'use strict';

  if (window.location.origin !== 'https://pjh-eric.github.io') return;
  const game = window.location.pathname.split('/')[1];
  const query = new URLSearchParams(window.location.search);
  // Explicit test URLs remain direct connections.
  if (query.has('server')) return;

  /* 舒爾特方格：[Render 服務名稱或 null, WebSocket 路徑]。null＝只用 Cloudflare Worker。自帶設定，不依賴遊戲大廳的路由表。 */
  const settings = {
    'schulte-table': [null, '/ws']
  };

  const config = settings[game];
  if (!config) return;
  const [renderName, path, workerName = game + '-backup'] = config;
  const websocketPath = path === '/socket.io/' ? path + '?EIO=4&transport=websocket' : path;
  const cloudflare = {
    id: 'cloudflare', url: 'https://' + workerName + '.eric-games.workers.dev',
    websocketPath, timeoutMs: 5000
  };
  const origin = renderName ? {
    id: 'render', url: 'https://' + renderName + '.onrender.com',
    websocketPath, timeoutMs: 12000
  } : null;
  const oracleUrl = oraclePilotOrigins[game];
  let endpoints = origin ? [origin, cloudflare] : [cloudflare];
  if (oracleUrl) {
    const oracle = { id: 'oracle', url: oracleUrl, websocketPath, timeoutMs: 5000 };
    const render = { ...origin, timeoutMs: 3000, wakeTimeoutMs: 45000 };
    endpoints = [oracle, render, cloudflare];
  }
  const roomBackendKey = 'game-backend-room:' + game;
  let roomBackend;
  try { roomBackend = window.sessionStorage.getItem(roomBackendKey); } catch { /* storage may be unavailable */ }
  const route = window.createBackendRouter({ endpoints, pin: query.get('backend') || roomBackend });
  const hosts = new Set(endpoints.map(endpoint => new URL(endpoint.url).host));
  const NativeSocket = window.WebSocket;

  function manages(address) {
    if (!address) return false;
    try { return hosts.has(new URL(address).host); } catch { return false; }
  }

  class RoutedSocket extends EventTarget {
    connecting = true;
    socket = null;

    constructor(address) {
      super();
      this.url = address;
      void this.open(address);
    }

    get readyState() {
      return this.socket?.readyState ?? (this.connecting ? NativeSocket.CONNECTING : NativeSocket.CLOSED);
    }

    notify(event) {
      this.dispatchEvent(event);
      this['on' + event.type]?.call(this, event);
    }

    async open(address) {
      try {
        const selected = await route.select();
        if (!this.connecting) return;
        if (!selected) throw new Error('No available game backend');
        const url = new URL(address);
        url.host = new URL(selected).host;
        this.socket = new NativeSocket(url);
        this.url = url.href;
        this.socket.addEventListener('open', () => this.notify(new Event('open')));
        this.socket.addEventListener('message', event => this.notify(new MessageEvent('message', { data: event.data })));
        this.socket.addEventListener('error', () => this.notify(new Event('error')));
        this.socket.addEventListener('close', event => this.notify(new CloseEvent('close', {
          code: event.code, reason: event.reason, wasClean: event.wasClean
        })));
      } catch {
        this.connecting = false;
        this.notify(new Event('error'));
        this.notify(new CloseEvent('close', { code: 1006 }));
      }
    }

    send(data) { this.socket.send(data); }

    close(code, reason) {
      if (this.socket) this.socket.close(code, reason);
      else this.connecting = false;
    }
  }

  window.GameBackend = {
    canRoute: manages,
    async select(address) {
      if (!manages(address)) return address;
      const selected = await route.select();
      if (!selected) throw new Error('No available game backend');
      return selected;
    },
    createSocket(address) {
      return manages(address) ? new RoutedSocket(address) : new NativeSocket(address);
    },
    pinInvite(address) {
      return route.pinInvite(new URL(address, window.location.href)).toString();
    },
    rememberRoom() {
      const backend = route.pinInvite(new URL(window.location.origin)).searchParams.get('backend');
      if (backend) {
        try { window.sessionStorage.setItem(roomBackendKey, backend); } catch { /* storage may be unavailable */ }
      }
    },
    forgetRoom() {
      try { window.sessionStorage.removeItem(roomBackendKey); } catch { /* storage may be unavailable */ }
    }
  };
})(window, {});
