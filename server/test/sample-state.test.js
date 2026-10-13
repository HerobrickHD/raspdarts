import { describe, expect, test } from "vitest";
import { sampleState } from "../public/js/sample-state.js";
import { MODES } from "../src/viewer/catalog.ts";

describe("sampleState", () => {
  test("jede Spielart, 1 bis 6 Spieler mit Plaetzen 1..n, Spieler 1 aktiv", () => {
    for (const { id } of MODES) {
      for (let n = 1; n <= 6; n++) {
        const state = sampleState(id, n);
        expect(state.phase).toBe("playing");
        expect(state.mode).toBe(id);
        expect(state.players.map((p) => p.seat)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        expect(state.players[0].isActive).toBe(true);
      }
    }
  });

  test("X01 mit Startpunkten und Checkout, andere ohne", () => {
    expect(sampleState("x01", 2).match.baseScore).toBe(501);
    expect(sampleState("x01", 2).players[0].checkout).not.toBeNull();
    expect(sampleState("gotcha", 2).match.baseScore).toBeNull();
    expect(sampleState("gotcha", 2).players[0].checkout).toBeNull();
    expect(sampleState("random-checkout", 2).players[0].checkout).not.toBeNull();
  });

  test("ausserhalb 1-6 wird begrenzt", () => {
    expect(sampleState("x01", 0).players).toHaveLength(1);
    expect(sampleState("x01", 9).players).toHaveLength(6);
  });
});
