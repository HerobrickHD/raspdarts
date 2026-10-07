import { beforeAll, describe, expect, test } from 'vitest';

let vm;
let t;
beforeAll(async () => {
  await import('../src/texts.js');
  await import('../src/view-model.js');
  vm = globalThis.raspdartsViewModel;
  t = globalThis.raspdartsTexts.getTexts('de');
});

const STATUS = {
  cpu_percent: 12,
  ram_used_mb: 1229,
  ram_total_mb: 3789,
  temp_celsius: 48,
  uptime_seconds: 11520,
  autodarts_version: '2.0.2',
  autodarts_board: { running: true, connected: true, status: 'Throw' },
  raspdarts_version: '2.0.0',
  ip_address: '192.168.178.42',
  beamer: { ingest_connected: true },
};

describe('formatUptime', () => {
  test.each([
    [0, '0m'],
    [59, '0m'],
    [3599, '59m'],
    [3600, '1h 0m'],
    [11520, '3h 12m'],
    [undefined, '--'],
    [null, '--'],
  ])('%s -> %s', (seconds, expected) => {
    expect(vm.formatUptime(seconds)).toBe(expected);
  });
});

describe('formatRam', () => {
  test('eine Nachkommastelle in GB', () => {
    expect(vm.formatRam(1024, 4096)).toBe('1.0 / 4.0 GB');
    expect(vm.formatRam(1229, 3789)).toBe('1.2 / 3.7 GB');
  });

  test('fehlender Wert -> --', () => {
    expect(vm.formatRam(undefined, 4096)).toBe('--');
    expect(vm.formatRam(1024, null)).toBe('--');
  });
});

describe('buildView', () => {
  test('laedt: Werte leer, Knoepfe gesperrt, Karten sichtbar', () => {
    const view = vm.buildView({ status: null, reachable: null, busy: false }, t);
    expect(view.pill).toEqual({ tone: 'pending', text: 'Verbinde …' });
    expect(view.stats).toEqual({ cpu: '--', ram: '--', temperature: '--', uptime: '--' });
    expect(view.showCards).toBe(true);
    expect(view.showHint).toBe(false);
    expect(view.disabled).toBe(true);
    expect(view.autodarts).toEqual({ version: '--', stateText: '--', stateTone: 'off', showInstall: false });
    expect(view.pi).toEqual({ raspdartsVersion: '--', beamerText: '--', beamerTone: 'off' });
  });

  test('erreichbar: alle Werte, Knoepfe frei', () => {
    const view = vm.buildView({ status: STATUS, reachable: true, busy: false }, t);
    expect(view.pill).toEqual({ tone: 'ok', text: 'Pi online · 192.168.178.42' });
    expect(view.stats).toEqual({ cpu: '12%', ram: '1.2 / 3.7 GB', temperature: '48°C', uptime: '3h 12m' });
    expect(view.showCards).toBe(true);
    expect(view.showHint).toBe(false);
    expect(view.disabled).toBe(false);
    expect(view.autodarts).toEqual({ version: '2.0.2', stateText: 'Läuft', stateTone: 'ok', showInstall: false });
    expect(view.pi).toEqual({ raspdartsVersion: 'v2.0.0', beamerText: 'Verbunden', beamerTone: 'ok' });
  });

  test('Autodarts nicht installiert: Installationskasten', () => {
    const view = vm.buildView({ status: { ...STATUS, autodarts_version: 'unknown', autodarts_board: null }, reachable: true, busy: false }, t);
    expect(view.autodarts).toEqual({ version: '--', stateText: 'Nicht installiert', stateTone: 'off', showInstall: true });
  });

  test.each([
    ['Scheibe antwortet nicht', null, 'Keine Antwort', 'off'],
    ['laeuft ohne Verbindung', { running: true, connected: false, status: 'Throw' }, 'Nicht mit Autodarts verbunden', 'error'],
    ['gestoppt', { running: false, connected: true, status: 'Stopped' }, 'Gestoppt', 'off'],
  ])('Zustand: %s', (_name, board, text, tone) => {
    const view = vm.buildView({ status: { ...STATUS, autodarts_board: board }, reachable: true, busy: false }, t);
    expect(view.autodarts).toEqual({ version: '2.0.2', stateText: text, stateTone: tone, showInstall: false });
  });

  test('Pi ohne autodarts_board (aelterer Raspdarts-Dienst): Keine Antwort', () => {
    const { autodarts_board, ...rest } = STATUS;
    const view = vm.buildView({ status: rest, reachable: true, busy: false }, t);
    expect(view.autodarts.stateText).toBe('Keine Antwort');
  });

  test('nicht erreichbar: kein Installationskasten', () => {
    const view = vm.buildView({ status: { ...STATUS, autodarts_version: 'unknown' }, reachable: false, busy: false }, t);
    expect(view.autodarts.showInstall).toBe(false);
  });

  test('Aktion laeuft: Knoepfe gesperrt, Werte bleiben', () => {
    const view = vm.buildView({ status: STATUS, reachable: true, busy: true }, t);
    expect(view.disabled).toBe(true);
    expect(view.stats.cpu).toBe('12%');
  });

  test('nicht erreichbar: Hinweis statt Karten, alte Werte verworfen', () => {
    const view = vm.buildView({ status: STATUS, reachable: false, busy: false }, t);
    expect(view.pill).toEqual({ tone: 'error', text: 'Pi nicht erreichbar' });
    expect(view.stats).toEqual({ cpu: '--', ram: '--', temperature: '--', uptime: '--' });
    expect(view.showCards).toBe(false);
    expect(view.showHint).toBe(true);
    expect(view.disabled).toBe(true);
  });

  test('nicht erreichbar waehrend einer Aktion: bleibt gesperrt', () => {
    const view = vm.buildView({ status: STATUS, reachable: false, busy: true }, t);
    expect(view.disabled).toBe(true);
    expect(view.showHint).toBe(true);
  });

  test('Temperatur auf ganze Grad gerundet (der Pi liefert Tausendstel)', () => {
    const at = (temp_celsius) => vm.buildView({ status: { ...STATUS, temp_celsius }, reachable: true, busy: false }, t).stats.temperature;
    expect(at(48.312)).toBe('48°C');
    expect(at(48.5)).toBe('49°C');
  });

  test('Wert 0 wird angezeigt, nicht als leer', () => {
    const view = vm.buildView({ status: { ...STATUS, cpu_percent: 0, uptime_seconds: 0, temp_celsius: 0 }, reachable: true, busy: false }, t);
    expect(view.stats.cpu).toBe('0%');
    expect(view.stats.uptime).toBe('0m');
    expect(view.stats.temperature).toBe('0°C');
  });

  test('unvollstaendige Antwort: fehlende Felder als --', () => {
    const view = vm.buildView({ status: { autodarts_version: '2.0.2', temp_celsius: null }, reachable: true, busy: false }, t);
    expect(view.pill).toEqual({ tone: 'ok', text: 'Pi online' });
    expect(view.stats).toEqual({ cpu: '--', ram: '--', temperature: '--', uptime: '--' });
    expect(view.autodarts).toEqual({ version: '2.0.2', stateText: 'Keine Antwort', stateTone: 'off', showInstall: false });
    expect(view.pi).toEqual({ raspdartsVersion: '--', beamerText: 'Nicht verbunden', beamerTone: 'off' });
  });

  test('fehlende Autodarts-Version gilt als nicht installiert', () => {
    const { autodarts_version, ...rest } = STATUS;
    const view = vm.buildView({ status: rest, reachable: true, busy: false }, t);
    expect(view.autodarts.showInstall).toBe(true);
  });

  test('englische Texte', () => {
    const en = globalThis.raspdartsTexts.getTexts('en');
    const view = vm.buildView({ status: STATUS, reachable: true, busy: false }, en);
    expect(view.autodarts.stateText).toBe('Running');
    expect(view.pi.beamerText).toBe('Connected');
  });
});

