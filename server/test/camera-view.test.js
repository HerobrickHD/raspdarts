import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { cameraMatrix3d, scaleHomography } from "../public/js/camera-view.js";
import { applyHomography, cameraMatrix } from "../src/viewer/camera-geometry.ts";

const ELLIPSES = JSON.parse(readFileSync("test/fixtures/autodarts-ellipses-2026-10-13.json", "utf8"));

describe("scaleHomography", () => {
  test("bildet auf ein Quadrat der gegebenen Groesse ab: Bull in die Mitte", () => {
    const h = scaleHomography(cameraMatrix(ELLIPSES["2"]), 600);
    const [x, y] = applyHomography(h, ELLIPSES["2"].bull);
    expect(x).toBeCloseTo(300, 0);
    expect(y).toBeCloseTo(300, 0);
  });
});

describe("cameraMatrix3d", () => {
  test("CSS matrix3d spaltenweise aus der Homographie", () => {
    expect(cameraMatrix3d([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe("matrix3d(1,4,0,7,2,5,0,8,0,0,1,0,3,6,0,9)");
  });
});
