# Scheibe automatisch ausrichten – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Knopf „Automatisch ausrichten“ im Kasten Scheibe misst per Prüfbild und Autodarts-Kameras, wo die projizierte Scheibe auf der echten liegt, und stellt `layout.board` (cx, cy, diameter, rotation) passend ein – ein Zurück-Schritt.

**Architecture:** Der Pi schaltet das Prüfbild für alle Viewer (neue WebSocket-Nachricht `pattern`) und holt in einer Anfrage `POST /api/align/capture` je Kamera ein Bild bei Schwarz und eines mit Punkten (Base64-JPEG + Homographie). Der Browser mit der Leiste entpackt die Bilder per Canvas, sucht die Punkte, rechnet sie über die Homographie in mm auf der echten Scheibe um, gleicht eine Ähnlichkeit aus und übernimmt die neuen Werte über den Editor (`change` → sync + Zurück). Alle Rechenteile sind reine Funktionen in `public/js/align.js`.

**Tech Stack:** Node/TypeScript (Fastify, vitest) auf dem Pi, Vanilla-JS-Module im Viewer, keine neue Abhängigkeit.

**Spec:** `docs/superpowers/specs/2026-11-01-auto-ausrichten-design.md`

## Global Constraints

- Nur Server/Viewer, Server-Version **2.9.0** (`server/package.json`), keine Extension.
- Keine neue npm-Abhängigkeit, kein neues Profilfeld, Profil-Version bleibt (keine Migration).
- Autodarts nur über `cams.image` / `cams.calibration` fragen; höchstens **ein Bild pro Sekunde und Kamera** während der Messung.
- Kein Prüfbild, solange `phase === "playing"`; startet ein Spiel, verschwindet das Prüfbild sofort, und nichts wird übernommen.
- Prüfbild höchstens **10 s** (`PATTERN_MAX_MS = 10_000`), auch wenn der auslösende Browser wegbricht.
- Nur feste Formate (16:9, 16:10, 4:3). Bei `format === "fenster"` ist der Knopf gesperrt mit Titel/Hinweis „Nur bei festem Format (z. B. 16:9)“.
- Bei unsicherer Messung bleibt `layout.board` unverändert.
- Texte deutsch, mit Umlauten in der Oberfläche (wie die übrige Leiste). Kommentare im Code ohne Umlaute (wie bisher).
- Pushen und Pi-Update erst nach Arnolds „ja“.

## Review Focus

1. **Gerät mit offener Leiste ist selbst der Beamer:** Dessen Bühne ist wegen der Leiste kleiner (`placeStage` reserviert rechts). Während des Prüfbilds muss die Bühne ohne Reserve liegen, und die Leiste muss ausgeblendet sein, sonst wird gegen die verkleinerte Bühne gemessen. → Test in Task 3 (`placeReserve`).
2. **Ein Viewer verbindet sich während des Prüfbilds neu** (Fire TV wacht auf): Er muss das laufende Prüfbild sofort zeigen. → Test in Task 2 (attach sendet `pattern`).
3. **Die Scheibe liegt weiter daneben als gedacht** (> ~45 mm): Punkte passen keinem Soll zu. Erwartet wird ein Hinweis, keine wilde Änderung. → Test in Task 1 (`matchDots` verwirft, `measureBoard` → `too-few`).
4. **Eine Kamera sieht einen Punkt doppelt oder einen Reflex** (helle Fläche am Draht, Lampe im Bild): Ausreißer dürfen das Ergebnis nicht verschieben. → Test in Task 1 (Ausreißer in `fitSimilarity`, zwei Flecken auf denselben Punkt in `matchDots`).
5. **Zweimal schnell gedrückt oder zwei Geräte gleichzeitig:** Die zweite Messung muss mit „läuft schon“ abgewiesen werden und darf das Prüfbild der ersten nicht ausschalten. → Test in Task 2 (`busy`).

---

### Task 1: Rechenteil `align.js` (Punkte, Flecken, Ausgleich, neue Werte)

**Files:**
- Create: `server/public/js/align.js`
- Test: `server/test/align.test.js`

