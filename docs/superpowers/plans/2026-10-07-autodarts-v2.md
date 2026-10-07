# Raspdarts für Autodarts v2 – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raspdarts verändert Autodarts nicht mehr, sondern zeigt nur noch Version und Zustand der v2-Scheibe an, bzw. den offiziellen Installationsbefehl, wenn Autodarts fehlt.

**Architecture:** Der Pi-Dienst liest die Version nur noch am v2-Ort und fragt den Zustand bei der Scheibe selbst ab (`GET http://127.0.0.1:3180/api/state`), als neues Feld `autodarts_board` in `/api/status`. Die Autodarts-Endpunkte, -Skripte und sudo-Rechte entfallen. Die Extension ersetzt in der Karte „Autodarts“ alle Knöpfe durch eine Zustandszeile bzw. einen Kasten mit dem Installationsbefehl.

**Tech Stack:** Server: TypeScript, Fastify 5, Vitest 2, Node 22 (`fetch`, `AbortSignal.timeout`). Extension: plain JavaScript (IIFE auf `globalThis`), Vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-07-autodarts-v2-design.md`

## Global Constraints

- Zustand-Quelle: `http://127.0.0.1:3180/api/state`, Zeitlimit **1500 ms**.
- `autodarts_board` ist `{ running: boolean; connected: boolean; status: string } | null`; `null` bei jedem Fehler oder wenn `running`/`connected` keine Booleans sind; `status` wird `""`, wenn es kein String ist.
- Versionserkennung fragt nur `${home}/.local/bin/autodarts --version`; ohne Ergebnis bleibt `autodarts_version` `"unknown"`.
- Raspdarts ruft `/api/config` der Scheibe nie auf (enthält den API-Key).
- Installationsbefehl wörtlich: `curl -fsSL autodarts.sh | bash -s -- --headless`
- Zustandstexte DE/EN: Läuft/Running (grün), Nicht mit Autodarts verbunden/Not connected to Autodarts (rot), Gestoppt/Stopped (grau), Keine Antwort/No answer (grau), Nicht installiert/Not installed (grau).
- Server-Tests: `cd server && npm test`; Extension-Tests: `cd extension && npm test`.
- Kommentare im Code Deutsch ohne Umlaute, Texte für Nutzer mit Umlauten.

## Review Focus

1. **Scheibe hängt statt abzulehnen** (Port offen, aber keine Antwort): `/api/status` darf nicht länger als ~1,5 s zusätzlich brauchen und liefert `autodarts_board: null`. → Test in Task 1 (Zeitlimit wird an `fetchJson` übergeben; Ablehnung → `null`); Prüfung am Pi in Task 5.
2. **Scheibe liefert anderes JSON** (z. B. künftige v2-Version benennt Felder um): Anzeige „Keine Antwort“ statt Absturz oder „undefined“. → Tests in Task 1 und Task 3.
3. **Pi mit gestopptem Autodarts-Dienst**: Zustand „Keine Antwort“, Version weiterhin angezeigt. → Test in Task 3, Prüfung am Pi in Task 5.
4. **Kopieren scheitert** (Clipboard verweigert): kein Fehler, Befehl bleibt markierbar. → Prüfung im Browser in Task 4.
5. **Alte Extension gegen neuen Pi bzw. neue Extension gegen alten Pi** (während des Ausrollens): neue Extension mit Pi ohne `autodarts_board` zeigt „Keine Antwort“; alte Extension mit neuem Pi bekommt beim Install-Knopf 404 und zeigt einen Fehler statt zu hängen. → Test in Task 3 (fehlendes Feld), 404-Test in Task 2.

---

## Dateien

