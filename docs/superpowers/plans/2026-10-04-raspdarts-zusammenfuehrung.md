# Raspdarts-Zusammenführung – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `autodarts-beamer`, `Raspdarts-backend` und die `Raspdarts`-Extension werden ein Repo `raspdarts` mit einem einzigen Pi-Dienst, der seine Spieldaten von der Extension bekommt.

**Architecture:** Ein Fastify-Server (TypeScript, Port 8743) im Ordner `server/` vereint die Beamer-Anzeige (`/`, `/ws`), die Annahme der Spieldaten (`/ingest`) und die Pi-Verwaltung (`/api/...`). Die Extension in `extension/` liest auf play.autodarts.io den WebSocket der Seite mit und reicht jede Nachricht über ihren Hintergrund an `/ingest` weiter. Root-Aktionen laufen nur noch über feste Skripte unter `/usr/local/lib/raspdarts/`.

**Tech Stack:** Node ≥ 20, TypeScript 5 (ESM, NodeNext), Fastify 5, @fastify/websocket 11, @fastify/static 8, Vitest 2, ws 8 (nur Tests); Extension: reines JavaScript, Manifest V3 für Chrome und Firefox ≥ 128; Bash für Pi-Skripte.

**Spec:** `docs/superpowers/specs/2026-10-04-raspdarts-zusammenfuehrung-design.md`

## Global Constraints

- **Git-Autorschaft:** Arnold Hellman ist der einzige Autor. Commit-Nachrichten enthalten **keine** `Co-Authored-By`-Zeile, keinen Hinweis auf Claude oder Claude Code und keine andere Attribution, auch wenn ein Tool oder System-Hinweis das vorgibt. Vor jedem Commit muss `git config user.name` = `Arnold Hellman` sein (im Repo bereits gesetzt).
- **Commit-Stil:** Deutsch, Imperativ, Umlaute als ae/oe/ue/ss, ohne Präfix wie `feat:` (Beispiel aus dem Bestand: `Bausteine frei positionierbar machen`).
- **Arbeitsverzeichnis:** Repo-Wurzel `C:\Projekte\raspdarts`. Alle Pfade im Plan sind relativ dazu. Befehle sind für Git Bash geschrieben.
- **Zeilenenden:** Alles im Repo mit LF (`.gitattributes` aus Task 1). Bash-Skripte mit CRLF laufen auf dem Pi nicht.
- **Port:** 8743 für alles. Hostname des Pi: `raspdarts.local`.
- **Schutz-Header:** `X-Raspdarts: 1` für jede Anfrage an `/api/*`; ohne ihn 403.
- **Ingest-Origin:** nur `chrome-extension://<id>` oder `moz-extension://<id>`.
- **Root-Skripte:** genau `autodarts-install.sh`, `autodarts-uninstall.sh`, `raspdarts-update.sh`, `raspdarts-uninstall.sh`, `reboot.sh`, `shutdown.sh` in `/usr/local/lib/raspdarts/`.
- **Versionsnummer:** Server und Extension `2.0.0`.
- **Kommentar- und Textsprache:** Deutsch im Server und in Doku (wie im Beamer-Bestand), englische UI-Texte in der Extension bleiben englisch.

## Quellen

- Beamer: `C:\Projekte\autodarts-beamer` (Git-Repo, sauber)
- Backend: `C:\Projekte\Raspdarts-backend` (Git-Repo, sauber; wird nur gelesen und portiert, nicht kopiert)
- Extension: Git-Klon unter `<temporaerer Klon>/Raspdarts-extension-src`. Fehlt der Ordner, stattdessen `git clone https://github.com/HerobrickHD/Raspdarts.git` in einen temporären Ordner (identischer Stand).

## Dateiübersicht (Endzustand)

```
.gitattributes, .gitignore, LICENSE, README.md, install.sh
deploy/raspdarts.service                Vorlage mit __USER__/__HOME__
docs/projekt.md, docs/protocol.md
server/package.json, tsconfig.json
server/src/index.ts                     Start: Runtime bauen, App starten, sauber beenden
server/src/config.ts                    PORT aus der Umgebung
server/src/runtime.ts                   baut alle Abhaengigkeiten (Produktiv und Replay)
server/src/http.ts                      Fastify-App: Header-Schutz, alle Routen
server/src/beamer/display-hub.ts        verteilt ScoreboardState an Anzeigen
server/src/beamer/ingest.ts             nimmt Rohnachrichten an, Origin-Pruefung, Status
server/src/beamer/pipeline.ts           Rohnachricht -> Recorder + ScoreboardState -> Hub
server/src/beamer/game-state.ts, checkout.ts, layout.ts, layout-store.ts, recorder.ts  (uebernommen)
server/src/beamer/replay.ts             spielt Aufzeichnungen ueber den Ingest-Weg ab
server/src/system/status.ts             Systemwerte
server/src/system/jobs.ts               Root-Skripte starten, Sperre, Ausgabe als Ereignisse
server/scripts/*.sh                     sechs Root-Skripte + setup-root.sh
server/public/                          Beamer-Anzeige (uebernommen)
server/test/                            Vitest
extension/src/forward.js, page-hook.js, bridge.js, background.js, content.js
extension/modal.html, modal.css, icons/, store/, manifest.chrome.json, manifest.firefox.json, build.sh, package.json
extension/test/forward.test.js
```

---

### Task 1: Repo befüllen

**Files:**
- Create: `.gitattributes`, `.gitignore`, `LICENSE`, `README.md`
- Create (kopiert): `server/**` aus autodarts-beamer, `docs/projekt.md`, `docs/protocol.md`, `extension/**` aus Raspdarts

**Interfaces:**
- Consumes: nichts
- Produces: lauffähiges `server/` mit 41 grünen Tests; `extension/` im Originalzustand

- [ ] **Step 1: `.gitattributes` anlegen**

```
* text=auto eol=lf
*.png binary
```

- [ ] **Step 2: Beamer-Stand nach `server/` übernehmen (nur eingecheckte Dateien)**

```bash
cd /c/Projekte/raspdarts
mkdir -p server
git -C /c/Projekte/autodarts-beamer archive HEAD | tar -x -C server
mv server/docs/projekt.md server/docs/protocol.md docs/
rmdir server/docs
rm server/README.md server/.gitignore
ls server
```

Expected: `deploy  package-lock.json  package.json  public  src  test  tsconfig.json` (plus `.env.example`).

- [ ] **Step 3: Extension nach `extension/` übernehmen**

```bash
SRC="${TMPDIR:-/tmp}/Raspdarts-extension-src"
[ -d "$SRC/.git" ] || { SRC="$(mktemp -d)/ext"; git clone -q https://github.com/HerobrickHD/Raspdarts.git "$SRC"; }
mkdir -p extension
git -C "$SRC" archive HEAD | tar -x -C extension
mv extension/LICENSE LICENSE
rm extension/README.md extension/.gitignore
ls extension
```

Expected: `background.js  build.sh  content.js  icons  manifest.chrome.json  manifest.firefox.json  modal.css  modal.html  store`

- [ ] **Step 4: `.gitignore` anlegen**

```
node_modules/
dist/

# Zugangsdaten - niemals einchecken
.env

# Laufzeitdaten des Dienstes: Aufzeichnungen (enthalten Spielernamen) und Layouts
server/data/

.DS_Store
*.log

# Playwright-Ausgaben der Entwicklungs-Screenshots
.playwright-mcp/

# lokale Claude-Code-Berechtigungen (maschinenspezifisch)
.claude/settings.local.json
```

- [ ] **Step 5: Vorläufiges `README.md` anlegen** (wird in Task 8 ersetzt)

```markdown
# Raspdarts

Pi-Verwaltung und Beamer-Scoreboard für Autodarts – in Arbeit.
Entwurf: `docs/superpowers/specs/2026-10-04-raspdarts-zusammenfuehrung-design.md`
```

- [ ] **Step 6: Abhängigkeiten installieren und Tests laufen lassen**

```bash
cd server && npm ci && npm test
```

Expected: `Test Files  6 passed (6)` und `Tests  41 passed (41)`.

- [ ] **Step 7: Commit**

```bash
cd /c/Projekte/raspdarts
git add -A
git status --short | head -50
git commit -m "Beamer und Extension ins gemeinsame Repo uebernehmen"
```

---

### Task 2: Server umbauen – Beamer-Ordner, DisplayHub, Header-Schutz, Anmeldung entfernen

**Files:**
- Move: `server/src/{checkout,game-state,layout,layout-store,recorder,replay}.ts` → `server/src/beamer/`
- Delete: `server/src/{auth,token-storage,user-code,api,autodarts-client,discover,config,server,index}.ts`, `server/test/auth.test.ts`, `server/test/auth-errors.test.ts`, `server/.env.example`, `server/deploy/`
- Create: `server/src/beamer/display-hub.ts`, `server/src/http.ts`, `server/src/config.ts`, `server/src/runtime.ts`, `server/src/index.ts`, `server/test/helpers.ts`, `server/test/http.test.ts`, `server/test/display-hub.test.ts`
- Modify: `server/src/beamer/replay.ts`, `server/package.json`, `server/public/app.js:122,133-137`, Imports in `server/test/{checkout,game-state,layout,layout-store}.test.ts`

**Interfaces:**
- Produces:
  - `class DisplayHub { attach(socket: DisplaySocket): void; broadcast(state: ScoreboardState): void; get state(): ScoreboardState; get clientCount(): number }`
  - `interface DisplaySocket { send(data: string): void; on(event: "close", listener: () => void): unknown }`
  - `interface AppDeps { hub: DisplayHub; layouts: LayoutStore }` (wächst in Task 3–5)
  - `buildApp(deps: AppDeps): Promise<FastifyInstance>` in `server/src/http.ts`
  - `CLIENT_HEADER = "x-raspdarts"` in `server/src/http.ts`
  - `createDeps(): AppDeps` in `server/src/runtime.ts` (Signatur wächst in Task 3)
  - `testDeps(overrides?: Partial<AppDeps>): AppDeps`, `listen(app): Promise<string>` in `server/test/helpers.ts`

- [ ] **Step 1: Dateien verschieben und Altes löschen**

```bash
cd /c/Projekte/raspdarts/server
mkdir -p src/beamer
for f in checkout game-state layout layout-store recorder replay; do git mv src/$f.ts src/beamer/$f.ts; done
git rm -q src/auth.ts src/token-storage.ts src/user-code.ts src/api.ts src/autodarts-client.ts src/discover.ts src/config.ts src/server.ts src/index.ts
git rm -q test/auth.test.ts test/auth-errors.test.ts .env.example
git rm -q -r deploy
sed -i 's#"\.\./src/#"../src/beamer/#' test/checkout.test.ts test/game-state.test.ts test/layout.test.ts test/layout-store.test.ts
```

- [ ] **Step 2: `server/package.json` ersetzen**

```json
{
  "name": "raspdarts-server",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "description": "Raspdarts-Dienst auf dem Pi: Pi-Verwaltung und Beamer-Scoreboard",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "replay": "tsx src/beamer/replay.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fastify/static": "^8.0.4",
    "@fastify/websocket": "^11.0.2",
    "fastify": "^5.2.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "@types/ws": "^8.5.13",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8",
    "ws": "^8.18.0"
  }
}
```

Run: `npm install` (aktualisiert `package-lock.json`, entfernt `dotenv`).

- [ ] **Step 3: Failing Tests für DisplayHub schreiben** – `server/test/display-hub.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { DisplayHub, type DisplaySocket } from "../src/beamer/display-hub.js";
import { IDLE, type ScoreboardState } from "../src/beamer/game-state.js";

function fakeSocket() {
  const sent: string[] = [];
  let onClose = () => {};
  const socket: DisplaySocket = {
    send: (data) => sent.push(data),
    on: (_event, listener) => (onClose = listener),
  };
  return { socket, sent, close: () => onClose() };
}

const FINISHED: ScoreboardState = { phase: "finished", winner: "Arnold" };

describe("DisplayHub", () => {
  test("schickt einer neuen Anzeige sofort den aktuellen Stand", () => {
    const hub = new DisplayHub();
    const display = fakeSocket();

    hub.attach(display.socket);

    expect(display.sent).toEqual([JSON.stringify(IDLE)]);
  });

  test("verteilt neue Staende an alle Anzeigen und merkt sich den letzten", () => {
    const hub = new DisplayHub();
    const a = fakeSocket();
    const b = fakeSocket();
    hub.attach(a.socket);
    hub.attach(b.socket);

    hub.broadcast(FINISHED);

    expect(a.sent.at(-1)).toBe(JSON.stringify(FINISHED));
    expect(b.sent.at(-1)).toBe(JSON.stringify(FINISHED));
    expect(hub.state).toEqual(FINISHED);
  });

  test("vergisst geschlossene Anzeigen", () => {
    const hub = new DisplayHub();
    const display = fakeSocket();
    hub.attach(display.socket);

    display.close();

    expect(hub.clientCount).toBe(0);
  });
});
```