**Interfaces:**
- Produces (alle `export`, reine Funktionen ohne DOM):
  - `ALIGN_DOTS: [number, number][]` – Punkte in mm auf der gezeichneten Scheibe (x rechts, y unten, 20 oben, Mitte 0/0): die Mitte `[0, 0]` und 8 Punkte auf Radius 130 mm bei den Winkeln `9° + k·45°` (Winkel im Uhrzeigersinn von oben, wie `pointAt` in `geometry.js`).
  - `ALIGN_DOT_RADIUS = 6` (mm).
  - `findSpots(black, dots) → { x: number, y: number, weight: number }[]` – `black`/`dots` sind `{ width, height, data }` wie `ImageData` (RGBA). Luminanz-Differenz `max(0, L(dots) − L(black))`, Schwelle `max(40, 0.5 · maxDiff)`, 4er-Nachbarschaft, Fläche zwischen 4 px und 2 % der Bildfläche, Mitte nach Differenz gewichtet. Leere Liste, wenn `maxDiff < 40`.
  - `applyHomography(h: number[9], [x, y]) → [u, v]` – wie in `server/src/viewer/camera-geometry.ts`.
  - `toBoardMm([u, v]) → [mm, mm]` = `[(u − 0.5) · 450, (v − 0.5) · 450]`.
  - `matchDots(measured: [number, number][]) → { p: [number, number], q: [number, number] }[]` – jeder gemessene Punkt `q` (mm, echte Scheibe) zum nächsten `ALIGN_DOTS`-Punkt `p`, wenn der Abstand ≤ `MATCH_MAX_MM = 45` ist, sonst verworfen.
  - `fitSimilarity(pairs) → { s, theta, tx, ty, rms, used } | null` – kleinste Quadrate für `q = s·R(θ)·p + t` (θ in Grad, `R(θ) = [[cos, −sin], [sin, cos]]` in y-unten-Koordinaten = im Uhrzeigersinn sichtbar). Danach Paare mit Rest > `OUTLIER_MM = 5` weg und neu rechnen. `used` = Paare der zweiten Rechnung. `null` bei < 2 Paaren.
  - `alignBoard(board, fit, aspect) → board` – `board = { cx, cy, diameter, rotation }` wie `layout.board`, `aspect` = Breite/Höhe der Bühne. Mit `k = diameter / 340` und Mitte in Höhen-% `C = [cx · aspect, cy]`: `diameter' = diameter / s`, `rotation' = normalize(rotation − θ)` auf (−180, 180], `C' = C − (k / s) · R(rotation − θ) · t`, `cx' = C'x / aspect`, `cy' = C'y`. Danach auf die Grenzen aus `layout.ts` klemmen (Position 0–100, Durchmesser 5–400).
  - `measureBoard(captures, board, aspect) → { ok: true, board, rms, used } | { ok: false, reason: "no-spots" | "too-few" | "one-sided" | "inaccurate" }` – `captures: { matrix, black, dots }[]`. Ablauf: `findSpots` je Kamera → `applyHomography` → `toBoardMm` → alle zusammen in `matchDots` → `fitSimilarity` → Prüfung: gar keine Flecken → `no-spots`; `used.length < 4` oder `fit === null` → `too-few`; Betrag des Mittelwerts der verwendeten `p` > 60 mm → `one-sided`; `rms > 3` → `inaccurate`; sonst `alignBoard`.

