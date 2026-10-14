// Liest die WebSocket-Nachrichten von play.autodarts.com mit. Laeuft im
// Seitenkontext ab document_start, damit window.WebSocket ersetzt ist, bevor
// die Seite ihre Verbindung oeffnet.
//
// Die Ersetzung ist eine Unterklasse des echten WebSocket: Die Seite bekommt
// ein voll funktionsfaehiges Objekt, nur mit einem zusaetzlichen Zuhoerer.
// Genauso bei XMLHttpRequest - dort zaehlt nur die Antwort auf den
// Match-Zustand (der Stand beim Spielstart, forward.js).
(function () {
  const { shouldForward, matchStateFrame } = window.raspdartsForward;
  const NativeWebSocket = window.WebSocket;
  const NativeXMLHttpRequest = window.XMLHttpRequest;

  const post = (data) => {
    window.postMessage({ source: 'raspdarts-hook', data }, window.location.origin);
  };

  const forward = (event) => {
    if (typeof event.data !== 'string') return;
    post(event.data);
  };

  window.WebSocket = class extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      if (shouldForward(this.url)) this.addEventListener('message', forward);
    }
  };

  window.XMLHttpRequest = class extends NativeXMLHttpRequest {
    #method = '';

    constructor(...args) {
      super(...args);
      this.addEventListener('load', () => {
        try {
          const type = this.responseType;
          if (type !== '' && type !== 'text' && type !== 'json') return;
          const body = type === 'json' ? this.response : this.responseText;
          const frame = matchStateFrame(this.responseURL, this.#method, this.status, body);
          if (frame !== null) post(frame);
        } catch {
          // Mitlesen darf die Seite nie stoeren.
        }
      });
    }

    open(method, ...rest) {
      this.#method = method;
      return super.open(method, ...rest);
    }
  };
})();
