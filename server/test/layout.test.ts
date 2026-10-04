import { describe, expect, test } from "vitest";
import { BLOCK_IDS, DEFAULT_LAYOUT, sanitizeLayout } from "../src/layout.js";

describe("sanitizeLayout", () => {
  test("liefert das Standard-Layout, wenn nichts gespeichert ist", () => {
    expect(sanitizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(sanitizeLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(sanitizeLayout("kaputt")).toEqual(DEFAULT_LAYOUT);
  });

  test("kennt genau die Bausteine der Anzeige", () => {
    expect(BLOCK_IDS).toEqual(["meta", "players", "checkout"]);
    expect(Object.keys(DEFAULT_LAYOUT)).toEqual(BLOCK_IDS);
  });

  test("uebernimmt gespeicherte Position und Groesse", () => {
    const layout = sanitizeLayout({ checkout: { x: 42, y: 17, scale: 1.8 } });

    expect(layout.checkout).toEqual({ x: 42, y: 17, scale: 1.8 });
  });

  test("ergaenzt fehlende Bausteine aus dem Standard", () => {
    const layout = sanitizeLayout({ checkout: { x: 42, y: 17, scale: 1.8 } });

    expect(layout.meta).toEqual(DEFAULT_LAYOUT.meta);
    expect(layout.players).toEqual(DEFAULT_LAYOUT.players);
  });

  test("haelt Bausteine im sichtbaren Bereich", () => {
    const layout = sanitizeLayout({
      meta: { x: -40, y: 250, scale: 1 },
      players: { x: 130, y: -12, scale: 1 },
    });

    expect(layout.meta.x).toBe(0);
    expect(layout.meta.y).toBe(95);
    expect(layout.players.x).toBe(95);
    expect(layout.players.y).toBe(0);
  });

  test("begrenzt die Skalierung auf einen brauchbaren Bereich", () => {
    expect(sanitizeLayout({ meta: { x: 5, y: 5, scale: 0.01 } }).meta.scale).toBe(0.2);
    expect(sanitizeLayout({ meta: { x: 5, y: 5, scale: 99 } }).meta.scale).toBe(4);
  });

  test("ignoriert unbekannte Bausteine und unbrauchbare Werte", () => {
    const layout = sanitizeLayout({
      unbekannt: { x: 10, y: 10, scale: 1 },
      meta: { x: "links", y: null, scale: "gross" },
    });

    expect(layout).not.toHaveProperty("unbekannt");
    expect(layout.meta).toEqual(DEFAULT_LAYOUT.meta);
  });
});
