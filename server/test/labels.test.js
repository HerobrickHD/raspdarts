import { describe, expect, test } from "vitest";
import { fieldLabel, formatAverage, matchChips } from "../public/js/labels.js";

describe("fieldLabel", () => {
  test.each([
    [{ multiplier: 3, number: 20, ring: null }, "T20"],
    [{ multiplier: 2, number: 8, ring: null }, "D8"],
    [{ multiplier: 1, number: 12, ring: "outer" }, "S12"],
    [{ multiplier: 1, number: 25, ring: null }, "25"],
    [{ multiplier: 2, number: 25, ring: null }, "BULL"],
    [{ multiplier: 0, number: 0, ring: null }, "MISS"],
  ])("%o → %s", (field, label) => {
    expect(fieldLabel(field)).toBe(label);
  });
});

describe("formatAverage", () => {
  test("eine Nachkommastelle mit Punkt wie bei Autodarts", () => {
    expect(formatAverage(61)).toBe("61.0");
    expect(formatAverage(97.33333333333333)).toBe("97.3");
    expect(formatAverage(0)).toBe("0.0");
  });
});

describe("matchChips", () => {
  const match = { baseScore: 301, legsToWin: 1, setsToWin: null, inMode: "Straight", outMode: "Straight" };

  test("wie die Chips in der Autodarts-Spielansicht", () => {
    expect(matchChips(match)).toEqual(["301", "Erster bis 1 Leg", "SI-SO"]);
  });

  test("Mehrzahl, Saetze und andere Modi", () => {
    expect(matchChips({ ...match, baseScore: 501, legsToWin: 3, outMode: "Double" })).toEqual([
      "501",
      "Erster bis 3 Legs",
      "SI-DO",
    ]);
    expect(matchChips({ ...match, setsToWin: 2, inMode: "Double", outMode: "Master" })).toEqual([
      "301",
      "Erster bis 2 Sets",
      "DI-MO",
    ]);
  });
});
