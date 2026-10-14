/**
 * Der Standard: womit ein neues Profil startet und worauf "Zuruecksetzen" es
 * stellt - Inhalte und Layout fuer alle Spielarten. Wie die frueheren Vorlagen
 * nur Abweichungen von den Vorgaben des Katalogs.
 */
import {
  CATALOG,
  GROUP_LABELS,
  MODES,
  sanitizeContent,
  type Content,
  type ContentPatch,
  type GameMode,
  type ModeGroup,
  type Part,
} from "./catalog.js";
import { DEFAULT_LAYOUT, FORMATS, sanitizeLayout, type Layout } from "./layout.js";

export interface Standard {
  content: Content;
  layout: Layout;
}

/** Wie die fruehere Vorlage "Projektion": ohne Zahlenring und Spielinfo, Scheibe mittig. */
const STANDARD_CONTENT: ContentPatch = { scheibe: { zahlenring: false }, spielinfo: { on: false } };

export function standard(): Standard {
  return { content: sanitizeContent(STANDARD_CONTENT), layout: sanitizeLayout(DEFAULT_LAYOUT) };
}

export interface ViewerCatalog {
  parts: Part[];
  modes: GameMode[];
  groups: Record<ModeGroup, string>;
  formats: { id: string; label: string }[];
}

/** Was der Viewer braucht, um Liste und Profil selbst auszuwerten. */
export function viewerCatalog(): ViewerCatalog {
  return {
    parts: CATALOG.parts,
    modes: MODES,
    groups: GROUP_LABELS,
    formats: FORMATS.map((f) => ({ ...f })),
  };
}
