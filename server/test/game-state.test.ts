import { describe, expect, test } from "vitest";
import { IDLE, toScoreboardState } from "../src/beamer/game-state.js";

/**
 * Nachbau der Match-State-Nachricht laut docs/protocol.md.
 *
 * ACHTUNG: Diese Struktur ist aus Community-Quellen rekonstruiert und noch
 * nicht gegen eine echte Aufzeichnung geprueft (Schritt 0). Wenn die
 * erste echte Aufzeichnung eine abweichende Struktur zeigt, wird dieses Fixture
 * zusammen mit dem Parser korrigiert - die Erwartungen darunter bleiben gueltig, weil sie
 * das Verhalten der Anzeige beschreiben, nicht das Drahtformat.
 */
function matchState(overrides: Record<string, unknown> = {}) {
  return {
    variant: "X01",
    player: 0,
    players: [{ name: "Arnold" }, { name: "Marcus" }],
    gameScores: [121, 284],
    scores: [{ legs: 2 }, { legs: 1 }],
    leg: 4,
    settings: { baseScore: 501 },
    turns: [{ throws: [] }],
    winner: -1,
    ...overrides,
  };
}

describe("toScoreboardState", () => {
  test("meldet idle, wenn gar kein Match vorliegt", () => {
    expect(toScoreboardState(null)).toEqual(IDLE);
    expect(toScoreboardState({ irgendwas: true })).toEqual(IDLE);
  });

  test("uebernimmt Restpunkte, Legs und markiert den aktiven Spieler", () => {
    const state = toScoreboardState(matchState());

    expect(state.phase).toBe("playing");
    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.players).toEqual([
      { name: "Arnold", score: 121, legs: 2, isActive: true },
      { name: "Marcus", score: 284, legs: 1, isActive: false },
    ]);
  });

  test("zeigt keinen Checkout-Weg, wenn Autodarts keinen schickt", () => {
    // Nur Autodarts kennt den Spielmodus (Double Out, Straight Out ...) sicher.
    const state = toScoreboardState(matchState({ gameScores: [40, 284] }));

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.checkout).toBeNull();
  });

  test("zeigt den Vorschlag, wenn er in die restlichen Darts der Aufnahme passt", () => {
    const state = toScoreboardState(
      matchState({
        gameScores: [110, 284],
        turns: [{ throws: [{ segment: { name: "T20", multiplier: 3, number: 20 } }] }],
        state: {
          checkoutGuide: [
            { bed: "Triple", multiplier: 3, name: "T20", number: 20 },
            { bed: "Double", multiplier: 2, name: "Bull", number: 25 },
          ],
        },
      }),
    );

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.checkout).toEqual(["T20", "BULL"]);
  });

  test("uebernimmt den Checkout-Vorschlag von Autodarts", () => {
    const state = toScoreboardState(
      matchState({
        gameScores: [52, 284],
        state: {
          checkoutGuide: [
            { bed: "Single", multiplier: 1, name: "S20", number: 20 },
            { bed: "Double", multiplier: 2, name: "D16", number: 16 },
          ],
        },
      }),
    );

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.checkout).toEqual(["S20", "D16"]);
  });

  test("zeigt keinen Checkout-Weg, wenn der Vorschlag nicht mehr in die Aufnahme passt", () => {
    // Autodarts zeigt dann schon den Weg fuer die naechste Aufnahme
    const state = toScoreboardState(
      matchState({
        gameScores: [40, 284],
        turns: [
          {
            throws: [
              { segment: { name: "S1", multiplier: 1, number: 1 } },
              { segment: { name: "S1", multiplier: 1, number: 1 } },
            ],
          },
        ],
        state: {
          checkoutGuide: [
            { bed: "Single", multiplier: 1, name: "S20", number: 20 },
            { bed: "Double", multiplier: 2, name: "D10", number: 10 },
          ],
        },
      }),
    );

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.checkout).toBeNull();
  });

  test("schreibt den Bull einheitlich, egal wie Autodarts ihn nennt", () => {
    const state = toScoreboardState(
      matchState({
        turns: [
          {
            throws: [
              { segment: { name: "Bull", multiplier: 2, number: 25 } },
              { segment: { name: "25", multiplier: 1, number: 25 } },
            ],
          },
        ],
      }),
    );

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.currentTurn.darts).toEqual(["BULL", "25"]);
  });

  test("meldet eine ueberworfene Aufnahme", () => {
    const state = toScoreboardState(matchState({ turnBusted: true }));

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.currentTurn.busted).toBe(true);
  });

  test("meldet keine ueberworfene Aufnahme im normalen Spiel", () => {
    const state = toScoreboardState(matchState());

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.currentTurn.busted).toBe(false);
  });

  test("meldet den Gewinner, wenn das Match beendet ist", () => {
    const state = toScoreboardState(matchState({ winner: 1 }));

    expect(state).toEqual({ phase: "finished", winner: "Marcus" });
  });
});
