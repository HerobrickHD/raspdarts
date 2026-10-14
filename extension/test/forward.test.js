import { beforeAll, describe, expect, test } from 'vitest';

let shouldForward;
let matchStateFrame;
beforeAll(async () => {
  await import('../src/forward.js');
  ({ shouldForward, matchStateFrame } = globalThis.raspdartsForward);
});

describe('shouldForward', () => {
  test.each([
    ['wss://api.autodarts.io/ms/v0/subscribe?ticket=abc', true],
    ['wss://api.autodarts.com/ms/v0/subscribe', true],
    ['wss://autodarts.io/', true],
    ['wss://evil-autodarts.io/', false],
    ['wss://autodarts.io.evil.com/', false],
    ['https://api.autodarts.io/bs/v0/boards', false],
    ['ws://raspdarts.local:8743/ingest', false],
    ['kein url', false],
  ])('%s -> %s', (url, expected) => {
    expect(shouldForward(url)).toBe(expected);
  });
});

describe('matchStateFrame', () => {
  const URL_OK = 'https://api.autodarts.com/gs/v0/matches/m-1/state';
  const STATE = { id: 'm-1', players: [{ name: 'A' }], gameScores: [501] };

  test('Antwort auf den Match-Zustand wird zum gleichen Frame wie ueber den WebSocket', () => {
    const frame = JSON.parse(matchStateFrame(URL_OK, 'GET', 200, JSON.stringify(STATE)));
    expect(frame).toEqual({ channel: 'autodarts.matches', topic: 'm-1.state', data: STATE });
  });

  test('schon geparste Antwort (responseType json) geht auch', () => {
    const frame = JSON.parse(matchStateFrame(URL_OK, 'get', 200, STATE));
    expect(frame.data).toEqual(STATE);
  });

  test.each([
    ['anderer Pfad', 'https://api.autodarts.com/gs/v0/matches/m-1/stats', 'GET', 200, STATE],
    ['Board-Zustand', 'https://api.autodarts.com/bs/v0/boards/b-1/state', 'GET', 200, STATE],
    ['fremder Host', 'https://evil-autodarts.com/gs/v0/matches/m-1/state', 'GET', 200, STATE],
    ['kein https', 'http://api.autodarts.com/gs/v0/matches/m-1/state', 'GET', 200, STATE],
    ['POST', URL_OK, 'POST', 200, STATE],
    ['Fehler', URL_OK, 'GET', 404, STATE],
    ['kein JSON', URL_OK, 'GET', 200, '<html>'],
    ['kein Objekt', URL_OK, 'GET', 200, '[1,2]'],
    ['leer', URL_OK, 'GET', 200, null],
    ['kein url', 'kein url', 'GET', 200, STATE],
  ])('%s -> null', (_, url, method, status, body) => {
    expect(matchStateFrame(url, method, status, typeof body === 'object' && body ? JSON.stringify(body) : body)).toBeNull();
  });
});
