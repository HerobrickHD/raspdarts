/*
 * Beschriftungen wie in der Autodarts-Spielansicht. Reine Funktionen ohne DOM.
 */

const PREFIX = ["", "S", "D", "T"];
const MODE_LETTER = { Straight: "S", Double: "D", Master: "M" };

export function fieldLabel(field) {
  if (field.multiplier === 0 || field.number === 0) return "MISS";
  if (field.number === 25) return field.multiplier === 2 ? "BULL" : "25";
  return `${PREFIX[field.multiplier]}${field.number}`;
}

/** Eine Nachkommastelle, Punkt als Trenner - so schreibt es Autodarts. */
export function formatAverage(value) {
  return (Number.isFinite(value) ? value : 0).toFixed(1);
}

/** Die Chips oben links: Startpunkte, Ziel, Ein-/Ausstieg. */
export function matchChips(match) {
  const target = match.setsToWin
    ? `Erster bis ${match.setsToWin} ${match.setsToWin === 1 ? "Set" : "Sets"}`
    : `Erster bis ${match.legsToWin} ${match.legsToWin === 1 ? "Leg" : "Legs"}`;
  const inLetter = MODE_LETTER[match.inMode] ?? "S";
  const outLetter = MODE_LETTER[match.outMode] ?? "S";
  return [String(match.baseScore), target, `${inLetter}I-${outLetter}O`];
}
