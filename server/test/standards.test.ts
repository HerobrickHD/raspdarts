import { describe, expect, test } from "vitest";
import { MODES, sanitizeContent } from "../src/viewer/catalog.js";
import { DEFAULT_LAYOUT, sanitizeLayout } from "../src/viewer/layout.js";
import { standard, viewerCatalog } from "../src/viewer/standards.js";

describe("Standard", () => {
  test("ist schon gueltig (Pruefung aendert nichts)", () => {
    const { content, layout } = standard();
    expect(sanitizeContent(content)).toEqual(content);
    expect(sanitizeLayout(layout)).toEqual(layout);
  });

  test("wie die alte Vorlage Projektion, Scheibe in der Mitte, Bereiche wie die alten Karten", () => {
    const { content, layout } = standard();
    expect(content["hintergrund"]).toEqual({ on: true, darstellung: "schwarz", rahmen: false });
    expect(content["scheibe"]).toMatchObject({ on: true, darstellung: "light", zahlenring: false });
    expect(content["spielinfo"]?.on).toBe(false);
    expect(content["spieler"]?.on).toBe(true);
    expect(content["aufnahme"]?.on).toBe(true);
    expect(layout).toEqual(DEFAULT_LAYOUT);
  });

  test("enthaelt auch Optionen, die es nur in einigen Spielarten gibt", () => {
    expect(standard().content["spieler"]).toMatchObject({ checkout: true, average: true, legs: true });
  });

  test("liefert Kopien", () => {
    standard().layout.blocks.spielinfo.x = 99;
    expect(standard().layout.blocks.spielinfo.x).toBe(DEFAULT_LAYOUT.blocks.spielinfo.x);
  });

  test("Katalog fuer den Viewer: Bausteine, Spielarten, Gruppen", () => {
    const catalog = viewerCatalog();
    expect(catalog.modes).toEqual(MODES);
    expect(catalog.groups).toEqual({ spiele: "Spiele", training: "Training", party: "Party" });
    expect(catalog).not.toHaveProperty("standards");
    expect(catalog).not.toHaveProperty("templates");
  });
});

describe("Formate im Katalog", () => {
  test("ganzes Fenster und die drei festen Formate mit Beschriftung", () => {
    expect(viewerCatalog().formats).toEqual([
      { id: "fenster", label: "Ganzes Fenster" },
      { id: "16:9", label: "16:9" },
      { id: "16:10", label: "16:10" },
      { id: "4:3", label: "4:3" },
    ]);
  });
});
