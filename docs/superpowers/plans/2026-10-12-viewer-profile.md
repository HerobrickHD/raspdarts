# Viewer-Profile – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Viewer bekommt Profile auf dem Pi (eins aktiv für alle Geräte). Im Viewer öffnet „Einstellungen“ eine Seitenleiste, in der man Profil, Vorlage und Inhalte (Checkbox-Liste aus einem Katalog) wählt und danach das Layout ausrichtet; die Scheibe rastet beim Drehen bei 0°/±90°/180° ein.

**Architecture:** Ein Katalog (`catalog.ts`) beschreibt alle Bausteine, Optionen und Vorlagen als Daten. Der Pi prüft jedes Profil dagegen (`profile.ts`), speichert Profile atomar in `data/profiles/` (`profile-store.ts`) und schickt Katalog, Spielstand und aktives Profil über `/ws` an alle Viewer (`display-hub.ts`). Der Viewer setzt die Inhalte als `data-*`-Merkmale an `#viewer` (CSS blendet aus), baut die Seitenleiste aus dem Katalog (`settings-panel.js`) und schickt Änderungen gedrosselt per `PUT /api/profiles/:id` (`profile-sync.js`).

**Tech Stack:** Server: TypeScript, Fastify 5, @fastify/websocket, Vitest. Viewer: HTML, CSS, SVG und ES-Module ohne Build-Schritt (`server/public/`).

**Spec:** `docs/superpowers/specs/2026-10-12-viewer-profile-design.md`

## Global Constraints

- Code-Kommentare deutsch ohne Umlaute; Texte in der Oberfläche und Labels im Katalog mit Umlauten.
- Viewer bleibt HTML/CSS/ES-Module ohne Build-Schritt in `server/public/`.
- Jeder Aufruf unter `/api/` braucht den Header `X-Raspdarts: 1`.
- Profil-id: `^[a-z0-9][a-z0-9-]{0,31}$`, vom Pi aus dem Namen vergeben, ändert sich beim Umbenennen nicht; `active` ist reserviert (Datei `active.json`).
- Name: getrimmt, länger als 40 Zeichen wird gekürzt, leer → „Profil“.
- Profil-Datei `data/profiles/<id>.json` mit `version: 3`; aktives Profil in `data/profiles/active.json` als `{ "id": "<id>" }`.
- Speichern gebündelt (höchstens alle 500 ms) und atomar (`<datei>.tmp` schreiben, dann umbenennen).
- Viewer sendet höchstens alle 100 ms; die letzte Änderung geht immer raus.
- `editing`: `"inhalte"`, `"layout"` oder `null`; fällt nach 60 s ohne Meldung zurück; der Viewer meldet sich alle 30 s, solange eingestellt wird; ein Wechsel des aktiven Profils beendet es.
- Einrasten: Winkel −180, −90, 0, 90, 180; Abstand **weniger als 3°**; mit Alt frei; Tastatur (Q/E) rastet nie ein.
- Vorlage = Startpunkt; wird nicht im Profil gespeichert.
- Es gibt immer mindestens ein Profil; das letzte lässt sich nicht löschen.
- Autodarts wird nicht angefasst; die Extension bleibt unverändert.
- Python ist nicht installiert; Hilfsskripte in Node oder Bash.
- Tests: `cd server && npm test && npm run typecheck`.

## Review Focus

1. **Update auf dem Pi mit vorhandenem `data/layouts/standard.json`:** Das ausgerichtete Layout muss danach im Profil „Standard“ unverändert sein. → Task 8, Schritt „Update auf dem Pi prüfen“ (Werte vorher sichern und vergleichen).
2. **Schnelles Klicken mehrerer Checkboxen hintereinander:** Der zuletzt gesetzte Stand gewinnt, kein Häkchen springt zurück. → Task 7, Browser-Prüfung Punkt 3.
3. **Esc bei offenem Formular oder offener Rückfrage in der Seitenleiste:** schließt nur das Formular bzw. die Rückfrage, nicht die Leiste. → Task 7, Browser-Prüfung Punkt 6.
4. **Ein anderes Gerät wechselt oder löscht das Profil, während hier die Leiste offen ist:** Die Leiste folgt, und Änderungen landen im neuen aktiven Profil, nicht im gelöschten. → Task 7, Browser-Prüfung Punkt 7.
5. **Alte Kiosk-Adresse `?display=beamer`:** Sie zeigt weiter das aktive Profil statt eines Fehlers. → Task 4, Test „/ws … auch bei alter Adresse mit ?display=“; Task 8, Browser-Prüfung.

---

## Dateiübersicht

| Datei | Aufgabe |
|---|---|
| `server/src/viewer/catalog.ts` (neu) | Bausteine, Optionen, Vorlagen; `defaultContent`, `sanitizeContent`, `templateContent` |
| `server/src/viewer/layout.ts` | ohne `version`/`boardMode`, Block `kopf` → `spielinfo`, `fromLegacyLayout` |
| `server/src/viewer/profile.ts` (neu) | Profil-Typ, `sanitizeProfile`, `newProfile`, Name, id |
| `server/src/viewer/profile-store.ts` (neu, ersetzt `layout-store.ts`) | Profile laden, ändern, löschen, aktiv; Übernahme; atomar speichern |
| `server/src/viewer/display-hub.ts` | Katalog/Stand/Profil an alle; `editing` global |
| `server/src/http.ts`, `runtime.ts`, `index.ts` | Profil-Endpunkte, `/ws` ohne Anzeigename |
| `server/public/js/profile-api.js` (neu) | `fetch` mit Header und Fehlermeldung |
| `server/public/js/profile-sync.js` (neu) | gedrosseltes `PUT /api/profiles/:id` |
| `server/public/js/content-view.js` (neu) | Inhalte → `data-*`-Merkmale |
| `server/public/js/rotation.js` (neu) | `snapRotation` |
| `server/public/js/settings-panel.js` (neu) | Seitenleiste Schritt „Inhalte“ (DOM) |
| `server/public/js/settings.js` (neu) | Knopf, Schritte, Aufrufe an den Pi |
| `server/public/js/editor.js` | Schritt „Layout“, über Profile, Einrasten |
| `server/public/js/app.js`, `blocks.js`, `index.html`, `style.css` | Zeichnen nach Profil, Seitenleiste, Hintergrund |
| `server/public/js/display-name.js` | gelöscht |
| Tests: `catalog`, `layout`, `profile`, `profile-store`, `display-hub`, `http`, `ingest-e2e`, `helpers`, `content-view`, `profile-sync`, `rotation` | |
| `README.md` | Kiosk-Adresse, API, Abschnitt Einstellungen |

Arbeit auf Branch `viewer-profile` ab `main`. Alle Befehle aus `server/`, sofern nicht anders angegeben.

---

### Task 1: Katalog

**Files:**
- Create: `server/src/viewer/catalog.ts`
- Test: `server/test/catalog.test.ts`

**Interfaces:**
- Produces:
  - `type Option = ToggleOption | ChoiceOption` (`{ id, label, type: "toggle", default: boolean }` / `{ id, label, type: "choice", choices: { id, label }[], default: string }`)
  - `interface Part { id: string; label: string; default: boolean; options: Option[] }`
  - `interface PartContent { on: boolean; [option: string]: boolean | string }`
  - `type Content = Record<string, PartContent>`
  - `interface Template { id: string; label: string; content: ContentPatch }`, `interface Catalog { parts: Part[]; templates: Template[] }`
  - `const CATALOG: Catalog`, `const DEFAULT_TEMPLATE = "projektion"`
  - `defaultContent(): Content`
  - `sanitizeContent(stored: unknown, fallback?: Content): Content`
  - `templateContent(id: unknown): Content | null`

- [ ] **Step 1: Branch anlegen**

```bash
cd /c/Projekte/raspdarts && git switch -c viewer-profile
```

- [ ] **Step 2: Failing Test schreiben** – `server/test/catalog.test.ts`

```ts
import { describe, expect, test } from "vitest";
import {
  CATALOG,
  DEFAULT_TEMPLATE,
  defaultContent,
  sanitizeContent,
  templateContent,
} from "../src/viewer/catalog.js";

describe("Katalog", () => {
  test("Ids sind eindeutig, keine Option heisst 'on'", () => {
    const parts = CATALOG.parts.map((p) => p.id);
    expect(new Set(parts).size).toBe(parts.length);
    for (const part of CATALOG.parts) {
      const options = part.options.map((o) => o.id);
      expect(new Set(options).size, part.id).toBe(options.length);
      expect(options, part.id).not.toContain("on");
    }
    const templates = CATALOG.templates.map((t) => t.id);
    expect(new Set(templates).size).toBe(templates.length);
    expect(templates).toContain(DEFAULT_TEMPLATE);
  });

  test("Vorlagen nennen nur Bausteine und Optionen, die es gibt, mit gueltigen Werten", () => {
    for (const template of CATALOG.templates) {
      for (const [partId, values] of Object.entries(template.content)) {
        const part = CATALOG.parts.find((p) => p.id === partId);
        expect(part, `${template.id}.${partId}`).toBeDefined();
        for (const [key, value] of Object.entries(values)) {
          if (key === "on") {
            expect(typeof value, `${template.id}.${partId}.on`).toBe("boolean");
            continue;
          }
          const option = part!.options.find((o) => o.id === key);
          expect(option, `${template.id}.${partId}.${key}`).toBeDefined();
          if (option!.type === "toggle") expect(typeof value).toBe("boolean");
          else expect(option!.choices.map((c) => c.id)).toContain(value);
        }
      }
    }
  });
});

describe("defaultContent", () => {
  test("enthaelt jeden Baustein mit an/aus und jeder Option", () => {
    const content = defaultContent();
    for (const part of CATALOG.parts) {
      expect(content[part.id]?.on, part.id).toBe(part.default);
      for (const option of part.options) {
        expect(content[part.id]?.[option.id], `${part.id}.${option.id}`).toBe(option.default);
      }
    }
  });

  test("Vorgaben wie in der Spec", () => {
    const c = defaultContent();
    expect(c["hintergrund"]).toEqual({ on: false });
    expect(c["scheibe"]).toEqual({ on: true, darstellung: "light", zahlenring: true, darts: true, letzterDart: true });
    expect(c["aufnahme"]).toEqual({ on: true, darts: true, summe: true });
    expect(c["spielinfo"]).toEqual({ on: true, punktzahl: true, legs: true, modus: true });
    expect(c["spieler"]).toEqual({
      on: true,
      flaeche: true,
      profilbild: true,
      name: true,
      flagge: true,
      rest: true,
      legs: true,
      checkout: true,
      average: true,
      dartzahl: true,
    });
  });

  test("liefert jedes Mal eine eigene Kopie", () => {
    const a = defaultContent();
    a["scheibe"]!.on = false;
    expect(defaultContent()["scheibe"]?.on).toBe(true);
  });
});

describe("templateContent", () => {
  test("Projektion: ohne Zahlenring und ohne Spielinfo, sonst Vorgaben", () => {
    const c = templateContent("projektion")!;
    expect(c["hintergrund"]?.on).toBe(false);
    expect(c["scheibe"]).toMatchObject({ on: true, darstellung: "light", zahlenring: false });
    expect(c["spielinfo"]?.on).toBe(false);
    expect(c["spieler"]?.profilbild).toBe(true);
  });

  test("Fernseher: Hintergrund an, Scheibe gezeichnet", () => {
    const c = templateContent("fernseher")!;
    expect(c["hintergrund"]?.on).toBe(true);
    expect(c["scheibe"]).toMatchObject({ darstellung: "drawn", zahlenring: true });
    expect(c["spielinfo"]?.on).toBe(true);
  });

  test("Minimal: nur Karten mit Flaeche, Name und Rest", () => {
    const c = templateContent("minimal")!;
    expect(c["aufnahme"]?.on).toBe(false);
    expect(c["spielinfo"]?.on).toBe(false);
    expect(c["spieler"]).toEqual({
      on: true,
      flaeche: true,
      profilbild: false,
      name: true,
      flagge: false,
      rest: true,
      legs: false,
      checkout: false,
      average: false,
      dartzahl: false,
    });
  });

  test("unbekannte Vorlage ergibt null", () => {
    expect(templateContent("disco")).toBeNull();
    expect(templateContent(undefined)).toBeNull();
  });
});

describe("sanitizeContent", () => {
  test("Unbrauchbares ergibt die Vorgaben", () => {
    for (const stored of [null, "kaputt", 42, []]) expect(sanitizeContent(stored)).toEqual(defaultContent());
  });

  test("verwirft unbekannte Bausteine und Optionen", () => {
    const c = sanitizeContent({ disco: { on: true }, scheibe: { glitzer: true } });
    expect(c).not.toHaveProperty("disco");
    expect(c["scheibe"]).not.toHaveProperty("glitzer");
  });

  test("falsch getypte Werte und ungueltige Auswahl bekommen die Vorgabe", () => {
    const c = sanitizeContent({ scheibe: { on: "ja", darstellung: "disco", darts: 1 }, spieler: { name: "nein" } });
    expect(c["scheibe"]).toMatchObject({ on: true, darstellung: "light", darts: true });
    expect(c["spieler"]?.name).toBe(true);
  });

  test("uebernimmt gueltige Werte", () => {
    const c = sanitizeContent({ hintergrund: { on: true }, scheibe: { darstellung: "lines", zahlenring: false } });
    expect(c["hintergrund"]?.on).toBe(true);
    expect(c["scheibe"]).toMatchObject({ darstellung: "lines", zahlenring: false });
  });

  test("fehlende Werte kommen aus dem mitgegebenen Stand statt aus den Vorgaben", () => {
    const base = templateContent("fernseher")!;
    const c = sanitizeContent({ spieler: { average: false } }, base);
    expect(c["spieler"]?.average).toBe(false);
    expect(c["scheibe"]?.darstellung).toBe("drawn");
    expect(c["hintergrund"]?.on).toBe(true);
  });
});
```

- [ ] **Step 3: Test laufen lassen – muss fehlschlagen**

Run: `npx vitest run test/catalog.test.ts`
Expected: FAIL, „Failed to resolve import ../src/viewer/catalog.js“.

- [ ] **Step 4: Implementieren** – `server/src/viewer/catalog.ts`

```ts
/**
 * Katalog: alle Bausteine des Viewers, ihre Optionen und die Vorlagen.
 *
 * Die einzige Stelle, an der Optionen beschrieben werden. Der Pi prueft jedes
 * Profil dagegen und schickt den Katalog an den Viewer, der daraus die
 * Checkbox-Liste baut. Eine neue Option braucht hier einen Eintrag und im
 * Viewer ihre Wirkung (meist eine CSS-Regel auf data-<baustein>-<option>).
 *
 * Alte Profile bleiben gueltig: Fehlende Optionen bekommen beim Lesen die
 * Vorgabe.
 */

export interface ToggleOption {
  id: string;
  label: string;
  type: "toggle";
  default: boolean;
}

export interface ChoiceOption {
  id: string;
  label: string;
  type: "choice";
  choices: { id: string; label: string }[];
  default: string;
}

export type Option = ToggleOption | ChoiceOption;

export interface Part {
  id: string;
  label: string;
  /** an/aus */
  default: boolean;
  /** Einzelteile, in der Liste aufgeklappt sichtbar */
  options: Option[];
}

export interface PartContent {
  on: boolean;
  [option: string]: boolean | string;
}

export type Content = Record<string, PartContent>;
export type ContentPatch = Record<string, Record<string, boolean | string>>;

export interface Template {
  id: string;
  label: string;
  /** Nur die Abweichungen von den Vorgaben. */
  content: ContentPatch;
}

export interface Catalog {
  parts: Part[];
  templates: Template[];
}

const toggle = (id: string, label: string, value = true): ToggleOption => ({
  id,
  label,
  type: "toggle",
  default: value,
});

export const CATALOG: Catalog = {
  parts: [
    { id: "hintergrund", label: "Hintergrund", default: false, options: [] },
    {
      id: "scheibe",
      label: "Scheibe",
      default: true,
      options: [
        {
          id: "darstellung",
          label: "Darstellung",
          type: "choice",
          choices: [
            { id: "light", label: "Nur Licht" },
            { id: "drawn", label: "Gezeichnet" },
            { id: "lines", label: "Linien" },
          ],
          default: "light",
        },
        toggle("zahlenring", "Zahlenring"),
        toggle("darts", "Darts einzeichnen"),
        toggle("letzterDart", "Letzten Dart leuchten"),
      ],
    },
    {
      id: "aufnahme",
      label: "Aufnahme",
      default: true,
      options: [toggle("darts", "Darts"), toggle("summe", "Summe")],
    },
    {
      id: "spielinfo",
      label: "Spielinfo",
      default: true,
      options: [toggle("punktzahl", "Punktzahl"), toggle("legs", "Legs/Sets"), toggle("modus", "Modus")],
    },
    {
      id: "spieler",
      label: "Spielerkarten",
      default: true,
      options: [
        toggle("flaeche", "Kartenfläche"),
        toggle("profilbild", "Profilbild"),
        toggle("name", "Name"),
        toggle("flagge", "Flagge"),
        toggle("rest", "Rest"),
        toggle("legs", "Legs"),
        toggle("checkout", "Checkout-Weg"),
        toggle("average", "Average"),
        toggle("dartzahl", "Dartzahl"),
      ],
    },
  ],
  templates: [
    {
      id: "projektion",
      label: "Projektion",
      content: { scheibe: { zahlenring: false }, spielinfo: { on: false } },
    },
    {
      id: "fernseher",
      label: "Fernseher",
      content: { hintergrund: { on: true }, scheibe: { darstellung: "drawn" } },
    },
    {
      id: "minimal",
      label: "Minimal",
      content: {
        aufnahme: { on: false },
        spielinfo: { on: false },
        spieler: {
          profilbild: false,
          flagge: false,
          legs: false,
          checkout: false,
          average: false,
          dartzahl: false,
        },
      },
    },
  ],
};

/** Vorlage fuer neue Profile ohne (gueltige) Wahl und fuer die Uebernahme. */
export const DEFAULT_TEMPLATE = "projektion";

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;

function partDefaults(part: Part): PartContent {
  const value: PartContent = { on: part.default };
  for (const option of part.options) value[option.id] = option.default;
  return value;
}

export function defaultContent(): Content {
  return Object.fromEntries(CATALOG.parts.map((part) => [part.id, partDefaults(part)]));
}

function isValid(option: Option, raw: unknown): raw is boolean | string {
  return option.type === "toggle"
    ? typeof raw === "boolean"
    : typeof raw === "string" && option.choices.some((choice) => choice.id === raw);
}

/**
 * Macht aus beliebigem gespeichertem Inhalt gueltige Inhalte.
 *
 * Der Inhalt kommt aus dem Browser und aus einer von Hand editierbaren Datei -
 * deshalb wird jede Option einzeln geprueft. Was fehlt oder nicht passt, kommt
 * aus `fallback` (beim Aendern: der bisherige Stand), sonst aus den Vorgaben.
 */
export function sanitizeContent(stored: unknown, fallback: Content = defaultContent()): Content {
  const source = asRecord(stored);
  const content: Content = {};
  for (const part of CATALOG.parts) {
    const given = asRecord(source[part.id]);
    const base = fallback[part.id] ?? partDefaults(part);
    const on = given["on"];
    const value: PartContent = { on: typeof on === "boolean" ? on : base.on };
    for (const option of part.options) {
      const raw = given[option.id];
      value[option.id] = isValid(option, raw) ? raw : (base[option.id] ?? option.default);
    }
    content[part.id] = value;
  }
  return content;
}

/** Inhalte einer Vorlage; null, wenn es sie nicht gibt. */
export function templateContent(id: unknown): Content | null {
  const template = CATALOG.templates.find((t) => t.id === id);
  return template ? sanitizeContent(template.content) : null;
}
```

