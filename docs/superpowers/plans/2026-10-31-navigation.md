# Raspdarts-Knopf in der Navigation – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Extension fügt auf der Board-Karte nichts mehr ein. Das Raspdarts-Fenster öffnet sich über einen Monitor-Knopf links neben dem Profilbild in der Autodarts-Navigationsleiste. Kameras-Knopf und `/api/cams` fallen weg.

**Architecture:** Zuerst am Pi und in der Extension alles entfernen, was nur dem Kameras-Knopf und der Board-Karte diente. Der gemeinsame Unterbau `board-card.js` heißt danach `ui.js` (`globalThis.raspdartsUi`) und behält nur Texte, Nachrichten an den Background-Teil, Speicher, Knopf-Zustand und Fenster. `viewer.js` setzt den Knopf in die `<header>`-Leiste vor den Profilbild-Knopf und hält ihn per MutationObserver dort.

**Tech Stack:** Chrome/Firefox-Extension (MV3, Content-Skripte ohne Module), Vitest; Server TypeScript/Fastify.

**Spec:** `docs/superpowers/specs/2026-10-30-zurueck-und-navigation-design.md` (Teil 2)

## Global Constraints

- Knopf **links neben dem Profilbild**, **immer** sichtbar (auch ohne Pi), auf allen Seiten von play.autodarts.com, auch im Spiel.
- Sprachunabhängig finden: Profilbild-Knopf = `header button:has([data-slot="avatar"])` (Stand 31.10., gelesen im Playwright-Browser: `header` > `div.flex.gap-4.items-center` > [leeres `div`, Profilbild-Knopf, je nach Seite Freunde- und Glocken-Knopf]); fehlt er, nichts einfügen, kein Fehler.
- Symbol `ICONS.monitor`, bei Weitergabe aus `ICONS.monitorOff` und gedämpft (`viewerButtonState`); 32 × 32, rund, wie Autodarts' Symbol-Knöpfe (Klassen `relative size-8 flex items-center justify-center rounded-full text-mono-white hover:text-blue-30 transition-all`).
- Fenster unverändert (page.js), Titel nur `t.windowTitle` („Raspdarts“); bleibt beim Seitenwechsel offen.
- Board-Karte: nichts einfügen, nichts verstecken.
- Bleibt: `match-viewer-link.js` (nur reparieren, falls kaputt), Weitergabe (`forward.js`, `page-hook.js`, `bridge.js`), am Pi `/api/board-camera…`, `board-camera.ts`, `cams.image`/`cams.calibration`.
- Version 2.3.0 für Server und Extension. Push, Pi-Update, Release erst nach Arnolds „ja“ (Push tippt Arnold selbst: `! git push origin main`).

## Review Focus

- Autodarts zeichnet die Leiste beim Seitenwechsel neu: Der Knopf muss danach wieder genau einmal da sein (nicht doppelt, nicht verschwunden). Prüfung in Task 3 im Browser auf /, /boards, /play.
- Abgemeldet bzw. Seite ohne Profilbild-Knopf: kein Knopf, keine Fehler in der Konsole. Prüfung in Task 3 (Code-Pfad `if (!avatar) return`).
- Weitergabe in einem anderen Tab umgeschaltet (`storage.onChanged`): Symbol wechselt ohne Neuladen. Prüfung in Task 3.
- Fenster offen, dann Seitenwechsel in Autodarts: Fenster bleibt, Status-Abfrage läuft weiter, Schließen beendet sie. Prüfung in Task 3.
- Extension-Update während die Seite offen ist (`sendToBackground` wirft): Knopf bleibt bedienbar, Fenster zeigt „nicht erreichbar“ – vorhandenes Verhalten von `sendToBackground`, nicht anfassen.

---

### Task 1: Server – `/api/cams` entfernen

**Files:**
- Modify: `server/src/http.ts` (Routen `/api/cams`, `/api/cams/:n`, `cams` in den Abhängigkeiten, `CAM_FAILURE_CODES` falls danach unbenutzt)
- Modify: `server/src/system/cams.ts` (`info()`, `CamsInfo`, `fetched`, `board_id` in `parseCamsConfig` → nur noch `{ cams: number }`)
- Modify: `server/src/runtime.ts` (kein `cams` mehr an `buildApp`, falls nur dafür)
- Test: `server/test/http.test.ts`, `server/test/cams.test.ts`
- Modify: `README.md` (Zeile `/api/cams` der API-Tabelle streichen)

**Interfaces:**
- Produces: `Cams = { image(n, options?), calibration() }`; `parseCamsConfig(body) → { cams: number } | null`.

