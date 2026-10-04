/**
 * Das Layout der Beamer-Anzeige: wo jeder Baustein sitzt und wie gross er ist.
 *
 * Positionen sind Prozentwerte der Projektionsflaeche, keine Pixel. Dadurch
 * passt ein einmal eingerichtetes Layout auch dann noch, wenn der Beamer mit
 * einer anderen Aufloesung laeuft.
 */

export const BLOCK_IDS = ["meta", "players", "checkout"] as const;
export type BlockId = (typeof BLOCK_IDS)[number];

export interface BlockLayout {
  /** Abstand vom linken Rand in Prozent der Breite. */
  x: number;
  /** Abstand vom oberen Rand in Prozent der Hoehe. */
  y: number;
  /** Groesse relativ zur Grundgroesse des Bausteins. */
  scale: number;
}

export type DisplayLayout = Record<BlockId, BlockLayout>;

/** Ein Baustein bleibt anfassbar, solange seine Ecke im Bild ist. */
const MIN_POSITION = 0;
const MAX_POSITION = 95;
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

export const DEFAULT_LAYOUT: DisplayLayout = {
  meta: { x: 5, y: 5, scale: 1 },
  players: { x: 5, y: 25, scale: 1 },
  checkout: { x: 5, y: 78, scale: 1 },
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function sanitizeBlock(stored: unknown, fallback: BlockLayout): BlockLayout {
  if (typeof stored !== "object" || stored === null) return fallback;
  const { x, y, scale } = stored as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number" || typeof scale !== "number") {
    return fallback;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) {
    return fallback;
  }
  return {
    x: clamp(x, MIN_POSITION, MAX_POSITION),
    y: clamp(y, MIN_POSITION, MAX_POSITION),
    scale: clamp(scale, MIN_SCALE, MAX_SCALE),
  };
}

/**
 * Macht aus beliebigem gespeichertem Inhalt ein brauchbares Layout.
 *
 * Die Layout-Datei wird von Hand editierbar sein und kommt aus dem Browser -
 * deshalb wird hier nichts geglaubt, sondern alles geprueft und notfalls auf
 * den Standard zurueckgesetzt. Eine kaputte Datei darf die Anzeige nie
 * unbedienbar machen.
 */
export function sanitizeLayout(stored: unknown): DisplayLayout {
  if (typeof stored !== "object" || stored === null) return { ...DEFAULT_LAYOUT };

  const source = stored as Record<string, unknown>;
  const layout = {} as DisplayLayout;
  for (const id of BLOCK_IDS) {
    layout[id] = sanitizeBlock(source[id], DEFAULT_LAYOUT[id]);
  }
  return layout;
}
