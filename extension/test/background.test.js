import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

// background.js meldet sich nur bei chrome.runtime an; die Listener werden
// hier eingesammelt und direkt aufgerufen.
const messageListeners = [];

beforeAll(async () => {
  globalThis.chrome = {
    runtime: {
      onMessage: { addListener: (fn) => messageListeners.push(fn) },
      onConnect: { addListener: () => {} },
    },
  };
  await import('../src/background.js');
});

afterEach(() => vi.restoreAllMocks());

function send(msg) {
  return new Promise((resolve) => {
    for (const listener of messageListeners) listener(msg, {}, resolve);
  });
}

describe('Nachricht image', () => {
  test('gibt das Bild als Daten-URL zurueck', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200 }));

    const result = await send({ type: 'image', cam: 1 });

    expect(result).toEqual({ ok: true, status: 200, dataUrl: 'data:image/jpeg;base64,/9j/' });
    expect(fetch.mock.calls[0][0]).toBe('http://raspdarts.local:8743/api/cams/1');
  });

  test('meldet den Fehlerstatus des Pi', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 409 }));

    expect(await send({ type: 'image', cam: 0 })).toEqual({ ok: false, status: 409 });
  });

  // Ist der Pi ganz weg (Strom, WLAN), haengt fetch sonst bis zum TCP-Zeitlimit
  // des Systems (Windows ~21 s) und das Fenster zeigt so lange alte Bilder als frisch.
  test('bricht nach 4 s ab und meldet den Pi als nicht erreichbar', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    // wie das echte fetch: ohne Signal haengt es, ein abgebrochenes Signal beendet es
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      const signal = options?.signal;
      if (signal?.aborted) reject(signal.reason);
      signal?.addEventListener('abort', () => reject(signal.reason));
    }));
    timeout.mockImplementation(() => AbortSignal.abort(new DOMException('Zeitlimit', 'TimeoutError')));

    const result = await send({ type: 'image', cam: 0 });

    expect(timeout).toHaveBeenCalledWith(4000);
    expect(result).toEqual({ ok: false, status: 0, error: 'Unreachable' });
  });
});

describe('Nachricht fetch', () => {
  // Ist der Pi ganz weg, haengt fetch sonst bis zum TCP-Zeitlimit des Systems;
  // so lange fehlten die Knoepfe auf der Karte (die gemerkte Board-ID greift
  // erst nach der Antwort) und das Fenster zeigte "Verbinde …".
  test('bricht nach 8 s ab und meldet den Pi als nicht erreichbar', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      const signal = options?.signal;
      if (signal?.aborted) reject(signal.reason);
      signal?.addEventListener('abort', () => reject(signal.reason));
    }));
    timeout.mockImplementation(() => AbortSignal.abort(new DOMException('Zeitlimit', 'TimeoutError')));

    const result = await send({ type: 'fetch', url: '/api/cams' });

    expect(timeout).toHaveBeenCalledWith(8000);
    expect(result).toEqual({ ok: false, error: 'Unreachable' });
  });
});