| Datei | Änderung | Task |
|---|---|---|
| `server/src/system/status.ts` | `AutodartsBoard`, `parseBoardState`, `fetchJson`-Abhängigkeit, Feld `autodarts_board`, Version nur v2-Ort | 1 |
| `server/test/status.test.ts` | Tests dazu | 1 |
| `server/test/helpers.ts` | `autodarts_board: null` im Test-Status | 1 |
| `server/src/http.ts` | Autodarts-Routen raus | 2 |
| `server/scripts/autodarts-install.sh`, `autodarts-uninstall.sh` | löschen | 2 |
| `server/scripts/setup-root.sh` | `SUDO_SCRIPTS` ohne Autodarts | 2 |
| `server/test/jobs.test.ts` | auf verbleibende Skripte umstellen, 404-Test | 2 |
| `README.md` | Beschreibung, Voraussetzung v2, API-Tabelle | 2 |
| `extension/src/texts.js`, `extension/test/texts.test.js` | Texte | 3 |
| `extension/src/view-model.js`, `extension/test/view-model.test.js` | Autodarts-Anzeige, `ACTIONS` | 3 |
| `extension/page.html`, `extension/page.css`, `extension/src/page.js` | Karte ohne Knöpfe, Installationskasten | 4 |

---

### Task 1: Version nur am v2-Ort, Zustand der Scheibe im Status

**Files:**
- Modify: `server/src/system/status.ts`
- Modify: `server/test/status.test.ts`
- Modify: `server/test/helpers.ts:22-31`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `export interface AutodartsBoard { running: boolean; connected: boolean; status: string }`
  - `SystemStatus.autodarts_board: AutodartsBoard | null`
  - `export function parseBoardState(body: unknown): AutodartsBoard | null`
  - `StatusDeps.fetchJson: (url: string, timeoutMs: number) => Promise<unknown>`
  - JSON von `/api/status` enthält `autodarts_board`.

- [ ] **Step 1: Failing tests schreiben**

In `server/test/status.test.ts`:

1. Import ergänzen: `parseBoardState` in die Import-Liste aus `../src/system/status.js`.
2. In `fakeDeps` nach `run: …` einfügen:

```ts
    fetchJson: async () => {
      throw new Error("ECONNREFUSED");
    },
```

3. Im Test „liefert alle Felder, Autodarts nicht installiert“ im erwarteten Objekt nach `autodarts_version: "unknown",` einfügen:

```ts
      autodarts_board: null,
```

4. Den Test „erkennt die Autodarts-Version ueber den ersten antwortenden Pfad“ ersetzen durch:

```ts
  test("liest die Autodarts-Version nur am v2-Ort", async () => {
    const tried: string[] = [];
    const run = async (command: string) => {
      tried.push(command);
      if (command === "/home/pi/.local/bin/autodarts --version") return "autodarts v2.0.2 (vision 2.0.0)";
      throw new Error("not found");
    };

    const status = await createStatusReader(fakeDeps({ run }))();

    expect(status.autodarts_version).toBe("2.0.2");
    expect(tried).toEqual(["/home/pi/.local/bin/autodarts --version"]);
  });
```

5. Am Dateiende anhängen:

```ts
describe("Zustand der Scheibe", () => {
  test("fragt /api/state der Scheibe mit Zeitlimit", async () => {
    const calls: [string, number][] = [];
    const fetchJson = async (url: string, timeoutMs: number) => {
      calls.push([url, timeoutMs]);
      return { connected: true, event: "Started", numThrows: 0, running: true, status: "Throw" };
    };

    const status = await createStatusReader(fakeDeps({ fetchJson }))();

    expect(calls).toEqual([["http://127.0.0.1:3180/api/state", 1500]]);
    expect(status.autodarts_board).toEqual({ running: true, connected: true, status: "Throw" });
  });

  test("Scheibe antwortet nicht oder zu spaet: null", async () => {
    const fetchJson = async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    };

    const status = await createStatusReader(fakeDeps({ fetchJson }))();

    expect(status.autodarts_board).toBeNull();
  });

  test.each([
    ["kein Objekt", "kein json"],
    ["null", null],
    ["running fehlt", { connected: true, status: "Throw" }],
    ["connected kein Boolean", { running: true, connected: "ja", status: "Throw" }],
  ])("unerwartete Antwort (%s): null", (_name, body) => {
    expect(parseBoardState(body)).toBeNull();
  });

  test("fehlender oder falscher status wird zu leerem Text", () => {
    expect(parseBoardState({ running: false, connected: true })).toEqual({ running: false, connected: true, status: "" });
    expect(parseBoardState({ running: true, connected: false, status: 3 })).toEqual({ running: true, connected: false, status: "" });
  });
});
```

