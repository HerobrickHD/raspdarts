import { describe, expect, test } from "vitest";
import { DEFAULT_BOARD } from "../src/viewer/layout.js";
import {
  FALLBACK_NAME,
  VALID_ID,
  newProfile,
  sanitizeName,
  sanitizeProfile,
  slugify,
  uniqueId,
} from "../src/viewer/profile.js";
import { standard } from "../src/viewer/standards.js";

describe("sanitizeName", () => {
  test.each([
    ["  Beamer  ", "Beamer"],
    ["", "Profil"],
    ["   ", "Profil"],
    [42, "Profil"],
    [null, "Profil"],
  ])("%j → %s", (raw, name) => {
    expect(sanitizeName(raw)).toBe(name);
  });

  test("kuerzt lange Namen auf 40 Zeichen", () => {
    expect(sanitizeName("x".repeat(60))).toBe("x".repeat(40));
  });
});

describe("newProfile", () => {
  test("Version 8: Name, Format, Inhalte und Layout aus dem Standard", () => {
    expect(newProfile("Wohnzimmer", "4:3")).toEqual({ version: 8, name: "Wohnzimmer", format: "4:3", ...standard() });
  });

  test("ohne Format ganzes Fenster, ohne Namen Profil", () => {
    expect(newProfile("").format).toBe("fenster");
    expect(newProfile("").name).toBe(FALLBACK_NAME);
  });
});

describe("sanitizeProfile", () => {
  test("Version 8: prueft Format, Inhalte und Layout; Fehlendes aus dem Standard", () => {
    const profile = sanitizeProfile({
      version: 8,
      name: " Beamer ",
      format: "16:10",
      content: { aufnahme: { on: false }, spieler: { average: false }, disco: { on: true } },
      layout: { board: { cx: 300 } },
    });
    expect(profile.name).toBe("Beamer");
    expect(profile.format).toBe("16:10");
    expect(profile.content["aufnahme"]?.on).toBe(false);
    expect(profile.content["spieler"]?.["average"]).toBe(false);
    expect(profile.content).not.toHaveProperty("disco");
    // Nicht gespeichert: wie im Standard (ohne Zahlenring, Spielinfo aus)
    expect(profile.content["scheibe"]?.["zahlenring"]).toBe(false);
    expect(profile.content["spielinfo"]?.on).toBe(false);
    expect(profile.layout.board).toEqual({ ...DEFAULT_BOARD, cx: 100 });
    expect(profile.layout.blocks).toEqual(standard().layout.blocks);
  });

  test("Version 8 ohne oder mit unbekanntem Format: ganzes Fenster", () => {
    expect(sanitizeProfile({ version: 8, name: "P" }).format).toBe("fenster");
    expect(sanitizeProfile({ version: 8, name: "P", format: "21:9" }).format).toBe("fenster");
  });

  test("Version 8 behaelt Bereiche, wie sie sind - auch breite", () => {
    const area = { x: 3, y: 40, w: 60, h: 20 };
    const profile = sanitizeProfile({ version: 8, name: "P", layout: { blocks: { "bereich-links": area } } });
    expect(profile.layout.blocks["bereich-links"]).toEqual(area);
  });

  test("fruehere Versionen (je Spielart): Name und Format bleiben, sonst Standard", () => {
    const v7 = {
      version: 7,
      name: "Beamer",
      format: "4:3",
      spielarten: { x01: { content: { aufnahme: { on: false } }, layout: { board: { cx: 10 } } } },
    };
    expect(sanitizeProfile(v7)).toEqual(newProfile("Beamer", "4:3"));
    expect(sanitizeProfile({ version: 1, name: "Alt" })).toEqual(newProfile("Alt"));
    expect(sanitizeProfile(null)).toEqual(newProfile("Profil"));
  });
});

describe("slugify", () => {
  test.each([
    ["Beamer auf Scheibe", "beamer-auf-scheibe"],
    ["Fernseher Küche", "fernseher-kueche"],
    ["Größe ÄÖÜ", "groesse-aeoeue"],
    ["  --TV--  ", "tv"],
    ["!!!", "profil"],
    ["", "profil"],
  ])("%s → %s", (name, id) => {
    expect(slugify(name)).toBe(id);
  });

  test("bleibt kurz genug fuer das id-Muster", () => {
    const id = slugify("Ein sehr langer Profilname mit vielen Woertern darin");
    expect(id.length).toBeLessThanOrEqual(32);
    expect(VALID_ID.test(id)).toBe(true);
  });
});

describe("uniqueId", () => {
  test("haengt bei Doppelung -2, -3 an", () => {
    const taken = new Set(["tv", "tv-2"]);
    expect(uniqueId("TV", (id) => taken.has(id))).toBe("tv-3");
    expect(uniqueId("Neu", (id) => taken.has(id))).toBe("neu");
  });

  test("auch lange Namen mit Zaehler passen ins Muster", () => {
    const long = "a".repeat(40);
    const id = uniqueId(long, (candidate) => candidate === slugify(long));
    expect(id).toBe(`${"a".repeat(30)}-2`);
    expect(VALID_ID.test(id)).toBe(true);
  });
});
