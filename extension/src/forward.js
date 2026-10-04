// Entscheidet, welche WebSocket-Verbindungen der Seite an den Pi weitergereicht
// werden: nur die von Autodarts. Laeuft im Seitenkontext vor page-hook.js und
// wird von den Tests direkt geladen.
(function (root) {
  const AUTODARTS_HOST = /(^|\.)autodarts\.(io|com)$/;

  function shouldForward(url) {
    try {
      const { protocol, hostname } = new URL(url, root.location?.href);
      return (protocol === 'wss:' || protocol === 'ws:') && AUTODARTS_HOST.test(hostname);
    } catch {
      return false;
    }
  }

  root.raspdartsForward = { shouldForward };
})(globalThis);
