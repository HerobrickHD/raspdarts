# Spielarten und Spielerbereiche – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jedes Profil bekommt einen gemeinsamen Teil (Scheibe, Hintergrund) und einen Teil je Spielart (nur angepasste Spielarten, der Rest folgt ihrem Standard). Der Viewer zeichnet nach der laufenden Spielart, und die Spieler (1–6) ordnen sich in zwei Bereichen links und rechts selbst an, mit festen Plätzen für das ganze Match.

**Architecture:** Der Katalog (`catalog.ts`) kennt die elf Spielarten und sagt je Baustein/Option, wo es sie gibt; `standards.ts` liefert den Standard je Spielart. Der Pi prüft und speichert Profile in Version 4 (`profile.ts`, `profile-store.ts`), erkennt die Spielart aus `variant` und vergibt feste Plätze (`game-state.ts`, `seats.ts`). Der Viewer wertet das Profil für die angezeigte Spielart selbst aus (`resolve-profile.js`) und verteilt die Karten mit einer reinen Funktion (`areas.js`).

**Tech Stack:** Server: TypeScript, Fastify 5, @fastify/websocket, Vitest. Viewer: HTML, CSS, SVG und ES-Module ohne Build-Schritt (`server/public/`).

**Spec:** `docs/superpowers/specs/2026-10-13-spielarten-design.md`

## Global Constraints

- Code-Kommentare deutsch ohne Umlaute; Texte in der Oberfläche und Labels im Katalog mit Umlauten.
- Viewer bleibt HTML/CSS/ES-Module ohne Build-Schritt in `server/public/`.
- Jeder Aufruf unter `/api/` braucht den Header `X-Raspdarts: 1`.
- Elf Spielarten: `x01`, `cricket`, `count-up`, `around-the-clock`, `random-checkout`, `round-the-world`, `segment-training`, `bobs-27`, `shanghai`, `gotcha`, `bermuda`. 121 und Killer gibt es nicht.
- Profil-Datei `data/profiles/<id>.json` mit `version: 4`; Version 3 wird beim Lesen umgebaut; die Datei wird erst beim nächsten Schreiben Version 4.
- Gemeinsam: Bausteine `hintergrund`, `scheibe` und `board` (cx, cy, diameter, rotation). Je Spielart: `spielinfo`, `aufnahme`, `spieler` und das Layout `spielinfo`, `aufnahme`, `bereich-links`, `bereich-rechts`.
- Eine Spielart ist „angepasst“, sobald sie in `spielarten` steht; Zurücksetzen löscht den Eintrag.
- Bereich: `x`, `y` in Prozent; `w` 5–300 vh, `h` 5–100 vh. Karte 49 vh × 34 vh, Abstand 1,5 vh.
- Verteilung `beide`: Platz 1, 3, 5 links, 2, 4, 6 rechts; `links`/`rechts`: alle dort.
- `editing`: `{ schritt: "inhalte" | "layout", spielart, spieler: 1–6 }` oder `null`; 60 s Zeitlimit, Lebenszeichen alle 30 s, Profilwechsel beendet es.
- Unbekannte `variant`: `mode: null`, gezeichnet nach dem X01-Teil, nur mit Bausteinen/Optionen, die es überall gibt; einmal je Wert im Log.
- Autodarts erlaubt höchstens 6 Spieler.
- Autodarts wird nicht angefasst; die Extension bleibt unverändert.
- Python ist nicht installiert; Hilfsskripte in Node oder Bash.
- Tests: `cd server && npm test && npm run typecheck`.
- Commit nach jeder Task; **kein Push und kein Pi-Update ohne Arnolds „ja“**.

## Review Focus

1. **Update auf dem Pi mit vorhandenem Profil „Standard“ (Version 3):** X01 mit 2 Spielern muss danach genauso aussehen (Scheibe, Karten, Aufnahme). → Task 3, Test „Version 3 wird umgebaut …“; Task 5, Test „Bereiche aus der Übernahme ergeben die alten Karten“; Task 8, Pi-Vergleich mit Bildschirmfoto.
2. **Scheibe verschieben in einer Spielart, die auf Standard steht:** Die Spielart darf dadurch **nicht** „angepasst“ werden, und die neue Lage gilt in allen Spielarten. → Task 7, Test in `editor-changes.test.js` und Step 9, Punkt 5.
3. **Schnell nacheinander Inhalte und Layout ändern, oder zwei Spielarten hintereinander:** Die gebündelte Anfrage darf keine Teiländerung verschlucken und nie Änderungen zweier Spielarten vermischen. → Task 7, Tests `mergeBody`/`queue` in `profile-sync.test.js`.
4. **Best of 3, Autodarts stellt die Spieler im zweiten Leg anders auf:** Keine Karte wechselt die Seite. → Task 4, Test „gleiche Spieler in anderer Reihenfolge behalten ihren Platz“.
5. **Ein Spiel läuft, während jemand die Leiste offen hat:** Die Vorschau zeigt das echte Spiel und dessen Spielart, die Spielerzahl-Knöpfe sind gesperrt. → Task 7, Step 9, Punkt 7.

---

## Dateiübersicht

| Datei | Aufgabe |
|---|---|
| `server/src/viewer/catalog.ts` | Spielarten, Bausteine (gemeinsam/je Spielart), Optionen mit `modes`, Prüfung der Inhalte |
| `server/src/viewer/layout.ts` | Lage der Scheibe, Layout je Spielart (Blöcke + Bereiche), alte Formate |
| `server/src/viewer/standards.ts` (neu) | Standard je Spielart, gemeinsamer Standard, Katalog für den Viewer |
| `server/src/viewer/profile.ts` | Profil Version 4, Prüfung, Übernahme von Version 3 |
| `server/src/viewer/profile-store.ts` | Anlegen, Ändern (gemeinsam/Spielart), Zurücksetzen je Spielart |
| `server/src/viewer/display-hub.ts` | `editing` mit Spielart und Spielerzahl, Katalog mit Spielarten |
| `server/src/http.ts` | Profil-Endpunkte mit neuen Feldern |
| `server/src/viewer/game-state.ts` | Spielart erkennen, allgemeiner Stand, `id`/`seat` je Spieler |
| `server/src/viewer/seats.ts` (neu) | Feste Plätze je Match |
| `server/src/viewer/pipeline.ts` | Plätze anwenden, unbekannte Spielart melden |
| `server/public/js/areas.js` (neu) | Karten in den Bereichen anordnen |
| `server/public/js/resolve-profile.js` (neu) | Profil + Spielart → Inhalte und Layout; lokale Änderungen einbauen |
| `server/public/js/content-view.js` | Merkmale je Spielart |
| `server/public/js/labels.js` | Chips der Spielinfo mit Schlüssel und Spielart |
| `server/public/js/sample-state.js` | Beispieldaten je Spielart und Spielerzahl |
| `server/public/js/blocks.js` | Karten je Platz in den Bereichen |
| `server/public/js/layout-view.js` | Bereiche mit Breite/Höhe |
| `server/public/js/app.js` | angezeigte Spielart, Auswertung, Zeichnen |
| `server/public/js/profile-sync.js` | verschachtelte Änderungen zusammenfassen |
| `server/public/js/editor-changes.js` (neu) | welche Änderung an den Pi geht (Scheibe vs. Spielart) |
| `server/public/js/editor.js` | Bereiche ziehen und Größe ändern, Spielerzahl in der Werkzeugleiste |
| `server/public/js/settings.js`, `settings-panel.js` | Gemeinsam, Spielart-Auswahl, Vorschau, Zurücksetzen |
| `server/public/index.html`, `style.css` | Bereiche statt sechs Kartenplätze, Werkzeugleiste |
| `README.md` | Spielarten, Bereiche, Schnittstelle |

---

### Task 1: Spielarten im Katalog

**Files:**
- Modify: `server/src/viewer/catalog.ts`
- Modify: `server/public/style.css` (Regeln für die neuen Optionen)
- Test: `server/test/catalog.test.ts`

**Interfaces:**
- Produces:
  - `type ModeGroup = "spiele" | "training" | "party"`, `interface GameMode { id; label; group; variants: string[]; verified: boolean }`
  - `MODES: GameMode[]`, `GROUP_LABELS: Record<ModeGroup, string>`, `FALLBACK_MODE = "x01"`
  - `modeForVariant(variant: unknown): string | null`, `isMode(id: unknown): id is string`
  - `Part.scope: "gemeinsam" | "spielart"`, `Part.modes?: string[]`, `Option.modes?: string[]`
  - `availableIn(item: { modes?: string[] }, mode: string | null): boolean`
  - `sanitizeShared(stored: unknown, fallback?: Content): Content` (nur gemeinsame Bausteine)
  - `sanitizeModeContent(stored: unknown, mode: string, fallback?: Content): Content` (nur Bausteine/Optionen der Spielart)
  - `sharedDefaults(): Content`, `modeDefaults(mode: string): Content`
  - Die alten Exporte (`templates`, `DEFAULT_TEMPLATE`, `templateContent`, `sanitizeContent`, `defaultContent`) bleiben bis Task 3 stehen.

- [ ] **Step 1: Tests schreiben**

In `server/test/catalog.test.ts` ergänzen (Import um die neuen Namen erweitern):

```ts
import {
  CATALOG,
  FALLBACK_MODE,
  MODES,
  availableIn,
  isMode,
  modeDefaults,
  modeForVariant,
  sanitizeModeContent,
  sanitizeShared,
  sharedDefaults,
} from "../src/viewer/catalog.js";

describe("Spielarten", () => {
  test("elf Spielarten ohne 121 und Killer, ids eindeutig", () => {
    expect(MODES.map((m) => m.id)).toEqual([
      "x01",
      "cricket",
      "count-up",
      "around-the-clock",
      "random-checkout",
      "round-the-world",
      "segment-training",
      "bobs-27",
      "shanghai",
      "gotcha",
      "bermuda",
    ]);
    expect(MODES.find((m) => m.id === FALLBACK_MODE)?.verified).toBe(true);
    expect(MODES.filter((m) => m.verified).map((m) => m.id)).toEqual(["x01"]);
  });

  test("erkennt variant ohne Ruecksicht auf Schreibweise", () => {
    expect(modeForVariant("X01")).toBe("x01");
    expect(modeForVariant("cricket")).toBe("cricket");
    expect(modeForVariant("Tactics")).toBe("cricket");
    expect(modeForVariant("Bob's 27")).toBe("bobs-27");
    expect(modeForVariant("BOBS 27")).toBe("bobs-27");
    expect(modeForVariant("Around The Clock")).toBe("around-the-clock");
    expect(modeForVariant("ATC")).toBe("around-the-clock");
  });

  test("unbekannt, 121, Killer und Unsinn ergeben null", () => {
    expect(modeForVariant("Killer")).toBeNull();
    expect(modeForVariant("121")).toBeNull();
    expect(modeForVariant("")).toBeNull();
    expect(modeForVariant(42)).toBeNull();
  });

  test("isMode kennt nur Katalog-ids", () => {
    expect(isMode("cricket")).toBe(true);
    expect(isMode("Cricket")).toBe(false);
    expect(isMode(undefined)).toBe(false);
  });

  test("modes der Bausteine und Optionen nennen nur bekannte Spielarten", () => {
    for (const part of CATALOG.parts) {
      for (const mode of part.modes ?? []) expect(isMode(mode), `${part.id}: ${mode}`).toBe(true);
      for (const option of part.options) {
        for (const mode of option.modes ?? []) expect(isMode(mode), `${part.id}.${option.id}: ${mode}`).toBe(true);
      }
    }
  });
});

describe("availableIn", () => {
  test("ohne modes ueberall, mit modes nur dort, bei unbekannter Spielart nur Allgemeines", () => {
    expect(availableIn({}, "gotcha")).toBe(true);
    expect(availableIn({}, null)).toBe(true);
    expect(availableIn({ modes: ["x01"] }, "x01")).toBe(true);
    expect(availableIn({ modes: ["x01"] }, "cricket")).toBe(false);
    expect(availableIn({ modes: ["x01"] }, null)).toBe(false);
  });
});

describe("gemeinsam und je Spielart", () => {
  test("Hintergrund und Scheibe sind gemeinsam, der Rest je Spielart", () => {
    const scope = Object.fromEntries(CATALOG.parts.map((p) => [p.id, p.scope]));
    expect(scope).toEqual({
      hintergrund: "gemeinsam",
      scheibe: "gemeinsam",
      aufnahme: "spielart",
      spielinfo: "spielart",
      spieler: "spielart",
    });
  });

  test("sharedDefaults enthaelt nur die gemeinsamen Bausteine", () => {
    expect(Object.keys(sharedDefaults()).sort()).toEqual(["hintergrund", "scheibe"]);
  });

  test("modeDefaults enthaelt nur, was es in der Spielart gibt", () => {
    const x01 = modeDefaults("x01");
    expect(Object.keys(x01).sort()).toEqual(["aufnahme", "spieler", "spielinfo"]);
    expect(x01["spieler"]).toMatchObject({ verteilung: "beide", checkout: true, average: true, legs: true });
    expect(x01["spielinfo"]).toEqual({ on: true, spielart: true, punktzahl: true, legs: true, modus: true });

    const gotcha = modeDefaults("gotcha");
    expect(gotcha["spieler"]).not.toHaveProperty("checkout");
    expect(gotcha["spieler"]).not.toHaveProperty("average");
    expect(gotcha["spieler"]).not.toHaveProperty("legs");
    expect(gotcha["spielinfo"]).toEqual({ on: true, spielart: true });

    expect(modeDefaults("random-checkout")["spieler"]).toHaveProperty("checkout", true);
    expect(modeDefaults("cricket")["spieler"]).toHaveProperty("legs", true);
  });

  test("sanitizeModeContent wirft Optionen anderer Spielarten und gemeinsame Bausteine weg", () => {
    const content = sanitizeModeContent(
      { scheibe: { on: false }, spieler: { checkout: false, name: false, verteilung: "links" } },
      "gotcha",
    );
    expect(content).not.toHaveProperty("scheibe");
    expect(content["spieler"]).not.toHaveProperty("checkout");
    expect(content["spieler"]).toMatchObject({ name: false, verteilung: "links" });
  });

  test("sanitizeModeContent nimmt Fehlendes aus fallback, Unbrauchbares auch", () => {
    const fallback = modeDefaults("x01");
    fallback["aufnahme"] = { on: false, darts: false, summe: true };
    const content = sanitizeModeContent({ spieler: { verteilung: "oben" } }, "x01", fallback);
    expect(content["aufnahme"]).toEqual({ on: false, darts: false, summe: true });
    expect(content["spieler"]?.["verteilung"]).toBe("beide");
  });

  test("sanitizeShared prueft nur Hintergrund und Scheibe", () => {
    const content = sanitizeShared({ scheibe: { darstellung: "drawn" }, spieler: { on: false } });
    expect(Object.keys(content).sort()).toEqual(["hintergrund", "scheibe"]);
    expect(content["scheibe"]?.["darstellung"]).toBe("drawn");
  });
});
```

- [ ] **Step 2: Test laufen lassen, er schlägt fehl**

Run: `cd server && npx vitest run test/catalog.test.ts`
Expected: FAIL – `MODES` und die anderen neuen Namen sind nicht exportiert.

- [ ] **Step 3: Katalog erweitern**

In `server/src/viewer/catalog.ts`:

Typen erweitern:

```ts
export interface ToggleOption {
  id: string;
  label: string;
  type: "toggle";
  default: boolean;
  /** Spielarten, in denen es die Option gibt; fehlt es, gibt es sie ueberall. */
  modes?: string[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  type: "choice";
  choices: { id: string; label: string }[];
  default: string;
  modes?: string[];
}

export interface Part {
  id: string;
  label: string;
  /** Gilt fuer alle Spielarten (gemeinsam) oder wird je Spielart eingestellt. */
  scope: "gemeinsam" | "spielart";
  /** an/aus */
  default: boolean;
  modes?: string[];
  /** Einzelteile, in der Liste aufgeklappt sichtbar */
  options: Option[];
}

export type ModeGroup = "spiele" | "training" | "party";

export interface GameMode {
  id: string;
  label: string;
  group: ModeGroup;
  /** Werte von `variant` in den Autodarts-Daten, die diese Spielart meinen. */
  variants: string[];
  /** true, sobald ein Mitschnitt die Daten bestaetigt hat. */
  verified: boolean;
}
```

`toggle` bekommt einen optionalen vierten Parameter:

```ts
const toggle = (id: string, label: string, value = true, modes?: string[]): ToggleOption => ({
  id,
  label,
  type: "toggle",
  default: value,
  ...(modes ? { modes } : {}),
});
```

Spielarten (vor `CATALOG`):

```ts
export const GROUP_LABELS: Record<ModeGroup, string> = {
  spiele: "Spiele",
  training: "Training",
  party: "Party",
};

/**
 * Die Spielarten von play.autodarts.com/play ohne die Abo-Spielarten 121 und
 * Killer. variants ausser bei X01 geschaetzt - mit dem ersten Mitschnitt
 * einer Spielart korrigieren und verified setzen.
 */
export const MODES: GameMode[] = [
  { id: "x01", label: "X01", group: "spiele", variants: ["X01"], verified: true },
  { id: "cricket", label: "Cricket / Taktik", group: "spiele", variants: ["Cricket", "Tactics"], verified: false },
  { id: "count-up", label: "Count Up", group: "training", variants: ["Count Up"], verified: false },
  {
    id: "around-the-clock",
    label: "Around The Clock",
    group: "training",
    variants: ["ATC", "Around The Clock"],
    verified: false,
  },
  {
    id: "random-checkout",
    label: "Zufälliges Checkout",
    group: "training",
    variants: ["Random Checkout"],
    verified: false,
  },
  {
    id: "round-the-world",
    label: "Round the World",
    group: "training",
    variants: ["RTW", "Round The World"],
    verified: false,
  },
  {
    id: "segment-training",
    label: "Segmenttraining",
    group: "training",
    variants: ["Segment Training"],
    verified: false,
  },
  { id: "bobs-27", label: "Bob's 27", group: "training", variants: ["Bob's 27"], verified: false },
  { id: "shanghai", label: "Shanghai", group: "party", variants: ["Shanghai"], verified: false },
  { id: "gotcha", label: "Gotcha", group: "party", variants: ["Gotcha"], verified: false },
  { id: "bermuda", label: "Bermuda", group: "party", variants: ["Bermuda"], verified: false },
];

/** Spielart ohne Spiel seit dem Start und Profilteil fuer unbekannte Spielarten. */
export const FALLBACK_MODE = "x01";

/** "Bob's 27", "bobs27" und "BOBS 27" sind dasselbe. */
const variantKey = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, "");

export function modeForVariant(variant: unknown): string | null {
  if (typeof variant !== "string" || variant === "") return null;
  const key = variantKey(variant);
  return MODES.find((mode) => mode.variants.some((v) => variantKey(v) === key))?.id ?? null;
}

export const isMode = (id: unknown): id is string => MODES.some((mode) => mode.id === id);

/** Gibt es den Baustein/die Option in dieser Spielart? null = unbekannte Spielart: nur Allgemeines. */
export function availableIn(item: { modes?: string[] }, mode: string | null): boolean {
  return item.modes === undefined || (mode !== null && item.modes.includes(mode));
}
```

`CATALOG.parts` neu (Reihenfolge und Vorgaben wie bisher, dazu `scope`, `modes` und die zwei neuen Optionen; `templates` bleibt bis Task 3 unverändert):