- [ ] **Step 1: Failing tests in `server/test/align.test.js` (vitest, wie `geometry.test.js`)**

  - `findSpots`: künstliches 200×150-Bild, schwarz; „dots“ mit zwei weißen 5×5-Quadraten um (40, 30) und (150, 100) → zwei Flecken, Mitten auf ±0.5 px. Gleiche Bilder (keine Differenz) → `[]`. Ein einzelnes helles Pixel → kein Fleck (unter 4 px).
  - `fitSimilarity`: Paare aus `ALIGN_DOTS` mit bekanntem `s = 1.04, θ = 3, t = [12, −7]` → Werte auf 1e-6, `rms < 1e-6`. Mit ±0.5 mm Rauschen → `s` auf 0.005, `θ` auf 0.3°. Mit einem Paar um 30 mm verfälscht → Ausreißer weg (`used.length === 8`), Werte wie ohne Ausreißer auf 0.01.
  - `matchDots`: ein Punkt 60 mm neben jedem Soll → verworfen. Zwei Messungen in 1 mm Abstand beim selben Soll → beide Paare mit demselben `p` (die Mehrfachsicht geht ein).
  - `alignBoard` Rundreise (legt alle Vorzeichen fest): Für eine heutige Scheibe `B = { cx: 48, cy: 50, diameter: 60, rotation: −2 }` und eine wahre Scheibe `B* = { cx: 50.5, cy: 47, diameter: 63, rotation: 1.5 }` bei `aspect = 16/9`: Jeder Punkt `p` wird mit `B` auf die Bühne gerechnet (`S = C + k·R(r)·p`) und mit `B*` zurück auf die echte Scheibe (`q = R(−r*)·(S − C*) / k*`). `fitSimilarity` auf diesen Paaren, dann `alignBoard(B, fit, 16/9)` → `B*` auf 1e-6. Dasselbe einmal je Einzelfehler (nur Verschiebung, nur Größe, nur Drehung) und bei `aspect = 4/3`.
  - `measureBoard`: Synthetische Kamera mit Homographie = Skalierung (Kamerapixel → Einheitsquadrat) über ein 450×450-Bild, Punkte als 5×5-Quadrate an den aus `B*` berechneten Stellen → `ok`, `board` ≈ `B*` auf 0.05 (Pixelraster). Nur 3 Punkte im Bild → `too-few`. Nur die 4 Punkte einer Hälfte + Mitte → `one-sided`. Leeres Bild → `no-spots`.

- [ ] **Step 2: Tests laufen lassen, sie schlagen fehl**

  Run: `cd server && npx vitest run test/align.test.js`
  Expected: FAIL (Modul `../public/js/align.js` fehlt)

- [ ] **Step 3: `server/public/js/align.js` mit den Funktionen oben**

  Ähnlichkeit geschlossen lösen: Schwerpunkte abziehen, dann `a = Σ(p·q)/Σ|p|²`, `b = Σ(p×q)/Σ|p|²` (Kreuzprodukt `px·qy − py·qx`), `s = hypot(a, b)`, `θ = atan2(b, a)`, `t = q̄ − s·R(θ)·p̄`.

