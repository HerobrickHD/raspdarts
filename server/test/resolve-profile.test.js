import { describe, expect, test } from "vitest";
import { resolveProfile, withContent, withFormat, withModeLayout } from "../public/js/resolve-profile.js";
import { newProfile } from "../src/viewer/profile.ts";
import { viewerCatalog } from "../src/viewer/standards.ts";

const catalog = viewerCatalog();
const BOARD = { cx: 40, cy: 30, diameter: 14, rotation: -103 };

describe("resolveProfile", () => {
  test("Spielart im Standard: Inhalte und Layout (samt Scheibe) aus dem Standard, nicht angepasst", () => {
    const resolved = resolveProfile(newProfile("P"), catalog, "cricket");
    expect(resolved.angepasst).toBe(false);
    expect(resolved.layout).toEqual(catalog.standards.cricket.layout);
    expect(resolved.content).toEqual(catalog.standards.cricket.content);
  });

  test("angepasste Spielart gewinnt, auch bei der Scheibe", () => {
    const profile = newProfile("P");
    profile.spielarten.x01 = structuredClone(catalog.standards.x01);
    profile.spielarten.x01.content.aufnahme.on = false;
    profile.spielarten.x01.layout.board = BOARD;
    const resolved = resolveProfile(profile, catalog, "x01");
    expect(resolved.angepasst).toBe(true);
    expect(resolved.content.aufnahme.on).toBe(false);
    expect(resolved.layout.board).toEqual(BOARD);
    expect(resolveProfile(profile, catalog, "cricket").layout.board).toEqual(catalog.standards.cricket.layout.board);
  });

  test("unbekannte Spielart (null) nutzt den X01-Teil", () => {
    const profile = newProfile("P");
    profile.spielarten.x01 = structuredClone(catalog.standards.x01);
    profile.spielarten.x01.layout.blocks.aufnahme.x = 11;
    expect(resolveProfile(profile, catalog, null).layout.blocks.aufnahme.x).toBe(11);
  });
});

describe("lokale Aenderungen", () => {
  test("withModeLayout legt die Spielart aus dem Standard an, Inhalte bleiben", () => {
    const layout = { ...catalog.standards.gotcha.layout, board: BOARD };
    const profile = withModeLayout(newProfile("P"), catalog, "gotcha", layout);
    expect(profile.spielarten.gotcha.layout).toEqual(layout);
    expect(profile.spielarten.gotcha.content).toEqual(catalog.standards.gotcha.content);
  });

  test("withContent legt die Spielart an, Layout bleibt; unveraendert gibt dasselbe Profil", () => {
    const base = newProfile("P");
    const resolved = resolveProfile(base, catalog, "x01");
    expect(withContent(base, catalog, "x01", structuredClone(resolved.content))).toBe(base);

    const changed = withContent(base, catalog, "x01", {
      ...resolved.content,
      hintergrund: { ...resolved.content.hintergrund, rahmen: true },
    });
    expect(changed.spielarten.x01.content.hintergrund.rahmen).toBe(true);
    expect(changed.spielarten.x01.layout).toEqual(catalog.standards.x01.layout);
  });

  test("withFormat aendert nur das Format, keine Spielart wird angepasst", () => {
    const profile = withFormat(newProfile("P"), "4:3");
    expect(profile.format).toBe("4:3");
    expect(profile.spielarten).toEqual({});
  });
});
