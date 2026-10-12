import { beforeAll, describe, expect, test } from 'vitest';

let view;
let t;
beforeAll(async () => {
  await import('../src/texts.js');
  await import('../src/cams-view.js');
  view = globalThis.raspdartsCamsView;
  t = globalThis.raspdartsTexts.getTexts('de');
});

const image = (dataUrl) => ({ ok: true, status: 200, dataUrl });
const failure = (status) => ({ ok: false, status });

describe('isBoardsPage', () => {
  test('nur die Boards-Uebersicht', () => {
    expect(view.isBoardsPage('/boards')).toBe(true);
    expect(view.isBoardsPage('/boards/')).toBe(true);
    expect(view.isBoardsPage('/boards/b-1/follow')).toBe(false);
    expect(view.isBoardsPage('/')).toBe(false);
  });
});

describe('buttonState', () => {
  test('klickbar nur, wenn die Karte Running zeigt', () => {
    expect(view.buttonState('Running', t)).toEqual({ enabled: true, title: 'Kameras' });
    expect(view.buttonState(' Running ', t).enabled).toBe(true);
  });

  test('ausgegraut mit Hinweis bei jedem anderen Zustand', () => {
    for (const badge of ['Stopped', 'Starting', 'Offline', '', null, undefined]) {
      expect(view.buttonState(badge, t)).toEqual({
        enabled: false,
        title: 'Kameras – Board ist nicht gestartet',
      });
    }
  });

  test('englische Texte', () => {
    const en = globalThis.raspdartsTexts.getTexts('en');
    expect(view.buttonState('Running', en).title).toBe('Cameras');
    expect(view.buttonState('Stopped', en).title).toBe('Cameras – board is not running');
  });
});

describe('emptyTiles', () => {
  test('eine leere Kachel je Kamera, gezaehlt ab 1', () => {
    expect(view.emptyTiles(2, t)).toEqual([
      { label: 'Kamera 1', src: null, stale: false, note: null },
      { label: 'Kamera 2', src: null, stale: false, note: null },
    ]);
  });
});

describe('windowView', () => {
  test('zeigt die Bilder aller Kameras', () => {
    const result = view.windowView([image('data:a'), image('data:b')], view.emptyTiles(2, t), t);

    expect(result).toEqual({
      message: null,
      tiles: [
        { label: 'Kamera 1', src: 'data:a', stale: false, note: null },
        { label: 'Kamera 2', src: 'data:b', stale: false, note: null },
      ],
    });
  });

  test('Board gestoppt (409): Hinweis statt Bildern, alte Kacheln bleiben erhalten', () => {
    const previous = view.windowView([image('data:a')], view.emptyTiles(1, t), t).tiles;

    const result = view.windowView([failure(409)], previous, t);

    expect(result).toEqual({ message: 'Board ist nicht gestartet', tiles: previous });
  });

  test('eine Kamera ohne Bild (502): letztes Bild abgedunkelt mit Hinweis', () => {
    const previous = view.windowView([image('data:a'), image('data:b')], view.emptyTiles(2, t), t).tiles;

    const result = view.windowView([image('data:a2'), failure(502)], previous, t);

    expect(result.message).toBeNull();
    expect(result.tiles[0]).toEqual({ label: 'Kamera 1', src: 'data:a2', stale: false, note: null });
    expect(result.tiles[1]).toEqual({ label: 'Kamera 2', src: 'data:b', stale: true, note: 'Kein Bild' });
  });

  test('404 (Kamera abgesteckt) ohne frueheres Bild: leere Kachel mit Hinweis', () => {
    const result = view.windowView([image('data:a'), failure(404)], view.emptyTiles(2, t), t);

    expect(result.tiles[1]).toEqual({ label: 'Kamera 2', src: null, stale: true, note: 'Kein Bild' });
  });

  test('Pi nicht erreichbar: jede Kachel behaelt ihr letztes Bild abgedunkelt', () => {
    const previous = view.windowView([image('data:a'), image('data:b')], view.emptyTiles(2, t), t).tiles;
    const unreachable = { ok: false, status: 0, error: 'Unreachable' };

    const result = view.windowView([unreachable, undefined], previous, t);

    expect(result.message).toBeNull();
    expect(result.tiles.map((tile) => [tile.src, tile.stale, tile.note])).toEqual([
      ['data:a', true, 'Kein Bild'],
      ['data:b', true, 'Kein Bild'],
    ]);
  });

  test('nach dem Standby kommen die Bilder zurueck', () => {
    const stopped = view.windowView([failure(409)], view.emptyTiles(2, t), t);

    const result = view.windowView([image('data:a'), image('data:b')], stopped.tiles, t);

    expect(result.message).toBeNull();
    expect(result.tiles.map((tile) => tile.src)).toEqual(['data:a', 'data:b']);
  });
});
