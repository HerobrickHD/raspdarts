/**
 * Katalog: alle Bausteine des Viewers, ihre Optionen und die Spielarten.
 *
 * Die einzige Stelle, an der Optionen beschrieben werden. Der Pi prueft jedes
 * Profil dagegen und schickt den Katalog an den Viewer, der daraus die
 * Checkbox-Liste baut. Eine neue Option braucht hier einen Eintrag und im
 * Viewer ihre Wirkung (meist eine CSS-Regel auf data-<baustein>-<option>).
 *
 * Alte Profile bleiben gueltig: Fehlende Optionen bekommen beim Lesen die
 * Vorgabe. Der Standard steht in standards.ts.
 *
 * Spielarten: Ein Profil stellt alle Bausteine einmal fuer alle Spielarten
 * ein. modes an einem Baustein oder einer Option sagt, in welchen Spielarten
 * es sie gibt (die Leiste zeigt das als Hinweis, der Viewer laesst sie sonst
 * weg); ohne modes gibt es sie ueberall.
 */

export interface ToggleOption {
  id: string;
  label: string;
  type: "toggle";
  default: boolean;
  /** Spielarten, in denen es die Option gibt; fehlt es, gibt es sie ueberall. */
  modes?: string[];
  /** Nur sichtbar, wenn eine andere Option dieses Bausteins diesen Wert hat. */
  showIf?: { option: string; value: string };
}

export interface ChoiceOption {
  id: string;
  label: string;
  type: "choice";
  choices: { id: string; label: string }[];
  default: string;
  modes?: string[];
  /** Nur sichtbar, wenn eine andere Option dieses Bausteins diesen Wert hat. */
  showIf?: { option: string; value: string };
}

/** Schieberegler; der Wert ist eine Zahl von min bis max im Raster step. */
export interface RangeOption {
  id: string;
  label: string;
  type: "range";
  min: number;
  max: number;
  step: number;
  /** Einheit fuer die Anzeige neben dem Wert, z. B. "mm" */
  unit: string;
  default: number;
  modes?: string[];
}

/** Farbwaehler; der Wert ist "#rrggbb" (klein geschrieben). */
export interface ColorOption {
  id: string;
  label: string;
  type: "color";
  default: string;
  modes?: string[];
}

export type Option = ToggleOption | ChoiceOption | RangeOption | ColorOption;

export interface Part {
  id: string;
  label: string;
  /** an/aus */
  default: boolean;
  /** Immer an, ohne eigenen Schalter (Hintergrund) - nur seine Optionen zaehlen. */
  fixed?: boolean;
  modes?: string[];
  /** Einzelteile, in der Liste aufgeklappt sichtbar */
  options: Option[];
}

export interface PartContent {
  on: boolean;
  [option: string]: boolean | string | number;
}

export type Content = Record<string, PartContent>;
export type ContentPatch = Record<string, Record<string, boolean | string | number>>;

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

export interface Catalog {
  parts: Part[];
}

const toggle = (id: string, label: string, value = true, modes?: string[]): ToggleOption => ({
  id,
  label,
  type: "toggle",
  default: value,
  ...(modes ? { modes } : {}),
});

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

/** "Bob's 27", "bobs27" und "BOBS 27" sind dasselbe. */
const variantKey = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, "");

export function modeForVariant(variant: unknown): string | null {
  if (typeof variant !== "string" || variant === "") return null;
  const key = variantKey(variant);
  return MODES.find((mode) => mode.variants.some((v) => variantKey(v) === key))?.id ?? null;
}

export const isMode = (id: unknown): id is string => MODES.some((mode) => mode.id === id);

const X01 = ["x01"];

