import { describe, expect, test } from "vitest";
import { BLOCK_IDS, DEFAULT_LAYOUT, fromLegacyLayout, sanitizeLayout } from "../src/viewer/layout.js";

describe("sanitizeLayout", () => {
  test("liefert das Standard-Layout, wenn nichts Brauchbares da ist", () => {
    expect(sanitizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(sanitizeLayout("kaputt")).toEqual(DEFAULT_LAYOUT);
  });

  test("kennt genau die Bloecke des Viewers", () => {
    expect(BLOCK_IDS).toEqual([
      "spielinfo",
      "aufnahme",
      "spieler-1",
      "spieler-2",
      "spieler-3",
      "spieler-4",
      "spieler-5",
      "spieler-6",
    ]);
    expect(Object.keys(DEFAULT_LAYOUT.blocks)).toEqual(BLOCK_IDS);
  });

  test("Standard: Scheibe in der Mitte, Darstellung steht nicht mehr im Layout", () => {
    expect(DEFAULT_LAYOUT.board).toEqual({ cx: 50, cy: 51, diameter: 50, rotation: 0 });
    expect(DEFAULT_LAYOUT).not.toHaveProperty("boardMode");
    expect(DEFAULT_LAYOUT).not.toHaveProperty("version");
  });

  test("uebernimmt gespeicherte Werte", () => {
    const layout = sanitizeLayout({
      board: { cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 },
      blocks: { aufnahme: { x: 30, y: 2, scale: 1.4 } },
    });

    expect(layout.board).toEqual({ cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 });
    expect(layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(layout.blocks.spielinfo).toEqual(DEFAULT_LAYOUT.blocks.spielinfo);
  });

  test("begrenzt jeden Wert der Scheibe einzeln", () => {
    expect(sanitizeLayout({ board: { cx: -5, cy: 140, diameter: 900, rotation: 270 } }).board).toEqual({
      cx: 0,
      cy: 100,
      diameter: 400,
      rotation: 180,
    });
    expect(sanitizeLayout({ board: { diameter: 1, rotation: -999 } }).board).toMatchObject({
      diameter: 5,
      rotation: -180,
    });
  });

  test("ersetzt unbrauchbare Werte der Scheibe einzeln durch den Standard", () => {
    const layout = sanitizeLayout({ board: { cx: "mitte", cy: 40, diameter: null } });

    expect(layout.board).toEqual({ cx: 50, cy: 40, diameter: 50, rotation: 0 });
  });

  test("haelt Bloecke im Bild und begrenzt die Skalierung", () => {
    const layout = sanitizeLayout({
      blocks: { spielinfo: { x: -40, y: 250, scale: 0.01 }, "spieler-1": { x: 5, y: 5, scale: 99 } },
    });

    expect(layout.blocks.spielinfo).toEqual({ x: 0, y: 100, scale: 0.2 });
    expect(layout.blocks["spieler-1"].scale).toBe(4);
  });

  test("ignoriert unbekannte und unbrauchbare Bloecke", () => {
    const layout = sanitizeLayout({ blocks: { unbekannt: { x: 1, y: 1, scale: 1 }, spielinfo: { x: "links" } } });

    expect(layout.blocks).not.toHaveProperty("unbekannt");
    expect(layout.blocks.spielinfo).toEqual(DEFAULT_LAYOUT.blocks.spielinfo);
  });

  test("liefert jedes Mal eine eigene Kopie", () => {
    const a = sanitizeLayout(null);
    a.board.cx = 1;
    expect(sanitizeLayout(null).board.cx).toBe(50);
    expect(DEFAULT_LAYOUT.board.cx).toBe(50);
  });
});

describe("fromLegacyLayout", () => {
  test("liest alte Dateien mit version 2: kopf wird spielinfo, boardMode kommt mit", () => {
    const legacy = fromLegacyLayout({
      version: 2,
      boardMode: "drawn",
      board: { cx: 40, cy: 45, diameter: 80, rotation: 1.5 },
      blocks: { kopf: { x: 5, y: 6, scale: 1.2 }, aufnahme: { x: 30, y: 2, scale: 1.4 } },
    });

    expect(legacy?.boardMode).toBe("drawn");
    expect(legacy?.layout.board).toEqual({ cx: 40, cy: 45, diameter: 80, rotation: 1.5 });
    expect(legacy?.layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(legacy?.layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(legacy?.layout).not.toHaveProperty("boardMode");
    expect(legacy?.layout.blocks).not.toHaveProperty("kopf");
  });

  test("ohne oder mit unbekanntem boardMode gilt Nur Licht", () => {
    expect(fromLegacyLayout({ version: 2 })?.boardMode).toBe("light");
    expect(fromLegacyLayout({ version: 2, boardMode: "disco" })?.boardMode).toBe("light");
  });

  test("alles ohne version 2 ist kein altes Layout", () => {
    expect(fromLegacyLayout(null)).toBeNull();
    expect(fromLegacyLayout({})).toBeNull();
    expect(fromLegacyLayout({ version: 1, board: {} })).toBeNull();
  });
});