- [ ] **Step 5: Test laufen lassen – muss bestehen**

Run: `npx vitest run test/catalog.test.ts && npm run typecheck`
Expected: PASS, keine Typfehler.

- [ ] **Step 6: Commit**

```bash
git add src/viewer/catalog.ts test/catalog.test.ts
git commit -m "Viewer-Profile: Katalog mit Bausteinen, Optionen und Vorlagen"
```

---

### Task 2: Layout ohne Darstellung, Profil-Modell

**Files:**
- Modify: `server/src/viewer/layout.ts` (ganz ersetzen)
- Create: `server/src/viewer/profile.ts`
- Test: `server/test/layout.test.ts` (ganz ersetzen), `server/test/profile.test.ts`

**Interfaces:**
- Consumes: `sanitizeContent`, `templateContent`, `DEFAULT_TEMPLATE`, `Content` aus Task 1.
- Produces:
  - `layout.ts`: `BLOCK_IDS` (`"spielinfo"`, `"aufnahme"`, `"spieler-1"` … `"spieler-6"`), `interface DisplayLayout { board: BoardLayout; blocks: Record<BlockId, BlockLayout> }`, `DEFAULT_LAYOUT`, `sanitizeLayout(stored: unknown): DisplayLayout`, `type LegacyBoardMode = "light" | "drawn"`, `fromLegacyLayout(stored: unknown): { layout: DisplayLayout; boardMode: LegacyBoardMode } | null`
  - `profile.ts`: `PROFILE_VERSION = 3`, `MAX_NAME_LENGTH = 40`, `FALLBACK_NAME = "Profil"`, `VALID_ID`, `interface Profile { version: 3; name: string; content: Content; layout: DisplayLayout }`, `interface ProfileWithId extends Profile { id: string }`, `interface ProfileSummary { id: string; name: string }`, `sanitizeName(raw: unknown): string`, `newProfile(name: unknown, template?: unknown): Profile`, `sanitizeProfile(stored: unknown): Profile`, `slugify(name: string): string`, `uniqueId(name: string, taken: (id: string) => boolean): string`

Hinweis: `layout-store.ts` und seine Tests benutzen `DEFAULT_LAYOUT` mit `version`/`boardMode` und laufen nach diesem Task rot. Das ist erwartet, sie werden in Task 4 gelöscht. In Schritt 5 laufen deshalb nur die Tests dieses Tasks. Der Typcheck läuft erst in Task 4 wieder sauber.

- [ ] **Step 1: Failing Tests schreiben**

`server/test/layout.test.ts` (ganz ersetzen):

```ts
import { describe, expect, test } from "vitest";
import { BLOCK_IDS, DEFAULT_LAYOUT, fromLegacyLayout, sanitizeLayout } from "../src/viewer/layout.js";

describe("sanitizeLayout", () => {
  test("liefert das Standard-Layout, wenn nichts Brauchbares da ist", () => {
    expect(sanitizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(sanitizeLayout("kaputt")).toEqual(DEFAULT_LAYOUT);
  });

  test("kennt genau die Bloecke des Viewers", () => {
    expect(BLOCK_IDS).toEqual([
      "spielinfo",
      "aufnahme",
      "spieler-1",
      "spieler-2",
      "spieler-3",
      "spieler-4",
      "spieler-5",
      "spieler-6",
    ]);
    expect(Object.keys(DEFAULT_LAYOUT.blocks)).toEqual(BLOCK_IDS);
  });

  test("Standard: Scheibe in der Mitte, Darstellung steht nicht mehr im Layout", () => {
    expect(DEFAULT_LAYOUT.board).toEqual({ cx: 50, cy: 51, diameter: 50, rotation: 0 });
    expect(DEFAULT_LAYOUT).not.toHaveProperty("boardMode");
    expect(DEFAULT_LAYOUT).not.toHaveProperty("version");
  });

  test("uebernimmt gespeicherte Werte", () => {
    const layout = sanitizeLayout({
      board: { cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 },
      blocks: { aufnahme: { x: 30, y: 2, scale: 1.4 } },
    });

    expect(layout.board).toEqual({ cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 });
    expect(layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(layout.blocks.spielinfo).toEqual(DEFAULT_LAYOUT.blocks.spielinfo);
  });

  test("begrenzt jeden Wert der Scheibe einzeln", () => {
    expect(sanitizeLayout({ board: { cx: -5, cy: 140, diameter: 900, rotation: 270 } }).board).toEqual({
      cx: 0,
      cy: 100,
      diameter: 400,
      rotation: 180,
    });
    expect(sanitizeLayout({ board: { diameter: 1, rotation: -999 } }).board).toMatchObject({
      diameter: 5,
      rotation: -180,
    });
  });

  test("ersetzt unbrauchbare Werte der Scheibe einzeln durch den Standard", () => {
    const layout = sanitizeLayout({ board: { cx: "mitte", cy: 40, diameter: null } });

    expect(layout.board).toEqual({ cx: 50, cy: 40, diameter: 50, rotation: 0 });
  });

  test("haelt Bloecke im Bild und begrenzt die Skalierung", () => {
    const layout = sanitizeLayout({
      blocks: { spielinfo: { x: -40, y: 250, scale: 0.01 }, "spieler-1": { x: 5, y: 5, scale: 99 } },
    });

    expect(layout.blocks.spielinfo).toEqual({ x: 0, y: 100, scale: 0.2 });
    expect(layout.blocks["spieler-1"].scale).toBe(4);
  });

  test("ignoriert unbekannte und unbrauchbare Bloecke", () => {
    const layout = sanitizeLayout({ blocks: { unbekannt: { x: 1, y: 1, scale: 1 }, spielinfo: { x: "links" } } });

    expect(layout.blocks).not.toHaveProperty("unbekannt");
    expect(layout.blocks.spielinfo).toEqual(DEFAULT_LAYOUT.blocks.spielinfo);
  });

  test("liefert jedes Mal eine eigene Kopie", () => {
    const a = sanitizeLayout(null);
    a.board.cx = 1;
    expect(sanitizeLayout(null).board.cx).toBe(50);
    expect(DEFAULT_LAYOUT.board.cx).toBe(50);
  });
});

describe("fromLegacyLayout", () => {
  test("liest alte Dateien mit version 2: kopf wird spielinfo, boardMode kommt mit", () => {
    const legacy = fromLegacyLayout({
      version: 2,
      boardMode: "drawn",
      board: { cx: 40, cy: 45, diameter: 80, rotation: 1.5 },
      blocks: { kopf: { x: 5, y: 6, scale: 1.2 }, aufnahme: { x: 30, y: 2, scale: 1.4 } },
    });

    expect(legacy?.boardMode).toBe("drawn");
    expect(legacy?.layout.board).toEqual({ cx: 40, cy: 45, diameter: 80, rotation: 1.5 });
    expect(legacy?.layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(legacy?.layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(legacy?.layout).not.toHaveProperty("boardMode");
    expect(legacy?.layout.blocks).not.toHaveProperty("kopf");
  });

  test("ohne oder mit unbekanntem boardMode gilt Nur Licht", () => {
    expect(fromLegacyLayout({ version: 2 })?.boardMode).toBe("light");
    expect(fromLegacyLayout({ version: 2, boardMode: "disco" })?.boardMode).toBe("light");
  });

  test("alles ohne version 2 ist kein altes Layout", () => {
    expect(fromLegacyLayout(null)).toBeNull();
    expect(fromLegacyLayout({})).toBeNull();
    expect(fromLegacyLayout({ version: 1, board: {} })).toBeNull();
  });
});
```

`server/test/profile.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { templateContent } from "../src/viewer/catalog.js";
import { DEFAULT_LAYOUT } from "../src/viewer/layout.js";
import {
  VALID_ID,
  newProfile,
  sanitizeName,
  sanitizeProfile,
  slugify,
  uniqueId,
} from "../src/viewer/profile.js";

describe("sanitizeName", () => {
  test.each([
    ["  Beamer  ", "Beamer"],
    ["", "Profil"],
    ["   ", "Profil"],
    [42, "Profil"],
    [null, "Profil"],
  ])("%j → %s", (raw, name) => {
    expect(sanitizeName(raw)).toBe(name);
  });

  test("kuerzt lange Namen auf 40 Zeichen", () => {
    expect(sanitizeName("x".repeat(60))).toBe("x".repeat(40));
  });
});

describe("newProfile", () => {
  test("belegt die Inhalte aus der Vorlage vor, Layout ist der Standard", () => {
    expect(newProfile("TV", "fernseher")).toEqual({
      version: 3,
      name: "TV",
      content: templateContent("fernseher"),
      layout: DEFAULT_LAYOUT,
    });
  });

  test("ohne oder mit unbekannter Vorlage gilt Projektion", () => {
    expect(newProfile("A").content).toEqual(templateContent("projektion"));
    expect(newProfile("A", "disco").content).toEqual(templateContent("projektion"));
  });
});

describe("sanitizeProfile", () => {
  test("ohne version 3 entsteht ein Profil aus Projektion; ein Name bleibt", () => {
    expect(sanitizeProfile({ name: "Alt", meta: {} })).toEqual(newProfile("Alt"));
    expect(sanitizeProfile(null)).toEqual(newProfile("Profil"));
  });

  test("prueft Name, Inhalte und Layout einzeln", () => {
    const profile = sanitizeProfile({
      version: 3,
      name: "  TV ",
      content: { hintergrund: { on: true }, disco: {} },
      layout: { board: { cx: 140 } },
    });

    expect(profile.name).toBe("TV");
    expect(profile.content["hintergrund"]?.on).toBe(true);
    expect(profile.content).not.toHaveProperty("disco");
    expect(profile.layout.board.cx).toBe(100);
  });
});

describe("slugify", () => {
  test.each([
    ["Beamer auf Scheibe", "beamer-auf-scheibe"],
    ["Fernseher Küche", "fernseher-kueche"],
    ["Größe ÄÖÜ", "groesse-aeoeue"],
    ["  --TV--  ", "tv"],
    ["!!!", "profil"],
    ["", "profil"],
  ])("%s → %s", (name, id) => {
    expect(slugify(name)).toBe(id);
  });

  test("bleibt kurz genug fuer das id-Muster", () => {
    const id = slugify("Ein sehr langer Profilname mit vielen Woertern darin");
    expect(id.length).toBeLessThanOrEqual(32);
    expect(VALID_ID.test(id)).toBe(true);
  });
});

describe("uniqueId", () => {
  test("haengt bei Doppelung -2, -3 an", () => {
    const taken = new Set(["tv", "tv-2"]);
    expect(uniqueId("TV", (id) => taken.has(id))).toBe("tv-3");
    expect(uniqueId("Neu", (id) => taken.has(id))).toBe("neu");
  });

  test("auch lange Namen mit Zaehler passen ins Muster", () => {
    const long = "a".repeat(40);
    const id = uniqueId(long, (candidate) => candidate === slugify(long));
    expect(id).toBe(`${"a".repeat(30)}-2`);
    expect(VALID_ID.test(id)).toBe(true);
  });
});
```

- [ ] **Step 2: Tests laufen lassen – müssen fehlschlagen**

Run: `npx vitest run test/layout.test.ts test/profile.test.ts`
Expected: FAIL (`fromLegacyLayout` fehlt, `profile.js` nicht auflösbar, `spielinfo` unbekannt).

- [ ] **Step 3: `server/src/viewer/layout.ts` ganz ersetzen**

```ts
/**
 * Das Layout eines Profils: wo die Scheibe und jeder Baustein sitzt und wie
 * gross er ist. Was angezeigt wird (und wie die Scheibe aussieht), steht in den
 * Inhalten des Profils (catalog.ts), nicht hier.
 *
 * Positionen sind Prozentwerte der Bildflaeche, Groessen haengen an der
 * Bildhoehe - keine Pixel. Ein eingerichtetes Layout passt dadurch auch nach
 * einem Aufloesungswechsel des Beamers noch.
 */

export const PLAYER_BLOCKS = [
  "spieler-1",
  "spieler-2",
  "spieler-3",
  "spieler-4",
  "spieler-5",
  "spieler-6",
] as const;
export const BLOCK_IDS = ["spielinfo", "aufnahme", ...PLAYER_BLOCKS] as const;
export type BlockId = (typeof BLOCK_IDS)[number];

export interface BlockLayout {
  /** Linke obere Ecke, Prozent der Breite. */
  x: number;
  /** Prozent der Hoehe. */
  y: number;
  /** Relativ zur Grundgroesse des Bausteins. */
  scale: number;
}

export interface BoardLayout {
  /** Mittelpunkt, Prozent der Breite. */
  cx: number;
  /** Mittelpunkt, Prozent der Hoehe. */
  cy: number;
  /** Durchmesser des Double-Rings (340 mm), Prozent der Hoehe. */
  diameter: number;
  /** Grad, im Uhrzeigersinn. */
  rotation: number;
}

export interface DisplayLayout {
  board: BoardLayout;
  blocks: Record<BlockId, BlockLayout>;
}

export const DEFAULT_LAYOUT: DisplayLayout = {
  board: { cx: 50, cy: 51, diameter: 50, rotation: 0 },
  blocks: {
    spielinfo: { x: 2, y: 3, scale: 1 },
    aufnahme: { x: 32.5, y: 3.8, scale: 1 },
    "spieler-1": { x: 1.4, y: 32.7, scale: 1 },
    "spieler-2": { x: 71, y: 32.7, scale: 1 },
    "spieler-3": { x: 1.4, y: 68, scale: 0.45 },
    "spieler-4": { x: 85.5, y: 68, scale: 0.45 },
    "spieler-5": { x: 1.4, y: 84, scale: 0.45 },
    "spieler-6": { x: 85.5, y: 84, scale: 0.45 },
  },
};

const LIMITS = {
  position: [0, 100],
  scale: [0.2, 4],
  diameter: [5, 400],
  rotation: [-180, 180],
} as const;

const clamp = (value: number, [min, max]: readonly [number, number]): number =>
  Math.min(max, Math.max(min, value));

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;

/** Ein Wert der Scheibe: begrenzt, oder bei Unbrauchbarem der Standard. */
function boardValue(v: unknown, fallback: number, limits: readonly [number, number]): number {
  return isNumber(v) ? clamp(v, limits) : fallback;
}

function sanitizeBlock(stored: unknown, fallback: BlockLayout): BlockLayout {
  const { x, y, scale } = asRecord(stored);
  if (!isNumber(x) || !isNumber(y) || !isNumber(scale)) return { ...fallback };
  return {
    x: clamp(x, LIMITS.position),
    y: clamp(y, LIMITS.position),
    scale: clamp(scale, LIMITS.scale),
  };
}

/**
 * Macht aus beliebigem gespeichertem Inhalt ein brauchbares Layout.
 *
 * Der Inhalt kommt aus dem Browser und aus einer von Hand editierbaren Datei -
 * deshalb wird nichts geglaubt. Jeder Wert wird einzeln geprueft; eine kaputte
 * Datei darf den Viewer nie unbedienbar machen.
 */
export function sanitizeLayout(stored: unknown): DisplayLayout {
  const fresh = structuredClone(DEFAULT_LAYOUT);
  const source = asRecord(stored);
  const board = asRecord(source["board"]);
  const blocks = asRecord(source["blocks"]);

  const defaults = DEFAULT_LAYOUT.board;
  fresh.board = {
    cx: boardValue(board["cx"], defaults.cx, LIMITS.position),
    cy: boardValue(board["cy"], defaults.cy, LIMITS.position),
    diameter: boardValue(board["diameter"], defaults.diameter, LIMITS.diameter),
    rotation: boardValue(board["rotation"], defaults.rotation, LIMITS.rotation),
  };
  for (const id of BLOCK_IDS) {
    fresh.blocks[id] = sanitizeBlock(blocks[id], DEFAULT_LAYOUT.blocks[id]);
  }
  return fresh;
}

/** Darstellung der Scheibe in den alten Layout-Dateien. */
export type LegacyBoardMode = "light" | "drawn";

/**
 * Liest eine alte Layout-Datei (version 2, je Anzeigename, bis Oktober 2026).
 * Der Block "kopf" heisst jetzt "spielinfo"; boardMode wandert in die Inhalte
 * des Profils. null, wenn es keine alte Datei ist.
 */
export function fromLegacyLayout(
  stored: unknown,
): { layout: DisplayLayout; boardMode: LegacyBoardMode } | null {
  const source = asRecord(stored);
  if (source["version"] !== 2) return null;
  const blocks = { ...asRecord(source["blocks"]) };
  if (!("spielinfo" in blocks) && "kopf" in blocks) blocks["spielinfo"] = blocks["kopf"];
  return {
    layout: sanitizeLayout({ board: source["board"], blocks }),
    boardMode: source["boardMode"] === "drawn" ? "drawn" : "light",
  };
}
```

- [ ] **Step 4: `server/src/viewer/profile.ts` anlegen**

