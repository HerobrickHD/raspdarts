import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { applyHomography, cameraMatrix, cameraMatrices } from "../src/viewer/camera-geometry.js";

/** Echte Ringpunkte von Arnolds Board (13.10.2026), Kamera 2 haengt ueber der 20. */
const ELLIPSES = JSON.parse(readFileSync("test/fixtures/autodarts-ellipses-2026-10-13.json", "utf8"));

/** Scheibe -> Einheitsquadrat: 450 mm Kante, Mitte 0.5/0.5, 20 oben. */
const onBoard = (deg: number, mm: number): [number, number] => [
  0.5 + (mm / 450) * Math.sin((deg * Math.PI) / 180),
  0.5 - (mm / 450) * Math.cos((deg * Math.PI) / 180),
];

describe("cameraMatrix", () => {
  test("Bullmitte landet in der Mitte, fuer jede Kamera", () => {
    for (const cam of ["0", "1", "2"]) {
      const h = cameraMatrix(ELLIPSES[cam])!;
      const [x, y] = applyHomography(h, ELLIPSES[cam].bull);
      expect(x, cam).toBeCloseTo(0.5, 2);
      expect(y, cam).toBeCloseTo(0.5, 2);
    }
  });

  test("Punkt 0 liegt am Draht zwischen 20 und 1, die Zaehlung laeuft im Uhrzeigersinn", () => {
    const h = cameraMatrix(ELLIPSES["2"])!;
    const points = ELLIPSES["2"].doubleOuterPoints;
    for (const [k, deg] of [[0, 9], [1, 27], [5, 99], [10, 189]] as const) {
      const [x, y] = applyHomography(h, points[k]);
      const [ex, ey] = onBoard(deg, 170);
      expect(Math.hypot(x - ex, y - ey), `Punkt ${k}`).toBeLessThan(0.005);
    }
  });

  test("Restfehler ueber alle Ringpunkte unter 3 px bei 600 px Scheibe", () => {
    const rings = { doubleOuterPoints: 170, doubleInnerPoints: 162, trebleOuterPoints: 107, trebleInnerPoints: 99 };
    for (const cam of ["0", "1", "2"]) {
      const h = cameraMatrix(ELLIPSES[cam])!;
      let sum = 0;
      let count = 0;
      for (const [ring, mm] of Object.entries(rings)) {
        ELLIPSES[cam][ring].forEach((p: [number, number], k: number) => {
          const [x, y] = applyHomography(h, p);
          const [ex, ey] = onBoard(9 + 18 * k, mm);
          sum += ((x - ex) * 600) ** 2 + ((y - ey) * 600) ** 2;
          count += 1;
        });
      }
      expect(Math.sqrt(sum / count), cam).toBeLessThan(3);
    }
  });

  test("ohne brauchbare Punkte: null", () => {
    expect(cameraMatrix(null)).toBeNull();
    expect(cameraMatrix({})).toBeNull();
    expect(cameraMatrix({ bull: [1, 2], doubleOuterPoints: [[1, 2]] })).toBeNull();
  });
});

describe("cameraMatrices", () => {
  test("je Kamera eine Matrix; Kameras ohne Punkte fallen weg", () => {
    const all = cameraMatrices({ ...ELLIPSES, "7": {} });
    expect(Object.keys(all).sort()).toEqual(["0", "1", "2"]);
    expect(all["2"]).toHaveLength(9);
    expect(cameraMatrices("kaputt")).toEqual({});
  });
});
