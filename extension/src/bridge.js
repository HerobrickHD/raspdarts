// Bruecke vom Seitenkontext zum Hintergrund: nimmt die von page-hook.js
// mitgelesenen Nachrichten an und schickt sie ueber einen Port weiter.
// Der offene Port sagt dem Hintergrund auch: es gibt einen Autodarts-Tab.
(function () {
  const HEARTBEAT_MS = 20_000;
  let port = null;

  function ensurePort() {
    if (port) return port;
    port = chrome.runtime.connect({ name: 'raspdarts-ingest' });
    port.onDisconnect.addListener(() => { port = null; });
    return port;
  }

  function send(message) {
    try {
      ensurePort().postMessage(message);
    } catch {
      port = null; // Hintergrund neu gestartet - beim naechsten Mal neu verbinden
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'raspdarts-hook') return;
    send({ type: 'frame', data: event.data.data });
  });

  // Haelt den Chrome-Service-Worker wach, solange der Tab offen ist; sonst
  // wuerde er nach 30 s Leerlauf samt Verbindung zum Pi beendet.
  setInterval(() => send({ type: 'heartbeat' }), HEARTBEAT_MS);
  ensurePort();
})();