- [ ] **Step 4: Failing Tests für die App schreiben** – zuerst `server/test/helpers.ts`

```ts
import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { DisplayHub } from "../src/beamer/display-hub.js";
import { LayoutStore } from "../src/beamer/layout-store.js";
import type { AppDeps } from "../src/http.js";

/** Abhaengigkeiten fuer Tests: echte Bausteine, Layouts im Temp-Ordner. */
export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const hub = new DisplayHub();
  return {
    hub,
    layouts: new LayoutStore(mkdtempSync(join(tmpdir(), "raspdarts-test-"))),
    ...overrides,
  };
}

/** Startet die App auf einem freien Port und liefert "127.0.0.1:<port>". */
export async function listen(app: FastifyInstance): Promise<string> {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;
  return `127.0.0.1:${port}`;
}
```

Dann `server/test/http.test.ts`:

```ts
import { afterEach, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/http.js";
import { DEFAULT_LAYOUT } from "../src/beamer/layout.js";
import { testDeps } from "./helpers.js";

let app: FastifyInstance;
afterEach(async () => app.close());

describe("Header-Schutz", () => {
  test("weist /api-Anfragen ohne X-Raspdarts mit 403 ab", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/api/layout/beamer" });

    expect(response.statusCode).toBe(403);
  });

  test("weist einen falschen Header-Wert ab", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/layout/beamer",
      headers: { "x-raspdarts": "ja" },
    });

    expect(response.statusCode).toBe(403);
  });

  test("laesst /api-Anfragen mit X-Raspdarts: 1 durch", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/layout/beamer",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(DEFAULT_LAYOUT);
  });

  test("liefert die Anzeige selbst ohne Header aus", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });

  test("beantwortet keine CORS-Vorabanfrage positiv", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/layout/beamer",
      headers: { origin: "https://evil.example", "access-control-request-method": "PUT" },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("Layout-API", () => {
  test("speichert ein Layout und liefert es zurueck", async () => {
    app = await buildApp(testDeps());
    const headers = { "x-raspdarts": "1" };

    await app.inject({
      method: "PUT",
      url: "/api/layout/handy",
      headers,
      payload: { checkout: { x: 60, y: 12, scale: 2 } },
    });
    const response = await app.inject({ method: "GET", url: "/api/layout/handy", headers });

    expect(response.json().checkout).toEqual({ x: 60, y: 12, scale: 2 });
  });
});
```

- [ ] **Step 5: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd server && npx vitest run test/display-hub.test.ts test/http.test.ts`
Expected: FAIL – `Cannot find module '../src/beamer/display-hub.js'` bzw. `'../src/http.js'`.

- [ ] **Step 6: `server/src/beamer/display-hub.ts` schreiben**

```ts
/**
 * Verteilt den ScoreboardState an alle verbundenen Anzeigen.
 *
 * Es werden immer vollstaendige Snapshots gesendet, keine Deltas. Dadurch
 * haelt der Browser keinen eigenen Zustand und eine Anzeige, die sich spaeter
 * verbindet, ist sofort korrekt.
 */
import { IDLE, type ScoreboardState } from "./game-state.js";

export interface DisplaySocket {
  send(data: string): void;
  on(event: "close", listener: () => void): unknown;
}

export class DisplayHub {
  readonly #clients = new Set<DisplaySocket>();
  #state: ScoreboardState = IDLE;

  attach(socket: DisplaySocket): void {
    this.#clients.add(socket);
    socket.send(JSON.stringify(this.#state));
    socket.on("close", () => this.#clients.delete(socket));
  }

  /** Setzt den Zustand und schiebt ihn an alle Anzeigen. */
  broadcast(state: ScoreboardState): void {
    this.#state = state;
    const payload = JSON.stringify(state);
    for (const client of this.#clients) {
      try {
        client.send(payload);
      } catch {
        this.#clients.delete(client);
      }
    }
  }

  get state(): ScoreboardState {
    return this.#state;
  }

  get clientCount(): number {
    return this.#clients.size;
  }
}
```

- [ ] **Step 7: `server/src/http.ts` schreiben**

```ts
/**
 * Die eine Fastify-App des Dienstes: Beamer-Anzeige, Spieldaten-Annahme und
 * Pi-Verwaltung auf einem Port.
 *
 * Schutz: Alles unter /api/ verlangt den Header X-Raspdarts: 1. Ein Browser
 * schickt einen eigenen Header von einer fremden Seite nur nach einer
 * CORS-Freigabe - und die gibt dieser Server nie. Damit kann keine Webseite,
 * die jemand im Heimnetz oeffnet, den Pi steuern.
 */
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import type { DisplayHub } from "./beamer/display-hub.js";
import type { LayoutStore } from "./beamer/layout-store.js";

export const CLIENT_HEADER = "x-raspdarts";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export interface AppDeps {
  hub: DisplayHub;
  layouts: LayoutStore;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api/") && request.headers[CLIENT_HEADER] !== "1") {
      return reply.code(403).send({ error: "X-Raspdarts-Header fehlt" });
    }
  });

  await app.register(fastifyWebsocket);
  await app.register(fastifyStatic, { root: PUBLIC_DIR });

  app.get("/ws", { websocket: true }, (socket) => deps.hub.attach(socket));

  // Layout je Anzeige: der Beamer richtet sich anders aus als das Handy.
  app.get<{ Params: { display: string } }>("/api/layout/:display", (request, reply) =>
    withLayout(reply, () => deps.layouts.read(request.params.display)),
  );
  app.put<{ Params: { display: string } }>("/api/layout/:display", (request, reply) =>
    withLayout(reply, () => deps.layouts.write(request.params.display, request.body)),
  );

  return app;
}

/** Ein ungueltiger Anzeigename ist ein Fehler des Aufrufers, kein Serverfehler. */
function withLayout(reply: FastifyReply, run: () => unknown) {
  try {
    return run();
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
}
```

- [ ] **Step 8: `server/src/config.ts`, `server/src/runtime.ts`, `server/src/index.ts` schreiben**

`server/src/config.ts`:

```ts
export interface Config {
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return { port: Number(env["PORT"] ?? 8743) };
}
```

`server/src/runtime.ts`:

```ts
/**
 * Baut alle Abhaengigkeiten des Dienstes zusammen. Genutzt vom Hauptprogramm
 * und von replay.ts, damit beide denselben Weg gehen.
 */
import { DisplayHub } from "./beamer/display-hub.js";
import { LayoutStore } from "./beamer/layout-store.js";
import type { AppDeps } from "./http.js";

export function createDeps(): AppDeps {
  return {
    hub: new DisplayHub(),
    layouts: new LayoutStore("data/layouts"),
  };
}
```

`server/src/index.ts`:

```ts
/**
 * Hauptprogramm des Raspdarts-Dienstes.
 *
 *     npm run dev     (Entwicklung)
 *     npm start       (nach npm run build, per systemd auf dem Pi)
 */
import { loadConfig } from "./config.js";
import { buildApp } from "./http.js";
import { createDeps } from "./runtime.js";

async function main(): Promise<void> {
  const { port } = loadConfig();
  const deps = createDeps();
  const app = await buildApp(deps);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Raspdarts laeuft auf http://localhost:${port}/`);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 9: `server/src/beamer/replay.ts` auf die neue App umstellen**

Ersetze in `replay.ts` die Imports und die Server-Erzeugung. Neuer Dateikopf bis einschließlich `console.log(\`${frames.length} Frames ...\`)`:

```ts
/**
 * Spielt eine aufgezeichnete Session zurueck und fuettert damit die Anzeige.
 *
 *     npm run replay data/sessions/2026-09-20T16-30-00.ndjson
 *     npm run replay <datei> --speed 4     (vierfache Geschwindigkeit)
 *     npm run replay <datei> --instant     (ohne Pausen, springt ans Ende)
 *
 * Damit laesst sich die komplette Beamer-Anzeige am Schreibtisch entwickeln,
 * ohne an der Scheibe zu stehen.
 */
import { readFileSync } from "node:fs";
import { toScoreboardState, IDLE } from "./game-state.js";
import type { RecordedFrame } from "./recorder.js";
import { buildApp } from "../http.js";
import { createDeps } from "../runtime.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error("Aufruf: npm run replay <datei.ndjson> [--speed 4] [--instant]");
    process.exit(1);
  }

  const speed = Number(flagValue("--speed") ?? 1);
  const instant = process.argv.includes("--instant");
  const port = Number(process.env.PORT ?? 8743);

  const frames = readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RecordedFrame);

  const deps = createDeps();
  const app = await buildApp(deps);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Replay laeuft auf http://localhost:${port}/`);
  console.log(`${frames.length} Frames aus ${file}. Oeffne die Seite, dann startet es.`);
```

In der Schleife darunter `server.broadcast(state)` durch `deps.hub.broadcast(state)` ersetzen. Der Rest bleibt.

- [ ] **Step 10: `server/public/app.js` sendet den Header**

Zeile 122:

```js
  const response = await fetch(`/api/layout/${display}`, { headers: { "X-Raspdarts": "1" } });
```

Zeilen 133–137:

```js
    fetch(`/api/layout/${display}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Raspdarts": "1" },
      body: JSON.stringify(layout),
    }).catch((error) => console.error("Layout konnte nicht gespeichert werden", error));
```

- [ ] **Step 11: Alle Tests und Typprüfung**

Run: `cd server && npm test && npm run typecheck`
Expected: `Tests  36 passed (36)` (27 übernommen + 3 DisplayHub + 6 App), Typprüfung ohne Ausgabe.

- [ ] **Step 12: Commit**

```bash
cd /c/Projekte/raspdarts
git add -A
git commit -m "Server auf eine App mit Header-Schutz umbauen und Autodarts-Anmeldung entfernen"
```

---

### Task 3: Spieldaten-Annahme `/ingest`

**Files:**
- Create: `server/src/beamer/ingest.ts`, `server/src/beamer/pipeline.ts`, `server/test/ingest.test.ts`, `server/test/pipeline.test.ts`, `server/test/ingest-e2e.test.ts`
- Modify: `server/src/http.ts` (AppDeps + Route), `server/src/runtime.ts`, `server/src/index.ts`, `server/src/beamer/replay.ts`, `server/test/helpers.ts`

**Interfaces:**
- Consumes: `DisplayHub`, `buildApp`, `AppDeps`, `testDeps`, `listen` aus Task 2; `toScoreboardState`, `IDLE` aus `game-state.ts`; `Recorder`, `sessionPath`, `RecordedFrame` aus `recorder.ts`
- Produces:
  - `isExtensionOrigin(origin: string | undefined): boolean`
  - `class Ingest { constructor(onFrame: (frame: unknown) => void, now?: () => Date); open(): void; close(): void; receive(raw: string): void; status(): IngestStatus }`
  - `interface IngestStatus { ingest_connected: boolean; last_message_at: string | null }`
  - `createFramePipeline(hub: DisplayHub, recorder: FrameSink | null): (frame: unknown) => void`, `interface FrameSink { write(frame: unknown): void }`
  - `AppDeps` bekommt `ingest: Ingest`
  - `createDeps(options: { record: boolean }): Runtime` mit `interface Runtime extends AppDeps { recorder: Recorder | null }`

- [ ] **Step 1: Failing Unit-Tests** – `server/test/ingest.test.ts`

```ts
import { describe, expect, test, vi } from "vitest";
import { Ingest, isExtensionOrigin } from "../src/beamer/ingest.js";

describe("isExtensionOrigin", () => {
  test.each([
    ["chrome-extension://abcdefghijklmnop", true],
    ["moz-extension://0f1e2d3c-aaaa-bbbb-cccc-112233445566", true],
    ["https://play.autodarts.io", false],
    ["http://raspdarts.local:8743", false],
    ["chrome-extension://abc/pfad", false],
    ["", false],
    [undefined, false],
  ])("%s -> %s", (origin, expected) => {
    expect(isExtensionOrigin(origin)).toBe(expected);
  });
});

describe("Ingest", () => {
  test("reicht geparste Nachrichten weiter und merkt sich den Zeitpunkt", () => {
    const onFrame = vi.fn();
    const ingest = new Ingest(onFrame, () => new Date("2026-10-04T12:00:00Z"));

    ingest.receive('{"channel":"autodarts.matches","data":{}}');

    expect(onFrame).toHaveBeenCalledWith({ channel: "autodarts.matches", data: {} });
    expect(ingest.status().last_message_at).toBe("2026-10-04T12:00:00.000Z");
  });

  test("ueberspringt Nachrichten, die kein JSON sind", () => {
    const onFrame = vi.fn();
    const ingest = new Ingest(onFrame);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    ingest.receive("kein json");

    expect(onFrame).not.toHaveBeenCalled();
    expect(ingest.status().last_message_at).toBeNull();
  });

  test("meldet verbunden, solange mindestens eine Verbindung offen ist", () => {
    const ingest = new Ingest(() => {});
    expect(ingest.status().ingest_connected).toBe(false);

    ingest.open();
    ingest.open();
    ingest.close();
    expect(ingest.status().ingest_connected).toBe(true);

    ingest.close();
    ingest.close();
    expect(ingest.status().ingest_connected).toBe(false);
  });
});
```

`server/test/pipeline.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { DisplayHub } from "../src/beamer/display-hub.js";
import { IDLE } from "../src/beamer/game-state.js";
import { createFramePipeline } from "../src/beamer/pipeline.js";

const MATCH_FRAME = {
  channel: "autodarts.matches",
  topic: "x.state",
  data: {
    variant: "X01",
    player: 0,
    players: [{ name: "Arnold" }],
    gameScores: [40],
    scores: [{ legs: 0 }],
    turns: [{ throws: [] }],
    winner: -1,
  },
};

describe("createFramePipeline", () => {
  test("zeichnet jede Nachricht auf und verteilt Spielstaende", () => {
    const hub = new DisplayHub();
    const recorder = { write: vi.fn() };
    const handle = createFramePipeline(hub, recorder);

    handle(MATCH_FRAME);

    expect(recorder.write).toHaveBeenCalledWith(MATCH_FRAME);
    expect(hub.state.phase).toBe("playing");
  });

  test("laesst den Stand stehen, wenn eine Nachricht kein Spielstand ist", () => {
    const hub = new DisplayHub();
    const handle = createFramePipeline(hub, null);
    handle(MATCH_FRAME);

    handle({ channel: "autodarts.boards", data: { status: "Throw" } });

    expect(hub.state.phase).toBe("playing");
  });

  test("bleibt idle ohne Spielstand", () => {
    const hub = new DisplayHub();
    createFramePipeline(hub, null)({ irgendwas: 1 });
    expect(hub.state).toBe(IDLE);
  });
});
```

- [ ] **Step 2: Failing End-to-End-Test** – `server/test/ingest-e2e.test.ts`

```ts
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import WebSocket from "ws";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/http.js";
import { IDLE, toScoreboardState } from "../src/beamer/game-state.js";
import type { RecordedFrame } from "../src/beamer/recorder.js";
import { listen, testDeps } from "./helpers.js";

const EXTENSION = "chrome-extension://abcdefghijklmnop";

let app: FastifyInstance;
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await app.close();
});

/** Oeffnet einen WebSocket und sammelt ab dem ersten Moment alle Nachrichten. */
function connect(url: string, origin?: string) {
  const socket = origin === undefined ? new WebSocket(url) : new WebSocket(url, { origin });
  sockets.push(socket);
  const messages: string[] = [];
  socket.on("message", (data) => messages.push(data.toString()));
  const opened = new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("unexpected-response", (_request, response) =>
      reject(new Error(`HTTP ${response.statusCode}`)),
    );
    socket.once("error", reject);
  });
  return { socket, messages, opened };
}

describe("/ingest", () => {
  test("nimmt Verbindungen der Extension an", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    const host = await listen(app);

    await connect(`ws://${host}/ingest`, EXTENSION).opened;

    await vi.waitFor(() => expect(deps.ingest.status().ingest_connected).toBe(true));
  });

  test("weist Webseiten ab", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);

    await expect(connect(`ws://${host}/ingest`, "https://evil.example").opened).rejects.toThrow(
      "HTTP 403",
    );
  });

  test("weist Verbindungen ohne Origin ab", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);

    await expect(connect(`ws://${host}/ingest`).opened).rejects.toThrow("HTTP 403");
  });

  test("macht aus der Demo-Aufzeichnung den erwarteten Stand an /ws", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);
    const frames = readFileSync("test/fixtures/demo-session.ndjson", "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => (JSON.parse(line) as RecordedFrame).frame);
    const expected = frames
      .map((frame) => toScoreboardState(frame))
      .filter((state) => state !== IDLE)
      .at(-1);

    const display = connect(`ws://${host}/ws`);
    const ingest = connect(`ws://${host}/ingest`, EXTENSION);
    await Promise.all([display.opened, ingest.opened]);
    for (const frame of frames) ingest.socket.send(JSON.stringify(frame));

    await vi.waitFor(() => {
      const last = display.messages.at(-1);
      expect(last && JSON.parse(last)).toEqual(expected);
    });
  });
});
```

- [ ] **Step 3: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd server && npx vitest run test/ingest.test.ts test/pipeline.test.ts test/ingest-e2e.test.ts`
Expected: FAIL – `Cannot find module '../src/beamer/ingest.js'` / `pipeline.js`.

