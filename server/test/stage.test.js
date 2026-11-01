import { describe, expect, test } from "vitest";
import { fitStage, placeReserve } from "../public/js/stage.js";

const WIN = { width: 1600, height: 900 };

describe("fitStage", () => {
  test("ganzes Fenster ohne Leiste: die Buehne ist das Fenster", () => {
    expect(fitStage(WIN, "fenster")).toEqual({ left: 0, top: 0, width: 1600, height: 900 });
  });

  test("festes Format: so gross wie moeglich, mittig", () => {
    expect(fitStage(WIN, "4:3")).toEqual({ left: 200, top: 0, width: 1200, height: 900 });
    expect(fitStage({ width: 1000, height: 1000 }, "16:9")).toEqual({ left: 0, top: 218.75, width: 1000, height: 562.5 });
  });

  test("Leiste rechts offen: Buehne rueckt in den freien Platz, Form bleibt", () => {
    const stage = fitStage(WIN, "16:9", { right: 400, bottom: 0 });
    expect(stage.width).toBe(1200);
    expect(stage.height).toBe(675);
    expect(stage.left).toBe(0);
    expect(stage.top).toBe(112.5);
  });

  test("ganzes Fenster mit Leiste: Form des Fensters bleibt, nur kleiner", () => {
    const stage = fitStage(WIN, "fenster", { right: 400, bottom: 0 });
    expect(stage.width / stage.height).toBeCloseTo(1600 / 900);
    expect(stage.left + stage.width).toBeLessThanOrEqual(1200);
  });

  test("Werkzeugleiste unten: Buehne endet darueber", () => {
    const stage = fitStage(WIN, "16:9", { right: 0, bottom: 100 });
    expect(stage.top + stage.height).toBeLessThanOrEqual(800);
    expect(stage.width / stage.height).toBeCloseTo(16 / 9);
  });

  test("winziges Fenster: nie negativ", () => {
    const stage = fitStage({ width: 300, height: 200 }, "4:3", { right: 380, bottom: 0 });
    expect(stage.width).toBeGreaterThan(0);
    expect(stage.height).toBeGreaterThan(0);
  });
});

describe("placeReserve", () => {
  const panel = { panelLeft: 1500, panelWidth: 420, windowWidth: 1920 };

  test("offene Leiste haelt rechts Platz frei", () => {
    expect(placeReserve({ ...panel, editing: true, aligning: false })).toEqual({ right: 420, bottom: 0 });
  });

  test("waehrend des Pruefbilds die ganze Buehne - dieses Geraet koennte der Beamer sein", () => {
    expect(placeReserve({ ...panel, editing: true, aligning: true })).toEqual({ right: 0, bottom: 0 });
  });

  test("ohne Leiste kein Platz", () => {
    expect(placeReserve({ ...panel, editing: false, aligning: false })).toEqual({ right: 0, bottom: 0 });
  });
});