- [ ] **Step 4: Tests grün**

  Run: `cd server && npx vitest run test/align.test.js`
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add server/public/js/align.js server/test/align.test.js
  git commit -m "Ausrichten: Rechenteil (Punkte finden, Aehnlichkeit, neue Scheibenwerte)"
  ```

---

### Task 2: Pi – Prüfbild-Nachricht und `POST /api/align/capture`

**Files:**
- Modify: `server/src/viewer/display-hub.ts` (Nachricht `pattern`, `setPattern`, Höchstdauer, Spielstart löscht)
- Create: `server/src/viewer/align.ts`
- Modify: `server/src/http.ts` (Route, `AppDeps.aligner`), `server/src/runtime.ts` (verdrahten), `server/test/helpers.ts` (`aligner` in `testDeps`)
- Test: `server/test/display-hub.test.ts`, `server/test/align-capture.test.ts`, `server/test/http.test.ts`

**Interfaces:**
- Consumes: `Cams` aus `server/src/system/cams.ts` (`image(n, { fresh: true })`, `calibration()`), `cameraMatrices` aus `camera-geometry.ts`.
- Produces:
  - `type Pattern = "black" | "dots"`; `ViewerMessage` bekommt `{ type: "pattern"; pattern: Pattern | null }`.
  - `DisplayHub.setPattern(pattern: Pattern | null): void` – an alle Viewer. Bei `pattern !== null` startet ein Timer `PATTERN_MAX_MS = 10_000` (Konstruktor-Option für Tests, wie `editTimeoutMs`), danach `setPattern(null)`. `attach` schickt ein laufendes Prüfbild mit. `broadcast(state)` mit `phase === "playing"` beendet ein laufendes Prüfbild sofort. `get pattern(): Pattern | null`.
  - `server/src/viewer/align.ts`:
    - `PATTERN_SETTLE_MS = 1000`
    - `type AlignFailure = "playing" | "busy" | "board-stopped" | "unavailable" | "no-calibration"`
    - `type AlignCapture = { ok: true; cams: { n: number; matrix: Homography; black: string; dots: string }[] } | { ok: false; reason: AlignFailure }` (`black`/`dots` = Base64-JPEG)
    - `class Aligner { constructor(deps: { cams: Pick<Cams, "image" | "calibration">; hub: Pick<DisplayHub, "setPattern" | "state">; sleep?: (ms: number) => Promise<void> }); capture(): Promise<AlignCapture> }`
  - `AppDeps.aligner: Pick<Aligner, "capture">`; Route `POST /api/align/capture` antwortet immer 200 mit `AlignCapture` (Fehler stehen in `reason`).

  Ablauf `capture()`: läuft schon eine → `busy` (ohne das Prüfbild anzufassen). `hub.state.phase === "playing"` → `playing`. Kameras = Schlüssel von `cameraMatrices(await cams.calibration())`, keine → `no-calibration`. `setPattern("black")`, `sleep(PATTERN_SETTLE_MS)`, alle Kameras parallel `image(n, { fresh: true })`, `setPattern("dots")`, `sleep(PATTERN_SETTLE_MS)`, wieder alle holen. Vor jedem Schritt erneut auf `playing` prüfen. Ein Bild mit `reason: "board-stopped"` → `board-stopped`, sonstige Fehler → `unavailable`. `setPattern(null)` immer im `finally`. Zwischen den beiden Abrufen derselben Kamera liegt so ≥ 1000 ms (Bremse).

- [ ] **Step 1: Failing tests**

  `display-hub.test.ts`, neuer `describe("Prüfbild")`:
  - `setPattern("dots")` → jeder Socket bekommt `{ type: "pattern", pattern: "dots" }`.
  - Ein danach verbundener Socket bekommt beim `attach` auch `pattern: "dots"`. Ohne Prüfbild schickt `attach` keine `pattern`-Nachricht.
  - Mit Höchstdauer 50 ms (fake timers): nach 50 ms `pattern: null`.
  - `broadcast` mit Spielstand `playing` → `pattern: null`.

  `align-capture.test.ts` (Fake-`cams`, Fake-`hub` mit Aufzeichnung, `sleep` sofort, aber Aufrufe gezählt):
  - Ablauf: Reihenfolge der `setPattern`-Aufrufe ist `black`, `dots`, `null`. Je Kamera aus der Kalibrierung (zwei Kameras „0“, „2“) genau zwei `image`-Aufrufe mit `fresh: true`. Ergebnis `ok`, `cams[].n` = `[0, 2]`, `black`/`dots` = Base64 der Fake-JPEGs, `matrix` aus `cameraMatrices`.
  - `sleep` wird zweimal mit 1000 aufgerufen, und zwischen den beiden `image`-Aufrufen einer Kamera liegt ein `sleep`.
  - `phase === "playing"` beim Start → `{ ok: false, reason: "playing" }`, kein `setPattern`.
  - Spiel startet nach dem schwarzen Bild (Fake-hub stellt `state` im ersten `sleep` um) → `playing`, letztes `setPattern` ist `null`.
  - Kamera meldet `board-stopped` → `board-stopped`, `setPattern(null)` am Ende. Kamera meldet `unavailable` → `unavailable`.
  - Leere Kalibrierung → `no-calibration`.
  - Zweiter `capture()`, solange der erste läuft → `busy`, und das Prüfbild der ersten bleibt (kein zusätzliches `setPattern(null)` vor deren Ende).

  `http.test.ts`: `POST /api/align/capture` ohne Header → 403. Mit Header → 200 und der Wert aus einem Fake-`aligner`.

- [ ] **Step 2: Tests schlagen fehl**

  Run: `cd server && npx vitest run test/display-hub.test.ts test/align-capture.test.ts test/http.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implementieren** – `display-hub.ts`, `align.ts`, Route in `http.ts`, `runtime.ts` (`new Aligner({ cams, hub })`), `helpers.ts` (Standard-Fake `aligner: { capture: async () => ({ ok: false, reason: "unavailable" }) }`).