- [ ] **Step 4: `server/src/beamer/ingest.ts` schreiben**

```ts
/**
 * Nimmt die Autodarts-Nachrichten an, die die Extension auf play.autodarts.io
 * mitliest. Kennt keine Spielregeln - parst nur JSON und reicht weiter.
 */

export interface IngestStatus {
  ingest_connected: boolean;
  last_message_at: string | null;
}

const EXTENSION_ORIGIN = /^(chrome-extension|moz-extension):\/\/[^/]+$/;

/**
 * Browser koennen beim WebSocket-Aufbau keine eigenen Header setzen. Statt
 * X-Raspdarts wird deshalb die Herkunft geprueft: nur Extensions, keine Webseiten.
 */
export function isExtensionOrigin(origin: string | undefined): boolean {
  return typeof origin === "string" && EXTENSION_ORIGIN.test(origin);
}

export class Ingest {
  #connections = 0;
  #lastMessageAt: Date | null = null;

  constructor(
    private readonly onFrame: (frame: unknown) => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  open(): void {
    this.#connections += 1;
  }

  close(): void {
    this.#connections = Math.max(0, this.#connections - 1);
  }

  receive(raw: string): void {
    let frame: unknown;
    try {
      frame = JSON.parse(raw);
    } catch {
      console.warn(`Ingest: Nachricht ist kein JSON, uebersprungen (${raw.slice(0, 80)})`);
      return;
    }
    this.#lastMessageAt = this.now();
    this.onFrame(frame);
  }

  status(): IngestStatus {
    return {
      ingest_connected: this.#connections > 0,
      last_message_at: this.#lastMessageAt?.toISOString() ?? null,
    };
  }
}
```

- [ ] **Step 5: `server/src/beamer/pipeline.ts` schreiben**

```ts
/**
 * Was mit jeder eingehenden Autodarts-Nachricht passiert: aufzeichnen,
 * in einen ScoreboardState uebersetzen, an die Anzeigen verteilen.
 *
 * Nachrichten, die kein Spielstand sind (Lobby, Board-Status ...), ergeben
 * IDLE und aendern die Anzeige nicht. Angezeigt wird also immer das Match, fuer
 * das zuletzt Daten kamen.
 */
import type { DisplayHub } from "./display-hub.js";
import { IDLE, toScoreboardState, type ScoreboardState } from "./game-state.js";

export interface FrameSink {
  write(frame: unknown): void;
}

export function createFramePipeline(
  hub: DisplayHub,
  recorder: FrameSink | null,
): (frame: unknown) => void {
  return (frame) => {
    recorder?.write(frame);

    let state: ScoreboardState;
    try {
      state = toScoreboardState(frame);
    } catch (error) {
      console.warn(`Nachricht nicht auswertbar, uebersprungen: ${(error as Error).message}`);
      return;
    }
    if (state !== IDLE) hub.broadcast(state);
  };
}
```

- [ ] **Step 6: `server/src/http.ts` erweitern**

Import ergänzen:

```ts
import { isExtensionOrigin, type Ingest } from "./beamer/ingest.js";
```

`AppDeps` ersetzen:

```ts
export interface AppDeps {
  hub: DisplayHub;
  layouts: LayoutStore;
  ingest: Ingest;
}
```

Direkt nach der `/ws`-Route einfügen:

```ts
  app.get(
    "/ingest",
    {
      websocket: true,
      preValidation: async (request, reply) => {
        if (!isExtensionOrigin(request.headers.origin)) {
          return reply.code(403).send({ error: "Nur fuer die Raspdarts-Extension" });
        }
      },
    },
    (socket) => {
      deps.ingest.open();
      socket.on("message", (data) => deps.ingest.receive(data.toString()));
      socket.on("close", () => deps.ingest.close());
    },
  );
```

- [ ] **Step 7: `server/test/helpers.ts` – `testDeps` ersetzen**

Imports ergänzen:

```ts
import { Ingest } from "../src/beamer/ingest.js";
import { createFramePipeline } from "../src/beamer/pipeline.js";
```

```ts
/**
 * Abhaengigkeiten fuer Tests: echte Bausteine, Layouts im Temp-Ordner, keine
 * Aufzeichnung. Wer `hub` ueberschreibt, muss auch `ingest` passend mitgeben.
 */
export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const hub = new DisplayHub();
  return {
    hub,
    layouts: new LayoutStore(mkdtempSync(join(tmpdir(), "raspdarts-test-"))),
    ingest: new Ingest(createFramePipeline(hub, null)),
    ...overrides,
  };
}
```

- [ ] **Step 8: `server/src/runtime.ts` ersetzen**

```ts
/**
 * Baut alle Abhaengigkeiten des Dienstes zusammen. Genutzt vom Hauptprogramm
 * und von replay.ts, damit beide denselben Weg gehen.
 */
import { DisplayHub } from "./beamer/display-hub.js";
import { Ingest } from "./beamer/ingest.js";
import { LayoutStore } from "./beamer/layout-store.js";
import { createFramePipeline } from "./beamer/pipeline.js";
import { Recorder, sessionPath } from "./beamer/recorder.js";
import type { AppDeps } from "./http.js";

export interface Runtime extends AppDeps {
  recorder: Recorder | null;
}

export function createDeps(options: { record: boolean }): Runtime {
  const hub = new DisplayHub();
  // Jede Session wird mitgeschrieben: Material fuer Tests und fuer die
  // spaeteren Stufen (die Wurf-Koordinaten stecken schon in den Nachrichten).
  const recorder = options.record ? new Recorder(sessionPath()) : null;
  return {
    hub,
    recorder,
    layouts: new LayoutStore("data/layouts"),
    ingest: new Ingest(createFramePipeline(hub, recorder)),
  };
}
```

- [ ] **Step 9: `index.ts` und `replay.ts` anpassen**

In `server/src/index.ts`: `const deps = createDeps();` → `const deps = createDeps({ record: true });` und die `shutdown`-Funktion:

```ts
  const shutdown = async () => {
    await app.close();
    await deps.recorder?.close();
    process.exit(0);
  };
```

In `server/src/beamer/replay.ts`: `const deps = createDeps();` → `const deps = createDeps({ record: false });`. Die Schleife geht jetzt denselben Weg wie echte Daten:

```ts
  let previous = 0;
  for (const [index, recorded] of frames.entries()) {
    if (!instant) await sleep(Math.max(0, (recorded.t - previous) / speed));
    previous = recorded.t;

    deps.ingest.receive(JSON.stringify(recorded.frame));
    process.stdout.write(`\rFrame ${index + 1}/${frames.length}  (${deps.hub.state.phase})   `);
  }
```

Der nicht mehr genutzte Import `import { toScoreboardState, IDLE } from "./game-state.js";` fällt weg.

- [ ] **Step 10: Alle Tests und Typprüfung**

Run: `cd server && npm test && npm run typecheck`
Expected: alle Tests grün (36 + 7 isExtensionOrigin + 3 Ingest + 3 Pipeline + 4 E2E = 53), Typprüfung ohne Ausgabe.

- [ ] **Step 11: Replay von Hand prüfen**

Run: `cd server && npm run replay test/fixtures/demo-session.ndjson -- --instant`
Expected: `Replay laeuft auf http://localhost:8743/`, am Ende `Frame 13/13  (playing)` oder `(finished)`. Mit Strg+C beenden.

- [ ] **Step 12: Commit**

```bash
cd /c/Projekte/raspdarts
git add -A
git commit -m "Spieldaten der Extension ueber /ingest annehmen"
```

---

### Task 4: Systemstatus `/api/status`

**Files:**
- Create: `server/src/system/status.ts`, `server/test/status.test.ts`
- Modify: `server/src/http.ts`, `server/src/runtime.ts`, `server/test/helpers.ts`, `server/test/http.test.ts`

