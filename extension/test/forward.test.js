import { beforeAll, describe, expect, test } from 'vitest';

let shouldForward;
beforeAll(async () => {
  await import('../src/forward.js');
  shouldForward = globalThis.raspdartsForward.shouldForward;
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
