/**
 * Das Layout eines Profils: wo die Scheibe und jeder Baustein sitzt und wie
 * gross er ist. Was angezeigt wird (und wie die Scheibe aussieht), steht in den
 * Inhalten des Profils (catalog.ts), nicht hier.
 *
 * Alles gilt je Spielart: Lage der Scheibe, Bloecke und Spielerbereiche.
 *
 * Positionen sind Prozentwerte der Bildflaeche, Groessen haengen an der
 * Bildhoehe - keine Pixel. Ein eingerichtetes Layout passt dadurch auch nach
 * einem Aufloesungswechsel des Beamers noch.
 */

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
  board: BoardLayout;
  blocks: ModeBlocks;
}

/**
 * Seitenverhaeltnis der Buehne. "fenster" = das ganze Fenster wie bisher; bei
 * einem festen Format zeichnet der Viewer eine Buehne genau dieser Form (Rest
 * schwarz), so sieht das Layout auf jedem Bildschirm gleich aus.
 */
export const FORMATS = [
  { id: "fenster", label: "Ganzes Fenster" },
  { id: "16:9", label: "16:9" },
  { id: "16:10", label: "16:10" },
  { id: "4:3", label: "4:3" },
] as const;
export type Format = (typeof FORMATS)[number]["id"];
export const DEFAULT_FORMAT: Format = "fenster";

export function sanitizeFormat(raw: unknown, fallback: Format = DEFAULT_FORMAT): Format {
  return FORMATS.some((f) => f.id === raw) ? (raw as Format) : fallback;
}

/** Grundgroesse einer Spielerkarte in vh (style.css: .card). */
export const CARD = { w: 49, h: 34 } as const;

export const DEFAULT_BOARD: BoardLayout = { cx: 50, cy: 51, diameter: 50, rotation: 0 };

export const DEFAULT_MODE_LAYOUT: ModeLayout = {
  board: { ...DEFAULT_BOARD },
  blocks: {
    spielinfo: { x: 2, y: 3, scale: 1 },
    aufnahme: { x: 32.5, y: 3.8, scale: 1 },
    "bereich-links": { x: 1.4, y: 32.7, w: CARD.w, h: CARD.h },
    "bereich-rechts": { x: 71, y: 32.7, w: CARD.w, h: CARD.h },
  },
};

const LIMITS = {
  position: [0, 100],
  scale: [0.2, 4],
  diameter: [5, 400],
  rotation: [-180, 180],
  w: [5, 300],
  h: [5, 100],
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
 * Lage der Scheibe. Der Inhalt kommt aus dem Browser und aus einer von Hand
 * editierbaren Datei - deshalb wird nichts geglaubt: jeder Wert einzeln
 * begrenzt, Unbrauchbares aus fallback.
 */
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
    w: clamp(w, LIMITS.w),
    h: clamp(h, LIMITS.h),
  };
}

/**
 * Scheibe, Bloecke und Bereiche einer Spielart; jeder Wert einzeln geprueft,
 * Unbrauchbares aus fallback. Eine kaputte Datei darf den Viewer nie
 * unbedienbar machen.
 */
export function sanitizeModeLayout(stored: unknown, fallback: ModeLayout = DEFAULT_MODE_LAYOUT): ModeLayout {
  const source = asRecord(stored);
  const blocks = asRecord(source["blocks"]);
  return {
    board: sanitizeBoard(source["board"], fallback.board),
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
export function splitLegacyLayout(stored: unknown): ModeLayout {
  const source = asRecord(stored);
  const blocks = asRecord(source["blocks"]);
  const defaults = DEFAULT_MODE_LAYOUT.blocks;
  return sanitizeModeLayout({
    board: source["board"],
    blocks: {
      spielinfo: blocks["spielinfo"],
      aufnahme: blocks["aufnahme"],
      "bereich-links": cardToArea(blocks["spieler-1"], defaults["bereich-links"]),
      "bereich-rechts": cardToArea(blocks["spieler-2"], defaults["bereich-rechts"]),
    },
  });
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
): { layout: ModeLayout; boardMode: LegacyBoardMode } | null {
  const source = asRecord(stored);
  if (source["version"] !== 2) return null;
  const blocks = { ...asRecord(source["blocks"]) };
  if (!("spielinfo" in blocks) && "kopf" in blocks) blocks["spielinfo"] = blocks["kopf"];
  return {
    layout: splitLegacyLayout({ board: source["board"], blocks }),
    boardMode: source["boardMode"] === "drawn" ? "drawn" : "light",
  };
}
