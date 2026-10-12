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
