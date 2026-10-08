import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  NUMBERS,
  RADIUS,
  coordsToPoint,
  fieldAt,
  fieldCenter,
  fieldPath,
} from "../public/js/geometry.js";
import { toField } from "../src/viewer/game-state.ts";

/** Alle Wuerfe aus dem Mitschnitt (Koordinaten und Feld laut Autodarts), ohne Doppelte. */
function recordedThrows() {
  const seen = new Map();
  for (const line of readFileSync("test/fixtures/autodarts-2026-10-08.ndjson", "utf8").split("\n")) {
    if (!line.trim()) continue;
    const { frame } = JSON.parse(line);
    for (const turn of frame?.data?.turns ?? []) {
      for (const thrown of turn.throws ?? []) seen.set(thrown.id, thrown);
    }
  }
  return [...seen.values()];
}

/** Abstand eines Punktes zur naechsten Feldgrenze in mm. */
function boundaryDistance(point) {
  const r = Math.hypot(point.x, point.y);
  const radial = Math.min(...Object.values(RADIUS).map((b) => Math.abs(r - b)));
  if (r <= RADIUS.outerBull) return radial;
  const deg = ((Math.atan2(point.x, -point.y) * 180) / Math.PI + 360 + 9) % 18;
  const angular = (Math.min(deg, 18 - deg) * Math.PI / 180) * r;
  return Math.min(radial, angular);
}

describe("fieldAt", () => {
  test("trifft fuer jeden Wurf im Mitschnitt das Feld, das Autodarts gemeldet hat", () => {
    // Autodarts rundet seine Radien (Triple ab 97, Double ab 160 mm) - Wuerfe
    // naeher als 2 mm an einer Grenze koennen deshalb abweichen.
    const checked = recordedThrows().filter((t) => boundaryDistance(coordsToPoint(t.coords)) > 2);

    expect(checked.length).toBeGreaterThanOrEqual(30);
    for (const thrown of checked) {
      expect(fieldAt(coordsToPoint(thrown.coords)), thrown.segment.name).toEqual(toField(thrown.segment));
    }
  });

  test("kennt Bull, Single-Bull, die Ringe und daneben", () => {
    expect(fieldAt({ x: 0, y: 0 })).toEqual({ multiplier: 2, number: 25, ring: null });
    expect(fieldAt({ x: 10, y: 0 })).toEqual({ multiplier: 1, number: 25, ring: null });
    expect(fieldAt({ x: 0, y: -103 })).toEqual({ multiplier: 3, number: 20, ring: null });
    expect(fieldAt({ x: 0, y: -166 })).toEqual({ multiplier: 2, number: 20, ring: null });
    expect(fieldAt({ x: 0, y: -50 })).toEqual({ multiplier: 1, number: 20, ring: "inner" });
    expect(fieldAt({ x: 0, y: -130 })).toEqual({ multiplier: 1, number: 20, ring: "outer" });
    expect(fieldAt({ x: 0, y: 130 })).toEqual({ multiplier: 1, number: 3, ring: "outer" });
    expect(fieldAt({ x: 130, y: 0 })).toEqual({ multiplier: 1, number: 6, ring: "outer" });
    expect(fieldAt({ x: 0, y: -180 })).toEqual({ multiplier: 0, number: 0, ring: null });
  });
});

describe("coordsToPoint", () => {
  test("1 ist die Aussenkante des Double-Rings, y zeigt in Autodarts nach oben", () => {
    expect(coordsToPoint({ x: 1, y: 0 })).toEqual({ x: 170, y: -0 });
    expect(coordsToPoint({ x: 0, y: 1 })).toEqual({ x: 0, y: -170 });
  });
});

describe("fieldCenter", () => {
  test("liegt im jeweiligen Feld", () => {
    for (const number of NUMBERS) {
      for (const field of [
        { multiplier: 3, number, ring: null },
        { multiplier: 2, number, ring: null },
        { multiplier: 1, number, ring: "inner" },
        { multiplier: 1, number, ring: "outer" },
      ]) {
        expect(fieldAt(fieldCenter(field))).toEqual(field);
      }
    }
    expect(fieldAt(fieldCenter({ multiplier: 1, number: 25, ring: null }))).toEqual({
      multiplier: 1,
      number: 25,
      ring: null,
    });
  });

  test("Single ohne Teil liegt im aeusseren Teil, daneben hat keine Mitte", () => {
    expect(fieldAt(fieldCenter({ multiplier: 1, number: 7, ring: null }))).toMatchObject({ ring: "outer" });
    expect(fieldCenter({ multiplier: 0, number: 0, ring: null })).toBeNull();
  });
});

describe("fieldPath", () => {
  test("liefert Pfade fuer Felder und nichts fuer daneben", () => {
    expect(fieldPath({ multiplier: 3, number: 20, ring: null })).toMatch(/^M .* Z$/);
    expect(fieldPath({ multiplier: 2, number: 25, ring: null })).toMatch(/^M /);
    expect(fieldPath({ multiplier: 0, number: 0, ring: null })).toBe("");
  });

  test("Single ohne Teil besteht aus zwei Flaechen, mit Teil aus einer", () => {
    const count = (d) => d.split("M ").length - 1;
    expect(count(fieldPath({ multiplier: 1, number: 20, ring: null }))).toBe(2);
    expect(count(fieldPath({ multiplier: 1, number: 20, ring: "outer" }))).toBe(1);
  });

  test("das Triple 20 beginnt oben links auf dem aeusseren Triple-Draht", () => {
    const [x, y] = fieldPath({ multiplier: 3, number: 20, ring: null })
      .match(/^M (-?[\d.]+) (-?[\d.]+)/)
      .slice(1)
      .map(Number);
    expect(Math.hypot(x, y)).toBeCloseTo(107, 2);
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
  });
});
