# Raspdarts-Seite in Autodarts – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Navigationseintrag „Raspdarts“ öffnet statt des Popups eine eigene Seite im Inhaltsbereich von play.autodarts.com, die wie eine Autodarts-Seite aussieht und dieselben Funktionen bietet.

**Architecture:** Die Seite ist ein `div#raspdarts-page` in Autodarts' `<main>`, ihr Inhalt steckt in einem Shadow DOM (`page.html`/`page.css`). Ein Attribut an `<html>` blendet Autodarts' Inhalt aus und markiert unseren Eintrag aktiv. Reine Logik (Texte, Anzeigewerte) liegt in zwei DOM-freien Dateien mit Vitest-Tests; `page.js` zeigt an, `content.js` steuert.

**Tech Stack:** Browser-Extension Manifest V3 (Chrome, Firefox ≥ 128), plain JavaScript ohne Build-Schritt außer Kopieren (`build.sh`), Vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-07-raspdarts-seite-design.md`

## Global Constraints

- Arbeitsverzeichnis für alle `npm`-Befehle: `extension/`. Tests: `npm test` (Vitest, Node-Umgebung, kein DOM).
- Jede neue `src/*.js` ist ein IIFE, das seine Funktionen an ein Objekt auf `globalThis` hängt (Muster `src/forward.js`). Keine ES-Module in Content-Scripts.
- Content-Script-Reihenfolge in beiden Manifesten: `texts.js`, `view-model.js`, `page.js`, `content.js` (`run_at: document_idle`, isolierte Welt).
- Sprache: Deutsch genau dann, wenn `nav` das `aria-label` `"Hauptnavigation"` trägt, sonst Englisch. `<html lang>` nicht verwenden.
- Farben nur über Autodarts' CSS-Variablen mit festem Ersatzwert, z. B. `var(--color-blue-60, #0b55df)`.
- Keine Klassen an Autodarts' eigenen Elementen ändern. Erlaubt: eigenes `<style>` im Dokument, Attribut `data-raspdarts-page` an `<html>`, Inline-`left`/`width` des Unterstrich-Balkens.
- Abfragen: `/api/status` alle 10 s bei sichtbarer Seite ohne laufende Aktion; alle 30 s im Hintergrund, solange die Seite nicht sichtbar ist.
- `background.js`, `bridge.js`, `forward.js`, `page-hook.js` und `server/` bleiben unverändert.
- Kommentare im Code auf Deutsch ohne Umlaute (wie im übrigen Code), Texte für Nutzer mit Umlauten.

## Review Focus

1. **Unvollständige Status-Antwort** (Feld fehlt oder ist `null`, z. B. ältere Pi-Version ohne `beamer` oder ohne `ip_address`): Die Seite zeigt „--“ statt „undefined%“ oder „NaN GB“. → Test in Task 2.
2. **Wert 0** (`cpu_percent: 0`, `uptime_seconds: 0`): wird als „0%“ bzw. „0m“ angezeigt, nicht als „--“. → Test in Task 2.
3. **Pi verschwindet mitten in einer Aktion** (Update startet den Dienst neu): Die Protokoll-Karte bleibt sichtbar und endet mit einer Meldung, die Knöpfe bleiben gesperrt, bis die Aktion beendet ist. → Test in Task 2 (gesperrt bei `busy` + nicht erreichbar), Prüfung im Browser in Task 5.
4. **Seitenwechsel durch Autodarts, während unsere Seite offen ist** (Klick auf „Spielen“, Logo, Zurück, „Start“ auf `/`): Unsere Seite verschwindet, Autodarts' Inhalt und Unterstrich stimmen wieder. → Prüfung im Browser in Task 5.
5. **Doppelklick auf einen Aktionsknopf oder Escape im Dialog**: Höchstens eine Aktion startet; Escape bricht ab. → `busy`-Sperre in Task 4, Prüfung im Browser in Task 5.

---

## Dateien

| Datei | Aufgabe | Task |
|---|---|---|
| `extension/src/texts.js` (neu) | `globalThis.raspdartsTexts`: Texttabellen `de`/`en`, Spracherkennung | 1 |
| `extension/test/texts.test.js` (neu) | Tests dazu | 1 |
| `extension/src/view-model.js` (neu) | `globalThis.raspdartsViewModel`: Aktionstabelle, Formatierung, `buildView` | 2 |
| `extension/test/view-model.test.js` (neu) | Tests dazu | 2 |
| `extension/page.html`, `extension/page.css` (neu) | Aufbau und Stil der Seite | 3 |
| `extension/src/page.js` (neu) | `globalThis.raspdartsPage.create()`: Shadow DOM, `render`, Dialog, Protokoll-Karte | 3 |
| `extension/src/content.js` | Navigationseintrag, Seite zeigen/verstecken, Unterstrich, Abfragen, Aktionen | 4 |
| `extension/manifest.chrome.json`, `extension/manifest.firefox.json`, `extension/build.sh` | neue Dateien eintragen, `modal.*` raus | 4 |
| `extension/modal.html`, `extension/modal.css` | löschen | 4 |
| `README.md` | „Panel“ → „Raspdarts-Seite“ | 5 |

---

### Task 1: Texte und Spracherkennung

**Files:**
- Create: `extension/src/texts.js`
- Test: `extension/test/texts.test.js`

**Interfaces:**
- Consumes: nichts
- Produces: `globalThis.raspdartsTexts = { detectLanguage(navLabel: string|null|undefined): 'de'|'en', getTexts(language: string): Texts }`. `Texts` ist ein Objekt mit den Schlüsseln aus Step 3; `Texts.dialogs[actionKey] = { title, text, yes }` für die sieben Aktionsschlüssel `installAutodarts`, `updateAutodarts`, `uninstallAutodarts`, `updateRaspdarts`, `uninstallRaspdarts`, `restart`, `shutdown`.

- [ ] **Step 1: Write the failing test**

`extension/test/texts.test.js`:

```js
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
    const actions = ['installAutodarts', 'updateAutodarts', 'uninstallAutodarts',
      'updateRaspdarts', 'uninstallRaspdarts', 'restart', 'shutdown'];
    for (const language of ['de', 'en']) {
      expect(Object.keys(texts.getTexts(language).dialogs).sort()).toEqual([...actions].sort());
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run test/texts.test.js`
Expected: FAIL, Import von `../src/texts.js` schlägt fehl (Datei fehlt).

- [ ] **Step 3: Write minimal implementation**

`extension/src/texts.js`:

```js
'use strict';

// Texte der Raspdarts-Seite auf Deutsch und Englisch. Die Sprache richtet sich
// nach Autodarts selbst (siehe detectLanguage).
(function (root) {
  const de = {
    connecting: 'Verbinde …',
    piOnline: 'Pi online',
    piUnreachable: 'Pi nicht erreichbar',
    unreachableHint: 'Ist der Pi eingeschaltet und im selben Netzwerk? Erwartete Adresse: raspdarts.local',
    cpu: 'CPU',
    ram: 'RAM',
    temperature: 'Temperatur',
    uptime: 'Laufzeit',
    autodarts: 'Autodarts',
    raspberryPi: 'Raspberry Pi',
    version: 'Version',
    status: 'Status',
    installed: 'Installiert',
    notInstalled: 'Nicht installiert',
    raspdarts: 'Raspdarts',
    beamer: 'Beamer',
    beamerConnected: 'Verbunden',
    beamerDisconnected: 'Nicht verbunden',
    installAutodarts: 'Autodarts installieren',
    updateAutodarts: 'Autodarts aktualisieren',
    uninstallAutodarts: 'Deinstallieren',
    openMonitor: 'Monitor öffnen',
    updateRaspdarts: 'Raspdarts aktualisieren',
    uninstallRaspdarts: 'Raspdarts deinstallieren',
    restart: 'Neu starten',
    shutdown: 'Herunterfahren',
    cancel: 'Abbrechen',
    close: 'Schließen',
    running: 'Läuft …',
    success: 'Erfolgreich abgeschlossen',
    errorPrefix: 'Fehler: ',
    requestFailed: 'Anfrage fehlgeschlagen.',
    alreadyRunning: 'Läuft bereits – versuch es gleich noch einmal.',
    disconnected: 'Verbindung zum Pi unterbrochen.',
    restarting: 'Pi startet neu …',
    shuttingDown: 'Pi fährt herunter …',
    dialogs: {
      installAutodarts: {
        title: 'Autodarts installieren',
        text: 'Autodarts wird auf dem Raspberry Pi installiert. Das dauert ein paar Minuten.',
        yes: 'Installieren',
      },
      updateAutodarts: {
        title: 'Autodarts aktualisieren',
        text: 'Autodarts auf dem Raspberry Pi wird aktualisiert. Die Scheibe erkennt währenddessen keine Darts.',
        yes: 'Aktualisieren',
      },
      uninstallAutodarts: {
        title: 'Autodarts deinstallieren',
        text: 'Autodarts wird vom Raspberry Pi entfernt. Die Scheibe erkennt danach keine Darts mehr.',
        yes: 'Deinstallieren',
      },
      updateRaspdarts: {
        title: 'Raspdarts aktualisieren',
        text: 'Raspdarts auf dem Raspberry Pi wird aktualisiert und neu gestartet. Der Beamer ist dabei kurz weg.',
        yes: 'Aktualisieren',
      },
      uninstallRaspdarts: {
        title: 'Raspdarts deinstallieren',
        text: 'Raspdarts wird vom Raspberry Pi entfernt. Diese Seite und der Beamer funktionieren danach nicht mehr.',
        yes: 'Deinstallieren',
      },
      restart: {
        title: 'Neu starten',
        text: 'Der Raspberry Pi startet neu. Beamer und Scheibe sind etwa eine Minute nicht verfügbar.',
        yes: 'Neu starten',
      },
      shutdown: {
        title: 'Herunterfahren',
        text: 'Der Raspberry Pi fährt herunter. Zum Einschalten musst du ihn kurz vom Strom trennen.',
        yes: 'Herunterfahren',
      },
    },
  };

  const en = {
    connecting: 'Connecting …',
    piOnline: 'Pi online',
    piUnreachable: 'Pi unreachable',
    unreachableHint: 'Is the Pi switched on and on the same network? Expected address: raspdarts.local',
    cpu: 'CPU',
    ram: 'RAM',
    temperature: 'Temperature',
    uptime: 'Uptime',
    autodarts: 'Autodarts',
    raspberryPi: 'Raspberry Pi',
    version: 'Version',
    status: 'Status',
    installed: 'Installed',
    notInstalled: 'Not installed',
    raspdarts: 'Raspdarts',
    beamer: 'Beamer',
    beamerConnected: 'Connected',
    beamerDisconnected: 'Not connected',
    installAutodarts: 'Install Autodarts',
    updateAutodarts: 'Update Autodarts',
    uninstallAutodarts: 'Uninstall',
    openMonitor: 'Open monitor',
    updateRaspdarts: 'Update Raspdarts',
    uninstallRaspdarts: 'Uninstall Raspdarts',
    restart: 'Restart',
    shutdown: 'Shut down',
    cancel: 'Cancel',
    close: 'Close',
    running: 'Running …',
    success: 'Completed successfully',
    errorPrefix: 'Error: ',
    requestFailed: 'Request failed.',
    alreadyRunning: 'Already running – try again shortly.',
    disconnected: 'Connection to the Pi was lost.',
    restarting: 'Pi is restarting …',
    shuttingDown: 'Pi is shutting down …',
    dialogs: {
      installAutodarts: {
        title: 'Install Autodarts',
        text: 'Autodarts will be installed on the Raspberry Pi. This takes a few minutes.',
        yes: 'Install',
      },
      updateAutodarts: {
        title: 'Update Autodarts',
        text: 'Autodarts on the Raspberry Pi will be updated. The board will not detect darts in the meantime.',
        yes: 'Update',
      },
      uninstallAutodarts: {
        title: 'Uninstall Autodarts',
        text: 'Autodarts will be removed from the Raspberry Pi. The board will no longer detect darts.',
        yes: 'Uninstall',
      },
      updateRaspdarts: {
        title: 'Update Raspdarts',
        text: 'Raspdarts on the Raspberry Pi will be updated and restarted. The beamer display will be gone briefly.',
        yes: 'Update',
      },
      uninstallRaspdarts: {
        title: 'Uninstall Raspdarts',
        text: 'Raspdarts will be removed from the Raspberry Pi. This page and the beamer display will stop working.',
        yes: 'Uninstall',
      },
      restart: {
        title: 'Restart',
        text: 'The Raspberry Pi will restart. Beamer display and board will be unavailable for about a minute.',
        yes: 'Restart',
      },
      shutdown: {
        title: 'Shut down',
        text: 'The Raspberry Pi will shut down. To switch it back on, briefly disconnect it from power.',
        yes: 'Shut down',
      },
    },
  };

  const TABLES = { de, en };

  // <html lang> taugt nicht: Autodarts setzt dort "en", auch wenn die
  // Oberflaeche deutsch ist. Die Beschriftung der Hauptnavigation folgt dagegen
  // der eingestellten Sprache.
  function detectLanguage(navLabel) {
    return navLabel === 'Hauptnavigation' ? 'de' : 'en';
  }

  function getTexts(language) {
    return TABLES[language] ?? en;
  }

  root.raspdartsTexts = { detectLanguage, getTexts };
})(globalThis);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npx vitest run test/texts.test.js`
Expected: PASS (alle Tests grün).

- [ ] **Step 5: Commit**

```bash
git add extension/src/texts.js extension/test/texts.test.js
git commit -m "Extension: Texte der Raspdarts-Seite auf Deutsch und Englisch"
```

---

### Task 2: Anzeigewerte aus der Status-Antwort

**Files:**
- Create: `extension/src/view-model.js`
- Test: `extension/test/view-model.test.js`

**Interfaces:**
- Consumes: `globalThis.raspdartsTexts.getTexts(language)` aus Task 1 (nur im Test; `buildView` bekommt die Tabelle als Parameter).
- Produces: `globalThis.raspdartsViewModel = { ACTIONS, EMPTY, buildView, formatRam, formatUptime }`.
  - `ACTIONS[key] = { kind: 'stream'|'power', url: string, danger: boolean, doneText?: 'restarting'|'shuttingDown' }` für die sieben Aktionsschlüssel aus Task 1.
  - `EMPTY = '--'`
  - `buildView({ status: object|null, reachable: true|false|null, busy: boolean }, t: Texts)` liefert:
    ```
    {
      pill: { tone: 'pending'|'ok'|'error', text: string },
      stats: { cpu, ram, temperature, uptime },          // Strings
      showCards: boolean, showHint: boolean, disabled: boolean,
      autodarts: { version, statusText, statusTone: 'ok'|'off',
                   mainAction: 'installAutodarts'|'updateAutodarts', mainLabel,
                   canUninstall: boolean, showMonitor: boolean, monitorUrl: string|null },
      pi: { raspdartsVersion, beamerText, beamerTone: 'ok'|'off' },
    }
    ```
    `reachable === null` heißt: noch keine Antwort (Laden).

- [ ] **Step 1: Write the failing test**

`extension/test/view-model.test.js`:

```js
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
  autodarts_version: '0.27.4',
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
    expect(view.autodarts).toMatchObject({
      version: '--', statusText: '--', mainAction: 'updateAutodarts', showMonitor: false, canUninstall: false,
    });
    expect(view.pi).toEqual({ raspdartsVersion: '--', beamerText: '--', beamerTone: 'off' });
  });

  test('erreichbar: alle Werte, Knoepfe frei', () => {
    const view = vm.buildView({ status: STATUS, reachable: true, busy: false }, t);
    expect(view.pill).toEqual({ tone: 'ok', text: 'Pi online · 192.168.178.42' });
    expect(view.stats).toEqual({ cpu: '12%', ram: '1.2 / 3.7 GB', temperature: '48°C', uptime: '3h 12m' });
    expect(view.showCards).toBe(true);
    expect(view.showHint).toBe(false);
    expect(view.disabled).toBe(false);
    expect(view.autodarts).toEqual({
      version: '0.27.4',
      statusText: 'Installiert',
      statusTone: 'ok',
      mainAction: 'updateAutodarts',
      mainLabel: 'Autodarts aktualisieren',
      canUninstall: true,
      showMonitor: true,
      monitorUrl: 'http://192.168.178.42:3180/monitor',
    });
    expect(view.pi).toEqual({ raspdartsVersion: 'v2.0.0', beamerText: 'Verbunden', beamerTone: 'ok' });
  });

  test('Autodarts nicht installiert: installieren statt aktualisieren', () => {
    const view = vm.buildView({ status: { ...STATUS, autodarts_version: 'unknown' }, reachable: true, busy: false }, t);
    expect(view.autodarts).toEqual({
      version: '--',
      statusText: 'Nicht installiert',
      statusTone: 'off',
      mainAction: 'installAutodarts',
      mainLabel: 'Autodarts installieren',
      canUninstall: false,
      showMonitor: false,
      monitorUrl: null,
    });
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

  test('Wert 0 wird angezeigt, nicht als leer', () => {
    const view = vm.buildView({ status: { ...STATUS, cpu_percent: 0, uptime_seconds: 0, temp_celsius: 0 }, reachable: true, busy: false }, t);
    expect(view.stats.cpu).toBe('0%');
    expect(view.stats.uptime).toBe('0m');
    expect(view.stats.temperature).toBe('0°C');
  });

  test('unvollstaendige Antwort: fehlende Felder als --', () => {
    const view = vm.buildView({ status: { autodarts_version: '0.27.4', temp_celsius: null }, reachable: true, busy: false }, t);
    expect(view.pill).toEqual({ tone: 'ok', text: 'Pi online' });
    expect(view.stats).toEqual({ cpu: '--', ram: '--', temperature: '--', uptime: '--' });
    expect(view.autodarts.showMonitor).toBe(false);
    expect(view.autodarts.monitorUrl).toBe(null);
    expect(view.pi).toEqual({ raspdartsVersion: '--', beamerText: 'Nicht verbunden', beamerTone: 'off' });
  });

  test('fehlende Autodarts-Version gilt als nicht installiert', () => {
    const { autodarts_version, ...rest } = STATUS;
    const view = vm.buildView({ status: rest, reachable: true, busy: false }, t);
    expect(view.autodarts.mainAction).toBe('installAutodarts');
  });

  test('englische Texte', () => {
    const en = globalThis.raspdartsTexts.getTexts('en');
    const view = vm.buildView({ status: STATUS, reachable: true, busy: false }, en);
    expect(view.autodarts.mainLabel).toBe('Update Autodarts');
    expect(view.pi.beamerText).toBe('Connected');
  });
});

describe('ACTIONS', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd extension && npx vitest run test/view-model.test.js`
Expected: FAIL, Import von `../src/view-model.js` schlägt fehl (Datei fehlt).

- [ ] **Step 3: Write minimal implementation**

`extension/src/view-model.js`:

```js
'use strict';

// Berechnet aus der Antwort von /api/status, was die Raspdarts-Seite anzeigt.
// Reine Funktionen ohne DOM, damit sie sich ohne Browser testen lassen.
(function (root) {
  const EMPTY = '--';

  // Was jeder Knopf auf dem Pi ausloest. "stream" liefert ein Protokoll,
  // "power" nur eine kurze Bestaetigung (doneText ist ein Schluessel der Texttabelle).
  const ACTIONS = {
    installAutodarts: { kind: 'stream', url: '/api/autodarts/install', danger: false },
    updateAutodarts: { kind: 'stream', url: '/api/autodarts/install', danger: false },
    uninstallAutodarts: { kind: 'stream', url: '/api/autodarts/uninstall', danger: true },
    updateRaspdarts: { kind: 'stream', url: '/api/system/update', danger: false },
    uninstallRaspdarts: { kind: 'stream', url: '/api/system/uninstall', danger: true },
    restart: { kind: 'power', url: '/api/system/reboot', danger: false, doneText: 'restarting' },
    shutdown: { kind: 'power', url: '/api/system/shutdown', danger: true, doneText: 'shuttingDown' },
  };

  const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  const isText = (value) => typeof value === 'string' && value.length > 0;
  const withUnit = (value, unit) => (isNumber(value) ? `${value}${unit}` : EMPTY);

  function formatUptime(seconds) {
    if (!isNumber(seconds)) return EMPTY;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function formatRam(usedMb, totalMb) {
    if (!isNumber(usedMb) || !isNumber(totalMb)) return EMPTY;
    const gb = (mb) => (mb / 1024).toFixed(1);
    return `${gb(usedMb)} / ${gb(totalMb)} GB`;
  }

  function pillFor(online, reachable, ip, t) {
    if (online) return { tone: 'ok', text: ip ? `${t.piOnline} · ${ip}` : t.piOnline };
    if (reachable === false) return { tone: 'error', text: t.piUnreachable };
    return { tone: 'pending', text: t.connecting };
  }

  // reachable: null = noch keine Antwort, true/false = letzte Abfrage.
  function buildView({ status, reachable, busy }, t) {
    const online = reachable === true && status != null;
    // Ohne Verbindung keine alten Werte anzeigen.
    const s = online ? status : {};
    const ip = isText(s.ip_address) ? s.ip_address : null;
    const installed = isText(s.autodarts_version) && s.autodarts_version !== 'unknown';
    const beamerConnected = Boolean(s.beamer?.ingest_connected);
    const mainAction = online && !installed ? 'installAutodarts' : 'updateAutodarts';

    return {
      pill: pillFor(online, reachable, ip, t),
      stats: {
        cpu: withUnit(s.cpu_percent, '%'),
        ram: formatRam(s.ram_used_mb, s.ram_total_mb),
        temperature: withUnit(s.temp_celsius, '°C'),
        uptime: formatUptime(s.uptime_seconds),
      },
      showCards: reachable !== false,
      showHint: reachable === false,
      disabled: !online || Boolean(busy),
      autodarts: {
        version: installed ? s.autodarts_version : EMPTY,
        statusText: online ? (installed ? t.installed : t.notInstalled) : EMPTY,
        statusTone: installed ? 'ok' : 'off',
        mainAction,
        mainLabel: t[mainAction],
        canUninstall: installed,
        showMonitor: installed && ip !== null,
        monitorUrl: installed && ip ? `http://${ip}:3180/monitor` : null,
      },
      pi: {
        raspdartsVersion: isText(s.raspdarts_version) ? `v${s.raspdarts_version}` : EMPTY,
        beamerText: online ? (beamerConnected ? t.beamerConnected : t.beamerDisconnected) : EMPTY,
        beamerTone: beamerConnected ? 'ok' : 'off',
      },
    };
  }

  root.raspdartsViewModel = { ACTIONS, EMPTY, buildView, formatRam, formatUptime };
})(globalThis);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd extension && npm test`
Expected: PASS, alle Testdateien grün (`forward`, `texts`, `view-model`).

- [ ] **Step 5: Commit**

```bash
git add extension/src/view-model.js extension/test/view-model.test.js
git commit -m "Extension: Anzeigewerte der Raspdarts-Seite aus der Status-Antwort"
```

---

### Task 3: Die Seite selbst (Shadow DOM, Dialog, Protokoll-Karte)

**Files:**
- Create: `extension/page.html`
- Create: `extension/page.css`
- Create: `extension/src/page.js`

**Interfaces:**
- Consumes: `Texts` aus Task 1 (Parameter `t`), die View aus Task 2 (`render(view)`).
- Produces: `globalThis.raspdartsPage = { create }` mit
  ```
  create({ t: Texts, onAction(actionKey: string): void, onActivityClosed(): void })
    -> Promise<{
      host: HTMLDivElement,                    // div#raspdarts-page, noch nicht im DOM
      render(view): void,
      confirm(actionKey: string, danger: boolean): Promise<boolean>,
      closeDialog(): void,                     // offener Dialog gilt als abgebrochen
      startActivity(title: string): void,
      appendLog(line: string): void,
      finishActivity(success: boolean, message: string): void,
      closeActivity(): void,
    }>
  ```
  `create` lädt `page.html` und `page.css` über `chrome.runtime.getURL`. Ein Klick auf einen Knopf mit `data-action` ruft `onAction(key)`; „Schließen“ der Protokoll-Karte ruft `closeActivity()` und danach `onActivityClosed()`.

Kein Unit-Test (braucht DOM und `chrome.runtime`); geprüft wird im echten Browser in Task 5. In diesem Task nur Syntax prüfen.

- [ ] **Step 1: `page.html` anlegen**

`extension/page.html`:

```html
<div class="wrap">
  <section class="card hero">
    <div class="brand">
      <div class="logo"><img data-asset="icons/button.png" alt=""></div>
      <div>
        <div class="name">Raspdarts</div>
        <span class="pill" data-field="pill"><span class="dot"></span><span data-field="pillText"></span></span>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-label" data-text="cpu"></div><div class="stat-value" data-field="cpu">--</div></div>
      <div class="stat"><div class="stat-label" data-text="ram"></div><div class="stat-value" data-field="ram">--</div></div>
      <div class="stat"><div class="stat-label" data-text="temperature"></div><div class="stat-value" data-field="temperature">--</div></div>
      <div class="stat"><div class="stat-label" data-text="uptime"></div><div class="stat-value" data-field="uptime">--</div></div>
    </div>
  </section>

  <section class="card" data-field="hint" hidden>
    <h2 data-text="piUnreachable"></h2>
    <p data-text="unreachableHint"></p>
  </section>

  <div class="grid" data-field="cards">
    <section class="card">
      <h2>
        <span data-text="autodarts"></span>
        <button class="ghost" data-action="uninstallAutodarts" data-field="uninstallAutodarts">
          <svg viewBox="0 0 448 512" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>
          <span data-text="uninstallAutodarts"></span>
        </button>
      </h2>
      <div class="rows">
        <div class="row"><span class="key" data-text="version"></span><span class="val" data-field="autodartsVersion">--</span></div>
        <div class="row"><span class="key" data-text="status"></span><span class="val"><span class="dot" data-field="autodartsDot"></span><span data-field="autodartsStatus">--</span></span></div>
      </div>
      <div class="btns">
        <button class="primary" data-field="autodartsMain"></button>
        <button data-field="monitor" hidden><span data-text="openMonitor"></span> ↗</button>
      </div>
    </section>

    <section class="card">
      <h2>
        <span data-text="raspberryPi"></span>
        <button class="ghost" data-action="uninstallRaspdarts">
          <svg viewBox="0 0 448 512" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/></svg>
          <span data-text="uninstallRaspdarts"></span>
        </button>
      </h2>
      <div class="rows">
        <div class="row"><span class="key" data-text="raspdarts"></span><span class="val" data-field="raspdartsVersion">--</span></div>
        <div class="row"><span class="key" data-text="beamer"></span><span class="val"><span class="dot" data-field="beamerDot"></span><span data-field="beamerStatus">--</span></span></div>
      </div>
      <div class="btns">
        <button class="primary" data-action="updateRaspdarts" data-text="updateRaspdarts"></button>
        <button data-action="restart" data-text="restart"></button>
        <button class="danger" data-action="shutdown" data-text="shutdown"></button>
      </div>
    </section>
  </div>

  <section class="card" data-field="activity" hidden>
    <h2>
      <span data-field="activityTitle"></span>
      <span class="running" data-field="activityRunning"><span class="spin"></span><span data-text="running"></span></span>
    </h2>
    <pre class="log" data-field="log" hidden></pre>
    <div class="result" data-field="activityResult" hidden>
      <span data-field="activityMessage"></span>
      <button data-field="activityClose" data-text="close"></button>
    </div>
  </section>
</div>

<div class="backdrop" data-field="dialog" hidden>
  <div class="dialog" role="dialog" aria-modal="true">
    <h2 data-field="dialogTitle"></h2>
    <p data-field="dialogText"></p>
    <div class="btns">
      <button data-field="dialogCancel" data-text="cancel"></button>
      <button data-field="dialogConfirm"></button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: `page.css` anlegen**

`extension/page.css`:

```css
/* Stil der Raspdarts-Seite. Liegt im Shadow DOM; Farben und Schriften kommen
   von Autodarts (CSS-Variablen und @font-face greifen ins Shadow DOM durch).
   Jede Variable hat einen festen Ersatzwert, falls Autodarts sie umbenennt. */

