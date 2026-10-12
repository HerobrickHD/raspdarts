# Viewer-Knopf statt Board Manager – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auf der Karte des Raspdarts-Boards ersetzt ein Viewer-Knopf den toten „Board Manager“; er öffnet ein Fenster mit dem Schalter „Spieldaten an den Pi senden“ und der bisherigen Raspdarts-Seite. Der Navigationseintrag „Raspdarts“ entfällt.

**Architecture:** Der Schalter liegt in `chrome.storage.local` (`forwardGameData`, fehlt = an). `bridge.js` gibt Spieldaten nur bei „an“ weiter und trennt sonst den Port, wodurch der Background die Verbindung zum Pi schließt. Beim Ausschalten setzt `POST /api/ingest/reset` die Viewer auf „Warte auf Spieldaten“. Ein neuer Baustein `board-card.js` (aus `cams.js` herausgelöst) findet die Karte, setzt Knöpfe ein und öffnet Fenster; `cams.js` und das neue `viewer.js` nutzen ihn. `viewer.js` ersetzt `content.js` und hängt die bestehende Seite (`page.js`/`page.html`/`page.css`) ins Fenster.

**Tech Stack:** Server: TypeScript, Fastify 5, Vitest. Extension: Manifest V3 (Chrome + Firefox), Content-Scripts mit `globalThis`-Modulen, Vitest ohne DOM.

**Spec:** `docs/superpowers/specs/2026-10-12-viewer-fenster-design.md`

## Global Constraints

- Schalter je Browser in `chrome.storage.local` unter `forwardGameData`; fehlt der Wert, gilt **an**.
- Bei „aus“ gehen keine Spieldaten an den Pi und es besteht keine `/ingest`-Verbindung; einzig `POST /api/ingest/reset` (ohne Spieldaten) wird beim Ausschalten gesendet.
- Kein Zurücksetzen des Viewers bei bloßem Verbindungsabbruch.
- Board Manager nur auf der Karte des Pi verstecken (nicht entfernen), erkannt an der Position (letzter Autodarts-Knopf der linken Gruppe).
- Viewer-Knopf immer klickbar; an: Lucide `monitor`, „Viewer (an)“; aus: grau, Lucide `monitor-off`, „Viewer (aus)“.
- Board-ID in `chrome.storage.local` unter `boardId` merken; bei unerreichbarem Pi gilt die gemerkte.
- `/api/status` nur bei offenem Fenster, alle 10 s, beim Öffnen sofort. Keine Hintergrundabfrage mehr.
- Lucide-Symbole mit Kommentar zu Herkunft und Lizenz (ISC).
- Texte Deutsch und Englisch mit identischen Schlüsseln; Code-Kommentare deutsch ohne Umlaute.
- Python ist nicht installiert; Hilfsskripte in Node oder Bash.

## Review Focus

1. **Esc bei offener Rückfrage im Fenster** schließt nur die Rückfrage, nicht das Fenster. → Task 5, Browser-Prüfung Punkt 6.
2. **Fenster während eines Updates schließen und wieder öffnen**: Update läuft weiter, Protokoll steht da. → Task 6, Schritt „Update über das Fenster“.
3. **Mehrere Autodarts-Tabs**: Ausschalten in einem Tab trennt die Weitergabe in allen. → Task 3, Test „schaltet bei Aenderung im Speicher sofort ab“; Task 5, Browser-Prüfung Punkt 4.
4. **Autodarts baut die Karte neu auf**: Board Manager bleibt versteckt, beide Knöpfe genau einmal, Reihenfolge Kameras vor Viewer. → Task 5, Browser-Prüfung Punkt 2.
5. **Pi aus / nicht erreichbar**: Viewer-Knopf erscheint dank gemerkter Board-ID, Fenster zeigt „Pi nicht erreichbar“, Schalter funktioniert. → Task 2, Test `pickBoardId`; Task 5, Browser-Prüfung Punkt 7.

---

## Dateiübersicht

| Datei | Aufgabe |
|---|---|
| `server/src/http.ts`, `server/test/http.test.ts` | `POST /api/ingest/reset` |
| `extension/src/forwarding.js` (neu) | Schlüssel und Regel „fehlt = an“ |
| `extension/src/viewer-view.js` (neu) | reine Logik: Viewer-Knopf, Viewer-Block, Board-ID-Wahl |
| `extension/src/texts.js` | neue Texte, `beamer*` raus, Dialogtexte ohne „Beamer“/„Seite“ |
| `extension/src/view-model.js` | Beamer-Zeile der Pi-Karte raus |
| `extension/src/bridge.js` | Weitergabe nur bei „an“ |
| `extension/src/board-card.js` (neu) | Karte, Knopf, Fenster, Board-ID, Seitenwechsel |
| `extension/src/cams.js` | auf `board-card.js` umgestellt |
| `extension/src/viewer.js` (neu, ersetzt `content.js`) | Viewer-Knopf, Fenster mit Seite, Aktionen, Schalter |
| `extension/src/content.js` | gelöscht |
| `extension/src/page.js`, `extension/page.html`, `extension/page.css` | Viewer-Block, Einbau ins Fenster |
| `extension/manifest.*.json` | `storage`-Berechtigung, Skriptlisten |
| Tests: `extension/test/forwarding.test.js`, `viewer-view.test.js`, `bridge.test.js` (neu), `view-model.test.js` (ändern) | |
| `README.md` | Extension-Abschnitt |

Arbeit auf Branch `viewer-fenster` ab `main`.

---

### Task 1: Server – `POST /api/ingest/reset`

**Files:**
- Modify: `server/src/http.ts`
- Test: `server/test/http.test.ts`

**Interfaces:**
- Consumes: `DisplayHub.broadcast(state)`, `IDLE` aus `server/src/viewer/game-state.ts`.
- Produces: `POST /api/ingest/reset` → `200 {"ok":true}`, setzt alle Viewer auf `{ phase: "idle" }`.

- [ ] **Step 0: Branch**

```bash
cd /c/Projekte/raspdarts && git checkout -b viewer-fenster
```

- [ ] **Step 1: Failing Tests**

Am Ende von `server/test/http.test.ts` anhängen; oben importieren:
`import type { DisplaySocket } from "../src/viewer/display-hub.js";` und `import type { ViewerState } from "../src/viewer/game-state.js";`

```ts
describe("/api/ingest/reset", () => {
  test("setzt alle Viewer auf Warten", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    const unsupported: ViewerState = { phase: "unsupported", variant: "Cricket" };
    deps.hub.broadcast(unsupported);
    const sent: unknown[] = [];
    const socket: DisplaySocket = { send: (data) => sent.push(JSON.parse(data)), on: () => undefined };
    deps.hub.attach(socket, "standard");
    sent.length = 0;

    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/reset",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(sent).toEqual([{ type: "state", state: { phase: "idle" } }]);
  });

  test("verlangt den X-Raspdarts-Header", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "POST", url: "/api/ingest/reset" });

    expect(response.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Laufen lassen, muss scheitern**

Run: `cd server && npx vitest run test/http.test.ts`
Expected: FAIL (404 statt 200; der Header-Test bekommt ohne Route ebenfalls 404)

- [ ] **Step 3: Pfad einbauen**

In `server/src/http.ts` Import ergänzen: `import { IDLE } from "./viewer/game-state.js";`
Direkt nach dem `app.get("/ingest", …)`-Block einfügen:

```ts
  // Die Extension meldet "Weitergabe ausgeschaltet": Viewer sollen nicht auf
  // dem letzten Stand stehen bleiben. Ein blosser Verbindungsabbruch setzt
  // bewusst nichts zurueck (WLAN-Wackler mitten im Spiel).
  app.post("/api/ingest/reset", async () => {
    deps.hub.broadcast(IDLE);
    return { ok: true };
  });
