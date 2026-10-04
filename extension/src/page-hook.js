// Liest die WebSocket-Nachrichten von play.autodarts.com mit. Laeuft im
// Seitenkontext ab document_start, damit window.WebSocket ersetzt ist, bevor
// die Seite ihre Verbindung oeffnet.
//
// Die Ersetzung ist eine Unterklasse des echten WebSocket: Die Seite bekommt
// ein voll funktionsfaehiges Objekt, nur mit einem zusaetzlichen Zuhoerer.
(function () {
  const { shouldForward } = window.raspdartsForward;
  const NativeWebSocket = window.WebSocket;

  const forward = (event) => {
    if (typeof event.data !== 'string') return;
    window.postMessage({ source: 'raspdarts-hook', data: event.data }, window.location.origin);
  };

  window.WebSocket = class extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      if (shouldForward(this.url)) this.addEventListener('message', forward);
    }
  };
})();