**Interfaces:**
- Consumes: `AppDeps`, `Ingest.status()` aus Task 3
- Produces:
  - `interface SystemStatus { cpu_percent: number; ram_total_mb: number; ram_used_mb: number; temp_celsius: number; uptime_seconds: number; autodarts_version: string; ip_address: string | null; raspdarts_version: string }`
  - `createStatusReader(deps?: StatusDeps): () => Promise<SystemStatus>`
  - `AppDeps` bekommt `status: () => Promise<SystemStatus>`
  - Antwort von `GET /api/status`: `SystemStatus & { beamer: IngestStatus }`

- [ ] **Step 1: Failing Tests** – `server/test/status.test.ts`

```ts
import { describe, expect, test } from "vitest";
import {
  cpuPercent,
  createStatusReader,
  firstIPv4,
  parseCpuSample,
  parseMeminfo,
  parseVersion,
  type StatusDeps,
} from "../src/system/status.js";

const FILES: Record<string, string[]> = {
  "/proc/stat": ["cpu  100 0 100 800 0 0 0 0 0 0\n", "cpu  150 0 150 900 0 0 0 0 0 0\n"],
  "/proc/meminfo": ["MemTotal:        4096000 kB\nMemAvailable:    2048000 kB\n"],
  "/sys/class/thermal/thermal_zone0/temp": ["52000\n"],
  "/proc/uptime": ["12060.50 23456.78\n"],
};

function fakeDeps(overrides: Partial<StatusDeps> = {}): StatusDeps {
  const reads = new Map<string, number>();
  return {
    readFile: async (path) => {
      const versions = FILES[path];
      if (!versions) throw new Error(`unerwarteter Pfad ${path}`);
      const index = reads.get(path) ?? 0;
      reads.set(path, index + 1);
      return versions[Math.min(index, versions.length - 1)] ?? "";
    },
    run: async () => {
      throw new Error("not found");
    },
    sleep: async () => {},
    interfaces: () => ({
      lo: [{ address: "127.0.0.1", family: "IPv4", internal: true } as never],
      eth0: [{ address: "192.168.1.42", family: "IPv4", internal: false } as never],
    }),
    home: "/home/pi",
    version: "2.0.0",
    ...overrides,
  };
}

describe("Einzelwerte", () => {
  test("rechnet die CPU-Last aus zwei Messungen", () => {
    const first = parseCpuSample("cpu  100 0 100 800 0 0 0 0 0 0");
    const second = parseCpuSample("cpu  150 0 150 900 0 0 0 0 0 0");
    expect(cpuPercent(first, second)).toBe(50);
  });

  test("meldet 0 %, wenn zwischen den Messungen keine Zeit verging", () => {
    const sample = parseCpuSample("cpu  1 1 1 1");
    expect(cpuPercent(sample, sample)).toBe(0);
  });

  test("liest RAM in MB", () => {
    expect(parseMeminfo("MemTotal:  4096000 kB\nMemAvailable:  2048000 kB\n")).toEqual({
      ram_total_mb: 4000,
      ram_used_mb: 2000,
    });
  });

  test("findet die Versionsnummer in der Ausgabe", () => {
    expect(parseVersion("autodarts version 0.27.1\n")).toBe("0.27.1");
    expect(parseVersion("keine Version")).toBeNull();
  });

  test("nimmt die erste externe IPv4-Adresse", () => {
    expect(firstIPv4(fakeDeps().interfaces())).toBe("192.168.1.42");
    expect(firstIPv4({})).toBeNull();
  });
});

describe("createStatusReader", () => {
  test("liefert alle Felder, Autodarts nicht installiert", async () => {
    const status = await createStatusReader(fakeDeps())();

    expect(status).toEqual({
      cpu_percent: 50,
      ram_total_mb: 4000,
      ram_used_mb: 2000,
      temp_celsius: 52,
      uptime_seconds: 12060.5,
      autodarts_version: "unknown",
      ip_address: "192.168.1.42",
      raspdarts_version: "2.0.0",
    });
  });

  test("erkennt die Autodarts-Version ueber den ersten antwortenden Pfad", async () => {
    const tried: string[] = [];
    const run = async (command: string) => {
      tried.push(command);
      if (command === "/home/pi/.local/bin/autodarts --version") return "autodarts 0.27.1";
      throw new Error("not found");
    };

    const status = await createStatusReader(fakeDeps({ run }))();

    expect(status.autodarts_version).toBe("0.27.1");
    expect(tried).toEqual([
      "/usr/local/bin/autodarts --version",
      "autodarts --version",
      "/home/pi/.local/bin/autodarts --version",
    ]);
  });
});
```

In `server/test/http.test.ts` am Ende ergänzen:

```ts
describe("/api/status", () => {
  test("liefert Systemwerte und den Beamer-Zustand", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/status",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      cpu_percent: 12.5,
      autodarts_version: "unknown",
      beamer: { ingest_connected: false, last_message_at: null },
    });
  });

  test("meldet 500, wenn die Systemwerte nicht lesbar sind", async () => {
    app = await buildApp(
      testDeps({
        status: async () => {
          throw new Error("/proc fehlt");
        },
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/status",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "/proc fehlt" });
  });
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd server && npx vitest run test/status.test.ts test/http.test.ts`
Expected: FAIL – `Cannot find module '../src/system/status.js'`, und `/api/status` liefert 404.

- [ ] **Step 3: `server/src/system/status.ts` schreiben** (portiert aus `Raspdarts-backend/routes/status.js`, Feldnamen unverändert)

```ts
/**
 * Systemwerte des Pi fuer das Panel der Extension. Feldnamen wie im
 * bisherigen Raspdarts-Backend, damit die Anzeige im Panel gleich bleibt.
 *
 * Alle Zugriffe auf Dateien, Befehle und Netzwerk laufen ueber StatusDeps,
 * damit die Auswertung ohne Pi testbar ist.
 */
import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir, networkInterfaces } from "node:os";

export interface SystemStatus {
  cpu_percent: number;
  ram_total_mb: number;
  ram_used_mb: number;
  temp_celsius: number;
  uptime_seconds: number;
  autodarts_version: string;
  ip_address: string | null;
  raspdarts_version: string;
}

type Interfaces = ReturnType<typeof networkInterfaces>;

export interface StatusDeps {
  readFile: (path: string) => Promise<string>;
  /** Fuehrt einen Befehl aus und liefert stdout; wirft bei Fehler. */
  run: (command: string) => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  interfaces: () => Interfaces;
  home: string;
  version: string;
}

interface CpuSample {
  total: number;
  idle: number;
}

export function parseCpuSample(procStat: string): CpuSample {
  const fields = (procStat.split("\n")[0] ?? "").trim().split(/\s+/).slice(1).map(Number);
  return { total: fields.reduce((sum, value) => sum + value, 0), idle: fields[3] ?? 0 };
}

export function cpuPercent(first: CpuSample, second: CpuSample): number {
  const total = second.total - first.total;
  const idle = second.idle - first.idle;
  return total === 0 ? 0 : Math.round((1 - idle / total) * 1000) / 10;
}

export function parseMeminfo(meminfo: string): { ram_total_mb: number; ram_used_mb: number } {
  const megabytes = (key: string) =>
    Math.round(Number(new RegExp(`${key}:\\s+(\\d+)`).exec(meminfo)?.[1] ?? 0) / 1024);
  const total = megabytes("MemTotal");
  return { ram_total_mb: total, ram_used_mb: total - megabytes("MemAvailable") };
}

export function parseVersion(output: string): string | null {
  return /(\d+\.\d+[\d.]*)/.exec(output)?.[1] ?? null;
}

export function firstIPv4(interfaces: Interfaces): string | null {
  for (const list of Object.values(interfaces)) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

/** Wo der Autodarts-Installer das Programm je nach Version ablegt. */
function autodartsCandidates(home: string): string[] {
  return [
    "/usr/local/bin/autodarts",
    "autodarts",
    `${home}/.local/bin/autodarts`,
    `${home}/.local/opt/autodarts/autodarts`,
    `${home}/.autodarts/autodarts`,
  ];
}

export function defaultStatusDeps(): StatusDeps {
  const pkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  return {
    readFile: (path) => readFile(path, "utf8"),
    run: (command) =>
      new Promise((resolve, reject) =>
        exec(command, { timeout: 5000 }, (error, stdout) => (error ? reject(error) : resolve(stdout))),
      ),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    interfaces: networkInterfaces,
    home: homedir(),
    version: pkg.version,
  };
}

export function createStatusReader(deps: StatusDeps = defaultStatusDeps()): () => Promise<SystemStatus> {
  async function cpu(): Promise<number> {
    const first = parseCpuSample(await deps.readFile("/proc/stat"));
    await deps.sleep(500);
    const second = parseCpuSample(await deps.readFile("/proc/stat"));
    return cpuPercent(first, second);
  }

  async function autodartsVersion(): Promise<string> {
    for (const binary of autodartsCandidates(deps.home)) {
      try {
        const version = parseVersion(await deps.run(`${binary} --version`));
        if (version) return version;
      } catch {
        // naechster Kandidat
      }
    }
    return "unknown";
  }

  return async () => {
    const [cpu_percent, meminfo, temp, uptime, autodarts_version] = await Promise.all([
      cpu(),
      deps.readFile("/proc/meminfo"),
      deps.readFile("/sys/class/thermal/thermal_zone0/temp"),
      deps.readFile("/proc/uptime"),
      autodartsVersion(),
    ]);
    return {
      cpu_percent,
      ...parseMeminfo(meminfo),
      temp_celsius: Number.parseInt(temp.trim(), 10) / 1000,
      uptime_seconds: Number.parseFloat(uptime.split(" ")[0] ?? "0"),
      autodarts_version,
      ip_address: firstIPv4(deps.interfaces()),
      raspdarts_version: deps.version,
    };
  };
}
```

- [ ] **Step 4: Route, Deps und Test-Helfer**

`server/src/http.ts` – Import ergänzen:

```ts
import type { SystemStatus } from "./system/status.js";
```

`AppDeps` ersetzen:

```ts
export interface AppDeps {
  hub: DisplayHub;
  layouts: LayoutStore;
  ingest: Ingest;
  status: () => Promise<SystemStatus>;
}
```

Nach den Layout-Routen einfügen:

```ts
  app.get("/api/status", async (_request, reply) => {
    try {
      return { ...(await deps.status()), beamer: deps.ingest.status() };
    } catch (error) {
      return reply.code(500).send({ error: (error as Error).message });
    }
  });
```

`server/src/runtime.ts` – Import und Feld ergänzen:

```ts
import { createStatusReader } from "./system/status.js";
```

```ts
    ingest: new Ingest(createFramePipeline(hub, recorder)),
    status: createStatusReader(),
```

`server/test/helpers.ts` – in `testDeps` nach `ingest` ergänzen (Import `import type { SystemStatus } from "../src/system/status.js";`):

```ts
    status: async (): Promise<SystemStatus> => ({
      cpu_percent: 12.5,
      ram_total_mb: 4000,
      ram_used_mb: 1000,
      temp_celsius: 48.3,
      uptime_seconds: 3600,
      autodarts_version: "unknown",
      ip_address: "192.168.1.42",
      raspdarts_version: "2.0.0",
    }),
```

- [ ] **Step 5: Alle Tests und Typprüfung**

Run: `cd server && npm test && npm run typecheck`
Expected: alle grün (53 + 7 Status + 2 App = 62), Typprüfung ohne Ausgabe.

- [ ] **Step 6: Commit**

```bash
cd /c/Projekte/raspdarts
git add -A
git commit -m "Systemstatus aus dem Raspdarts-Backend uebernehmen"
```

---

### Task 5: Root-Aufträge – Install, Update, Deinstallation, Neustart

**Files:**
- Create: `server/src/system/jobs.ts`, `server/test/jobs.test.ts`
- Modify: `server/src/http.ts`, `server/src/runtime.ts`, `server/test/helpers.ts`

**Interfaces:**
- Consumes: `AppDeps`, `buildApp`, `testDeps`, `listen`
- Produces:
  - `SCRIPT_DIR = "/usr/local/lib/raspdarts"`
  - `type JobEvent = { type: "log"; line: string } | { type: "done"; success: boolean; error?: string }`
  - `type Spawner = (script: string) => ChildProcess`
  - `class JobRunner { constructor(spawner?: Spawner); get busy(): boolean; run(script: string, emit: (event: JobEvent) => void): boolean; fire(script: string): void }`
  - `AppDeps` bekommt `jobs: JobRunner`
  - Routen: `POST /api/autodarts/install|uninstall`, `POST /api/system/update|uninstall` (SSE, 409 wenn belegt), `POST /api/system/reboot|shutdown` (`{ ok: true }`)