- [ ] **Step 4: Alle Server-Tests und Typen grün**

  Run: `cd server && npx vitest run && npx tsc --noEmit`
  Expected: PASS, keine Typfehler

- [ ] **Step 5: Commit**

  ```bash
  git add server/src server/test
  git commit -m "Ausrichten: Pruefbild an alle Viewer und Bilder holen (POST /api/align/capture)"
  ```

---

### Task 3: Viewer zeigt das Prüfbild

**Files:**
- Modify: `server/public/js/layout-view.js` (`boardPlacement` herauslösen), `server/public/js/app.js` (Nachricht `pattern`, `placeStage`), `server/public/index.html` (Element für die Punkte), `server/public/style.css`
- Create: nichts
- Test: `server/test/layout-view.test.js`, `server/test/stage.test.js`

**Interfaces:**
- Consumes: `ALIGN_DOTS`, `ALIGN_DOT_RADIUS` aus Task 1; Nachricht `{ type: "pattern", pattern }` aus Task 2.
- Produces:
  - `boardPlacement(board) → { left, top, width, height, transform }` (Strings, genau die Werte, die `applyLayout` heute für `scheibe` setzt). `applyLayout` nutzt sie.
  - `placeReserve({ panelLeft, panelWidth, windowWidth, editing, aligning }) → { right, bottom }` in `stage.js`: `right = editing && !aligning && panelWidth > 0 ? windowWidth − panelLeft : 0`, `bottom = 0`. `placeStage` in `app.js` nutzt sie.
  - Im DOM: `<svg id="align-svg" class="align-svg">` als Kind von `#stage` mit `viewBox` wie die Scheibe (`−225 −225 450 450`), darin je `ALIGN_DOTS`-Punkt ein weißer Kreis mit `r = ALIGN_DOT_RADIUS`. Positioniert mit `boardPlacement(profile.layout.board)`.
  - `viewer.dataset.pattern = "black" | "dots"` während des Prüfbilds, sonst nicht gesetzt.

  Verhalten: Bei `data-pattern` ist das ganze Fenster schwarz (auch außerhalb der Bühne). Alle Bausteine, Leuchtfelder, Kamerabild, der Knopf „Einstellungen“ und die Leiste `#settings` sind unsichtbar (`visibility: hidden`, nichts verschiebt sich). Bei `dots` ist nur `#align-svg` sichtbar, bei `black` gar nichts. Ohne `data-pattern` ist `#align-svg` versteckt. Die Bühne liegt während des Prüfbilds ohne Leisten-Reserve (`placeReserve`), danach wieder wie vorher.

- [ ] **Step 1: Failing tests**
  - `layout-view.test.js`: `boardPlacement({ cx: 40, cy: 55, diameter: 34, rotation: 10 })` → `left "40%"`, `top "55%"`, `width`/`height` = `${34 * 225 / 170}cqh`, `transform "translate(-50%, -50%) rotate(10deg)"`.
  - `stage.test.js`: `placeReserve` mit `editing: true, aligning: false, panelLeft: 1500, panelWidth: 420, windowWidth: 1920` → `right 420`. Mit `aligning: true` → `right 0`. Mit `editing: false` → `right 0`.

- [ ] **Step 2: Tests schlagen fehl**

  Run: `cd server && npx vitest run test/layout-view.test.js test/stage.test.js`
  Expected: FAIL

- [ ] **Step 3: Implementieren** (`layout-view.js`, `stage.js`, `app.js`: `onMessage` setzt `pattern`, `render()` setzt `data-pattern` und positioniert `#align-svg`; `index.html`; CSS-Regeln unter `.viewer[data-pattern]`)

- [ ] **Step 4: Tests grün**

  Run: `cd server && npx vitest run`
  Expected: PASS

