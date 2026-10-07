'use strict';

// Fuehrt eine Stream-Aktion (Update, Installation) ueber den Port zu
// background.js aus. Ohne DOM, damit es sich testen laesst.
(function (root) {
  // Chrome beendet den Service Worker nach 30 s ohne Ereignis. Ein Update kann
  // laenger still sein (z. B. npm ci); ein Ping ueber den Port haelt ihn wach.
  // background.js ignoriert unbekannte Nachrichten.
  const KEEPALIVE_MS = 20_000;

  // onEnd bekommt genau einmal { kind: 'done', success, error } |
  // { kind: 'conflict' } | { kind: 'disconnected' }.
  function runStream({ connect, url, onLog, onEnd }) {
    const port = connect();
    let finished = false;
    const keepAlive = setInterval(() => port.postMessage({ type: 'ping' }), KEEPALIVE_MS);
    const end = (result) => {
      if (finished) return;
      finished = true;
      clearInterval(keepAlive);
      onEnd(result);
    };

    port.onMessage.addListener((msg) => {
      if (msg.type === 'log') onLog(msg.line);
      else if (msg.type === 'conflict') end({ kind: 'conflict' });
      else if (msg.type === 'done') end({ kind: 'done', success: msg.success, error: msg.error });
    });
    port.onDisconnect.addListener(() => end({ kind: 'disconnected' }));
    port.postMessage({ type: 'stream-start', url });
  }

  root.raspdartsStream = { KEEPALIVE_MS, runStream };
})(globalThis);