- [ ] **Step 1: Failing Tests** – `server/test/jobs.test.ts`

```ts
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/http.js";
import { JobRunner, type JobEvent } from "../src/system/jobs.js";
import { listen, testDeps } from "./helpers.js";

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
}

/** Ein Kindprozess, der Zeilen ausgibt und dann mit `code` endet - oder haengt. */
function fakeChild(options: { lines?: string[]; code?: number; hang?: boolean } = {}): FakeChild {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  if (!options.hang) {
    setImmediate(() => {
      for (const line of options.lines ?? []) child.stdout.write(`${line}\n`);
      setImmediate(() => child.emit("close", options.code ?? 0));
    });
  }
  return child;
}

const asChild = (child: FakeChild) => child as unknown as ChildProcess;

function collect(runner: JobRunner, script: string): Promise<JobEvent[]> {
  return new Promise((resolve) => {
    const events: JobEvent[] = [];
    runner.run(script, (event) => {
      events.push(event);
      if (event.type === "done") resolve(events);
    });
  });
}

describe("JobRunner", () => {
  test("reicht Ausgabezeilen weiter und meldet Erfolg", async () => {
    const started: string[] = [];
    const runner = new JobRunner((script) => {
      started.push(script);
      return asChild(fakeChild({ lines: ["eins", "zwei"] }));
    });

    const events = await collect(runner, "autodarts-install.sh");

    expect(started).toEqual(["autodarts-install.sh"]);
    expect(events).toEqual([
      { type: "log", line: "eins" },
      { type: "log", line: "zwei" },
      { type: "done", success: true },
    ]);
  });

  test("meldet einen Fehler mit Exit-Code", async () => {
    const runner = new JobRunner(() => asChild(fakeChild({ code: 3 })));

    const events = await collect(runner, "x.sh");

    expect(events.at(-1)).toEqual({ type: "done", success: false, error: "Exit code 3" });
  });

  test("meldet einen Fehler, wenn der Start scheitert", async () => {
    const runner = new JobRunner(() => {
      throw new Error("sudo fehlt");
    });

    const events = await collect(runner, "x.sh");

    expect(events).toEqual([{ type: "done", success: false, error: "sudo fehlt" }]);
    expect(runner.busy).toBe(false);
  });

  test("laesst keinen zweiten Auftrag zu, solange einer laeuft", async () => {
    const child = fakeChild({ hang: true });
    const runner = new JobRunner(() => asChild(child));
    const first = collect(runner, "a.sh");

    expect(runner.busy).toBe(true);
    expect(runner.run("b.sh", () => {})).toBe(false);

    child.emit("close", 0);
    await first;
    expect(runner.busy).toBe(false);
  });
});

describe("Routen", () => {
  let app: FastifyInstance;
  afterEach(async () => app.close());

  test("streamt einen Auftrag als SSE", async () => {
    const started: string[] = [];
    const jobs = new JobRunner((script) => {
      started.push(script);
      return asChild(fakeChild({ lines: ["fertig"] }));
    });
    app = await buildApp(testDeps({ jobs }));
    const host = await listen(app);

    const response = await fetch(`http://${host}/api/autodarts/install`, {
      method: "POST",
      headers: { "X-Raspdarts": "1" },
    });
    const body = await response.text();

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('data: {"type":"log","line":"fertig"}\n\n');
    expect(body).toContain('data: {"type":"done","success":true}\n\n');
    expect(started).toEqual(["autodarts-install.sh"]);
  });

  test.each([
    ["/api/autodarts/uninstall", "autodarts-uninstall.sh"],
    ["/api/system/update", "raspdarts-update.sh"],
    ["/api/system/uninstall", "raspdarts-uninstall.sh"],
  ])("%s startet %s", async (path, script) => {
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

    expect(started).toEqual([script]);
  });

  test("antwortet mit 409, solange ein Auftrag laeuft", async () => {
    const child = fakeChild({ hang: true });
    const jobs = new JobRunner(() => asChild(child));
    app = await buildApp(testDeps({ jobs }));
    const host = await listen(app);
    const headers = { "X-Raspdarts": "1" };

    const first = await fetch(`http://${host}/api/system/update`, { method: "POST", headers });
    const second = await fetch(`http://${host}/api/autodarts/install`, { method: "POST", headers });

    expect(second.status).toBe(409);
    child.emit("close", 0);
    await first.text();
  });

  test.each([
    ["/api/system/reboot", "reboot.sh"],
    ["/api/system/shutdown", "shutdown.sh"],
  ])("%s antwortet sofort und startet danach %s", async (path, script) => {
    const started: string[] = [];
    const jobs = new JobRunner((name) => {
      started.push(name);
      return asChild(fakeChild({ hang: true }));
    });
    app = await buildApp(testDeps({ jobs }));

    const response = await app.inject({ method: "POST", url: path, headers: { "x-raspdarts": "1" } });

    expect(response.json()).toEqual({ ok: true });
    expect(started).toEqual([]);
    await vi.waitFor(() => expect(started).toEqual([script]), { timeout: 2000 });
  });
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd server && npx vitest run test/jobs.test.ts`
Expected: FAIL – `Cannot find module '../src/system/jobs.js'`.

- [ ] **Step 3: `server/src/system/jobs.ts` schreiben**

```ts
/**
 * Startet die festen Root-Skripte unter /usr/local/lib/raspdarts per sudo.
 *
 * Nur diese Skripte stehen in /etc/sudoers.d/raspdarts - der Dienst kann
 * damit nichts anderes als root ausfuehren. Es laeuft immer hoechstens ein
 * Auftrag. Ein Auftrag wird nicht abgebrochen, wenn niemand mehr zusieht:
 * ein halb installiertes Autodarts waere schlimmer als ein Lauf ohne Zuschauer.
 */
import { spawn, type ChildProcess } from "node:child_process";

export const SCRIPT_DIR = "/usr/local/lib/raspdarts";

export type JobEvent =
  | { type: "log"; line: string }
  | { type: "done"; success: boolean; error?: string };

type DoneEvent = Extract<JobEvent, { type: "done" }>;

export type Spawner = (script: string) => ChildProcess;

/** `sudo -n` bricht ab statt nach einem Passwort zu fragen. */
export const sudoSpawner: Spawner = (script) => spawn("sudo", ["-n", `${SCRIPT_DIR}/${script}`]);

export class JobRunner {
  #busy = false;

  constructor(private readonly spawner: Spawner = sudoSpawner) {}

  get busy(): boolean {
    return this.#busy;
  }

  /** Startet ein Skript. Liefert false, wenn schon eines laeuft. */
  run(script: string, emit: (event: JobEvent) => void): boolean {
    if (this.#busy) return false;
    this.#busy = true;

    let finished = false;
    const finish = (event: DoneEvent) => {
      if (finished) return;
      finished = true;
      this.#busy = false;
      emit(event);
    };

    let child: ChildProcess;
    try {
      child = this.spawner(script);
    } catch (error) {
      finish({ type: "done", success: false, error: (error as Error).message });
      return true;
    }

    const forward = (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (line.trim()) emit({ type: "log", line });
      }
    };
    child.stdout?.on("data", forward);
    child.stderr?.on("data", forward);
    child.on("error", (error) => finish({ type: "done", success: false, error: error.message }));
    child.on("close", (code) =>
      finish(
        code === 0
          ? { type: "done", success: true }
          : { type: "done", success: false, error: `Exit code ${code}` },
      ),
    );
    return true;
  }

  /** Startet ein Skript ohne auf Ausgabe oder Ende zu warten (Neustart, Herunterfahren). */
  fire(script: string): void {
    try {
      this.spawner(script).on("error", (error) => console.error(`${script}: ${error.message}`));
    } catch (error) {
      console.error(`${script}: ${(error as Error).message}`);
    }
  }
}
```

- [ ] **Step 4: Routen in `server/src/http.ts`**

Import ergänzen:

```ts
import type { JobRunner } from "./system/jobs.js";
```

`AppDeps` ersetzen:

```ts
export interface AppDeps {
  hub: DisplayHub;
  layouts: LayoutStore;
  ingest: Ingest;
  status: () => Promise<SystemStatus>;
  jobs: JobRunner;
}
```

Oberhalb von `buildApp` einfügen:

```ts
/** Langlaeufer: Ausgabe wird zeilenweise als Server-Sent Events gestreamt. */
const JOB_ROUTES: Record<string, string> = {
  "/api/autodarts/install": "autodarts-install.sh",
  "/api/autodarts/uninstall": "autodarts-uninstall.sh",
  "/api/system/update": "raspdarts-update.sh",
  "/api/system/uninstall": "raspdarts-uninstall.sh",
};

/** Sofort-Aktionen: erst antworten, dann ausfuehren - danach ist der Pi weg. */
const POWER_ROUTES: Record<string, string> = {
  "/api/system/reboot": "reboot.sh",
  "/api/system/shutdown": "shutdown.sh",
};
```

In `buildApp` nach der Status-Route einfügen:

```ts
  for (const [path, script] of Object.entries(JOB_ROUTES)) {
    app.post(path, (_request, reply) => {
      if (deps.jobs.busy) return reply.code(409).send({ error: "Already running" });

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      });
      // Kopfzeilen sofort senden: der Aufrufer soll den Stream sehen, bevor
      // das Skript die erste Zeile ausgibt.
      raw.flushHeaders();
      deps.jobs.run(script, (event) => {
        if (raw.writableEnded || raw.destroyed) return;
        raw.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.type === "done") raw.end();
      });
    });
  }

  for (const [path, script] of Object.entries(POWER_ROUTES)) {
    app.post(path, async () => {
      setTimeout(() => deps.jobs.fire(script), 500);
      return { ok: true };
    });
  }
```

`server/src/runtime.ts`: Import `import { JobRunner } from "./system/jobs.js";` und Feld `jobs: new JobRunner(),` nach `status`.

`server/test/helpers.ts`: Import `import { JobRunner } from "../src/system/jobs.js";` und in `testDeps` vor `...overrides`:

```ts
    jobs: new JobRunner(() => {
      throw new Error("In Tests werden keine echten Skripte gestartet");
    }),