```

- [ ] **Step 4: Alle Server-Tests**

Run: `cd server && npx vitest run && npx tsc --noEmit`
Expected: alle PASS, `tsc` ohne Ausgabe.

- [ ] **Step 5: Commit**

```bash
cd /c/Projekte/raspdarts && git add server/src/http.ts server/test/http.test.ts
git commit -m "Server: /api/ingest/reset setzt die Viewer auf Warten"
```

---

### Task 2: Extension – reine Logik und Texte

**Files:**
- Create: `extension/src/forwarding.js`, `extension/src/viewer-view.js`
- Modify: `extension/src/texts.js`, `extension/src/view-model.js`
- Test: `extension/test/forwarding.test.js`, `extension/test/viewer-view.test.js` (neu), `extension/test/view-model.test.js` (ändern)

**Interfaces:**
- Produces:
  - `globalThis.raspdartsForwarding = { FORWARD_KEY: 'forwardGameData', isForwardingOn(value): boolean }` – `false` nur bei genau `false`.
  - `globalThis.raspdartsViewerView = { viewerButtonState(on, t), viewerBlock({ forwardOn, status, reachable, now }, t), pickBoardId(apiResult, storedId) }`
    - `viewerButtonState` → `{ on: boolean, icon: 'monitor' | 'monitorOff', title: string }`
    - `viewerBlock` → `{ on: boolean, switchText: string, stateText: string, stateTone: 'ok' | 'off' | 'error' | 'pending' }`
    - `pickBoardId` → `string | null`
  - `buildView(...).pi` ist nur noch `{ raspdartsVersion }`.
  - Neue Textschlüssel (de/en): `windowTitle`, `viewerTitle`, `viewerSwitchLabel`, `viewerOn`, `viewerOff`, `viewerButtonOn`, `viewerButtonOff`, `viewerConnectedAgo` (mit `{s}`), `viewerConnectedNoMessage`, `viewerDisconnected`, `viewerForwardingOff`. Entfallen: `beamer`, `beamerConnected`, `beamerDisconnected`.

- [ ] **Step 1: Failing Tests schreiben**

`extension/test/forwarding.test.js`:

```js
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
```

`extension/test/viewer-view.test.js`:

```js
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
```

In `extension/test/view-model.test.js` die vier Beamer-Erwartungen ersetzen:
- `expect(view.pi).toEqual({ raspdartsVersion: '--', beamerText: '--', beamerTone: 'off' });` → `expect(view.pi).toEqual({ raspdartsVersion: '--' });`
- `expect(view.pi).toEqual({ raspdartsVersion: 'v2.0.0', beamerText: 'Verbunden', beamerTone: 'ok' });` → `expect(view.pi).toEqual({ raspdartsVersion: 'v2.0.0' });`
- `expect(view.pi).toEqual({ raspdartsVersion: '--', beamerText: 'Nicht verbunden', beamerTone: 'off' });` → `expect(view.pi).toEqual({ raspdartsVersion: '--' });`
- Zeile `expect(view.pi.beamerText).toBe('Connected');` im Test „englische Texte“ löschen.

- [ ] **Step 2: Laufen lassen, muss scheitern**

Run: `cd extension && npx vitest run`
Expected: FAIL – `forwarding.test.js`/`viewer-view.test.js` können die Module nicht laden; `view-model.test.js` scheitert an `pi` mit Beamer-Feldern.

- [ ] **Step 3: `forwarding.js`**

```js
'use strict';

// Ob die Extension Spieldaten an den Pi weitergibt. Der Schalter liegt je
// Browser in chrome.storage.local; ohne gespeicherten Wert gilt "an"
// (Verhalten vor dem Schalter). Genutzt von bridge.js und viewer.js.
// Siehe docs/superpowers/specs/2026-10-12-viewer-fenster-design.md.
(function (root) {
  const FORWARD_KEY = 'forwardGameData';

  function isForwardingOn(value) {
    return value !== false;
  }

  root.raspdartsForwarding = { FORWARD_KEY, isForwardingOn };
})(globalThis);
```

- [ ] **Step 4: `viewer-view.js`**

```js
'use strict';

// Reine Logik fuer den Viewer-Knopf auf der Board-Karte und den Viewer-Block
// im Fenster. Ohne DOM, damit sie sich ohne Browser testen laesst.
// Siehe docs/superpowers/specs/2026-10-12-viewer-fenster-design.md.
(function (root) {
  function viewerButtonState(on, t) {
    return on
      ? { on: true, icon: 'monitor', title: t.viewerButtonOn }
      : { on: false, icon: 'monitorOff', title: t.viewerButtonOff };
  }

  // status: letzte Antwort von /api/status; reachable: null = noch keine
  // Antwort, true/false = letzte Abfrage.
  function viewerBlock({ forwardOn, status, reachable, now }, t) {
    const base = { on: forwardOn, switchText: forwardOn ? t.viewerOn : t.viewerOff };
    if (!forwardOn) return { ...base, stateText: t.viewerForwardingOff, stateTone: 'off' };
    if (reachable === false) return { ...base, stateText: t.piUnreachable, stateTone: 'error' };
    if (reachable !== true || !status) return { ...base, stateText: t.connecting, stateTone: 'pending' };
    const ingest = status.beamer ?? {};
    if (!ingest.ingest_connected) return { ...base, stateText: t.viewerDisconnected, stateTone: 'off' };
    const last = Date.parse(ingest.last_message_at ?? '');
    if (Number.isNaN(last)) return { ...base, stateText: t.viewerConnectedNoMessage, stateTone: 'ok' };
    const seconds = Math.max(0, Math.round((now - last) / 1000));
    return { ...base, stateText: t.viewerConnectedAgo.replace('{s}', String(seconds)), stateTone: 'ok' };
  }

  // apiResult: Antwort des Background-Teils auf GET /api/cams.
  function pickBoardId(apiResult, storedId) {
    const fromPi = apiResult?.ok ? apiResult.data?.board_id : null;
    if (typeof fromPi === 'string' && fromPi.length > 0) return fromPi;
    return typeof storedId === 'string' && storedId.length > 0 ? storedId : null;
  }

  root.raspdartsViewerView = { pickBoardId, viewerBlock, viewerButtonState };
})(globalThis);
```

- [ ] **Step 5: Texte**

In `extension/src/texts.js`:

Tabelle `de`: die drei Zeilen `beamer: 'Beamer',`, `beamerConnected: 'Verbunden',`, `beamerDisconnected: 'Nicht verbunden',` ersetzen durch:

```js
    windowTitle: 'Raspdarts',
    viewerTitle: 'Viewer',
    viewerSwitchLabel: 'Spieldaten an den Pi senden',
    viewerOn: 'An',
    viewerOff: 'Aus',
    viewerButtonOn: 'Viewer (an)',
    viewerButtonOff: 'Viewer (aus)',
    viewerConnectedAgo: 'Verbunden – letzte Nachricht vor {s} s',
    viewerConnectedNoMessage: 'Verbunden – noch keine Nachricht',
    viewerDisconnected: 'Nicht verbunden',
    viewerForwardingOff: 'Weitergabe ausgeschaltet',
