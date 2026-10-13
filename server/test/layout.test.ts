import { describe, expect, test } from "vitest";
import {
  CARD,
  DEFAULT_BOARD,
  DEFAULT_MODE_LAYOUT,
  fromLegacyLayout,
  sanitizeBoard,
  sanitizeModeLayout,
  splitLegacyLayout,
} from "../src/viewer/layout.js";

describe("sanitizeBoard", () => {
  test("Standard ohne Brauchbares, sonst begrenzt je Wert", () => {
    expect(sanitizeBoard(null)).toEqual(DEFAULT_BOARD);
    expect(sanitizeBoard({ cx: 120, cy: -5, diameter: 1000, rotation: 200 })).toEqual({
      cx: 100,
      cy: 0,
      diameter: 400,
      rotation: 180,
    });
  });

  test("ersetzt Unbrauchbares einzeln aus fallback", () => {
    const fallback = { cx: 40, cy: 30, diameter: 14, rotation: -103 };
    expect(sanitizeBoard({ cx: 41, cy: "x" }, fallback)).toEqual({ cx: 41, cy: 30, diameter: 14, rotation: -103 });
  });
});

describe("sanitizeModeLayout", () => {
  test("Standard: Spielinfo, Aufnahme und zwei Bereiche wie die alten Karten 1 und 2", () => {
    expect(sanitizeModeLayout(null)).toEqual(DEFAULT_MODE_LAYOUT);
    expect(DEFAULT_MODE_LAYOUT.blocks["bereich-links"]).toEqual({ x: 1.4, y: 32.7, w: 49, h: 34 });
    expect(DEFAULT_MODE_LAYOUT.blocks["bereich-rechts"]).toEqual({ x: 71, y: 32.7, w: 49, h: 34 });
  });

  test("begrenzt Bereiche: Position 0-100, Breite 5-300, Hoehe 5-100", () => {
    const layout = sanitizeModeLayout({
      blocks: { "bereich-links": { x: -3, y: 140, w: 1, h: 500 } },
    });
    expect(layout.blocks["bereich-links"]).toEqual({ x: 0, y: 100, w: 5, h: 100 });
  });

  test("unbrauchbarer Block kommt aus fallback, unbekannte fallen weg", () => {
    const fallback = structuredClone(DEFAULT_MODE_LAYOUT);
    fallback.blocks.aufnahme = { x: 9, y: 9, scale: 2 };
    const layout = sanitizeModeLayout(
      { blocks: { aufnahme: { x: "a" }, "spieler-3": { x: 1, y: 1, scale: 1 } } },
      fallback,
    );
    expect(layout.blocks.aufnahme).toEqual({ x: 9, y: 9, scale: 2 });
    expect(layout.blocks).not.toHaveProperty("spieler-3");
  });

  test("liefert jedes Mal eine eigene Kopie", () => {
    const a = sanitizeModeLayout(null);
    a.blocks.spielinfo.x = 77;
    expect(sanitizeModeLayout(null).blocks.spielinfo.x).toBe(DEFAULT_MODE_LAYOUT.blocks.spielinfo.x);
  });
});

describe("splitLegacyLayout (Layout aus Profil-Version 3)", () => {
  test("Scheibe getrennt, Karte 1/2 werden Bereiche in Kartengroesse, 3-6 fallen weg", () => {
    const { board, layout } = splitLegacyLayout({
      board: { cx: 42.8987, cy: 28.7953, diameter: 14.04, rotation: -103.05 },
      blocks: {
        spielinfo: { x: 5, y: 6, scale: 1.2 },
        aufnahme: { x: 30, y: 2, scale: 1.4 },
        "spieler-1": { x: 1, y: 30, scale: 0.8 },
        "spieler-2": { x: 70, y: 31, scale: 1.1 },
        "spieler-3": { x: 1, y: 68, scale: 0.45 },
      },
    });
    expect(board).toEqual({ cx: 42.8987, cy: 28.7953, diameter: 14.04, rotation: -103.05 });
    expect(layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(layout.blocks["bereich-links"]).toEqual({ x: 1, y: 30, w: CARD.w * 0.8, h: CARD.h * 0.8 });
    expect(layout.blocks["bereich-rechts"]).toEqual({ x: 70, y: 31, w: CARD.w * 1.1, h: CARD.h * 1.1 });
    expect(Object.keys(layout.blocks).sort()).toEqual(["aufnahme", "bereich-links", "bereich-rechts", "spielinfo"]);
  });

  test("ohne Karten gelten die Standardbereiche", () => {
    expect(splitLegacyLayout({}).layout).toEqual(DEFAULT_MODE_LAYOUT);
  });
});

describe("fromLegacyLayout (version 2)", () => {
  test("kopf wird spielinfo, boardMode kommt mit, Karten werden Bereiche", () => {
    const legacy = fromLegacyLayout({
      version: 2,
      boardMode: "drawn",
      board: { cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 },
      blocks: { kopf: { x: 5, y: 6, scale: 1.2 }, "spieler-1": { x: 2, y: 3, scale: 1 } },
    });
    expect(legacy?.boardMode).toBe("drawn");
    expect(legacy?.board).toEqual({ cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 });
    expect(legacy?.layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(legacy?.layout.blocks["bereich-links"]).toEqual({ x: 2, y: 3, w: 49, h: 34 });
  });

  test("ohne oder mit unbekanntem boardMode gilt Nur Licht", () => {
    expect(fromLegacyLayout({ version: 2 })?.boardMode).toBe("light");
    expect(fromLegacyLayout({ version: 2, boardMode: "disco" })?.boardMode).toBe("light");
  });

  test("alles ohne version 2 ist kein altes Layout", () => {
    expect(fromLegacyLayout({ version: 3 })).toBeNull();
    expect(fromLegacyLayout(null)).toBeNull();
  });
});
