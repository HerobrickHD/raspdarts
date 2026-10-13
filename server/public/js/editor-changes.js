/*
 * Was eine Aenderung beim Ausrichten fuer das Profil bedeutet: Die Scheibe
 * gilt fuer alle Spielarten (gemeinsam), Bloecke und Bereiche nur fuer die
 * angezeigte Spielart. Wer nur die Scheibe verschiebt, passt damit keine
 * Spielart an. Reine Funktion ohne DOM.
 */
import { withBoard, withModeBlocks } from "./resolve-profile.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function layoutChange(profile, catalog, mode, before, after) {
  let next = profile;
  const patch = {};
  if (!same(before.board, after.board)) {
    next = withBoard(next, after.board);
    patch.gemeinsam = { board: after.board };
  }
  if (!same(before.blocks, after.blocks)) {
    next = withModeBlocks(next, catalog, mode, after.blocks);
    patch.spielart = { id: mode, layout: { blocks: after.blocks } };
  }
  return { profile: next, patch };
}