```ts
const X01 = ["x01"];

export const CATALOG: Catalog = {
  parts: [
    { id: "hintergrund", label: "Hintergrund", scope: "gemeinsam", default: false, options: [] },
    {
      id: "scheibe",
      label: "Scheibe",
      scope: "gemeinsam",
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
      scope: "spielart",
      default: true,
      options: [toggle("darts", "Darts"), toggle("summe", "Summe")],
    },
    {
      id: "spielinfo",
      label: "Spielinfo",
      scope: "spielart",
      default: true,
      options: [
        toggle("spielart", "Spielart"),
        toggle("punktzahl", "Punktzahl", true, X01),
        toggle("legs", "Legs/Sets", true, ["x01", "cricket"]),
        toggle("modus", "Modus", true, X01),
      ],
    },
    {
      id: "spieler",
      label: "Spielerkarten",
      scope: "spielart",
      default: true,
      options: [
        {
          id: "verteilung",
          label: "Verteilung",
          type: "choice",
          choices: [
            { id: "beide", label: "Links und rechts" },
            { id: "links", label: "Nur links" },
            { id: "rechts", label: "Nur rechts" },
          ],
          default: "beide",
        },
        toggle("flaeche", "Kartenfläche"),
        toggle("profilbild", "Profilbild"),
        toggle("name", "Name"),
        toggle("flagge", "Flagge"),
        toggle("rest", "Punktestand"),
        toggle("legs", "Legs", true, ["x01", "cricket"]),
        toggle("checkout", "Checkout-Weg", true, ["x01", "random-checkout"]),
        toggle("average", "Average", true, X01),
        toggle("dartzahl", "Dartzahl"),
      ],
    },
  ],
  templates: [ /* unveraendert bis Task 3 */ ],
};
```

Prüfung nach Teil (die bestehende `sanitizeContent` bleibt und benutzt jetzt `sanitizeParts`):

```ts
function sanitizeParts(parts: Part[], stored: unknown, fallback: Content, mode: string | null): Content {
  const source = asRecord(stored);
  const content: Content = {};
  for (const part of parts) {
    const given = asRecord(source[part.id]);
    const base = fallback[part.id] ?? partDefaults(part);
    const on = given["on"];
    const value: PartContent = { on: typeof on === "boolean" ? on : base.on };
    for (const option of part.options) {
      if (!availableIn(option, mode)) continue;
      const raw = given[option.id];
      value[option.id] = isValid(option, raw) ? raw : (base[option.id] ?? option.default);
    }
    content[part.id] = value;
  }
  return content;
}

const sharedParts = (): Part[] => CATALOG.parts.filter((part) => part.scope === "gemeinsam");
const modeParts = (mode: string): Part[] =>
  CATALOG.parts.filter((part) => part.scope === "spielart" && availableIn(part, mode));

function defaultsOf(parts: Part[], mode: string | null): Content {
  return sanitizeParts(parts, null, {}, mode);
}

export const sharedDefaults = (): Content => defaultsOf(sharedParts(), null);
export const modeDefaults = (mode: string): Content => defaultsOf(modeParts(mode), mode);

/** Hintergrund und Scheibe; fehlende oder unbrauchbare Werte aus fallback. */
export function sanitizeShared(stored: unknown, fallback: Content = sharedDefaults()): Content {
  return sanitizeParts(sharedParts(), stored, fallback, null);
}

/** Bausteine einer Spielart; Optionen, die es dort nicht gibt, fallen weg. */
export function sanitizeModeContent(stored: unknown, mode: string, fallback: Content = modeDefaults(mode)): Content {
  return sanitizeParts(modeParts(mode), stored, fallback, mode);
}

/** Bisherige Pruefung aller Bausteine - entfaellt in Task 3. */
export function sanitizeContent(stored: unknown, fallback: Content = defaultContent()): Content {
  return sanitizeParts(CATALOG.parts, stored, fallback, "x01");
}
```

Achtung: `sharedDefaults` mit `mode = null` ist richtig, weil gemeinsame Optionen keine `modes` haben. `partDefaults` setzt weiter alle Optionen; `sanitizeParts` lässt nicht verfügbare weg.

Die Kopfkommentare der Datei um einen Absatz ergänzen:

```ts
 * Spielarten: Bausteine sind gemeinsam (gelten fuer alle Spielarten) oder
 * werden je Spielart eingestellt. modes an einem Baustein oder einer Option
 * sagt, in welchen Spielarten es sie gibt; ohne modes gibt es sie ueberall.
```

- [ ] **Step 4: CSS für die neuen Optionen**

In `server/public/style.css` im Abschnitt „Inhalte“ nach der Regel für `data-spielinfo-modus` ergänzen:

```css
.viewer[data-spielinfo-spielart="off"] [data-chip="spielart"] {
  display: none;
}

/* Verteilung: der nicht benutzte Bereich verschwindet ganz, auch beim Ausrichten. */
.viewer[data-spieler-verteilung="links"] [data-block="bereich-rechts"],
.viewer[data-spieler-verteilung="rechts"] [data-block="bereich-links"] {
  display: none;
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `cd server && npx vitest run test/catalog.test.ts test/content-view.test.js`
Expected: PASS. Falls „Vorgaben wie in der Spec“ wegen der neuen Optionen `spielart`/`verteilung` fehlschlägt, die erwarteten Objekte dort um `spielart: true` bzw. `verteilung: "beide"` ergänzen.

- [ ] **Step 6: Gesamtlauf und Commit**

Run: `cd server && npm test && npm run typecheck`
Expected: alles grün.

```bash
git add server/src/viewer/catalog.ts server/public/style.css server/test/catalog.test.ts
git commit -m "Katalog: Spielarten, gemeinsame Bausteine und Optionen je Spielart"
```

---

### Task 2: Layout je Spielart und Standards

**Files:**
- Modify: `server/src/viewer/layout.ts`
- Create: `server/src/viewer/standards.ts`
- Test: `server/test/layout.test.ts`, Create: `server/test/standards.test.ts`

**Interfaces:**
- Consumes: `MODES`, `GROUP_LABELS`, `CATALOG`, `sanitizeShared`, `sanitizeModeContent`, `type Content`, `type ContentPatch` (Task 1)
- Produces (layout.ts):
  - `interface Area { x: number; y: number; w: number; h: number }`
  - `type ModeBlocks = { spielinfo: BlockLayout; aufnahme: BlockLayout; "bereich-links": Area; "bereich-rechts": Area }`, `interface ModeLayout { blocks: ModeBlocks }`
  - `CARD = { w: 49, h: 34 }`, `DEFAULT_BOARD: BoardLayout`, `DEFAULT_MODE_LAYOUT: ModeLayout`
  - `sanitizeBoard(stored: unknown, fallback?: BoardLayout): BoardLayout`
  - `sanitizeModeLayout(stored: unknown, fallback?: ModeLayout): ModeLayout`
  - `splitLegacyLayout(stored: unknown): { board: BoardLayout; layout: ModeLayout }` (Layout aus Version 3: Karten 1/2 → Bereiche)
  - `fromLegacyLayout(stored)` liefert jetzt `{ board, layout: ModeLayout, boardMode } | null`
- Produces (standards.ts):
  - `interface ModeStandard { mode: string; content: ContentPatch; layout: Partial<ModeBlocks> }`
  - `SHARED_STANDARD: ContentPatch`, `STANDARDS: ModeStandard[]`
  - `sharedStandard(): Content`, `standardFor(mode: string): { content: Content; layout: ModeLayout }`
  - `viewerCatalog(): ViewerCatalog` mit `{ parts, modes, groups, standards: Record<string, { content; layout }>, shared: Content }`

- [ ] **Step 1: Tests für das Layout schreiben**

`server/test/layout.test.ts` ganz ersetzen:

```ts
import { describe, expect, test } from "vitest";
import {
  CARD,
  DEFAULT_BOARD,
  DEFAULT_MODE_LAYOUT,
  fromLegacyLayout,
  sanitizeBoard,
  sanitizeModeLayout,
  splitLegacyLayout,
} from "../src/viewer/layout.js";

describe("sanitizeBoard", () => {
  test("Standard ohne Brauchbares, sonst begrenzt je Wert", () => {
    expect(sanitizeBoard(null)).toEqual(DEFAULT_BOARD);
    expect(sanitizeBoard({ cx: 120, cy: -5, diameter: 1000, rotation: 200 })).toEqual({
      cx: 100,
      cy: 0,
      diameter: 400,
      rotation: 180,
    });
  });

  test("ersetzt Unbrauchbares einzeln aus fallback", () => {
    const fallback = { cx: 40, cy: 30, diameter: 14, rotation: -103 };
    expect(sanitizeBoard({ cx: 41, cy: "x" }, fallback)).toEqual({ cx: 41, cy: 30, diameter: 14, rotation: -103 });
  });
});

describe("sanitizeModeLayout", () => {
  test("Standard: Spielinfo, Aufnahme und zwei Bereiche wie die alten Karten 1 und 2", () => {
    expect(sanitizeModeLayout(null)).toEqual(DEFAULT_MODE_LAYOUT);
    expect(DEFAULT_MODE_LAYOUT.blocks["bereich-links"]).toEqual({ x: 1.4, y: 32.7, w: 49, h: 34 });
    expect(DEFAULT_MODE_LAYOUT.blocks["bereich-rechts"]).toEqual({ x: 71, y: 32.7, w: 49, h: 34 });
  });

  test("begrenzt Bereiche: Position 0-100, Breite 5-300, Hoehe 5-100", () => {
    const layout = sanitizeModeLayout({
      blocks: { "bereich-links": { x: -3, y: 140, w: 1, h: 500 } },
    });
    expect(layout.blocks["bereich-links"]).toEqual({ x: 0, y: 100, w: 5, h: 100 });
  });

  test("unbrauchbarer Block kommt aus fallback, unbekannte fallen weg", () => {
    const fallback = structuredClone(DEFAULT_MODE_LAYOUT);
    fallback.blocks.aufnahme = { x: 9, y: 9, scale: 2 };
    const layout = sanitizeModeLayout({ blocks: { aufnahme: { x: "a" }, "spieler-3": { x: 1, y: 1, scale: 1 } } }, fallback);
    expect(layout.blocks.aufnahme).toEqual({ x: 9, y: 9, scale: 2 });
    expect(layout.blocks).not.toHaveProperty("spieler-3");
  });

  test("liefert jedes Mal eine eigene Kopie", () => {
    const a = sanitizeModeLayout(null);
    a.blocks.spielinfo.x = 77;
    expect(sanitizeModeLayout(null).blocks.spielinfo.x).toBe(DEFAULT_MODE_LAYOUT.blocks.spielinfo.x);
  });
});