- [ ] **Step 1:** In `http.test.ts` den Block `describe("/api/cams")` ersetzen durch einen Test „/api/cams gibt es nicht mehr“: `GET /api/cams` und `GET /api/cams/0` (mit Header) → `statusCode` 404. In `cams.test.ts` `describe("info")` streichen und `parseCamsConfig`-Erwartungen auf `{ cams: n }` umstellen (die Fälle `boardId`/`board_id` entfallen).
- [ ] **Step 2:** `cd server && npx vitest run test/http.test.ts test/cams.test.ts` → FAIL (Routen antworten noch, `board_id` noch im Ergebnis).
- [ ] **Step 3:** Entfernen wie unter Files. Kommentar über `parseCamsConfig` anpassen („nur Anzahl belegter Kamera-Plätze“).
- [ ] **Step 4:** `npx vitest run` und `npx tsc --noEmit` → grün.
- [ ] **Step 5:** Commit `Pi: /api/cams entfernt - nur der Kameras-Knopf der Extension hat es benutzt`

### Task 2: Extension – Kameras-Knopf und Board-Karte entfernen, `ui.js`

**Files:**
- Delete: `extension/src/cams.js`, `extension/src/cams-view.js`, `extension/test/cams-view.test.js`
- Rename: `extension/src/board-card.js` → `extension/src/ui.js`, Global `raspdartsBoardCard` → `raspdartsUi`; raus: `BOARD_ID_KEY`, `loadBoard`, `boardForVisit`, `locateCard`, `ensureButton`, `watchBoardsPage`, `visit`, `ICONS.camera`, die Imports `pickBoardId`/`isBoardsPage`. Kopfkommentar neu („Gemeinsamer Unterbau der Extension: Texte, Background, Speicher, Knopf, Fenster“).
- Modify: `extension/src/viewer-view.js` (`pickBoardId` raus), `extension/test/viewer-view.test.js` (`describe('pickBoardId')` raus)
- Modify: `extension/src/background.js` (Handler `type: 'image'` und `toBase64` raus), `extension/test/background.test.js` (Bild-Tests raus; der `fetch`-Test über `/api/cams` nimmt stattdessen `/api/status`)
- Modify: `extension/src/texts.js` (`cams*`-Texte raus, beide Sprachen)
- Modify: `extension/manifest.chrome.json`, `extension/manifest.firefox.json` (Skriptliste: `cams-view.js`, `cams.js` raus, `board-card.js` → `ui.js`)
- Modify: `extension/src/viewer.js` vorläufig nur auf `raspdartsUi` umstellen (Task 3 baut ihn um)

**Interfaces:**
- Produces: `globalThis.raspdartsUi = { ICONS: { monitor, monitorOff }, openOverlay, sendToBackground, setButton, storageGet, storageSet, texts }`.

- [ ] **Step 1:** Tests anpassen (Streichungen oben; `texts.test.js` prüft gleiche Schlüssel in beiden Sprachen – bleibt so). `cd extension && npx vitest run` → FAIL erwartet nur dort, wo Tests auf noch Vorhandenes zeigen (z. B. background-Bildtest gestrichen, aber Code noch da → grün; dann reicht als RED: neuer Test in `background.test.js` „type image wird nicht mehr beantwortet“ – `send({ type: 'image', cam: 0 })` löst nicht mit `ok: true` auf und `fetch` wird nicht aufgerufen).
- [ ] **Step 2:** Entfernen/umbenennen wie unter Files. `grep -rn "raspdartsBoardCard\|raspdartsCamsView\|pickBoardId\|cams" extension/src extension/manifest.*.json` → keine Treffer außer Kommentaren, die die Kamera-Ansicht des Viewers meinen.
- [ ] **Step 3:** `npx vitest run` → grün; `bash build.sh` → baut ohne Fehler.
- [ ] **Step 4:** Commit `Extension: Kameras-Knopf und Board-Karten-Knoepfe entfernt - Autodarts hat den Board Manager wieder`

### Task 3: Extension – Monitor-Knopf in der Navigation

**Files:**
- Modify: `extension/src/viewer.js`
- Modify: `extension/src/viewer-view.js` (nur falls eine reine Hilfsfunktion nötig wird)

**Interfaces:**
- Consumes: Task 2 (`raspdartsUi`).

