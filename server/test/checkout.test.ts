import { describe, expect, test } from "vitest";
import { checkoutPath } from "../src/beamer/checkout.js";

describe("checkoutPath", () => {
  test("schlaegt D20 fuer 40 vor", () => {
    expect(checkoutPath(40, 3)).toEqual(["D20"]);
  });

  test("schlaegt den Standardweg T20 T20 BULL fuer 170 vor", () => {
    expect(checkoutPath(170, 3)).toEqual(["T20", "T20", "BULL"]);
  });

  test("beendet 50 mit einem einzigen Bull", () => {
    expect(checkoutPath(50, 3)).toEqual(["BULL"]);
  });

  test("liefert null fuer Bogey-Zahlen wie 169", () => {
    expect(checkoutPath(169, 3)).toBeNull();
  });

  test("liefert null fuer 1, weil Double-Out unmoeglich ist", () => {
    expect(checkoutPath(1, 3)).toBeNull();
  });

  test("liefert null oberhalb von 170", () => {
    expect(checkoutPath(171, 3)).toBeNull();
  });

  test("beruecksichtigt, dass nur noch ein Dart uebrig ist", () => {
    expect(checkoutPath(40, 1)).toEqual(["D20"]);
    expect(checkoutPath(60, 1)).toBeNull();
  });

  test("beruecksichtigt, dass nur noch zwei Darts uebrig sind", () => {
    expect(checkoutPath(100, 2)).toEqual(["T20", "D20"]);
    expect(checkoutPath(170, 2)).toBeNull();
  });
});
