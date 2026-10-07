import { beforeAll, describe, expect, test } from 'vitest';

let texts;
beforeAll(async () => {
  await import('../src/texts.js');
  texts = globalThis.raspdartsTexts;
});

// Alle Schluessel eines Objekts, verschachtelte als "a.b".
function keysOf(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
}

describe('detectLanguage', () => {
  test.each([
    ['Hauptnavigation', 'de'],
    ['Main navigation', 'en'],
    ['', 'en'],
    [null, 'en'],
    [undefined, 'en'],
  ])('%s -> %s', (label, expected) => {
    expect(texts.detectLanguage(label)).toBe(expected);
  });
});

describe('getTexts', () => {
  test('liefert die deutsche Tabelle', () => {
    expect(texts.getTexts('de').temperature).toBe('Temperatur');
  });

  test('faellt bei unbekannter Sprache auf Englisch zurueck', () => {
    expect(texts.getTexts('fr').temperature).toBe('Temperature');
  });

  test('beide Tabellen haben dieselben Schluessel', () => {
    expect(keysOf(texts.getTexts('de')).sort()).toEqual(keysOf(texts.getTexts('en')).sort());
  });

  test('kein Text ist leer', () => {
    for (const language of ['de', 'en']) {
      const table = texts.getTexts(language);
      for (const key of keysOf(table)) {
        const value = key.split('.').reduce((obj, part) => obj[part], table);
        expect(typeof value === 'string' && value.length > 0, `${language}: ${key}`).toBe(true);
      }
    }
  });

  test('jede Aktion hat Titel, Text und Bestaetigung', () => {
    const actions = ['updateRaspdarts', 'uninstallRaspdarts', 'restart', 'shutdown'];
    for (const language of ['de', 'en']) {
      expect(Object.keys(texts.getTexts(language).dialogs).sort()).toEqual([...actions].sort());
    }
  });
});