```ts
/**
 * Ein Profil: Name, was der Viewer zeigt (Inhalte, siehe catalog.ts) und wo
 * (Layout). Genau ein Profil ist aktiv; alle Geraete zeigen es.
 */
import { DEFAULT_TEMPLATE, sanitizeContent, templateContent, type Content } from "./catalog.js";
import { DEFAULT_LAYOUT, sanitizeLayout, type DisplayLayout } from "./layout.js";

export const PROFILE_VERSION = 3;
export const MAX_NAME_LENGTH = 40;
export const FALLBACK_NAME = "Profil";

/**
 * Die id ist zugleich der Dateiname. Ohne Pruefung liesse sich ueber "../"
 * eine beliebige Datei lesen oder ueberschreiben - deshalb nur schlichte Namen.
 */
export const VALID_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

export interface Profile {
  version: 3;
  name: string;
  content: Content;
  layout: DisplayLayout;
}

export interface ProfileWithId extends Profile {
  id: string;
}

export interface ProfileSummary {
  id: string;
  name: string;
}

export function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, MAX_NAME_LENGTH).trim() : "";
  return name || FALLBACK_NAME;
}

/** Neues Profil: Inhalte aus der Vorlage (unbekannt → Projektion), Standardlayout. */
export function newProfile(name: unknown, template: unknown = DEFAULT_TEMPLATE): Profile {
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(name),
    content: templateContent(template) ?? templateContent(DEFAULT_TEMPLATE) ?? sanitizeContent(null),
    layout: structuredClone(DEFAULT_LAYOUT),
  };
}

/** Macht aus beliebigem gespeichertem Inhalt ein brauchbares Profil. */
export function sanitizeProfile(stored: unknown): Profile {
  const source = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  if (source["version"] !== PROFILE_VERSION) return newProfile(source["name"]);
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(source["name"]),
    content: sanitizeContent(source["content"]),
    layout: sanitizeLayout(source["layout"]),
  };
}

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** id aus dem Namen: Kleinbuchstaben, Ziffern, Bindestrich, hoechstens 32 Zeichen. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "");
  return slug || "profil";
}

/** id aus dem Namen, bei Doppelung mit -2, -3 ... */
export function uniqueId(name: string, taken: (id: string) => boolean): string {
  const base = slugify(name);
  if (!taken(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const id = `${base.slice(0, 32 - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken(id)) return id;
  }
}
```

- [ ] **Step 5: Tests laufen lassen – müssen bestehen**

Run: `npx vitest run test/layout.test.ts test/profile.test.ts test/catalog.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/viewer/layout.ts src/viewer/profile.ts test/layout.test.ts test/profile.test.ts
git commit -m "Viewer-Profile: Profil-Modell, Layout ohne Darstellung, kopf heisst spielinfo"
```

---

### Task 3: Profilspeicher

**Files:**
- Create: `server/src/viewer/profile-store.ts`
- Test: `server/test/profile-store.test.ts`

**Interfaces:**
- Consumes: Task 1 (`sanitizeContent`, `templateContent`), Task 2 (`fromLegacyLayout`, `sanitizeLayout`, `newProfile`, `sanitizeName`, `sanitizeProfile`, `uniqueId`, `VALID_ID`, Typen).
- Produces:
  - `type ProfileErrorCode = "invalid-id" | "not-found" | "last-profile" | "invalid-template"`
  - `class ProfileError extends Error { readonly code: ProfileErrorCode }`
  - `interface ProfilePatch { name?: unknown; content?: unknown; layout?: unknown }`
  - `class ProfileStore` mit `constructor(dir: string, legacyDir?: string | null, flushDelayMs?: number)`, `get activeId(): string`, `list(): ProfileSummary[]` (nach Name), `read(id): ProfileWithId`, `active(): ProfileWithId`, `create(name: unknown, template: unknown): ProfileWithId` (wird aktiv), `update(id, patch: ProfilePatch): ProfileWithId`, `resetContent(id, template: unknown): ProfileWithId`, `remove(id): void`, `setActive(id): void`, `flush(): void`

- [ ] **Step 1: Failing Test schreiben** – `server/test/profile-store.test.ts`

```ts
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { templateContent } from "../src/viewer/catalog.js";
import { DEFAULT_LAYOUT } from "../src/viewer/layout.js";
import { ProfileError, ProfileStore } from "../src/viewer/profile-store.js";

let root: string;
let dir: string;
let legacy: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "profile-test-"));
  dir = join(root, "profiles");
  legacy = join(root, "layouts");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

const onDisk = (file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));

/** Fehlercode eines Aufrufs, oder null, wenn er nicht wirft. */
function errorCode(run: () => unknown): string | null {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ProfileError);
    return (error as ProfileError).code;
  }
  return null;
}

const LEGACY = {
  version: 2,
  boardMode: "drawn",
  board: { cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 },
  blocks: { kopf: { x: 5, y: 6, scale: 1.2 }, aufnahme: { x: 30, y: 2, scale: 1.4 } },
};

describe("erster Start", () => {
  test("ohne alte Datei entsteht Standard aus der Vorlage Projektion", () => {
    const store = new ProfileStore(dir, legacy);

    expect(store.list()).toEqual([{ id: "standard", name: "Standard" }]);
    expect(store.activeId).toBe("standard");
    expect(store.active()).toEqual({
      id: "standard",
      version: 3,
      name: "Standard",
      content: templateContent("projektion"),
      layout: DEFAULT_LAYOUT,
    });
    expect(onDisk("standard.json").name).toBe("Standard");
    expect(onDisk("active.json")).toEqual({ id: "standard" });
  });

  test("uebernimmt das bisher ausgerichtete Layout und die Darstellung", () => {
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "standard.json"), JSON.stringify(LEGACY));

    const profile = new ProfileStore(dir, legacy).active();

    expect(profile.layout.board).toEqual(LEGACY.board);
    expect(profile.layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(profile.layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(profile.content["scheibe"]?.darstellung).toBe("drawn");
    expect(profile.content["spielinfo"]?.on).toBe(false); // sonst wie Projektion
  });

  test("uebernimmt nur beim ersten Start", () => {
    const first = new ProfileStore(dir, legacy);
    first.update("standard", { name: "Beamer" });
    first.flush();
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "standard.json"), JSON.stringify(LEGACY));

    const profile = new ProfileStore(dir, legacy).active();

    expect(profile.name).toBe("Beamer");
    expect(profile.layout).toEqual(DEFAULT_LAYOUT);
  });

  test("ein leerer Ordner bekommt wieder Standard", () => {
    mkdirSync(dir, { recursive: true });

    expect(new ProfileStore(dir, legacy).list()).toEqual([{ id: "standard", name: "Standard" }]);
  });
});

describe("Profile", () => {
  test("legt aus Name und Vorlage an, vergibt die id und schaltet um", () => {
    const store = new ProfileStore(dir);

    const tv = store.create("Fernseher Küche", "fernseher");

    expect(tv).toMatchObject({ id: "fernseher-kueche", name: "Fernseher Küche", content: templateContent("fernseher") });
    expect(store.activeId).toBe("fernseher-kueche");
    expect(store.create("Fernseher Küche", "minimal").id).toBe("fernseher-kueche-2");
  });

  test("vergibt nie die id active (Datei active.json)", () => {
    expect(new ProfileStore(dir).create("Active", "minimal").id).toBe("active-2");
  });

  test("weist eine unbekannte Vorlage ab", () => {
    const store = new ProfileStore(dir);

    expect(errorCode(() => store.create("X", "disco"))).toBe("invalid-template");
    expect(store.list()).toHaveLength(1);
  });

  test("listet nach Name", () => {
    const store = new ProfileStore(dir);
    store.create("Zimmer", "minimal");
    store.create("Arbeit", "minimal");

    expect(store.list().map((p) => p.name)).toEqual(["Arbeit", "Standard", "Zimmer"]);
  });

  test("aendert nur, was mitgeschickt wird; die id bleibt beim Umbenennen", () => {
    const store = new ProfileStore(dir);
    const before = store.active();

    const after = store.update("standard", { name: "  Beamer  ", content: { hintergrund: { on: true } } });

    expect(after.id).toBe("standard");
    expect(after.name).toBe("Beamer");
    expect(after.content["hintergrund"]?.on).toBe(true);
    expect(after.content["spielinfo"]).toEqual(before.content["spielinfo"]);
    expect(after.layout).toEqual(before.layout);
  });

  test("prueft Layout und Inhalte; Unbrauchbares behaelt den bisherigen Wert", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { content: { scheibe: { darstellung: "drawn" } } });

    const after = store.update("standard", {
      layout: { board: { cx: -5 } },
      content: { scheibe: { darstellung: "disco" } },
    });

    expect(after.layout.board.cx).toBe(0);
    expect(after.content["scheibe"]?.darstellung).toBe("drawn");
  });

  test("setzt Inhalte auf eine Vorlage zurueck, das Layout bleibt", () => {
    const store = new ProfileStore(dir);
    const moved = { ...DEFAULT_LAYOUT, board: { cx: 40, cy: 45, diameter: 80, rotation: 1.5 } };
    store.update("standard", { layout: moved, content: { hintergrund: { on: true } } });

    const after = store.resetContent("standard", "minimal");

    expect(after.content).toEqual(templateContent("minimal"));
    expect(after.layout.board).toEqual(moved.board);
    expect(errorCode(() => store.resetContent("standard", "disco"))).toBe("invalid-template");
  });

  test("loescht samt Datei, aber nie das letzte; ein geloeschtes aktives macht das erste aktiv", () => {
    const store = new ProfileStore(dir);
    store.create("TV", "fernseher");
    store.flush();
    expect(existsSync(join(dir, "tv.json"))).toBe(true);

    store.remove("tv");

    expect(existsSync(join(dir, "tv.json"))).toBe(false);
    expect(store.activeId).toBe("standard");
    expect(errorCode(() => store.remove("standard"))).toBe("last-profile");
  });

  test("wechselt das aktive Profil; unbekannte und ungueltige ids werden abgewiesen", () => {
    const store = new ProfileStore(dir);
    store.create("TV", "fernseher");

    store.setActive("standard");

    expect(store.activeId).toBe("standard");
    expect(errorCode(() => store.setActive("gibtsnicht"))).toBe("not-found");
    expect(errorCode(() => store.read("../x"))).toBe("invalid-id");
    expect(errorCode(() => store.update("", {}))).toBe("invalid-id");
  });

  test("nach dem Neustart ist alles wieder da", () => {
    const store = new ProfileStore(dir);
    store.create("TV", "fernseher");
    store.update("tv", { content: { spieler: { average: false } } });
    store.setActive("standard");
    store.flush();

    const again = new ProfileStore(dir);

    expect(again.list()).toEqual([
      { id: "standard", name: "Standard" },
      { id: "tv", name: "TV" },
    ]);
    expect(again.activeId).toBe("standard");
    expect(again.read("tv").content["spieler"]?.average).toBe(false);
  });
});

describe("Speichern", () => {
  test("schreibt gebuendelt nach 500 ms", () => {
    vi.useFakeTimers();
    const store = new ProfileStore(dir);
    store.update("standard", { name: "A" });
    store.update("standard", { name: "B" });

    expect(onDisk("standard.json").name).toBe("Standard");
    vi.advanceTimersByTime(500);

    expect(onDisk("standard.json").name).toBe("B");
  });

  test("hinterlaesst keine eigenen temporaeren Dateien und ignoriert fremde", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "alt.json.tmp"), "{ halb");
    const store = new ProfileStore(dir);
    store.update("standard", { name: "B" });
    store.flush();

    expect(readdirSync(dir).sort()).toEqual(["active.json", "alt.json.tmp", "standard.json"]);
    expect(store.list()).toEqual([{ id: "standard", name: "B" }]);
  });

  test("eine kaputte Profildatei wird mit Vorgaben gelesen", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "tv.json"), "{ kein json");

    const store = new ProfileStore(dir);

    expect(store.read("tv")).toMatchObject({ name: "Profil", content: templateContent("projektion") });
  });

  test("kaputtes active.json: das erste Profil nach Name wird aktiv", () => {
    const first = new ProfileStore(dir);
    first.create("Arbeit", "minimal");
    first.setActive("standard");
    first.flush();
    writeFileSync(join(dir, "active.json"), "kaputt");

    expect(new ProfileStore(dir).activeId).toBe("arbeit");
  });

  test("laeuft weiter, wenn nicht gespeichert werden kann", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mkdirSync(root, { recursive: true });
    writeFileSync(dir, "ich bin eine Datei, kein Ordner");

    const store = new ProfileStore(dir);
    store.update("standard", { name: "B" });
    store.flush();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(store.active().name).toBe("B");
  });
});
```

- [ ] **Step 2: Test laufen lassen – muss fehlschlagen**

Run: `npx vitest run test/profile-store.test.ts`
Expected: FAIL, „Failed to resolve import ../src/viewer/profile-store.js“.

- [ ] **Step 3: Implementieren** – `server/src/viewer/profile-store.ts`

```ts
/**
 * Speichert die Viewer-Profile als JSON-Dateien und merkt sich das aktive.
 *
 * Bewusst beim Dienst und nicht im Browser: ein muehsam auf die Scheibe
 * ausgerichtetes Profil ueberlebt so das Leeren des Browser-Caches und eine
 * Neuinstallation, und alle Geraete zeigen dasselbe.
 *
 * Alle Profile liegen im Speicher (es sind wenige, jedes ein paar KB). Beim
 * Ausrichten kommen bis zu zehn Aenderungen pro Sekunde; die gelten sofort,
 * auf die SD-Karte geht es gebuendelt und atomar (erst .tmp, dann umbenennen),
 * damit ein Stromausfall nie eine halbe Datei hinterlaesst.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeContent, templateContent } from "./catalog.js";
import { fromLegacyLayout, sanitizeLayout } from "./layout.js";
import {
  VALID_ID,
  newProfile,
  sanitizeName,
  sanitizeProfile,
  uniqueId,
  type Profile,
  type ProfileSummary,
  type ProfileWithId,
} from "./profile.js";

export type ProfileErrorCode = "invalid-id" | "not-found" | "last-profile" | "invalid-template";

/** Fehler des Aufrufers; http.ts macht daraus 400/404/409. */
export class ProfileError extends Error {
  constructor(
    readonly code: ProfileErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface ProfilePatch {
  name?: unknown;
  content?: unknown;
  layout?: unknown;
}

const ACTIVE_FILE = "active.json";
/** Waere der Dateiname des aktiven Profils - als Profil-id gesperrt. */
const RESERVED_ID = "active";
const FIRST_ID = "standard";

export class ProfileStore {
  readonly #profiles = new Map<string, Profile>();
  readonly #pending = new Set<string>();
  #active = FIRST_ID;
  #activePending = false;
  #timer: NodeJS.Timeout | null = null;
  #warned = false;

  constructor(
    private readonly dir: string,
    legacyDir: string | null = null,
    private readonly flushDelayMs = 500,
  ) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error) {
      this.#warn(error as Error);
    }
    this.#load();
    if (this.#profiles.size === 0) this.#createFirst(legacyDir);
    this.#loadActive();
  }

  get activeId(): string {
    return this.#active;
  }

  /** Alle Profile nach Name. */
  list(): ProfileSummary[] {
    return [...this.#profiles]
      .map(([id, profile]) => ({ id, name: profile.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
  }

  read(id: string): ProfileWithId {
    return { id, ...structuredClone(this.#get(id)) };
  }

  active(): ProfileWithId {
    return this.read(this.#active);
  }

  /** Neues Profil aus einer Vorlage; es wird sofort aktiv. */
  create(name: unknown, template: unknown): ProfileWithId {
    if (templateContent(template) === null) {
      throw new ProfileError("invalid-template", "Unbekannte Vorlage");
    }
    const profile = newProfile(name, template);
    const id = uniqueId(profile.name, (candidate) => candidate === RESERVED_ID || this.#profiles.has(candidate));
    this.#profiles.set(id, profile);
    this.#markDirty(id);
    this.#setActive(id);
    return this.read(id);
  }

  /** Aendert nur, was mitgeschickt wird; Unbrauchbares behaelt den bisherigen Wert. */
  update(id: string, patch: ProfilePatch): ProfileWithId {
    const current = this.#get(id);
    this.#profiles.set(id, {
      ...current,
      name: patch.name === undefined ? current.name : sanitizeName(patch.name),
      content: patch.content === undefined ? current.content : sanitizeContent(patch.content, current.content),
      layout: patch.layout === undefined ? current.layout : sanitizeLayout(patch.layout),
    });
    this.#markDirty(id);
    return this.read(id);
  }

  /** Inhalte auf eine Vorlage zuruecksetzen; das Layout bleibt. */
  resetContent(id: string, template: unknown): ProfileWithId {
    const current = this.#get(id);
    const content = templateContent(template);
    if (!content) throw new ProfileError("invalid-template", "Unbekannte Vorlage");
    this.#profiles.set(id, { ...current, content });
    this.#markDirty(id);
    return this.read(id);
  }

  remove(id: string): void {
    this.#get(id);
    if (this.#profiles.size <= 1) {
      throw new ProfileError("last-profile", "Das letzte Profil kann nicht geloescht werden");
    }
    this.#profiles.delete(id);
    this.#pending.delete(id);
    try {
      rmSync(this.#pathFor(id), { force: true });
    } catch (error) {
      this.#warn(error as Error);
    }
    const [first] = this.list();
    if (this.#active === id && first) this.#setActive(first.id);
  }

  setActive(id: string): void {
    this.#get(id);
    this.#setActive(id);
  }

  /** Schreibt alle offenen Aenderungen sofort (beim Beenden, in Tests). */
  flush(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    for (const id of this.#pending) {
      const profile = this.#profiles.get(id);
      if (profile) this.#writeAtomic(this.#pathFor(id), profile);
    }
    this.#pending.clear();
    if (this.#activePending) {
      this.#writeAtomic(join(this.dir, ACTIVE_FILE), { id: this.#active });
      this.#activePending = false;
    }
  }

  #get(id: string): Profile {
    if (!VALID_ID.test(id)) {
      throw new ProfileError(
        "invalid-id",
        `Ungueltiger Profilname "${id}". Erlaubt sind Kleinbuchstaben, Ziffern und Bindestriche.`,
      );
    }
    const profile = this.#profiles.get(id);
    if (!profile) throw new ProfileError("not-found", `Profil "${id}" gibt es nicht`);
    return profile;
  }

  #load(): void {
    let files: string[];
    try {
      files = readdirSync(this.dir);
    } catch {
      return; // Ordner fehlt oder ist keiner - dann eben ohne Dateien
    }
    for (const file of files) {
      if (!file.endsWith(".json") || file === ACTIVE_FILE) continue;
      const id = file.slice(0, -".json".length);
      if (!VALID_ID.test(id) || id === RESERVED_ID) continue;
      this.#profiles.set(id, sanitizeProfile(this.#readJson(join(this.dir, file))));
    }
  }

  /** Erster Start: das bisher ausgerichtete Layout wird zum Profil "Standard". */
  #createFirst(legacyDir: string | null): void {
    const profile = newProfile("Standard");
    const legacy = legacyDir === null ? null : fromLegacyLayout(this.#readJson(join(legacyDir, "standard.json")));
    if (legacy) {
      profile.layout = legacy.layout;
      profile.content = sanitizeContent({ scheibe: { darstellung: legacy.boardMode } }, profile.content);
    }
    this.#profiles.set(FIRST_ID, profile);
    this.#pending.add(FIRST_ID);
    this.#active = FIRST_ID;
    this.#activePending = true;
    this.flush();
  }

  #loadActive(): void {
    const stored = this.#readJson(join(this.dir, ACTIVE_FILE));
    const id = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>)["id"] : null;
    if (typeof id === "string" && this.#profiles.has(id)) {
      this.#active = id;
      return;
    }
    const [first] = this.list();
    if (first) this.#setActive(first.id);
  }

  #readJson(path: string): unknown {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return null; // fehlt oder beschaedigt - die Pruefung macht daraus Brauchbares
    }
  }

  #setActive(id: string): void {
    this.#active = id;
    this.#activePending = true;
    this.#schedule();
  }

  #markDirty(id: string): void {
    this.#pending.add(id);
    this.#schedule();
  }

  #schedule(): void {
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.flush();
    }, this.flushDelayMs);
    this.#timer.unref?.();
  }

  #writeAtomic(path: string, data: unknown): void {
    const temp = `${path}.tmp`;
    try {
      writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`);
      renameSync(temp, path);
    } catch (error) {
      this.#warn(error as Error);
    }
  }

  /** Einmal warnen; danach gelten die Profile bis zum Neustart nur im Speicher. */
  #warn(error: Error): void {
    if (this.#warned) return;
    this.#warned = true;
    console.warn(`Profile koennen nicht gespeichert werden: ${error.message}`);
  }

  #pathFor(id: string): string {
    return join(this.dir, `${id}.json`);
  }
}
```

- [ ] **Step 4: Test laufen lassen – muss bestehen**

Run: `npx vitest run test/profile-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viewer/profile-store.ts test/profile-store.test.ts
git commit -m "Viewer-Profile: Profilspeicher mit Uebernahme des alten Layouts und atomarem Schreiben"
```

---

### Task 4: Hub, HTTP und Verdrahtung

**Files:**
- Modify: `server/src/viewer/display-hub.ts` (ganz ersetzen), `server/src/http.ts`, `server/src/runtime.ts`, `server/src/index.ts`
- Delete: `server/src/viewer/layout-store.ts`, `server/test/layout-store.test.ts`, `server/test/display-name.test.js`
- Test: `server/test/display-hub.test.ts` (ganz ersetzen), `server/test/http.test.ts`, `server/test/ingest-e2e.test.ts`, `server/test/helpers.ts`

**Interfaces:**
- Consumes: `ProfileStore`, `ProfileError`, `ProfileErrorCode` (Task 3); `CATALOG`, `Catalog` (Task 1); `ProfileWithId`, `ProfileSummary` (Task 2).
- Produces:
  - `display-hub.ts`: `interface ProfileSource { readonly activeId: string; active(): ProfileWithId; list(): ProfileSummary[] }`, `type EditStep = "inhalte" | "layout"`, `editStep(raw: unknown): EditStep | null`, `type ViewerMessage = { type: "catalog"; catalog } | { type: "state"; state } | { type: "profile"; profile; profiles; editing: EditStep | null }`, `class DisplayHub` mit `attach(socket)`, `broadcast(state)`, `setEditing(step)`, `publishProfile()`, `get editing`, `close()`, `get state`, `get clientCount`
  - `AppDeps.profiles: ProfileStore` (statt `layouts`)
  - Endpunkte: `GET /api/profiles`, `GET /api/profiles/:id`, `POST /api/profiles`, `PUT /api/profiles/:id`, `POST /api/profiles/:id/reset`, `DELETE /api/profiles/:id`, `PUT /api/active-profile`; `/ws` ohne Anzeigename

Hinweis: Nach diesem Task bekommt der Viewer im Browser die neuen Nachrichten, versteht sie aber erst nach Task 5. Bis dahin ist er im Browser nicht benutzbar.

- [ ] **Step 1: Testhilfe umstellen** – in `server/test/helpers.ts`

Import ersetzen:

```ts
import { LayoutStore } from "../src/viewer/layout-store.js";
```
→
```ts
import { ProfileStore } from "../src/viewer/profile-store.js";
```

Kommentar und Anfang von `testDeps` ersetzen:

```ts
/**
 * Abhaengigkeiten fuer Tests: echte Bausteine, Layouts im Temp-Ordner, keine
 * Aufzeichnung. Wer `hub` ueberschreibt, muss auch `ingest` passend mitgeben.
 */
export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const layouts = new LayoutStore(mkdtempSync(join(tmpdir(), "raspdarts-test-")));
  const hub = new DisplayHub(layouts);
  return {
    hub,
    layouts,
```
→
```ts
/**
 * Abhaengigkeiten fuer Tests: echte Bausteine, Profile im Temp-Ordner, keine
 * Aufzeichnung. Wer `hub` ueberschreibt, muss auch `ingest` passend mitgeben.
 */
export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const profiles = new ProfileStore(mkdtempSync(join(tmpdir(), "raspdarts-test-")));
  const hub = new DisplayHub(profiles);
  return {
    hub,
    profiles,
```

- [ ] **Step 2: Hub-Test ganz ersetzen** – `server/test/display-hub.test.ts`

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CATALOG } from "../src/viewer/catalog.js";
import { DisplayHub, editStep, type DisplaySocket, type ViewerMessage } from "../src/viewer/display-hub.js";
import { IDLE, type ViewerState } from "../src/viewer/game-state.js";
import { ProfileStore } from "../src/viewer/profile-store.js";

