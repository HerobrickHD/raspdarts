/*
 * Beispieldaten fuer den Bearbeiten-Modus ohne laufendes Spiel - sonst gaebe es
 * nichts zu platzieren. Form wie der ViewerState vom Pi.
 */

const field = (multiplier, number, ring = null) => ({ multiplier, number, ring });

export const SAMPLE_STATE = {
  phase: "playing",
  variant: "X01",
  match: { baseScore: 501, legsToWin: 3, setsToWin: null, inMode: "Straight", outMode: "Double" },
  players: [
    {
      name: "Spieler 1",
      avatarUrl: null,
      country: "de",
      score: 121,
      legs: 1,
      sets: 0,
      average: { leg: 60.5, match: 58.2 },
      dartsThrown: 12,
      isActive: true,
      isWinner: false,
      busted: false,
      checkout: [field(3, 20), field(1, 11), field(2, 25)],
    },
    {
      name: "Spieler 2",
      avatarUrl: null,
      country: null,
      score: 280,
      legs: 0,
      sets: 0,
      average: { leg: 44.1, match: 47.9 },
      dartsThrown: 12,
      isActive: false,
      isWinner: false,
      busted: false,
      checkout: null,
    },
  ],
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
