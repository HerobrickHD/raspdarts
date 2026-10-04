const BASE_URL = 'http://raspdarts.local:8743';

// Simple request/response via sendMessage
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'fetch') return false;
  fetch(`${BASE_URL}${msg.url}`, {
    method: msg.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
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
      response = await fetch(`${BASE_URL}${msg.url}`, { method: 'POST' });
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
