// Entscheidet, welche WebSocket-Verbindungen der Seite an den Pi weitergereicht
// werden: nur die von Autodarts - dazu die eine HTTP-Antwort mit dem
// Match-Zustand. Laeuft im Seitenkontext vor page-hook.js und
// wird von den Tests direkt geladen.
(function (root) {
  const AUTODARTS_HOST = /(^|\.)autodarts\.(io|com)$/;
  const MATCH_STATE_PATH = /^\/gs\/v0\/matches\/([^/]+)\/state$/;

  function shouldForward(url) {
    try {
      const { protocol, hostname } = new URL(url, root.location?.href);
      return (protocol === 'wss:' || protocol === 'ws:') && AUTODARTS_HOST.test(hostname);
    } catch {
      return false;
    }
  }

  // Den Stand beim Spielstart schickt Autodarts nicht ueber den WebSocket
  // (dort erst mit dem ersten Pfeil) - die Seite holt ihn per
  // GET /gs/v0/matches/<id>/state. Die Antwort wird zum gleichen Frame wie
  // ueber den WebSocket; alles andere ergibt null.
  function matchStateFrame(url, method, status, body) {
    try {
      const { protocol, hostname, pathname } = new URL(url, root.location?.href);
      const path = MATCH_STATE_PATH.exec(pathname);
      if (protocol !== 'https:' || !AUTODARTS_HOST.test(hostname) || !path) return null;
      if (String(method).toUpperCase() !== 'GET' || status < 200 || status > 299) return null;
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
      return JSON.stringify({ channel: 'autodarts.matches', topic: `${path[1]}.state`, data });
    } catch {
      return null;
    }
  }

  root.raspdartsForward = { shouldForward, matchStateFrame };
})(globalThis);
