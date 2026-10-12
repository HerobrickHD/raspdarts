import { describe, expect, test } from "vitest";
import { SNAP_DEG, snapRotation } from "../public/js/rotation.js";

describe("snapRotation", () => {
  test.each([
    [2.9, 0],
    [-2.9, 0],
    [0.4, 0],
    [3.1, 3.1],
    [-3, -3],
    [88, 90],
    [-91.5, -90],
    [178, 180],
    [-178, -180],
    [45, 45],
  ])("%d° → %d°", (deg, snapped) => {
    expect(snapRotation(deg)).toBe(snapped);
  });

  test("rastet erst unter 3 Grad ein", () => {
    expect(SNAP_DEG).toBe(3);
    expect(snapRotation(3)).toBe(3);
  });

  test("mit Alt (free) bleibt der Winkel unveraendert", () => {
    expect(snapRotation(2.9, { free: true })).toBe(2.9);
    expect(snapRotation(-178, { free: true })).toBe(-178);
  });
});
