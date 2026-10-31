import { describe, expect, test } from "vitest";
import { boardHighlights } from "../public/js/board.js";

describe("boardHighlights", () => {
  test("beim Warten: aeussere Einzelfelder der 1 (weiss) und der 8 (schwarz)", () => {
    expect(boardHighlights({ phase: "idle" })).toEqual([
      { field: { multiplier: 1, number: 1, ring: "outer" }, kind: "warten" },
      { field: { multiplier: 1, number: 8, ring: "outer" }, kind: "warten" },
    ]);
  });

  test("im Spiel nur, was der Pi schickt - nie die Warte-Felder", () => {
    const highlights = [{ field: { multiplier: 3, number: 20, ring: null }, kind: "last-dart" }];
    expect(boardHighlights({ phase: "playing", highlights })).toBe(highlights);
  });
});