function fakeSocket() {
  const sent: ViewerMessage[] = [];
  let onClose = () => {};
  const socket: DisplaySocket = {
    send: (data) => sent.push(JSON.parse(data) as ViewerMessage),
    on: (_event, listener) => (onClose = listener),
  };
  return { socket, sent, close: () => onClose() };
}

const store = () => new ProfileStore(mkdtempSync(join(tmpdir(), "hub-test-")));
const UNSUPPORTED: ViewerState = { phase: "unsupported", variant: "Cricket" };

let hub: DisplayHub;
afterEach(() => {
  hub?.close();
  vi.useRealTimers();
});

describe("DisplayHub", () => {
  test("schickt einem neuen Viewer Katalog, Stand und aktives Profil", () => {
    const profiles = store();
    hub = new DisplayHub(profiles);
    const viewer = fakeSocket();

    hub.attach(viewer.socket);

    expect(viewer.sent).toEqual([
      { type: "catalog", catalog: CATALOG },
      { type: "state", state: IDLE },
      { type: "profile", profile: profiles.active(), profiles: profiles.list(), editing: null },
    ]);
  });

  test("verteilt neue Staende an alle Viewer", () => {
    hub = new DisplayHub(store());
    const a = fakeSocket();
    const b = fakeSocket();
    hub.attach(a.socket);
    hub.attach(b.socket);

    hub.broadcast(UNSUPPORTED);

    expect(a.sent.at(-1)).toEqual({ type: "state", state: UNSUPPORTED });
    expect(b.sent.at(-1)).toEqual({ type: "state", state: UNSUPPORTED });
    expect(hub.state).toEqual(UNSUPPORTED);
  });

  test("schickt Profilaenderungen samt Liste an alle Viewer", () => {
    const profiles = store();
    hub = new DisplayHub(profiles);
    const a = fakeSocket();
    const b = fakeSocket();
    hub.attach(a.socket);
    hub.attach(b.socket);

    profiles.update("standard", { name: "Beamer" });
    hub.publishProfile();

    for (const viewer of [a, b]) {
      expect(viewer.sent.at(-1)).toMatchObject({
        type: "profile",
        profile: { id: "standard", name: "Beamer" },
        profiles: [{ id: "standard", name: "Beamer" }],
      });
    }
  });

  test("ein spaeter verbundener Viewer erfaehrt, dass gerade eingestellt wird", () => {
    hub = new DisplayHub(store());
    hub.setEditing("layout");
    const late = fakeSocket();

    hub.attach(late.socket);

    expect(late.sent.at(-1)).toMatchObject({ type: "profile", editing: "layout" });
  });

  test("Einstellen endet von selbst nach dem Zeitlimit", () => {
    vi.useFakeTimers();
    hub = new DisplayHub(store(), 60_000);
    const viewer = fakeSocket();
    hub.attach(viewer.socket);
    hub.setEditing("inhalte");

    vi.advanceTimersByTime(59_000);
    hub.setEditing("inhalte"); // jede Meldung verlaengert
    vi.advanceTimersByTime(59_000);
    expect(hub.editing).toBe("inhalte");

    vi.advanceTimersByTime(1_000);
    expect(hub.editing).toBeNull();
    expect(viewer.sent.at(-1)).toMatchObject({ type: "profile", editing: null });
  });

  test("ein Wechsel des aktiven Profils beendet das Einstellen", () => {
    const profiles = store();
    hub = new DisplayHub(profiles);
    const viewer = fakeSocket();
    hub.attach(viewer.socket);
    hub.setEditing("layout");

    profiles.create("TV", "fernseher");
    hub.publishProfile();

    expect(hub.editing).toBeNull();
    expect(viewer.sent.at(-1)).toMatchObject({ type: "profile", profile: { id: "tv" }, editing: null });
  });

  test("vergisst geschlossene und kaputte Viewer", () => {
    hub = new DisplayHub(store());
    const closed = fakeSocket();
    hub.attach(closed.socket);
    closed.close();
    const broken: DisplaySocket = {
      send: () => {
        throw new Error("weg");
      },
      on: () => undefined,
    };
    hub.attach(broken);

    hub.broadcast(UNSUPPORTED);

    expect(hub.clientCount).toBe(0);
  });
});

describe("editStep", () => {
  test("kennt nur die beiden Schritte", () => {
    expect(editStep("inhalte")).toBe("inhalte");
    expect(editStep("layout")).toBe("layout");
    for (const raw of [null, undefined, "ja", true, 1]) expect(editStep(raw)).toBeNull();
  });
});
```

- [ ] **Step 3: HTTP-Tests umstellen** – in `server/test/http.test.ts`

Import ergänzen (nach dem `DEFAULT_LAYOUT`-Import):

```ts
import { templateContent } from "../src/viewer/catalog.js";
```

Im Block `describe("Header-Schutz", …)` und `describe("Host-Pruefung (DNS-Rebinding)", …)` jede URL `"/api/layout/standard"` durch `"/api/profiles"` ersetzen und `"/%61pi/layout/standard"` durch `"/%61pi/profiles"`. Im Test „laesst /api-Anfragen mit X-Raspdarts: 1 durch“ die letzte Erwartung ersetzen:

```ts
    expect(response.json()).toEqual(DEFAULT_LAYOUT);
```
→
```ts
    expect(response.json()).toEqual({ active: "standard", profiles: [{ id: "standard", name: "Standard" }] });
```

Den ganzen Block `describe("Layout-API", () => { … });` ersetzen durch:

```ts
describe("Profil-API", () => {
  const headers = { "x-raspdarts": "1" };
  const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, headers, ...(payload === undefined ? {} : { payload }) });

  test("listet die Profile mit dem aktiven", async () => {
    app = await buildApp(testDeps());

    const response = await call("GET", "/api/profiles");

    expect(response.json()).toEqual({ active: "standard", profiles: [{ id: "standard", name: "Standard" }] });
  });

  test("liefert ein Profil mit id", async () => {
    app = await buildApp(testDeps());

    const response = await call("GET", "/api/profiles/standard");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "standard",
      version: 3,
      name: "Standard",
      content: templateContent("projektion"),
      layout: DEFAULT_LAYOUT,
    });
  });

  test("legt ein Profil aus einer Vorlage an und macht es aktiv", async () => {
    const deps = testDeps();
    app = await buildApp(deps);

    const response = await call("POST", "/api/profiles", { name: "Fernseher Küche", template: "fernseher" });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: "fernseher-kueche",
      name: "Fernseher Küche",
      content: templateContent("fernseher"),
    });
    expect(deps.profiles.activeId).toBe("fernseher-kueche");
  });

  test("weist eine unbekannte oder fehlende Vorlage mit 400 ab", async () => {
    app = await buildApp(testDeps());

    expect((await call("POST", "/api/profiles", { name: "X", template: "disco" })).statusCode).toBe(400);
    expect((await call("POST", "/api/profiles", { name: "X" })).statusCode).toBe(400);
  });

  test("aendert Teile eines Profils und setzt editing fuer das aktive", async () => {
    const deps = testDeps();
    app = await buildApp(deps);

    const response = await call("PUT", "/api/profiles/standard", {
      name: "Beamer",
      content: { hintergrund: { on: true } },
      editing: "inhalte",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "standard",
      name: "Beamer",
      content: { hintergrund: { on: true }, spielinfo: { on: false } },
    });
    expect(deps.hub.editing).toBe("inhalte");
  });

  test("ein PUT ohne editing laesst den Schritt stehen, editing null beendet ihn", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    await call("PUT", "/api/profiles/standard", { editing: "layout" });

    await call("PUT", "/api/profiles/standard", { name: "Beamer" });
    expect(deps.hub.editing).toBe("layout");

    await call("PUT", "/api/profiles/standard", { editing: null });
    expect(deps.hub.editing).toBeNull();
  });

  test("editing fuer ein nicht aktives Profil wird ignoriert", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    await call("POST", "/api/profiles", { name: "TV", template: "fernseher" });

    await call("PUT", "/api/profiles/standard", { editing: "layout" });

    expect(deps.hub.editing).toBeNull();
  });

  test("setzt die Inhalte auf eine Vorlage zurueck, das Layout bleibt", async () => {
    app = await buildApp(testDeps());
    const moved = { ...DEFAULT_LAYOUT, board: { cx: 40, cy: 45, diameter: 80, rotation: 1.5 } };
    await call("PUT", "/api/profiles/standard", { layout: moved });

    const response = await call("POST", "/api/profiles/standard/reset", { template: "minimal" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ content: templateContent("minimal"), layout: { board: moved.board } });
  });

  test("loescht ein Profil, aber nie das letzte", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    await call("POST", "/api/profiles", { name: "TV", template: "fernseher" });

    expect((await call("DELETE", "/api/profiles/tv")).statusCode).toBe(204);
    expect(deps.profiles.activeId).toBe("standard");
    expect((await call("DELETE", "/api/profiles/standard")).statusCode).toBe(409);
  });

  test("schaltet das aktive Profil um", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    await call("POST", "/api/profiles", { name: "TV", template: "fernseher" });

    const response = await call("PUT", "/api/active-profile", { id: "standard" });

    expect(response.json()).toEqual({ active: "standard" });
    expect(deps.profiles.activeId).toBe("standard");
    expect((await call("PUT", "/api/active-profile", { id: "gibtsnicht" })).statusCode).toBe(404);
    expect((await call("PUT", "/api/active-profile", {})).statusCode).toBe(400);
  });

  test("unbekanntes Profil ergibt 404", async () => {
    app = await buildApp(testDeps());

    expect((await call("GET", "/api/profiles/gibtsnicht")).statusCode).toBe(404);
  });

  test.each([
    ["GET", "/api/profiles/..%2Fx"],
    ["PUT", "/api/profiles/..%2Fx"],
    ["DELETE", "/api/profiles/Wohnzimmer%20TV"],
  ] as const)("%s %s: ungueltige id ergibt 400", async (method, url) => {
    app = await buildApp(testDeps());

    const response = await call(method, url, method === "PUT" ? { name: "x" } : undefined);

    expect(response.statusCode).toBe(400);
  });

  test("verlangt den X-Raspdarts-Header", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: { name: "X", template: "minimal" },
    });

    expect(response.statusCode).toBe(403);
  });
});
```

Im Test „setzt alle Viewer auf Warten“ (`/api/ingest/reset`) ersetzen:

```ts
    deps.hub.attach(socket, "standard");
```
→
```ts
    deps.hub.attach(socket);
```

- [ ] **Step 4: End-to-End-Test umstellen** – in `server/test/ingest-e2e.test.ts`

Import `import { DEFAULT_LAYOUT } from "../src/viewer/layout.js";` löschen. Die Hilfe ersetzen:

```ts
const layouts = (messages: string[]) =>
  messages.map((m) => JSON.parse(m)).filter((m) => m.type === "layout");
```
→
```ts
const profileMessages = (messages: string[]) =>
  messages.map((m) => JSON.parse(m)).filter((m) => m.type === "profile");
```

Den ganzen Block `describe("/ws", () => { … });` ersetzen durch:

```ts
describe("/ws", () => {
  test("schickt Katalog, Stand und aktives Profil, auch bei alter Adresse mit ?display=", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);

    const viewer = connect(`ws://${host}/ws?display=beamer`);
    await viewer.opened;

    await vi.waitFor(() => expect(viewer.messages).toHaveLength(3));
    expect(viewer.messages.map((m) => JSON.parse(m).type)).toEqual(["catalog", "state", "profile"]);
    expect(profileMessages(viewer.messages)[0]).toMatchObject({ profile: { id: "standard" }, editing: null });
  });

  test("ein neues Profil per POST erreicht alle Viewer", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);
    const a = connect(`ws://${host}/ws`);
    const b = connect(`ws://${host}/ws`);
    await Promise.all([a.opened, b.opened]);
    await vi.waitFor(() => expect(profileMessages(b.messages)).toHaveLength(1));

    await app.inject({
      method: "POST",
      url: "/api/profiles",
      headers: { "x-raspdarts": "1" },
      payload: { name: "TV", template: "fernseher" },
    });

    for (const viewer of [a, b]) {
      await vi.waitFor(() =>
        expect(profileMessages(viewer.messages).at(-1)).toMatchObject({
          profile: { id: "tv", content: { hintergrund: { on: true } } },
          profiles: [{ id: "standard" }, { id: "tv" }],
        }),
      );
    }
  });
});
```

- [ ] **Step 5: Tests laufen lassen – müssen fehlschlagen**

Run: `npx vitest run test/display-hub.test.ts test/http.test.ts test/ingest-e2e.test.ts`
Expected: FAIL (u. a. `editStep` nicht exportiert, `/api/profiles` gibt 404).

- [ ] **Step 6: `server/src/viewer/display-hub.ts` ganz ersetzen**

```ts
/**
 * Verteilt Katalog, Stand und das aktive Profil an die verbundenen Viewer.
 *
 * Alle Viewer zeigen dasselbe: den Spielstand und das aktive Profil. Es werden
 * immer vollstaendige Schnappschuesse gesendet, keine Deltas: Ein Viewer, der
 * sich spaeter verbindet, ist sofort richtig.
 *
 * "editing" sagt allen Viewern, dass gerade eingestellt wird ("inhalte" oder
 * "layout") - dann zeigen sie ohne Spiel Beispieldaten, beim Layout die
 * Scheibe als Linien. Bleibt eine Meldung aus (Fenster geschlossen), faellt es
 * nach dem Zeitlimit zurueck; ein Wechsel des aktiven Profils beendet es.
 */
import { CATALOG, type Catalog } from "./catalog.js";
import { IDLE, type ViewerState } from "./game-state.js";
import type { ProfileSummary, ProfileWithId } from "./profile.js";

export interface DisplaySocket {
  send(data: string): void;
  on(event: "close", listener: () => void): unknown;
}