describe('errorMessage', () => {
  test.each([
    ['Unreachable', 'Fehler: Pi nicht erreichbar'],
    ['Stream error', 'Fehler: Übertragung abgebrochen'],
    ['HTTP 500', 'Fehler: HTTP 500'],
    ['Skript beendet mit Code 1', 'Fehler: Skript beendet mit Code 1'],
    [undefined, 'Fehler: Anfrage fehlgeschlagen.'],
    ['', 'Fehler: Anfrage fehlgeschlagen.'],
  ])('%s -> %s', (error, expected) => {
    expect(vm.errorMessage(error, t)).toBe(expected);
  });

  test('englisch', () => {
    const en = globalThis.raspdartsTexts.getTexts('en');
    expect(vm.errorMessage('Unreachable', en)).toBe('Error: Pi unreachable');
    expect(vm.errorMessage('Stream error', en)).toBe('Error: Transfer interrupted');
  });
});

describe('ACTIONS', () => {
  test('keine Autodarts-Aktionen mehr', () => {
    expect(Object.keys(vm.ACTIONS).sort()).toEqual(['restart', 'shutdown', 'uninstallRaspdarts', 'updateRaspdarts']);
  });

  test('jede Aktion hat Dialogtexte', () => {
    for (const key of Object.keys(vm.ACTIONS)) {
      expect(t.dialogs[key], key).toBeDefined();
    }
  });

  test('Neustart und Herunterfahren haben eine Abschlussmeldung', () => {
    expect(t[vm.ACTIONS.restart.doneText]).toBe('Pi startet neu …');
    expect(t[vm.ACTIONS.shutdown.doneText]).toBe('Pi fährt herunter …');
  });
});