export const CATALOG: Catalog = {
  parts: [
    {
      id: "hintergrund",
      label: "Hintergrund",
      default: true,
      fixed: true,
      options: [
        {
          id: "darstellung",
          label: "Darstellung",
          type: "choice",
          choices: [
            { id: "schwarz", label: "Schwarz" },
            { id: "autodarts", label: "Autodarts" },
          ],
          default: "schwarz",
        },
        // Weisse Linie innen am Rand der Buehne - zum Ausrichten des Beamers.
        toggle("rahmen", "Rahmen (Bildrand)", false),
      ],
    },
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
            { id: "kamera", label: "Kamera" },
            { id: "drawn", label: "Gezeichnet" },
            { id: "lines", label: "Linien" },
            { id: "light", label: "Nur Licht" },
          ],
          default: "light",
        },
        {
          // Nummern wie bei Autodarts (ab 0); in der Leiste Kamera 1 bis 3.
          id: "kamera",
          label: "Kamera",
          type: "choice",
          choices: [
            { id: "0", label: "Kamera 1" },
            { id: "1", label: "Kamera 2" },
            { id: "2", label: "Kamera 3" },
          ],
          default: "0",
          showIf: { option: "darstellung", value: "kamera" },
        },
        toggle("zahlenring", "Zahlenring"),
        {
          // ring: entlang des Rings, unten umgedreht (wie bisher); gerade: alle aufrecht auf dem Bild.
          id: "zahlenAusrichtung",
          label: "Zahlen ausrichten",
          type: "choice",
          choices: [
            { id: "ring", label: "Wie bisher" },
            { id: "gerade", label: "Gerade" },
          ],
          default: "ring",
        },
        {
          // Zusaetzlicher Abstand der Zahlen nach aussen, in mm auf der Scheibe.
          id: "zahlenAbstand",
          label: "Zahlen-Abstand",
          type: "range",
          min: 0,
          max: 60,
          step: 0.5,
          unit: "mm",
          default: 0,
        },
        {
          // Weisser Zahlenring mit schwarzen Zahlen - nur bei der gezeichneten Scheibe; die Felder bleiben.
          ...toggle("zahlenInvertiert", "Zahlenring invertieren", false),
          showIf: { option: "darstellung", value: "drawn" },
        },
        toggle("darts", "Darts einzeichnen"),
        toggle("letzterDart", "Letzten Dart leuchten"),
        // Leuchtfarbe je Feldfarbe der Scheibe - im Spiel (letzter Dart) und fuer die Warte-Felder.
        { id: "leuchtSchwarz", label: "Leuchtfarbe schwarze Felder", type: "color", default: "#ffdc00" },
        { id: "leuchtWeiss", label: "Leuchtfarbe weiße Felder", type: "color", default: "#ffdc00" },
        { id: "leuchtRot", label: "Leuchtfarbe rote Felder", type: "color", default: "#ffdc00" },
        { id: "leuchtGruen", label: "Leuchtfarbe grüne Felder", type: "color", default: "#ffdc00" },
        // Ohne Spiel dieselbe Scheibe (Lage aus dem Layout), nur ohne Darts.
        toggle("beimWarten", "Beim Warten zeigen", false),
      ],
    },
    {
      // Der Text „Warte auf ein Spiel“ ohne Spiel - fester Wortlaut, verschieb- und skalierbar.
      id: "warten",
      label: "Warten",
      default: true,
      options: [
        // Zum Pruefen der Ausrichtung: aeussere Einzelfelder der weissen 1 und der schwarzen 8.
        // Sie pulsieren - deshalb nur beim Warten, nie im Spiel (Autodarts saehe jeden Impuls als Wurf).
        // Farbe: die Leuchtfarbe der Feldfarbe (Scheibe), 1 weiss, 8 schwarz.
        toggle("felder", "Felder 1 und 8 leuchten", false),
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
};

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;

function partDefaults(part: Part): PartContent {
  const value: PartContent = { on: part.default };
  for (const option of part.options) value[option.id] = option.default;
  return value;
}

function isValid(option: Option, raw: unknown): raw is boolean | string | number {
  if (option.type === "toggle") return typeof raw === "boolean";
  if (option.type === "range") return typeof raw === "number" && Number.isFinite(raw);
  if (option.type === "color") return typeof raw === "string" && /^#[0-9a-f]{6}$/i.test(raw);
  return typeof raw === "string" && option.choices.some((choice) => choice.id === raw);
}

/** Zahl auf das Raster des Reglers und in seine Grenzen. */
function toRange(option: RangeOption, raw: number): number {
  const snapped = Math.round(raw / option.step) * option.step;
  return Math.min(option.max, Math.max(option.min, Number(snapped.toFixed(6))));
}

/**
 * Prueft jeden Baustein einzeln. Der Inhalt kommt aus dem Browser und aus
 * einer von Hand editierbaren Datei - deshalb wird jede Option einzeln
 * geprueft. Was fehlt oder nicht passt, kommt aus `fallback` (beim Aendern:
 * der bisherige Stand), sonst aus den Vorgaben. Ein Profil gilt fuer alle
 * Spielarten - es behaelt auch Optionen, die es nur in einigen gibt.
 */
export function sanitizeContent(stored: unknown, fallback: Content = {}): Content {
  const source = asRecord(stored);
  const content: Content = {};
  for (const part of CATALOG.parts) {
    const given = asRecord(source[part.id]);
    const base = fallback[part.id] ?? partDefaults(part);
    const on = given["on"];
    const value: PartContent = { on: part.fixed ? true : typeof on === "boolean" ? on : base.on };
    for (const option of part.options) {
      const raw = given[option.id];
      const valid = isValid(option, raw);
      value[option.id] = !valid
        ? (base[option.id] ?? option.default)
        : option.type === "range"
          ? toRange(option, raw as number)
          : option.type === "color"
            ? (raw as string).toLowerCase()
            : raw;
    }
    content[part.id] = value;
  }
  return content;
}

/** Vorgaben des Katalogs (der Standard weicht davon ab, siehe standards.ts). */
export const contentDefaults = (): Content => sanitizeContent(null);
