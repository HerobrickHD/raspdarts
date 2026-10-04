const BASE_URL = 'http://raspdarts.local:8743';
const INGEST_URL = 'ws://raspdarts.local:8743/ingest';
// Ohne diesen Header lehnt der Pi jede /api-Anfrage ab (Schutz vor fremden Webseiten).
const CLIENT_HEADERS = { 'X-Raspdarts': '1' };

// Simple request/response via sendMessage
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'fetch') return false;
  fetch(`${BASE_URL}${msg.url}`, {
    method: msg.method || 'GET',
    headers: msg.body ? { ...CLIENT_HEADERS, 'Content-Type': 'application/json' } : CLIENT_HEADERS,
    body: msg.body ? JSON.stringify(msg.body) : undefined,
  })
    .then(async (res) => {
      const data = await res.json();
      sendResponse({ ok: res.ok, status: res.status, data });
    })
    .catch(() => sendResponse({ ok: false, error: 'Unreachable' }));
  return true; // async response
});

// SSE streaming via long-lived port
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'raspdarts-stream') return;

  let cancelled = false;
  let reader = null;

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'stream-cancel') {
      cancelled = true;
      port.disconnect();
      return;
    }

    if (msg.type !== 'stream-start') return;

    let response;
    try {
      response = await fetch(`${BASE_URL}${msg.url}`, { method: 'POST', headers: CLIENT_HEADERS });
    } catch {
      port.postMessage({ type: 'done', success: false, error: 'Unreachable' });
      port.disconnect();
      return;
    }

    if (response.status === 409) {
      port.postMessage({ type: 'conflict' });
      port.disconnect();
      return;
    }

    if (!response.ok) {
      port.postMessage({ type: 'done', success: false, error: `HTTP ${response.status}` });
      port.disconnect();
      return;
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Parse lines from stream and forward to content script
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done || cancelled) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // unvollständige Zeile aufheben

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (cancelled) break;
            port.postMessage(parsed);
            if (parsed.type === 'done') {
              port.disconnect();
              return;
            }
          } catch {}
        }
      }
    };

    pump().catch(() => {
      if (!cancelled) port.postMessage({ type: 'done', success: false, error: 'Stream error' });
      port.disconnect();
    });
  });
});

// --- Spieldaten an den Pi weiterreichen ---------------------------------------
// Eine Verbindung zum Pi, solange mindestens ein Autodarts-Tab offen ist.
// Was waehrend einer Unterbrechung ankommt, wird verworfen: Autodarts schickt
// bei jeder Aenderung ohnehin den vollstaendigen Match-Stand.

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const ingestPorts = new Set();
let ingestSocket = null;
let reconnectDelay = RECONNECT_MIN_MS;
let reconnectTimer = null;

function openIngest() {
  if (ingestSocket || ingestPorts.size === 0) return;
  const socket = new WebSocket(INGEST_URL);
  ingestSocket = socket;
  socket.addEventListener('open', () => { reconnectDelay = RECONNECT_MIN_MS; });
  socket.addEventListener('close', () => {
    if (ingestSocket === socket) ingestSocket = null;
    scheduleReconnect();
  });
  socket.addEventListener('error', () => {}); // close folgt
}

function scheduleReconnect() {
  if (reconnectTimer || ingestPorts.size === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openIngest();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
}

function closeIngest() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const socket = ingestSocket;
  ingestSocket = null;
  socket?.close();
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'raspdarts-ingest') return;
  ingestPorts.add(port);
  openIngest();

  port.onMessage.addListener((msg) => {
    if (msg.type === 'frame' && ingestSocket?.readyState === WebSocket.OPEN) {
      ingestSocket.send(msg.data);
    }
  });
  port.onDisconnect.addListener(() => {
    ingestPorts.delete(port);
    if (ingestPorts.size === 0) closeIngest();
  });
});