export interface ProfileSource {
  readonly activeId: string;
  active(): ProfileWithId;
  list(): ProfileSummary[];
}

export type EditStep = "inhalte" | "layout";

export type ViewerMessage =
  | { type: "catalog"; catalog: Catalog }
  | { type: "state"; state: ViewerState }
  | { type: "profile"; profile: ProfileWithId; profiles: ProfileSummary[]; editing: EditStep | null };

export const EDIT_TIMEOUT_MS = 60_000;

/** Nur die beiden Schritte gelten; alles andere heisst "es wird nicht eingestellt". */
export function editStep(raw: unknown): EditStep | null {
  return raw === "inhalte" || raw === "layout" ? raw : null;
}

export class DisplayHub {
  readonly #clients = new Set<DisplaySocket>();
  #state: ViewerState = IDLE;
  #editing: EditStep | null = null;
  #editTimer: NodeJS.Timeout | null = null;
  /** Das aktive Profil beim letzten Verteilen - ein Wechsel beendet das Einstellen. */
  #shownActive: string;

  constructor(
    private readonly profiles: ProfileSource,
    private readonly editTimeoutMs = EDIT_TIMEOUT_MS,
  ) {
    this.#shownActive = profiles.activeId;
  }

  attach(socket: DisplaySocket): void {
    this.#clients.add(socket);
    socket.on("close", () => this.#clients.delete(socket));
    this.#send(socket, { type: "catalog", catalog: CATALOG });
    this.#send(socket, { type: "state", state: this.#state });
    this.#send(socket, this.#profileMessage());
  }

  /** Setzt den Stand und schiebt ihn an alle Viewer. */
  broadcast(state: ViewerState): void {
    this.#state = state;
    for (const socket of [...this.#clients]) this.#send(socket, { type: "state", state });
  }

  /** Wer gerade einstellt. Jede Meldung verlaengert; ohne Meldung endet es nach dem Zeitlimit. */
  setEditing(step: EditStep | null): void {
    if (this.#editTimer) clearTimeout(this.#editTimer);
    this.#editTimer = null;
    this.#editing = step;
    if (!step) return;
    this.#editTimer = setTimeout(() => {
      this.#editTimer = null;
      this.#editing = null;
      this.publishProfile();
    }, this.editTimeoutMs);
    this.#editTimer.unref?.();
  }

  /** Schickt das aktive Profil und die Liste an alle Viewer. */
  publishProfile(): void {
    if (this.profiles.activeId !== this.#shownActive) {
      this.#shownActive = this.profiles.activeId;
      this.setEditing(null);
    }
    const message = this.#profileMessage();
    for (const socket of [...this.#clients]) this.#send(socket, message);
  }

  get editing(): EditStep | null {
    return this.#editing;
  }

  close(): void {
    if (this.#editTimer) clearTimeout(this.#editTimer);
    this.#editTimer = null;
  }

  get state(): ViewerState {
    return this.#state;
  }

  get clientCount(): number {
    return this.#clients.size;
  }

  #profileMessage(): ViewerMessage {
    return {
      type: "profile",
      profile: this.profiles.active(),
      profiles: this.profiles.list(),
      editing: this.#editing,
    };
  }

  #send(socket: DisplaySocket, message: ViewerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.#clients.delete(socket);
    }
  }
}
```

- [ ] **Step 7: `server/src/http.ts` umstellen**

Imports ersetzen:

```ts
import type { DisplayHub } from "./viewer/display-hub.js";
import { IDLE } from "./viewer/game-state.js";
import { isExtensionOrigin, type Ingest } from "./viewer/ingest.js";
import { displayName, type LayoutStore } from "./viewer/layout-store.js";
```
→
```ts
import { editStep, type DisplayHub } from "./viewer/display-hub.js";
import { IDLE } from "./viewer/game-state.js";
import { isExtensionOrigin, type Ingest } from "./viewer/ingest.js";
import { ProfileError, type ProfileErrorCode, type ProfileStore } from "./viewer/profile-store.js";
```

In `AppDeps` ersetzen: `layouts: LayoutStore;` → `profiles: ProfileStore;`

Nach `CAM_FAILURE_CODES` einfügen:

```ts
const PROFILE_ERROR_CODES: Record<ProfileErrorCode, number> = {
  "invalid-id": 400,
  "invalid-template": 400,
  "not-found": 404,
  "last-profile": 409,
};

type Fields = Record<string, unknown>;
const fields = (body: unknown): Fields => (typeof body === "object" && body !== null ? body : {}) as Fields;
```

Die `/ws`-Route ersetzen:

```ts
  // Der Anzeigename waehlt das Layout; ein unbrauchbarer Name ist kein Fehler,
  // der Viewer bekommt dann das Standardlayout.
  app.get<{ Querystring: { display?: string } }>("/ws", { websocket: true }, (socket, request) =>
    deps.hub.attach(socket, displayName(request.query.display)),
  );
```
→
```ts
  // Alle Viewer zeigen das aktive Profil; ?display= alter Kiosk-Adressen wird ignoriert.
  app.get("/ws", { websocket: true }, (socket) => deps.hub.attach(socket));
```

Die beiden Layout-Routen (Kommentar „Layout je Anzeige …“ bis zum Ende von `app.put…("/api/layout/:display", …)`) ersetzen durch:

```ts
  // Profile: was der Viewer zeigt und wo. Jede Aenderung geht sofort an alle Viewer.
  app.get("/api/profiles", async () => ({ active: deps.profiles.activeId, profiles: deps.profiles.list() }));

  app.get<{ Params: { id: string } }>("/api/profiles/:id", async (request, reply) =>
    withProfiles(reply, () => deps.profiles.read(request.params.id)),
  );

  app.post<{ Body: unknown }>("/api/profiles", async (request, reply) =>
    withProfiles(reply, () => {
      const body = fields(request.body);
      const profile = deps.profiles.create(body["name"], body["template"]);
      deps.hub.publishProfile();
      reply.code(201);
      return profile;
    }),
  );

  app.put<{ Params: { id: string }; Body: unknown }>("/api/profiles/:id", async (request, reply) =>
    withProfiles(reply, () => {
      const { id } = request.params;
      const body = fields(request.body);
      const profile = deps.profiles.update(id, {
        name: body["name"],
        content: body["content"],
        layout: body["layout"],
      });
      // Einstellen betrifft, was die Viewer zeigen - also nur das aktive Profil.
      if (body["editing"] !== undefined && id === deps.profiles.activeId) {
        deps.hub.setEditing(editStep(body["editing"]));
      }
      deps.hub.publishProfile();
      return profile;
    }),
  );

  app.post<{ Params: { id: string }; Body: unknown }>("/api/profiles/:id/reset", async (request, reply) =>
    withProfiles(reply, () => {
      const profile = deps.profiles.resetContent(request.params.id, fields(request.body)["template"]);
      deps.hub.publishProfile();
      return profile;
    }),
  );

  app.delete<{ Params: { id: string } }>("/api/profiles/:id", async (request, reply) =>
    withProfiles(reply, () => {
      deps.profiles.remove(request.params.id);
      deps.hub.publishProfile();
      return reply.code(204).send();
    }),
  );

  app.put<{ Body: unknown }>("/api/active-profile", async (request, reply) =>
    withProfiles(reply, () => {
      const id = fields(request.body)["id"];
      deps.profiles.setActive(typeof id === "string" ? id : "");
      deps.hub.publishProfile();
      return { active: deps.profiles.activeId };
    }),
  );
```

Die Funktion `withLayout` am Dateiende ersetzen durch:

```ts
/** Fehler des Aufrufers (ungueltige id, letztes Profil ...) sind keine Serverfehler. */
function withProfiles(reply: FastifyReply, run: () => unknown) {
  try {
    return run();
  } catch (error) {
    if (error instanceof ProfileError) {
      return reply.code(PROFILE_ERROR_CODES[error.code]).send({ error: error.message });
    }
    throw error;
  }
}
```

- [ ] **Step 8: `runtime.ts` und `index.ts` umstellen**

`server/src/runtime.ts`: Import `import { LayoutStore } from "./viewer/layout-store.js";` → `import { ProfileStore } from "./viewer/profile-store.js";`. In `createDeps` ersetzen:

```ts
  const layouts = new LayoutStore("data/layouts");
  const hub = new DisplayHub(layouts);
```
→
```ts
  // data/layouts enthaelt die Layouts von vor den Profilen; sie werden beim
  // ersten Start einmal uebernommen und danach nicht mehr gelesen.
  const profiles = new ProfileStore("data/profiles", "data/layouts");
  const hub = new DisplayHub(profiles);
```

und im Rückgabeobjekt `layouts,` → `profiles,`.

`server/src/index.ts`: `deps.layouts.flush();` → `deps.profiles.flush();`

- [ ] **Step 9: Alte Dateien löschen**

```bash
git rm src/viewer/layout-store.ts test/layout-store.test.ts test/display-name.test.js
```

- [ ] **Step 10: Alle Tests und Typcheck**

Run: `npm test && npm run typecheck`
Expected: alle Tests PASS, keine Typfehler. (`grep -rn "layout-store\|LayoutStore\|displayName" src test` liefert nichts.)

- [ ] **Step 11: Commit**

```bash
git add -A src test
git commit -m "Viewer-Profile: Profil-API, Hub verteilt Katalog und aktives Profil an alle Viewer"
```

---

### Task 5: Viewer zeichnet nach dem aktiven Profil

**Files:**
- Create: `server/public/js/profile-api.js`, `server/public/js/profile-sync.js`, `server/public/js/content-view.js`
- Modify: `server/public/js/app.js` (ganz ersetzen), `server/public/js/editor.js`, `server/public/js/blocks.js`, `server/public/index.html`, `server/public/style.css`
- Delete: `server/public/js/display-name.js`
- Test: `server/test/content-view.test.js`, `server/test/profile-sync.test.js`

**Interfaces:**
- Consumes: WebSocket-Nachrichten aus Task 4 (`catalog`, `state`, `profile` mit `editing`), `PUT /api/profiles/:id`.
- Produces:
  - `profile-api.js`: `api(method, path, body?) → Promise<object | null>`; wirft `Error("Fehler <status>")` bzw. `Error("keine Verbindung zum Pi")`
  - `profile-sync.js`: `createSync({ onStatus(text) }) → { queue(id, patch), flush() }`
  - `content-view.js`: `contentAttributes(catalog, content) → Record<string, string>`, `applyContent(el, catalog, content)`
  - `editor.js` (vorläufig): `createEditor({ viewer, sync, getProfileId, getLayout, applyLocal, onEditingChange }) → { isEditing(), setStatus(text) }`
  - Merkmale an `#viewer`: `data-<baustein>` = `on`/`off`, `data-<baustein>-<option>` = `on`/`off` bzw. Auswahlwert, Namen klein geschrieben (`data-scheibe-letzterdart`)
  - Klasse `is-layout` an `#viewer`, solange irgendwo das Layout ausgerichtet wird
  - Spielinfo-Chips tragen `data-chip="punktzahl" | "legs" | "modus"`

- [ ] **Step 1: Failing Tests schreiben**

`server/test/content-view.test.js`:

```js
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { contentAttributes } from "../public/js/content-view.js";
import { CATALOG, defaultContent, sanitizeContent } from "../src/viewer/catalog.ts";

describe("contentAttributes", () => {
  test("setzt fuer jeden Baustein und jede Option ein Merkmal", () => {
    const attrs = contentAttributes(CATALOG, defaultContent());

    expect(attrs).toMatchObject({
      "data-hintergrund": "off",
      "data-scheibe": "on",
      "data-scheibe-darstellung": "light",
      "data-scheibe-letzterdart": "on",
      "data-spieler-profilbild": "on",
    });
    const count = CATALOG.parts.reduce((n, part) => n + 1 + part.options.length, 0);
    expect(Object.keys(attrs)).toHaveLength(count);
  });

  test("schreibt ausgeschaltete Optionen und Auswahlwerte", () => {
    const content = sanitizeContent({
      hintergrund: { on: true },
      scheibe: { darstellung: "drawn" },
      spieler: { flaeche: false },
    });

    expect(contentAttributes(CATALOG, content)).toMatchObject({
      "data-hintergrund": "on",
      "data-scheibe-darstellung": "drawn",
      "data-spieler-flaeche": "off",
    });
  });

  test("Merkmalnamen sind klein geschrieben", () => {
    for (const name of Object.keys(contentAttributes(CATALOG, defaultContent()))) {
      expect(name).toBe(name.toLowerCase());
    }
  });

  test("fehlende Werte gelten wie die Vorgaben", () => {
    expect(contentAttributes(CATALOG, {})).toEqual(contentAttributes(CATALOG, defaultContent()));
  });

  test("jede Option wirkt im Stylesheet (Darstellung der Scheibe setzt app.js)", () => {
    const css = readFileSync("public/style.css", "utf8");
    const handledInCode = ["data-scheibe-darstellung"];
    for (const name of Object.keys(contentAttributes(CATALOG, defaultContent()))) {
      if (handledInCode.includes(name)) continue;
      expect(css, name).toContain(`[${name}=`);
    }
  });
});
```

`server/test/profile-sync.test.js`:

```js
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSync } from "../public/js/profile-sync.js";

let calls;
let answer;

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  answer = { ok: true, status: 200, json: async () => ({}) };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, body: JSON.parse(init.body) });
      return answer;
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createSync", () => {
  test("fasst Aenderungen zusammen und sendet hoechstens alle 100 ms", () => {
    const sync = createSync({ onStatus: () => {} });

    sync.queue("standard", { layout: 1 });
    sync.queue("standard", { editing: "layout" });
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(0);

    expect(calls).toEqual([
      {
        url: "/api/profiles/standard",
        method: "PUT",
        headers: { "X-Raspdarts": "1", "Content-Type": "application/json" },
        body: { layout: 1, editing: "layout" },
      },
    ]);

    sync.queue("standard", { layout: 2 });
    vi.advanceTimersByTime(50);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(50);
    expect(calls.at(-1).body).toEqual({ layout: 2 });
  });

  test("flush sendet sofort", () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { content: { a: 1 } });

    sync.flush();

    expect(calls).toHaveLength(1);
  });

  test("Aenderungen am bisherigen Profil gehen vor einem Wechsel raus", () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { content: 1 });

    sync.queue("tv", { editing: "inhalte" });
    vi.advanceTimersByTime(100);

    expect(calls.map((c) => [c.url, c.body])).toEqual([
      ["/api/profiles/standard", { content: 1 }],
      ["/api/profiles/tv", { editing: "inhalte" }],
    ]);
  });

  test("ohne Profil wird nichts gesendet", () => {
    const sync = createSync({ onStatus: () => {} });

    sync.queue(undefined, { editing: "layout" });
    vi.advanceTimersByTime(100);

    expect(calls).toHaveLength(0);
  });

  test("meldet Fehler und loescht die Meldung beim naechsten Erfolg", async () => {
    const status = [];
    const sync = createSync({ onStatus: (text) => status.push(text) });
    answer = { ok: false, status: 403, json: async () => ({}) };

    sync.queue("standard", { layout: 1 });
    sync.flush();
    await vi.waitFor(() => expect(status).toEqual(["Nicht gespeichert: Fehler 403"]));

    answer = { ok: true, status: 200, json: async () => ({}) };
    sync.queue("standard", { layout: 2 });
    sync.flush();
    await vi.waitFor(() => expect(status.at(-1)).toBe(""));
  });
});
```

- [ ] **Step 2: Tests laufen lassen – müssen fehlschlagen**

Run: `npx vitest run test/content-view.test.js test/profile-sync.test.js`
Expected: FAIL, Module nicht auflösbar.

- [ ] **Step 3: `server/public/js/profile-api.js` anlegen**

```js
/*
 * Anfragen an den Pi. Der Header X-Raspdarts ist Pflicht (Schutz vor fremden
 * Webseiten, siehe server/src/http.ts).
 */

export async function api(method, path, body) {
  const init = { method, headers: { "X-Raspdarts": "1" } };
  // Content-Type nur mit Inhalt - sonst lehnt der Pi die Anfrage ab.
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error("keine Verbindung zum Pi");
  }
  // fetch wirft bei 400/403 nicht - ohne diese Pruefung ginge ein Fehler still unter.
  if (!response.ok) throw new Error(`Fehler ${response.status}`);
  return response.status === 204 ? null : response.json();
}
```

- [ ] **Step 4: `server/public/js/profile-sync.js` anlegen**

```js
/*
 * Schickt Aenderungen am Profil gedrosselt an den Pi: hoechstens alle 100 ms
 * eine Anfrage, Aenderungen dazwischen werden zusammengefasst. Die letzte
 * Aenderung geht immer noch raus.
 */
import { api } from "./profile-api.js";

const SEND_INTERVAL_MS = 100;

export function createSync({ onStatus }) {
  let target = null;
  let pending = null;
  let lastSent = 0;
  let timer = null;

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!pending || !target) return;
    const id = target;
    const body = pending;
    pending = null;
    lastSent = Date.now();
    api("PUT", `/api/profiles/${encodeURIComponent(id)}`, body)
      .then(() => onStatus(""))
      // Ohne Meldung ginge eine Einstellung still verloren.
      .catch((error) => onStatus(`Nicht gespeichert: ${error.message}`));
  }

  function queue(id, patch) {
    if (!id) return; // noch kein Profil vom Pi
    if (pending && target !== id) flush(); // Aenderungen am bisherigen Profil zuerst
    target = id;
    pending = { ...pending, ...patch };
    if (!timer) timer = setTimeout(flush, Math.max(0, SEND_INTERVAL_MS - (Date.now() - lastSent)));
  }

  return { queue, flush };
}
```

- [ ] **Step 5: `server/public/js/content-view.js` anlegen**

```js
/*
 * Inhalte des aktiven Profils als Merkmale an #viewer: data-<baustein> und
 * data-<baustein>-<option>. Ein- und Ausblenden erledigt damit style.css -
 * eine neue Option im Katalog braucht meist nur eine CSS-Regel.
 *
 * Namen werden klein geschrieben: HTML macht das bei Attributen ohnehin, so
 * stimmen JS und CSS sicher ueberein (letzterDart → data-scheibe-letzterdart).
 */

export function contentAttributes(catalog, content) {
  const attrs = {};
  for (const part of catalog.parts) {
    const value = content[part.id] ?? {};
    attrs[`data-${part.id}`.toLowerCase()] = (value.on ?? part.default) ? "on" : "off";
    for (const option of part.options) {
      const raw = value[option.id] ?? option.default;
      attrs[`data-${part.id}-${option.id}`.toLowerCase()] =
        option.type === "toggle" ? (raw ? "on" : "off") : String(raw);
    }
  }
  return attrs;
}

export function applyContent(el, catalog, content) {
  for (const [name, value] of Object.entries(contentAttributes(catalog, content))) {
    el.setAttribute(name, value);
  }
}
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run test/profile-sync.test.js test/content-view.test.js`
Expected: `profile-sync` PASS. In `content-view` schlägt nur „jede Option wirkt im Stylesheet“ fehl, weil die CSS-Regeln aus Schritt 9 noch fehlen.

- [ ] **Step 7: Spielinfo-Chips kennzeichnen** – in `server/public/js/blocks.js`

```js
export function renderHead(el, match) {
  el.replaceChildren(...matchChips(match).map((text) => node("span", "chip", text)));
}
```
→
```js
/* Reihenfolge wie matchChips; die Schluessel sind die Optionen der Spielinfo im Katalog. */
const CHIP_KEYS = ["punktzahl", "legs", "modus"];

export function renderHead(el, match) {
  el.replaceChildren(
    ...matchChips(match).map((text, index) => {
      const chip = node("span", "chip", text);
      chip.dataset.chip = CHIP_KEYS[index];
      return chip;
    }),
  );
}
```

- [ ] **Step 8: `index.html` anpassen**

`<section class="block" data-block="kopf">` → `<section class="block" data-block="spielinfo">`.

In der Werkzeugleiste die beiden Knöpfe löschen:

```html
        <button type="button" data-mode="light">Nur Licht</button>
        <button type="button" data-mode="drawn">Gezeichnet</button>
```

- [ ] **Step 9: `style.css` anpassen**

Den Kommentar und die Regel

```css
/* Ohne Spiel ist alles schwarz - ausser beim Einrichten. */
.viewer:not([data-phase="playing"]):not(.is-editing):not(.is-remote-editing) .block {
  visibility: hidden;
}
```
ersetzen durch
```css
/* Ohne Spiel ist alles schwarz - beim Einstellen zeigt app.js Beispieldaten. */
.viewer:not([data-phase="playing"]) .block {
  visibility: hidden;
}
```

Die Regel `.edit-toolbar button[aria-pressed="true"] { … }` löschen.

Vor `/* --- Hinweise ---` einfügen:

```css
/* --- Inhalte (aus dem aktiven Profil, siehe content-view.js) -------------- */

/* Hintergrund wie die Autodarts-Spielansicht, eigener Nachbau: dunkles Blau
   mit Verlauf und grossen, schwachen Winkeln. Aus = schwarz, kein Licht. */
.viewer[data-hintergrund="on"] {
  background:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90' preserveAspectRatio='xMidYMid slice'><polygon points='-10,0 18,0 50,45 18,90 -10,90 22,45' fill='rgba(70,120,255,0.07)'/><polygon points='112,90 140,90 172,45 140,0 112,0 144,45' fill='rgba(70,120,255,0.04)'/></svg>")
      center / cover no-repeat,
    radial-gradient(ellipse at 75% 15%, rgba(40, 80, 200, 0.35), transparent 60%),
    linear-gradient(160deg, #050d26 0%, #0a1b4a 55%, #06112f 100%);
}

.viewer[data-scheibe="off"] .board-block,
.viewer[data-aufnahme="off"] [data-block="aufnahme"],
.viewer[data-spielinfo="off"] [data-block="spielinfo"],
.viewer[data-spieler="off"] .player-block {
  display: none;
}

.viewer[data-scheibe-darts="off"] .board-darts,
.viewer[data-scheibe-letzterdart="off"] .board-highlights {
  display: none;
}

/* Beim Ausrichten bleiben die Zahlen als Hilfe stehen. */
.viewer[data-scheibe-zahlenring="off"]:not(.is-layout) .board-numbers {
  display: none;
}

/* Die Aufnahmeleiste behaelt ihre Felder, nur der Inhalt verschwindet. */
.viewer[data-aufnahme-darts="off"] .turn-dart,
.viewer[data-aufnahme-summe="off"] .turn-total {
  visibility: hidden;
}

.viewer[data-spielinfo-punktzahl="off"] [data-chip="punktzahl"],
.viewer[data-spielinfo-legs="off"] [data-chip="legs"],
.viewer[data-spielinfo-modus="off"] [data-chip="modus"] {
  display: none;
}

/* Teile der Karte fallen weg, die Karte behaelt ihre Groesse. */
.viewer[data-spieler-profilbild="off"] .card-avatar,
.viewer[data-spieler-name="off"] .card-name,
.viewer[data-spieler-flagge="off"] .card-flag,
.viewer[data-spieler-rest="off"] .card-score,
.viewer[data-spieler-legs="off"] .card-legs,
.viewer[data-spieler-checkout="off"] .card-checkout,
.viewer[data-spieler-average="off"] .card-averages,
.viewer[data-spieler-dartzahl="off"] .card-darts {
  display: none;
}

/* Ohne Kartenflaeche leuchtet nur die Schrift; wer dran ist, zeigt die Farbe. */
.viewer[data-spieler-flaeche="off"] .card {
  background: none;
}

.viewer[data-spieler-flaeche="off"] .card.is-active :is(.card-score, .card-name),
.viewer[data-spieler-flaeche="off"] .card.is-winner :is(.card-score, .card-name) {
  background: linear-gradient(135deg, var(--active-from), var(--active-to));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.viewer[data-spieler-flaeche="off"] .card.is-winner :is(.card-score, .card-name) {
  background-image: linear-gradient(135deg, var(--winner-from), var(--winner-to));
}

.viewer[data-spieler-flaeche="off"] .card.is-busted .card-score {
  color: var(--bust);
}
```

- [ ] **Step 10: Editor auf Profile umstellen** – in `server/public/js/editor.js`

Die Zeile `const SEND_INTERVAL_MS = 100;` löschen. Alles ab `export function createEditor(` bis zum Dateiende ersetzen durch:

```js
export function createEditor({ viewer, sync, getProfileId, getLayout, applyLocal, onEditingChange }) {
  const button = viewer.querySelector("#edit-toggle");
  const status = viewer.querySelector("#edit-status");
  let editing = false;
  let selected = "scheibe";
  let keepalive = null;
  let hideTimer = null;

  /* Geht gedrosselt an den Pi; editing sagt allen Geraeten, dass ausgerichtet wird. */
  function send(patch = {}) {
    sync.queue(getProfileId(), { ...patch, editing: editing ? "layout" : null });
  }

  function change(mutate) {
    const layout = structuredClone(getLayout());
    mutate(layout);
    applyLocal(layout);
    send({ layout });
  }

  function select(id) {
    selected = id;
    for (const block of viewer.querySelectorAll(".block[data-block]")) {
      block.classList.toggle("is-selected", block.dataset.block === id);
    }
  }

  function setEditing(next) {
    if (!getLayout()) return; // noch kein Profil vom Pi
    editing = next;
    viewer.classList.toggle("is-editing", editing);
    clearInterval(keepalive);
    if (editing) {
      keepalive = setInterval(() => send(), KEEPALIVE_MS);
      select(selected);
    } else {
      // Sofort weg - der Ausblende-Timer ist beim Bearbeiten meist schon
      // abgelaufen, sonst bliebe der Knopf an der Wand stehen.
      clearTimeout(hideTimer);
      button.classList.remove("is-visible");
      button.blur();
    }
    onEditingChange(editing);
    send();
    sync.flush();
  }

  /* Der Knopf wuerde sonst an die Wand projiziert: nur bei Mausbewegung zeigen. */
  window.addEventListener("pointermove", () => {
    button.classList.add("is-visible");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!editing) button.classList.remove("is-visible");
    }, BUTTON_HIDE_MS);
  });

  button.addEventListener("click", () => setEditing(!editing));

  viewer.addEventListener("pointerdown", (event) => {
    if (!editing || event.button !== 0) return;
    const block = event.target.closest(".block[data-block]");
    if (!block) return;
    event.preventDefault();
    const id = block.dataset.block;
    select(id);

    const handle = event.target.closest("[data-handle]")?.dataset.handle ?? "move";
    const start = { x: event.clientX, y: event.clientY, layout: structuredClone(getLayout()) };
    const rect = block.getBoundingClientRect();
    const anchor =
      id === "scheibe"
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: rect.left, y: rect.top };

    block.setPointerCapture(event.pointerId);
    const onMove = (move) => change((layout) => drag(layout, id, handle, start, move, anchor));
    const onUp = () => {
      block.removeEventListener("pointermove", onMove);
      block.removeEventListener("pointerup", onUp);
      block.removeEventListener("pointercancel", onUp);
      sync.flush();
    };
    block.addEventListener("pointermove", onMove);
    block.addEventListener("pointerup", onUp);
    block.addEventListener("pointercancel", onUp);
  });

  viewer.addEventListener(
    "wheel",
    (event) => {
      if (!editing || !event.target.closest('[data-block="scheibe"]')) return;
      event.preventDefault();
      // Mit Umschalt melden manche Browser die Bewegung als deltaX.
      const direction = Math.sign(event.deltaY || event.deltaX);
      const step = event.shiftKey ? 0.1 : 1;
      select("scheibe");
      change((layout) => {
        layout.board.diameter = clamp(layout.board.diameter - direction * step, 5, 400);
      });
    },
    { passive: false },
  );

  window.addEventListener("keydown", (event) => {
    if (!editing) return;
    if (event.key === "Escape") {
      setEditing(false);
      return;
    }
    const action = keyAction(event, selected);
    if (!action) return;
    event.preventDefault();
    change(action);
  });

  return {
    isEditing: () => editing,
    setStatus: (text) => {
      status.textContent = text;
    },
  };
}
```

Den Kopfkommentar der Datei anpassen: „der sie an alle Viewer mit demselben Anzeigenamen weiterreicht“ → „der sie an alle Viewer weiterreicht“.

- [ ] **Step 11: `server/public/js/app.js` ganz ersetzen**

```js
/*
 * Viewer: verbindet sich mit dem Pi und zeichnet, was er schickt.
 *
 * Spielregeln kennt der Viewer nicht - Rest, Bust, Checkout und Sieger kommen
 * fertig vom Pi. Was angezeigt wird und wo, steht im aktiven Profil.
 */
import { renderHead, renderPlayers, renderTurn } from "./blocks.js";
import { createBoard } from "./board.js";
import { applyContent } from "./content-view.js";
import { createEditor } from "./editor.js";
import { applyLayout } from "./layout-view.js";
import { createSync } from "./profile-sync.js";
import { SAMPLE_STATE } from "./sample-state.js";

const viewer = document.getElementById("viewer");
const boardSvg = document.getElementById("board-svg");
const messageEl = document.getElementById("message");
const headEl = viewer.querySelector('[data-block="spielinfo"] .head');
const turnEl = viewer.querySelector('[data-block="aufnahme"] .turn');
const playerSlots = [1, 2, 3, 4, 5, 6].map((n) => viewer.querySelector(`[data-block="spieler-${n}"]`));

const board = createBoard(boardSvg);

let state = { phase: "idle" };
/* Vom Pi: Katalog, aktives Profil, Profilliste und wer gerade einstellt. */
const view = { catalog: null, profile: null, profiles: [], remoteEditing: null };

const sync = createSync({ onStatus: (text) => editor.setStatus(text) });

const editor = createEditor({
  viewer,
  sync,
  getProfileId: () => view.profile?.id,
  getLayout: () => view.profile?.layout ?? null,
  applyLocal: (layout) => {
    view.profile = { ...view.profile, layout };
    applyLayout(viewer, layout);
    render();
  },
  onEditingChange: () => render(),
});

/* null, "inhalte" oder "layout" - auf diesem Geraet oder einem anderen. */
const editStep = () => (editor.isEditing() ? "layout" : view.remoteEditing);

/* Beim Einstellen ohne laufendes Spiel gaebe es sonst nichts zu sehen. */
function shownState() {
  return editStep() && state.phase !== "playing" ? SAMPLE_STATE : state;
}

function render() {
  const shown = shownState();
  const step = editStep();
  viewer.dataset.phase = shown.phase;
  viewer.classList.toggle("is-layout", step === "layout");
  if (view.catalog && view.profile) applyContent(viewer, view.catalog, view.profile.content);
  messageEl.textContent =
    shown.phase === "idle"
      ? "Warte auf ein Spiel"
      : shown.phase === "unsupported"
        ? `${shown.variant} wird noch nicht unterstützt`
        : "";
  boardSvg.dataset.mode = step === "layout" ? "lines" : (view.profile?.content.scheibe?.darstellung ?? "light");
  board.render(shown);
  if (shown.phase === "playing") {
    renderHead(headEl, shown.match);
    renderTurn(turnEl, shown.turn);
    renderPlayers(playerSlots, shown.players);
  }
}

function onMessage(message) {
  if (message.type === "state") state = message.state;
  if (message.type === "catalog") view.catalog = message.catalog;
  if (message.type === "profile") {
    // Beim Ausrichten gilt das eigene Layout - der Pi hinkt bis zu 100 ms hinterher.
    const keepLocal = editor.isEditing() && message.profile.id === view.profile?.id;
    const layout = keepLocal ? view.profile.layout : message.profile.layout;
    view.profile = { ...message.profile, layout };
    view.profiles = message.profiles;
    view.remoteEditing = message.editing;
    applyLayout(viewer, layout);
  }
  render();
}

/* --- Verbindung mit automatischem Wiederaufbau --------------------------- */

let retryDelay = 500;

function connect() {
  const socket = new WebSocket(`ws://${location.host}/ws`);

  socket.addEventListener("open", () => {
    retryDelay = 500;
    viewer.classList.remove("is-offline");
  });

  socket.addEventListener("message", (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (error) {
      console.error("Ungueltige Nachricht vom Pi", error);
    }
  });

  // Der letzte Stand bleibt stehen; nur ein kleiner Hinweis in der Ecke.
  socket.addEventListener("close", () => {
    viewer.classList.add("is-offline");
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10000);
  });
}

render();
connect();
```

- [ ] **Step 12: Alten Anzeigenamen löschen**

```bash
git rm public/js/display-name.js
```

- [ ] **Step 13: Alle Tests**

Run: `npm test && npm run typecheck`
Expected: alle PASS.

- [ ] **Step 14: Im Browser prüfen**

```bash
npm run replay -- test/fixtures/autodarts-2026-10-08.ndjson --instant --stop 139
```

(Läuft im Hintergrund weiter. Falls Port 8743 belegt ist: in PowerShell `Get-NetTCPConnection -LocalPort 8743 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`.)

Mit DevTools-MCP oder Playwright `http://localhost:8743/` öffnen und prüfen:
1. Spiel mit zwei Karten, Scheibe „Nur Licht“, **keine** Spielinfo (Vorlage Projektion), keine Fehler in der Konsole.
2. In der Konsole `curl` nachstellen: `fetch("/api/profiles/standard",{method:"PUT",headers:{"X-Raspdarts":"1","Content-Type":"application/json"},body:JSON.stringify({content:{hintergrund:{on:true},scheibe:{darstellung:"drawn"},spieler:{flaeche:false}}})})`. Das Bild zeigt sofort den blauen Hintergrund, die gezeichnete Scheibe und Karten ohne Fläche mit farbigem Rest beim aktiven Spieler.
3. Mit `{content:{spieler:{on:false}}}` verschwinden die Karten; mit `{content:{spieler:{on:true}, spielinfo:{on:true, modus:false}}}` erscheinen die Chips „301“ und „Erster bis …“ ohne „SI-SO“.
4. „Layout“ → Ausrichten wie bisher: Scheibe als Linien mit Zahlen, Ziehen speichert (Neu laden: Position bleibt).
5. Zweites Fenster: Änderungen aus 2. und 4. erscheinen dort live.

Danach den Replay-Prozess beenden.

- [ ] **Step 15: Commit**

```bash
git add -A public test
git commit -m "Viewer-Profile: Viewer zeichnet nach dem aktiven Profil, Hintergrund und Karten ohne Flaeche"
```

---

### Task 6: Einrasten beim Drehen

**Files:**
- Create: `server/public/js/rotation.js`
- Modify: `server/public/js/editor.js`, `server/public/index.html`
- Test: `server/test/rotation.test.js`

**Interfaces:**
- Produces: `SNAP_ANGLES = [-180, -90, 0, 90, 180]`, `SNAP_DEG = 3`, `snapRotation(deg, { free = false } = {}) → number`

- [ ] **Step 1: Failing Test schreiben** – `server/test/rotation.test.js`

```js
import { describe, expect, test } from "vitest";
import { SNAP_DEG, snapRotation } from "../public/js/rotation.js";

describe("snapRotation", () => {
  test.each([
    [2.9, 0],
    [-2.9, 0],
    [0.4, 0],
    [3.1, 3.1],
    [-3, -3],
    [88, 90],
    [-91.5, -90],
    [178, 180],
    [-178, -180],
    [45, 45],
  ])("%d° → %d°", (deg, snapped) => {
    expect(snapRotation(deg)).toBe(snapped);
  });

  test("rastet erst unter 3 Grad ein", () => {
    expect(SNAP_DEG).toBe(3);
    expect(snapRotation(3)).toBe(3);
  });

  test("mit Alt (free) bleibt der Winkel unveraendert", () => {
    expect(snapRotation(2.9, { free: true })).toBe(2.9);
    expect(snapRotation(-178, { free: true })).toBe(-178);
  });
});
```

- [ ] **Step 2: Test laufen lassen – muss fehlschlagen**

Run: `npx vitest run test/rotation.test.js`
Expected: FAIL, Modul nicht auflösbar.

- [ ] **Step 3: `server/public/js/rotation.js` anlegen**

```js
/*
 * Einrasten beim Drehen der Scheibe mit der Maus: nahe 0, 90, 180 und -90
 * Grad springt sie auf den runden Winkel. Mit Alt dreht man frei; die Tastatur
 * rastet nie ein, damit Feinschritte um 0 Grad moeglich bleiben.
 */

export const SNAP_ANGLES = [-180, -90, 0, 90, 180];
/** Abstand in Grad, unter dem eingerastet wird. */
export const SNAP_DEG = 3;

export function snapRotation(deg, { free = false } = {}) {
  if (free) return deg;
  for (const target of SNAP_ANGLES) {
    if (Math.abs(deg - target) < SNAP_DEG) return target;
  }
  return deg;
}
```

- [ ] **Step 4: Test laufen lassen – muss bestehen**

Run: `npx vitest run test/rotation.test.js`
Expected: PASS.

- [ ] **Step 5: Im Editor verwenden** – `server/public/js/editor.js`

Nach dem Kopfkommentar einfügen:

```js
import { snapRotation } from "./rotation.js";
```

In `drag()` ersetzen:

```js
      board.rotation = normalizeAngle(from.rotation + turned);
```
→
```js
      board.rotation = snapRotation(normalizeAngle(from.rotation + turned), { free: move.altKey });
```

(`keyAction` mit Q/E bleibt unverändert.)

- [ ] **Step 6: Hinweistext** – in `server/public/index.html` den Text in `.edit-hint` ersetzen durch:

```html
          Ziehen: verschieben · Ecke: Größe · Kreis: drehen (rastet bei 0°/90° ein, Alt: frei) ·
          Mausrad: Größe · Pfeile, +/−, Q/E: fein (Umschalt: grob) · Esc: fertig
```

- [ ] **Step 7: Alle Tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add public/js/rotation.js public/js/editor.js public/index.html test/rotation.test.js
git commit -m "Viewer: Scheibe rastet beim Drehen bei 0, 90, 180 und -90 Grad ein"
```

---

### Task 7: Seitenleiste „Einstellungen“

**Files:**
- Create: `server/public/js/settings-panel.js`, `server/public/js/settings.js`
- Modify: `server/public/js/editor.js`, `server/public/js/app.js` (ganz ersetzen), `server/public/index.html` (ganz ersetzen), `server/public/style.css`

**Interfaces:**
- Consumes: `api` (Task 5), `createSync` (Task 5), `snapRotation` (Task 6), Endpunkte aus Task 4.
- Produces:
  - `settings-panel.js`: `createPanel(root, handlers) → { render(catalog, profile, profiles), cancelAsk(): boolean, setStatus(text) }`; `handlers = { onContent(content), onSelect(id), onCreate(name, template), onRename(name), onDelete(), onTemplate(template), onNext(), onClose() }`
  - `settings.js`: `createSettings({ viewer, editor, sync, getView, applyLocalContent, onChange }) → { step(): null | "inhalte" | "layout", open(step), refresh(), setStatus(text) }`
  - `editor.js` (endgültig): `createEditor({ viewer, sync, getProfileId, getLayout, applyLocal, onBack, onDone }) → { setActive(on), isEditing(), setStatus(text) }`
  - HTML: Knopf `#settings-toggle` „Einstellungen“, Leiste `#settings`, Werkzeugleiste mit `data-action="back"` und `data-action="done"`

- [ ] **Step 1: `server/public/js/settings-panel.js` anlegen**

```js
/*
 * Seitenleiste, Schritt "Inhalte": Profil, Vorlagen und die Liste der
 * Bausteine. Die Liste entsteht aus dem Katalog vom Pi - eine neue Option im
 * Katalog erscheint hier ohne Aenderung an dieser Datei.
 *
 * Kennt den Pi nicht: alles, was der Nutzer tut, geht an die handlers.
 */

function node(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  el.append(...children);
  return el;
}

function button(text, onClick, props = {}) {
  const el = node("button", { type: "button", textContent: text, ...props });
  el.addEventListener("click", onClick);
  return el;
}

export function createPanel(root, handlers) {
  let catalog = null;
  let profile = null;
  let profiles = [];
  let profilesKey = "";
  /* Offenes Formular oder offene Rueckfrage: { kind: "new" | "rename" | "confirm", ... } */
  let ask = null;
  const expanded = new Set(["scheibe"]);

  const select = node("select", { className: "settings-grow" });
  select.setAttribute("aria-label", "Aktives Profil");
  select.addEventListener("change", () => handlers.onSelect(select.value));

  const close = button("×", () => handlers.onClose(), { className: "settings-close", title: "Schließen" });
  close.setAttribute("aria-label", "Einstellungen schließen");

  const renameButton = button("Umbenennen", () => setAsk({ kind: "rename" }));
  const deleteButton = button("Löschen", () =>
    setAsk({ kind: "confirm", text: `Profil „${profile.name}“ löschen?`, yes: handlers.onDelete }),
  );

  const askArea = node("div", { className: "settings-ask", hidden: true });
  const templates = node("div", { className: "settings-row" });
  const list = node("div", { className: "settings-list" });
  const status = node("p", { className: "settings-status" });
  status.setAttribute("role", "status");

  root.replaceChildren(
    node("div", { className: "settings-row" }, [node("h2", { textContent: "Profil" }), close]),
    node("div", { className: "settings-row" }, [select]),
    node("div", { className: "settings-row" }, [button("Neu", () => setAsk({ kind: "new" })), renameButton, deleteButton]),
    askArea,
    node("h2", { textContent: "Vorlage" }),
    templates,
    node("h2", { textContent: "Anpassen" }),
    list,
    status,
    button("Weiter: Layout →", () => handlers.onNext(), { className: "settings-next" }),
  );

  function buildOption(part, option) {
    if (option.type === "toggle") {
      const input = node("input", { type: "checkbox" });
      Object.assign(input.dataset, { part: part.id, option: option.id });
      return node("label", { className: "part-option" }, [input, ` ${option.label}`]);
    }
    const choices = option.choices.map((choice) => {
      const input = node("input", { type: "radio", name: `${part.id}-${option.id}`, value: choice.id });
      Object.assign(input.dataset, { part: part.id, option: option.id });
      return node("label", {}, [input, ` ${choice.label}`]);
    });
    return node("fieldset", { className: "part-option" }, [node("legend", { textContent: option.label }), ...choices]);
  }

  function buildPart(part) {
    const toggle = node("input", { type: "checkbox" });
    toggle.dataset.part = part.id;
    const head = node("div", { className: "part-head" }, [node("label", {}, [toggle, ` ${part.label}`])]);
    const options = node(
      "div",
      { className: "part-options", hidden: !expanded.has(part.id) },
      part.options.map((option) => buildOption(part, option)),
    );
    if (part.options.length > 0) {
      const expand = button(options.hidden ? "▸" : "▾", () => {
        if (expanded.has(part.id)) expanded.delete(part.id);
        else expanded.add(part.id);
        options.hidden = !expanded.has(part.id);
        expand.textContent = options.hidden ? "▸" : "▾";
        expand.setAttribute("aria-expanded", String(!options.hidden));
      }, { className: "part-expand" });
      expand.setAttribute("aria-expanded", String(!options.hidden));
      expand.setAttribute("aria-label", `${part.label}: Einzelteile`);
      head.append(expand);
    }
    const section = node("section", { className: "part" }, [head, options]);
    section.dataset.part = part.id;
    return section;
  }

  function buildCatalog() {
    templates.replaceChildren(
      ...catalog.templates.map((template) =>
        button(template.label, () =>
          setAsk({
            kind: "confirm",
            text: `Inhalte von „${profile.name}“ auf „${template.label}“ zurücksetzen? Das Layout bleibt.`,
            yes: () => handlers.onTemplate(template.id),
          }),
        ),
      ),
    );
    list.replaceChildren(...catalog.parts.map(buildPart));
  }

  list.addEventListener("change", (event) => {
    const input = event.target;
    const { part, option } = input.dataset;
    if (!part || !profile) return;
    const content = structuredClone(profile.content);
    if (!option) content[part].on = input.checked;
    else content[part][option] = input.type === "radio" ? input.value : input.checked;
    handlers.onContent(content);
  });

  function update() {
    // Die Auswahl nur neu bauen, wenn sich die Liste aendert - sonst klappt
    // eine gerade geoeffnete Auswahl bei jeder Nachricht vom Pi zu.
    const key = JSON.stringify(profiles);
    if (key !== profilesKey) {
      profilesKey = key;
      select.replaceChildren(...profiles.map((p) => node("option", { value: p.id, textContent: p.name })));
    }
    select.value = profile.id;
    deleteButton.disabled = profiles.length <= 1;
    deleteButton.title = deleteButton.disabled ? "Das letzte Profil bleibt" : "";

    for (const input of list.querySelectorAll("input")) {
      const value = profile.content[input.dataset.part];
      if (!value) continue;
      const option = input.dataset.option;
      if (!option) input.checked = value.on;
      else if (input.type === "radio") input.checked = value[option] === input.value;
      else input.checked = value[option] === true;
    }
    for (const section of list.querySelectorAll(".part")) {
      const on = profile.content[section.dataset.part]?.on ?? true;
      section.classList.toggle("is-off", !on);
      for (const input of section.querySelectorAll(".part-options input")) input.disabled = !on;
    }
  }

  function setAsk(next) {
    ask = next;
    renderAsk();
  }

  function renderAsk() {
    askArea.hidden = ask === null;
    if (!ask) {
      askArea.replaceChildren();
      return;
    }
    if (ask.kind === "confirm") {
      const yes = ask.yes;
      askArea.replaceChildren(
        node("p", { textContent: ask.text }),
        node("div", { className: "settings-row" }, [
          button("Ja", () => {
            setAsk(null);
            yes();
          }),
          button("Abbrechen", () => setAsk(null)),
        ]),
      );
      return;
    }
    const kind = ask.kind;
    const name = node("input", {
      type: "text",
      maxLength: 40,
      required: true,
      value: kind === "rename" ? profile.name : "",
      placeholder: "Name",
    });
    const fieldsList = [node("label", {}, ["Name ", name])];
    let template = null;
    if (kind === "new") {
      template = node(
        "select",
        {},
        catalog.templates.map((t) => node("option", { value: t.id, textContent: t.label })),
      );
      fieldsList.push(node("label", {}, ["Vorlage ", template]));
    }
    const form = node("form", {}, [
      ...fieldsList,
      node("div", { className: "settings-row" }, [
        node("button", { type: "submit", textContent: kind === "new" ? "Anlegen" : "Speichern" }),
        button("Abbrechen", () => setAsk(null)),
      ]),
    ]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      setAsk(null);
      if (kind === "new") handlers.onCreate(name.value, template.value);
      else handlers.onRename(name.value);
    });
    askArea.replaceChildren(form);
    name.focus();
  }

  return {
    render(nextCatalog, nextProfile, nextProfiles) {
      const freshCatalog = nextCatalog !== catalog;
      catalog = nextCatalog;
      profile = nextProfile;
      profiles = nextProfiles;
      if (freshCatalog) buildCatalog();
      update();
    },
    /** Schliesst ein offenes Formular oder eine Rueckfrage; true, wenn eins offen war. */
    cancelAsk() {
      if (!ask) return false;
      setAsk(null);
      return true;
    },
    setStatus(text) {
      status.textContent = text;
    },
  };
}
```

- [ ] **Step 2: `server/public/js/settings.js` anlegen**

```js
/*
 * Einstellungen in zwei Schritten: "inhalte" (Seitenleiste) und "layout"
 * (Ausrichten, editor.js). Haelt den Schritt, spricht mit dem Pi und meldet
 * ihn als editing - dann zeigen alle Geraete ohne Spiel Beispieldaten, im
 * Layout-Schritt die Scheibe als Linien.
 */
import { api } from "./profile-api.js";
import { createPanel } from "./settings-panel.js";

/* Der Pi beendet editing nach 60 s ohne Meldung; solange eingestellt wird,
   haelt ein Lebenszeichen es an. */
const KEEPALIVE_MS = 30_000;
/* Der Knopf wuerde sonst an die Wand projiziert: nur bei Mausbewegung zeigen. */
const BUTTON_HIDE_MS = 3000;

export function createSettings({ viewer, editor, sync, getView, applyLocalContent, onChange }) {
  const button = viewer.querySelector("#settings-toggle");
  const root = viewer.querySelector("#settings");
  let step = null;
  let keepalive = null;
  let hideTimer = null;

  const profileId = () => getView().profile?.id;
  const path = (suffix = "") => `/api/profiles/${encodeURIComponent(profileId())}${suffix}`;
  const report = (error) => panel.setStatus(`Fehlgeschlagen: ${error.message}`);

  /* Nach einem Wechsel des aktiven Profils gilt editing fuer das neue. */
  async function afterSwitch() {
    const { active } = await api("GET", "/api/profiles");
    sync.queue(active, { editing: step });
    sync.flush();
  }

  const panel = createPanel(root, {
    onContent(content) {
      applyLocalContent(content);
      sync.queue(profileId(), { content, editing: step });
    },
    onSelect(id) {
      sync.flush();
      api("PUT", "/api/active-profile", { id }).then(afterSwitch).catch(report);
    },
    onCreate(name, template) {
      sync.flush();
      api("POST", "/api/profiles", { name, template }).then(afterSwitch).catch(report);
    },
    onRename(name) {
      sync.queue(profileId(), { name, editing: step });
      sync.flush();
    },
    onDelete() {
      sync.flush();
      api("DELETE", path()).then(afterSwitch).catch(report);
    },
    onTemplate(template) {
      sync.flush();
      api("POST", path("/reset"), { template }).catch(report);
    },
    onNext: () => open("layout"),
    onClose: () => open(null),
  });

  function refresh() {
    const { catalog, profile, profiles } = getView();
    if (catalog && profile) panel.render(catalog, profile, profiles);
  }

  function open(next) {
    if (!getView().profile) return; // noch kein Profil vom Pi
    step = next;
    root.hidden = step !== "inhalte";
    viewer.classList.toggle("is-settings", step !== null);
    clearInterval(keepalive);
    if (step) {
      keepalive = setInterval(() => sync.queue(profileId(), { editing: step }), KEEPALIVE_MS);
    } else {
      // Sofort weg - der Ausblende-Timer ist meist schon abgelaufen, sonst
      // bliebe der Knopf an der Wand stehen.
      clearTimeout(hideTimer);
      button.classList.remove("is-visible");
      button.blur();
    }
    sync.queue(profileId(), { editing: step });
    sync.flush();
    refresh();
    onChange();
    // Erst nach dem Zeichnen: der Editor waehlt einen sichtbaren Block aus.
    editor.setActive(step === "layout");
  }

  window.addEventListener("pointermove", () => {
    button.classList.add("is-visible");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!step) button.classList.remove("is-visible");
    }, BUTTON_HIDE_MS);
  });

  button.addEventListener("click", () => open(step ? null : "inhalte"));

  window.addEventListener("keydown", (event) => {
    if (step !== "inhalte" || event.key !== "Escape") return;
    // Erst ein offenes Formular schliessen, dann die Leiste.
    if (!panel.cancelAsk()) open(null);
  });

  return {
    step: () => step,
    open,
    refresh,
    setStatus: (text) => panel.setStatus(text),
  };
}
```

- [ ] **Step 3: Editor auf den Layout-Schritt reduzieren** – in `server/public/js/editor.js`

Kopfkommentar ersetzen durch:

```js
/*
 * Schritt "Layout": Scheibe und Bloecke verschieben, skalieren, drehen.
 *
 * Jede Aenderung gilt sofort im eigenen Bild und geht gedrosselt an den Pi
 * (profile-sync.js), der sie an alle Viewer weiterreicht - so folgt der Beamer
 * live, waehrend man am Laptop zieht. Ausgelegt auf Maus und Tastatur.
 * Knopf, Seitenleiste und Lebenszeichen gehoeren zu settings.js.
 */
```

Die Konstanten `KEEPALIVE_MS` (mit Kommentar) und `BUTTON_HIDE_MS` löschen. Alles ab `export function createEditor(` bis zum Dateiende ersetzen durch:

```js
export function createEditor({ viewer, sync, getProfileId, getLayout, applyLocal, onBack, onDone }) {
  const toolbar = viewer.querySelector("#edit-toolbar");
  const status = viewer.querySelector("#edit-status");
  let editing = false;
  let selected = "scheibe";

  function change(mutate) {
    const layout = structuredClone(getLayout());
    mutate(layout);
    applyLocal(layout);
    sync.queue(getProfileId(), { layout, editing: "layout" });
  }

  function select(id) {
    selected = id;
    for (const block of viewer.querySelectorAll(".block[data-block]")) {
      block.classList.toggle("is-selected", block.dataset.block === id);
    }
  }

  /* Ausgeschaltete Bausteine sind unsichtbar - die Auswahl springt auf einen
     sichtbaren, sonst schoebe die Tastatur etwas, das man nicht sieht. */
  function selectVisible() {
    const shown = [...viewer.querySelectorAll(".block[data-block]")].filter(
      (block) => block.getClientRects().length > 0,
    );
    const current = shown.find((block) => block.dataset.block === selected);
    select(current ? selected : (shown[0]?.dataset.block ?? selected));
  }

  function setActive(next) {
    editing = next;
    viewer.classList.toggle("is-editing", editing);
    if (editing) selectVisible();
  }

  toolbar.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "back") onBack();
    if (action === "done") onDone();
  });

  viewer.addEventListener("pointerdown", (event) => {
    if (!editing || event.button !== 0) return;
    const block = event.target.closest(".block[data-block]");
    if (!block) return;
    event.preventDefault();
    const id = block.dataset.block;
    select(id);

    const handle = event.target.closest("[data-handle]")?.dataset.handle ?? "move";
    const start = { x: event.clientX, y: event.clientY, layout: structuredClone(getLayout()) };
    const rect = block.getBoundingClientRect();
    const anchor =
      id === "scheibe"
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: rect.left, y: rect.top };

    block.setPointerCapture(event.pointerId);
    const onMove = (move) => change((layout) => drag(layout, id, handle, start, move, anchor));
    const onUp = () => {
      block.removeEventListener("pointermove", onMove);
      block.removeEventListener("pointerup", onUp);
      block.removeEventListener("pointercancel", onUp);
      sync.flush();
    };
    block.addEventListener("pointermove", onMove);
    block.addEventListener("pointerup", onUp);
    block.addEventListener("pointercancel", onUp);
  });

  viewer.addEventListener(
    "wheel",
    (event) => {
      if (!editing || !event.target.closest('[data-block="scheibe"]')) return;
      event.preventDefault();
      // Mit Umschalt melden manche Browser die Bewegung als deltaX.
      const direction = Math.sign(event.deltaY || event.deltaX);
      const step = event.shiftKey ? 0.1 : 1;
      select("scheibe");
      change((layout) => {
        layout.board.diameter = clamp(layout.board.diameter - direction * step, 5, 400);
      });
    },
    { passive: false },
  );

  window.addEventListener("keydown", (event) => {
    if (!editing) return;
    if (event.key === "Escape") {
      onDone();
      return;
    }
    const action = keyAction(event, selected);
    if (!action) return;
    event.preventDefault();
    change(action);
  });

  return {
    setActive,
    isEditing: () => editing,
    setStatus: (text) => {
      status.textContent = text;
    },
  };
}
```

- [ ] **Step 4: `server/public/js/app.js` ganz ersetzen**

```js
/*
 * Viewer: verbindet sich mit dem Pi und zeichnet, was er schickt.
 *
 * Spielregeln kennt der Viewer nicht - Rest, Bust, Checkout und Sieger kommen
 * fertig vom Pi. Was angezeigt wird und wo, steht im aktiven Profil.
 */
import { renderHead, renderPlayers, renderTurn } from "./blocks.js";
import { createBoard } from "./board.js";
import { applyContent } from "./content-view.js";
import { createEditor } from "./editor.js";
import { applyLayout } from "./layout-view.js";
import { createSync } from "./profile-sync.js";
import { SAMPLE_STATE } from "./sample-state.js";
import { createSettings } from "./settings.js";

const viewer = document.getElementById("viewer");
const boardSvg = document.getElementById("board-svg");
const messageEl = document.getElementById("message");
const headEl = viewer.querySelector('[data-block="spielinfo"] .head');
const turnEl = viewer.querySelector('[data-block="aufnahme"] .turn');
const playerSlots = [1, 2, 3, 4, 5, 6].map((n) => viewer.querySelector(`[data-block="spieler-${n}"]`));

const board = createBoard(boardSvg);

let state = { phase: "idle" };
/* Vom Pi: Katalog, aktives Profil, Profilliste und wer gerade einstellt. */
const view = { catalog: null, profile: null, profiles: [], remoteEditing: null };

const sync = createSync({
  onStatus: (text) => {
    editor.setStatus(text);
    settings.setStatus(text);
  },
});

const editor = createEditor({
  viewer,
  sync,
  getProfileId: () => view.profile?.id,
  getLayout: () => view.profile?.layout ?? null,
  applyLocal: (layout) => {
    view.profile = { ...view.profile, layout };
    applyLayout(viewer, layout);
    render();
  },
  onBack: () => settings.open("inhalte"),
  onDone: () => settings.open(null),
});

const settings = createSettings({
  viewer,
  editor,
  sync,
  getView: () => view,
  applyLocalContent: (content) => {
    view.profile = { ...view.profile, content };
    render();
  },
  onChange: () => render(),
});

/* null, "inhalte" oder "layout" - auf diesem Geraet oder einem anderen. */
const editStep = () => settings.step() ?? view.remoteEditing;

/* Beim Einstellen ohne laufendes Spiel gaebe es sonst nichts zu sehen. */
function shownState() {
  return editStep() && state.phase !== "playing" ? SAMPLE_STATE : state;
}

function render() {
  const shown = shownState();
  const step = editStep();
  viewer.dataset.phase = shown.phase;
  viewer.classList.toggle("is-layout", step === "layout");
  if (view.catalog && view.profile) applyContent(viewer, view.catalog, view.profile.content);
  messageEl.textContent =
    shown.phase === "idle"
      ? "Warte auf ein Spiel"
      : shown.phase === "unsupported"
        ? `${shown.variant} wird noch nicht unterstützt`
        : "";
  boardSvg.dataset.mode = step === "layout" ? "lines" : (view.profile?.content.scheibe?.darstellung ?? "light");
  board.render(shown);
  if (shown.phase === "playing") {
    renderHead(headEl, shown.match);
    renderTurn(turnEl, shown.turn);
    renderPlayers(playerSlots, shown.players);
  }
}

function onMessage(message) {
  if (message.type === "state") state = message.state;
  if (message.type === "catalog") view.catalog = message.catalog;
  if (message.type === "profile") {
    // Beim Ausrichten gilt das eigene Layout - der Pi hinkt bis zu 100 ms hinterher.
    const keepLocal = editor.isEditing() && message.profile.id === view.profile?.id;
    const layout = keepLocal ? view.profile.layout : message.profile.layout;
    view.profile = { ...message.profile, layout };
    view.profiles = message.profiles;
    view.remoteEditing = message.editing;
    applyLayout(viewer, layout);
  }
  settings.refresh();
  render();
}

/* --- Verbindung mit automatischem Wiederaufbau --------------------------- */

let retryDelay = 500;

function connect() {
  const socket = new WebSocket(`ws://${location.host}/ws`);