In `server/test/helpers.ts` im Objekt von `status` nach `autodarts_version: "unknown",` einfügen:

```ts
      autodarts_board: null,
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd server && npx vitest run test/status.test.ts`
Expected: FAIL – `parseBoardState` ist kein Export (bzw. TypeScript-/Laufzeitfehler beim Import), der Versionstest findet die alten Kandidaten.

- [ ] **Step 3: Implementierung**

In `server/src/system/status.ts`:

a) Nach `type Interfaces = …;` bzw. vor `export interface SystemStatus` einfügen:

```ts
/** Zustand der Autodarts-Scheibe (v2) aus ihrer eigenen Schnittstelle. */
export interface AutodartsBoard {
  running: boolean;
  connected: boolean;
  status: string;
}
```

b) In `SystemStatus` nach `autodarts_version: string;` einfügen:

```ts
  autodarts_board: AutodartsBoard | null;
```

c) In `StatusDeps` nach `run: …;` einfügen:

```ts
  /** GET mit Zeitlimit, liefert das JSON; wirft bei Fehler, Zeitlimit oder HTTP-Fehler. */
  fetchJson: (url: string, timeoutMs: number) => Promise<unknown>;
```

d) Die Funktion `autodartsCandidates` samt Kommentar ersetzen durch:

```ts
/** Autodarts v2 legt seinen Befehl immer hierhin (Symlink ins Programmverzeichnis). */
function autodartsBinary(home: string): string {
  return `${home}/.local/bin/autodarts`;
}

// GET /api/state der Scheibe; laeuft sie nicht, soll /api/status nicht lange warten.
const BOARD_STATE_URL = "http://127.0.0.1:3180/api/state";
const BOARD_TIMEOUT_MS = 1500;

/**
 * Liest running/connected/status aus der Antwort der Scheibe. Alles
 * Unerwartete (anderes Format einer kuenftigen Version) gilt als keine Antwort.
 */
export function parseBoardState(body: unknown): AutodartsBoard | null {
  if (typeof body !== "object" || body === null) return null;
  const { running, connected, status } = body as Record<string, unknown>;
  if (typeof running !== "boolean" || typeof connected !== "boolean") return null;
  return { running, connected, status: typeof status === "string" ? status : "" };
}
```

e) In `defaultStatusDeps()` nach dem `run: …`-Eintrag einfügen:

```ts
    fetchJson: async (url, timeoutMs) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
```

f) In `createStatusReader` die Funktion `autodartsVersion` ersetzen und `autodartsBoard` daneben stellen:

```ts
  async function autodartsVersion(): Promise<string> {
    try {
      return parseVersion(await deps.run(`${autodartsBinary(deps.home)} --version`)) ?? "unknown";
    } catch {
      return "unknown";
    }
  }

  async function autodartsBoard(): Promise<AutodartsBoard | null> {
    try {
      return parseBoardState(await deps.fetchJson(BOARD_STATE_URL, BOARD_TIMEOUT_MS));
    } catch {
      return null;
    }
  }
```

g) Im zurückgegebenen Reader `Promise.all` und das Ergebnis erweitern:

```ts
    const [cpu_percent, meminfo, temp, uptime, autodarts_version, autodarts_board] = await Promise.all([
      cpu(),
      deps.readFile("/proc/meminfo"),
      deps.readFile("/sys/class/thermal/thermal_zone0/temp"),
      deps.readFile("/proc/uptime"),
      autodartsVersion(),
      autodartsBoard(),
    ]);
```

und im Rückgabeobjekt nach `autodarts_version,` die Zeile `autodarts_board,` einfügen.

- [ ] **Step 4: Tests laufen lassen**

Run: `cd server && npx vitest run test/status.test.ts && npm test && npx tsc --noEmit`
Expected: alle Tests grün, `tsc` ohne Fehler.

- [ ] **Step 5: Commit**

```bash
git add server/src/system/status.ts server/test/status.test.ts server/test/helpers.ts
git commit -m "Status: Autodarts-Version nur am v2-Ort, Zustand der Scheibe abfragen"
```

---

### Task 2: Autodarts-Installation aus dem Pi-Dienst entfernen

