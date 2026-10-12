import { afterEach, describe, expect, test, vi } from 'vitest';

// bridge.js laeuft als Content-Script; hier mit nachgemachtem window und chrome.
async function loadBridge(stored, { deferRead = false, readError = false } = {}) {
  const state = { stored, pendingRead: null };
  const ports = [];
  const changeListeners = [];
  const fakeWindow = new EventTarget();
  globalThis.window = fakeWindow;
  globalThis.chrome = {
    runtime: {
      connect: () => {
        const port = {
          posted: [],
          disconnected: false,
          postMessage(m) { this.posted.push(m); },
          disconnect() { this.disconnected = true; },
          onDisconnect: { addListener() {} },
        };
        ports.push(port);
        return port;
      },
    },
    storage: {
      local: {
        get: (key, cb) => {
          const answer = () => {
            if (readError) {
              globalThis.chrome.runtime.lastError = { message: 'kaputt' };
              cb(undefined);
              delete globalThis.chrome.runtime.lastError;
              return;
            }
            cb(state.stored === undefined ? {} : { [key]: state.stored });
          };
          if (deferRead) state.pendingRead = answer;
          else answer();
        },
      },
      onChanged: { addListener: (fn) => changeListeners.push(fn) },
    },
  };
  vi.resetModules(); // bridge.js je Test frisch ausfuehren
  await import('../src/forwarding.js');
  await import('../src/bridge.js');
  const frame = (data) => {
    const event = new Event('message');
    Object.defineProperty(event, 'source', { value: fakeWindow });
    Object.defineProperty(event, 'data', { value: { source: 'raspdarts-hook', data } });
    fakeWindow.dispatchEvent(event);
  };
  const change = (newValue) => changeListeners.forEach((fn) => fn({ forwardGameData: { newValue } }, 'local'));
  const pageEvent = (type, persisted) => {
    const event = new Event(type);
    Object.defineProperty(event, 'persisted', { value: persisted });
    fakeWindow.dispatchEvent(event);
  };
  return { ports, frame, change, state, pageEvent };
}

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.window;
  delete globalThis.chrome;
});

describe('bridge', () => {
  test('ohne gespeicherten Wert: verbindet und reicht Frames weiter', async () => {
    vi.useFakeTimers();
    const { ports, frame } = await loadBridge(undefined);

    frame('{"a":1}');

    expect(ports).toHaveLength(1);
    expect(ports[0].posted).toEqual([{ type: 'frame', data: '{"a":1}' }]);
  });

  test('ausgeschaltet: keine Verbindung, keine Frames', async () => {
    vi.useFakeTimers();
    const { ports, frame } = await loadBridge(false);

    frame('{"a":1}');
    vi.advanceTimersByTime(60_000); // auch kein Heartbeat

    expect(ports).toHaveLength(0);
  });

  test('schaltet bei Aenderung im Speicher sofort ab', async () => {
    vi.useFakeTimers();
    const { ports, frame, change } = await loadBridge(true);

    change(false);
    frame('{"a":1}');

    expect(ports[0].disconnected).toBe(true);
    expect(ports[0].posted).toEqual([]);
    expect(ports).toHaveLength(1);
  });

  test('schaltet bei Aenderung im Speicher wieder an', async () => {
    vi.useFakeTimers();
    const { ports, frame, change } = await loadBridge(false);

    change(true);
    frame('{"b":2}');

    expect(ports).toHaveLength(1);
    expect(ports[0].posted).toEqual([{ type: 'frame', data: '{"b":2}' }]);
  });

  test('fremde Nachrichten werden nie weitergereicht', async () => {
    vi.useFakeTimers();
    const { ports } = await loadBridge(true);
    const event = new Event('message');
    Object.defineProperty(event, 'source', { value: globalThis.window });
    Object.defineProperty(event, 'data', { value: { source: 'jemand-anders', data: 'x' } });

    globalThis.window.dispatchEvent(event);

    expect(ports[0].posted).toEqual([]);
  });

  test('nichts geht raus, bevor der gespeicherte Wert gelesen ist', async () => {
    vi.useFakeTimers();
    const { ports, frame, state } = await loadBridge(undefined, { deferRead: true });

    frame('{"frueh":1}');
    expect(ports).toHaveLength(0);

    state.pendingRead();
    expect(ports).toHaveLength(1);
    expect(ports[0].posted).toEqual([]);
  });

  test('Lesefehler im Speicher: bleibt aus', async () => {
    vi.useFakeTimers();
    const { ports, frame } = await loadBridge(true, { readError: true });

    frame('{"a":1}');

    expect(ports).toHaveLength(0);
  });

  // Zurueck-Taste: die Seite kommt aus dem bfcache; ob storage.onChanged sie
  // dort erreicht hat, ist nicht zugesichert. Deshalb neu lesen.
  test('liest den Schalter neu, wenn die Seite aus dem Cache zurueckkommt', async () => {
    vi.useFakeTimers();
    const { ports, frame, state, pageEvent } = await loadBridge(true);

    pageEvent('pagehide', true);
    state.stored = false; // in einem anderen Tab ausgeschaltet, Ereignis verpasst
    pageEvent('pageshow', true);
    frame('{"a":1}');

    expect(ports[0].posted).toEqual([]);
    expect(ports).toHaveLength(1);
  });
});
