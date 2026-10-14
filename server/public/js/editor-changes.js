/*
 * Was eine Aenderung beim Ausrichten fuer das Profil bedeutet: Scheibe,
 * Bloecke und Bereiche sind sein Layout fuer alle Spielarten. Reine Funktion
 * ohne DOM.
 */
export function layoutChange(profile, before, after) {
  if (JSON.stringify(before) === JSON.stringify(after)) return { profile, patch: {} };
  return { profile: { ...profile, layout: after }, patch: { layout: after } };
}
