import { describe, expect, test } from "vitest";
import { boardHighlights } from "../public/js/board.js";
import { fieldColor } from "../public/js/geometry.js";

describe("boardHighlights", () => {
  test("beim Warten je Feldfarbe ein Testfeld: 1 aussen (weiss), 8 aussen (schwarz), Triple 20 (rot), Triple 19 (gruen)", () => {
    expect(boardHighlights({ phase: "idle" })).toEqual([
      { field: { multiplier: 1, number: 1, ring: "outer" }, kind: "warten" },
      { field: { multiplier: 1, number: 8, ring: "outer" }, kind: "warten" },
      { field: { multiplier: 3, number: 20, ring: null }, kind: "warten" },
      { field: { multiplier: 3, number: 19, ring: null }, kind: "warten" },
    ]);
    expect(boardHighlights({ phase: "idle" }).map((h) => fieldColor(h.field))).toEqual(["light", "dark", "red", "green"]);
  });

  test("im Spiel nur, was der Pi schickt - nie die Warte-Felder", () => {
    const highlights = [{ field: { multiplier: 3, number: 20, ring: null }, kind: "last-dart" }];
    expect(boardHighlights({ phase: "playing", highlights })).toBe(highlights);
  });
});
