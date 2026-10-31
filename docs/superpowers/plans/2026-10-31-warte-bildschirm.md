# Warte-Bildschirm einstellbar – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ohne Spiel zeigt der Viewer die Scheibe des Profils (wenn eingestellt) und einen verschieb-/skalierbaren Text „Warte auf ein Spiel“; eingestellt wird das über „Vorschau: Spiel | Warten“ in der Leiste.

**Architecture:** Neue Katalog-Option `scheibe.beimWarten` und neuer Baustein `warten`; neuer Layout-Block `blocks.warten` (Mitte als Bezugspunkt). `editing` bekommt `vorschau`, `previewState` liefert dann `idle`. Sichtbarkeit über CSS auf den `data-*`-Merkmalen von `#viewer`.

**Tech Stack:** TypeScript/Fastify (Pi), Vanilla-JS-Module + CSS (Viewer), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-warte-bildschirm-design.md`

## Global Constraints

- Keine Profil-Version hochzählen, keine Migration; Fehlendes bekommt beim Lesen die Vorgabe.
- Vorgaben: `scheibe.beimWarten = false`, `warten.on = true`, `blocks.warten = { x: 50, y: 50, scale: 1 }`.
- Text fest: „Warte auf ein Spiel“, Grundschrift `2.4cqh` bei scale 1.
- Vorschau ist kein Undo-Schritt; beim Öffnen der Leiste `"spiel"`.
- Server-Version 2.5.0; Extension unverändert.
- Nichts springt: der Umschalter steht immer an derselben Stelle.

## Review Focus

1. Altes Profil ohne `warten`/`beimWarten` lädt ohne Fehler und zeigt den Text mittig wie bisher (Test in Task 1).
2. Scheibe aus (`scheibe.on = false`) aber `beimWarten` an → beim Warten keine Scheibe (Browser-Prüfung Task 3).
3. Auf *Warten* umschalten, während Spielinfo ausgewählt ist → Pfeiltasten schieben nichts Unsichtbares (selectVisible, Task 3).
4. Zweites Gerät (Beamer) folgt der Vorschau *Warten* und kehrt nach „Fertig“ zum echten Stand zurück (Task 3).
5. Text beim Vergrößern bleibt um die Mitte (Task 2/3).

---

### Task 1: Pi – Katalog, Layout, editing.vorschau, Version

**Files:**
- Modify: `server/src/viewer/catalog.ts` (Scheibe-Optionen, neuer Part nach `scheibe`)
- Modify: `server/src/viewer/layout.ts` (`LayoutBlocks`, `DEFAULT_LAYOUT`, `sanitizeLayout`)
- Modify: `server/src/viewer/display-hub.ts` (`Editing`, `parseEditing`)
- Modify: `server/package.json` (2.5.0)
- Test: `server/test/catalog.test.ts`, `server/test/layout.test.ts`, `server/test/display-hub.test.ts`

**Interfaces:**
- Produces: `content.scheibe.beimWarten: boolean`, `content.warten = { on: boolean }`, `layout.blocks.warten: BlockLayout`, `Editing = { schritt, spieler, vorschau: "spiel" | "warten" }`.

- [ ] **Step 1: Tests anpassen/ergänzen**
  - catalog: Part-Reihenfolge `["hintergrund", "scheibe", "warten", "aufnahme", "spielinfo", "spieler"]`; Vorgaben `scheibe` enthält `beimWarten: false`, `warten` = `{ on: true }`; `sanitizeContent({ scheibe: { on: true } })` liefert `beimWarten: false` und `warten.on: true` (altes Profil).
  - layout: `DEFAULT_LAYOUT.blocks.warten` = `{ x: 50, y: 50, scale: 1 }`; `sanitizeLayout({ blocks: { warten: { x: 120, y: -1, scale: 9 } } }).blocks.warten` = `{ x: 100, y: 0, scale: 4 }`; Layout ohne `warten` → Standard.
  - display-hub `parseEditing`: `{ schritt: "inhalte", spieler: 2, vorschau: "warten" }` → `vorschau: "warten"`; fehlt/`"x"` → `"spiel"`; bestehende `toEqual` um `vorschau: "spiel"` ergänzen.
- [ ] **Step 2: `npx vitest run test/catalog.test.ts test/layout.test.ts test/display-hub.test.ts`** – FAIL.
- [ ] **Step 3: Umsetzen** (`toggle("beimWarten", "Beim Warten zeigen", false)` nach `darstellung`/`kamera`-Block ans Ende der Scheibe-Optionen; Part `{ id: "warten", label: "Warten", default: true, options: [] }`; `sanitizeBlock` für `warten`; `parseEditing` mit `vorschau`).
- [ ] **Step 4: `npx vitest run && npx tsc --noEmit`** – alles grün (andere Tests, die Part-Listen/Layouts vergleichen, nachziehen).
- [ ] **Step 5: Commit** „Warte-Bildschirm: Katalog (beimWarten, Warten), Layout-Block warten, editing.vorschau; Version 2.5.0 (Server)“ – Version erst im letzten Commit, falls getrennt.

### Task 2: Viewer – reine Logik

**Files:**
- Modify: `server/public/js/sample-state.js` (`previewState`)
- Modify: `server/public/js/layout-view.js` (Block `warten` mittig: `transform: translate(-50%, -50%) scale(s)`)
- Test: `server/test/sample-state.test.js`, `server/test/editor-keys.test.js`

**Interfaces:**
- Consumes: `editing.vorschau` aus Task 1.
- Produces: `previewState(state, editing)` → bei `editing?.vorschau === "warten"` `{ phase: "idle" }`; `CENTERED_BLOCKS = ["warten"]` (exportiert aus layout-view.js, vom Editor für den Anker genutzt).

- [ ] **Step 1: Tests** – `previewState(game, { schritt: "inhalte", spieler: 2, vorschau: "warten" })` toEqual `{ phase: "idle" }`; mit `vorschau: "spiel"` Beispieldaten. editor-keys: `apply(press("ArrowRight"), "warten").blocks.warten.x` ≈ `50.1`; `press("+")` → `scale` ≈ `1.01` (apply-Hilfe ggf. um `warten` im Layout ergänzen).
- [ ] **Step 2: Run** `npx vitest run test/sample-state.test.js test/editor-keys.test.js` – FAIL.
- [ ] **Step 3: Umsetzen.**
- [ ] **Step 4: Run** – PASS.
- [ ] **Step 5: Commit.**

### Task 3: Viewer – Bühne, Leiste, Editor (DOM)

**Files:**
- Modify: `server/public/index.html` (`#message` → `<section class="block message-block" data-block="warten"><p id="message" class="message">Warte auf ein Spiel</p><span class="handle handle-resize" data-handle="resize"></span></section>`)
- Modify: `server/public/style.css` (Sichtbarkeit, Textblock ohne eigenes Zentrieren)
- Modify: `server/public/js/app.js` (Text nicht mehr setzen; nach Vorschauwechsel `editor.reselect()`)
- Modify: `server/public/js/editor.js` (Anker Mitte für `CENTERED_BLOCKS`; `reselect()` = `selectVisible` exportieren)
- Modify: `server/public/js/settings.js` (`preview.vorschau`, `onVorschau`, in `editing()`; beim Öffnen auf `"spiel"`)
- Modify: `server/public/js/settings-panel.js` (Feld „Vorschau“ mit Segmenten Spiel | Warten über den Kästen; `render({ vorschau })` markiert das aktive)

