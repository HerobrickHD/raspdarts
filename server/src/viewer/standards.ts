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
import { DEFAULT_MODE_LAYOUT, FORMATS, sanitizeModeLayout, type ModeBlocks, type ModeLayout } from "./layout.js";

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
  formats: { id: string; label: string }[];
}

/** Was der Viewer braucht, um Liste und Profil selbst auszuwerten. */
export function viewerCatalog(): ViewerCatalog {
  return {
    parts: CATALOG.parts,
    modes: MODES,
    groups: GROUP_LABELS,
    standards: Object.fromEntries(MODES.map((mode) => [mode.id, standardFor(mode.id)])),
    shared: sharedStandard(),
    formats: FORMATS.map((f) => ({ ...f })),
  };
}
