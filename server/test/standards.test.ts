import { describe, expect, test } from "vitest";
import { MODES, sanitizeModeContent, sanitizeShared } from "../src/viewer/catalog.js";
import { DEFAULT_MODE_LAYOUT, sanitizeModeLayout } from "../src/viewer/layout.js";
import { STANDARDS, sharedStandard, standardFor, viewerCatalog } from "../src/viewer/standards.js";

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

  test("zu Beginn: Spielinfo aus, sonst alles an, Bereiche wie die alten Karten", () => {
    const x01 = standardFor("x01");
    expect(x01.content["spielinfo"]?.on).toBe(false);
    expect(x01.content["spieler"]?.on).toBe(true);
    expect(x01.content["aufnahme"]?.on).toBe(true);
    expect(x01.layout).toEqual(DEFAULT_MODE_LAYOUT);
  });

  test("gemeinsamer Standard wie die alte Vorlage Projektion", () => {
    expect(sharedStandard()).toEqual(
      sanitizeShared({ hintergrund: { on: false }, scheibe: { darstellung: "light", zahlenring: false } }),
    );
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
    expect(catalog.shared).toEqual(sharedStandard());
    expect(catalog.groups).toEqual({ spiele: "Spiele", training: "Training", party: "Party" });
    expect(catalog).not.toHaveProperty("templates");
  });
});