**Files:**
- Modify: `server/src/http.ts:50-55`
- Delete: `server/scripts/autodarts-install.sh`, `server/scripts/autodarts-uninstall.sh`
- Modify: `server/scripts/setup-root.sh:11`
- Modify: `server/test/jobs.test.ts`
- Modify: `README.md:5-6,87` und Abschnitt „Installation auf dem Pi“

**Interfaces:**
- Consumes: nichts aus Task 1
- Produces: `POST /api/autodarts/install` und `/api/autodarts/uninstall` antworten 404.

- [ ] **Step 1: Failing test schreiben, bestehende Tests umstellen**

In `server/test/jobs.test.ts`:

1. Im Test „reicht Ausgabezeilen weiter und meldet Erfolg“ beide Vorkommen von `"autodarts-install.sh"` durch `"raspdarts-update.sh"` ersetzen.
2. Im Test „streamt einen Auftrag als SSE“: `` `http://${host}/api/autodarts/install` `` → `` `http://${host}/api/system/update` `` und `expect(started).toEqual(["autodarts-install.sh"]);` → `expect(started).toEqual(["raspdarts-update.sh"]);`.
3. Im `test.each` die Zeile `["/api/autodarts/uninstall", "autodarts-uninstall.sh"],` löschen.
4. Im Test „antwortet mit 409, solange ein Auftrag laeuft“: `` `http://${host}/api/autodarts/install` `` → `` `http://${host}/api/system/uninstall` ``.
5. Im `describe("Routen", …)` nach dem `test.each(…)`-Block einfügen:

```ts
  test.each(["/api/autodarts/install", "/api/autodarts/uninstall"])(
    "%s gibt es nicht mehr",
    async (path) => {
      const started: string[] = [];
      const jobs = new JobRunner((name) => {
        started.push(name);
        return asChild(fakeChild());
      });
      app = await buildApp(testDeps({ jobs }));
      const host = await listen(app);

      const response = await fetch(`http://${host}${path}`, {
        method: "POST",
        headers: { "X-Raspdarts": "1" },
      });
      await response.text();

      expect(response.status).toBe(404);
      expect(started).toEqual([]);
    },
  );
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd server && npx vitest run test/jobs.test.ts`
Expected: FAIL – die beiden neuen Tests bekommen 200 statt 404 und starten ein Skript; die umgestellten Tests sind grün.

- [ ] **Step 3: Implementierung**

In `server/src/http.ts` in `JOB_ROUTES` die beiden Zeilen

```ts
  "/api/autodarts/install": "autodarts-install.sh",
  "/api/autodarts/uninstall": "autodarts-uninstall.sh",
```

löschen.

```bash
git rm server/scripts/autodarts-install.sh server/scripts/autodarts-uninstall.sh
```

In `server/scripts/setup-root.sh` Zeile 11 ersetzen durch:

```bash
SUDO_SCRIPTS=(raspdarts-update.sh raspdarts-uninstall.sh reboot.sh shutdown.sh)
```

- [ ] **Step 4: Tests laufen lassen**

Run: `cd server && npm test && npx tsc --noEmit && bash -n scripts/setup-root.sh && grep -rn "autodarts-install\|autodarts-uninstall" src scripts test || echo "keine Reste"`
Expected: alle Tests grün, keine Fehler, „keine Reste“.

- [ ] **Step 5: README anpassen**

In `README.md`:

Zeilen 5–6

```
- **Pi-Verwaltung** direkt aus play.autodarts.com: CPU, RAM, Temperatur, Autodarts
  installieren und aktualisieren, Pi neu starten oder herunterfahren. Kein SSH nötig.
```

ersetzen durch

```
- **Pi-Verwaltung** direkt aus play.autodarts.com: CPU, RAM, Temperatur, Version und
  Zustand von Autodarts, Raspdarts aktualisieren, Pi neu starten oder herunterfahren.
