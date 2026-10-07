import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

let runStream;
let KEEPALIVE_MS;
beforeAll(async () => {
  await import('../src/stream.js');
  ({ runStream, KEEPALIVE_MS } = globalThis.raspdartsStream);
});

// Port wie von chrome.runtime.connect, steuerbar aus dem Test.
function fakePort() {
  const messageListeners = [];
  const disconnectListeners = [];
  return {
    sent: [],
    postMessage(msg) { this.sent.push(msg); },
    onMessage: { addListener: (fn) => messageListeners.push(fn) },
    onDisconnect: { addListener: (fn) => disconnectListeners.push(fn) },
    receive: (msg) => messageListeners.forEach((fn) => fn(msg)),
    disconnect: () => disconnectListeners.forEach((fn) => fn()),
  };
}

function start(port) {
  const logs = [];
  const ends = [];
  runStream({ connect: () => port, url: '/api/system/update', onLog: (l) => logs.push(l), onEnd: (r) => ends.push(r) });
  return { logs, ends };
}

const pings = (port) => port.sent.filter((m) => m.type === 'ping').length;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('runStream', () => {
  test('startet den Stream mit der Adresse', () => {
    const port = fakePort();
    start(port);
    expect(port.sent[0]).toEqual({ type: 'stream-start', url: '/api/system/update' });
  });

  test('reicht Protokollzeilen weiter', () => {
    const port = fakePort();
    const { logs } = start(port);
    port.receive({ type: 'log', line: '--- Build ---' });
    expect(logs).toEqual(['--- Build ---']);
  });

  test('haelt den Hintergrund mit Pings wach, solange nichts kommt', () => {
    const port = fakePort();
    start(port);
    vi.advanceTimersByTime(KEEPALIVE_MS * 3);
    expect(pings(port)).toBe(3);
    expect(KEEPALIVE_MS).toBeLessThan(30_000);
  });

  test('pingt nach dem Ende nicht mehr', () => {
    const port = fakePort();
    start(port);
    port.receive({ type: 'done', success: true });
    vi.advanceTimersByTime(KEEPALIVE_MS * 3);
    expect(pings(port)).toBe(0);
  });

  test('done gefolgt von Trennung endet genau einmal', () => {
    const port = fakePort();
    const { ends } = start(port);
    port.receive({ type: 'done', success: false, error: 'exit 1' });
    port.disconnect();
    expect(ends).toEqual([{ kind: 'done', success: false, error: 'exit 1' }]);
  });

  test('laeuft bereits', () => {
    const port = fakePort();
    const { ends } = start(port);
    port.receive({ type: 'conflict' });
    expect(ends).toEqual([{ kind: 'conflict' }]);
  });

  test('Trennung ohne done meldet Abbruch und stoppt die Pings', () => {
    const port = fakePort();
    const { ends } = start(port);
    port.disconnect();
    vi.advanceTimersByTime(KEEPALIVE_MS * 2);
    expect(ends).toEqual([{ kind: 'disconnected' }]);
    expect(pings(port)).toBe(0);
  });
});
