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
  const X01 = { baseScore: 501, legsToWin: 3, setsToWin: null, inMode: "Straight", outMode: "Double" };

  test("Spielart, Startpunkte, Ziel, Ein-/Ausstieg mit Schluessel", () => {
    expect(matchChips(X01, "X01")).toEqual([
      { key: "spielart", text: "X01" },
      { key: "punktzahl", text: "501" },
      { key: "legs", text: "Erster bis 3 Legs" },
      { key: "modus", text: "SI-DO" },
    ]);
  });

  test("Mehrzahl, Saetze und andere Modi", () => {
    expect(matchChips({ ...X01, legsToWin: 1 }, "X01")[2].text).toBe("Erster bis 1 Leg");
    expect(matchChips({ ...X01, setsToWin: 2 }, "X01")[2].text).toBe("Erster bis 2 Sets");
    expect(matchChips({ ...X01, inMode: "Double", outMode: "Master" }, "X01")[3].text).toBe("DI-MO");
  });

  test("ohne Startpunkte und Modus (andere Spielarten) fallen die Chips weg", () => {
    const gotcha = { baseScore: null, legsToWin: 1, setsToWin: null, inMode: null, outMode: null };
    expect(matchChips(gotcha, "Gotcha")).toEqual([
      { key: "spielart", text: "Gotcha" },
      { key: "legs", text: "Erster bis 1 Leg" },
    ]);
  });
});
