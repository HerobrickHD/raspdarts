/*
 * Profil + Spielart → was der Viewer zeichnet. Ein Profil speichert nur
 * angepasste Spielarten; alle anderen folgen dem Standard aus dem Katalog.
 *
 * Dazu die lokalen Aenderungen beim Einstellen: Sie werden sofort ins eigene
 * Bild eingebaut, bevor das Echo vom Pi kommt. Reine Funktionen ohne DOM.
 */

/** Profilteil fuer unbekannte Spielarten und vor dem ersten Spiel. */
export const FALLBACK_MODE = "x01";

const entryFor = (profile, catalog, mode) =>
  profile.spielarten[mode] ?? catalog.standards[mode] ?? catalog.standards[FALLBACK_MODE];

export const isShared = (catalog, partId) =>
  catalog.parts.find((part) => part.id === partId)?.scope === "gemeinsam";

/** mode: Spielart-id oder null (unbekannt → X01-Teil). */
export function resolveProfile(profile, catalog, mode) {
  const key = mode ?? FALLBACK_MODE;
  const entry = entryFor(profile, catalog, key);
  return {
    content: { ...profile.gemeinsam.content, ...entry.content },
    layout: { board: profile.gemeinsam.board, blocks: entry.layout.blocks },
    angepasst: Object.hasOwn(profile.spielarten, key),
  };
}

export function withBoard(profile, board) {
  return { ...profile, gemeinsam: { ...profile.gemeinsam, board } };
}

export function withFormat(profile, format) {
  return { ...profile, gemeinsam: { ...profile.gemeinsam, format } };
}

export function withModeBlocks(profile, catalog, mode, blocks) {
  const entry = entryFor(profile, catalog, mode);
  return {
    ...profile,
    spielarten: { ...profile.spielarten, [mode]: { content: entry.content, layout: { blocks } } },
  };
}

/** content: alle Bausteine wie aus resolveProfile; jeder Teil landet, wo er hingehoert. */
export function withContent(profile, catalog, mode, content) {
  const shared = {};
  const own = {};
  for (const [partId, value] of Object.entries(content)) (isShared(catalog, partId) ? shared : own)[partId] = value;

  const entry = entryFor(profile, catalog, mode);
  const sharedChanged = JSON.stringify(shared) !== JSON.stringify(profile.gemeinsam.content);
  const ownChanged = JSON.stringify(own) !== JSON.stringify(entry.content);

  let next = profile;
  if (sharedChanged) next = { ...next, gemeinsam: { ...next.gemeinsam, content: shared } };
  if (ownChanged) next = { ...next, spielarten: { ...next.spielarten, [mode]: { content: own, layout: entry.layout } } };
  return next;
}
