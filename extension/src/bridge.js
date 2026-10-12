// Bruecke vom Seitenkontext zum Hintergrund: nimmt die von page-hook.js
// mitgelesenen Nachrichten an und schickt sie ueber einen Port weiter - aber
// nur, wenn die Weitergabe eingeschaltet ist (Viewer-Fenster, forwarding.js).
// Der offene Port sagt dem Hintergrund auch: es gibt einen Autodarts-Tab; ohne
// Port baut er die Verbindung zum Pi ab.
(function () {
  const { FORWARD_KEY, isForwardingOn } = globalThis.raspdartsForwarding;
  const HEARTBEAT_MS = 20_000;
  let port = null;
  let heartbeat = null;
  // Bis der gespeicherte Wert gelesen ist, geht nichts raus (Privatsphaere
  // vor den ersten Nachrichten; Autodarts schickt den Stand ohnehin erneut).
  let on = false;

  function connect() {
    if (port) return;
    port = chrome.runtime.connect({ name: 'raspdarts-ingest' });
    port.onDisconnect.addListener(() => { port = null; });
  }

  function disconnect() {
    const current = port;
    port = null;
    try {
      current?.disconnect();
    } catch {
      // Hintergrund schon weg
    }
  }

  function send(message) {
    if (!on) return;
    try {
      connect();
      port.postMessage(message);
    } catch {
      port = null; // Hintergrund neu gestartet - beim naechsten Mal neu verbinden
    }
  }

  function apply(value) {
    on = isForwardingOn(value);
    clearInterval(heartbeat);
    heartbeat = null;
    if (!on) {
      disconnect();
      return;
    }
    connect();
    // Haelt den Chrome-Service-Worker wach, solange der Tab offen ist; sonst
    // wuerde er nach 30 s Leerlauf samt Verbindung zum Pi beendet.
    heartbeat = setInterval(() => send({ type: 'heartbeat' }), HEARTBEAT_MS);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'raspdarts-hook') return;
    send({ type: 'frame', data: event.data.data });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && FORWARD_KEY in changes) apply(changes[FORWARD_KEY].newValue);
  });
  chrome.storage.local.get(FORWARD_KEY, (items) => apply(items?.[FORWARD_KEY]));
})();
