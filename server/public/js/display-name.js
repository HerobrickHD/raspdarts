/*
 * Anzeigename aus der Adresse (?display=beamer).
 *
 * Gleiche Regel wie displayName() auf dem Pi: Der WebSocket landet bei einem
 * unbrauchbaren Namen auf "standard" - der Editor muss dann auch dorthin
 * speichern, sonst geht jede Ausrichtung still verloren.
 */

const VALID_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/i;
export const DEFAULT_DISPLAY = "standard";

export function displayFromSearch(search) {
  const name = new URLSearchParams(search).get("display");
  return name !== null && VALID_NAME.test(name) ? name : DEFAULT_DISPLAY;
}