```

Am Anfang des Abschnitts „## Installation auf dem Pi“ (direkt unter der Überschrift) einfügen:

````
Voraussetzung ist Autodarts headless v2. Falls noch nicht vorhanden, auf dem Pi:

```bash
curl -fsSL autodarts.sh | bash -s -- --headless
```

Danach `ad` starten und unter „Service“ den Dienst einschalten, damit die Scheibe
nach einem Neustart von selbst läuft. Raspdarts installiert und aktualisiert
Autodarts nicht; v2 aktualisiert sich selbst.

````

In der API-Tabelle die Zeile

```
| POST | `/api/autodarts/install`, `/api/autodarts/uninstall` | SSE-Stream |
```

löschen und die Zeile

```
| GET | `/api/status` | Systemwerte und Beamer-Verbindung |
```

ersetzen durch

```
| GET | `/api/status` | Systemwerte, Autodarts-Version und -Zustand, Beamer-Verbindung |
```

- [ ] **Step 6: Commit**

```bash
git add server/src/http.ts server/scripts/setup-root.sh server/test/jobs.test.ts README.md
git commit -m "Autodarts nicht mehr ueber Raspdarts installieren oder entfernen"
```

---

### Task 3: Extension – Texte und Anzeigewerte für Version und Zustand

**Files:**
- Modify: `extension/src/texts.js`
- Modify: `extension/test/texts.test.js:50-56`
- Modify: `extension/src/view-model.js`
- Modify: `extension/test/view-model.test.js`

**Interfaces:**
- Consumes: `/api/status` mit `autodarts_board` (Task 1)
- Produces:
  - `buildView(...).autodarts = { version: string, stateText: string, stateTone: 'ok'|'error'|'off', showInstall: boolean }` (ersetzt `statusText`, `statusTone`, `mainAction`, `mainLabel`, `canUninstall`, `showMonitor`, `monitorUrl`)
  - `ACTIONS` hat nur noch `updateRaspdarts`, `uninstallRaspdarts`, `restart`, `shutdown`.
  - Neue Textschlüssel: `boardRunning`, `boardDisconnected`, `boardStopped`, `boardNoAnswer`, `installHint`, `copy`, `copied`. Entfallen: `installed`, `installAutodarts`, `updateAutodarts`, `uninstallAutodarts`, `openMonitor`, `dialogs.installAutodarts`, `dialogs.updateAutodarts`, `dialogs.uninstallAutodarts`.

- [ ] **Step 1: Failing tests schreiben**

In `extension/test/texts.test.js` im Test „jede Aktion hat Titel, Text und Bestaetigung“ die Liste ersetzen:

```js
    const actions = ['updateRaspdarts', 'uninstallRaspdarts', 'restart', 'shutdown'];
```

In `extension/test/view-model.test.js`:

1. In `STATUS` `autodarts_version: '0.27.4',` ersetzen durch:

```js
  autodarts_version: '2.0.2',
  autodarts_board: { running: true, connected: true, status: 'Throw' },
```

2. Im Test „laedt: …“ den Block `expect(view.autodarts).toMatchObject({ … });` ersetzen durch:

```js
    expect(view.autodarts).toEqual({ version: '--', stateText: '--', stateTone: 'off', showInstall: false });
```

3. Im Test „erreichbar: …“ den Block `expect(view.autodarts).toEqual({ … });` ersetzen durch:

```js
    expect(view.autodarts).toEqual({ version: '2.0.2', stateText: 'Läuft', stateTone: 'ok', showInstall: false });
```

4. Den Test „Autodarts nicht installiert: installieren statt aktualisieren“ ersetzen durch:

```js
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
```

5. Im Test „unvollstaendige Antwort: fehlende Felder als --“ die Zeile mit `{ autodarts_version: '0.27.4', temp_celsius: null }` auf `{ autodarts_version: '2.0.2', temp_celsius: null }` ändern und die zwei Zeilen

```js
    expect(view.autodarts.showMonitor).toBe(false);
    expect(view.autodarts.monitorUrl).toBe(null);
```

ersetzen durch

```js
    expect(view.autodarts).toEqual({ version: '2.0.2', stateText: 'Keine Antwort', stateTone: 'off', showInstall: false });
```

6. Im Test „fehlende Autodarts-Version gilt als nicht installiert“ die Zeile `expect(view.autodarts.mainAction).toBe('installAutodarts');` ersetzen durch:

```js
    expect(view.autodarts.showInstall).toBe(true);
```

7. Im Test „englische Texte“ die Zeile `expect(view.autodarts.mainLabel).toBe('Update Autodarts');` ersetzen durch:

```js
    expect(view.autodarts.stateText).toBe('Running');
