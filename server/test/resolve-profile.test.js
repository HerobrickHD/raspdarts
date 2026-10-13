import { describe, expect, test } from "vitest";
import { resolveProfile, withBoard, withContent, withFormat, withModeBlocks } from "../public/js/resolve-profile.js";
import { newProfile } from "../src/viewer/profile.ts";
import { viewerCatalog } from "../src/viewer/standards.ts";

const catalog = viewerCatalog();
const BOARD = { cx: 40, cy: 30, diameter: 14, rotation: -103 };

describe("resolveProfile", () => {
  test("Spielart im Standard: gemeinsam + Standard, nicht angepasst", () => {
    const profile = newProfile("P", BOARD);
    const resolved = resolveProfile(profile, catalog, "cricket");
    expect(resolved.angepasst).toBe(false);
    expect(resolved.layout.board).toEqual(BOARD);
    expect(resolved.layout.blocks).toEqual(catalog.standards.cricket.layout.blocks);
    expect(resolved.content.scheibe).toEqual(profile.gemeinsam.content.scheibe);
    expect(resolved.content.spieler).toEqual(catalog.standards.cricket.content.spieler);
  });

  test("angepasste Spielart gewinnt", () => {
    const profile = newProfile("P", BOARD);
    profile.spielarten.x01 = structuredClone(catalog.standards.x01);
    profile.spielarten.x01.content.aufnahme.on = false;
    const resolved = resolveProfile(profile, catalog, "x01");
    expect(resolved.angepasst).toBe(true);
    expect(resolved.content.aufnahme.on).toBe(false);
  });

  test("unbekannte Spielart (null) nutzt den X01-Teil", () => {
    const profile = newProfile("P", BOARD);
    profile.spielarten.x01 = structuredClone(catalog.standards.x01);
    profile.spielarten.x01.layout.blocks.aufnahme.x = 11;
    expect(resolveProfile(profile, catalog, null).layout.blocks.aufnahme.x).toBe(11);
  });
});

describe("lokale Aenderungen", () => {
  test("withBoard aendert nur die Scheibe, keine Spielart wird angepasst", () => {
    const profile = withBoard(newProfile("P"), BOARD);
    expect(profile.gemeinsam.board).toEqual(BOARD);
    expect(profile.spielarten).toEqual({});
  });

  test("withModeBlocks legt die Spielart aus dem Standard an", () => {
    const blocks = { ...catalog.standards.gotcha.layout.blocks, aufnahme: { x: 1, y: 2, scale: 3 } };
    const profile = withModeBlocks(newProfile("P"), catalog, "gotcha", blocks);
    expect(profile.spielarten.gotcha.layout.blocks.aufnahme).toEqual({ x: 1, y: 2, scale: 3 });
    expect(profile.spielarten.gotcha.content).toEqual(catalog.standards.gotcha.content);
  });

  test("withContent teilt nach gemeinsam und Spielart auf", () => {
    const base = newProfile("P");
    const resolved = resolveProfile(base, catalog, "x01");

    const shared = withContent(base, catalog, "x01", { ...resolved.content, hintergrund: { on: true } });
    expect(shared.gemeinsam.content.hintergrund.on).toBe(true);
    expect(shared.spielarten).toEqual({});

    const own = withContent(base, catalog, "x01", {
      ...resolved.content,
      aufnahme: { ...resolved.content.aufnahme, on: false },
    });
    expect(own.spielarten.x01.content.aufnahme.on).toBe(false);
    expect(own.spielarten.x01.content).not.toHaveProperty("scheibe");
    expect(own.gemeinsam).toEqual(base.gemeinsam);
  });
});

describe("withFormat", () => {
  test("aendert nur das Format, keine Spielart wird angepasst", () => {
    const base = newProfile("P", BOARD);
    const profile = withFormat(base, "4:3");
    expect(profile.gemeinsam).toEqual({ ...base.gemeinsam, format: "4:3" });
    expect(profile.spielarten).toEqual({});
  });
});