- [ ] **Step 1:** `viewer.js` umbauen:
  - `refreshButton()`: `header`-Leiste suchen, darin `button:has([data-slot="avatar"])`; fehlt er → nichts. Eigenen Knopf (`id = 'raspdarts-viewer-btn'`, `data-raspdarts="1"`) suchen; steht er nicht direkt vor dem Profilbild-Knopf (`avatar.previousElementSibling !== wrap`), neu davor setzen (`avatar.before(wrap)`). Knopf wie bisher: `span` als Hülle (Hinweis), darin `button` mit den Klassen aus den Global Constraints; Zustand über `ui.setButton(wrap, { icon, iconName, title, muted })` mit `viewerButtonState`.
  - Gedämpft in der Leiste: `setButton` setzt heute einen dunklen Hintergrund – für den runden Leistenknopf nur die Farbe dämpfen. Dafür `setButton` um Option `mutedBackground = true` erweitern; die Leiste ruft mit `false`.
  - MutationObserver auf `document.body` (`childList`, `subtree`) ruft `refreshButton`; `setButton` schreibt nur Änderungen (sonst Endlosschleife).
  - `openWindow`: Titel `t.windowTitle`; kein Board mehr, kein `watchBoardsPage`, kein `onLeave` – das Fenster bleibt beim Seitenwechsel.
  - Kopfkommentar: Knopf in der Navigationsleiste, Verweis auf die Spec vom 30.10.
- [ ] **Step 2:** `cd extension && npx vitest run` → grün; `bash build.sh`.
- [ ] **Step 3: Browser** (Playwright, Autodarts nur lesen, nichts anklicken, was etwas anlegt): Extension lässt sich nicht laden → `ui.js`, `texts.js`, `forwarding.js`, `view-model.js`, `viewer-view.js`, `stream.js`, `page.js`, `viewer.js` per `evaluate` einspielen (mit kleinem `chrome`-Ersatz: `runtime.sendMessage` → antwortet `{ ok: false }`, `storage.local` im Speicher, `runtime.getURL` auf die gebauten Dateien bzw. `page.html` per `fetch` aus `dist/chrome` über einen lokalen Dateiserver – Umsetzer wählt). Prüfen:
  - Knopf links neben dem Profilbild auf `/`, `/boards`, `/play`; nach Seitenwechsel genau einmal (`document.querySelectorAll('#raspdarts-viewer-btn').length === 1`).
  - Board-Karte unter /boards: Board Manager sichtbar, kein Raspdarts-Knopf.
  - Klick öffnet das Fenster „Raspdarts“; Seitenwechsel lässt es offen; ✕ schließt.
  - Weitergabe umschalten (Speicher ändern) → Symbol wechselt auf durchgestrichen.
  - Screenshot der Leiste (`.playwright-mcp/nav-knopf.png`) für Arnold.
- [ ] **Step 4:** Commit `Extension: Raspdarts-Knopf (Monitor) in der Autodarts-Navigationsleiste links neben dem Profilbild`

### Task 4: Board control prüfen, Texte, Version

**Files:**
- Modify (nur falls kaputt): `extension/src/match-viewer-link.js`
- Modify: `README.md` (Abschnitt Extension: Knopf in der Navigationsleiste statt Board-Karte, kein Kameras-Knopf), Store-Texte falls im Repo (`grep -rn "Kameras" extension docs/store* 2>/dev/null`)
- Modify: Versionen auf `2.3.0`: `server/package.json`, `server/package-lock.json` (2 Stellen), `extension/package.json`, `extension/package-lock.json`, `extension/manifest.chrome.json`, `extension/manifest.firefox.json`

- [ ] **Step 1:** Arnold bitten, im Playwright-Browser selbst ein Spiel zu starten; dann das Zahnrad unten links öffnen (nur lesend) und per `evaluate` prüfen, ob `[role="dialog"] button[aria-label="Refresh camera images"]` existiert und `match-viewer-link.js` (eingespielt) den Abschnitt „Raspdarts Viewer“ setzt. Kaputt → `locate()` auf den neuen Aufbau umstellen, sprachunabhängig wo möglich; Ergebnis im Ledger.
- [ ] **Step 2:** README, Versionen; `cd server && npx vitest run`, `cd extension && npx vitest run && bash build.sh` → grün.
- [ ] **Step 3:** Commit `Version 2.3.0: Raspdarts-Knopf in der Navigation, Kameras-Knopf entfernt`
- [ ] **Step 4:** Review des ganzen Stands (frischer Prüfer). Dann Arnold: Merge, Push (er selbst), Pi sichern + Update, Release v2.3.0 mit ZIP (`/c/Windows/System32/tar.exe -a`, Token per `git credential fill`, REST-API) – alles erst nach seinem „ja“.