:host {
  all: initial;
  display: block;
  height: 100%;
  overflow-y: auto;
  font-family: "Manrope Variable", "Manrope", sans-serif;
  color: var(--color-mono-white, #fff);
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }

.wrap {
  max-width: 1600px;
  margin: 0 auto;
  padding: 40px 24px 32px;
  display: grid;
  gap: 24px;
}

.card {
  background: var(--color-black-80, #16181c);
  border-radius: 12px;
  padding: 16px;
}

h2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  font-family: "Bebas Neue", "Manrope Variable", sans-serif;
  font-weight: 400;
  font-size: 24px;
  line-height: 1.2;
  text-transform: uppercase;
}

p {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-black-20, #cacfd9);
}

/* Banner nach Vorbild von Autodarts' Spieler-Banner */
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 32px;
  padding: 16px 24px;
  border: 1px solid color-mix(in srgb, var(--color-blue-60, #0b55df) 40%, transparent);
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--color-blue-60, #0b55df) 25%, var(--color-black-80, #16181c)),
    var(--color-black-80, #16181c) 60%);
}
.brand { display: flex; align-items: center; gap: 12px; }
.logo {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--color-blue-60, #0b55df);
}
.logo img { width: 28px; height: 28px; }
.name {
  margin-bottom: 4px;
  font-family: "Bebas Neue", "Manrope Variable", sans-serif;
  font-size: 28px;
  line-height: 1;
  text-transform: uppercase;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: rgb(255 255 255 / 0.08);
}
.pill[data-tone="error"] { color: var(--color-red-50, #e24e67); }
.stats { display: flex; flex-wrap: wrap; gap: 32px; }
.stat { padding-left: 12px; border-left: 3px solid var(--color-blue-60, #0b55df); }
.stat-label { margin-bottom: 4px; font-size: 14px; color: var(--color-black-20, #cacfd9); }
.stat-value {
  font-family: "League Spartan Variable", "Manrope Variable", sans-serif;
  font-weight: 600;
  font-size: 22px;
  line-height: 1;
}

/* Statuspunkte: data-tone sitzt auf dem Punkt selbst oder auf der Pille */
.dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-black-50, #707580);
}
.dot[data-tone="ok"], [data-tone="ok"] > .dot { background: var(--color-green-50, #12cf81); }
.dot[data-tone="error"], [data-tone="error"] > .dot { background: var(--color-red-50, #e24e67); }

/* Karten */
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.rows { display: grid; gap: 8px; margin: 16px 0 20px; }
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 14px;
  background: rgb(27 31 41);
}
.key { color: var(--color-black-20, #cacfd9); }
.val { display: flex; align-items: center; gap: 6px; font-weight: 700; }
.btns { display: flex; flex-wrap: wrap; gap: 8px; }

/* Knoepfe wie Autodarts: 14 px fett, Radius 8 px */
button {
  padding: 9px 16px;
  border: 0;
  border-radius: 8px;
  font-family: "Manrope Variable", "Manrope", sans-serif;
  font-size: 14px;
  font-weight: 700;
  text-transform: none;
  color: var(--color-mono-white, #fff);
  background: rgb(255 255 255 / 0.08);
  cursor: pointer;
}
button:hover:not(:disabled) { background: rgb(255 255 255 / 0.14); }
button:disabled { opacity: 0.4; cursor: not-allowed; }
button.primary { color: rgb(240 245 253); background: var(--color-blue-60, #0b55df); }
button.primary:hover:not(:disabled) { background: var(--color-blue-50, #4a89ff); }
button.danger {
  color: var(--color-red-50, #e24e67);
  background: color-mix(in srgb, var(--color-red-60, #da3954) 20%, transparent);
}
button.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-red-60, #da3954) 32%, transparent);
}
button.ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--color-black-30, #b8bcc5);
  background: none;
}
button.ghost:hover:not(:disabled) { color: var(--color-red-50, #e24e67); background: none; }

/* Protokoll-Karte */
.running {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: "Manrope Variable", "Manrope", sans-serif;
  font-size: 12px;
  font-weight: 600;
  text-transform: none;
  color: var(--color-blue-30, #9dbbf2);
}
.spin {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.log {
  height: 220px;
  margin: 16px 0 0;
  padding: 14px 16px;
  overflow: auto;
  border-radius: 10px;
  font: 12px/1.6 ui-monospace, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-black-30, #b8bcc5);
  background: var(--color-black-90, #01040b);
}
.result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  font-size: 14px;
  font-weight: 700;
}
.result [data-tone="ok"] { color: var(--color-green-50, #12cf81); }
.result [data-tone="error"] { color: var(--color-red-50, #e24e67); }

/* Bestaetigungsdialog ueber der ganzen Seite */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: rgb(1 4 11 / 0.6);
  backdrop-filter: blur(4px);
}
.dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 24px;
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 18px;
  background: var(--color-black-80, #16181c);
  box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
}
.dialog .btns { justify-content: flex-end; margin-top: 24px; }
```

- [ ] **Step 3: `src/page.js` anlegen**

`extension/src/page.js`:

```js
'use strict';

// Baut die Raspdarts-Seite im Shadow DOM und zeigt an, was view-model.js
// berechnet. Entscheidet nichts selbst: Aktionen meldet sie an content.js.
(function (root) {
  async function loadAsset(path) {
    const response = await fetch(chrome.runtime.getURL(path));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.text();
  }

  async function create({ t, onAction, onActivityClosed }) {
    const [html, css] = await Promise.all([loadAsset('page.html'), loadAsset('page.css')]);

    const host = document.createElement('div');
    host.id = 'raspdarts-page';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${css}</style>${html}`;
    shadow.querySelectorAll('[data-text]').forEach((el) => { el.textContent = t[el.dataset.text]; });
    shadow.querySelectorAll('[data-asset]').forEach((el) => { el.src = chrome.runtime.getURL(el.dataset.asset); });

    const field = (name) => shadow.querySelector(`[data-field="${name}"]`);
    let monitorUrl = null;
    let resolveDialog = null;

    function render(view) {
      field('pill').dataset.tone = view.pill.tone;
      field('pillText').textContent = view.pill.text;
      for (const key of ['cpu', 'ram', 'temperature', 'uptime']) field(key).textContent = view.stats[key];
      field('hint').hidden = !view.showHint;
      field('cards').hidden = !view.showCards;

      const autodarts = view.autodarts;
      field('autodartsVersion').textContent = autodarts.version;
      field('autodartsStatus').textContent = autodarts.statusText;
      field('autodartsDot').dataset.tone = autodarts.statusTone;
      const mainButton = field('autodartsMain');
      mainButton.dataset.action = autodarts.mainAction;
      mainButton.textContent = autodarts.mainLabel;
      field('monitor').hidden = !autodarts.showMonitor;
      monitorUrl = autodarts.monitorUrl;

      field('raspdartsVersion').textContent = view.pi.raspdartsVersion;
      field('beamerStatus').textContent = view.pi.beamerText;
      field('beamerDot').dataset.tone = view.pi.beamerTone;

      shadow.querySelectorAll('[data-action]').forEach((button) => { button.disabled = view.disabled; });
      field('uninstallAutodarts').disabled = view.disabled || !autodarts.canUninstall;
    }

    function confirm(actionKey, danger) {
      answerDialog(false);
      const texts = t.dialogs[actionKey];
      field('dialogTitle').textContent = texts.title;
      field('dialogText').textContent = texts.text;
      const yes = field('dialogConfirm');
      yes.textContent = texts.yes;
      yes.className = danger ? 'danger' : 'primary';
      field('dialog').hidden = false;
      yes.focus();
      return new Promise((resolve) => { resolveDialog = resolve; });
    }

    function answerDialog(answer) {
      field('dialog').hidden = true;
      const resolve = resolveDialog;
      resolveDialog = null;
      resolve?.(answer);
    }

    function startActivity(title) {
      field('activity').hidden = false;
      field('activityTitle').textContent = title;
      field('activityRunning').hidden = false;
      const log = field('log');
      log.textContent = '';
      log.hidden = true;
      field('activityResult').hidden = true;
    }

    function appendLog(line) {
      const log = field('log');
      log.hidden = false;
      log.textContent += `${line}\n`;
      log.scrollTop = log.scrollHeight;
    }

    function finishActivity(success, message) {
      field('activityRunning').hidden = true;
      field('activityResult').hidden = false;
      const messageEl = field('activityMessage');
      messageEl.textContent = message;
      messageEl.dataset.tone = success ? 'ok' : 'error';
    }

    function closeActivity() {
      field('activity').hidden = true;
    }

    shadow.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      if (button.dataset.action) onAction(button.dataset.action);
      else if (button === field('monitor') && monitorUrl) window.open(monitorUrl, '_blank', 'noopener');
      else if (button === field('activityClose')) { closeActivity(); onActivityClosed(); }
      else if (button === field('dialogCancel')) answerDialog(false);
      else if (button === field('dialogConfirm')) answerDialog(true);
    });
    // Klick neben den Dialog oder Escape bricht ab.
    field('dialog').addEventListener('click', (event) => {
      if (event.target === field('dialog')) answerDialog(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && resolveDialog) answerDialog(false);
    });

    return {
      host,
      render,
      confirm,
      closeDialog: () => answerDialog(false),
      startActivity,
      appendLog,
      finishActivity,
      closeActivity,
    };
  }

  root.raspdartsPage = { create };
})(globalThis);
```

- [ ] **Step 4: Syntax prüfen**

Run: `cd extension && node --check src/page.js && npm test`
Expected: kein Syntaxfehler; alle bisherigen Tests grün.

- [ ] **Step 5: Commit**

```bash
git add extension/page.html extension/page.css extension/src/page.js
git commit -m "Extension: Raspdarts-Seite im Autodarts-Stil (Shadow DOM)"
```

---

### Task 4: Seite einbinden, Popup entfernen

**Files:**
- Modify: `extension/src/content.js` (ganze Datei ersetzen)
- Modify: `extension/manifest.chrome.json`, `extension/manifest.firefox.json`
- Modify: `extension/build.sh:12`
- Delete: `extension/modal.html`, `extension/modal.css`

**Interfaces:**
- Consumes: `raspdartsTexts.detectLanguage/getTexts` (Task 1), `raspdartsViewModel.ACTIONS/buildView` (Task 2), `raspdartsPage.create` und das zurückgegebene Objekt (Task 3). Von `background.js` unverändert: `sendMessage({ type: 'fetch', url, method? })` → `{ ok, status, data } | { ok: false, error }`; Port `raspdarts-stream` mit `{ type: 'stream-start', url }`, Nachrichten `log { line }`, `conflict`, `done { success, error? }`.
- Produces: fertige Extension.

- [ ] **Step 1: `src/content.js` ersetzen**

`extension/src/content.js` (vollständiger neuer Inhalt):

```js
'use strict';

// Haengt den Eintrag "Raspdarts" in Autodarts' Hauptnavigation und zeigt bei
// Klick die Raspdarts-Seite im Inhaltsbereich. Siehe
// docs/superpowers/specs/2026-10-07-raspdarts-seite-design.md.

const { ACTIONS, buildView } = globalThis.raspdartsViewModel;
const { detectLanguage, getTexts } = globalThis.raspdartsTexts;

const STATUS_INTERVAL_MS = 10_000;
const BACKGROUND_INTERVAL_MS = 30_000;
const POWER_CLOSE_MS = 3_000;
const PAGE_ATTR = 'data-raspdarts-page';
// Klassen der Autodarts-Hauptnavigation, damit der Eintrag wie Start, Spielen usw. aussieht.
const AUTODARTS_NAV_ITEM_CLASSES = 'font-bold flex items-center relative hover:text-mono-white text-black-20';

// Solange unsere Seite offen ist: Autodarts' Inhalt ausblenden, den aktiven
// Autodarts-Eintrag grau und unseren weiss zeigen. Autodarts' Elemente
// behalten dabei ihre Klassen.
const DOCUMENT_STYLE = `
  html:not([${PAGE_ATTR}]) #raspdarts-page { display: none !important; }
  html[${PAGE_ATTR}] main > :not(#raspdarts-page) { display: none !important; }
  html[${PAGE_ATTR}] header nav > a[aria-current="page"] { color: var(--color-black-20, #cacfd9) !important; }
  html[${PAGE_ATTR}] #raspdarts-nav-btn { color: var(--color-mono-white, #fff) !important; }
`;

let status = null;      // letzte erfolgreiche Antwort von /api/status
let reachable = null;   // null = noch keine Antwort
let busy = false;       // eine Aktion laeuft
let texts = null;
let pagePromise = null;
let page = null;
let pageVisible = false;
let pollTimer = null;
let lastHref = location.href;
let underline = null;   // { bar, savedLeft, savedWidth, ourLeft }

function sendToBackground(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function findMainNav() {
  return document.querySelector('nav[aria-label="Hauptnavigation"]')
    || document.querySelector('header nav');
}

// Der Unterstrich-Balken ist das einzige div in der Navigation.
function underlineBar(nav) {
  return [...nav.children].find((el) => el.tagName === 'DIV');
}

// --- Navigationseintrag -------------------------------------------------------

// Punkt hinter dem Text: gruen = Spieldaten-Verbindung zum Pi steht, grau = nicht.
function updateNavDot() {
  const dot = document.getElementById('raspdarts-beamer-dot');
  if (!dot) return;
  const connected = reachable === true && Boolean(status?.beamer?.ingest_connected);
  dot.style.background = connected ? 'var(--color-green-50, #12cf81)' : 'rgba(255,255,255,0.25)';
}

function tryInjectNavButton() {
  if (document.getElementById('raspdarts-nav-btn')) return;
  const nav = findMainNav();
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id = 'raspdarts-nav-btn';
  btn.type = 'button';
  btn.className = AUTODARTS_NAV_ITEM_CLASSES;
  btn.style.gap = '6px';
  btn.append('Raspdarts');

  const dot = document.createElement('span');
  dot.id = 'raspdarts-beamer-dot';
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;';
  btn.appendChild(dot);
  btn.addEventListener('click', showPage);

  // Vor dem Unterstrich-Balken einfuegen, der als letztes Kind in der Navigation steckt.
  const lastItem = [...nav.children].filter((el) => el.matches('a, button')).pop();
  if (lastItem) lastItem.after(btn);
  else nav.appendChild(btn);
  updateNavDot();
}

// --- Status -------------------------------------------------------------------

async function fetchStatus() {
  const result = await sendToBackground({ type: 'fetch', url: '/api/status' });
  if (result?.ok) {
    status = result.data;
    reachable = true;
  } else {
    reachable = false;
  }
  updateNavDot();
  renderPage();
}

function renderPage() {
  if (page) page.render(buildView({ status, reachable, busy }, texts));
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => { if (!busy) fetchStatus(); }, STATUS_INTERVAL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

// --- Seite zeigen und verstecken ----------------------------------------------

function ensureDocumentStyle() {
  if (document.getElementById('raspdarts-document-style')) return;
  const style = document.createElement('style');
  style.id = 'raspdarts-document-style';
  style.textContent = DOCUMENT_STYLE;
  document.head.appendChild(style);
}

function getPage() {
  if (!pagePromise) {
    texts = getTexts(detectLanguage(findMainNav()?.getAttribute('aria-label')));
    pagePromise = globalThis.raspdartsPage
      .create({ t: texts, onAction: runAction, onActivityClosed: fetchStatus })
      .then((created) => { page = created; return created; })
      .catch((error) => { pagePromise = null; throw error; });
  }
  return pagePromise;
}

async function showPage() {
  if (pageVisible) return;
  const created = await getPage();
  const main = document.querySelector('main');
  if (pageVisible || !main) return;

  ensureDocumentStyle();
  // Autodarts baut <main> bei Seitenwechseln neu auf; dann wieder einhaengen.
  if (created.host.parentElement !== main) main.appendChild(created.host);
  document.documentElement.setAttribute(PAGE_ATTR, '');
  pageVisible = true;
  lastHref = location.href;
  moveUnderline();
  renderPage();
  fetchStatus();
  startPolling();
}

// Die Seite wird nur versteckt: Eine laufende Aktion samt Protokoll laeuft weiter.
function hidePage() {
  if (!pageVisible) return;
  pageVisible = false;
  document.documentElement.removeAttribute(PAGE_ATTR);
  page?.closeDialog();
  restoreUnderline();
  stopPolling();
}

function moveUnderline() {
  const nav = findMainNav();
  const btn = document.getElementById('raspdarts-nav-btn');
  const bar = nav && underlineBar(nav);
  if (!bar || !btn) return;
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  underline = {
    bar,
    savedLeft: bar.style.left,
    savedWidth: bar.style.width,
    ourLeft: `${btnRect.left - navRect.left}px`,
  };
  bar.style.left = underline.ourLeft;
  bar.style.width = `${btnRect.width}px`;
}

// Nur zuruecksetzen, wenn Autodarts den Balken inzwischen nicht selbst
// verschoben hat (das tut es bei einem echten Seitenwechsel).
function restoreUnderline() {
  if (!underline) return;
  const { bar, savedLeft, savedWidth, ourLeft } = underline;
  if (bar.style.left === ourLeft) {
    bar.style.left = savedLeft;
    bar.style.width = savedWidth;
  }
  underline = null;
}

function onDomChange() {
  tryInjectNavButton();
  if (location.href !== lastHref) {
    lastHref = location.href;
    hidePage();
  }
}

// --- Aktionen -----------------------------------------------------------------

async function runAction(key) {
  const action = ACTIONS[key];
  if (busy || !action || !page) return;
  const confirmed = await page.confirm(key, action.danger);
  if (!confirmed || busy) return;

  busy = true;
  renderPage();
  page.startActivity(texts.dialogs[key].title);
  if (action.kind === 'stream') runStream(action);
  else runPower(action);
}

function finishAction(success, message) {
  busy = false;
  page.finishActivity(success, message);
  renderPage();
}

function errorText(error) {
  return texts.errorPrefix + (error || texts.requestFailed);
}

function runStream(action) {
  const port = chrome.runtime.connect({ name: 'raspdarts-stream' });
  let finished = false;
  const end = (success, message) => {
    if (finished) return;
    finished = true;
    finishAction(success, message);
  };

  port.onMessage.addListener((msg) => {
    if (msg.type === 'log') page.appendLog(msg.line);
    else if (msg.type === 'conflict') end(false, texts.alreadyRunning);
    else if (msg.type === 'done') end(msg.success, msg.success ? texts.success : errorText(msg.error));
  });
  port.onDisconnect.addListener(() => end(false, texts.disconnected));
  port.postMessage({ type: 'stream-start', url: action.url });
}

async function runPower(action) {
  const result = await sendToBackground({ type: 'fetch', url: action.url, method: 'POST' });
  if (result?.ok) {
    finishAction(true, texts[action.doneText]);
    // Nicht schliessen, falls inzwischen schon die naechste Aktion laeuft.
    setTimeout(() => { if (!busy) page.closeActivity(); fetchStatus(); }, POWER_CLOSE_MS);
  } else if (result?.status === 409) {
    finishAction(false, texts.alreadyRunning);
  } else {
    finishAction(false, errorText(result?.data?.error || result?.error));
  }
}

// --- Start --------------------------------------------------------------------

tryInjectNavButton();
// Weiter beobachten: Autodarts baut die Kopfleiste beim Seitenwechsel teils neu
// auf, und ein Adresswechsel heisst, dass jemand unsere Seite verlassen hat.
new MutationObserver(onDomChange).observe(document.body, { childList: true, subtree: true });
window.addEventListener('popstate', hidePage);
// Klick auf einen Link der Kopfleiste verlaesst die Seite, auch ohne
// Adresswechsel (z. B. "Start", wenn man schon auf / ist).
document.addEventListener('click', (event) => {
  if (pageVisible && event.target.closest?.('header a')) hidePage();
}, true);

fetchStatus();
setInterval(() => { if (!pageVisible) fetchStatus(); }, BACKGROUND_INTERVAL_MS);
```

- [ ] **Step 2: Manifeste anpassen**

In **beiden** Dateien `extension/manifest.chrome.json` und `extension/manifest.firefox.json`:

Den dritten `content_scripts`-Eintrag

```json
    {
      "matches": ["https://play.autodarts.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
```

ersetzen durch

```json
    {
      "matches": ["https://play.autodarts.com/*"],
      "js": ["texts.js", "view-model.js", "page.js", "content.js"],
      "run_at": "document_idle"
    }
```

und in `web_accessible_resources` die Zeile

```json
      "resources": ["modal.html", "modal.css", "icons/*"],
```

ersetzen durch

```json
      "resources": ["page.html", "page.css", "icons/*"],
```

- [ ] **Step 3: `build.sh` anpassen und Popup-Dateien löschen**

In `extension/build.sh` Zeile 12

```bash
  cp -r "$SCRIPT_DIR/modal.html" "$SCRIPT_DIR/modal.css" "$SCRIPT_DIR/icons" "$TARGET/"
```

ersetzen durch

```bash
  cp -r "$SCRIPT_DIR/page.html" "$SCRIPT_DIR/page.css" "$SCRIPT_DIR/icons" "$TARGET/"
```

Dann:

```bash
git rm extension/modal.html extension/modal.css
```

- [ ] **Step 4: Prüfen und bauen**

Run:

```bash
cd extension && node --check src/content.js && npm test && npm run build
grep -rn "modal" src manifest.*.json build.sh || echo "keine Reste"
ls dist/chrome
```

Expected: kein Syntaxfehler, alle Tests grün, Build meldet `dist/chrome` und `dist/firefox`, `grep` meldet „keine Reste“, `dist/chrome` enthält `page.html`, `page.css`, `texts.js`, `view-model.js`, `page.js`, `content.js`.

- [ ] **Step 5: Commit**

```bash
git add extension/src/content.js extension/manifest.chrome.json extension/manifest.firefox.json extension/build.sh
git commit -m "Extension: Raspdarts-Seite statt Popup oeffnen"
```

---

### Task 5: Prüfung im echten Autodarts, README, Abnahme

**Files:**
- Modify: `README.md:15,64`

**Interfaces:**
- Consumes: gebaute Extension `extension/dist/chrome` aus Task 4.
- Produces: geprüfte Extension, aktualisierte README.

- [ ] **Step 1: Extension im Browser laden**

Arnold bitten, im Chrome-Fenster der DevTools-Verbindung (play.autodarts.com, eingeloggt) unter `chrome://extensions` den Entwicklermodus einzuschalten und `extension/dist/chrome` als entpackte Erweiterung zu laden, dann play.autodarts.com neu zu laden. Warten, bis er bestätigt. Der Pi muss erreichbar sein (`raspdarts.local`).

- [ ] **Step 2: Einbindung prüfen (Chrome DevTools MCP)**

Nacheinander, jeweils mit `take_screenshot` bzw. `evaluate_script`:

1. Start-Seite: Eintrag „Raspdarts“ mit Punkt hinter „Stats“. Klick darauf (`click` auf den Eintrag aus `take_snapshot`).
2. Prüfen per `evaluate_script`:
   ```js
   () => {
     const host = document.getElementById('raspdarts-page');
     const main = document.querySelector('main');
     const others = [...main.children].filter((el) => el !== host);
     return {
       attr: document.documentElement.hasAttribute('data-raspdarts-page'),
       inMain: host?.parentElement === main,
       othersHidden: others.every((el) => getComputedStyle(el).display === 'none'),
       navColor: getComputedStyle(document.getElementById('raspdarts-nav-btn')).color,
       pill: host?.shadowRoot.querySelector('[data-field="pillText"]').textContent,
       cpu: host?.shadowRoot.querySelector('[data-field="cpu"]').textContent,
       updateLabel: host?.shadowRoot.querySelector('[data-action="updateRaspdarts"]').textContent,
     };
   }
   ```
   Erwartet: `attr`, `inMain`, `othersHidden` true; `navColor` `rgb(255, 255, 255)`; `pill` beginnt mit „Pi online“; `cpu` endet auf `%`; `updateLabel` „Raspdarts aktualisieren“ (deutsche Oberfläche).
3. Screenshot: Seite entspricht dem Entwurf (Banner, zwei Karten), Unterstrich unter „Raspdarts“, „Start“ grau.
4. Klick auf „Spielen“ → Autodarts' Spielen-Seite sichtbar, `data-raspdarts-page` weg, Unterstrich unter „Spielen“.
5. Auf `/` gehen, „Raspdarts“ öffnen, dann „Start“ klicken → Startseite sichtbar, Unterstrich unter „Start“.
6. „Raspdarts“ öffnen, `navigate_page` mit `type: back` → Seite verschwindet.
7. „Raspdarts“ öffnen, Freunde-Knopf (Symbol rechts) klicken → Schublade öffnet sich, unsere Seite bleibt (`data-raspdarts-page` noch gesetzt). Schublade schließen.
8. „Neu starten“ klicken → Dialog mit „Neu starten“ und deutschem Text; `press_key` Escape → Dialog weg, nichts ausgelöst. Noch einmal öffnen, „Abbrechen“ → weg. Noch einmal öffnen, neben den Dialog klicken → weg. **Nicht bestätigen.**
9. Zustand „nicht erreichbar“ wird hier nicht künstlich erzeugt; er wird in Step 4 beim echten Neustart geprüft.

Weicht etwas ab: Fehler in Task 3/4 beheben, neu bauen, Arnold die Extension neu laden lassen, betroffenen Punkt wiederholen, Fix committen.

- [ ] **Step 3: README anpassen**

In `README.md` Zeile 15

```
                          └─ Panel: Status, Updates ───┤
```

ersetzen durch

```
                          └─ Seite: Status, Updates ───┤
```

und in Zeile 64 „Falls das Panel den Pi nicht erreicht“ ersetzen durch „Falls die Raspdarts-Seite den Pi nicht erreicht“.

```bash
git add README.md
git commit -m "README: Raspdarts-Seite statt Panel"
```

- [ ] **Step 4: Abnahme durch Arnold**

Arnold prüft mit der gebauten Extension und dem echten Pi:

1. „Neu starten“ bestätigen → Karte „Pi startet neu …“ schließt nach 3 s, Pille wird rot „Pi nicht erreichbar“ mit Hinweiskarte, nach etwa einer Minute von selbst wieder grün.
2. „Raspdarts aktualisieren“ bestätigen → Protokoll läuft mit, Knöpfe gesperrt; währenddessen auf „Spielen“ wechseln und zurück auf „Raspdarts“ → Protokoll ist weitergelaufen; am Ende „Erfolgreich abgeschlossen“ oder Fehlermeldung, „Schließen“ blendet die Karte aus.
3. Optisch: passt die Seite zu Autodarts?

Erst nach seiner Bestätigung pushen:

```bash
git push origin main
```