  socket.addEventListener("open", () => {
    retryDelay = 500;
    viewer.classList.remove("is-offline");
  });

  socket.addEventListener("message", (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (error) {
      console.error("Ungueltige Nachricht vom Pi", error);
    }
  });

  // Der letzte Stand bleibt stehen; nur ein kleiner Hinweis in der Ecke.
  socket.addEventListener("close", () => {
    viewer.classList.add("is-offline");
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10000);
  });
}

render();
connect();
```

- [ ] **Step 5: `server/public/index.html` ganz ersetzen**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Raspdarts Viewer</title>
    <link rel="icon" href="data:," />
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <!-- Dart-Symbol fuer leere Felder der Aufnahme und die Dartzahl der Karten. -->
    <svg width="0" height="0" style="position: absolute" aria-hidden="true">
      <symbol id="dart-icon" viewBox="0 0 100 24">
        <path d="M0 12 L22 10.5 L22 13.5 Z" fill="currentColor" />
        <rect x="22" y="8" width="30" height="8" rx="3" fill="currentColor" />
        <rect x="52" y="11" width="22" height="2" fill="currentColor" />
        <path d="M72 12 L100 2 L92 12 L100 22 Z" fill="currentColor" />
      </symbol>
    </svg>

    <main id="viewer" class="viewer" data-phase="idle">
      <!-- Jeder Block ist frei platzierbar. data-block ist der Schluessel im Layout. -->
      <section class="block" data-block="spielinfo">
        <div class="head"></div>
        <span class="handle handle-resize" data-handle="resize"></span>
      </section>

      <section class="block" data-block="aufnahme">
        <div class="turn"></div>
        <span class="handle handle-resize" data-handle="resize"></span>
      </section>

      <section class="block board-block" data-block="scheibe">
        <svg id="board-svg" class="board-svg" data-mode="light" aria-hidden="true"></svg>
        <span class="handle handle-resize" data-handle="resize"></span>
        <span class="handle handle-rotate" data-handle="rotate"></span>
      </section>

      <section class="block player-block" data-block="spieler-1"><span class="handle handle-resize" data-handle="resize"></span></section>
      <section class="block player-block" data-block="spieler-2"><span class="handle handle-resize" data-handle="resize"></span></section>
      <section class="block player-block" data-block="spieler-3"><span class="handle handle-resize" data-handle="resize"></span></section>
      <section class="block player-block" data-block="spieler-4"><span class="handle handle-resize" data-handle="resize"></span></section>
      <section class="block player-block" data-block="spieler-5"><span class="handle handle-resize" data-handle="resize"></span></section>
      <section class="block player-block" data-block="spieler-6"><span class="handle handle-resize" data-handle="resize"></span></section>

      <p id="message" class="message"></p>
      <p class="offline">Keine Verbindung zum Raspdarts-Dienst</p>

      <button id="settings-toggle" class="settings-toggle" type="button">Einstellungen</button>

      <!-- Schritt "Inhalte": wird von settings-panel.js aus dem Katalog gebaut. -->
      <aside id="settings" class="settings" aria-label="Einstellungen" hidden></aside>

      <!-- Schritt "Layout" -->
      <div id="edit-toolbar" class="edit-toolbar">
        <button type="button" data-action="back">← Inhalte</button>
        <span id="edit-status" class="edit-status" role="status"></span>
        <span class="edit-hint">
          Ziehen: verschieben · Ecke: Größe · Kreis: drehen (rastet bei 0°/90° ein, Alt: frei) ·
          Mausrad: Größe · Pfeile, +/−, Q/E: fein (Umschalt: grob) · Esc: fertig
        </span>
        <button type="button" data-action="done">Fertig</button>
      </div>
    </main>
    <script type="module" src="js/app.js"></script>
  </body>
</html>
```