```

8. Im `describe('ACTIONS', …)` als ersten Test einfügen:

```js
  test('keine Autodarts-Aktionen mehr', () => {
    expect(Object.keys(vm.ACTIONS).sort()).toEqual(['restart', 'shutdown', 'uninstallRaspdarts', 'updateRaspdarts']);
  });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd extension && npm test`
Expected: FAIL in `texts.test.js` (Dialoge) und `view-model.test.js` (neue Form von `autodarts`, `ACTIONS`).

- [ ] **Step 3: Texte anpassen**

In `extension/src/texts.js`, Tabelle `de`:
- Zeile `installed: 'Installiert',` löschen.
- `status: 'Status',` ersetzen durch `status: 'Zustand',`.
- Die vier Zeilen `installAutodarts: …`, `updateAutodarts: …`, `uninstallAutodarts: …`, `openMonitor: …` ersetzen durch:

```js
    boardRunning: 'Läuft',
    boardDisconnected: 'Nicht mit Autodarts verbunden',
    boardStopped: 'Gestoppt',
    boardNoAnswer: 'Keine Antwort',
    installHint: 'Autodarts ist auf dem Pi nicht installiert. Führe diesen Befehl per SSH auf dem Pi aus und schalte danach in „ad“ unter „Service“ den Dienst ein.',
    copy: 'Kopieren',
    copied: 'Kopiert',
```

- In `dialogs` die Einträge `installAutodarts`, `updateAutodarts`, `uninstallAutodarts` (je vier Zeilen samt `},`) löschen.

Tabelle `en` entsprechend:
- `installed: 'Installed',` löschen.
- `status: 'Status',` ersetzen durch `status: 'State',`.
- `installAutodarts`, `updateAutodarts`, `uninstallAutodarts`, `openMonitor` ersetzen durch:

```js
    boardRunning: 'Running',
    boardDisconnected: 'Not connected to Autodarts',
    boardStopped: 'Stopped',
    boardNoAnswer: 'No answer',
    installHint: 'Autodarts is not installed on the Pi. Run this command on the Pi via SSH, then turn on the service in “ad” under “Service”.',
    copy: 'Copy',
    copied: 'Copied',
```

- In `dialogs` dieselben drei Einträge löschen.

- [ ] **Step 4: View-Model anpassen**

In `extension/src/view-model.js`:

a) In `ACTIONS` die drei Zeilen `installAutodarts`, `updateAutodarts`, `uninstallAutodarts` löschen.

b) Vor `function pillFor` einfügen:

```js
  // Version und Zustand der Scheibe. autodarts_board kommt vom Pi (GET /api/state
  // der Scheibe); fehlt es oder ist es null, antwortet die Scheibe nicht.
  function autodartsView(online, installed, s, t) {
    if (!online) return { version: EMPTY, stateText: EMPTY, stateTone: 'off', showInstall: false };
    if (!installed) return { version: EMPTY, stateText: t.notInstalled, stateTone: 'off', showInstall: true };
    const board = s.autodarts_board;
    let state;
    if (!board || typeof board !== 'object') state = { text: t.boardNoAnswer, tone: 'off' };
    else if (!board.running) state = { text: t.boardStopped, tone: 'off' };
    else if (!board.connected) state = { text: t.boardDisconnected, tone: 'error' };
    else state = { text: t.boardRunning, tone: 'ok' };
    return { version: s.autodarts_version, stateText: state.text, stateTone: state.tone, showInstall: false };
  }
```

c) In `buildView` die Zeile `const mainAction = online && !installed ? 'installAutodarts' : 'updateAutodarts';` löschen und den ganzen Block `autodarts: { … },` ersetzen durch:

```js
      autodarts: autodartsView(online, installed, s, t),
```

- [ ] **Step 5: Tests laufen lassen**

Run: `cd extension && npm test`
Expected: alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git add extension/src/texts.js extension/test/texts.test.js extension/src/view-model.js extension/test/view-model.test.js
git commit -m "Extension: Autodarts nur noch mit Version und Zustand anzeigen"
```

---

### Task 4: Extension – Karte ohne Knöpfe, Installationskasten

