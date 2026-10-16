import { beforeAll, describe, expect, test } from 'vitest';

let vv;
let t;
let en;
beforeAll(async () => {
  await import('../src/texts.js');
  await import('../src/viewer-view.js');
  vv = globalThis.raspdartsViewerView;
  t = globalThis.raspdartsTexts.getTexts('de');
  en = globalThis.raspdartsTexts.getTexts('en');
});

const NOW = Date.parse('2026-10-12T15:00:10Z');
const connected = (last) => ({ beamer: { ingest_connected: true, last_message_at: last } });

describe('viewerButtonState', () => {
  test('an: Monitor, Hinweis "Viewer (an)"', () => {
    expect(vv.viewerButtonState(true, t)).toEqual({ on: true, icon: 'monitor', title: 'Viewer (an)' });
  });

  test('aus: durchgestrichener Monitor, Hinweis "Viewer (aus)"', () => {
    expect(vv.viewerButtonState(false, t)).toEqual({ on: false, icon: 'monitorOff', title: 'Viewer (aus)' });
  });

  test('englisch', () => {
    expect(vv.viewerButtonState(false, en).title).toBe('Viewer (off)');
  });
});

describe('viewerBlock', () => {
  test('aus: Weitergabe ausgeschaltet, egal was der Pi meldet', () => {
    const view = vv.viewerBlock({ forwardOn: false, status: connected('2026-10-12T15:00:07Z'), reachable: true, now: NOW }, t);
    expect(view).toEqual({ on: false, switchText: 'Aus', stateText: 'Weitergabe ausgeschaltet', stateTone: 'off' });
  });

  test('an und verbunden: Alter der letzten Nachricht in Sekunden', () => {
    const view = vv.viewerBlock({ forwardOn: true, status: connected('2026-10-12T15:00:07Z'), reachable: true, now: NOW }, t);
    expect(view).toEqual({ on: true, switchText: 'An', stateText: 'Verbunden – letzte Nachricht vor 3 s', stateTone: 'ok' });
  });

  test('verbunden ohne Nachricht', () => {
    const view = vv.viewerBlock({ forwardOn: true, status: connected(null), reachable: true, now: NOW }, t);
    expect(view.stateText).toBe('Verbunden – noch keine Nachricht');
    expect(view.stateTone).toBe('ok');
  });

  test('Uhr des Pi voraus: nie negative Sekunden', () => {
    const view = vv.viewerBlock({ forwardOn: true, status: connected('2026-10-12T15:00:20Z'), reachable: true, now: NOW }, t);
    expect(view.stateText).toBe('Verbunden – letzte Nachricht vor 0 s');
  });

  test('nicht verbunden', () => {
    const view = vv.viewerBlock({ forwardOn: true, status: { beamer: { ingest_connected: false, last_message_at: null } }, reachable: true, now: NOW }, t);
    expect(view).toEqual({ on: true, switchText: 'An', stateText: 'Nicht verbunden', stateTone: 'off' });
  });

  test('Pi nicht erreichbar', () => {
    const view = vv.viewerBlock({ forwardOn: true, status: null, reachable: false, now: NOW }, t);
    expect(view.stateText).toBe('Pi nicht erreichbar');
    expect(view.stateTone).toBe('error');
  });

  test('noch keine Antwort vom Pi', () => {
    const view = vv.viewerBlock({ forwardOn: true, status: null, reachable: null, now: NOW }, t);
    expect(view.stateText).toBe('Verbinde …');
    expect(view.stateTone).toBe('pending');
  });
});

describe('pickBoardId', () => {
  test('nimmt die ID vom Pi', () => {
    expect(vv.pickBoardId({ ok: true, data: { board_id: 'b-1', cams: 3 } }, 'alt')).toBe('b-1');
  });

  test('Pi nicht erreichbar: gemerkte ID', () => {
    expect(vv.pickBoardId({ ok: false, error: 'Unreachable' }, 'alt')).toBe('alt');
    expect(vv.pickBoardId(undefined, 'alt')).toBe('alt');
  });

  test('weder Pi noch gemerkte ID: null', () => {
    expect(vv.pickBoardId({ ok: false }, undefined)).toBeNull();
    expect(vv.pickBoardId({ ok: true, data: { board_id: null } }, '')).toBeNull();
  });
});

describe('viewerLinks', () => {
  test('beide Adressen des Pi, .local zuerst (Fire TV kennt nur fritz.box)', () => {
    expect(vv.viewerLinks()).toEqual([
      { href: 'http://raspdarts.local:8743/', label: 'raspdarts.local ↗' },
      { href: 'http://raspdarts.fritz.box:8743/', label: 'raspdarts.fritz.box ↗' },
    ]);
  });
});
