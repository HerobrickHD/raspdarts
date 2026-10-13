/*
 * Profil + Spielart → was der Viewer zeichnet. Ein Profil speichert nur
 * angepasste Spielarten (Inhalte und Layout samt Scheibe); alle anderen
 * folgen dem Standard aus dem Katalog.
 *
 * Dazu die lokalen Aenderungen beim Einstellen: Sie werden sofort ins eigene
 * Bild eingebaut, bevor das Echo vom Pi kommt. Reine Funktionen ohne DOM.
 */

/** Profilteil fuer unbekannte Spielarten und vor dem ersten Spiel. */
export const FALLBACK_MODE = "x01";

const entryFor = (profile, catalog, mode) =>
  profile.spielarten[mode] ?? catalog.standards[mode] ?? catalog.standards[FALLBACK_MODE];

/** mode: Spielart-id oder null (unbekannt → X01-Teil). */
export function resolveProfile(profile, catalog, mode) {
  const key = mode ?? FALLBACK_MODE;
  const entry = entryFor(profile, catalog, key);
  return { content: entry.content, layout: entry.layout, angepasst: Object.hasOwn(profile.spielarten, key) };
}

/** Neues Layout (Scheibe, Bloecke, Bereiche) fuer eine Spielart; ihre Inhalte bleiben. */
export function withModeLayout(profile, catalog, mode, layout) {
  const entry = entryFor(profile, catalog, mode);
  return { ...profile, spielarten: { ...profile.spielarten, [mode]: { content: entry.content, layout } } };
}

/** Neue Inhalte fuer eine Spielart; ihr Layout bleibt. Unveraendert → dasselbe Profil. */
export function withContent(profile, catalog, mode, content) {
  const entry = entryFor(profile, catalog, mode);
  if (JSON.stringify(content) === JSON.stringify(entry.content)) return profile;
  return { ...profile, spielarten: { ...profile.spielarten, [mode]: { content, layout: entry.layout } } };
}

export function withFormat(profile, format) {
  return { ...profile, format };
}
