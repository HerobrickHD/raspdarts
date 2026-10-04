import { describe, expect, test } from "vitest";
import { IDLE, toScoreboardState } from "../src/beamer/game-state.js";

/**
 * Nachbau der Match-State-Nachricht laut docs/protocol.md.
 *
 * ACHTUNG: Diese Struktur ist aus Community-Quellen rekonstruiert und noch
 * nicht gegen eine echte Aufzeichnung geprueft (Schritt 0). Wenn `npm run
 * discover` eine abweichende Struktur zeigt, wird dieses Fixture zusammen mit
 * dem Parser korrigiert - die Erwartungen darunter bleiben gueltig, weil sie
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

  test("berechnet den Checkout-Weg des aktiven Spielers", () => {
    const state = toScoreboardState(matchState({ gameScores: [40, 284] }));

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.checkout).toEqual(["D20"]);
  });

  test("liefert keinen Checkout-Weg bei einer Bogey-Zahl", () => {
    const state = toScoreboardState(matchState({ gameScores: [169, 284] }));

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.checkout).toBeNull();
  });

  test("beruecksichtigt bereits geworfene Darts beim Checkout-Vorschlag", () => {
    const state = toScoreboardState(
      matchState({
        gameScores: [110, 284],
        turns: [{ throws: [{ segment: { name: "T20", multiplier: 3, number: 20 } }] }],
      }),
    );

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.currentTurn.darts).toEqual(["T20"]);
    // Nur noch 2 Darts: 110 ist als T20 BULL machbar
    expect(state.checkout).toEqual(["T20", "BULL"]);
  });

  test("meldet den Gewinner, wenn das Match beendet ist", () => {
    const state = toScoreboardState(matchState({ winner: 1 }));

    expect(state).toEqual({ phase: "finished", winner: "Marcus" });
  });
});
