/**
 * Das Layout einer Anzeige: wo die Scheibe und jeder Baustein sitzt und wie
 * gross er ist.
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
export const BLOCK_IDS = ["kopf", "aufnahme", ...PLAYER_BLOCKS] as const;
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

export type BoardMode = "light" | "drawn";

export interface DisplayLayout {
  version: 2;
  boardMode: BoardMode;
  board: BoardLayout;
  blocks: Record<BlockId, BlockLayout>;
}

export const DEFAULT_LAYOUT: DisplayLayout = {
  version: 2,
  boardMode: "light",
  board: { cx: 50, cy: 51, diameter: 50, rotation: 0 },
  blocks: {
    kopf: { x: 2, y: 3, scale: 1 },
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

/** Ein Wert der Scheibe: begrenzt, oder bei Unbrauchbarem der Standard. */
function boardValue(v: unknown, fallback: number, limits: readonly [number, number]): number {
  return isNumber(v) ? clamp(v, limits) : fallback;
}

function sanitizeBlock(stored: unknown, fallback: BlockLayout): BlockLayout {
  if (typeof stored !== "object" || stored === null) return { ...fallback };
  const { x, y, scale } = stored as Record<string, unknown>;
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
 * deshalb wird nichts geglaubt. Ein Layout ohne version 2 (die alten
 * Beamer-Layouts) gilt als nicht vorhanden. Eine kaputte Datei darf den Viewer
 * nie unbedienbar machen.
 */
export function sanitizeLayout(stored: unknown): DisplayLayout {
  const fresh = structuredClone(DEFAULT_LAYOUT);
  if (typeof stored !== "object" || stored === null) return fresh;
  const source = stored as Record<string, unknown>;
  if (source["version"] !== 2) return fresh;

  const board = (typeof source["board"] === "object" && source["board"] !== null
    ? source["board"]
    : {}) as Record<string, unknown>;
  const blocks = (typeof source["blocks"] === "object" && source["blocks"] !== null
    ? source["blocks"]
    : {}) as Record<string, unknown>;

  const defaults = DEFAULT_LAYOUT.board;
  fresh.boardMode = source["boardMode"] === "drawn" ? "drawn" : "light";
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