- [ ] **Step 6: `style.css` anpassen**

Im Abschnitt `/* --- Bearbeiten --- */` die Selektoren umbenennen:
- `.edit-toggle {` → `.settings-toggle {`
- `.edit-toggle.is-visible {` → `.settings-toggle.is-visible {`
- `.viewer.is-editing .edit-toggle {` → `.viewer.is-settings .settings-toggle {`

Am Dateiende anhängen:

```css
/* --- Einstellungen (Seitenleiste) ------------------------------------------ */
/* Bedienoberflaeche fuer den Laptop: feste Pixelgroessen, gut lesbar. Liegt
   ueber dem Bild, damit es nicht springt. */

.settings {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  width: min(380px, 100vw);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #111;
  color: #ddd;
  border-left: 2px solid var(--edit);
  font: 500 14px/1.4 "Manrope", system-ui, sans-serif;
}

.settings[hidden] {
  display: none;
}

.settings h2 {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #999;
}

.settings-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.settings-grow {
  flex: 1;
  min-width: 0;
}

.settings select,
.settings input[type="text"] {
  background: #1b1b1b;
  color: #eee;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 6px 8px;
  font: inherit;
}

.settings button {
  background: #222;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 6px 12px;
  font: 600 14px "Manrope", sans-serif;
  cursor: pointer;
}

.settings button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.settings :is(button, input, select):focus-visible {
  outline: 2px solid var(--edit);
  outline-offset: 2px;
}

.settings .settings-close {
  margin-left: auto;
  padding: 2px 10px;
  font-size: 18px;
}

.settings-ask {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--edit);
  border-radius: 8px;
  background: #161a22;
}

.settings-ask[hidden] {
  display: none;
}

.settings-ask form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-ask label {
  display: flex;
  gap: 8px;
  align-items: center;
}

.settings-ask input[type="text"],
.settings-ask select {
  flex: 1;
  min-width: 0;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.part {
  border: 1px solid #262626;
  border-radius: 8px;
  padding: 6px 10px;
}

.part-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
}

.part-head label {
  display: flex;
  gap: 8px;
  align-items: center;
  font-weight: 700;
  cursor: pointer;
}

.settings .part-expand {
  padding: 2px 10px;
}

.part-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 4px 26px;
}

.part-options[hidden] {
  display: none;
}

.part-option {
  display: flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
}

fieldset.part-option {
  border: 0;
  flex-wrap: wrap;
  gap: 4px 12px;
}

fieldset.part-option legend {
  margin-bottom: 4px;
  color: #999;
  font-size: 13px;
}

.part.is-off .part-options {
  opacity: 0.45;
}

.settings input[type="checkbox"],
.settings input[type="radio"] {
  width: 16px;
  height: 16px;
  accent-color: var(--edit);
}

.settings-status {
  color: var(--red);
  font-weight: 700;
}

.settings-status:empty {
  display: none;
}

.settings .settings-next {
  margin-top: auto;
  background: var(--edit);
  border-color: var(--edit);
  color: #000;
}
```

