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

/**
 * Die Chips oben links: Spielart, Startpunkte, Ziel, Ein-/Ausstieg - je mit
 * dem Schluessel der Option in der Spielinfo. Was die Spielart nicht kennt
 * (Startpunkte, Modus), faellt weg.
 */
export function matchChips(match, modeLabel) {
  const target = match.setsToWin
    ? `Erster bis ${match.setsToWin} ${match.setsToWin === 1 ? "Set" : "Sets"}`
    : `Erster bis ${match.legsToWin} ${match.legsToWin === 1 ? "Leg" : "Legs"}`;
  const chips = [{ key: "spielart", text: modeLabel }];
  if (match.baseScore !== null) chips.push({ key: "punktzahl", text: String(match.baseScore) });
  chips.push({ key: "legs", text: target });
  if (match.inMode && match.outMode) {
    const inLetter = MODE_LETTER[match.inMode] ?? "S";
    const outLetter = MODE_LETTER[match.outMode] ?? "S";
    chips.push({ key: "modus", text: `${inLetter}I-${outLetter}O` });
  }
  return chips;
}