**Files:**
- Modify: `extension/page.html:24-40`
- Modify: `extension/page.css` (anhängen)
- Modify: `extension/src/page.js`

**Interfaces:**
- Consumes: `view.autodarts = { version, stateText, stateTone, showInstall }` (Task 3), Texte `installHint`, `copy`, `copied` (Task 3).
- Produces: fertige Extension.

Kein Unit-Test (DOM); geprüft im Browser.

- [ ] **Step 1: `page.html` – Karte „Autodarts“ ersetzen**

Den ganzen ersten `<section class="card">` innerhalb von `<div class="grid" data-field="cards">` (von `<section class="card">` mit `data-text="autodarts"` bis zum zugehörigen `</section>`) ersetzen durch:

```html
    <section class="card">
      <h2><span data-text="autodarts"></span></h2>
      <div class="rows">
        <div class="row"><span class="key" data-text="version"></span><span class="val" data-field="autodartsVersion">--</span></div>
        <div class="row"><span class="key" data-text="status"></span><span class="val"><span class="dot" data-field="autodartsDot"></span><span data-field="autodartsStatus">--</span></span></div>
      </div>
      <div class="install" data-field="install" hidden>
        <p data-text="installHint"></p>
        <div class="command">
          <code data-field="installCommand">curl -fsSL autodarts.sh | bash -s -- --headless</code>
          <button data-field="copyCommand" data-text="copy"></button>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: `page.css` – Stil für den Kasten anhängen**

Am Ende von `extension/page.css` anhängen:

```css

