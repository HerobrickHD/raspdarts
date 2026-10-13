import { describe, expect, test } from "vitest";
import { MODES, sanitizeModeContent } from "../src/viewer/catalog.js";
import { DEFAULT_MODE_LAYOUT, sanitizeModeLayout } from "../src/viewer/layout.js";
import { STANDARDS, standardFor, viewerCatalog } from "../src/viewer/standards.js";

describe("Standards", () => {
  test("jede Spielart hat genau einen Standard", () => {
    expect(STANDARDS.map((s) => s.mode)).toEqual(MODES.map((m) => m.id));
  });

  test("jeder Standard ist schon gueltig (Pruefung aendert nichts)", () => {
    for (const { id } of MODES) {
      const standard = standardFor(id);
      expect(sanitizeModeContent(standard.content, id), id).toEqual(standard.content);
      expect(sanitizeModeLayout(standard.layout), id).toEqual(standard.layout);
    }
  });

  test("zu Beginn: wie die alte Vorlage Projektion, Scheibe in der Mitte, Bereiche wie die alten Karten", () => {
    const x01 = standardFor("x01");
    expect(x01.content["hintergrund"]?.on).toBe(false);
    expect(x01.content["rahmen"]?.on).toBe(false);
    expect(x01.content["scheibe"]).toMatchObject({ on: true, darstellung: "light", zahlenring: false });
    expect(x01.content["spielinfo"]?.on).toBe(false);
    expect(x01.content["spieler"]?.on).toBe(true);
    expect(x01.content["aufnahme"]?.on).toBe(true);
    expect(x01.layout).toEqual(DEFAULT_MODE_LAYOUT);
  });

  test("standardFor liefert Kopien", () => {
    standardFor("x01").layout.blocks.spielinfo.x = 99;
    expect(standardFor("x01").layout.blocks.spielinfo.x).toBe(DEFAULT_MODE_LAYOUT.blocks.spielinfo.x);
  });

  test("Katalog fuer den Viewer: Bausteine, Spielarten, Gruppen, alle Standards", () => {
    const catalog = viewerCatalog();
    expect(catalog.modes).toEqual(MODES);
    expect(Object.keys(catalog.standards)).toEqual(MODES.map((m) => m.id));
    expect(catalog.standards["cricket"]).toEqual(standardFor("cricket"));
    expect(catalog).not.toHaveProperty("shared");
    expect(catalog.groups).toEqual({ spiele: "Spiele", training: "Training", party: "Party" });
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