describe("splitLegacyLayout (Layout aus Profil-Version 3)", () => {
  test("Scheibe getrennt, Karte 1/2 werden Bereiche in Kartengroesse, 3-6 fallen weg", () => {
    const { board, layout } = splitLegacyLayout({
      board: { cx: 42.8987, cy: 28.7953, diameter: 14.04, rotation: -103.05 },
      blocks: {
        spielinfo: { x: 5, y: 6, scale: 1.2 },
        aufnahme: { x: 30, y: 2, scale: 1.4 },
        "spieler-1": { x: 1, y: 30, scale: 0.8 },
        "spieler-2": { x: 70, y: 31, scale: 1.1 },
        "spieler-3": { x: 1, y: 68, scale: 0.45 },
      },
    });
    expect(board).toEqual({ cx: 42.8987, cy: 28.7953, diameter: 14.04, rotation: -103.05 });
    expect(layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(layout.blocks["bereich-links"]).toEqual({ x: 1, y: 30, w: CARD.w * 0.8, h: CARD.h * 0.8 });
    expect(layout.blocks["bereich-rechts"]).toEqual({ x: 70, y: 31, w: CARD.w * 1.1, h: CARD.h * 1.1 });
    expect(Object.keys(layout.blocks).sort()).toEqual(["aufnahme", "bereich-links", "bereich-rechts", "spielinfo"]);
  });

  test("ohne Karten gelten die Standardbereiche", () => {
    expect(splitLegacyLayout({}).layout).toEqual(DEFAULT_MODE_LAYOUT);
  });
});

describe("fromLegacyLayout (version 2)", () => {
  test("kopf wird spielinfo, boardMode kommt mit, Karten werden Bereiche", () => {
    const legacy = fromLegacyLayout({
      version: 2,
      boardMode: "drawn",
      board: { cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 },
      blocks: { kopf: { x: 5, y: 6, scale: 1.2 }, "spieler-1": { x: 2, y: 3, scale: 1 } },
    });
    expect(legacy?.boardMode).toBe("drawn");
    expect(legacy?.board).toEqual({ cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 });
    expect(legacy?.layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(legacy?.layout.blocks["bereich-links"]).toEqual({ x: 2, y: 3, w: 49, h: 34 });
  });

  test("alles ohne version 2 ist kein altes Layout", () => {
    expect(fromLegacyLayout({ version: 3 })).toBeNull();
    expect(fromLegacyLayout(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Test läuft rot**

Run: `cd server && npx vitest run test/layout.test.ts`
Expected: FAIL – `CARD`, `sanitizeBoard` usw. fehlen.

- [ ] **Step 3: `layout.ts` umbauen**

Den Kopfkommentar behalten und ergänzen („Die Lage der Scheibe gilt fuer alle Spielarten, Bloecke und Spielerbereiche je Spielart.“). Neue Teile (die alten Exporte `PLAYER_BLOCKS`, `BLOCK_IDS`, `DisplayLayout`, `DEFAULT_LAYOUT`, `sanitizeLayout` bleiben bis Task 3 stehen, damit `profile.ts` weiter läuft):

```ts
/** Ein Spielerbereich: Position in Prozent, Groesse in vh (wie alle Groessen im Viewer). */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ModeBlocks {
  spielinfo: BlockLayout;
  aufnahme: BlockLayout;
  "bereich-links": Area;
  "bereich-rechts": Area;
}

export interface ModeLayout {
  blocks: ModeBlocks;
}

/** Grundgroesse einer Spielerkarte in vh (style.css: .card). */
export const CARD = { w: 49, h: 34 } as const;

export const DEFAULT_BOARD: BoardLayout = { cx: 50, cy: 51, diameter: 50, rotation: 0 };

export const DEFAULT_MODE_LAYOUT: ModeLayout = {
  blocks: {
    spielinfo: { x: 2, y: 3, scale: 1 },
    aufnahme: { x: 32.5, y: 3.8, scale: 1 },
    "bereich-links": { x: 1.4, y: 32.7, w: CARD.w, h: CARD.h },
    "bereich-rechts": { x: 71, y: 32.7, w: CARD.w, h: CARD.h },
  },
};

const AREA_LIMITS = { w: [5, 300], h: [5, 100] } as const;

export function sanitizeBoard(stored: unknown, fallback: BoardLayout = DEFAULT_BOARD): BoardLayout {
  const board = asRecord(stored);
  return {
    cx: boardValue(board["cx"], fallback.cx, LIMITS.position),
    cy: boardValue(board["cy"], fallback.cy, LIMITS.position),
    diameter: boardValue(board["diameter"], fallback.diameter, LIMITS.diameter),
    rotation: boardValue(board["rotation"], fallback.rotation, LIMITS.rotation),
  };
}

function sanitizeArea(stored: unknown, fallback: Area): Area {
  const { x, y, w, h } = asRecord(stored);
  if (!isNumber(x) || !isNumber(y) || !isNumber(w) || !isNumber(h)) return { ...fallback };
  return {
    x: clamp(x, LIMITS.position),
    y: clamp(y, LIMITS.position),
    w: clamp(w, AREA_LIMITS.w),
    h: clamp(h, AREA_LIMITS.h),
  };
}

/** Bloecke und Bereiche einer Spielart; jeder Wert einzeln geprueft, Unbrauchbares aus fallback. */
export function sanitizeModeLayout(stored: unknown, fallback: ModeLayout = DEFAULT_MODE_LAYOUT): ModeLayout {
  const blocks = asRecord(asRecord(stored)["blocks"]);
  return {
    blocks: {
      spielinfo: sanitizeBlock(blocks["spielinfo"], fallback.blocks.spielinfo),
      aufnahme: sanitizeBlock(blocks["aufnahme"], fallback.blocks.aufnahme),
      "bereich-links": sanitizeArea(blocks["bereich-links"], fallback.blocks["bereich-links"]),
      "bereich-rechts": sanitizeArea(blocks["bereich-rechts"], fallback.blocks["bereich-rechts"]),
    },
  };
}

/** Eine alte Karte (Position + Skalierung) als Bereich, in den sie genau passt. */
function cardToArea(stored: unknown, fallback: Area): Area {
  const { x, y, scale } = asRecord(stored);
  if (!isNumber(x) || !isNumber(y) || !isNumber(scale)) return { ...fallback };
  const block = sanitizeBlock(stored, { x: 0, y: 0, scale: 1 });
  return sanitizeArea({ x: block.x, y: block.y, w: CARD.w * block.scale, h: CARD.h * block.scale }, fallback);
}

/**
 * Layout aus Profil-Version 3 (bis Oktober 2026): Scheibe, Spielinfo,
 * Aufnahme und sechs feste Kartenplaetze. Karte 1 und 2 werden die Bereiche,
 * in die sie mit 2 Spielern genau passen - das Bild bleibt gleich.
 */
export function splitLegacyLayout(stored: unknown): { board: BoardLayout; layout: ModeLayout } {
  const source = asRecord(stored);
  const blocks = asRecord(source["blocks"]);
  const defaults = DEFAULT_MODE_LAYOUT.blocks;
  return {
    board: sanitizeBoard(source["board"]),
    layout: sanitizeModeLayout({
      blocks: {
        spielinfo: blocks["spielinfo"],
        aufnahme: blocks["aufnahme"],
        "bereich-links": cardToArea(blocks["spieler-1"], defaults["bereich-links"]),
        "bereich-rechts": cardToArea(blocks["spieler-2"], defaults["bereich-rechts"]),
      },
    }),
  };
}
```

`fromLegacyLayout` ersetzen:

```ts
export function fromLegacyLayout(
  stored: unknown,
): { board: BoardLayout; layout: ModeLayout; boardMode: LegacyBoardMode } | null {
  const source = asRecord(stored);
  if (source["version"] !== 2) return null;
  const blocks = { ...asRecord(source["blocks"]) };
  if (!("spielinfo" in blocks) && "kopf" in blocks) blocks["spielinfo"] = blocks["kopf"];
  return {
    ...splitLegacyLayout({ board: source["board"], blocks }),
    boardMode: source["boardMode"] === "drawn" ? "drawn" : "light",
  };
}
```

`profile-store.ts` benutzt `fromLegacyLayout(...).layout` noch als altes `DisplayLayout`. Bis Task 3 dort `#createFirst` vorübergehend so anpassen, dass es kompiliert:

```ts
    if (legacy) {
      profile.layout = { board: legacy.board, blocks: { ...profile.layout.blocks, ...legacy.layout.blocks } } as typeof profile.layout;
```

(Diese Zeile verschwindet in Task 3 komplett.) Der Store-Test „Übernahme“ darf in diesem Zwischenstand an den Kartenplätzen fehlschlagen – er wird in Task 3 ersetzt. Ihn bis dahin mit `test.skip` und dem Kommentar `// wird in Task 3 ersetzt` markieren.

- [ ] **Step 4: Layout-Tests grün**

Run: `cd server && npx vitest run test/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Tests für die Standards schreiben**

`server/test/standards.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { MODES, sanitizeModeContent, sanitizeShared } from "../src/viewer/catalog.js";
import { DEFAULT_MODE_LAYOUT, sanitizeModeLayout } from "../src/viewer/layout.js";
import { STANDARDS, sharedStandard, standardFor, viewerCatalog } from "../src/viewer/standards.js";

describe("Standards", () => {
  test("jede Spielart hat genau einen Standard", () => {
    expect(STANDARDS.map((s) => s.mode)).toEqual(MODES.map((m) => m.id));
  });

  test("jeder Standard ist schon gueltig (Pruefung aendert nichts)", () => {
    for (const { id } of MODES) {
      const standard = standardFor(id);
      expect(sanitizeModeContent(standard.content, id), id).toEqual(standard.content);
      expect(sanitizeModeLayout(standard.layout), id).toEqual(standard.layout);
    }
  });

  test("zu Beginn: Spielinfo aus, sonst alles an, Bereiche wie die alten Karten", () => {
    const x01 = standardFor("x01");
    expect(x01.content["spielinfo"]?.on).toBe(false);
    expect(x01.content["spieler"]?.on).toBe(true);
    expect(x01.content["aufnahme"]?.on).toBe(true);
    expect(x01.layout).toEqual(DEFAULT_MODE_LAYOUT);
  });

  test("gemeinsamer Standard wie die alte Vorlage Projektion", () => {
    expect(sharedStandard()).toEqual(
      sanitizeShared({ hintergrund: { on: false }, scheibe: { darstellung: "light", zahlenring: false } }),
    );
  });

  test("standardFor liefert Kopien", () => {
    standardFor("x01").layout.blocks.spielinfo.x = 99;
    expect(standardFor("x01").layout.blocks.spielinfo.x).toBe(DEFAULT_MODE_LAYOUT.blocks.spielinfo.x);
  });

  test("Katalog fuer den Viewer: Bausteine, Spielarten, Gruppen, alle Standards", () => {
    const catalog = viewerCatalog();
    expect(catalog.modes).toEqual(MODES);
    expect(Object.keys(catalog.standards)).toEqual(MODES.map((m) => m.id));
    expect(catalog.standards["cricket"]).toEqual(standardFor("cricket"));
    expect(catalog.shared).toEqual(sharedStandard());
    expect(catalog.groups).toEqual({ spiele: "Spiele", training: "Training", party: "Party" });
    expect(catalog).not.toHaveProperty("templates");
  });
});
```

- [ ] **Step 6: Test läuft rot**

Run: `cd server && npx vitest run test/standards.test.ts`
Expected: FAIL – Modul `standards.js` fehlt.

- [ ] **Step 7: `standards.ts` schreiben**

```ts
/**
 * Standard je Spielart: womit eine Spielart startet, solange sie in einem
 * Profil nicht angepasst ist. Wie die frueheren Vorlagen nur Abweichungen von
 * den Vorgaben des Katalogs - verbessert sich ein Standard, haben ihn alle
 * Profile, die diese Spielart nicht angepasst haben, sofort.
 *
 * Zu Beginn sind alle Standards gleich; Unterschiede kommen mit den Bausteinen
 * der einzelnen Spielarten (z. B. die Cricket-Tabelle).
 */
import {
  CATALOG,
  GROUP_LABELS,
  MODES,
  sanitizeModeContent,
  sanitizeShared,
  type Content,
  type ContentPatch,
  type GameMode,
  type ModeGroup,
  type Part,
} from "./catalog.js";
import { DEFAULT_MODE_LAYOUT, sanitizeModeLayout, type ModeBlocks, type ModeLayout } from "./layout.js";

export interface ModeStandard {
  mode: string;
  content: ContentPatch;
  layout: Partial<ModeBlocks>;
}

/** Gemeinsamer Teil neuer Profile - wie die fruehere Vorlage "Projektion". */
export const SHARED_STANDARD: ContentPatch = { scheibe: { zahlenring: false } };

const BASE: Omit<ModeStandard, "mode"> = { content: { spielinfo: { on: false } }, layout: {} };

export const STANDARDS: ModeStandard[] = MODES.map((mode) => ({ mode: mode.id, ...structuredClone(BASE) }));

export const sharedStandard = (): Content => sanitizeShared(SHARED_STANDARD);

export function standardFor(mode: string): { content: Content; layout: ModeLayout } {
  const standard = STANDARDS.find((s) => s.mode === mode) ?? { mode, ...BASE };
  return {
    content: sanitizeModeContent(standard.content, mode),
    layout: sanitizeModeLayout({ blocks: { ...DEFAULT_MODE_LAYOUT.blocks, ...standard.layout } }),
  };
}

export interface ViewerCatalog {
  parts: Part[];
  modes: GameMode[];
  groups: Record<ModeGroup, string>;
  standards: Record<string, { content: Content; layout: ModeLayout }>;
  shared: Content;
}

/** Was der Viewer braucht, um Liste und Profil selbst auszuwerten. */
export function viewerCatalog(): ViewerCatalog {
  return {
    parts: CATALOG.parts,
    modes: MODES,
    groups: GROUP_LABELS,
    standards: Object.fromEntries(MODES.map((mode) => [mode.id, standardFor(mode.id)])),
    shared: sharedStandard(),
  };
}
```

- [ ] **Step 8: Gesamtlauf und Commit**

Run: `cd server && npm test && npm run typecheck`
Expected: grün (ein Store-Test bewusst übersprungen).

```bash
git add server/src/viewer/layout.ts server/src/viewer/standards.ts server/src/viewer/profile-store.ts server/test/layout.test.ts server/test/standards.test.ts server/test/profile-store.test.ts
git commit -m "Layout je Spielart mit Spielerbereichen, Standard je Spielart"
```

---

### Task 3: Profil Version 4 auf dem Pi (Profil, Speicher, Hub, HTTP)

**Files:**
- Modify: `server/src/viewer/profile.ts`, `server/src/viewer/profile-store.ts`, `server/src/viewer/display-hub.ts`, `server/src/http.ts`, `server/src/viewer/catalog.ts` (Vorlagen und alte Prüfung weg), `server/src/viewer/layout.ts` (alte Exporte weg)
- Test: `server/test/profile.test.ts`, `server/test/profile-store.test.ts`, `server/test/display-hub.test.ts`, `server/test/http.test.ts`, `server/test/catalog.test.ts`, `server/test/content-view.test.js`

**Interfaces:**
- Consumes: Task 1 und 2.
- Produces (profile.ts):
  - `PROFILE_VERSION = 4`
  - `interface ModeEntry { content: Content; layout: ModeLayout }`
  - `interface Profile { version: 4; name: string; gemeinsam: { content: Content; board: BoardLayout }; spielarten: Record<string, ModeEntry> }`
  - `newProfile(name: unknown, board?: BoardLayout): Profile`
  - `sanitizeModeEntry(stored: unknown, mode: string, fallback?: ModeEntry): ModeEntry`
  - `fromV3(source: Record<string, unknown>): Profile`, `sanitizeProfile(stored: unknown): Profile`
  - `sanitizeName`, `slugify`, `uniqueId`, `VALID_ID`, `ProfileWithId`, `ProfileSummary` unverändert
- Produces (profile-store.ts):
  - `ProfileErrorCode = "invalid-id" | "not-found" | "last-profile" | "invalid-mode"`
  - `interface ProfilePatch { name?: unknown; gemeinsam?: unknown; spielart?: unknown }`
  - `create(name: unknown): ProfileWithId` (Scheibe aus dem aktiven Profil)
  - `update(id, patch): ProfileWithId`, `resetMode(id: string, mode: unknown): ProfileWithId`
- Produces (display-hub.ts):
  - `interface Editing { schritt: "inhalte" | "layout"; spielart: string; spieler: number }`
  - `parseEditing(raw: unknown): Editing | null`, `setEditing(editing: Editing | null)`, `get editing(): Editing | null`
  - Nachricht `{ type: "catalog", catalog: ViewerCatalog }`; `{ type: "profile", profile, profiles, editing: Editing | null }`
- HTTP: `POST /api/profiles { name }`, `PUT /api/profiles/:id { name?, gemeinsam?, spielart?, editing? }`, `POST /api/profiles/:id/reset { spielart }`

- [ ] **Step 1: Tests für das Profil schreiben**

`server/test/profile.test.ts`: Die Blöcke `newProfile` und `sanitizeProfile` ersetzen (Tests zu `sanitizeName`, `slugify`, `uniqueId` bleiben):

```ts
import { describe, expect, test } from "vitest";
import { modeDefaults } from "../src/viewer/catalog.js";
import { CARD, DEFAULT_BOARD } from "../src/viewer/layout.js";
import {
  FALLBACK_NAME,
  VALID_ID,
  newProfile,
  sanitizeModeEntry,
  sanitizeName,
  sanitizeProfile,
  slugify,
  uniqueId,
} from "../src/viewer/profile.js";
import { sharedStandard, standardFor } from "../src/viewer/standards.js";

describe("newProfile", () => {
  test("gemeinsamer Standard, keine angepassten Spielarten, Scheibe wie mitgegeben", () => {
    const board = { cx: 40, cy: 30, diameter: 14, rotation: -103 };
    expect(newProfile("Wohnzimmer", board)).toEqual({
      version: 4,
      name: "Wohnzimmer",
      gemeinsam: { content: sharedStandard(), board },
      spielarten: {},
    });
  });

  test("ohne Scheibe gilt die Standardlage", () => {
    expect(newProfile("").gemeinsam.board).toEqual(DEFAULT_BOARD);
    expect(newProfile("").name).toBe(FALLBACK_NAME);
  });
});

describe("sanitizeModeEntry", () => {
  test("ergaenzt aus dem Standard der Spielart und wirft Fremdes weg", () => {
    const entry = sanitizeModeEntry({ content: { spieler: { average: false, name: false } } }, "gotcha");
    expect(entry.content["spieler"]).not.toHaveProperty("average");
    expect(entry.content["spieler"]?.["name"]).toBe(false);
    expect(entry.content["spielinfo"]).toEqual(standardFor("gotcha").content["spielinfo"]);
    expect(entry.layout).toEqual(standardFor("gotcha").layout);
  });
});

describe("sanitizeProfile", () => {
  test("Version 4: prueft gemeinsam und jede Spielart, unbekannte Spielarten fallen weg", () => {
    const profile = sanitizeProfile({
      version: 4,
      name: " Beamer ",
      gemeinsam: { content: { scheibe: { darstellung: "drawn" } }, board: { cx: 300 } },
      spielarten: { cricket: { content: {}, layout: {} }, killer: { content: {} }, x01: "kaputt" },
    });
    expect(profile.name).toBe("Beamer");
    expect(profile.gemeinsam.content["scheibe"]?.["darstellung"]).toBe("drawn");
    expect(profile.gemeinsam.board).toEqual({ ...DEFAULT_BOARD, cx: 100 });
    expect(Object.keys(profile.spielarten)).toEqual(["cricket"]);
    expect(profile.spielarten["cricket"]).toEqual(standardFor("cricket"));
  });

  test("Version 3 wird umgebaut: Scheibe gemeinsam, Rest wird angepasstes X01, Karten 1/2 werden Bereiche", () => {
    const v3 = {
      version: 3,
      name: "Standard",
      content: {
        hintergrund: { on: false },
        scheibe: { on: true, darstellung: "light", zahlenring: false, darts: true, letzterDart: true },
        aufnahme: { on: true, darts: true, summe: false },
        spielinfo: { on: false, punktzahl: true, legs: true, modus: true },
        spieler: { on: true, flaeche: false, profilbild: true, name: true, flagge: true, rest: true, legs: true, checkout: true, average: false, dartzahl: true },
      },
      layout: {
        board: { cx: 42.8987, cy: 28.7953, diameter: 14.04, rotation: -103.05 },
        blocks: {
          spielinfo: { x: 2, y: 3, scale: 1 },
          aufnahme: { x: 33, y: 4, scale: 0.9 },
          "spieler-1": { x: 1.4, y: 32.7, scale: 0.7 },
          "spieler-2": { x: 71, y: 32.7, scale: 0.7 },
        },
      },
    };
    const profile = sanitizeProfile(v3);

    expect(profile.version).toBe(4);
    expect(profile.gemeinsam.board).toEqual(v3.layout.board);
    expect(profile.gemeinsam.content["scheibe"]).toEqual(v3.content.scheibe);
    expect(Object.keys(profile.spielarten)).toEqual(["x01"]);
    const x01 = profile.spielarten["x01"]!;
    expect(x01.content["aufnahme"]).toEqual(v3.content.aufnahme);
    expect(x01.content["spieler"]).toMatchObject({ verteilung: "beide", flaeche: false, average: false });
    expect(x01.content["spielinfo"]).toMatchObject({ on: false, spielart: true });
    expect(x01.layout.blocks.aufnahme).toEqual({ x: 33, y: 4, scale: 0.9 });
    expect(x01.layout.blocks["bereich-links"]).toEqual({ x: 1.4, y: 32.7, w: CARD.w * 0.7, h: CARD.h * 0.7 });
  });

  test("ohne Version 3 oder 4: neues Profil, der Name bleibt", () => {
    const profile = sanitizeProfile({ version: 1, name: "Alt" });
    expect(profile).toEqual(newProfile("Alt"));
  });

  test("Inhalte einer Spielart nutzen modeDefaults nur, wo der Standard nichts sagt", () => {
    const entry = sanitizeModeEntry({}, "x01");
    expect(entry.content["aufnahme"]).toEqual(modeDefaults("x01")["aufnahme"]);
  });
});
```

(Die bisherigen Tests zu `sanitizeName`, `slugify`, `uniqueId` und `VALID_ID` unverändert stehen lassen.)

- [ ] **Step 2: Test läuft rot**

Run: `cd server && npx vitest run test/profile.test.ts`
Expected: FAIL.

- [ ] **Step 3: `profile.ts` auf Version 4 umstellen**

Kopfkommentar:

```ts
/**
 * Ein Profil: Name, ein gemeinsamer Teil (Scheibe samt Lage, Hintergrund) und
 * je Spielart Inhalte und Layout - aber nur fuer angepasste Spielarten. Alle
 * anderen folgen ihrem Standard (standards.ts). Genau ein Profil ist aktiv;
 * alle Geraete zeigen es.
 */
```

Imports und Typen:

```ts
import { isMode, sanitizeModeContent, sanitizeShared, type Content } from "./catalog.js";
import { DEFAULT_BOARD, sanitizeBoard, sanitizeModeLayout, splitLegacyLayout, type BoardLayout, type ModeLayout } from "./layout.js";
import { sharedStandard, standardFor } from "./standards.js";

export const PROFILE_VERSION = 4;

export interface ModeEntry {
  content: Content;
  layout: ModeLayout;
}

export interface Profile {
  version: 4;
  name: string;
  gemeinsam: { content: Content; board: BoardLayout };
  /** Nur angepasste Spielarten. */
  spielarten: Record<string, ModeEntry>;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
```

Funktionen (ersetzen `newProfile` und `sanitizeProfile`):

```ts
/** Neues Profil: gemeinsamer Standard, alle Spielarten im Standard. */
export function newProfile(name: unknown, board: BoardLayout = DEFAULT_BOARD): Profile {
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(name),
    gemeinsam: { content: sharedStandard(), board: { ...board } },
    spielarten: {},
  };
}

/** Eintrag einer Spielart; Fehlendes oder Unbrauchbares aus fallback (Vorgabe: ihr Standard). */
export function sanitizeModeEntry(stored: unknown, mode: string, fallback: ModeEntry = standardFor(mode)): ModeEntry {
  const source = asRecord(stored);
  return {
    content: sanitizeModeContent(source["content"], mode, fallback.content),
    layout: sanitizeModeLayout(source["layout"], fallback.layout),
  };
}

function sanitizeV4(source: Record<string, unknown>): Profile {
  const gemeinsam = asRecord(source["gemeinsam"]);
  const spielarten: Record<string, ModeEntry> = {};
  for (const [mode, entry] of Object.entries(asRecord(source["spielarten"]))) {
    // Ganz Unbrauchbares faellt weg - die Spielart folgt dann ihrem Standard.
    if (isMode(mode) && isRecord(entry)) spielarten[mode] = sanitizeModeEntry(entry, mode);
  }
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(source["name"]),
    gemeinsam: {
      content: sanitizeShared(gemeinsam["content"], sharedStandard()),
      board: sanitizeBoard(gemeinsam["board"]),
    },
    spielarten,
  };
}

/**
 * Profil-Version 3 (Oktober 2026): ein Satz Inhalte und ein Layout fuer
 * alles. Scheibe und Hintergrund werden gemeinsam, der Rest wird die
 * angepasste Spielart X01 - so sieht X01 mit 2 Spielern aus wie vorher.
 */
export function fromV3(source: Record<string, unknown>): Profile {
  const content = asRecord(source["content"]);
  const { board, layout } = splitLegacyLayout(source["layout"]);
  const x01Content = { ...content, spieler: { ...asRecord(content["spieler"]), verteilung: "beide" } };
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(source["name"]),
    gemeinsam: { content: sanitizeShared(content, sharedStandard()), board },
    spielarten: {
      x01: { content: sanitizeModeContent(x01Content, "x01", standardFor("x01").content), layout },
    },
  };
}

/** Macht aus beliebigem gespeichertem Inhalt ein brauchbares Profil. */
export function sanitizeProfile(stored: unknown): Profile {
  const source = asRecord(stored);
  if (source["version"] === PROFILE_VERSION) return sanitizeV4(source);
  if (source["version"] === 3) return fromV3(source);
  return newProfile(source["name"]);
}
```

Wichtig zur Übernahme: In Version 3 war `spielinfo.on` im Profil gespeichert (bei Arnold `false`). `sanitizeModeContent(x01Content, …)` übernimmt diesen Wert, und die neue Option `spielart` kommt aus dem Standard (an). Das ist gewollt, denn die Spielinfo bleibt aus.

- [ ] **Step 4: Profil-Tests grün**

Run: `cd server && npx vitest run test/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Tests für den Speicher anpassen**

In `server/test/profile-store.test.ts`:
- Import `templateContent`/`DEFAULT_LAYOUT` ersetzen durch `import { DEFAULT_BOARD, DEFAULT_MODE_LAYOUT } from "../src/viewer/layout.js";` und `import { sharedStandard, standardFor } from "../src/viewer/standards.js";`.
- Den übersprungenen Übernahme-Test und alle Tests zu `create(name, template)`, `resetContent` und `update({ content | layout })` durch diese ersetzen; die übrigen Tests (Umbenennen, Löschen, Aktiv, Schreiben, kaputte Dateien) auf `create(name)` umstellen und sonst lassen:

```ts
describe("erster Start", () => {
  test("ohne alte Datei entsteht Standard mit gemeinsamem Standard", () => {
    const store = new ProfileStore(dir, legacy);
    expect(store.list()).toEqual([{ id: "standard", name: "Standard" }]);
    const profile = store.active();
    expect(profile.gemeinsam).toEqual({ content: sharedStandard(), board: DEFAULT_BOARD });
    expect(profile.spielarten).toEqual({});
  });

  test("mit alter Datei (version 2): Scheibe gemeinsam, Rest als angepasstes X01", () => {
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "standard.json"), JSON.stringify({ ...LEGACY, blocks: { ...LEGACY.blocks, "spieler-1": { x: 1, y: 30, scale: 1 } } }));
    const profile = new ProfileStore(dir, legacy).active();
    expect(profile.gemeinsam.board).toEqual(LEGACY.board);
    expect(profile.gemeinsam.content["scheibe"]?.["darstellung"]).toBe("drawn");
    expect(profile.spielarten["x01"]?.layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(profile.spielarten["x01"]?.layout.blocks["bereich-links"]).toEqual({ x: 1, y: 30, w: 49, h: 34 });
  });
});

describe("Version 3 auf der Karte", () => {
  test("wird beim Laden umgebaut, die Datei bleibt bis zur naechsten Aenderung Version 3", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "standard.json"),
      JSON.stringify({ version: 3, name: "Standard", content: {}, layout: { board: { cx: 42, cy: 28, diameter: 14, rotation: -103 }, blocks: {} } }),
    );
    const store = new ProfileStore(dir);
    expect(store.active().version).toBe(4);
    expect(store.active().gemeinsam.board).toEqual({ cx: 42, cy: 28, diameter: 14, rotation: -103 });
    expect(onDisk("standard.json").version).toBe(3);

    store.update("standard", { name: "Standard" });
    store.flush();
    expect(onDisk("standard.json").version).toBe(4);
  });
});

describe("anlegen", () => {
  test("uebernimmt die Lage der Scheibe aus dem aktiven Profil und wird aktiv", () => {
    const store = new ProfileStore(dir);
    const board = { cx: 40, cy: 30, diameter: 14, rotation: -103 };
    store.update("standard", { gemeinsam: { board } });

    const created = store.create("Fernseher");

    expect(created.id).toBe("fernseher");
    expect(created.gemeinsam.board).toEqual(board);
    expect(created.gemeinsam.content).toEqual(sharedStandard());
    expect(created.spielarten).toEqual({});
    expect(store.activeId).toBe("fernseher");
  });
});

describe("aendern", () => {
  test("gemeinsamer Teil: Inhalte und Scheibe einzeln", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { gemeinsam: { content: { hintergrund: { on: true } } } });
    const profile = store.update("standard", { gemeinsam: { board: { cx: 10, cy: 20, diameter: 30, rotation: 5 } } });
    expect(profile.gemeinsam.content["hintergrund"]?.on).toBe(true);
    expect(profile.gemeinsam.board).toEqual({ cx: 10, cy: 20, diameter: 30, rotation: 5 });
    expect(profile.spielarten).toEqual({});
  });

  test("die erste Aenderung an einer Spielart legt ihren Eintrag aus dem Standard an", () => {
    const store = new ProfileStore(dir);
    const profile = store.update("standard", { spielart: { id: "cricket", content: { aufnahme: { on: false } } } });
    expect(Object.keys(profile.spielarten)).toEqual(["cricket"]);
    expect(profile.spielarten["cricket"]?.content["aufnahme"]?.on).toBe(false);
    expect(profile.spielarten["cricket"]?.content["spieler"]).toEqual(standardFor("cricket").content["spieler"]);
    expect(profile.spielarten["cricket"]?.layout).toEqual(DEFAULT_MODE_LAYOUT);
  });

  test("Layout einer Spielart aendern laesst ihre Inhalte stehen", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { spielart: { id: "x01", content: { aufnahme: { on: false } } } });
    const blocks = { ...DEFAULT_MODE_LAYOUT.blocks, "bereich-links": { x: 1, y: 10, w: 40, h: 90 } };
    const profile = store.update("standard", { spielart: { id: "x01", layout: { blocks } } });
    expect(profile.spielarten["x01"]?.content["aufnahme"]?.on).toBe(false);
    expect(profile.spielarten["x01"]?.layout.blocks["bereich-links"]).toEqual({ x: 1, y: 10, w: 40, h: 90 });
  });

  test("unbekannte Spielart ist ein Fehler des Aufrufers", () => {
    const store = new ProfileStore(dir);
    expect(errorCode(() => store.update("standard", { spielart: { id: "killer", content: {} } }))).toBe("invalid-mode");
    expect(errorCode(() => store.update("standard", { spielart: "x01" }))).toBe("invalid-mode");
  });

  test("spielart nur mit id (ohne Inhalte/Layout) legt nichts an", () => {
    const store = new ProfileStore(dir);
    expect(store.update("standard", { spielart: { id: "x01" } }).spielarten).toEqual({});
  });

  test("ein Aufruf ohne Aenderung schreibt nichts auf die Karte (Lebenszeichen)", () => {
    vi.useFakeTimers();
    const store = new ProfileStore(dir, null, 500);
    const before = onDisk("standard.json");
    rmSync(join(dir, "standard.json"));
    store.update("standard", {});
    vi.advanceTimersByTime(1000);
    expect(existsSync(join(dir, "standard.json"))).toBe(false);
    writeFileSync(join(dir, "standard.json"), JSON.stringify(before));
  });
});

describe("zuruecksetzen", () => {
  test("loescht den Eintrag der Spielart, der Rest bleibt", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { spielart: { id: "x01", content: { aufnahme: { on: false } } } });
    store.update("standard", { spielart: { id: "gotcha", content: { aufnahme: { on: false } } } });

    const profile = store.resetMode("standard", "x01");

    expect(Object.keys(profile.spielarten)).toEqual(["gotcha"]);
  });

  test("unbekannte Spielart ergibt invalid-mode", () => {
    const store = new ProfileStore(dir);
    expect(errorCode(() => store.resetMode("standard", "killer"))).toBe("invalid-mode");
  });
});
```

- [ ] **Step 6: Test läuft rot**

Run: `cd server && npx vitest run test/profile-store.test.ts`
Expected: FAIL – `create(name)`, `resetMode` und die neuen Felder fehlen.

- [ ] **Step 7: `profile-store.ts` umstellen**

Imports:

```ts
import { isMode, sanitizeShared } from "./catalog.js";
import { fromLegacyLayout, sanitizeBoard } from "./layout.js";
import {
  VALID_ID,
  newProfile,
  sanitizeModeEntry,
  sanitizeName,
  sanitizeProfile,
  uniqueId,
  type Profile,
  type ProfileSummary,
  type ProfileWithId,
} from "./profile.js";
import { standardFor } from "./standards.js";

export type ProfileErrorCode = "invalid-id" | "not-found" | "last-profile" | "invalid-mode";

export interface ProfilePatch {
  name?: unknown;
  /** { content?, board? } */
  gemeinsam?: unknown;
  /** { id, content?, layout? } */
  spielart?: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
```

`create`, `update`, `resetMode` (ersetzen `create`, `update`, `resetContent`):

```ts
  /** Neues Profil, alle Spielarten im Standard; die Scheibe liegt wie im aktiven (derselbe Beamer). */
  create(name: unknown): ProfileWithId {
    const board = this.#profiles.get(this.#active)?.gemeinsam.board;
    const profile = newProfile(name, board);
    const id = uniqueId(profile.name, (candidate) => candidate === RESERVED_ID || this.#profiles.has(candidate));
    this.#profiles.set(id, profile);
    this.#markDirty(id);
    this.#setActive(id);
    return this.read(id);
  }

  /**
   * Aendert nur, was mitgeschickt wird; Unbrauchbares behaelt den bisherigen
   * Wert. Die erste Aenderung an einer Spielart legt ihren Eintrag aus dem
   * Standard an - ab dann ist sie "angepasst".
   */
  update(id: string, patch: ProfilePatch): ProfileWithId {
    const current = this.#get(id);
    const next: Profile = structuredClone(current);
    let changed = false;

    if (patch.name !== undefined) {
      next.name = sanitizeName(patch.name);
      changed = true;
    }
    if (patch.gemeinsam !== undefined) {
      const gemeinsam = asRecord(patch.gemeinsam);
      if (gemeinsam["content"] !== undefined) {
        next.gemeinsam.content = sanitizeShared(gemeinsam["content"], current.gemeinsam.content);
        changed = true;
      }
      if (gemeinsam["board"] !== undefined) {
        next.gemeinsam.board = sanitizeBoard(gemeinsam["board"], current.gemeinsam.board);
        changed = true;
      }
    }
    if (patch.spielart !== undefined) {
      const spielart = asRecord(patch.spielart);
      const mode = spielart["id"];
      if (!isMode(mode)) throw new ProfileError("invalid-mode", "Unbekannte Spielart");
      if (spielart["content"] !== undefined || spielart["layout"] !== undefined) {
        const base = current.spielarten[mode] ?? standardFor(mode);
        next.spielarten[mode] = sanitizeModeEntry(
          { content: spielart["content"] ?? base.content, layout: spielart["layout"] ?? base.layout },
          mode,
          base,
        );
        changed = true;
      }
    }

    if (!changed) return this.read(id); // Lebenszeichen: nichts auf die SD-Karte
    this.#profiles.set(id, next);
    this.#markDirty(id);
    return this.read(id);
  }

  /** Spielart auf ihren Standard zuruecksetzen: der Eintrag faellt weg. */
  resetMode(id: string, mode: unknown): ProfileWithId {
    const current = this.#get(id);
    if (!isMode(mode)) throw new ProfileError("invalid-mode", "Unbekannte Spielart");
    const next = structuredClone(current);
    delete next.spielarten[mode];
    this.#profiles.set(id, next);
    this.#markDirty(id);
    return this.read(id);
  }
```

`#createFirst` (die Zwischenlösung aus Task 2 ersetzen):

```ts
  /** Erster Start: das bisher ausgerichtete Layout wird zum Profil "Standard". */
  #createFirst(legacyDir: string | null): void {
    const legacy = legacyDir === null ? null : fromLegacyLayout(this.#readJson(join(legacyDir, "standard.json")));
    const profile = newProfile("Standard", legacy?.board);
    if (legacy) {
      profile.gemeinsam.content = sanitizeShared(
        { scheibe: { darstellung: legacy.boardMode } },
        profile.gemeinsam.content,
      );
      profile.spielarten["x01"] = { content: standardFor("x01").content, layout: legacy.layout };
    }
    this.#profiles.set(FIRST_ID, profile);
    this.#pending.add(FIRST_ID);
    this.#active = FIRST_ID;
    this.#activePending = true;
    this.flush();
  }
```

Den Kopfkommentar um einen Satz ergänzen: „Profile der Version 3 werden beim Laden umgebaut und erst beim naechsten Aendern als Version 4 geschrieben - bis dahin bleibt die alte Datei der Rueckweg.“

- [ ] **Step 8: Speicher-Tests grün**

Run: `cd server && npx vitest run test/profile.test.ts test/profile-store.test.ts`
Expected: PASS.

- [ ] **Step 9: Hub-Tests anpassen**

In `server/test/display-hub.test.ts`:
- `import { CATALOG }` ersetzen durch `import { viewerCatalog } from "../src/viewer/standards.js";`; überall `catalog: CATALOG` → `catalog: viewerCatalog()`.
- `editStep` → `parseEditing`; `UNSUPPORTED` durch einen beliebigen anderen Stand ersetzen, z. B. `const OTHER: ViewerState = IDLE;` mit einem zweiten `broadcast` (der Test prüft nur das Verteilen).
- Alle `setEditing("layout")`/`"inhalte"` → `setEditing({ schritt: "layout", spielart: "x01", spieler: 2 })` usw.; erwartete `editing`-Werte entsprechend.
- Den Block `describe("editStep")` ersetzen:

```ts
describe("parseEditing", () => {
  test("Schritt, Spielart und Spielerzahl; sonst wird nicht eingestellt", () => {
    expect(parseEditing({ schritt: "layout", spielart: "cricket", spieler: 4 })).toEqual({
      schritt: "layout",
      spielart: "cricket",
      spieler: 4,
    });
    expect(parseEditing(null)).toBeNull();
    expect(parseEditing("layout")).toBeNull();
    expect(parseEditing({ schritt: "fertig" })).toBeNull();
  });

  test("unbekannte Spielart → X01, Spielerzahl ausserhalb 1-6 → 2", () => {
    expect(parseEditing({ schritt: "inhalte", spielart: "killer", spieler: 9 })).toEqual({
      schritt: "inhalte",
      spielart: "x01",
      spieler: 2,
    });
    expect(parseEditing({ schritt: "inhalte", spieler: 2.5 })?.spieler).toBe(2);
  });
});
```

- [ ] **Step 10: `display-hub.ts` umstellen**

```ts
import { FALLBACK_MODE, isMode } from "./catalog.js";
import { IDLE, type ViewerState } from "./game-state.js";
import type { ProfileSummary, ProfileWithId } from "./profile.js";
import { viewerCatalog, type ViewerCatalog } from "./standards.js";

/** Wer gerade einstellt: Schritt, die Spielart in der Leiste und die Spielerzahl der Vorschau. */
export interface Editing {
  schritt: "inhalte" | "layout";
  spielart: string;
  spieler: number;
}

export type ViewerMessage =
  | { type: "catalog"; catalog: ViewerCatalog }
  | { type: "state"; state: ViewerState }
  | { type: "profile"; profile: ProfileWithId; profiles: ProfileSummary[]; editing: Editing | null };

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;

/** Nur die beiden Schritte gelten; alles andere heisst "es wird nicht eingestellt". */
export function parseEditing(raw: unknown): Editing | null {
  const source = asRecord(raw);
  const schritt = source["schritt"];
  if (schritt !== "inhalte" && schritt !== "layout") return null;
  const spieler = source["spieler"];
  return {
    schritt,
    spielart: isMode(source["spielart"]) ? source["spielart"] : FALLBACK_MODE,
    spieler: typeof spieler === "number" && Number.isInteger(spieler) && spieler >= 1 && spieler <= 6 ? spieler : 2,
  };
}
```

In der Klasse: `#editing: Editing | null`, `setEditing(editing: Editing | null)` (Körper unverändert, nur Typ), Getter `editing: Editing | null`, und in `attach` `{ type: "catalog", catalog: viewerCatalog() }`. Den Kopfkommentar anpassen: „"editing" sagt allen Viewern, dass gerade eingestellt wird, in welchem Schritt, fuer welche Spielart und mit wie vielen Spielern in der Vorschau.“

- [ ] **Step 11: HTTP-Tests anpassen**

In `server/test/http.test.ts` im Block „Profil-API“ die Tests zu Vorlage, Ändern und Zurücksetzen ersetzen (Hilfsfunktionen des Blocks wie bisher benutzen; hier mit `app.inject`, wie in der Datei üblich – vor dem Schreiben die vorhandenen Tests im Block ansehen und deren Hilfsfunktion `send`/`headers` übernehmen):

```ts
  test("legt ein Profil nur mit Namen an und macht es aktiv", async () => {
    const response = await app.inject({ method: "POST", url: "/api/profiles", headers: HEADERS, payload: { name: "Fernseher" } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ id: "fernseher", name: "Fernseher", version: 4, spielarten: {} });
    expect(deps.profiles.activeId).toBe("fernseher");
  });

  test("aendert gemeinsam und eine Spielart, setzt editing fuer das aktive", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/profiles/standard",
      headers: HEADERS,
      payload: {
        gemeinsam: { content: { hintergrund: { on: true } } },
        spielart: { id: "cricket", content: { aufnahme: { on: false } } },
        editing: { schritt: "inhalte", spielart: "cricket", spieler: 3 },
      },
    });
    expect(response.statusCode).toBe(200);
    const profile = response.json();
    expect(profile.gemeinsam.content.hintergrund.on).toBe(true);
    expect(profile.spielarten.cricket.content.aufnahme.on).toBe(false);
    expect(deps.hub.editing).toEqual({ schritt: "inhalte", spielart: "cricket", spieler: 3 });
  });

  test("unbekannte Spielart beim Aendern oder Zuruecksetzen ergibt 400", async () => {
    const put = await app.inject({
      method: "PUT",
      url: "/api/profiles/standard",
      headers: HEADERS,
      payload: { spielart: { id: "killer", content: {} } },
    });
    expect(put.statusCode).toBe(400);
    const reset = await app.inject({
      method: "POST",
      url: "/api/profiles/standard/reset",
      headers: HEADERS,
      payload: { spielart: "killer" },
    });
    expect(reset.statusCode).toBe(400);
  });

  test("setzt eine Spielart auf den Standard zurueck", async () => {
    deps.profiles.update("standard", { spielart: { id: "x01", content: { aufnahme: { on: false } } } });
    const response = await app.inject({
      method: "POST",
      url: "/api/profiles/standard/reset",
      headers: HEADERS,
      payload: { spielart: "x01" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().spielarten).toEqual({});
  });
```

Bestehende Tests zu `editing` (`"layout"` → Objekt, `null` beendet) entsprechend umstellen; `deps`, `app`, `HEADERS` heißen in der Datei eventuell anders – die vorhandenen Namen verwenden.

- [ ] **Step 12: `http.ts` umstellen**

```ts
  app.post<{ Body: unknown }>("/api/profiles", async (request, reply) =>
    withProfiles(reply, () => {
      const profile = deps.profiles.create(fields(request.body)["name"]);
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
        gemeinsam: body["gemeinsam"],
        spielart: body["spielart"],
      });
      // Einstellen betrifft, was die Viewer zeigen - also nur das aktive Profil.
      if (body["editing"] !== undefined && id === deps.profiles.activeId) {
        deps.hub.setEditing(parseEditing(body["editing"]));
      }
      deps.hub.publishProfile();
      return profile;
    }),
  );

  app.post<{ Params: { id: string }; Body: unknown }>("/api/profiles/:id/reset", async (request, reply) =>
    withProfiles(reply, () => {
      const profile = deps.profiles.resetMode(request.params.id, fields(request.body)["spielart"]);
      deps.hub.publishProfile();
      return profile;
    }),
  );
```

`PROFILE_ERROR_CODES`: `"invalid-template": 400` → `"invalid-mode": 400`. Import `editStep` → `parseEditing`.

- [ ] **Step 13: Alte Teile entfernen**

- `catalog.ts`: `Template`, `templates`, `DEFAULT_TEMPLATE`, `templateContent`, `sanitizeContent` und `defaultContent` entfernen; `Catalog` ist nur noch `{ parts: Part[] }`. Den Absatz zu Vorlagen im Kopfkommentar durch „Standards je Spielart stehen in standards.ts“ ersetzen.
- `layout.ts`: `PLAYER_BLOCKS`, `BLOCK_IDS`, `BlockId`, `DisplayLayout`, `DEFAULT_LAYOUT`, `sanitizeLayout` entfernen.
- `test/catalog.test.ts`: Tests zu Vorlagen, `defaultContent`, `sanitizeContent` entfernen bzw. auf `sharedDefaults`/`modeDefaults`/`sanitizeShared`/`sanitizeModeContent` umstellen (die Tests aus Task 1 decken das ab; „Vorgaben wie in der Spec“ auf `{ ...sharedDefaults(), ...modeDefaults("x01") }` umstellen).
- `test/content-view.test.js`: `defaultContent()` → `{ ...sharedDefaults(), ...modeDefaults("x01") }`, `sanitizeContent(x)` → `{ ...sanitizeShared(x), ...sanitizeModeContent(x, "x01") }`. (Der Aufruf `contentAttributes(CATALOG, …)` bekommt in Task 5 die Spielart dazu.)

Run: `cd server && npx tsc --noEmit`
Expected: keine Fehler. Falls `index.ts` oder `replay.ts` noch alte Namen nutzen, dort ersetzen.

- [ ] **Step 14: Gesamtlauf und Commit**

Run: `cd server && npm test && npm run typecheck`
Expected: grün.

```bash
git add server/src server/test
git commit -m "Profil Version 4: gemeinsamer Teil und angepasste Spielarten, Vorlagen entfallen"
```

---

### Task 4: Spielart erkennen und feste Plätze

**Files:**
- Modify: `server/src/viewer/game-state.ts`, `server/src/viewer/pipeline.ts`
- Create: `server/src/viewer/seats.ts`
- Test: `server/test/game-state.test.ts`, Create: `server/test/seats.test.ts`, `server/test/pipeline.test.ts`, ggf. `server/test/ingest-e2e.test.ts`

**Interfaces:**
- Consumes: `modeForVariant` (Task 1)
- Produces:
  - `MatchInfo { baseScore: number | null; legsToWin: number; setsToWin: number | null; inMode: Mode | null; outMode: Mode | null }`
  - `PlayerView` zusätzlich `id: string | null; seat: number` (1–6; ohne Plätze = Stelle + 1)
  - `ViewerState = { phase: "idle" } | { phase: "playing"; variant: string; mode: string | null; matchId: string | null; match; players; turn; highlights }` – `unsupported` entfällt
  - `class SeatKeeper { apply(state: ViewerState): ViewerState }`

- [ ] **Step 1: Tests für die Erkennung schreiben**

In `server/test/game-state.test.ts`:
- Die erwarteten Spielerobjekte im Test „ein Dart …“ (und alle anderen `toEqual` auf ganze Spieler) um `id` und `seat` ergänzen: Spieler 0 `id: "01a11b7b-1625-7871-93d0-60bbb3f4de83", seat: 1`, Spieler 1 `id: "01a11b7b-162b-76ae-a770-78b8913b79e3", seat: 2` (ab Frame 106; Frames 9–88 haben das erste Match mit `01a11b79-…`).
- `expect(state.variant).toBe("X01")` ergänzen um `expect(state.mode).toBe("x01"); expect(state.matchId).toBe(<id des Matches aus dem Frame>)`. Die id holt der Test aus dem Frame, damit sie nicht abgeschrieben werden muss.
- Den Test zu `unsupported` ersetzen:

```ts
describe("andere Spielarten", () => {
  /** Ein X01-Frame aus dem Mitschnitt, umgeschrieben auf eine andere variant, ohne X01-Einstellungen. */
  function otherVariant(variant: string): unknown {
    const frame = structuredClone(FRAMES[106]) as Record<string, unknown>;
    const state = (frame["data"] ?? frame) as Record<string, unknown>;
    state["variant"] = variant;
    state["settings"] = {};
    return frame;
  }

  test("Cricket: allgemeiner Stand mit Spielern, Aufnahme und Spielart", () => {
    const state = toViewerState(otherVariant("Cricket"));
    if (state.phase !== "playing") throw new Error("kein Spiel");
    expect(state.mode).toBe("cricket");
    expect(state.variant).toBe("Cricket");
    expect(state.players).toHaveLength(2);
    expect(state.players[0]?.name).toBe("testuser01");
    expect(state.turn.darts).toHaveLength(1);
    expect(state.match).toEqual({ baseScore: null, legsToWin: 1, setsToWin: null, inMode: null, outMode: null });
  });

  test("unbekannte Spielart: mode null, trotzdem ein Spiel", () => {
    const state = toViewerState(otherVariant("Killer"));
    expect(state.phase).toBe("playing");
    if (state.phase === "playing") expect(state.mode).toBeNull();
  });
});
```

Falls `FRAMES[106]` die Daten nicht unter `data` trägt, nimmt `otherVariant` das Objekt selbst (siehe `frame["data"] ?? frame`).

- [ ] **Step 2: Tests für die Plätze schreiben**

`server/test/seats.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { PlayerView, ViewerState } from "../src/viewer/game-state.js";
import { SeatKeeper } from "../src/viewer/seats.js";

const player = (id: string | null, name = id ?? "?"): PlayerView => ({
  id,
  seat: 0,
  name,
  avatarUrl: null,
  country: null,
  score: 0,
  legs: 0,
  sets: 0,
  average: { leg: 0, match: 0 },
  dartsThrown: 0,
  isActive: false,
  isWinner: false,
  busted: false,
  checkout: null,
});

function playing(matchId: string | null, players: PlayerView[]): ViewerState {
  return {
    phase: "playing",
    variant: "X01",
    mode: "x01",
    matchId,
    match: { baseScore: 501, legsToWin: 2, setsToWin: null, inMode: "Straight", outMode: "Double" },
    players,
    turn: { darts: [], points: 0, busted: false },
    highlights: [],
  };
}

const seatsOf = (state: ViewerState) =>
  state.phase === "playing" ? state.players.map((p) => [p.name, p.seat]) : [];

describe("SeatKeeper", () => {
  test("erster Stand eines Matches: Plaetze in der Reihenfolge der Daten", () => {
    const keeper = new SeatKeeper();
    expect(seatsOf(keeper.apply(playing("m1", [player("a"), player("b"), player("c")])))).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });

  test("gleiche Spieler in anderer Reihenfolge behalten ihren Platz (naechstes Leg)", () => {
    const keeper = new SeatKeeper();
    keeper.apply(playing("m1", [player("a"), player("b"), player("c")]));
    expect(seatsOf(keeper.apply(playing("m1", [player("b"), player("c"), player("a")])))).toEqual([
      ["b", 2],
      ["c", 3],
      ["a", 1],
    ]);
  });

  test("neues Match ordnet neu", () => {
    const keeper = new SeatKeeper();
    keeper.apply(playing("m1", [player("a"), player("b")]));
    expect(seatsOf(keeper.apply(playing("m2", [player("b"), player("a")])))).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  test("neuer Spieler im Match bekommt den naechsten freien Platz", () => {
    const keeper = new SeatKeeper();
    keeper.apply(playing("m1", [player("a"), player("b")]));
    expect(seatsOf(keeper.apply(playing("m1", [player("c"), player("a"), player("b")])))).toEqual([
      ["c", 3],
      ["a", 1],
      ["b", 2],
    ]);
  });

  test("ohne Spieler-id zaehlt die Stelle, ohne Match-id bleibt alles bei der Stelle", () => {
    const keeper = new SeatKeeper();
    expect(seatsOf(keeper.apply(playing("m1", [player(null, "x"), player(null, "y")])))).toEqual([
      ["x", 1],
      ["y", 2],
    ]);
    expect(seatsOf(keeper.apply(playing(null, [player("b"), player("a")])))).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  test("idle bleibt unveraendert", () => {
    const keeper = new SeatKeeper();
    const idle: ViewerState = { phase: "idle" };
    expect(keeper.apply(idle)).toBe(idle);
  });
});
```

- [ ] **Step 3: Tests laufen rot**

Run: `cd server && npx vitest run test/game-state.test.ts test/seats.test.ts`
Expected: FAIL.

- [ ] **Step 4: `game-state.ts` umbauen**

Kopfkommentar: „Spielregeln (Rest, Bust, Checkout-Weg, Sieger) entscheidet Autodarts“ bleibt; ergänzen: „Ausser X01 sind die Felder der Spielarten ungeprueft: uebersetzt wird, was in allen gleich aussieht (Spieler, Punktestand, Aufnahme); was fehlt, bleibt leer statt geraten.“

Typen:

```ts
export interface MatchInfo {
  /** Startpunkte bei X01; sonst null. */
  baseScore: number | null;
  legsToWin: number;
  setsToWin: number | null;
  inMode: Mode | null;
  outMode: Mode | null;
}

export interface PlayerView {
  /** Spieler-id von Autodarts; Grundlage fuer feste Plaetze im Match. */
  id: string | null;
  /** Platz 1-6, fest fuer das ganze Match (seats.ts); hier zunaechst die Stelle in den Daten. */
  seat: number;
  name: string;
  // ... Rest unveraendert
}

export type ViewerState =
  | { phase: "idle" }
  | {
      phase: "playing";
      /** Roher Wert von Autodarts. */
      variant: string;
      /** id aus dem Katalog; null = unbekannte Spielart. */
      mode: string | null;
      matchId: string | null;
      match: MatchInfo;
      players: PlayerView[];
      turn: { darts: TurnDart[]; points: number; busted: boolean };
      highlights: Highlight[];
    };
```

In `toViewerState`:

```ts
  const variant = asText(state["variant"]) ?? "X01";
  const mode = modeForVariant(variant);
```

(statt der Zeile mit `unsupported`). In `players.map` `id: asText(player["id"]), seat: index + 1,` vorn ergänzen. Rückgabe:

```ts
  const settings = asObject(state["settings"]);
  const sets = state["sets"];
  const optionalMode = (v: unknown): Mode | null => (v === undefined ? null : toMode(v));
  return {
    phase: "playing",
    variant,
    mode,
    matchId: asText(state["id"]),
    match: {
      baseScore: typeof settings["baseScore"] === "number" ? settings["baseScore"] : null,
      legsToWin: asNumber(state["legs"], 1),
      setsToWin: typeof sets === "number" ? sets : null,
      inMode: optionalMode(settings["inMode"]),
      outMode: optionalMode(settings["outMode"]),
    },
    players: playerViews,
    turn: { darts, points: asNumber(state["turnScore"]), busted: turnBusted },
    highlights: last && last.field.multiplier !== 0 ? [{ field: last.field, kind: "last-dart" }] : [],
  };
```

Import: `import { modeForVariant } from "./catalog.js";`

- [ ] **Step 5: `seats.ts` schreiben**

```ts
/**
 * Feste Plaetze im Match: Bei mehreren Legs kann Autodarts die Reihenfolge der
 * Spieler aendern. Damit niemand mitten im Match die Seite wechselt, behaelt
 * jeder Spieler den Platz aus dem ersten Stand, den der Pi vom Match sieht.
 * Gemerkt wird nur das laufende Match, im Speicher.
 */
import type { ViewerState } from "./game-state.js";

export class SeatKeeper {
  #matchId: string | null = null;
  readonly #seats = new Map<string, number>();

  apply(state: ViewerState): ViewerState {
    if (state.phase !== "playing" || state.matchId === null) return state;
    if (state.matchId !== this.#matchId) {
      this.#matchId = state.matchId;
      this.#seats.clear();
    }
    const taken = new Set(this.#seats.values());
    const players = state.players.map((player, index) => {
      if (player.id === null) return { ...player, seat: index + 1 };
      let seat = this.#seats.get(player.id);
      if (seat === undefined) {
        seat = 1;
        while (taken.has(seat)) seat++;
        this.#seats.set(player.id, seat);
        taken.add(seat);
      }
      return { ...player, seat };
    });
    return { ...state, players };
  }
}
```

- [ ] **Step 6: Pipeline: Plätze anwenden, unbekannte Spielart melden**

Test in `server/test/pipeline.test.ts` ergänzen (Hilfen der Datei nutzen):

```ts
  test("meldet eine unbekannte Spielart einmal je Wert", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hub = { broadcast: vi.fn() } as unknown as DisplayHub;
    const run = createFramePipeline(hub, null);
    const frame = structuredClone(FRAMES[106]) as Record<string, unknown>;
    ((frame["data"] ?? frame) as Record<string, unknown>)["variant"] = "Killer";

    run(frame);
    run(frame);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("Killer");
    warn.mockRestore();
  });
```

(`FRAMES` wie in `game-state.test.ts` laden, falls die Datei es noch nicht tut.)

`pipeline.ts`:

```ts
import { SeatKeeper } from "./seats.js";

export function createFramePipeline(hub: DisplayHub, recorder: FrameSink | null): (frame: unknown) => void {
  const seats = new SeatKeeper();
  const reported = new Set<string>();
  return (frame) => {
    // ... Aufzeichnen und Uebersetzen wie bisher ...
    if (state === IDLE) return;
    state = seats.apply(state);
    if (state.phase === "playing" && state.mode === null && !reported.has(state.variant)) {
      reported.add(state.variant);
      console.warn(`Spielart "${state.variant}" unbekannt - allgemeine Darstellung`);
    }
    hub.broadcast(state);
  };
}
```

- [ ] **Step 7: Tests grün, übrige anpassen**

Run: `cd server && npm test`
Expected: Fehlschläge nur dort, wo ganze Stände verglichen werden (`ingest-e2e.test.ts`, `display-hub.test.ts`): erwartete Spieler um `id`/`seat` und Stände um `mode`/`matchId` ergänzen bzw. auf `toMatchObject` umstellen. Danach grün.

Run: `cd server && npm run typecheck`
Expected: Fehler in keiner Server-Datei.

- [ ] **Step 8: Commit**

```bash
git add server/src/viewer/game-state.ts server/src/viewer/seats.ts server/src/viewer/pipeline.ts server/test
git commit -m "Spielart aus variant erkennen, allgemeiner Stand fuer alle Spielarten, feste Plaetze im Match"
```

---

### Task 5: Viewer-Grundlagen (reine Funktionen)

**Files:**
- Create: `server/public/js/areas.js`, `server/public/js/resolve-profile.js`
- Modify: `server/public/js/content-view.js`, `server/public/js/labels.js`, `server/public/js/sample-state.js`
- Test: Create `server/test/areas.test.js`, `server/test/resolve-profile.test.js`, `server/test/sample-state.test.js`; Modify `server/test/content-view.test.js`, `server/test/labels.test.js`

**Interfaces:**
- Consumes: `viewerCatalog()` (Task 2), Profil Version 4 (Task 3), `ViewerState` mit `mode`/`seat` (Task 4)
- Produces:
  - `areas.js`: `CARD_W = 49`, `CARD_H = 34`, `GAP = 1.5`, `sideOf(seat, verteilung): "links" | "rechts"`, `arrangeCards(seats: number[], verteilung, areas: { links: Area, rechts: Area }) → { visible: { links, rechts }, scale, cards: [{ seat, side, left, top, scale }] }` (left/top in vh relativ zum Bereich)
  - `resolve-profile.js`: `FALLBACK_MODE = "x01"`, `resolveProfile(profile, catalog, mode) → { content, layout: { board, blocks }, angepasst }`, `withBoard(profile, board)`, `withModeBlocks(profile, catalog, mode, blocks)`, `withContent(profile, catalog, mode, content)`, `isShared(catalog, partId)`
  - `content-view.js`: `contentAttributes(catalog, content, mode)`, `applyContent(el, catalog, content, mode)` – `mode` ist die Spielart-id oder `null`
  - `labels.js`: `matchChips(match, modeLabel) → [{ key, text }]`
  - `sample-state.js`: `sampleState(mode, count) → ViewerState`

- [ ] **Step 1: Tests für `areas.js`**

`server/test/areas.test.js`:

```js
import { describe, expect, test } from "vitest";
import { CARD_H, CARD_W, GAP, arrangeCards, sideOf } from "../public/js/areas.js";

const AREAS = {
  links: { x: 1.4, y: 32.7, w: 49, h: 34 },
  rechts: { x: 71, y: 32.7, w: 49, h: 34 },
};
const TALL = {
  links: { x: 1, y: 5, w: 40, h: 90 },
  rechts: { x: 70, y: 5, w: 40, h: 90 },
};
const seats = (n) => Array.from({ length: n }, (_, i) => i + 1);

describe("sideOf", () => {
  test("beide: ungerade links, gerade rechts; sonst alle auf eine Seite", () => {
    expect([1, 2, 3, 4, 5, 6].map((s) => sideOf(s, "beide"))).toEqual(["links", "rechts", "links", "rechts", "links", "rechts"]);
    expect(sideOf(2, "links")).toBe("links");
    expect(sideOf(1, "rechts")).toBe("rechts");
  });
});

describe("arrangeCards", () => {
  test("Bereiche aus der Uebernahme ergeben die alten Karten (2 Spieler, Skalierung 1)", () => {
    const { cards, scale } = arrangeCards(seats(2), "beide", AREAS);
    expect(scale).toBe(1);
    expect(cards).toEqual([
      { seat: 1, side: "links", left: 0, top: 0, scale: 1 },
      { seat: 2, side: "rechts", left: 0, top: 0, scale: 1 },
    ]);
  });

  test("Uebernahme mit Skalierung 0,7: Karte fuellt den Bereich genau", () => {
    const small = {
      links: { x: 1, y: 30, w: CARD_W * 0.7, h: CARD_H * 0.7 },
      rechts: { x: 70, y: 30, w: CARD_W * 0.7, h: CARD_H * 0.7 },
    };
    const { cards } = arrangeCards(seats(2), "beide", small);
    expect(cards[0].scale).toBeCloseTo(0.7);
    expect(cards[0].top).toBeCloseTo(0);
    expect(cards[1].left).toBeCloseTo(0);
  });

  test("1 bis 6 Spieler: alle Karten gleich gross, keine passt nicht in ihren Bereich", () => {
    for (const verteilung of ["beide", "links", "rechts"]) {
      for (let n = 1; n <= 6; n++) {
        const { cards, scale } = arrangeCards(seats(n), verteilung, TALL);
        expect(cards, `${verteilung} ${n}`).toHaveLength(n);
        for (const card of cards) {
          expect(card.scale).toBe(scale);
          const area = TALL[card.side];
          expect(card.left).toBeGreaterThanOrEqual(-1e-9);
          expect(card.left + CARD_W * scale).toBeLessThanOrEqual(area.w + 1e-9);
          expect(card.top).toBeGreaterThanOrEqual(-1e-9);
          expect(card.top + CARD_H * scale).toBeLessThanOrEqual(area.h + 1e-9);
        }
      }
    }
  });

  test("3 Spieler: Groesse nach dem volleren Bereich, auch rechts", () => {
    const { cards, scale } = arrangeCards(seats(3), "beide", TALL);
    const expected = Math.min(40 / CARD_W, (90 - GAP) / (CARD_H * 2));
    expect(scale).toBeCloseTo(expected);
    expect(cards.find((c) => c.seat === 2).scale).toBeCloseTo(expected);
  });

  test("senkrecht mittig, links buendig links, rechts buendig rechts", () => {
    const { cards, scale } = arrangeCards(seats(2), "beide", TALL);
    const height = CARD_H * scale;
    expect(cards[0].top).toBeCloseTo((90 - height) / 2);
    expect(cards[0].left).toBe(0);
    expect(cards[1].left).toBeCloseTo(40 - CARD_W * scale);
  });

  test("Breite begrenzt: 1 Spieler wird nie breiter als der Bereich", () => {
    const { scale } = arrangeCards(seats(1), "beide", TALL);
    expect(scale).toBeCloseTo(40 / CARD_W);
  });

  test("Verteilung links: rechter Bereich unsichtbar und zaehlt nicht fuer die Groesse", () => {
    const narrowRight = { links: TALL.links, rechts: { x: 70, y: 5, w: 5, h: 5 } };
    const { visible, scale, cards } = arrangeCards(seats(2), "links", narrowRight);
    expect(visible).toEqual({ links: true, rechts: false });
    expect(cards.every((c) => c.side === "links")).toBe(true);
    expect(scale).toBeCloseTo(Math.min(40 / CARD_W, (90 - GAP) / (CARD_H * 2)));
  });

  test("Karten eines Bereichs stehen nach Platz sortiert", () => {
    const { cards } = arrangeCards([5, 1, 3], "links", TALL);
    expect(cards.map((c) => c.seat)).toEqual([1, 3, 5]);
    expect(cards[0].top).toBeLessThan(cards[1].top);
  });
});
```

- [ ] **Step 2: Test rot, dann `areas.js` schreiben**

Run: `cd server && npx vitest run test/areas.test.js` → FAIL (Modul fehlt).

`server/public/js/areas.js`:

```js
/*
 * Spielerkarten in den beiden Bereichen anordnen. Reine Funktion ohne DOM.
 *
 * Alle Karten sind gleich gross: Die Groesse richtet sich nach dem volleren
 * Bereich und haengt nur von der Spielerzahl ab - waehrend eines Spiels
 * springt nichts. Die Breite eines Bereichs begrenzt die Groesse, damit eine
 * einzelne Karte nicht riesig wird.
 */

/** Grundgroesse einer Karte in vh (style.css: .card) und Abstand untereinander. */
export const CARD_W = 49;
export const CARD_H = 34;
export const GAP = 1.5;

const SIDES = ["links", "rechts"];

export function sideOf(seat, verteilung) {
  if (verteilung === "links" || verteilung === "rechts") return verteilung;
  return seat % 2 === 1 ? "links" : "rechts";
}

/**
 * seats: die Plaetze der Spieler (1-6); areas: { links, rechts } mit w/h in vh.
 * left/top der Karten in vh, relativ zur linken oberen Ecke ihres Bereichs.
 */
export function arrangeCards(seats, verteilung, areas) {
  const visible = { links: verteilung !== "rechts", rechts: verteilung !== "links" };
  const bySide = { links: [], rechts: [] };
  for (const seat of [...seats].sort((a, b) => a - b)) bySide[sideOf(seat, verteilung)].push(seat);

  const n = Math.max(1, bySide.links.length, bySide.rechts.length);
  const fit = (area) => Math.min(area.w / CARD_W, (area.h - GAP * (n - 1)) / (CARD_H * n));
  const scale = Math.max(0.05, Math.min(...SIDES.filter((side) => visible[side]).map((side) => fit(areas[side]))));

  const cards = [];
  for (const side of SIDES) {
    const area = areas[side];
    const list = bySide[side];
    const height = list.length * CARD_H * scale + Math.max(0, list.length - 1) * GAP;
    const top = (area.h - height) / 2;
    const left = side === "links" ? 0 : area.w - CARD_W * scale;
    list.forEach((seat, index) => {
      cards.push({ seat, side, left, top: top + index * (CARD_H * scale + GAP), scale });
    });
  }
  return { visible, scale, cards };
}
```

Hinweis: Im Test „Bereiche aus der Übernahme“ ist `left` rechts `49 - 49 * 1 = 0` und `top` `(34 - 34) / 2 = 0` – exakt.

Run: `cd server && npx vitest run test/areas.test.js` → PASS.

- [ ] **Step 3: Tests für `resolve-profile.js`**

`server/test/resolve-profile.test.js`:

```js
import { describe, expect, test } from "vitest";
import { resolveProfile, withBoard, withContent, withModeBlocks } from "../public/js/resolve-profile.js";
import { newProfile } from "../src/viewer/profile.ts";
import { viewerCatalog } from "../src/viewer/standards.ts";

const catalog = viewerCatalog();
const BOARD = { cx: 40, cy: 30, diameter: 14, rotation: -103 };

describe("resolveProfile", () => {
  test("Spielart im Standard: gemeinsam + Standard, nicht angepasst", () => {
    const profile = newProfile("P", BOARD);
    const resolved = resolveProfile(profile, catalog, "cricket");
    expect(resolved.angepasst).toBe(false);
    expect(resolved.layout.board).toEqual(BOARD);
    expect(resolved.layout.blocks).toEqual(catalog.standards.cricket.layout.blocks);
    expect(resolved.content.scheibe).toEqual(profile.gemeinsam.content.scheibe);
    expect(resolved.content.spieler).toEqual(catalog.standards.cricket.content.spieler);
  });

  test("angepasste Spielart gewinnt", () => {
    const profile = newProfile("P", BOARD);
    profile.spielarten.x01 = structuredClone(catalog.standards.x01);
    profile.spielarten.x01.content.aufnahme.on = false;
    const resolved = resolveProfile(profile, catalog, "x01");
    expect(resolved.angepasst).toBe(true);
    expect(resolved.content.aufnahme.on).toBe(false);
  });

  test("unbekannte Spielart (null) nutzt den X01-Teil", () => {
    const profile = newProfile("P", BOARD);
    profile.spielarten.x01 = structuredClone(catalog.standards.x01);
    profile.spielarten.x01.layout.blocks.aufnahme.x = 11;
    expect(resolveProfile(profile, catalog, null).layout.blocks.aufnahme.x).toBe(11);
  });
});

describe("lokale Aenderungen", () => {
  test("withBoard aendert nur die Scheibe, keine Spielart wird angepasst", () => {
    const profile = withBoard(newProfile("P"), BOARD);
    expect(profile.gemeinsam.board).toEqual(BOARD);
    expect(profile.spielarten).toEqual({});
  });

  test("withModeBlocks legt die Spielart aus dem Standard an", () => {
    const blocks = { ...catalog.standards.gotcha.layout.blocks, aufnahme: { x: 1, y: 2, scale: 3 } };
    const profile = withModeBlocks(newProfile("P"), catalog, "gotcha", blocks);
    expect(profile.spielarten.gotcha.layout.blocks.aufnahme).toEqual({ x: 1, y: 2, scale: 3 });
    expect(profile.spielarten.gotcha.content).toEqual(catalog.standards.gotcha.content);
  });

  test("withContent teilt nach gemeinsam und Spielart auf", () => {
    const base = newProfile("P");
    const resolved = resolveProfile(base, catalog, "x01");

    const shared = withContent(base, catalog, "x01", { ...resolved.content, hintergrund: { on: true } });
    expect(shared.gemeinsam.content.hintergrund.on).toBe(true);
    expect(shared.spielarten).toEqual({});

    const own = withContent(base, catalog, "x01", {
      ...resolved.content,
      aufnahme: { ...resolved.content.aufnahme, on: false },
    });
    expect(own.spielarten.x01.content.aufnahme.on).toBe(false);
    expect(own.spielarten.x01.content).not.toHaveProperty("scheibe");
  });
});
```

- [ ] **Step 4: Test rot, dann `resolve-profile.js` schreiben**

Run: `cd server && npx vitest run test/resolve-profile.test.js` → FAIL.

`server/public/js/resolve-profile.js`:

```js
/*
 * Profil + Spielart → was der Viewer zeichnet. Ein Profil speichert nur
 * angepasste Spielarten; alle anderen folgen dem Standard aus dem Katalog.
 *
 * Dazu die lokalen Aenderungen beim Einstellen: Sie werden sofort ins eigene
 * Bild eingebaut, bevor das Echo vom Pi kommt. Reine Funktionen ohne DOM.
 */

/** Profilteil fuer unbekannte Spielarten und vor dem ersten Spiel. */
export const FALLBACK_MODE = "x01";

const entryFor = (profile, catalog, mode) =>
  profile.spielarten[mode] ?? catalog.standards[mode] ?? catalog.standards[FALLBACK_MODE];

export const isShared = (catalog, partId) =>
  catalog.parts.find((part) => part.id === partId)?.scope === "gemeinsam";

/** mode: Spielart-id oder null (unbekannt → X01-Teil). */
export function resolveProfile(profile, catalog, mode) {
  const key = mode ?? FALLBACK_MODE;
  const entry = entryFor(profile, catalog, key);
  return {
    content: { ...profile.gemeinsam.content, ...entry.content },
    layout: { board: profile.gemeinsam.board, blocks: entry.layout.blocks },
    angepasst: Object.hasOwn(profile.spielarten, key),
  };
}

export function withBoard(profile, board) {
  return { ...profile, gemeinsam: { ...profile.gemeinsam, board } };
}

export function withModeBlocks(profile, catalog, mode, blocks) {
  const entry = entryFor(profile, catalog, mode);
  return {
    ...profile,
    spielarten: { ...profile.spielarten, [mode]: { content: entry.content, layout: { blocks } } },
  };
}

/** content: alle Bausteine wie aus resolveProfile; jeder Teil landet, wo er hingehoert. */
export function withContent(profile, catalog, mode, content) {
  const shared = {};
  const own = {};
  for (const [partId, value] of Object.entries(content)) (isShared(catalog, partId) ? shared : own)[partId] = value;

  const sharedChanged = JSON.stringify(shared) !== JSON.stringify(profile.gemeinsam.content);
  const entry = entryFor(profile, catalog, mode);
  const ownChanged = JSON.stringify(own) !== JSON.stringify(entry.content);

  let next = profile;
  if (sharedChanged) next = { ...next, gemeinsam: { ...next.gemeinsam, content: shared } };
  if (ownChanged) next = { ...next, spielarten: { ...next.spielarten, [mode]: { content: own, layout: entry.layout } } };
  return next;
}
```

Achtung: `JSON.stringify` vergleicht in Einfügereihenfolge. Die Leiste baut `content` immer per `structuredClone` aus `resolveProfile`, die Reihenfolge bleibt also gleich.

Run: `cd server && npx vitest run test/resolve-profile.test.js` → PASS.

- [ ] **Step 5: `content-view.js` mit Spielart**

Tests in `server/test/content-view.test.js` ergänzen bzw. Aufrufe um die Spielart erweitern (`contentAttributes(CATALOG, content)` → `contentAttributes(CATALOG, content, "x01")`):

```js
  test("Optionen und Bausteine ausserhalb der Spielart gelten als aus", () => {
    const content = { ...sharedDefaults(), ...modeDefaults("x01") };
    expect(contentAttributes(CATALOG, content, "gotcha")).toMatchObject({
      "data-spieler-checkout": "off",
      "data-spieler-average": "off",
      "data-spielinfo-punktzahl": "off",
      "data-spieler-name": "on",
    });
  });

  test("unbekannte Spielart: nur was es ueberall gibt", () => {
    const content = { ...sharedDefaults(), ...modeDefaults("x01") };
    expect(contentAttributes(CATALOG, content, null)).toMatchObject({
      "data-spieler-legs": "off",
      "data-spieler-rest": "on",
    });
  });
```

`content-view.js`:

```js
/*
 * Inhalte des aktiven Profils als Merkmale an #viewer: data-<baustein> und
 * data-<baustein>-<option>. Ein- und Ausblenden erledigt damit style.css -
 * eine neue Option im Katalog braucht meist nur eine CSS-Regel.
 *
 * Was es in der angezeigten Spielart nicht gibt, gilt als aus (mode null =
 * unbekannte Spielart: nur, was es ueberall gibt).
 *
 * Namen werden klein geschrieben: HTML macht das bei Attributen ohnehin, so
 * stimmen JS und CSS sicher ueberein (letzterDart → data-scheibe-letzterdart).
 */

const availableIn = (item, mode) => !item.modes || (mode !== null && item.modes.includes(mode));

export function contentAttributes(catalog, content, mode) {
  const attrs = {};
  for (const part of catalog.parts) {
    const value = content[part.id] ?? {};
    const partOn = availableIn(part, mode) && (value.on ?? part.default);
    attrs[`data-${part.id}`.toLowerCase()] = partOn ? "on" : "off";
    for (const option of part.options) {
      const raw = value[option.id] ?? option.default;
      const name = `data-${part.id}-${option.id}`.toLowerCase();
      if (option.type === "toggle") attrs[name] = availableIn(option, mode) && raw ? "on" : "off";
      else attrs[name] = String(raw);
    }
  }
  return attrs;
}

export function applyContent(el, catalog, content, mode) {
  for (const [name, value] of Object.entries(contentAttributes(catalog, content, mode))) {
    el.setAttribute(name, value);
  }
}
```

- [ ] **Step 6: Chips der Spielinfo**

Test in `server/test/labels.test.js` (den `matchChips`-Block ersetzen):

```js
describe("matchChips", () => {
  const X01 = { baseScore: 501, legsToWin: 3, setsToWin: null, inMode: "Straight", outMode: "Double" };

  test("Spielart, Startpunkte, Ziel, Ein-/Ausstieg mit Schluessel", () => {
    expect(matchChips(X01, "X01")).toEqual([
      { key: "spielart", text: "X01" },
      { key: "punktzahl", text: "501" },
      { key: "legs", text: "Erster bis 3 Legs" },
      { key: "modus", text: "SI-DO" },
    ]);
  });

  test("Mehrzahl und Saetze", () => {
    expect(matchChips({ ...X01, legsToWin: 1 }, "X01")[2].text).toBe("Erster bis 1 Leg");
    expect(matchChips({ ...X01, setsToWin: 2 }, "X01")[2].text).toBe("Erster bis 2 Sets");
  });

  test("ohne Startpunkte und Modus (andere Spielarten) fallen die Chips weg", () => {
    expect(matchChips({ baseScore: null, legsToWin: 1, setsToWin: null, inMode: null, outMode: null }, "Gotcha")).toEqual([
      { key: "spielart", text: "Gotcha" },
      { key: "legs", text: "Erster bis 1 Leg" },
    ]);
  });
});
```

`labels.js`:

```js
/** Die Chips oben links, je mit dem Schluessel der Option in der Spielinfo. */
export function matchChips(match, modeLabel) {
  const target = match.setsToWin
    ? `Erster bis ${match.setsToWin} ${match.setsToWin === 1 ? "Set" : "Sets"}`
    : `Erster bis ${match.legsToWin} ${match.legsToWin === 1 ? "Leg" : "Legs"}`;
  const chips = [{ key: "spielart", text: modeLabel }];
  if (match.baseScore !== null) chips.push({ key: "punktzahl", text: String(match.baseScore) });
  chips.push({ key: "legs", text: target });
  if (match.inMode && match.outMode) {
    const inLetter = MODE_LETTER[match.inMode] ?? "S";
    const outLetter = MODE_LETTER[match.outMode] ?? "S";
    chips.push({ key: "modus", text: `${inLetter}I-${outLetter}O` });
  }
  return chips;
}
```

- [ ] **Step 7: Beispieldaten je Spielart**

Test `server/test/sample-state.test.js`:

```js
import { describe, expect, test } from "vitest";
import { sampleState } from "../public/js/sample-state.js";
import { MODES } from "../src/viewer/catalog.ts";

describe("sampleState", () => {
  test("jede Spielart, 1 bis 6 Spieler mit Plaetzen 1..n, Spieler 1 aktiv", () => {
    for (const { id } of MODES) {
      for (let n = 1; n <= 6; n++) {
        const state = sampleState(id, n);
        expect(state.phase).toBe("playing");
        expect(state.mode).toBe(id);
        expect(state.players.map((p) => p.seat)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        expect(state.players[0].isActive).toBe(true);
      }
    }
  });

  test("X01 mit Startpunkten und Checkout, andere ohne", () => {
    expect(sampleState("x01", 2).match.baseScore).toBe(501);
    expect(sampleState("x01", 2).players[0].checkout).not.toBeNull();
    expect(sampleState("gotcha", 2).match.baseScore).toBeNull();
    expect(sampleState("gotcha", 2).players[0].checkout).toBeNull();
    expect(sampleState("random-checkout", 2).players[0].checkout).not.toBeNull();
  });

  test("ausserhalb 1-6 wird begrenzt", () => {
    expect(sampleState("x01", 0).players).toHaveLength(1);
    expect(sampleState("x01", 9).players).toHaveLength(6);
  });
});
```

`sample-state.js` ganz ersetzen:

```js
/*
 * Beispieldaten fuer das Einstellen ohne laufendes Spiel - sonst gaebe es
 * nichts zu platzieren. Je Spielart und Spielerzahl; Form wie der ViewerState
 * vom Pi.
 */

const field = (multiplier, number, ring = null) => ({ multiplier, number, ring });

const NAMES = ["Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4", "Spieler 5", "Spieler 6"];
const COUNTRIES = ["de", null, "at", "ch", null, "nl"];
/** X01: Rest; sonst Punkte - Hauptsache unterschiedlich lang. */
const X01_SCORES = [121, 280, 64, 501, 333, 170];
const POINTS = [42, 17, 103, 8, 76, 55];
const WITH_CHECKOUT = ["x01", "random-checkout"];

const MATCH = {
  x01: { baseScore: 501, legsToWin: 3, setsToWin: null, inMode: "Straight", outMode: "Double" },
  cricket: { baseScore: null, legsToWin: 3, setsToWin: null, inMode: null, outMode: null },
};
const OTHER_MATCH = { baseScore: null, legsToWin: 1, setsToWin: null, inMode: null, outMode: null };

export function sampleState(mode, count) {
  const n = Math.min(6, Math.max(1, count));
  const isX01 = mode === "x01";
  const players = NAMES.slice(0, n).map((name, index) => ({
    id: `beispiel-${index + 1}`,
    seat: index + 1,
    name,
    avatarUrl: null,
    country: COUNTRIES[index],
    score: (isX01 ? X01_SCORES : POINTS)[index],
    legs: index === 0 ? 1 : 0,
    sets: 0,
    average: { leg: 60.5 - index * 4, match: 58.2 - index * 3 },
    dartsThrown: 12,
    isActive: index === 0,
    isWinner: false,
    busted: false,
    checkout: index === 0 && WITH_CHECKOUT.includes(mode) ? [field(3, 20), field(1, 11), field(2, 25)] : null,
  }));
  return {
    phase: "playing",
    variant: mode,
    mode,
    matchId: "beispiel",
    match: MATCH[mode] ?? OTHER_MATCH,
    players,
    turn: {
      darts: [
        { field: field(3, 20), coords: { x: 0, y: 0.61 } },
        { field: field(1, 1, "outer"), coords: { x: 0.25, y: 0.75 } },
      ],
      points: 61,
      busted: false,
    },
    highlights: [{ field: field(1, 1, "outer"), kind: "last-dart" }],
  };
}
```

- [ ] **Step 8: Gesamtlauf und Commit**

Run: `cd server && npm test && npm run typecheck`
Expected: grün. (`app.js`/`blocks.js` benutzen `SAMPLE_STATE` und die alte `matchChips`-Form noch – das wird in Task 6 umgestellt; der Viewer selbst ist zwischen Task 5 und 6 nicht lauffähig, die Tests schon.)

```bash
git add server/public/js server/test
git commit -m "Viewer: Bereiche anordnen, Profil je Spielart auswerten, Beispieldaten je Spielart"
```

---

### Task 6: Viewer zeichnet je Spielart in Bereichen

**Files:**
- Modify: `server/public/index.html`, `server/public/style.css`, `server/public/js/blocks.js`, `server/public/js/layout-view.js`, `server/public/js/app.js`

**Interfaces:**
- Consumes: alles aus Task 5; WS-Nachrichten aus Task 3/4
- Produces:
  - `renderHead(el, match, modeLabel)`, `renderPlayers(areaEls: { links, rechts }, players, arrangement)` in `blocks.js`
  - `applyLayout(viewer, layout)` versteht Bereiche (`w`/`h`)
  - app.js: `shownMode()`, `resolved()`; Callbacks für Task 7: `getMode()`, `getResolved()`, `applyLocalProfile(profile)`

- [ ] **Step 1: HTML**

In `server/public/index.html` die sechs `spieler-N`-Sections ersetzen durch:

```html
      <!-- Spielerbereiche: die Karten ordnen sich darin selbst an (areas.js). -->
      <section class="block area-block" data-block="bereich-links"><span class="handle handle-resize" data-handle="resize"></span></section>
      <section class="block area-block" data-block="bereich-rechts"><span class="handle handle-resize" data-handle="resize"></span></section>
```

- [ ] **Step 2: CSS**

In `server/public/style.css`:
- `.viewer[data-spieler="off"] .player-block` → `.viewer[data-spieler="off"] .area-block`.
- Neue Regeln im Abschnitt „Spielerkarten“:

```css
/* Bereich: Groesse aus dem Layout (vh), die Karten liegen darin frei. */
.area-block {
  transform: none;
}

.card-slot {
  position: absolute;
  transform-origin: top left;
}
```

Andere Regeln mit `.player-block` (per `grep -n "player-block" server/public/style.css` suchen) auf `.area-block` bzw. `.card-slot` umstellen. Dabei gilt: Was die Karte betrifft, gehört an `.card-slot`, was den Platz betrifft, an `.area-block`.

- [ ] **Step 3: `layout-view.js`**

```js
export function applyLayout(viewer, layout) {
  for (const el of viewer.querySelectorAll(".block[data-block]")) {
    const id = el.dataset.block;
    if (id === "scheibe") {
      // ... unveraendert ...
      continue;
    }
    const block = layout.blocks[id];
    if (!block) continue;
    el.style.left = `${block.x}%`;
    el.style.top = `${block.y}%`;
    if ("w" in block) {
      // Spielerbereich: feste Groesse, die Karten skaliert areas.js
      el.style.width = `${block.w}vh`;
      el.style.height = `${block.h}vh`;
      el.style.transform = "none";
    } else {
      el.style.transform = `scale(${block.scale})`;
    }
  }
}
```

- [ ] **Step 4: `blocks.js`**

`renderHead`:

```js
export function renderHead(el, match, modeLabel) {
  el.replaceChildren(
    ...matchChips(match, modeLabel).map(({ key, text }) => {
      const chip = node("span", "chip", text);
      chip.dataset.chip = key;
      return chip;
    }),
  );
}
```

(`CHIP_KEYS` entfällt.) `renderPlayers` ersetzen:

```js
/* Je Platz eine Karte, einmal gebaut - sonst blitzten die Bilder bei jedem Wurf. */
const slots = new Map();

/**
 * areas: { links, rechts } - die Bereichs-Elemente; arrangement aus
 * areas.js. Karten ohne Platz in der Anordnung werden versteckt.
 */
export function renderPlayers(areas, players, arrangement) {
  const bySeat = new Map(players.map((player) => [player.seat, player]));
  const placed = new Set(arrangement.cards.map((card) => card.seat));
  for (const [seat, entry] of slots) if (!placed.has(seat)) entry.slot.hidden = true;

  for (const card of arrangement.cards) {
    const player = bySeat.get(card.seat);
    if (!player) continue;
    let entry = slots.get(card.seat);
    if (!entry) {
      const parts = buildCard();
      const slot = node("div", "card-slot");
      slot.append(parts.card);
      entry = { slot, parts };
      slots.set(card.seat, entry);
    }
    const area = areas[card.side];
    // vor den Griff, damit der Griff oben liegt
    if (entry.slot.parentElement !== area) area.prepend(entry.slot);
    entry.slot.hidden = false;
    entry.slot.style.left = `${card.left}vh`;
    entry.slot.style.top = `${card.top}vh`;
    entry.slot.style.transform = `scale(${card.scale})`;
    updateCard(entry.parts, player);
  }
}
```

Den Kopfkommentar anpassen: „Die Karten werden je Platz einmal aufgebaut …“.

- [ ] **Step 5: `app.js`**

Imports:

```js
import { arrangeCards } from "./areas.js";
import { renderHead, renderPlayers, renderTurn } from "./blocks.js";
import { createBoard } from "./board.js";
import { applyContent } from "./content-view.js";
import { createEditor } from "./editor.js";
import { applyLayout } from "./layout-view.js";
import { createSync } from "./profile-sync.js";
import { FALLBACK_MODE, resolveProfile } from "./resolve-profile.js";
import { sampleState } from "./sample-state.js";
import { createSettings } from "./settings.js";
```

Elemente:

```js
const areaEls = {
  links: viewer.querySelector('[data-block="bereich-links"]'),
  rechts: viewer.querySelector('[data-block="bereich-rechts"]'),
};
```

Zustand und angezeigte Spielart:

```js
let state = { phase: "idle" };
/* Spielart des letzten Spiels - bleibt nach dem Spiel stehen; vor dem ersten X01. */
let lastMode = FALLBACK_MODE;
/* Vom Pi: Katalog, aktives Profil, Profilliste und wer gerade einstellt. */
const view = { catalog: null, profile: null, profiles: [], remoteEditing: null };

/* Eigene Leiste oder die eines anderen Geraets: { schritt, spielart, spieler } oder null. */
const editing = () => settings.editing() ?? view.remoteEditing;

/**
 * Die Spielart, nach der gezeichnet wird: beim Einstellen die aus der Leiste,
 * sonst die des Spiels (null = unbekannt), nach dem Spiel die letzte.
 */
function shownMode() {
  const edit = editing();
  if (edit) return edit.spielart;
  if (state.phase === "playing") return state.mode;
  return lastMode;
}

/* Beim Einstellen ohne Spiel - oder fuer eine andere Spielart als die laufende -
   gaebe es sonst nichts Passendes zu sehen. */
function shownState() {
  const edit = editing();
  const showsGame = state.phase === "playing" && (state.mode ?? FALLBACK_MODE) === edit?.spielart;
  return edit && !showsGame ? sampleState(edit.spielart, edit.spieler) : state;
}

const resolved = () =>
  view.catalog && view.profile ? resolveProfile(view.profile, view.catalog, shownMode()) : null;

const modeLabel = (mode) =>
  view.catalog?.modes.find((m) => m.id === mode)?.label ?? (state.phase === "playing" ? state.variant : "");
```

`render()`:

```js
function render() {
  const shown = shownState();
  const edit = editing();
  const mode = shownMode();
  const current = resolved();
  viewer.dataset.phase = shown.phase;
  viewer.dataset.spielart = mode ?? "unbekannt";
  viewer.classList.toggle("is-layout", edit?.schritt === "layout");
  if (current) {
    applyContent(viewer, view.catalog, current.content, mode);
    applyLayout(viewer, current.layout);
  }
  messageEl.textContent = shown.phase === "idle" ? "Warte auf ein Spiel" : "";
  boardSvg.dataset.mode = edit?.schritt === "layout" ? "lines" : (current?.content.scheibe?.darstellung ?? "light");
  board.render(shown);
  if (shown.phase === "playing" && current) {
    renderHead(headEl, shown.match, modeLabel(mode));
    renderTurn(turnEl, shown.turn);
    const verteilung = current.content.spieler?.verteilung ?? "beide";
    const areas = { links: current.layout.blocks["bereich-links"], rechts: current.layout.blocks["bereich-rechts"] };
    renderPlayers(areaEls, shown.players, arrangeCards(shown.players.map((p) => p.seat), verteilung, areas));
  }
}
```

`onMessage`:

```js
function onMessage(message) {
  if (message.type === "state") {
    state = message.state;
    if (state.phase === "playing") lastMode = state.mode ?? FALLBACK_MODE;
  }
  if (message.type === "catalog") view.catalog = message.catalog;
  if (message.type === "profile") {
    // Solange eigene Aenderungen unterwegs sind, ist das Echo des Pi veraltet -
    // es wuerde neuere Klicks im eigenen Bild zuruecksetzen. Der Name gilt trotzdem.
    const same = message.profile.id === view.profile?.id;
    view.profile = same && sync.isBusy() ? { ...view.profile, name: message.profile.name } : message.profile;
    view.profiles = message.profiles;
    view.remoteEditing = message.editing;
  }
  settings.refresh();
  render();
}
```

Editor und Settings verdrahten (die Callbacks nutzt Task 7; hier schon so anlegen):

```js
/* Lokale Aenderung sofort ins eigene Bild; an den Pi geht sie ueber sync. */
function applyLocalProfile(profile) {
  view.profile = profile;
  settings.refresh();
  render();
}

const editor = createEditor({
  viewer,
  sync,
  getProfile: () => view.profile,
  getCatalog: () => view.catalog,
  getMode: () => shownMode() ?? FALLBACK_MODE,
  getLayout: () => resolved()?.layout ?? null,
  getEditing: () => settings.editing(),
  applyLocalProfile,
  onBack: () => settings.open("inhalte"),
  onDone: () => settings.open(null),
  onPlayers: (count) => settings.setPlayers(count),
});

const settings = createSettings({
  viewer,
  editor,
  sync,
  getView: () => view,
  getGameMode: () => (state.phase === "playing" ? (state.mode ?? FALLBACK_MODE) : null),
  getResolved: resolved,
  applyLocalProfile,
  onChange: () => render(),
});
```

(`sync` bleibt wie bisher vor `editor` angelegt.)

- [ ] **Step 6: Keine Browser-Prüfung in diesem Zwischenstand**

`settings.js`, `settings-panel.js` und `editor.js` sind noch alt (sie kennen `catalog.templates` und die neuen Callbacks nicht); der Viewer läuft erst mit Task 7 wieder. Das Zeichnen wird dort geprüft (Task 7, Step 9, Punkt 0). Hier nur:

Run: `cd server && npm test && npm run typecheck` → grün.

- [ ] **Step 7: Commit**

Run: `cd server && npm test && npm run typecheck` → grün.

```bash
git add server/public
git commit -m "Viewer zeichnet nach der Spielart, Spielerkarten in zwei Bereichen nach festen Plaetzen"
```

---

### Task 7: Bedienung – Spielart, Vorschau, Bereiche ausrichten

**Files:**
- Modify: `server/public/js/profile-sync.js`, `server/public/js/settings.js`, `server/public/js/settings-panel.js`, `server/public/js/editor.js`, `server/public/index.html` (Werkzeugleiste), `server/public/style.css` (Leiste)
- Create: `server/public/js/editor-changes.js`
- Test: `server/test/profile-sync.test.js`, Create: `server/test/editor-changes.test.js`

**Interfaces:**
- Consumes: Task 5/6 (`resolveProfile`, `withBoard`, `withModeBlocks`, `withContent`, `isShared`, app-Callbacks)
- Produces:
  - `profile-sync.js`: `mergeBody(a, b)`, `canMerge(a, b)`; `queue` fasst verschachtelt zusammen
  - `editor-changes.js`: `layoutChange(profile, catalog, mode, before, after) → { profile, patch }`
  - `settings.js`: `editing() → { schritt, spielart, spieler } | null`, `setPlayers(n)`, `open(step)`, `refresh()`, `setStatus(text)`
  - `settings-panel.js`: `render({ catalog, profile, profiles, mode, players, gameRunning, resolved })`; handlers `onShared(content)`, `onModeContent(content)`, `onMode(id)`, `onPlayers(n)`, `onReset(profileId, mode)`, `onSelect`, `onCreate(name)`, `onRename`, `onDelete`, `onNext`, `onClose`

- [ ] **Step 1: Tests für das Zusammenfassen**

In `server/test/profile-sync.test.js` ergänzen:

```js
import { canMerge, createSync, mergeBody } from "../public/js/profile-sync.js";

describe("mergeBody", () => {
  test("gemeinsam und dieselbe Spielart werden eine Ebene tief zusammengefasst", () => {
    expect(
      mergeBody(
        { gemeinsam: { content: 1 }, spielart: { id: "x01", content: 2 } },
        { gemeinsam: { board: 3 }, spielart: { id: "x01", layout: 4 }, editing: 5 },
      ),
    ).toEqual({
      gemeinsam: { content: 1, board: 3 },
      spielart: { id: "x01", content: 2, layout: 4 },
      editing: 5,
    });
  });

  test("zwei Spielarten lassen sich nicht zusammenfassen", () => {
    expect(canMerge({ spielart: { id: "x01" } }, { spielart: { id: "cricket" } })).toBe(false);
    expect(canMerge({ spielart: { id: "x01" } }, { gemeinsam: {} })).toBe(true);
  });
});

  test("Aenderungen an zwei Spielarten gehen als zwei Anfragen raus, der Reihe nach", async () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { spielart: { id: "x01", content: 1 } });
    sync.queue("standard", { spielart: { id: "cricket", content: 2 } });
    await vi.advanceTimersByTimeAsync(500);
    expect(calls.map((c) => c.body.spielart.id)).toEqual(["x01", "cricket"]);
  });

  test("Inhalte und Layout derselben Spielart kurz nacheinander: beides kommt an", async () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { spielart: { id: "x01", content: 1 } });
    sync.queue("standard", { spielart: { id: "x01", layout: 2 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls[0].body.spielart).toEqual({ id: "x01", content: 1, layout: 2 });
  });
```

(Die beiden `test`-Blöcke gehören in den bestehenden `describe("createSync")`.)

Run: `cd server && npx vitest run test/profile-sync.test.js` → FAIL.

- [ ] **Step 2: `profile-sync.js`**

```js
/* Eine Ebene tief zusammenfassen: gemeinsam immer, spielart nur bei gleicher id. */
export function mergeBody(a, b) {
  const merged = { ...a, ...b };
  if (a.gemeinsam && b.gemeinsam) merged.gemeinsam = { ...a.gemeinsam, ...b.gemeinsam };
  if (a.spielart && b.spielart) merged.spielart = { ...a.spielart, ...b.spielart };
  return merged;
}

/* Aenderungen zweier Spielarten passen nicht in eine Anfrage. */
export const canMerge = (a, b) => !(a.spielart && b.spielart && a.spielart.id !== b.spielart.id);
```

In `createSync`:

```js
  function enqueue(item) {
    const last = outbox.at(-1);
    if (last && last.id === item.id && canMerge(last.body, item.body)) last.body = mergeBody(last.body, item.body);
    else outbox.push(item);
  }

  function queue(id, patch) {
    if (!id) return; // noch kein Profil vom Pi
    if (collecting && (collecting.id !== id || !canMerge(collecting.body, patch))) {
      // Bisheriges zuerst - anderes Profil oder andere Spielart
      enqueue(collecting);
      collecting = null;
      pump();
    }
    collecting = { id, body: collecting ? mergeBody(collecting.body, patch) : { ...patch } };
    if (!timer) timer = setTimeout(flush, Math.max(0, SEND_INTERVAL_MS - (Date.now() - lastSent)));
  }
```

Run: `cd server && npx vitest run test/profile-sync.test.js` → PASS.

- [ ] **Step 3: Tests für Layout-Änderungen**

`server/test/editor-changes.test.js`:

```js
import { describe, expect, test } from "vitest";
import { layoutChange } from "../public/js/editor-changes.js";
import { resolveProfile } from "../public/js/resolve-profile.js";
import { newProfile } from "../src/viewer/profile.ts";
import { viewerCatalog } from "../src/viewer/standards.ts";

const catalog = viewerCatalog();

describe("layoutChange", () => {
  test("Scheibe verschoben: nur gemeinsam, die Spielart bleibt im Standard", () => {
    const profile = newProfile("P");
    const before = resolveProfile(profile, catalog, "cricket").layout;
    const after = structuredClone(before);
    after.board.cx = 12;

    const { profile: next, patch } = layoutChange(profile, catalog, "cricket", before, after);

    expect(patch).toEqual({ gemeinsam: { board: after.board } });
    expect(next.gemeinsam.board.cx).toBe(12);
    expect(next.spielarten).toEqual({});
  });

  test("Bereich verschoben: nur die Spielart, sie wird angepasst", () => {
    const profile = newProfile("P");
    const before = resolveProfile(profile, catalog, "gotcha").layout;
    const after = structuredClone(before);
    after.blocks["bereich-links"].h = 80;

    const { profile: next, patch } = layoutChange(profile, catalog, "gotcha", before, after);

    expect(patch).toEqual({ spielart: { id: "gotcha", layout: { blocks: after.blocks } } });
    expect(next.spielarten.gotcha.layout.blocks["bereich-links"].h).toBe(80);
  });

  test("nichts geaendert: kein patch", () => {
    const profile = newProfile("P");
    const layout = resolveProfile(profile, catalog, "x01").layout;
    expect(layoutChange(profile, catalog, "x01", layout, structuredClone(layout)).patch).toEqual({});
  });
});
```

Run → FAIL. Dann `server/public/js/editor-changes.js`:

```js
/*
 * Was eine Aenderung beim Ausrichten fuer das Profil bedeutet: Die Scheibe
 * gilt fuer alle Spielarten (gemeinsam), Bloecke und Bereiche nur fuer die
 * angezeigte Spielart. Wer nur die Scheibe verschiebt, passt damit keine
 * Spielart an. Reine Funktion ohne DOM.
 */
import { withBoard, withModeBlocks } from "./resolve-profile.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function layoutChange(profile, catalog, mode, before, after) {
  let next = profile;
  const patch = {};
  if (!same(before.board, after.board)) {
    next = withBoard(next, after.board);
    patch.gemeinsam = { board: after.board };
  }
  if (!same(before.blocks, after.blocks)) {
    next = withModeBlocks(next, catalog, mode, after.blocks);
    patch.spielart = { id: mode, layout: { blocks: after.blocks } };
  }
  return { profile: next, patch };
}
```

Run → PASS.

- [ ] **Step 4: `editor.js` – Bereiche und neue Verdrahtung**

Signatur:

```js
export function createEditor({
  viewer,
  sync,
  getProfile,
  getCatalog,
  getMode,
  getLayout,
  getEditing,
  applyLocalProfile,
  onBack,
  onDone,
  onPlayers,
}) {
```

`change`:

```js
  function change(mutate) {
    const before = getLayout();
    if (!before) return;
    const after = structuredClone(before);
    mutate(after);
    const profile = getProfile();
    const { profile: next, patch } = layoutChange(profile, getCatalog(), getMode(), before, after);
    if (Object.keys(patch).length === 0) return;
    applyLocalProfile(next);
    sync.queue(profile.id, { ...patch, editing: getEditing() });
  }
```

(Import `layoutChange` aus `./editor-changes.js`.)

Bereiche in `drag` (nach dem Zweig für die Scheibe, vor dem für Blöcke):

```js
const isArea = (block) => "w" in block;

  const from = start.layout.blocks[id];
  const block = layout.blocks[id];
  if (isArea(block)) {
    if (handle === "move") {
      block.x = clamp(from.x + dx, 0, 100);
      block.y = clamp(from.y + dy, 0, 100);
    } else if (handle === "resize") {
      // Groesse in vh: Mausweg relativ zur Bildhoehe
      const dw = ((move.clientX - start.x) / window.innerHeight) * 100;
      const dh = ((move.clientY - start.y) / window.innerHeight) * 100;
      block.w = clamp(from.w + dw, 5, 300);
      block.h = clamp(from.h + dh, 5, 100);
    }
    return;
  }
```

Tastatur in `keyAction`, direkt vor `if (offset) {`. Da `keyAction` das Layout nicht kennt, prüft die zurückgegebene Funktion, ob ein Bereich gewählt ist:

```js
  if (offset && event.ctrlKey) {
    // Strg+Pfeil: Groesse eines Bereichs; bei anderem nichts (Browser-Kuerzel bleiben)
    if (selected === "scheibe") return null;
    return (layout) => {
      const block = layout.blocks[selected];
      if (!("w" in block)) return;
      block.w = clamp(block.w + offset[0] * 10, 5, 300);
      block.h = clamp(block.h + offset[1] * 10, 5, 100);
    };
  }
```

(Schritt ×10, weil `offset` 0,1 bzw. 1 ist und die Größe in vh grob genug sein soll: 1 vh fein, 10 vh mit Umschalt.) Im `grow`-Zweig für Bereiche:

```js
        const block = layout.blocks[selected];
        if ("w" in block) {
          block.w = clamp(block.w + grow * step * 10, 5, 300);
          block.h = clamp(block.h + grow * step * 10, 5, 100);
        } else {
          block.scale = clamp(block.scale + (grow * step) / 10, 0.2, 4);
        }
```

Werkzeugleiste: Klicks auf `[data-players]`:

```js
  toolbar.addEventListener("click", (event) => {
    const players = event.target.closest("[data-players]")?.dataset.players;
    if (players) onPlayers(Number(players));
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "back") onBack();
    if (action === "done") onDone();
  });
```

Und eine Funktion für die Anzeige, die `settings.js` aufruft:

```js
  /** Zeigt "X01 · 4 Spieler" und sperrt die Spielerzahl, solange ein Spiel laeuft. */
  function setPreview(text, players, locked) {
    preview.textContent = text;
    for (const button of toolbar.querySelectorAll("[data-players]")) {
      button.disabled = locked;
      button.setAttribute("aria-pressed", String(Number(button.dataset.players) === players));
    }
  }
```

mit `const preview = viewer.querySelector("#edit-preview");` oben; `setPreview` in die Rückgabe aufnehmen.

Den Kopfkommentar ergänzen: „Die Scheibe gilt fuer alle Spielarten, Bloecke und Spielerbereiche fuer die angezeigte (editor-changes.js).“

- [ ] **Step 5: Werkzeugleiste im HTML**

In `index.html` die Werkzeugleiste ersetzen:

```html
      <div id="edit-toolbar" class="edit-toolbar">
        <button type="button" data-action="back">← Inhalte</button>
        <span id="edit-preview" class="edit-preview"></span>
        <span class="edit-players" role="group" aria-label="Spieler in der Vorschau">
          <button type="button" data-players="1">1</button>
          <button type="button" data-players="2">2</button>
          <button type="button" data-players="3">3</button>
          <button type="button" data-players="4">4</button>
          <button type="button" data-players="5">5</button>
          <button type="button" data-players="6">6</button>
        </span>
        <span id="edit-status" class="edit-status" role="status"></span>
        <span class="edit-hint">
          Scheibe gilt für alle Spielarten · Ziehen: verschieben · Ecke: Größe · Kreis: drehen (Alt: frei) ·
          Pfeile, +/−, Q/E: fein (Umschalt: grob) · Strg+Pfeil: Bereich größer/kleiner · Esc: fertig
        </span>
        <button type="button" data-action="done">Fertig</button>
      </div>
```

CSS (bei der Werkzeugleiste):

```css
.edit-players button[aria-pressed="true"] {
  background: var(--edit);
  color: #000;
}

.edit-players button:disabled {
  opacity: 0.4;
  cursor: default;
}

.edit-preview {
  font-weight: 700;
  color: #fff;
}
```

- [ ] **Step 6: `settings.js`**

Ganz ersetzen; Verhalten von Knopf, Lebenszeichen und Esc bleibt:

```js
/*
 * Einstellungen in zwei Schritten: "inhalte" (Seitenleiste) und "layout"
 * (Ausrichten, editor.js). Haelt Schritt, Spielart und Spielerzahl der
 * Vorschau, spricht mit dem Pi und meldet alles als editing - dann zeigen alle
 * Geraete die gewaehlte Spielart, ohne Spiel mit Beispieldaten.
 */
import { api } from "./profile-api.js";
import { withContent } from "./resolve-profile.js";
import { createPanel } from "./settings-panel.js";

const KEEPALIVE_MS = 30_000;
const BUTTON_HIDE_MS = 3000;

export function createSettings({ viewer, editor, sync, getView, getGameMode, getResolved, applyLocalProfile, onChange }) {
  const button = viewer.querySelector("#settings-toggle");
  const root = viewer.querySelector("#settings");
  let step = null;
  const preview = { spielart: "x01", spieler: 2 };
  let keepalive = null;
  let hideTimer = null;

  const profileId = () => getView().profile?.id;
  const path = (id, suffix = "") => `/api/profiles/${encodeURIComponent(id)}${suffix}`;
  const report = (error) => panel.setStatus(`Fehlgeschlagen: ${error.message}`);
  const editing = () => (step ? { schritt: step, spielart: preview.spielart, spieler: preview.spieler } : null);

  function announce() {
    sync.queue(profileId(), { editing: editing() });
    sync.flush();
  }

  async function afterSwitch() {
    const { active } = await api("GET", "/api/profiles");
    sync.queue(active, { editing: editing() });
    sync.flush();
  }

  /* Eine Aenderung an den Inhalten: sofort im eigenen Bild, gedrosselt an den Pi. */
  function changeContent(content, scope) {
    const { profile, catalog } = getView();
    const next = withContent(profile, catalog, preview.spielart, content);
    applyLocalProfile(next);
    const patch =
      scope === "gemeinsam"
        ? { gemeinsam: { content: next.gemeinsam.content } }
        : { spielart: { id: preview.spielart, content: next.spielarten[preview.spielart].content } };
    sync.queue(profile.id, { ...patch, editing: editing() });
  }

  const panel = createPanel(root, {
    onShared: (content) => changeContent(content, "gemeinsam"),
    onModeContent: (content) => changeContent(content, "spielart"),
    onMode(mode) {
      preview.spielart = mode;
      announce();
      refresh();
      onChange();
    },
    onPlayers: (count) => setPlayers(count),
    onSelect(id) {
      sync.flush();
      api("PUT", "/api/active-profile", { id }).then(afterSwitch).catch(report);
    },
    onCreate(name) {
      sync.flush();
      api("POST", "/api/profiles", { name }).then(afterSwitch).catch(report);
    },
    onRename(id, name) {
      sync.queue(id, { name, editing: editing() });
      sync.flush();
    },
    onDelete(id) {
      sync.flush();
      api("DELETE", path(id)).then(afterSwitch).catch(report);
    },
    onReset(id, mode) {
      sync.flush();
      api("POST", path(id, "/reset"), { spielart: mode }).catch(report);
    },
    onNext: () => open("layout"),
    onClose: () => open(null),
  });

  /* Zeigt die Vorschau gerade das laufende Spiel (gleiche Spielart)? Dann gilt dessen Spielerzahl. */
  const showsGame = () => getGameMode() !== null && getGameMode() === preview.spielart;

  function setPlayers(count) {
    if (showsGame()) return;
    preview.spieler = count;
    announce();
    refresh();
    onChange();
  }

  function refresh() {
    const { catalog, profile, profiles } = getView();
    const resolved = getResolved();
    const gameRunning = showsGame();
    if (catalog && profile && resolved) {
      panel.render({ catalog, profile, profiles, mode: preview.spielart, players: preview.spieler, gameRunning, resolved });
      const label = catalog.modes.find((m) => m.id === preview.spielart)?.label ?? preview.spielart;
      editor.setPreview(gameRunning ? `${label} · laufendes Spiel` : `${label} · ${preview.spieler} Spieler`, preview.spieler, gameRunning);
    }
  }

  function open(next) {
    if (!getView().profile) return; // noch kein Profil vom Pi
    // Laeuft ein Spiel, stellt man dessen Spielart ein.
    if (next && !step && getGameMode() !== null) preview.spielart = getGameMode();
    step = next;
    root.hidden = step !== "inhalte";
    if (step !== "inhalte") panel.cancelAsk();
    viewer.classList.toggle("is-settings", step !== null);
    clearInterval(keepalive);
    if (step) {
      keepalive = setInterval(() => sync.queue(profileId(), { editing: editing() }), KEEPALIVE_MS);
    } else {
      clearTimeout(hideTimer);
      button.classList.remove("is-visible");
      button.blur();
    }
    announce();
    refresh();
    onChange();
    editor.setActive(step === "layout");
  }

  // ... pointermove, click, keydown wie bisher ...

  return {
    editing,
    setPlayers,
    open,
    refresh,
    setStatus: (text) => panel.setStatus(text),
  };
}
```

(Die drei Listener `pointermove`, `click` auf den Knopf und `keydown` für Esc unverändert aus der bisherigen Datei übernehmen. In `app.js` aus Task 6: `settings.step()` gibt es nicht mehr; überall `settings.editing()` verwenden.)

- [ ] **Step 7: `settings-panel.js`**

Aufbau (`root.replaceChildren`):

```js
  root.replaceChildren(
    node("div", { className: "settings-row" }, [node("h2", { textContent: "Profil" }), close]),
    node("div", { className: "settings-row" }, [select]),
    node("div", { className: "settings-row" }, [button("Neu", () => setAsk({ kind: "new" })), renameButton, deleteButton]),
    askArea,
    node("h2", { textContent: "Gemeinsam – gilt für alle Spielarten" }),
    sharedList,
    node("h2", { textContent: "Spielart" }),
    node("div", { className: "settings-row" }, [modeSelect]),
    node("div", { className: "settings-row" }, [modeState, resetButton]),
    node("div", { className: "settings-row settings-players" }, [node("span", { textContent: "Vorschau mit Spielern:" }), ...playerButtons]),
    modeList,
    status,
    button("Weiter: Layout →", () => handlers.onNext(), { className: "settings-next" }),
  );
```

Neue Elemente:

```js
  const sharedList = node("div", { className: "settings-list" });
  const modeList = node("div", { className: "settings-list" });

  const modeSelect = node("select", { className: "settings-grow" });
  modeSelect.setAttribute("aria-label", "Spielart");
  modeSelect.addEventListener("change", () => handlers.onMode(modeSelect.value));

  const modeState = node("span", { className: "settings-mode-state" });
  const resetButton = button("Auf Standard zurücksetzen", () => {
    const label = catalog.modes.find((m) => m.id === mode)?.label ?? mode;
    setAsk({
      kind: "confirm",
      text: `${label} in „${profile.name}“ auf den Standard zurücksetzen? Inhalte und Layout dieser Spielart gehen verloren, die Scheibe bleibt.`,
      yes: handlers.onReset.bind(null, profile.id, mode),
    });
  });

  const playerButtons = [1, 2, 3, 4, 5, 6].map((n) =>
    button(String(n), () => handlers.onPlayers(n), { className: "settings-player" }),
  );
```

Zustand (zu `catalog`, `profile`, `profiles`, `profilesKey`, `ask` dazu):

```js
  let mode = "x01";
  let players = 2;
  /* Die Vorschau zeigt das laufende Spiel - Spielerzahl gesperrt. */
  let gameRunning = false;
  let resolved = null;
  let modesKey = "";
```

`buildOption`/`buildPart` bekommen die Spielart, damit nur verfügbare Optionen erscheinen:

```js
const availableIn = (item, mode) => !item.modes || item.modes.includes(mode);

  function buildPart(part, scope) {
    // ... wie bisher, aber:
    const options = node(
      "div",
      { className: "part-options", hidden: !expanded.has(part.id) },
      part.options.filter((option) => scope === "gemeinsam" || availableIn(option, mode)).map((option) => buildOption(part, option)),
    );
    // ...
    section.dataset.scope = scope;
    return section;
  }

  function buildShared() {
    sharedList.replaceChildren(...catalog.parts.filter((p) => p.scope === "gemeinsam").map((p) => buildPart(p, "gemeinsam")));
  }

  function buildModeList() {
    modeList.replaceChildren(
      ...catalog.parts.filter((p) => p.scope === "spielart" && availableIn(p, mode)).map((p) => buildPart(p, "spielart")),
    );
  }
```

Änderungen (ein Listener für beide Listen):

```js
  function onListChange(event) {
    const input = event.target;
    const { part, option } = input.dataset;
    if (!part || !resolved) return;
    const content = structuredClone(resolved.content);
    if (!option) content[part].on = input.checked;
    else content[part][option] = input.type === "radio" ? input.value : input.checked;
    const scope = input.closest(".part")?.dataset.scope;
    if (scope === "gemeinsam") handlers.onShared(content);
    else handlers.onModeContent(content);
  }
  sharedList.addEventListener("change", onListChange);
  modeList.addEventListener("change", onListChange);
```

Die Spielart-Auswahl (gruppiert, mit Zusatz) nur neu bauen, wenn sich die angepassten Spielarten ändern:

```js
  function buildModeSelect() {
    const groups = Object.entries(catalog.groups).map(([groupId, groupLabel]) =>
      node(
        "optgroup",
        { label: groupLabel },
        catalog.modes
          .filter((m) => m.group === groupId)
          .map((m) =>
            node("option", {
              value: m.id,
              textContent: `${m.label} · ${Object.hasOwn(profile.spielarten, m.id) ? "angepasst" : "Standard"}`,
            }),
          ),
      ),
    );
    modeSelect.replaceChildren(...groups);
  }
```

`update()` ergänzen (Häkchen aus `resolved.content` statt `profile.content`; beide Listen):

```js
    for (const input of root.querySelectorAll(".settings-list input")) {
      const value = resolved.content[input.dataset.part];
      if (!value) continue;
      const option = input.dataset.option;
      if (!option) input.checked = value.on;
      else if (input.type === "radio") input.checked = value[option] === input.value;
      else input.checked = value[option] === true;
    }
    for (const section of root.querySelectorAll(".settings-list .part")) {
      const on = resolved.content[section.dataset.part]?.on ?? true;
      section.classList.toggle("is-off", !on);
      for (const input of section.querySelectorAll(".part-options input")) input.disabled = !on;
    }
    modeSelect.value = mode;
    modeState.textContent = resolved.angepasst ? "angepasst" : "Standard";
    resetButton.hidden = !resolved.angepasst;
    for (const [index, b] of playerButtons.entries()) {
      b.disabled = gameRunning;
      b.setAttribute("aria-pressed", String(index + 1 === players));
    }
```

`render`:

```js
    render(next) {
      if (profile && next.profile.id !== profile.id) setAsk(null); // gehoerte zum alten Profil
      const freshCatalog = next.catalog !== catalog;
      const freshMode = next.mode !== mode;
      catalog = next.catalog;
      profile = next.profile;
      profiles = next.profiles;
      mode = next.mode;
      players = next.players;
      gameRunning = next.gameRunning;
      resolved = next.resolved;
      if (freshCatalog) buildShared();
      if (freshCatalog || freshMode) buildModeList();
      const key = JSON.stringify(Object.keys(profile.spielarten).sort());
      if (freshCatalog || key !== modesKey) {
        modesKey = key;
        buildModeSelect();
      }
      update();
    },
```

Formular „Neu“: Die Vorlagen-Auswahl entfällt (`template`-Select weg), `handlers.onCreate(name.value)`. Die alten `templates`-Knöpfe und `buildCatalog` entfallen. Den Kopfkommentar anpassen: „Seitenleiste, Schritt "Inhalte": Profil, gemeinsame Bausteine, Spielart mit Vorschau und die Liste ihrer Bausteine …“.

CSS für die Leiste (bei den Einstellungen):

```css
.settings-players {
  gap: 4px;
  align-items: center;
}

.settings-player[aria-pressed="true"] {
  background: var(--edit);
  color: #000;
}

.settings-mode-state {
  flex: 1;
  color: #aaa;
}
```

- [ ] **Step 8: Gesamtlauf**

Run: `cd server && npm test && npm run typecheck`
Expected: grün.

- [ ] **Step 9: Browser-Prüfung**

Server starten (Port 8743 vorher frei machen, siehe Projektstand: `Get-NetTCPConnection -LocalPort 8743 | Stop-Process`):

```bash
cd server && npx tsx src/index.ts
```

Zwei Fenster `http://localhost:8743/` mit Playwright-MCP; echte Klicks und Ziehen per `browser_run_code_unsafe`.

0. Mitschnitt abspielen (`cd server && npm run replay -- test/fixtures/autodarts-2026-10-08.ndjson --instant --stop 139`) → zwei Karten links und rechts wie vorher, Aufnahme oben, Scheibe; Konsole ohne Fehler (`browser_console_messages`). Dann `POST /api/ingest/reset` (mit Header), damit kein Spiel mehr läuft.
1. Einstellungen öffnen → Gemeinsam (Hintergrund, Scheibe), Spielart „X01 · Standard“, Vorschau 2 Spieler, Liste ohne Hintergrund/Scheibe.
2. Spielart Gotcha wählen → Liste ohne Checkout/Average/Legs; das zweite Fenster zeigt Gotcha-Beispieldaten.
3. Vorschau 5 → beide Fenster zeigen 5 Karten (3 links, 2 rechts), alle gleich groß.
4. Aufnahme in Gotcha ausschalten → „Gotcha · angepasst“, „Auf Standard zurücksetzen“ erscheint; Zurücksetzen fragt nach und stellt „Standard“ wieder her.
5. Weiter: Layout → Scheibe verschieben → Spielart bleibt „Standard“; zu X01 wechseln → Scheibe liegt dort auch neu.
6. Bereich links am Griff höher ziehen → 5 Karten werden größer; Strg+Pfeil ändert die Größe; Esc beendet.
7. Mitschnitt starten (Spiel läuft) → Leiste öffnen: Spielart X01, Spielerzahl-Knöpfe gesperrt, echte Karten. Auf Cricket wechseln → Beispieldaten für Cricket, Knöpfe wieder frei; zurück auf X01 → wieder das echte Spiel.

Screenshots nach `C:\Projekte\raspdarts\.playwright-mcp\`. Konsole ohne Fehler.

- [ ] **Step 10: Commit**

```bash
git add server/public server/test
git commit -m "Einstellungen: gemeinsam und je Spielart, Vorschau 1-6 Spieler, Spielerbereiche ausrichten"
```

---

### Task 8: Doku, Gesamtprüfung, Ausrollen

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-13-spielarten-design.md` (nur falls beim Bauen etwas abwich)

- [ ] **Step 1: README**

Im Abschnitt zum Viewer:
- Spielarten: Liste der elf, „angepasst“/„Standard“, gemeinsam vs. je Spielart.
- Spielerbereiche: Verteilung, feste Plätze im Match.
- Schnittstelle: `POST /api/profiles { name }`, `PUT … { name?, gemeinsam?, spielart?, editing? }`, `POST …/reset { spielart }`, `editing`-Objekt; `catalog` mit `modes`, `groups`, `standards`, `shared`.
- Neue Spielart prüfen: Mitschnitt aufnehmen, `variants` in `catalog.ts` korrigieren, `verified: true`.

- [ ] **Step 2: Gesamtlauf**

Run: `cd server && npm test && npm run typecheck`
Expected: grün. Ausgabe (Anzahl Tests) im Bericht nennen.

- [ ] **Step 3: Commit**

```bash
git add README.md docs
git commit -m "Doku: Spielarten, Spielerbereiche und Profil-API Version 4"
```

- [ ] **Step 4: Review**

Ein Review über den ganzen Zweig (seit `81c4b75`) mit dem fähigsten Modell; Befunde einarbeiten oder bewusst zurückstellen und im Projektstand notieren.

- [ ] **Step 5: Arnolds Abnahme und Ausrollen – erst nach seinem „ja“**

1. Arnold testet lokal mit der Maus (Anleitung wie in Task 7, Step 9).
2. Nach „ja“: auf dem Pi `data/profiles/` sichern (z. B. `ssh pi@raspdarts.local 'tar czf ~/profiles-vor-spielarten.tgz -C ~/raspdarts/server/data profiles'` – Pfad vorher mit `ls` prüfen) und ein Bildschirmfoto des Viewers mit 2 Spielern (Mitschnitt oder laufendes Spiel) machen.
3. Push, dann Update über den Knopf im Viewer-Fenster oder `curl -sN -X POST -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/system/update`.
4. Danach dasselbe Bild: X01 mit 2 Spielern muss gleich aussehen; `GET /api/profiles/standard` zeigt `version: 4`, `gemeinsam.board` = vorherige Werte, `spielarten.x01`.