/* Installationsbefehl, wenn Autodarts auf dem Pi fehlt */
.install p { margin: 0 0 12px; }
.command {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--color-black-90, #01040b);
}
.command code {
  flex: 1;
  font: 13px/1.5 ui-monospace, Consolas, monospace;
  color: var(--color-black-20, #cacfd9);
  overflow-wrap: anywhere;
  user-select: all;
}
```

- [ ] **Step 3: `page.js` anpassen**

In `extension/src/page.js`:

a) Die Zeile `let monitorUrl = null;` löschen.

b) In `render` den Block von `const autodarts = view.autodarts;` bis einschließlich `monitorUrl = autodarts.monitorUrl;` ersetzen durch:

```js
      const autodarts = view.autodarts;
      field('autodartsVersion').textContent = autodarts.version;
      field('autodartsStatus').textContent = autodarts.stateText;
      field('autodartsDot').dataset.tone = autodarts.stateTone;
      field('install').hidden = !autodarts.showInstall;
```

c) In `render` die Zeile `field('uninstallAutodarts').disabled = view.disabled || !autodarts.canUninstall;` löschen.

d) Vor `function confirm(` einfügen:

```js
    // Klappt das Kopieren nicht (keine Berechtigung), bleibt der Befehl markierbar.
    async function copyCommand(button) {
      try {
        await navigator.clipboard.writeText(field('installCommand').textContent);
      } catch {
        return;
      }
      button.textContent = t.copied;
      setTimeout(() => { button.textContent = t.copy; }, 2000);
    }
```

e) Im Klick-Handler die Zeile

```js
      else if (button === field('monitor') && monitorUrl) window.open(monitorUrl, '_blank', 'noopener');
```

ersetzen durch

```js
      else if (button === field('copyCommand')) copyCommand(button);
```

- [ ] **Step 4: Prüfen und bauen**

Run:

```bash
cd extension && node --check src/page.js && npm test && npm run build
grep -n "monitor\|uninstallAutodarts\|autodartsMain\|installAutodarts\|updateAutodarts" src/*.js page.html || echo "keine Reste"
```

Expected: keine Syntaxfehler, Tests grün, Build fertig, „keine Reste“.

- [ ] **Step 5: Im Browser prüfen (simulierter Pi)**

Wie bei der Raspdarts-Seite: lokalen CORS-Server auf `extension/dist/chrome` starten (Skript `serve.mjs` im Scratchpad, Port 8765), play.autodarts.com im DevTools-Chrome laden, Dateien `texts.js`, `view-model.js`, `stream.js`, `page.js`, `content.js` mit `chrome.runtime`-Shim einhängen. Der Shim liefert für `/api/status` ein Objekt, dessen `autodarts_version` und `autodarts_board` sich pro Prüfung umstellen lassen. Prüfen (Screenshot und `evaluate_script` im Shadow DOM):

1. `2.0.2` + `{running:true,connected:true}` → Zeile „Zustand · 🟢 Läuft“, kein Kasten, keine Knöpfe in der Karte.
2. `{running:true,connected:false}` → „Nicht mit Autodarts verbunden“, roter Punkt.
3. `{running:false,connected:true}` → „Gestoppt“, grauer Punkt.
4. `autodarts_board: null` → „Keine Antwort“.
5. `autodarts_version: 'unknown'` → „Nicht installiert“ + Kasten mit Befehl; Klick auf „Kopieren“ → Knopf zeigt „Kopiert“ und nach 2 s wieder „Kopieren“, oder (wenn die Zwischenablage verweigert wird) bleibt „Kopieren“ ohne Fehler in der Konsole.
6. Karte „Raspberry Pi“ unverändert mit ihren drei Knöpfen.

Danach den Server beenden (per PID).

- [ ] **Step 6: Commit**

```bash
git add extension/page.html extension/page.css extension/src/page.js
git commit -m "Extension: Autodarts-Karte ohne Knoepfe, Installationsbefehl zum Kopieren"
```

---

### Task 5: Am Pi ausrollen und prüfen

Läuft erst, **nachdem** Arnold dem Merge nach `main` und dem Push zugestimmt hat (der Pi aktualisiert sich von `main`).

**Files:** keine Änderungen im Repo.

- [ ] **Step 1: Raspdarts auf dem Pi aktualisieren**

Run (sudo-Passwort aus `.env` über stdin, nie in der Befehlszeile):

```bash
PW=$(grep '^PI_PASSWORD=' .env | cut -d= -f2-)
printf '%s\n' "$PW" | ssh pi@raspdarts.local 'sudo -S -p "" bash ~/raspdarts/server/scripts/raspdarts-update.sh' | grep -E "^---|fertig|rror"
```

Expected: „Update fertig, der Dienst startet in 2 Sekunden neu.“

- [ ] **Step 2: Status prüfen**

```bash
ssh pi@raspdarts.local 'sleep 5; curl -s -H "X-Raspdarts: 1" http://localhost:8743/api/status; echo; sudo -n -l 2>/dev/null | grep -c autodarts || true'
```

Expected: JSON enthält `"autodarts_version":"2.0.2"` und `"autodarts_board":{"running":true,"connected":true,"status":"Throw"}`; die sudo-Rechte nennen keine Autodarts-Skripte mehr (`/etc/sudoers.d/raspdarts` per `sudo cat` mit Passwort prüfen).

- [ ] **Step 3: „Keine Antwort“ prüfen**

```bash
ssh pi@raspdarts.local 'systemctl --user stop autodarts; sleep 2; time curl -s -H "X-Raspdarts: 1" http://localhost:8743/api/status; echo; systemctl --user start autodarts; sleep 15; curl -s -H "X-Raspdarts: 1" http://localhost:8743/api/status | grep -o "\"autodarts_board\":[^}]*}"'
```

Expected: bei gestopptem Dienst `"autodarts_board":null` und die Anfrage dauert nicht länger als ca. 2 s; danach wieder `running:true`.

- [ ] **Step 4: Einmaliges Aufräumen (nur Arnolds Pi)**

```bash
printf '%s\n' "$PW" | ssh pi@raspdarts.local 'sudo -S -p "" sh -c "rm -f /usr/local/lib/raspdarts/autodarts-install.sh /usr/local/lib/raspdarts/autodarts-uninstall.sh && rm -rf /root/.local/opt/autodarts && ls /usr/local/lib/raspdarts /root/.local/opt 2>&1"'
```

`tmux` nur entfernen, wenn Arnold das möchte (`sudo apt-get remove -y tmux`).

- [ ] **Step 5: Abnahme durch Arnold**

Arnold lädt die Extension in `chrome://extensions` neu und prüft auf der Raspdarts-Seite: Karte „Autodarts“ zeigt „2.0.2“ und „Läuft“ ohne Knöpfe; Karte „Raspberry Pi“ unverändert.