```

Tabelle `en`: die entsprechenden drei Zeilen (`beamer: 'Beamer',`, `beamerConnected: …`, `beamerDisconnected: …`) ersetzen durch:

```js
    windowTitle: 'Raspdarts',
    viewerTitle: 'Viewer',
    viewerSwitchLabel: 'Send game data to the Pi',
    viewerOn: 'On',
    viewerOff: 'Off',
    viewerButtonOn: 'Viewer (on)',
    viewerButtonOff: 'Viewer (off)',
    viewerConnectedAgo: 'Connected – last message {s} s ago',
    viewerConnectedNoMessage: 'Connected – no message yet',
    viewerDisconnected: 'Not connected',
    viewerForwardingOff: 'Forwarding switched off',
```

Dialogtexte anpassen (de):
- `updateRaspdarts.text`: `'Raspdarts auf dem Raspberry Pi wird aktualisiert und neu gestartet. Der Viewer ist dabei kurz weg.'`
- `uninstallRaspdarts.text`: `'Raspdarts wird vom Raspberry Pi entfernt. Dieses Fenster und der Viewer funktionieren danach nicht mehr.'`
- `restart.text`: `'Der Raspberry Pi startet neu. Viewer und Scheibe sind etwa eine Minute nicht verfügbar.'`

(en):
- `updateRaspdarts.text`: `'Raspdarts on the Raspberry Pi will be updated and restarted. The viewer will be gone briefly.'`
- `uninstallRaspdarts.text`: `'Raspdarts will be removed from the Raspberry Pi. This window and the viewer will stop working.'`
- `restart.text`: `'The Raspberry Pi will restart. Viewer and board will be unavailable for about a minute.'`

Vorher die bestehenden en-Werte von `beamerConnected`/`beamerDisconnected` und den en-Text von `updateRaspdarts` lesen, damit die Ersetzung genau trifft.

- [ ] **Step 6: `view-model.js`**

In `buildView` die Zeile `const beamerConnected = Boolean(s.beamer?.ingest_connected);` löschen und den Block `pi: { … }` ersetzen durch:

```js
      pi: {
        raspdartsVersion: isText(s.raspdarts_version) ? `v${s.raspdarts_version}` : EMPTY,
      },
```

- [ ] **Step 7: Tests laufen lassen, müssen bestehen**

Run: `cd extension && npx vitest run`
Expected: alle PASS (auch `texts.test.js`: gleiche Schlüssel, keine leeren Texte).

- [ ] **Step 8: Commit**

```bash
cd /c/Projekte/raspdarts && git add extension/src/forwarding.js extension/src/viewer-view.js extension/src/texts.js extension/src/view-model.js extension/test/forwarding.test.js extension/test/viewer-view.test.js extension/test/view-model.test.js
git commit -m "Extension: Logik und Texte fuer Viewer-Knopf, Viewer-Block und Weitergabe-Schalter"
```

---

### Task 3: Extension – Weitergabe nur bei „an“ (`bridge.js`)

**Files:**
- Modify: `extension/src/bridge.js`, `extension/manifest.chrome.json`, `extension/manifest.firefox.json`
- Test: `extension/test/bridge.test.js` (neu)

**Interfaces:**
- Consumes: `raspdartsForwarding` (Task 2).
- Produces: Verhalten: Port `raspdarts-ingest` nur bei „an“ offen; Frames nur bei „an“ gesendet; reagiert auf `chrome.storage.onChanged`.

- [ ] **Step 1: Failing Tests**

`extension/test/bridge.test.js`:

```js
import { afterEach, describe, expect, test, vi } from 'vitest';

// bridge.js laeuft als Content-Script; hier mit nachgemachtem window und chrome.
async function loadBridge(stored) {
  const ports = [];
  const changeListeners = [];
  const fakeWindow = new EventTarget();
  globalThis.window = fakeWindow;
  globalThis.chrome = {
    runtime: {
      connect: () => {
        const port = { posted: [], disconnected: false, postMessage(m) { this.posted.push(m); }, disconnect() { this.disconnected = true; }, onDisconnect: { addListener() {} } };
        ports.push(port);
        return port;
      },
    },
    storage: {
      local: { get: (key, cb) => cb(stored === undefined ? {} : { [key]: stored }) },
      onChanged: { addListener: (fn) => changeListeners.push(fn) },
    },
  };
  await import('../src/forwarding.js');
  await import(`../src/bridge.js?case=${Math.random()}`);
  const frame = (data) => {
    const event = new Event('message');
    Object.defineProperty(event, 'source', { value: fakeWindow });
    Object.defineProperty(event, 'data', { value: { source: 'raspdarts-hook', data } });
    fakeWindow.dispatchEvent(event);
  };
  const change = (newValue) => changeListeners.forEach((fn) => fn({ forwardGameData: { newValue } }, 'local'));
  return { ports, frame, change };
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
});
```

- [ ] **Step 2: Laufen lassen, muss scheitern**

Run: `cd extension && npx vitest run test/bridge.test.js`
Expected: FAIL – „ausgeschaltet …“ (bisher verbindet bridge.js immer) und „schaltet … ab“ (`disconnected` bleibt false); `chrome.storage` wird bisher nicht gelesen.

- [ ] **Step 3: `bridge.js` neu**

`extension/src/bridge.js` komplett:

```js
// Bruecke vom Seitenkontext zum Hintergrund: nimmt die von page-hook.js
// mitgelesenen Nachrichten an und schickt sie ueber einen Port weiter - aber
// nur, wenn die Weitergabe eingeschaltet ist (Viewer-Fenster, forwarding.js).
// Der offene Port sagt dem Hintergrund auch: es gibt einen Autodarts-Tab; ohne
// Port baut er die Verbindung zum Pi ab.
(function () {
  const { FORWARD_KEY, isForwardingOn } = globalThis.raspdartsForwarding;
  const HEARTBEAT_MS = 20_000;
  let port = null;
  let heartbeat = null;
  // Bis der gespeicherte Wert gelesen ist, geht nichts raus (Privatsphaere
  // vor den ersten Nachrichten; Autodarts schickt den Stand ohnehin erneut).
  let on = false;

  function connect() {
    if (port) return;
    port = chrome.runtime.connect({ name: 'raspdarts-ingest' });
    port.onDisconnect.addListener(() => { port = null; });
  }

  function disconnect() {
    const current = port;
    port = null;
    try {
      current?.disconnect();
    } catch {
      // Hintergrund schon weg
    }
  }

  function send(message) {
    if (!on) return;
    try {
      connect();
      port.postMessage(message);
    } catch {
      port = null; // Hintergrund neu gestartet - beim naechsten Mal neu verbinden
    }
  }

  function apply(value) {
    on = isForwardingOn(value);
    clearInterval(heartbeat);
    heartbeat = null;
    if (!on) {
      disconnect();
      return;
    }
    connect();
    // Haelt den Chrome-Service-Worker wach, solange der Tab offen ist; sonst
    // wuerde er nach 30 s Leerlauf samt Verbindung zum Pi beendet.
    heartbeat = setInterval(() => send({ type: 'heartbeat' }), HEARTBEAT_MS);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'raspdarts-hook') return;
    send({ type: 'frame', data: event.data.data });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && FORWARD_KEY in changes) apply(changes[FORWARD_KEY].newValue);
  });
  chrome.storage.local.get(FORWARD_KEY, (items) => apply(items?.[FORWARD_KEY]));
})();
```

- [ ] **Step 4: Manifeste**

In `extension/manifest.chrome.json` **und** `extension/manifest.firefox.json`:
- nach `"host_permissions": [ … ],` einfügen: `"permissions": ["storage"],`
- den Content-Script-Eintrag `"js": ["bridge.js"],` ersetzen durch `"js": ["forwarding.js", "bridge.js"],`

- [ ] **Step 5: Tests**

Run: `cd extension && npx vitest run`
Expected: alle PASS.

- [ ] **Step 6: Commit**

```bash
cd /c/Projekte/raspdarts && git add extension/src/bridge.js extension/test/bridge.test.js extension/manifest.chrome.json extension/manifest.firefox.json
git commit -m "Extension: Spieldaten nur bei eingeschalteter Weitergabe an den Pi"
```

---

### Task 4: Extension – gemeinsamer Baustein `board-card.js`, `cams.js` darauf umstellen

**Files:**
- Create: `extension/src/board-card.js`
- Modify: `extension/src/cams.js` (komplett neu, gleiches Verhalten)

**Interfaces:**
- Consumes: `raspdartsViewerView.pickBoardId` (Task 2), `raspdartsCamsView.isBoardsPage`, `raspdartsTexts`.
- Produces: `globalThis.raspdartsBoardCard`:
  - `ICONS: { camera, monitor, monitorOff }` (SVG-Strings)
  - `texts(): Texts` (Sprache nach Autodarts' Navigation, einmal bestimmt)
  - `sendToBackground(msg): Promise<any>` – wirft nie; ohne Extension-Kontext `{ ok:false, status:0, error:'Unreachable' }`
  - `storageGet(key): Promise<any>`, `storageSet(key, value): Promise<void>`
  - `loadBoard(): Promise<{ boardId: string, cams: number | null } | null>` – merkt `boardId`
  - `boardForVisit(): Promise<…>` – `loadBoard()` einmal je Besuch von `/boards`
  - `locateCard(boardId): { leftGroup, autodartsButtons: Element[], badge, name } | null`
  - `ensureButton(parts, { id, after, onClick }): HTMLSpanElement` (Hülle mit `data-raspdarts`, Knopf darin)
  - `setButton(wrap, { icon, iconName, title, disabled?, muted? })`
  - `openOverlay({ title, width?, css?, html?, closeLabel, onClose?, canEscape? }): { shadow, body, close }`
  - `watchBoardsPage({ onEnter, onChange, onLeave })`

- [ ] **Step 1: `board-card.js` schreiben**

```js
'use strict';

