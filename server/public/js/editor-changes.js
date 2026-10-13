/*
 * Was eine Aenderung beim Ausrichten fuer das Profil bedeutet: Scheibe,
 * Bloecke und Bereiche gehoeren zur angezeigten Spielart - jede Aenderung
 * passt nur sie an. Reine Funktion ohne DOM.
 */
import { withModeLayout } from "./resolve-profile.js";

export function layoutChange(profile, catalog, mode, before, after) {
  if (JSON.stringify(before) === JSON.stringify(after)) return { profile, patch: {} };
  return {
    profile: withModeLayout(profile, catalog, mode, after),
    patch: { spielart: { id: mode, layout: after } },
  };
}
