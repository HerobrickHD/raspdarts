import { beforeAll, describe, expect, test } from 'vitest';

let fwd;
beforeAll(async () => {
  await import('../src/forwarding.js');
  fwd = globalThis.raspdartsForwarding;
});

describe('isForwardingOn', () => {
  test('ohne gespeicherten Wert ist die Weitergabe an', () => {
    expect(fwd.isForwardingOn(undefined)).toBe(true);
  });

  test('nur genau false schaltet aus', () => {
    expect(fwd.isForwardingOn(false)).toBe(false);
    expect(fwd.isForwardingOn(true)).toBe(true);
    expect(fwd.isForwardingOn(null)).toBe(true);
    expect(fwd.isForwardingOn('false')).toBe(true);
  });

  test('Speicherschluessel', () => {
    expect(fwd.FORWARD_KEY).toBe('forwardGameData');
  });
});
