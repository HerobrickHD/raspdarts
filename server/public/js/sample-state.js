/*
 * Beispieldaten fuer das Einstellen ohne laufendes Spiel - sonst gaebe es
 * nichts zu platzieren. Je Spielart und Spielerzahl; Form wie der ViewerState
 * vom Pi.
 */

const field = (multiplier, number, ring = null) => ({ multiplier, number, ring });

const NAMES = ["Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4", "Spieler 5", "Spieler 6"];
const COUNTRIES = ["de", null, "at", "ch", null, "nl"];
/** X01: Rest; sonst Punkte - Hauptsache unterschiedlich lang. */
const X01_SCORES = [121, 280, 64, 501, 333, 170];
const POINTS = [42, 17, 103, 8, 76, 55];
const WITH_CHECKOUT = ["x01", "random-checkout"];

const MATCH = {
  x01: { baseScore: 501, legsToWin: 3, setsToWin: null, inMode: "Straight", outMode: "Double" },
  cricket: { baseScore: null, legsToWin: 3, setsToWin: null, inMode: null, outMode: null },
};
const OTHER_MATCH = { baseScore: null, legsToWin: 1, setsToWin: null, inMode: null, outMode: null };

export function sampleState(mode, count) {
  const n = Math.min(6, Math.max(1, count));
  const isX01 = mode === "x01";
  const players = NAMES.slice(0, n).map((name, index) => ({
    seat: index + 1,
    name,
    avatarUrl: null,
    country: COUNTRIES[index],
    score: (isX01 ? X01_SCORES : POINTS)[index],
    legs: index === 0 ? 1 : 0,
    sets: 0,
    average: { leg: 60.5 - index * 4, match: 58.2 - index * 3 },
    dartsThrown: 12,
    isActive: index === 0,
    isWinner: false,
    busted: false,
    checkout: index === 0 && WITH_CHECKOUT.includes(mode) ? [field(3, 20), field(1, 11), field(2, 25)] : null,
  }));
  return {
    phase: "playing",
    variant: mode,
    mode,
    match: MATCH[mode] ?? OTHER_MATCH,
    players,
    turn: {
      darts: [
        { field: field(3, 20), coords: { x: 0, y: 0.61 } },
        { field: field(1, 1, "outer"), coords: { x: 0.25, y: 0.75 } },
      ],
      points: 61,
      busted: false,
    },
    highlights: [{ field: field(1, 1, "outer"), kind: "last-dart" }],
  };
}

/** Beim Einstellen immer X01 - die Spielart mit den meisten Bausteinen. */
export const PREVIEW_MODE = "x01";

/**
 * Was die Geraete zeigen: Beim Einstellen haben sie mit dem laufenden Spiel
 * nichts zu tun - immer Beispieldaten (X01) mit der gewaehlten Spielerzahl.
 * Nach "Fertig" wieder das echte Spiel.
 */
export function previewState(state, editing) {
  return editing ? sampleState(PREVIEW_MODE, editing.spieler) : state;
}
