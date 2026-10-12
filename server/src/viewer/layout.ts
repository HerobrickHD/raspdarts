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
