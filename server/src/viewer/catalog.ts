/**
 * Katalog: alle Bausteine des Viewers, ihre Optionen und die Spielarten.
 *
 * Die einzige Stelle, an der Optionen beschrieben werden. Der Pi prueft jedes
 * Profil dagegen und schickt den Katalog an den Viewer, der daraus die
 * Checkbox-Liste baut. Eine neue Option braucht hier einen Eintrag und im
 * Viewer ihre Wirkung (meist eine CSS-Regel auf data-<baustein>-<option>).
 *
 * Alte Profile bleiben gueltig: Fehlende Optionen bekommen beim Lesen die
 * Vorgabe. Standards je Spielart stehen in standards.ts.
 *
 * Spielarten: Alle Bausteine werden je Spielart eingestellt. modes an einem
 * Baustein oder einer Option sagt, in welchen Spielarten es sie gibt; ohne
 * modes gibt es sie ueberall.
 */

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
  /** Nur sichtbar, wenn eine andere Option dieses Bausteins diesen Wert hat. */
  showIf?: { option: string; value: string };
}

export type Option = ToggleOption | ChoiceOption;

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
  [option: string]: boolean | string;
}

export type Content = Record<string, PartContent>;
export type ContentPatch = Record<string, Record<string, boolean | string>>;

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

function isValid(option: Option, raw: unknown): raw is boolean | string {
  return option.type === "toggle"
    ? typeof raw === "boolean"
    : typeof raw === "string" && option.choices.some((choice) => choice.id === raw);
}

/**
 * Prueft die Bausteine `parts` einzeln. Der Inhalt kommt aus dem Browser und
 * aus einer von Hand editierbaren Datei - deshalb wird jede Option einzeln
 * geprueft. Was fehlt oder nicht passt, kommt aus `fallback` (beim Aendern:
 * der bisherige Stand), sonst aus den Vorgaben. Optionen, die es in der
 * Spielart nicht gibt, fallen weg.
 */
function sanitizeParts(parts: Part[], stored: unknown, fallback: Content, mode: string | null): Content {
  const source = asRecord(stored);
  const content: Content = {};
  for (const part of parts) {
    const given = asRecord(source[part.id]);
    const base = fallback[part.id] ?? partDefaults(part);
    const on = given["on"];
    const value: PartContent = { on: part.fixed ? true : typeof on === "boolean" ? on : base.on };
    for (const option of part.options) {
      if (!availableIn(option, mode)) continue;
      const raw = given[option.id];
      value[option.id] = isValid(option, raw) ? raw : (base[option.id] ?? option.default);
    }
    content[part.id] = value;
  }
  return content;
}

const modeParts = (mode: string): Part[] => CATALOG.parts.filter((part) => availableIn(part, mode));

export const modeDefaults = (mode: string): Content => sanitizeParts(modeParts(mode), null, {}, mode);

/**
 * Fruehere Form des Hintergrunds (bis 13.10.): an/aus statt Darstellung, und
 * der Rahmen war ein eigener Baustein.
 */
function upgradeContent(stored: unknown): unknown {
  const source = asRecord(stored);
  const hintergrund = asRecord(source["hintergrund"]);
  const rahmen = asRecord(source["rahmen"])["on"];
  if (hintergrund["darstellung"] !== undefined && rahmen === undefined) return stored;
  const upgraded = { ...hintergrund };
  if (upgraded["darstellung"] === undefined && typeof hintergrund["on"] === "boolean") {
    upgraded["darstellung"] = hintergrund["on"] ? "autodarts" : "schwarz";
  }
  if (upgraded["rahmen"] === undefined && typeof rahmen === "boolean") upgraded["rahmen"] = rahmen;
  return { ...source, hintergrund: upgraded };
}

/** Bausteine einer Spielart; Optionen, die es dort nicht gibt, fallen weg. */
export function sanitizeModeContent(stored: unknown, mode: string, fallback: Content = modeDefaults(mode)): Content {
  return sanitizeParts(modeParts(mode), upgradeContent(stored), fallback, mode);
}
