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
  // Nur das fruehere Kamerafenster auf der Board-Karte hat Bilder geholt.
  test('wird nicht mehr beantwortet und holt nichts vom Pi', () => {
    const spy = vi.spyOn(globalThis, 'fetch');

    const answers = messageListeners.map((listener) => listener({ type: 'image', cam: 0 }, {}, () => {}));

    expect(answers.some((answer) => answer === true)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('Nachricht fetch', () => {
  // Ist der Pi ganz weg, haengt fetch sonst bis zum TCP-Zeitlimit des Systems;
  // so lange zeigte das Fenster "Verbinde …".
  test('bricht nach 8 s ab und meldet den Pi als nicht erreichbar', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      const signal = options?.signal;
      if (signal?.aborted) reject(signal.reason);
      signal?.addEventListener('abort', () => reject(signal.reason));
    }));
    timeout.mockImplementation(() => AbortSignal.abort(new DOMException('Zeitlimit', 'TimeoutError')));

    const result = await send({ type: 'fetch', url: '/api/status' });

    expect(timeout).toHaveBeenCalledWith(8000);
    expect(result).toEqual({ ok: false, error: 'Unreachable' });
  });
});