```

- [ ] **Step 5: Alle Tests und Typprüfung**

Run: `cd server && npm test && npm run typecheck`
Expected: alle grün (62 + 4 JobRunner + 1 SSE + 3 Pfade + 1 Konflikt + 2 Power = 73), Typprüfung ohne Ausgabe.

- [ ] **Step 6: Commit**

```bash
cd /c/Projekte/raspdarts
git add -A
git commit -m "Root-Auftraege ueber feste Skripte und gemeinsame Sperre ausfuehren"
```

---

### Task 6: Pi-Skripte, Installer, Dienst

**Files:**
- Create: `server/scripts/autodarts-install.sh`, `server/scripts/autodarts-uninstall.sh`, `server/scripts/raspdarts-update.sh`, `server/scripts/raspdarts-uninstall.sh`, `server/scripts/reboot.sh`, `server/scripts/shutdown.sh`, `server/scripts/setup-root.sh`, `deploy/raspdarts.service`, `install.sh`

**Interfaces:**
- Consumes: Skriptnamen aus `JOB_ROUTES`/`POWER_ROUTES` (Task 5), `SCRIPT_DIR`
- Produces: Installation unter `~/raspdarts`, Dienst `raspdarts`, `/etc/sudoers.d/raspdarts`, `/usr/local/lib/raspdarts/*.sh`

Hinweis: Diese Dateien lassen sich unter Windows nur auf Syntax prüfen. Der echte Test passiert in Task 9 auf dem Pi.

- [ ] **Step 1: `server/scripts/autodarts-install.sh`**

```bash
#!/usr/bin/env bash
# Installiert oder aktualisiert Autodarts. Laeuft als root, gestartet per sudo
# aus dem Raspdarts-Dienst.
set -euo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
export DEBIAN_FRONTEND=noninteractive

echo "=== Autodarts installieren ==="
curl -sL get.autodarts.io | bash

# Programm nach /usr/local/bin kopieren, damit der Dienst die Version lesen kann.
bin="$(find /root/.local "$TARGET_HOME/.local" -maxdepth 6 -name autodarts -type f 2>/dev/null | head -1 || true)"
if [[ -n "$bin" ]]; then
  install -m 755 "$bin" /usr/local/bin/autodarts
fi
echo "Autodarts ist installiert."
```

- [ ] **Step 2: `server/scripts/autodarts-uninstall.sh`**

```bash
#!/usr/bin/env bash
# Entfernt Autodarts. Laeuft als root, gestartet per sudo aus dem Raspdarts-Dienst.
# Jeder Schritt ist "best effort": was nicht da ist, muss nicht weg.
set -uo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

echo "=== Autodarts deinstallieren ==="
systemctl stop autodarts 2>/dev/null || true
systemctl disable autodarts 2>/dev/null || true
rm -f /usr/local/bin/autodarts
find /root/.local "$TARGET_HOME/.local" "$TARGET_HOME/.autodarts" -maxdepth 6 -name autodarts -type f -delete 2>/dev/null || true
echo "Autodarts entfernt."
```

- [ ] **Step 3: `server/scripts/setup-root.sh`** (gemeinsam für Installation und Update, steht nicht in sudoers)

```bash
#!/usr/bin/env bash
# Richtet alles ein, was root gehoert: Root-Skripte, sudoers, systemd-Dienst.
# Aufruf: sudo bash setup-root.sh [--hostname]
#   --hostname  setzt zusaetzlich den Hostnamen auf "raspdarts" (nur bei Erstinstallation)
set -euo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LIB_DIR=/usr/local/lib/raspdarts
SUDO_SCRIPTS=(autodarts-install.sh autodarts-uninstall.sh raspdarts-update.sh raspdarts-uninstall.sh reboot.sh shutdown.sh)

echo "--- Root-Skripte nach $LIB_DIR ---"
install -d -m 755 -o root -g root "$LIB_DIR"
for name in "${SUDO_SCRIPTS[@]}"; do
  # Erst kopieren, dann umbenennen: ein gerade laufendes Skript (das Update
  # selbst) liest so ungestoert seine alte Fassung zu Ende.
  tmp="$(mktemp "$LIB_DIR/.tmp.XXXXXX")"
  cp "$REPO_DIR/server/scripts/$name" "$tmp"
  chmod 755 "$tmp"
  mv -f "$tmp" "$LIB_DIR/$name"
done

echo "--- sudo-Rechte ---"
rules=""
for name in "${SUDO_SCRIPTS[@]}"; do
  # "" am Ende: das Skript darf nur ohne Argumente aufgerufen werden.
  rules+="${rules:+, }$LIB_DIR/$name \"\""
done
tmp="$(mktemp)"
echo "$TARGET_USER ALL=(root) NOPASSWD: $rules" > "$tmp"
visudo -cf "$tmp" >/dev/null
install -m 440 -o root -g root "$tmp" /etc/sudoers.d/raspdarts
rm -f "$tmp"

echo "--- systemd-Dienst ---"
sed "s|__USER__|$TARGET_USER|g; s|__HOME__|$TARGET_HOME|g" "$REPO_DIR/deploy/raspdarts.service" \
  > /etc/systemd/system/raspdarts.service
systemctl daemon-reload
systemctl enable raspdarts >/dev/null

if [[ "${1:-}" == "--hostname" ]]; then
  echo "--- Hostname raspdarts ---"
  hostnamectl set-hostname raspdarts
  sed -i 's/127\.0\.1\.1.*/127.0.1.1\traspdarts/' /etc/hosts
  systemctl restart avahi-daemon || true
  sleep 2
  actual="$(avahi-resolve --name raspdarts.local 2>/dev/null | awk '{print $1}' || true)"
  if [[ "$actual" != "raspdarts.local" ]]; then
    echo "WARNUNG: raspdarts.local ist im Netz nicht eindeutig erreichbar (mDNS-Kollision?)."
    echo "         Die Extension findet den Pi dann eventuell nicht."
  fi
fi
```

- [ ] **Step 4: `server/scripts/raspdarts-update.sh`**

```bash
#!/usr/bin/env bash
# Aktualisiert Raspdarts aus GitHub. Laeuft als root, gestartet per sudo aus dem
# Dienst. git und Build laufen als Dienst-Benutzer, damit im Installationsordner
# nichts root gehoert.
set -euo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
INSTALL_DIR="$TARGET_HOME/raspdarts"
as_user() { sudo -u "$TARGET_USER" -H "$@"; }

echo "=== Raspdarts aktualisieren ==="
echo "--- git pull ---"
as_user git -C "$INSTALL_DIR" pull --ff-only origin main

echo "--- Build ---"
as_user bash -c "cd '$INSTALL_DIR/server' && npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev"

bash "$INSTALL_DIR/server/scripts/setup-root.sh"

# Verzoegert neu starten, damit die Rueckmeldung an das Panel noch ankommt.
systemd-run --quiet --on-active=2 systemctl restart raspdarts
echo "Update fertig, der Dienst startet in 2 Sekunden neu."
```

- [ ] **Step 5: `server/scripts/raspdarts-uninstall.sh`**

```bash
#!/usr/bin/env bash
# Entfernt Raspdarts vollstaendig. Laeuft als root, gestartet per sudo aus dem
# Dienst. Der Dienst selbst wird zuletzt und verzoegert gestoppt, damit die
# Rueckmeldung an das Panel noch ankommt.
set -uo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

echo "=== Raspdarts deinstallieren ==="
rm -f /etc/sudoers.d/raspdarts
rm -rf "$TARGET_HOME/raspdarts"
echo "Dateien entfernt. Der Hostname bleibt 'raspdarts'; zuruecksetzen mit:"
echo "  sudo hostnamectl set-hostname raspberrypi"

systemd-run --quiet --on-active=2 /bin/sh -c \
  'systemctl disable --now raspdarts; rm -f /etc/systemd/system/raspdarts.service; systemctl daemon-reload; rm -rf /usr/local/lib/raspdarts'
echo "Der Dienst wird in 2 Sekunden beendet."
```

- [ ] **Step 6: `server/scripts/reboot.sh` und `server/scripts/shutdown.sh`**

```bash
#!/usr/bin/env bash
# Startet den Pi neu. Laeuft als root, gestartet per sudo aus dem Raspdarts-Dienst.
exec /sbin/reboot
```

```bash
#!/usr/bin/env bash
# Faehrt den Pi herunter. Laeuft als root, gestartet per sudo aus dem Raspdarts-Dienst.
exec /sbin/shutdown -h now
```

- [ ] **Step 7: `deploy/raspdarts.service`**

```ini
[Unit]
Description=Raspdarts - Pi-Verwaltung und Beamer-Scoreboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=__USER__
WorkingDirectory=__HOME__/raspdarts/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

# Die Kamera-Erkennung hat Vorrang: dieser Dienst laeuft mit niedrigerer
# Prioritaet, damit er der Dart-Erkennung keine Rechenzeit wegnimmt.
Nice=10

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 8: `install.sh` im Repo-Stamm**

```bash
#!/usr/bin/env bash
# Raspdarts - Installer fuer den Raspberry Pi
#   Installieren/Aktualisieren: curl -sL https://raw.githubusercontent.com/HerobrickHD/raspdarts/main/install.sh | bash
#   Deinstallieren:             curl -sL https://raw.githubusercontent.com/HerobrickHD/raspdarts/main/install.sh | bash -s -- --uninstall
set -euo pipefail

REPO_URL="https://github.com/HerobrickHD/raspdarts.git"
INSTALL_DIR="$HOME/raspdarts"
LIB_DIR=/usr/local/lib/raspdarts

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[raspdarts]${NC} $*"; }
warn() { echo -e "${YELLOW}[raspdarts]${NC} $*"; }
err()  { echo -e "${RED}[raspdarts] FEHLER:${NC} $*" >&2; exit 1; }

[[ $EUID -ne 0 ]] || err "Nicht als root starten, sondern als normaler Benutzer."

# --- Deinstallation ----------------------------------------------------------
if [[ "${1:-}" == "--uninstall" ]]; then
  [[ -x "$LIB_DIR/raspdarts-uninstall.sh" ]] || err "Raspdarts ist nicht installiert."
  sudo "$LIB_DIR/raspdarts-uninstall.sh"
  exit 0
fi

# --- Voraussetzungen ---------------------------------------------------------
if ! command -v git &>/dev/null || ! command -v curl &>/dev/null; then
  info "Installiere git und curl ..."
  sudo apt-get update -qq
  sudo apt-get install -y git curl
fi
if ! command -v node &>/dev/null || ! node -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)'; then
  info "Installiere Node.js 20 ..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
  sudo apt-get install -y nodejs
fi

# --- Umstieg vom alten Raspdarts-Backend --------------------------------------
if [[ -d "$INSTALL_DIR/.git" ]] && git -C "$INSTALL_DIR" remote get-url origin | grep -qi 'Raspdarts-backend'; then
  warn "Altes Raspdarts-Backend gefunden - wird durch die neue Version ersetzt."
  sudo systemctl disable --now raspdarts 2>/dev/null || true
  sudo rm -f /etc/sudoers.d/raspdarts /etc/systemd/system/raspdarts.service
  sudo systemctl daemon-reload
  rm -rf "$INSTALL_DIR"
fi

# --- Update ------------------------------------------------------------------
if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Raspdarts ist bereits installiert - aktualisiere ..."
  sudo "$LIB_DIR/raspdarts-update.sh"
  exit 0
fi

# --- Neuinstallation ---------------------------------------------------------
info "Neuinstallation nach $INSTALL_DIR ..."
git clone "$REPO_URL" "$INSTALL_DIR"
(cd "$INSTALL_DIR/server" && npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev)
sudo bash "$INSTALL_DIR/server/scripts/setup-root.sh" --hostname
sudo systemctl restart raspdarts

echo ""
info "Fertig! Raspdarts laeuft auf http://raspdarts.local:8743/"
info "Test: curl -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/status"
```

- [ ] **Step 9: Ausführbar markieren und Syntax prüfen**

```bash
cd /c/Projekte/raspdarts
git add install.sh server/scripts deploy
git update-index --chmod=+x install.sh server/scripts/*.sh
for f in install.sh server/scripts/*.sh; do bash -n "$f" && echo "ok $f"; done
git ls-files --eol install.sh server/scripts/*.sh deploy/raspdarts.service
```

Expected: sieben/acht Zeilen `ok ...`; in der `--eol`-Ausgabe überall `i/lf`, kein `crlf`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Installer, Root-Skripte und systemd-Dienst fuer den Pi"
```

---

### Task 7: Extension – Mitlesen, Weiterleiten, neue API

**Files:**
- Move: `extension/{background,content}.js` → `extension/src/`
- Create: `extension/src/forward.js`, `extension/src/page-hook.js`, `extension/src/bridge.js`, `extension/test/forward.test.js`, `extension/package.json`
- Modify: `extension/src/background.js`, `extension/src/content.js`, `extension/modal.html`, `extension/manifest.chrome.json`, `extension/manifest.firefox.json`, `extension/build.sh`

**Interfaces:**
- Consumes: `/ingest` (Origin `chrome-extension://`/`moz-extension://`), `/api/*` mit `X-Raspdarts: 1`, `GET /api/status` mit `beamer.ingest_connected`
- Produces:
  - `globalThis.raspdartsForward.shouldForward(url: string): boolean` (forward.js)
  - `window.postMessage({ source: "raspdarts-hook", data: string })` (page-hook.js)
  - Port-Name `raspdarts-ingest`, Nachrichten `{ type: "frame", data: string }` und `{ type: "heartbeat" }` (bridge.js → background.js)

- [ ] **Step 1: Verschieben und Test-Paket anlegen**

```bash
cd /c/Projekte/raspdarts/extension
mkdir -p src test
git mv background.js src/background.js
git mv content.js src/content.js
```

`extension/package.json`:

```json
{
  "name": "raspdarts-extension",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "build": "bash build.sh"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

Run: `npm install`

- [ ] **Step 2: Failing Test** – `extension/test/forward.test.js`

```js
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
```

Run: `cd extension && npm test`
Expected: FAIL – `Failed to load url ../src/forward.js`.

- [ ] **Step 3: `extension/src/forward.js`**

```js
// Entscheidet, welche WebSocket-Verbindungen der Seite an den Pi weitergereicht
// werden: nur die von Autodarts. Laeuft im Seitenkontext vor page-hook.js und
// wird von den Tests direkt geladen.
(function (root) {
  const AUTODARTS_HOST = /(^|\.)autodarts\.(io|com)$/;

  function shouldForward(url) {
    try {
      const { protocol, hostname } = new URL(url, root.location?.href);
      return (protocol === 'wss:' || protocol === 'ws:') && AUTODARTS_HOST.test(hostname);
    } catch {
      return false;
    }
  }

  root.raspdartsForward = { shouldForward };
})(globalThis);
```

Run: `cd extension && npm test`
Expected: PASS, `Tests  8 passed (8)`.

- [ ] **Step 4: `extension/src/page-hook.js`**

```js
// Liest die WebSocket-Nachrichten von play.autodarts.io mit. Laeuft im
// Seitenkontext ab document_start, damit window.WebSocket ersetzt ist, bevor
// die Seite ihre Verbindung oeffnet.
//
// Die Ersetzung ist eine Unterklasse des echten WebSocket: Die Seite bekommt
// ein voll funktionsfaehiges Objekt, nur mit einem zusaetzlichen Zuhoerer.
(function () {
  const { shouldForward } = window.raspdartsForward;
  const NativeWebSocket = window.WebSocket;

  const forward = (event) => {
    if (typeof event.data !== 'string') return;
    window.postMessage({ source: 'raspdarts-hook', data: event.data }, window.location.origin);
  };

  window.WebSocket = class extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      if (shouldForward(this.url)) this.addEventListener('message', forward);
    }
  };
})();
```

- [ ] **Step 5: `extension/src/bridge.js`**

```js
// Bruecke vom Seitenkontext zum Hintergrund: nimmt die von page-hook.js
// mitgelesenen Nachrichten an und schickt sie ueber einen Port weiter.
// Der offene Port sagt dem Hintergrund auch: es gibt einen Autodarts-Tab.
(function () {
  const HEARTBEAT_MS = 20_000;
  let port = null;

  function ensurePort() {
    if (port) return port;
    port = chrome.runtime.connect({ name: 'raspdarts-ingest' });
    port.onDisconnect.addListener(() => { port = null; });
    return port;
  }

  function send(message) {
    try {
      ensurePort().postMessage(message);
    } catch {
      port = null; // Hintergrund neu gestartet - beim naechsten Mal neu verbinden
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'raspdarts-hook') return;
    send({ type: 'frame', data: event.data.data });
  });

  // Haelt den Chrome-Service-Worker wach, solange der Tab offen ist; sonst
  // wuerde er nach 30 s Leerlauf samt Verbindung zum Pi beendet.
  setInterval(() => send({ type: 'heartbeat' }), HEARTBEAT_MS);
  ensurePort();
})();
```

- [ ] **Step 6: `extension/src/background.js` anpassen**

Kopf ersetzen (bis einschließlich der ersten Zeile `const BASE_URL ...`):

```js
const BASE_URL = 'http://raspdarts.local:8743';
const INGEST_URL = 'ws://raspdarts.local:8743/ingest';
// Ohne diesen Header lehnt der Pi jede /api-Anfrage ab (Schutz vor fremden Webseiten).
const CLIENT_HEADERS = { 'X-Raspdarts': '1' };
```

Im `fetch`-Handler die `headers`-Zeile ersetzen (ohne Body kein Content-Type, sonst lehnt Fastify mit 400 ab):

```js
    headers: msg.body ? { ...CLIENT_HEADERS, 'Content-Type': 'application/json' } : CLIENT_HEADERS,
```

Im Stream-Handler den Aufruf ersetzen:

```js
      response = await fetch(`${BASE_URL}${msg.url}`, { method: 'POST', headers: CLIENT_HEADERS });
```

Ans Dateiende anhängen:

```js
// --- Spieldaten an den Pi weiterreichen ---------------------------------------
// Eine Verbindung zum Pi, solange mindestens ein Autodarts-Tab offen ist.
// Was waehrend einer Unterbrechung ankommt, wird verworfen: Autodarts schickt
// bei jeder Aenderung ohnehin den vollstaendigen Match-Stand.

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const ingestPorts = new Set();
let ingestSocket = null;
let reconnectDelay = RECONNECT_MIN_MS;
let reconnectTimer = null;

function openIngest() {
  if (ingestSocket || ingestPorts.size === 0) return;
  const socket = new WebSocket(INGEST_URL);
  ingestSocket = socket;
  socket.addEventListener('open', () => { reconnectDelay = RECONNECT_MIN_MS; });
  socket.addEventListener('close', () => {
    if (ingestSocket === socket) ingestSocket = null;
    scheduleReconnect();
  });
  socket.addEventListener('error', () => {}); // close folgt
}

function scheduleReconnect() {
  if (reconnectTimer || ingestPorts.size === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openIngest();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
}

function closeIngest() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const socket = ingestSocket;
  ingestSocket = null;
  socket?.close();
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'raspdarts-ingest') return;
  ingestPorts.add(port);
  openIngest();

  port.onMessage.addListener((msg) => {
    if (msg.type === 'frame' && ingestSocket?.readyState === WebSocket.OPEN) {
      ingestSocket.send(msg.data);
    }
  });
  port.onDisconnect.addListener(() => {
    ingestPorts.delete(port);
    if (ingestPorts.size === 0) closeIngest();
  });
});
```

- [ ] **Step 7: `extension/src/content.js` – neue Pfade**

Ersetzungen (je genau ein Vorkommen):

| alt | neu |
|---|---|
| `url: '/status'` | `url: '/api/status'` |
| `url: '/autodarts/update'` | `url: '/api/autodarts/install'` |
| `url: '/autodarts/uninstall'` | `url: '/api/autodarts/uninstall'` |
| `url: '/system/update'` | `url: '/api/system/update'` |
| `url: '/system/uninstall'` | `url: '/api/system/uninstall'` |
| `url: '/reboot'` | `url: '/api/system/reboot'` |
| `url: '/shutdown'` | `url: '/api/system/shutdown'` |

```bash
cd /c/Projekte/raspdarts/extension
sed -i \
  -e "s#url: '/status'#url: '/api/status'#" \
  -e "s#url: '/autodarts/update'#url: '/api/autodarts/install'#" \
  -e "s#url: '/autodarts/uninstall'#url: '/api/autodarts/uninstall'#" \
  -e "s#url: '/system/update'#url: '/api/system/update'#" \
  -e "s#url: '/system/uninstall'#url: '/api/system/uninstall'#" \
  -e "s#url: '/reboot'#url: '/api/system/reboot'#" \
  -e "s#url: '/shutdown'#url: '/api/system/shutdown'#" \
  src/content.js
grep -n "url: '" src/content.js
```

Expected: sieben Zeilen, alle mit `/api/`.

- [ ] **Step 8: `extension/src/content.js` – Beamer-Anzeige**

In `injectNavButton` nach `btn.appendChild(labelSpan);`:

```js
    // Punkt im Button: hell = Spieldaten-Verbindung zum Pi steht, dunkel = nicht.
    const beamerDot = document.createElement('span');
    beamerDot.id = 'raspdarts-beamer-dot';
    beamerDot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:rgba(0,0,0,0.35);';
    btn.appendChild(beamerDot);
```

Neue Funktion nach `updateButtonReachability`:

```js
function updateBeamerIndicator(connected) {
  const dot = document.getElementById('raspdarts-beamer-dot');
  if (dot) dot.style.background = connected ? '#ffffff' : 'rgba(0,0,0,0.35)';
  const label = document.getElementById('raspdarts-beamer-status');
  if (label) label.textContent = connected ? 'connected' : 'not connected';
}
```

In `fetchStatus` direkt nach `const d = result.data;`:

```js
  updateBeamerIndicator(Boolean(d.beamer?.ingest_connected));
```

Im Fehlerzweig von `fetchStatus` (nach `updateButtonReachability(false);`):

```js
    updateBeamerIndicator(false);
```

In `extension/modal.html` nach der Zeile mit `raspdarts-manager-version`:

```html
          <div class="raspdarts-version">Beamer: <span id="raspdarts-beamer-status">--</span></div>