// Gemeinsamer Unterbau fuer unsere Knoepfe auf der Karte des Raspdarts-Boards
// (play.autodarts.com/boards): Board-ID, Karte finden, Knopf einsetzen,
// Fenster ueber der Seite, Seitenwechsel. Genutzt von cams.js und viewer.js.
// Siehe docs/superpowers/specs/2026-10-12-viewer-fenster-design.md.
(function (root) {
  const { pickBoardId } = root.raspdartsViewerView;
  const { isBoardsPage } = root.raspdartsCamsView;
  const { detectLanguage, getTexts } = root.raspdartsTexts;
  const BOARD_ID_KEY = 'boardId';

  // Symbole aus Lucide (https://lucide.dev), ISC-Lizenz, Copyright (c) Lucide Contributors.
  const svg = (body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICONS = {
    camera: svg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>'
      + '<circle cx="12" cy="13" r="3"/>'),
    monitor: svg('<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/>'
      + '<line x1="12" x2="12" y1="17" y2="21"/>'),
    monitorOff: svg('<path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.5 1-2 1-2"/><path d="M22 15V5a2 2 0 0 0-2-2H9"/>'
      + '<path d="M8 21h8"/><path d="M12 17v4"/><path d="m2 2 20 20"/>'),
  };

  // Farben ueber Autodarts' CSS-Variablen (sie wirken auch im Shadow DOM).
  const FRAME_STYLE = `
    .backdrop { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center;
      justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(0, 0, 0, 0.7); }
    .window { max-height: 100%; overflow: auto; box-sizing: border-box; padding: 20px;
      border-radius: 12px; background: var(--color-black-85, #1d1f24); color: var(--color-mono-white, #fff);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .head h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .close { width: 32px; height: 32px; flex-shrink: 0; border: 0; border-radius: 10px; cursor: pointer; font-size: 16px;
      background: var(--color-blue-60, #2563eb); color: var(--color-blue-05, #fff); }
    .close:hover { opacity: 0.9; }
    [hidden] { display: none !important; }
  `;

  let cachedTexts = null;
  let visit = null;

  function texts() {
    if (!cachedTexts) {
      cachedTexts = getTexts(detectLanguage(document.querySelector('header nav')?.getAttribute('aria-label')));
    }
    return cachedTexts;
  }

  // Nach einem Update der Extension ist der alte Kontext ungueltig und
  // sendMessage wirft; das gilt dann als "Pi nicht erreichbar".
  function sendToBackground(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (response) => resolve(response ?? { ok: false, status: 0, error: 'Unreachable' }));
      } catch {
        resolve({ ok: false, status: 0, error: 'Unreachable' });
      }
    });
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(key, (items) => resolve(items?.[key]));
      } catch {
        resolve(undefined);
      }
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  // cams ist null, wenn der Pi nicht antwortet und nur die gemerkte ID bekannt ist.
  async function loadBoard() {
    const [result, stored] = await Promise.all([
      sendToBackground({ type: 'fetch', url: '/api/cams' }),
      storageGet(BOARD_ID_KEY),
    ]);
    const boardId = pickBoardId(result, stored);
    if (!boardId) return null;
    if (boardId !== stored) storageSet(BOARD_ID_KEY, boardId);
    const cams = result?.ok && Number.isInteger(result.data?.cams) ? result.data.cams : null;
    return { boardId, cams };
  }

  function boardForVisit() {
    if (!visit) visit = loadBoard();
    return visit;
  }

  // Aufbau der Karte (Stand 12.10.2026):
  //   Karte > Kopfzeile (Name, Einstellungen, Zustands-Abzeichen) … Knopfzeile
  //   Knopfzeile > linke Gruppe (Starten/Stoppen, Kalibrieren, Board Manager)
  //              | rechte Gruppe (ID kopieren, "Board folgen"-Link, …)
  function locateCard(boardId) {
    const follow = document.querySelector(`a[href="/boards/${CSS.escape(boardId)}/follow"]`);
    const row = follow?.parentElement?.parentElement;
    const card = row?.parentElement;
    const leftGroup = row?.firstElementChild;
    const head = card?.firstElementChild;
    if (!card || !leftGroup || !head || leftGroup === follow.parentElement) return null;
    return {
      leftGroup,
      autodartsButtons: [...leftGroup.children].filter((el) => !el.dataset.raspdarts),
      badge: head.querySelector('.rounded-full'),
      name: head.querySelector('span')?.textContent.trim() || 'Board',
    };
  }

  // Der Knopf steckt in einem <span>, das den Hinweis traegt: Autodarts'
  // Klassen schalten bei deaktivierten Knoepfen die Maus ab, dann zeigte der
  // Knopf selbst keinen Hinweis.
  function ensureButton(parts, { id, after, onClick }) {
    let wrap = document.getElementById(id);
    if (wrap && parts.leftGroup.contains(wrap)) return wrap;
    wrap?.remove();
    wrap = document.createElement('span');
    wrap.id = id;
    wrap.dataset.raspdarts = '1';
    wrap.style.display = 'inline-flex';
    const btn = document.createElement('button');
    btn.type = 'button';
    const model = parts.autodartsButtons[1] ?? parts.autodartsButtons[0];
    btn.className = model?.className ?? '';
    btn.addEventListener('click', onClick);
    wrap.append(btn);
    if (after) after.after(wrap);
    else parts.leftGroup.append(wrap);
    return wrap;
  }

  // Schreibt nur, was sich aendert: jede Aenderung am DOM weckt die
  // MutationObserver, die wiederum diese Funktion aufrufen.
  function setButton(wrap, { icon, iconName, title, disabled = false, muted = false }) {
    const btn = wrap.firstElementChild;
    if (btn.dataset.icon !== iconName) {
      btn.innerHTML = icon;
      btn.dataset.icon = iconName;
    }
    if (btn.disabled !== disabled) btn.disabled = disabled;
    if (wrap.title !== title) {
      wrap.title = title;
      btn.setAttribute('aria-label', title);
    }
    if (btn.dataset.muted !== String(muted)) {
      btn.dataset.muted = String(muted);
      // Farben wie Autodarts' deaktivierte Knoepfe, aber klickbar.
      btn.style.background = muted ? 'var(--color-black-70, #2b2f36)' : '';
      btn.style.color = muted ? 'var(--color-black-30, #8b93a1)' : '';
    }
  }

  // canEscape: false, solange im Fenster etwas Eigenes Esc braucht (Rueckfrage).
  function openOverlay({ title, width = '1400px', css = '', html = '', closeLabel, onClose, canEscape = () => true }) {
    const host = document.createElement('div');
    host.dataset.raspdartsOverlay = '1';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${FRAME_STYLE}${css}</style>
      <div class="backdrop">
        <div class="window" role="dialog" aria-modal="true">
          <div class="head"><h2></h2><button type="button" class="close">✕</button></div>
          <div class="body">${html}</div>
        </div>
      </div>`;
    shadow.querySelector('.window').style.width = `min(${width}, 100%)`;
    shadow.querySelector('h2').textContent = title;
    const closeButton = shadow.querySelector('.close');
    closeButton.title = closeLabel;
    closeButton.setAttribute('aria-label', closeLabel);

    let open = true;
    function onKey(event) {
      if (event.key !== 'Escape' || !canEscape()) return;
      event.stopPropagation();
      close();
    }
    function close() {
      if (!open) return;
      open = false;
      host.remove();
      document.removeEventListener('keydown', onKey, true);
      onClose?.();
    }
    closeButton.addEventListener('click', close);
    shadow.querySelector('.backdrop').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) close();
    });
    document.body.append(host);
    document.addEventListener('keydown', onKey, true);
    return { shadow, body: shadow.querySelector('.body'), close };
  }

  // Autodarts wechselt Seiten ohne Neuladen und baut Karten neu auf; das
  // Abzeichen aendert dabei seinen Text.
  function watchBoardsPage({ onEnter, onChange, onLeave }) {
    let active = false;
    function check() {
      const onBoards = isBoardsPage(location.pathname);
      if (onBoards && !active) {
        active = true;
        onEnter();
      } else if (!onBoards && active) {
        active = false;
        visit = null;
        onLeave();
      } else if (onBoards) {
        onChange();
      }
    }
    check();
    new MutationObserver(check).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  root.raspdartsBoardCard = {
    ICONS, boardForVisit, ensureButton, loadBoard, locateCard, openOverlay,
    sendToBackground, setButton, storageGet, storageSet, texts, watchBoardsPage,
  };
})(globalThis);
```

- [ ] **Step 2: `cams.js` auf den Baustein umstellen**

`extension/src/cams.js` komplett:

```js
'use strict';

// Kamera-Knopf auf der Karte des Raspdarts-Boards (play.autodarts.com/boards)
// und das Fenster mit den Kamerabildern. Logik in cams-view.js, Karte und
// Fenster in board-card.js, die Bremse fuer Autodarts im Pi
// (server/src/system/cams.ts). Siehe docs/superpowers/specs/2026-10-12-kameras-design.md.
(function () {
  const { ROUND_PAUSE_MS, buttonState, emptyTiles, windowView } = globalThis.raspdartsCamsView;
  const card = globalThis.raspdartsBoardCard;

  const BUTTON_ID = 'raspdarts-cams-btn';
  const STYLE = `
    .message { margin: 24px 0; text-align: center; font-size: 16px; color: var(--color-black-20, #cacfd9); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
    .tile { margin: 0; }
    .frame { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background: #000; }
    img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .stale img { opacity: 0.35; }
    .note { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 700;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9); }
    .label { margin-top: 6px; font-size: 13px; color: var(--color-black-20, #cacfd9); }
  `;

  let board = null;   // { boardId, cams } aus board-card.js
  let session = null; // { open, tiles, message, overlay } solange das Fenster offen ist

  function refreshButton() {
    if (!board) return;
    const parts = card.locateCard(board.boardId);
    if (!parts) return;
    // Hinter Kalibrieren, dem zweiten Autodarts-Knopf der Gruppe.
    const wrap = card.ensureButton(parts, { id: BUTTON_ID, after: parts.autodartsButtons[1], onClick: openWindow });
    const state = buttonState(parts.badge?.textContent, card.texts());
    card.setButton(wrap, { icon: card.ICONS.camera, iconName: 'camera', title: state.title, disabled: !state.enabled });
  }

  function tileElement() {
    const figure = document.createElement('figure');
    figure.className = 'tile';
    figure.innerHTML = '<div class="frame"><img alt=""><span class="note" hidden></span></div>'
      + '<figcaption class="label"></figcaption>';
    return figure;
  }

  function render(current) {
    const shadow = current.overlay.shadow;
    const message = current.message ?? (current.tiles.length === 0 ? card.texts().camsNoImage : null);
    const paragraph = shadow.querySelector('.message');
    paragraph.hidden = !message;
    paragraph.textContent = message ?? '';

    const grid = shadow.querySelector('.grid');
    grid.hidden = Boolean(current.message);
    // Kacheln nur bei geaenderter Anzahl neu anlegen, sonst flackert es.
    while (grid.children.length > current.tiles.length) grid.lastElementChild.remove();
    while (grid.children.length < current.tiles.length) grid.append(tileElement());
    current.tiles.forEach((tile, i) => {
      const el = grid.children[i];
      el.querySelector('.label').textContent = tile.label;
      el.classList.toggle('stale', tile.stale);
      const img = el.querySelector('img');
      img.hidden = !tile.src;
      if (tile.src && img.getAttribute('src') !== tile.src) img.src = tile.src;
      const note = el.querySelector('.note');
      note.hidden = !tile.note;
      note.textContent = tile.note ?? '';
    });
  }

  function openWindow() {
    if (session || !board) return;
    const t = card.texts();
    const name = card.locateCard(board.boardId)?.name ?? 'Board';
    const current = { open: true, tiles: emptyTiles(board.cams ?? 0, t), message: null, overlay: null };
    session = current;
    current.overlay = card.openOverlay({
      title: `${t.camsTitle} – ${name}`,
      css: STYLE,
      html: '<p class="message" hidden></p><div class="grid"></div>',
      closeLabel: t.close,
      onClose: () => {
        current.open = false;
        if (session === current) session = null;
      },
    });
    render(current);
    // Kameraanzahl auffrischen (Kamera ab- oder angesteckt), dann Runden starten.
    card.loadBoard().then((fresh) => {
      if (!current.open) return;
      if (fresh) board = fresh;
      const count = board.cams ?? 0;
      if (count !== current.tiles.length) current.tiles = emptyTiles(count, t);
      render(current);
      runRounds(current);
    });
  }

  // Eine Runde holt alle Kameras nacheinander; die naechste beginnt erst eine
  // Sekunde nach dem Ende der vorigen. So stauen sich bei langsamem WLAN keine
  // Anfragen. Im versteckten Tab wird nichts geholt.
  async function runRounds(current) {
    while (current.open) {
      if (!document.hidden) {
        const results = [];
        for (let cam = 0; cam < current.tiles.length; cam += 1) {
          const result = await card.sendToBackground({ type: 'image', cam });
          if (!current.open) return;
          results.push(result);
          if (result?.status === 409) break; // Board steht: die anderen gar nicht erst fragen
        }
        const view = windowView(results, current.tiles, card.texts());
        current.tiles = view.tiles;
        current.message = view.message;
        render(current);
      }
      await new Promise((resolve) => setTimeout(resolve, ROUND_PAUSE_MS));
    }
  }

  card.watchBoardsPage({
    onEnter: () => card.boardForVisit().then((found) => { board = found; refreshButton(); }),
    onChange: refreshButton,
    onLeave: () => {
      board = null;
      session?.overlay.close();
    },
  });
})();
```

- [ ] **Step 3: Manifeste: Skriptliste**

In beiden Manifesten den dritten Content-Script-Eintrag (Liste mit `texts.js`) ersetzen durch:

```json
      "js": ["texts.js", "forwarding.js", "view-model.js", "stream.js", "page.js", "viewer-view.js", "cams-view.js", "board-card.js", "cams.js", "content.js"],
```

(`content.js` bleibt bis Task 5 drin, damit die Extension zwischendurch funktioniert.)

- [ ] **Step 4: Bauen, Tests, Syntax**

Run: `cd extension && npm run build && npx vitest run && node --check src/board-card.js && node --check src/cams.js && echo OK`
Expected: gebaut, alle Tests PASS, `OK`.

- [ ] **Step 5: Kamera-Knopf im Browser gegenprüfen**

Testaufbau wie im Kamera-Plan (`docs/superpowers/plans/2026-10-12-kameras.md`, Task 4 Schritt 5): lokaler Server (`AUTODARTS_URL=http://raspdarts.local:3180 npx tsx src/index.ts`), Hilfsserver `cams-proxy.mjs` (Port 8744) im Scratchpad, Shim per `evaluate_script`. Der Shim braucht jetzt zusätzlich `chrome.storage`:

```js
chrome.storage = {
  local: {
    get: (key, cb) => cb({ [key]: JSON.parse(localStorage.getItem('rd:' + key) ?? 'null') ?? undefined }),
    set: (items, cb) => {
      for (const [k, v] of Object.entries(items)) {
        const old = JSON.parse(localStorage.getItem('rd:' + k) ?? 'null') ?? undefined;
        localStorage.setItem('rd:' + k, JSON.stringify(v));
        (window.__rdChange ?? []).forEach((fn) => fn({ [k]: { oldValue: old, newValue: v } }, 'local'));
      }
      cb?.();
    },
  },
  onChanged: { addListener: (fn) => (window.__rdChange = [...(window.__rdChange ?? []), fn]) },
};
```

und lädt `texts.js`, `cams-view.js`, `viewer-view.js`, `board-card.js`, `cams.js` aus `dist/chrome`. Prüfen: Kamera-Knopf hinter Kalibrieren, Fenster öffnet mit Bildern (Board läuft) bzw. Knopf ausgegraut (Board steht), Esc/X schließen, `localStorage['rd:boardId']` ist gesetzt.

- [ ] **Step 6: Commit**

```bash
cd /c/Projekte/raspdarts && git add extension/src/board-card.js extension/src/cams.js extension/manifest.chrome.json extension/manifest.firefox.json
git commit -m "Extension: gemeinsamer Baustein fuer Knoepfe und Fenster auf der Board-Karte"
```

---

### Task 5: Extension – Viewer-Knopf und Fenster (`viewer.js`), Navigation entfernen

**Files:**
- Create: `extension/src/viewer.js`
- Delete: `extension/src/content.js`
- Modify: `extension/src/page.js`, `extension/page.html`, `extension/page.css`, beide Manifeste

**Interfaces:**
- Consumes: `raspdartsBoardCard` (Task 4), `raspdartsViewerView`, `raspdartsForwarding` (Task 2), `raspdartsViewModel.{ACTIONS, buildView, errorMessage}`, `raspdartsStream.runStream`, `raspdartsPage.create`.
- Produces: `raspdartsPage.create({ t, onAction, onActivityClosed, onToggle })` → `{ host, render(view, viewer), confirm, closeDialog, isDialogOpen, startActivity, appendLog, finishActivity, closeActivity }`.

- [ ] **Step 1: `page.html` – Viewer-Block, Beamer-Zeile raus**

Direkt nach `<div class="wrap">` einfügen:

```html
  <section class="card viewer">
    <h2><span data-text="viewerTitle"></span></h2>
    <div class="switch-row">
      <span data-text="viewerSwitchLabel"></span>
      <button class="switch" data-field="viewerSwitch" role="switch" aria-checked="true">
        <span class="knob"></span><span data-field="viewerSwitchText"></span>
      </button>
    </div>
    <div class="viewer-state"><span class="dot" data-field="viewerDot"></span><span data-field="viewerState">--</span></div>
  </section>
```

Und die Zeile löschen:

```html
        <div class="row"><span class="key" data-text="beamer"></span><span class="val"><span class="dot" data-field="beamerDot"></span><span data-field="beamerStatus">--</span></span></div>
```

- [ ] **Step 2: `page.css` – Einbau ins Fenster, Schalter**

`:host`-Regel ersetzen durch:

```css
:host {
  all: initial;
  display: block;
  font-family: "Manrope Variable", "Manrope", sans-serif;
  color: var(--color-mono-white, #fff);
}
```

`.wrap`-Regel ersetzen durch:

```css
.wrap {
  display: grid;
  gap: 16px;
}
```

Am Ende der Datei anhängen:

```css
/* Viewer-Block: Weitergabe an/aus */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  font-size: 14px;
}
.switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border-radius: 999px;
  font-weight: 700;
  background: var(--color-black-70, #2b2f36);
  color: var(--color-black-20, #cacfd9);
}
.switch .knob {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-black-30, #8b93a1);
}
.switch[aria-checked="true"] { background: var(--color-blue-60, #0b55df); color: var(--color-mono-white, #fff); }
.switch[aria-checked="true"]:hover:not(:disabled) { background: var(--color-blue-50, #4a89ff); }
.switch[aria-checked="true"] .knob { background: var(--color-mono-white, #fff); }
.viewer-state {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 14px;
  color: var(--color-black-20, #cacfd9);
}
```

- [ ] **Step 3: `page.js` anpassen**

- Kopfkommentar: „Aktionen meldet sie an content.js“ → „Aktionen und den Schalter meldet sie an viewer.js“.
- Signatur: `async function create({ t, onAction, onActivityClosed, onToggle }) {`
- `render(view)` → `render(view, viewer)`; die drei Zeilen mit `beamerStatus`/`beamerDot` ersetzen durch:

```js
      const viewerSwitch = field('viewerSwitch');
      viewerSwitch.setAttribute('aria-checked', String(viewer.on));
      field('viewerSwitchText').textContent = viewer.switchText;
      field('viewerState').textContent = viewer.stateText;
      field('viewerDot').dataset.tone = viewer.stateTone;
```

- Im Klick-Handler nach der Zeile mit `button.dataset.action` einfügen:

```js
      else if (button === field('viewerSwitch')) onToggle();
```

- Im Rückgabeobjekt nach `closeDialog: …` ergänzen: `isDialogOpen: () => resolveDialog !== null,`

- [ ] **Step 4: `viewer.js` schreiben**

```js
'use strict';

// Viewer-Knopf auf der Karte des Raspdarts-Boards anstelle von Autodarts'
// Board Manager (unter v2 ohne Funktion) und das Fenster dazu: Schalter fuer
// die Weitergabe der Spieldaten und die bisherige Raspdarts-Seite (page.js).
// Siehe docs/superpowers/specs/2026-10-12-viewer-fenster-design.md.
(function () {
  const { ACTIONS, buildView, errorMessage } = globalThis.raspdartsViewModel;
  const { viewerBlock, viewerButtonState } = globalThis.raspdartsViewerView;
  const { FORWARD_KEY, isForwardingOn } = globalThis.raspdartsForwarding;
  const card = globalThis.raspdartsBoardCard;

  const BUTTON_ID = 'raspdarts-viewer-btn';
  const STATUS_INTERVAL_MS = 10_000;
  const POWER_CLOSE_MS = 3_000;
  // Letzte Spieldaten, die noch unterwegs sind, sollen den Reset nicht ueberholen.
  const RESET_DELAY_MS = 500;

  let board = null;       // { boardId, cams } aus board-card.js
  let forwardOn = true;   // bis der gespeicherte Wert gelesen ist
  let status = null;      // letzte erfolgreiche Antwort von /api/status
  let reachable = null;   // null = noch keine Antwort
  let busy = false;       // eine Aktion laeuft
  let pagePromise = null;
  let page = null;
  let overlay = null;
  let pollTimer = null;

  // --- Knopf ---------------------------------------------------------------------

  function refreshButton() {
    if (!board) return;
    const parts = card.locateCard(board.boardId);
    if (!parts) return;
    // Board Manager ist der letzte Autodarts-Knopf der Gruppe; nur verstecken,
    // nicht entfernen, damit Autodarts' eigene Darstellung heil bleibt. Mit
    // weniger als drei Knoepfen stimmt der Aufbau nicht - dann nichts verstecken.
    const buttons = parts.autodartsButtons;
    const manager = buttons.length >= 3 ? buttons[buttons.length - 1] : null;
    if (manager && manager.style.display !== 'none') manager.style.setProperty('display', 'none', 'important');
    const wrap = card.ensureButton(parts, { id: BUTTON_ID, after: manager, onClick: openWindow });
    const state = viewerButtonState(forwardOn, card.texts());
    card.setButton(wrap, { icon: card.ICONS[state.icon], iconName: state.icon, title: state.title, muted: !state.on });
  }

  // --- Fenster -------------------------------------------------------------------

  function getPage() {
    if (!pagePromise) {
      pagePromise = globalThis.raspdartsPage
        .create({ t: card.texts(), onAction: runAction, onActivityClosed: fetchStatus, onToggle: toggleForwarding })
        .then((created) => { page = created; return created; })
        .catch((error) => { pagePromise = null; throw error; });
    }
    return pagePromise;
  }

  function render() {
    if (!page) return;
    const t = card.texts();
    page.render(buildView({ status, reachable, busy }, t), viewerBlock({ forwardOn, status, reachable, now: Date.now() }, t));
  }

  async function openWindow() {
    if (overlay) return;
    let created;
    try {
      created = await getPage();
    } catch (error) {
      // getPage setzt sich zurueck, der naechste Klick versucht es erneut.
      console.error('Raspdarts: Fenster konnte nicht geladen werden', error);
      return;
    }
    if (overlay) return;
    const t = card.texts();
    const name = (board && card.locateCard(board.boardId)?.name) || 'Board';
    overlay = card.openOverlay({
      title: `${t.windowTitle} – ${name}`,
      width: '1100px',
      closeLabel: t.close,
      canEscape: () => !created.isDialogOpen(),
      // Die Seite wird nur ausgehaengt: Eine laufende Aktion samt Protokoll laeuft weiter.
      onClose: () => {
        overlay = null;
        created.closeDialog();
        stopPolling();
      },
    });
    overlay.body.append(created.host);
    render();
    fetchStatus();
    startPolling();
  }

  // --- Status --------------------------------------------------------------------

  async function fetchStatus() {
    const result = await card.sendToBackground({ type: 'fetch', url: '/api/status' });
    if (result?.ok) {
      status = result.data;
      reachable = true;
    } else {
      reachable = false;
    }
    render();
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => { if (!busy) fetchStatus(); }, STATUS_INTERVAL_MS);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  // --- Weitergabe an/aus ---------------------------------------------------------

  async function toggleForwarding() {
    const next = !forwardOn;
    await card.storageSet(FORWARD_KEY, next); // onChanged aktualisiert Knopf und Fenster
    if (!next) {
      setTimeout(() => card.sendToBackground({ type: 'fetch', url: '/api/ingest/reset', method: 'POST' }), RESET_DELAY_MS);
    }
  }

  function applyForwarding(value) {
    forwardOn = isForwardingOn(value);
    refreshButton();
    render();
  }

  // --- Aktionen ------------------------------------------------------------------

  async function runAction(key) {
    const action = ACTIONS[key];
    if (busy || !action || !page) return;
    const confirmed = await page.confirm(key, action.danger);
    if (!confirmed || busy) return;

    busy = true;
    render();
    page.startActivity(card.texts().dialogs[key].title);
    if (action.kind === 'stream') runStream(action);
    else runPower(action);
  }

  function finishAction(success, message) {
    busy = false;
    page.finishActivity(success, message);
    render();
  }

  function runStream(action) {
    const t = card.texts();
    globalThis.raspdartsStream.runStream({
      connect: () => chrome.runtime.connect({ name: 'raspdarts-stream' }),
      url: action.url,
      onLog: (line) => page.appendLog(line),
      onEnd: (result) => {
        if (result.kind === 'conflict') finishAction(false, t.alreadyRunning);
        else if (result.kind === 'disconnected') finishAction(false, t.disconnected);
        else finishAction(result.success, result.success ? t.success : errorMessage(result.error, t));
      },
    });
  }

  async function runPower(action) {
    const t = card.texts();
    const result = await card.sendToBackground({ type: 'fetch', url: action.url, method: 'POST' });
    if (result?.ok) {
      finishAction(true, t[action.doneText]);
      // Nicht schliessen, falls inzwischen schon die naechste Aktion laeuft.
      setTimeout(() => { if (!busy) page.closeActivity(); fetchStatus(); }, POWER_CLOSE_MS);
    } else if (result?.status === 409) {
      finishAction(false, t.alreadyRunning);
    } else {
      finishAction(false, errorMessage(result?.data?.error || result?.error, t));
    }
  }

  // --- Start ---------------------------------------------------------------------

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && FORWARD_KEY in changes) applyForwarding(changes[FORWARD_KEY].newValue);
  });
  card.storageGet(FORWARD_KEY).then(applyForwarding);

  card.watchBoardsPage({
    onEnter: () => card.boardForVisit().then((found) => { board = found; refreshButton(); }),
    onChange: refreshButton,
    onLeave: () => {
      board = null;
      overlay?.close();
    },
  });
})();
```

- [ ] **Step 5: `content.js` löschen, Manifeste**

```bash
cd /c/Projekte/raspdarts && git rm extension/src/content.js
```

In beiden Manifesten im dritten Content-Script-Eintrag `"content.js"` durch `"viewer.js"` ersetzen:

```json
      "js": ["texts.js", "forwarding.js", "view-model.js", "stream.js", "page.js", "viewer-view.js", "cams-view.js", "board-card.js", "cams.js", "viewer.js"],
```

Prüfen, dass nichts mehr auf `content.js` oder `raspdarts-nav-btn` verweist: `grep -rn "content.js\|raspdarts-nav-btn\|raspdarts-beamer-dot" extension/src extension/*.json extension/build.sh` → keine Treffer.

- [ ] **Step 6: Bauen und Tests**

Run: `cd extension && npm run build && npx vitest run && node --check src/viewer.js && node --check src/page.js && echo OK`
Expected: gebaut, alle Tests PASS, `OK`.

- [ ] **Step 7: Im Browser prüfen**

Aufbau wie Task 4 Schritt 5; der Shim lädt jetzt `texts.js`, `forwarding.js`, `view-model.js`, `stream.js`, `page.js`, `viewer-view.js`, `cams-view.js`, `board-card.js`, `cams.js`, `viewer.js`. Für `page.js` braucht der Shim `chrome.runtime.getURL = (p) => 'http://localhost:8744/dist/' + p` (der Hilfsserver liefert `page.html`/`page.css` aus `dist/chrome`; im Hilfsserver den Content-Type nach Endung setzen: `.html` → `text/html`, `.css` → `text/css`, sonst `text/javascript`) und für Aktionen `chrome.runtime.connect` (für die Prüfung hier nicht nötig – Update wird erst in Task 6 echt ausgelöst).

Punkte, jeder mit Snapshot/Screenshot oder `evaluate_script` belegt:
1. Linke Gruppe: Starten/Stoppen, Kalibrieren, Kameras, Viewer; Board Manager unsichtbar (`display:none`), nicht entfernt.
2. Nach Wechsel zu „Start“ und zurück: genau ein Kamera- und ein Viewer-Knopf, Board Manager wieder versteckt, Reihenfolge gleich.
3. Viewer-Knopf öffnet das Fenster „Raspdarts – raspdarts“: Viewer-Block oben, Pi-Werte, Autodarts- und Pi-Karte mit vier Knöpfen; Zustand „Verbunden …“ oder „Nicht verbunden“ passend zu `/api/status`.
4. Schalter auf „Aus“: Knopf wird grau mit `monitor-off`, Hinweis „Viewer (aus)“; `localStorage['rd:forwardGameData'] === 'false'`; nach ~0,5 s geht `POST /api/ingest/reset` an den lokalen Server (Viewer `http://localhost:8743/` zeigt „Warte auf Spieldaten …“). Schalter wieder „An“: Knopf blau mit `monitor`.
5. Neu laden + Shim erneut laden: Schalter-Zustand bleibt erhalten.
6. „Raspdarts deinstallieren“ anklicken → Rückfrage; Esc schließt **nur** die Rückfrage, Fenster bleibt; zweites Esc schließt das Fenster. (Nicht bestätigen!)
7. Hilfsserver (8744) beenden, Seite neu laden, Shim mit `localStorage['rd:boardId']` neu laden: Viewer-Knopf erscheint trotzdem; Fenster zeigt „Pi nicht erreichbar“; Schalter lässt sich umschalten. Danach Hilfsserver wieder starten.
8. Kein Eintrag „Raspdarts“ in der Hauptnavigation; Konsole ohne Fehler von unseren Skripten.

Die Weitergabe selbst (`bridge.js`) ist im Shim-Aufbau nicht aktiv; sie wird in Task 6 mit der echten Extension geprüft.

- [ ] **Step 8: Commit**

```bash
cd /c/Projekte/raspdarts && git add extension/src/viewer.js extension/src/page.js extension/page.html extension/page.css extension/manifest.chrome.json extension/manifest.firefox.json
git commit -m "Extension: Viewer-Knopf statt Board Manager, Raspdarts-Seite ins Fenster, Navigationseintrag entfernt"
```

---

### Task 6: Doku, Review, Ausrollen, Prüfung mit der echten Extension

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README**

In `README.md` im Abschnitt „## Extension installieren“ die Zeile
`  Falls die Raspdarts-Seite den Pi nicht erreicht: unter \`about:addons\` → Raspdarts → Berechtigungen den Zugriff auf \`raspdarts.local\` erlauben.`
ersetzen durch:
`  Falls das Raspdarts-Fenster den Pi nicht erreicht: unter \`about:addons\` → Raspdarts → Berechtigungen den Zugriff auf \`raspdarts.local\` erlauben.`

und nach der Firefox-Zeile ergänzen:

```markdown

Die Extension fügt auf `play.autodarts.com/boards` der Karte des Raspdarts-Boards zwei Knöpfe hinzu: **Kameras** (Standbilder der Kameras) und **Viewer** anstelle von „Board Manager“ (Weitergabe der Spieldaten an/aus, Pi-Werte, Aktualisieren, Neu starten, Herunterfahren, Deinstallieren).
```

In der API-Tabelle nach der Zeile `| WS | \`/ingest\` | Spieldaten von der Extension |` ergänzen:

```markdown
| POST | `/api/ingest/reset` | Viewer auf „Warte auf Spieldaten“ (Extension beim Ausschalten der Weitergabe) |
```

- [ ] **Step 2: Alle Tests, Commit**

```bash
cd /c/Projekte/raspdarts/server && npx vitest run && npx tsc --noEmit
cd ../extension && npx vitest run && npm run build
cd .. && git add README.md && git commit -m "Doku: Viewer-Knopf und Kameras in der README, /api/ingest/reset"
```

- [ ] **Step 3: Finale Prüfung des Branches, Merge**

Review des ganzen Branches (executing-plans: frischer Reviewer), Fixes per TDD, dann `git checkout main && git merge --no-ff viewer-fenster`, Tests auf `main`.

- [ ] **Step 4: Push und Update über das Fenster**

Nach Arnolds Freigabe: `git push origin main`. Arnold lädt die Extension neu (`chrome://extensions` → Raspdarts → Neu laden, aus `extension/dist/chrome`; Chrome fragt evtl. nach der neuen Berechtigung „Speicher“ – nicht nötig, `storage` erzeugt keinen Hinweis). Dann öffnet Arnold auf `/boards` das Viewer-Fenster und klickt **Raspdarts aktualisieren** → bestätigen. Prüfen:
- Protokoll läuft im Fenster; Fenster zwischendurch schließen und wieder öffnen → Protokoll steht da, Update läuft weiter; Ende „Erfolgreich abgeschlossen“.
- Danach `curl -s -X POST -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/ingest/reset` → `{"ok":true}`.

- [ ] **Step 5: Weitergabe mit der echten Extension prüfen**

1. Schalter an: `curl -s -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/status` → `beamer.ingest_connected: true` (Autodarts-Tab offen).
2. Schalter aus: nach wenigen Sekunden `ingest_connected: false`; Viewer (`http://raspdarts.local:8743/`) zeigt „Warte auf Spieldaten …“.
3. Zweiten Autodarts-Tab offen lassen und in einem Tab ausschalten → `ingest_connected: false` (alle Tabs getrennt).
4. Schalter an: `ingest_connected: true`.
5. Ergebnis an Arnold melden.