- [ ] **Step 5: Browser-Prüfung (Playwright, Screenshots nur unter `C:\Projekte\raspdarts\.playwright-mcp\`)**

  Lokalen Server starten (`cd server && npx tsx src/index.ts`, lokale Profile vorher sichern), Viewer öffnen. Seite lädt ohne Konsolenfehler, Scheibe sitzt unverändert, Leiste unverändert. Das Prüfbild selbst wird in Task 4 über den Knopf geprüft (kein Test-Zugang ins Frontend einbauen).

- [ ] **Step 6: Commit**

  ```bash
  git add server/public server/test
  git commit -m "Ausrichten: Viewer zeigt Pruefbild (Schwarz, Punkte auf der Scheibe)"
  ```

---

### Task 4: Knopf in der Leiste und Ablauf im Browser, Version 2.9.0

**Files:**
- Create: `server/public/js/align-run.js`
- Modify: `server/public/js/settings-panel.js` (Knopf im Kasten Scheibe), `server/public/js/settings.js` (Handler, Zustand), `server/public/js/editor.js` (`setBoard`), `server/public/js/app.js` (verdrahten: Phase, Format), `server/package.json` (`"version": "2.9.0"`)
- Test: `server/test/align-run.test.js` (`editor.setBoard` braucht das DOM und wird in Step 5 im Browser geprüft)

**Interfaces:**
- Consumes: `measureBoard` (Task 1), `POST /api/align/capture` (Task 2), `api(method, path, body)` aus `profile-api.js`.
- Produces:
  - `alignBlocked({ phase, format }) → string | null` in `align-run.js`: `"Nur ohne laufendes Spiel"` bei `phase === "playing"`, `"Nur bei festem Format (z. B. 16:9)"` bei `format === "fenster"`, sonst `null`.
  - `alignMessage(result) → string` in `align-run.js`, feste Texte:
    - `ok` → `"Ausgerichtet (± 0,8 mm)"` (rms mit einer Nachkommastelle, Komma)
    - `playing` → `"Nur ohne laufendes Spiel"`
    - `busy` → `"Ausrichten läuft schon"`
    - `board-stopped` → `"Board ist im Standby – in Autodarts starten"`
    - `unavailable` → `"Autodarts nicht erreichbar"`
    - `no-calibration` → `"Autodarts-Kalibrierung fehlt"`
    - `no-spots`, `too-few` → `"Punkte nicht gefunden – Beamer an und auf die Scheibe gerichtet?"`
    - `one-sided` → `"Zu wenige Punkte gefunden – Scheibe grob ausrichten und noch einmal versuchen"`
    - `inaccurate` → `"Messung zu ungenau – bitte noch einmal versuchen"`
  - `runAlign({ capture, decode, getProfile, setBoard, aspectOf }) → Promise<result>` in `align-run.js`: merkt sich `profile` beim Start, ruft `capture()`, entpackt mit `decode(base64) → ImageData`, ruft `measureBoard(captures, profile.layout.board, aspectOf(profile.format))`. Bei `ok` und wenn das aktive Profil noch dasselbe ist (`getProfile().id === profile.id`) → `setBoard(result.board)`. Gibt das Ergebnis zurück (für `alignMessage`).
  - `decodeJpeg(base64) → Promise<ImageData>` in `align-run.js` (DOM: `createImageBitmap` + Canvas). Nicht in Unit-Tests.
  - `aspectOf(format)`: `16:9 → 16/9`, `16:10 → 1.6`, `4:3 → 4/3` (gleiche Werte wie `RATIOS` in `stage.js`, von dort exportieren).
  - `editor.setBoard(board)` – `change((layout) => { layout.board = { ...board } }, \`align:${++alignCount}\`)`: ein eigener Zurück-Schritt je Messung, speichert und verteilt wie eine Tastenänderung.
  - Leiste: im Kasten Scheibe am Ende eine `.btn-row` mit `button("Automatisch ausrichten", handlers.onAlign, { className: "btn" })`. `render(next)` bekommt `next.align = { busy: boolean, blocked: string | null }`: bei `busy` steht „Richte aus …“ auf dem Knopf, und er ist gesperrt. Bei `blocked` ist er gesperrt, mit `title = blocked`. Ergebnis und Fehler kommen über `panel.setStatus(text)`.
  - `app.js` übergibt an `createSettings` zusätzlich `getPhase: () => state.phase`. `settings.refresh()` rechnet `blocked` aus `alignBlocked({ phase, format: profile.format })`.

- [ ] **Step 1: Failing tests in `server/test/align-run.test.js`**
  - `alignBlocked`: drei Fälle oben, und `{ phase: "idle", format: "16:9" }` → `null`.
  - `alignMessage`: jeder Grund liefert den Text oben. `{ ok: true, rms: 0.84 }` → `"Ausgerichtet (± 0,8 mm)"`.
  - `runAlign` mit Fakes: `capture` → `{ ok: false, reason: "board-stopped" }` → kein `setBoard`, Ergebnis mit `reason`. `capture` liefert Bilder, aus denen `measureBoard` ein Ergebnis macht (Bilder wie in Task 1 synthetisch, `decode` gibt sie direkt zurück) → `setBoard` einmal mit dem neuen Board. Profil hat während der Messung gewechselt (`getProfile` liefert andere id) → kein `setBoard`.

- [ ] **Step 2: Tests schlagen fehl**

  Run: `cd server && npx vitest run test/align-run.test.js`
  Expected: FAIL

- [ ] **Step 3: Implementieren** (`align-run.js`, Knopf in `settings-panel.js` in `buildPart` bei `part.id === "scheibe"`, Handler `onAlign` in `settings.js` mit `busy`-Zustand, `editor.setBoard`, Verdrahtung in `app.js`, Version 2.9.0)

- [ ] **Step 4: Alle Tests und Typen grün**

  Run: `cd server && npx vitest run && npx tsc --noEmit`
  Expected: PASS

- [ ] **Step 5: Browser-Prüfung gegen echtes Autodarts (Playwright)**

  `AUTODARTS_URL=http://192.168.178.68:3180 npx tsx src/index.ts` (lokale Profile vorher sichern). Viewer öffnen, Leiste auf, Kasten Scheibe: Knopf sichtbar, nichts verrutscht. Bei Format „Ganzes Fenster“ gesperrt mit Titel. Drücken bei laufendem Board: Bühne wird schwarz, dann Punkte, dann zurück. In der Statuszeile steht ein Ergebnis oder ein Grund, ohne Konsolenfehler. Board im Standby → „Board ist im Standby – in Autodarts starten“. Zurück stellt eine übernommene Änderung wieder her.

  Dabei prüfen (Spec „Zu prüfen“): Die Kalibrier-Pixel passen zur Bildgröße aus `/api/img/cams/<n>`. Dazu die Ellipsen-Punkte einer Kamera auf das Bild legen (z. B. per Skript als PNG unter `.playwright-mcp/`) und ansehen. Passen sie nicht, im Plan-Nachtrag festhalten und vor `applyHomography` passend skalieren.

- [ ] **Step 6: Commit**

  ```bash
  git add server/public server/test server/package.json
  git commit -m "Ausrichten: Knopf im Kasten Scheibe, Ergebnis direkt mit Zurueck; Version 2.9.0 (Server)"
  ```

---

### Task 5: Am echten Aufbau einstellen und ausrollen

Kein neuer Code ohne Befund. Hier werden nur die Werte aus Task 1/2 am Beamer eingestellt.

- [ ] **Step 1: Arnold fragen** und nach seinem „ja“ `data/profiles` auf dem Pi sichern (`tar czf ~/profiles-vor-<commit>.tgz profiles`), pushen und den Pi per `curl -sN -X POST -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/system/update` aktualisieren. Danach per SSH `git log -1` und `systemctl is-active raspdarts` prüfen.
- [ ] **Step 2: Arnold testet am Beamer.** Scheibe ein paar cm verschieben, größer machen, drehen, Knopf drücken, und mit Auge und Kamera-Ansicht vergleichen. Danach mit Zurück den alten Stand holen.
- [ ] **Step 3: Werte nachziehen, falls nötig** (`PATTERN_SETTLE_MS`, Schwelle in `findSpots`, `ALIGN_DOT_RADIUS`, Grenzen 45 / 5 / 3 / 60 mm). Jede Änderung mit angepasstem Test, Commit „Ausrichten: <Wert> nach Test am Beamer“, erneut ausrollen nach „ja“.
- [ ] **Step 4: Spec-Nachtrag** in `docs/superpowers/specs/2026-11-01-auto-ausrichten-design.md`: gemessene Werte und das Ergebnis der Auflösungs-Prüfung. Commit.