```

- [ ] **Step 9: Manifeste ersetzen**

`extension/manifest.chrome.json`:

```json
{
  "manifest_version": 3,
  "name": "Raspdarts",
  "version": "2.0.0",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "host_permissions": [
    "https://play.autodarts.io/*",
    "http://raspdarts.local:8743/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://play.autodarts.io/*"],
      "js": ["forward.js", "page-hook.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["https://play.autodarts.io/*"],
      "js": ["bridge.js"],
      "run_at": "document_start"
    },
    {
      "matches": ["https://play.autodarts.io/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "web_accessible_resources": [
    {
      "resources": ["modal.html", "modal.css", "icons/*"],
      "matches": ["https://play.autodarts.io/*"]
    }
  ]
}
```

`extension/manifest.firefox.json`:

```json
{
  "manifest_version": 3,
  "name": "Raspdarts",
  "version": "2.0.0",
  "browser_specific_settings": {
    "gecko": {
      "id": "raspdarts@herobrickhd",
      "strict_min_version": "128.0"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "host_permissions": [
    "https://play.autodarts.io/*",
    "http://raspdarts.local:8743/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://play.autodarts.io/*"],
      "js": ["forward.js", "page-hook.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["https://play.autodarts.io/*"],
      "js": ["bridge.js"],
      "run_at": "document_start"
    },
    {
      "matches": ["https://play.autodarts.io/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "scripts": ["background.js"]
  },
  "web_accessible_resources": [
    {
      "resources": ["modal.html", "modal.css", "icons/*"],
      "matches": ["https://play.autodarts.io/*"]
    }
  ]
}
```

- [ ] **Step 10: `extension/build.sh` ersetzen**

```bash
#!/usr/bin/env bash
# Baut dist/chrome/ und dist/firefox/ aus src/, den gemeinsamen Dateien und dem
# jeweiligen Manifest.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/dist"

for BROWSER in chrome firefox; do
  TARGET="$DIST/$BROWSER"
  rm -rf "$TARGET" && mkdir -p "$TARGET"
  cp "$SCRIPT_DIR"/src/*.js "$TARGET/"
  cp -r "$SCRIPT_DIR/modal.html" "$SCRIPT_DIR/modal.css" "$SCRIPT_DIR/icons" "$TARGET/"
  cp "$SCRIPT_DIR/manifest.$BROWSER.json" "$TARGET/manifest.json"
  echo "Gebaut: $TARGET"
done

echo "Fertig! Chrome: dist/chrome/ entpackt laden. Firefox: dist/firefox/manifest.json als temporaeres Add-on laden."
```

- [ ] **Step 11: Prüfen**

```bash
cd /c/Projekte/raspdarts/extension
npm test
for f in src/*.js; do node --check "$f" && echo "ok $f"; done
node -e 'for (const f of ["manifest.chrome.json","manifest.firefox.json"]) { JSON.parse(require("fs").readFileSync(f,"utf8")); console.log("ok", f); }'
bash build.sh && ls dist/chrome dist/firefox
```

Expected: 8 Tests grün; fünf `ok src/...`; zwei `ok manifest...`; beide `dist`-Ordner enthalten `background.js bridge.js content.js forward.js page-hook.js icons manifest.json modal.css modal.html`.

- [ ] **Step 12: Im Browser gegen den lokalen Server prüfen (ohne Pi)**

Ziel: zeigen, dass das Mitlesen und Weiterleiten funktioniert, bevor es an den Pi geht.

1. In `extension/dist/chrome/background.js` vorübergehend `raspdarts.local` durch `localhost` ersetzen (nur im `dist`-Ordner, nicht in `src/`), außerdem in `dist/chrome/manifest.json` den Host `http://localhost:8743/*` zu `host_permissions` hinzufügen.
2. `cd server && npm run dev` starten.
3. In Chrome `chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden“ → `extension/dist/chrome`.
4. `https://play.autodarts.io` öffnen und anmelden. `http://localhost:8743/` in einem zweiten Tab öffnen.
5. Erwartung: Der Raspdarts-Button erscheint, das Panel zeigt `Beamer: connected`. Im Server-Ordner wächst unter `data/sessions/` eine `.ndjson`-Datei, sobald die Seite Nachrichten bekommt.
6. Danach `bash build.sh` erneut ausführen, damit `dist/` wieder auf `raspdarts.local` zeigt.

Ist kein Autodarts-Konto zur Hand, Punkt 4–5 überspringen und das in Task 9 an der Scheibe nachholen. Im Ergebnis vermerken, ob dieser Schritt ausgeführt wurde.

- [ ] **Step 13: Commit**

```bash
cd /c/Projekte/raspdarts
git add -A
git commit -m "Extension liest Autodarts mit und liefert die Spieldaten an den Pi"
```

---

### Task 8: Dokumentation

**Files:**
- Modify: `README.md`, `docs/projekt.md`, `docs/protocol.md`

**Interfaces:**
- Consumes: alles Vorherige
- Produces: aktuelle Doku

- [ ] **Step 1: `README.md` ersetzen**

````markdown
# Raspdarts

Alles rund um die Autodarts-Scheibe am Raspberry Pi – in einem Repo:

- **Pi-Verwaltung** direkt aus play.autodarts.io: CPU, RAM, Temperatur, Autodarts
  installieren und aktualisieren, Pi neu starten oder herunterfahren. Kein SSH nötig.
- **Beamer-Scoreboard**: Restpunkte, aktiver Spieler und Checkout-Weg groß an der
  Wand neben der Scheibe.

## Aufbau

```
play.autodarts.io (Laptop)
  └─ Raspdarts-Extension ── liest den Spielstand mit ──┐
                          └─ Panel: Status, Updates ───┤
                                                       ▼
Raspberry Pi 5 ── raspdarts (ein Dienst, Port 8743) ── Beamer: http://raspdarts.local:8743/
```

| Ordner | Inhalt |
|---|---|
| `server/` | der Dienst auf dem Pi (TypeScript, Fastify) |
| `extension/` | Browser-Extension für Chrome und Firefox ≥ 128 |
| `deploy/`, `install.sh` | Installation auf dem Pi |
| `docs/` | Projektbeschreibung, Autodarts-Protokoll, Entwürfe |

Die Spieldaten kommen von der Extension: Sie liest auf play.autodarts.io die
WebSocket-Nachrichten der Seite mit und reicht sie an den Pi weiter. Der Pi braucht
deshalb keine Autodarts-Zugangsdaten. Der Beamer zeigt nur etwas an, solange ein Tab
mit play.autodarts.io offen ist.

## Installation auf dem Pi

```bash
curl -sL https://raw.githubusercontent.com/HerobrickHD/raspdarts/main/install.sh | bash
```

Der Installer richtet Node.js 20 ein, klont nach `~/raspdarts`, baut den Dienst, setzt
den Hostnamen auf `raspdarts` und startet den systemd-Dienst `raspdarts`. Eine alte
Installation des Raspdarts-Backends wird erkannt und ersetzt.

Erneut ausführen aktualisiert. Deinstallieren:

```bash
curl -sL https://raw.githubusercontent.com/HerobrickHD/raspdarts/main/install.sh | bash -s -- --uninstall
```

Beamer im Kiosk-Modus (am Pi oder an jedem anderen Gerät im Netz):

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://raspdarts.local:8743/
```

## Extension installieren

```bash
cd extension && bash build.sh
```

- **Chrome:** `chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden“ → `extension/dist/chrome`
- **Firefox (≥ 128):** `about:debugging#/runtime/this-firefox` → „Temporäres Add-on laden“ → `extension/dist/firefox/manifest.json`.
  Falls das Panel den Pi nicht erreicht: unter `about:addons` → Raspdarts → Berechtigungen den Zugriff auf `raspdarts.local` erlauben.

## Sicherheit

- Jede Anfrage an `/api/*` braucht den Header `X-Raspdarts: 1`. Fremde Webseiten
  können ihn nicht senden; eine Seite im Heimnetz kann den Pi also nicht steuern.
- `/ingest` nimmt nur Verbindungen von Browser-Extensions an.
- Root-Rechte hat der Dienst nur für sechs feste Skripte unter
  `/usr/local/lib/raspdarts/`.
- Andere Geräte im Heimnetz können den Header selbst setzen. Eine Kopplung per Code
  gibt es (noch) nicht.

## API

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/` | Beamer-Anzeige (`?display=handy` für ein eigenes Layout) |
| WS | `/ws` | Spielstand für Anzeigen |
| WS | `/ingest` | Spieldaten von der Extension |
| GET | `/api/status` | Systemwerte und Beamer-Verbindung |
| POST | `/api/autodarts/install`, `/api/autodarts/uninstall` | SSE-Stream |
| POST | `/api/system/update`, `/api/system/uninstall` | SSE-Stream |
| POST | `/api/system/reboot`, `/api/system/shutdown` | sofort |
| GET/PUT | `/api/layout/:display` | Layout einer Anzeige |

```bash
curl -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/status
```

## Entwicklung

```bash
cd server
npm install
npm run dev                                         # http://localhost:8743/
npm test && npm run typecheck
npm run replay test/fixtures/demo-session.ndjson    # Demo ohne Scheibe
npm run replay data/sessions/<datei>.ndjson --speed 4
```

Jede Sitzung wird nach `server/data/sessions/` aufgezeichnet und lässt sich
zurückspielen – so lässt sich die Anzeige am Schreibtisch weiterbauen.

Extension: `cd extension && npm install && npm test`.

## Layout einrichten

Unten links schaltet **Layout** den Bearbeiten-Modus ein: Bausteine ziehen, am blauen
Anfasser skalieren, gespeichert wird automatisch pro Anzeige unter
`server/data/layouts/<name>.json`. Positionen sind Prozentwerte und passen deshalb bei
jeder Beamer-Auflösung.

## Hinweis

Inoffiziell. Autodarts kann sein Datenformat jederzeit ändern – dann ist nur
`server/src/beamer/game-state.ts` betroffen. Siehe `docs/protocol.md`.

## Lizenz

MIT
````

- [ ] **Step 2: `docs/projekt.md` anpassen**

- Kopfzeile `# Autodarts Beamer — worum es geht` → `# Raspdarts — worum es geht`, `Stand: 20. September 2026` → `Stand: 4. Oktober 2026`.
- Den Abschnitt `## Aufbau` (von der Überschrift bis vor `**Warum diese Trennung wichtig ist:**`) ersetzen durch:

````markdown
## Aufbau

```
Laptop: play.autodarts.io + Raspdarts-Extension
│   liest den Spielstand der Seite mit
▼
Raspberry Pi 5 (läuft ohnehin durch, hat die Kameras)
│
├── raspdarts (ein Node-Dienst)
│     nimmt die Spieldaten an, rechnet Checkout-Wege aus,
│     verteilt einen fertigen Spielstand-Schnappschuss
│     und verwaltet den Pi (Status, Updates, Neustart)
│
└── Beamer ← Browser im Vollbild, zeigt nur an
```

Dazwischen steht genau ein Vertrag: der `ScoreboardState`. Der Dienst schickt
bei jeder Änderung einen vollständigen Schnappschuss, die Anzeige rendert ihn
und hält selbst keinen Zustand.

Die Spieldaten kommen nicht vom Pi selbst, sondern von der Extension im Browser,
in dem ohnehin gespielt wird. Der Pi braucht dadurch keine Autodarts-Anmeldung.
Der Preis: Der Beamer zeigt nur etwas an, solange ein Tab mit play.autodarts.io
offen ist.
````

- Im Abschnitt `**Warum diese Trennung wichtig ist:**` den dritten Punkt ersetzen durch:

```markdown
- Autodarts hat keine offizielle API. Ändert sich ihr Datenformat, ist genau
  eine Datei betroffen (`server/src/beamer/game-state.ts`). Server und Anzeige
  merken nichts davon.
```

- Die Abschnitte `## Wo es gerade hakt` und `## Was danach ansteht` vollständig ersetzen durch:

```markdown
## Was als Nächstes ansteht

Ein einziges Leg an der Scheibe werfen, während die Extension mitliest. Die
Aufzeichnung unter `server/data/sessions/` zeigt dann zum ersten Mal echten
Verkehr. Damit wird geprüft, ob das Datenformat den Annahmen in
`docs/protocol.md` entspricht, die aus Community-Quellen rekonstruiert wurden.
```

- Im Abschnitt `## Ohne Dartscheibe entwickeln` bleibt alles; Pfade gibt es dort keine.

- [ ] **Step 3: `docs/protocol.md` anpassen**

- Den gesamten Abschnitt `## Wichtig: Umstellung auf OAuth 2.0` bis vor `## REST-Endpunkte der Anwendung` ersetzen durch:

```markdown
## Woher die Daten kommen

Seit der Zusammenführung zu Raspdarts meldet sich der Pi nicht mehr selbst bei
Autodarts an. Die Extension liest auf play.autodarts.io jede eingehende
Textnachricht von WebSocket-Verbindungen zu `autodarts.io`/`autodarts.com` mit
und schickt sie unverändert an `ws://raspdarts.local:8743/ingest`. Welche
Kanäle die Seite abonniert, entscheidet die Seite selbst.

Damit entfällt alles rund um OAuth, Client-ID und Tickets. Zur Einordnung, falls
es später gebraucht wird: Autodarts hat im Herbst 2026 von Keycloak auf ein
eigenes OAuth 2.0 unter `api.autodarts.com` umgestellt und den Passwort-Login
gestrichen.
```

- Im Abschnitt `## Angenommen - noch zu verifizieren` die Einleitung `Dafuer ist \`npm run discover\` da.` ersetzen durch `Geprüft wird das mit der ersten echten Aufzeichnung unter \`server/data/sessions/\`.` und den Unterabschnitt `### Subscribe-Nachricht` streichen (die Seite abonniert selbst).
- Den Schlussabsatz `**Wenn die echte Struktur abweicht:** ...` ersetzen durch:

```markdown
**Wenn die echte Struktur abweicht:** nur `server/src/beamer/game-state.ts`
anpassen und das Fixture `server/test/fixtures/demo-session.ndjson` durch einen
Ausschnitt der echten Aufzeichnung ersetzen. Server und Anzeige bleiben
unberührt, weil dazwischen der `ScoreboardState` als Vertrag steht.
```

- [ ] **Step 3b: Kommentar in `server/src/beamer/game-state.ts` anpassen**

Im Dateikopf die Sätze

```
 * Diese Datei ist die einzige Stelle, die das Drahtformat von Autodarts kennt.
 * Wenn `npm run discover` zeigt, dass Felder anders heissen, wird nur hier
 * angepasst; Server und Anzeige bleiben unberuehrt.
```

ersetzen durch

```
 * Diese Datei ist die einzige Stelle, die das Drahtformat von Autodarts kennt.
 * Zeigt eine echte Aufzeichnung (data/sessions/), dass Felder anders heissen,
 * wird nur hier angepasst; Server und Anzeige bleiben unberuehrt.
```

Ebenso im Kommentar von `server/test/game-state.test.ts` `Wenn \`npm run discover\` eine abweichende Struktur zeigt` → `Wenn die erste echte Aufzeichnung eine abweichende Struktur zeigt`.

- [ ] **Step 4: Prüfen, dass keine veralteten Verweise übrig sind**

Run: `cd /c/Projekte/raspdarts && grep -rn "discover\|AUTODARTS_CLIENT_ID\|AUTODARTS_BOARD_ID\|8080\|autodarts-beamer" README.md docs/projekt.md docs/protocol.md server/src server/public extension/src`
Expected: keine Treffer.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Dokumentation auf das gemeinsame Projekt umstellen"
```

---

### Task 9: Abnahme an der Scheibe (Arnold)

Dieser Task ist Handarbeit am echten Gerät. Der ausführende Agent bereitet nur vor und hält fest, was Arnold berichtet.

- [ ] **Step 1: GitHub-Repo anlegen und pushen** – Arnold legt `HerobrickHD/raspdarts` (leer, ohne README) an. Dann:

```bash
cd /c/Projekte/raspdarts
git remote add origin https://github.com/HerobrickHD/raspdarts.git
git push -u origin main
```

Vor dem Push prüfen: `git log --format='%an <%ae> | %cn | %s'` zeigt ausschließlich `Arnold Hellman` und keine Attributionszeilen (`git log --format=%B | grep -i claude` liefert nichts).

- [ ] **Step 2: Auf dem Pi installieren** (per SSH, als normaler Benutzer)

```bash
curl -sL https://raw.githubusercontent.com/HerobrickHD/raspdarts/main/install.sh | bash
```

Prüfen:

```bash
systemctl status raspdarts --no-pager
curl -s -o /dev/null -w '%{http_code}\n' http://raspdarts.local:8743/api/status      # 403
curl -s -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/status                  # JSON
sudo -l | grep raspdarts                                                              # nur die sechs Skripte
ls -l /usr/local/lib/raspdarts                                                        # root root, -rwxr-xr-x
```

- [ ] **Step 3: Extension laden** (siehe README) und play.autodarts.io öffnen. Erwartung: Button mit hellem Punkt, Panel zeigt Systemwerte und `Beamer: connected`.

- [ ] **Step 4: Ein Leg werfen**, Beamer bzw. `http://raspdarts.local:8743/` offen. Erwartung: Restpunkte, aktive Aufnahme und Checkout laufen live mit.

- [ ] **Step 5: Panel-Funktionen** – „Update Raspdarts“ (Log läuft, Dienst kommt nach ~2 s zurück), „Update Autodarts“ (Log läuft). Neustart nur, wenn gerade nicht gespielt wird.

- [ ] **Step 6: Aufzeichnung auswerten** – neueste Datei aus `~/raspdarts/server/data/sessions/` auf den Laptop holen und gegen `docs/protocol.md` vergleichen. Weichen Feldnamen ab: `game-state.ts` und Fixture anpassen (eigener Task mit TDD), `protocol.md` den Abschnitt von „Angenommen“ nach „Geprüft“ verschieben.

- [ ] **Step 7: Altlasten** – wenn alles läuft, kann Arnold `HerobrickHD/Raspdarts` und `HerobrickHD/Raspdarts-backend` auf GitHub löschen oder archivieren und den lokalen Ordner `C:\Projekte\Raspdarts-backend` entfernen. Das entscheidet Arnold selbst.
