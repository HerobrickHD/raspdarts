import { describe, expect, test } from "vitest";
import { BLOCK_IDS, DEFAULT_LAYOUT, sanitizeLayout } from "../src/viewer/layout.js";

const v2 = (extra: Record<string, unknown>) => ({ version: 2, ...extra });

describe("sanitizeLayout", () => {
  test("liefert das Standard-Layout, wenn nichts Brauchbares gespeichert ist", () => {
    expect(sanitizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(sanitizeLayout("kaputt")).toEqual(DEFAULT_LAYOUT);
  });

  test("verwirft alte Beamer-Layouts ohne version 2 komplett", () => {
    const old = { meta: { x: 1, y: 1, scale: 1 }, players: { x: 2, y: 2, scale: 1 } };
    expect(sanitizeLayout(old)).toEqual(DEFAULT_LAYOUT);
  });

  test("kennt genau die Bloecke des Viewers", () => {
    expect(BLOCK_IDS).toEqual([
      "kopf",
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

  test("Standard: Nur Licht, Scheibe in der Mitte", () => {
    expect(DEFAULT_LAYOUT.boardMode).toBe("light");
    expect(DEFAULT_LAYOUT.board).toEqual({ cx: 50, cy: 51, diameter: 50, rotation: 0 });
  });

  test("uebernimmt gespeicherte Werte", () => {
    const layout = sanitizeLayout(
      v2({
        boardMode: "drawn",
        board: { cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 },
        blocks: { aufnahme: { x: 30, y: 2, scale: 1.4 } },
      }),
    );

    expect(layout.boardMode).toBe("drawn");
    expect(layout.board).toEqual({ cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 });
    expect(layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(layout.blocks.kopf).toEqual(DEFAULT_LAYOUT.blocks.kopf);
  });

  test("begrenzt jeden Wert der Scheibe einzeln", () => {
    const layout = sanitizeLayout(
      v2({ board: { cx: -5, cy: 140, diameter: 900, rotation: 270 } }),
    );

    expect(layout.board).toEqual({ cx: 0, cy: 100, diameter: 400, rotation: 180 });
    expect(sanitizeLayout(v2({ board: { diameter: 1, rotation: -999 } })).board).toMatchObject({
      diameter: 5,
      rotation: -180,
    });
  });

  test("ersetzt unbrauchbare Werte der Scheibe einzeln durch den Standard", () => {
    const layout = sanitizeLayout(v2({ board: { cx: "mitte", cy: 40, diameter: null } }));

    expect(layout.board).toEqual({ cx: 50, cy: 40, diameter: 50, rotation: 0 });
  });

  test("haelt Bloecke im Bild und begrenzt die Skalierung", () => {
    const layout = sanitizeLayout(
      v2({ blocks: { kopf: { x: -40, y: 250, scale: 0.01 }, "spieler-1": { x: 5, y: 5, scale: 99 } } }),
    );

    expect(layout.blocks.kopf).toEqual({ x: 0, y: 100, scale: 0.2 });
    expect(layout.blocks["spieler-1"].scale).toBe(4);
  });

  test("ignoriert unbekannte Bloecke und unbrauchbare Bloecke", () => {
    const layout = sanitizeLayout(
      v2({ boardMode: "disco", blocks: { unbekannt: { x: 1, y: 1, scale: 1 }, kopf: { x: "links" } } }),
    );

    expect(layout.boardMode).toBe("light");
    expect(layout.blocks).not.toHaveProperty("unbekannt");
    expect(layout.blocks.kopf).toEqual(DEFAULT_LAYOUT.blocks.kopf);
  });

  test("liefert jedes Mal eine eigene Kopie", () => {
    const a = sanitizeLayout(null);
    a.board.cx = 1;
    expect(sanitizeLayout(null).board.cx).toBe(50);
    expect(DEFAULT_LAYOUT.board.cx).toBe(50);
  });
});