- [ ] **Step 1: CSS-Regeln**
  - Bisher `.viewer:not([data-phase="playing"]) .block { visibility: hidden }` bleibt; Ausnahmen:
    `.viewer[data-phase="idle"][data-scheibe="on"][data-scheibe-beimwarten="on"] [data-block="scheibe"]` und `.viewer[data-phase="idle"][data-warten="on"] [data-block="warten"]` → `visibility: visible`.
  - `.viewer[data-phase="playing"] [data-block="warten"]` unsichtbar; `.message` ohne `position/left/top/transform` (die macht jetzt layout-view).
- [ ] **Step 2: Editor** – beim Ziehen am Eckgriff Anker = Mitte des Rechtecks, wenn `CENTERED_BLOCKS.includes(id)`; Verschieben unverändert (x/y sind dann die Mitte).
- [ ] **Step 3: Leiste/Settings** – Umschalter; `setVorschau(v)` wie `setPlayers` (announce, refresh, onChange) und danach `editor.reselect()`.
- [ ] **Step 4: `npx vitest run`** – grün.
- [ ] **Step 5: Browser-Prüfung** (Playwright, lokal `npx tsx src/index.ts`, Profile vorher sichern): ohne Leiste idle → nur Text mittig; `beimWarten` an → Scheibe an Profil-Lage; Scheibe aus → keine Scheibe; Vorschau *Warten* → Text ziehen und skalieren (bleibt mittig), Pfeile; Spielinfo ausgewählt + Umschalten → Auswahl springt; zweites Fenster folgt; „Fertig“ → zurück; Vorschau *Spiel* wie bisher, Text unsichtbar.
- [ ] **Step 6: Commit** „Warte-Bildschirm: Scheibe beim Warten, Text verschieb- und skalierbar, Vorschau Spiel | Warten in der Leiste“.

### Task 4: Abschluss

- [ ] Review des ganzen Stands gegen die Spec, Funde beheben.
- [ ] Nach Arnolds „ja“: Push, Pi sichern (`tar czf ~/profiles-vor-<commit>.tgz profiles`), Update-Knopf/`/api/system/update`, `git log -1` + `systemctl is-active raspdarts` prüfen.