- [ ] **Step 7: Alle Tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Im Browser prüfen** (Replay wie in Task 5, Schritt 14; zwei Fenster A und B auf `http://localhost:8743/`, Fenster B zeigt hier den „Beamer“)

1. **Knopf:** In A die Maus bewegen → „Einstellungen“ erscheint unten rechts und verschwindet nach 3 s. Klick → Leiste rechts; das Bild darunter springt nicht.
2. **Liste:** Die Bausteine Hintergrund, Scheibe (aufgeklappt), Aufnahme, Spielinfo und Spielerkarten werden angezeigt. Aufklappen zeigt die Optionen; ist ein Baustein aus, sind seine Optionen ausgegraut und nicht klickbar.
3. **Live und schnell klicken:** In A schnell nacheinander „Hintergrund“ an, „Kartenfläche“ aus, „Darstellung: Gezeichnet“ und „Average“ aus. A und B zeigen sofort das Ergebnis. Kein Häkchen springt zurück, und nach Neuladen von A ist alles noch so. *(Review Focus 2)*
4. **Beispieldaten:** Replay beenden und Server ohne Spiel neu starten (`npm run dev`). Leiste in A öffnen → B zeigt Beispieldaten in der echten Darstellung (nicht Linien). Leiste schließen → B wieder schwarz mit „Warte auf ein Spiel“.
5. **Profile:** „Neu“ → Name „Fernseher“, Vorlage Fernseher → das neue Profil ist aktiv, und A und B zeigen den blauen Hintergrund. „Umbenennen“ → „TV“: Die Auswahl zeigt „TV“. Profil-Menü → „Standard“: Beide wechseln. Vorlage „Minimal“ → Rückfrage → „Ja“: nur Karten mit Name und Rest, das Layout bleibt. „Löschen“ bei „TV“ → Rückfrage → „Ja“: Nur „Standard“ bleibt, „Löschen“ ist gesperrt.
6. **Esc:** „Neu“ öffnen, Esc → nur das Formular schließt, die Leiste bleibt. Rückfrage „Löschen“ öffnen, Esc → nur die Rückfrage schließt. Noch einmal Esc → die Leiste schließt. *(Review Focus 3)*
7. **Anderes Gerät:** In A die Leiste offen lassen. In B per Konsole `fetch("/api/profiles",{method:"POST",headers:{"X-Raspdarts":"1","Content-Type":"application/json"},body:JSON.stringify({name:"Zweit",template:"minimal"})})` ausführen → Die Leiste in A zeigt „Zweit“ als aktiv. In A „Average“ umschalten → Die Änderung landet in „Zweit“ (`GET /api/profiles/zweit`). Danach in B `fetch("/api/profiles/zweit",{method:"DELETE",headers:{"X-Raspdarts":"1"}})` → A springt auf „Standard“ und zeigt keinen Fehler. *(Review Focus 4)*
8. **Layout:** „Weiter: Layout →“ → Die Leiste geht zu, die Werkzeugleiste unten erscheint, und A und B zeigen die Scheibe als Linien mit Zahlen. Drehen: Die Scheibe rastet bei 0° ein, mit Alt dreht sie frei. „← Inhalte“ → wieder die Leiste. „Fertig“ bzw. Esc → alles zu, und der Knopf verschwindet sofort.
9. **Ausgeschaltete Auswahl:** Scheibe in Schritt 1 ausschalten, dann „Weiter: Layout“ → Ausgewählt ist ein sichtbarer Block, nicht die unsichtbare Scheibe. Pfeiltasten bewegen ihn.
10. In der Konsole beider Fenster gibt es keine Fehler.

- [ ] **Step 9: Commit**

```bash
git add public
git commit -m "Viewer-Profile: Seitenleiste Einstellungen mit Profilen, Vorlagen und Inhalte-Liste"
```

---

### Task 8: Doku, Gesamtprüfung, Ausrollen

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README anpassen**

Kiosk-Zeile:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars "http://raspdarts.local:8743/?display=beamer"
```
→
```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars "http://raspdarts.local:8743/"
```

In der API-Tabelle die Zeilen für `/` und `/ws` ersetzen:

```markdown
| GET | `/` | Viewer (zeigt das aktive Profil) |
| WS | `/ws` | Viewer: `{type:"catalog", catalog}`, `{type:"state", state}`, `{type:"profile", profile, profiles, editing}` |
```

Die beiden Zeilen `/api/layout/:display` ersetzen durch:

```markdown
| GET | `/api/profiles` | `{active, profiles:[{id, name}]}` |
| GET | `/api/profiles/:id` | ein Profil (Name, Inhalte, Layout) |
| POST | `/api/profiles` | `{name, template}` – neues Profil aus Vorlage, wird aktiv |
| PUT | `/api/profiles/:id` | Teile ändern: `{name?, content?, layout?, editing?}`; live an alle Viewer |
| POST | `/api/profiles/:id/reset` | `{template}` – Inhalte zurücksetzen, Layout bleibt |
| DELETE | `/api/profiles/:id` | löschen (nicht das letzte) |
| PUT | `/api/active-profile` | `{id}` – aktives Profil wechseln |
```

Den Abschnitt `## Layout einrichten` ganz ersetzen durch:

```markdown
## Viewer einstellen

Den Viewer am Laptop öffnen (`http://raspdarts.local:8743/`). Bei Mausbewegung
erscheint unten rechts **Einstellungen**. Alle Geräte zeigen dasselbe, nämlich das
**aktive Profil**, und folgen jeder Änderung live.

**Schritt 1 – Inhalte:** Profil wählen, anlegen (aus einer Vorlage: Projektion,
Fernseher, Minimal), umbenennen oder löschen. Darunter ein- und ausschalten, was
erscheint: Hintergrund, Scheibe (Nur Licht, Gezeichnet, Linien, Zahlenring, Darts,
Leuchten), Aufnahme, Spielinfo, Spielerkarten mit ihren Teilen. Eine Vorlage
anzuklicken setzt die Inhalte zurück, das Layout bleibt.

**Schritt 2 – Layout** („Weiter: Layout“): Alle Geräte zeigen die Scheibe als
Linien, so lässt sie sich auf die echten Drähte legen.

- Scheibe: ziehen = verschieben, Ecke oder Mausrad = Größe, Kreis = drehen
  (rastet bei 0°, 90°, 180° ein; mit Alt frei); fein mit Pfeiltasten, +/− und
  Q/E (mit Umschalt grob).
- Karten, Spielinfo, Aufnahmeleiste: ziehen und an der Ecke skalieren.
- „← Inhalte“ geht zurück, „Fertig“ oder Esc beendet.

Gespeichert wird automatisch unter `server/data/profiles/<id>.json`, das aktive
Profil in `active.json`. Positionen sind Prozentwerte, Größen hängen an der
Bildhöhe, damit das Layout bei jeder Auflösung passt. Beim ersten Start wird ein
vorhandenes `server/data/layouts/standard.json` zum Profil „Standard“.
```

- [ ] **Step 2: Gesamtprüfung**

Run: `cd server && npm test && npm run typecheck && npm run build`
Expected: alles PASS, Build ohne Fehler.

Run: `grep -rn "api/layout\|display-name\|?display=\|edit-toggle\|boardMode" server/src server/public README.md`
Expected: nur `boardMode` in `server/src/viewer/layout.ts` (`fromLegacyLayout`) und `profile-store.ts` (Übernahme).

- [ ] **Step 3: Browser-Prüfung alte Adresse** *(Review Focus 5)*

`npm run dev`, dann `http://localhost:8743/?display=beamer` öffnen. Es erscheint das aktive Profil, ohne Fehler in der Konsole.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Doku: Viewer-Profile, Einstellungen und Profil-API in der README"
```

- [ ] **Step 5: Review des ganzen Branches** (laut gewähltem Ausführungsweg), Befunde beheben, Tests erneut grün.

- [ ] **Step 6: Altes Layout auf dem Pi sichern** *(Review Focus 1)*

```bash
ssh pi@raspdarts.local 'cat ~/raspdarts/server/data/layouts/standard.json'
```

Ausgabe notieren (board.cx/cy/diameter/rotation, blocks.kopf, boardMode).

- [ ] **Step 7: Freigabe durch Arnold einholen**, dann zusammenführen und pushen:

```bash
cd /c/Projekte/raspdarts && git switch main && git merge --ff-only viewer-profile && git push
```

- [ ] **Step 8: Update auf dem Pi und prüfen** *(Review Focus 1)*

```bash
curl -sN -X POST -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/system/update
curl -s -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/profiles/standard
```

Expected: Das Update endet erfolgreich. Das Profil `standard` hat dieselben Werte für `layout.board` wie die gesicherte Datei, `layout.blocks.spielinfo` entspricht dem alten `kopf`, und `content.scheibe.darstellung` entspricht dem alten `boardMode`.

- [ ] **Step 9: Abnahme** – Arnold macht den Maus-Test am Viewer (`http://raspdarts.local:8743/`): Einstellungen öffnen, Inhalte umschalten, Profil anlegen, Layout mit Einrasten ausrichten.
