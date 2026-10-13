import { describe, expect, test } from "vitest";
import { modeDefaults } from "../src/viewer/catalog.js";
import { CARD, DEFAULT_BOARD } from "../src/viewer/layout.js";
import {
  FALLBACK_NAME,
  VALID_ID,
  newProfile,
  sanitizeModeEntry,
  sanitizeName,
  sanitizeProfile,
  slugify,
  uniqueId,
} from "../src/viewer/profile.js";
import { sharedStandard, standardFor } from "../src/viewer/standards.js";

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
  test("gemeinsamer Standard, keine angepassten Spielarten, Scheibe wie mitgegeben", () => {
    const board = { cx: 40, cy: 30, diameter: 14, rotation: -103 };
    expect(newProfile("Wohnzimmer", board)).toEqual({
      version: 4,
      name: "Wohnzimmer",
      gemeinsam: { content: sharedStandard(), board },
      spielarten: {},
    });
  });

  test("ohne Scheibe gilt die Standardlage", () => {
    expect(newProfile("").gemeinsam.board).toEqual(DEFAULT_BOARD);
    expect(newProfile("").name).toBe(FALLBACK_NAME);
  });
});

describe("sanitizeModeEntry", () => {
  test("ergaenzt aus dem Standard der Spielart und wirft Fremdes weg", () => {
    const entry = sanitizeModeEntry({ content: { spieler: { average: false, name: false } } }, "gotcha");
    expect(entry.content["spieler"]).not.toHaveProperty("average");
    expect(entry.content["spieler"]?.["name"]).toBe(false);
    expect(entry.content["spielinfo"]).toEqual(standardFor("gotcha").content["spielinfo"]);
    expect(entry.layout).toEqual(standardFor("gotcha").layout);
  });

  test("Inhalte einer Spielart nutzen modeDefaults nur, wo der Standard nichts sagt", () => {
    const entry = sanitizeModeEntry({}, "x01");
    expect(entry.content["aufnahme"]).toEqual(modeDefaults("x01")["aufnahme"]);
  });
});

describe("sanitizeProfile", () => {
  test("Version 4: prueft gemeinsam und jede Spielart, unbekannte Spielarten fallen weg", () => {
    const profile = sanitizeProfile({
      version: 4,
      name: " Beamer ",
      gemeinsam: { content: { scheibe: { darstellung: "drawn" } }, board: { cx: 300 } },
      spielarten: { cricket: { content: {}, layout: {} }, killer: { content: {} }, x01: "kaputt" },
    });
    expect(profile.name).toBe("Beamer");
    expect(profile.gemeinsam.content["scheibe"]?.["darstellung"]).toBe("drawn");
    expect(profile.gemeinsam.board).toEqual({ ...DEFAULT_BOARD, cx: 100 });
    expect(Object.keys(profile.spielarten)).toEqual(["cricket"]);
    expect(profile.spielarten["cricket"]).toEqual(standardFor("cricket"));
  });

  test("Version 3 wird umgebaut: Scheibe gemeinsam, Rest wird angepasstes X01, Karten 1/2 werden Bereiche", () => {
    const v3 = {
      version: 3,
      name: "Standard",
      content: {
        hintergrund: { on: false },
        scheibe: { on: true, darstellung: "light", zahlenring: false, darts: true, letzterDart: true },
        aufnahme: { on: true, darts: true, summe: false },
        spielinfo: { on: false, punktzahl: true, legs: true, modus: true },
        spieler: {
          on: true,
          flaeche: false,
          profilbild: true,
          name: true,
          flagge: true,
          rest: true,
          legs: true,
          checkout: true,
          average: false,
          dartzahl: true,
        },
      },
      layout: {
        board: { cx: 42.8987, cy: 28.7953, diameter: 14.04, rotation: -103.05 },
        blocks: {
          spielinfo: { x: 2, y: 3, scale: 1 },
          aufnahme: { x: 33, y: 4, scale: 0.9 },
          "spieler-1": { x: 1.4, y: 32.7, scale: 0.7 },
          "spieler-2": { x: 71, y: 32.7, scale: 0.7 },
        },
      },
    };
    const profile = sanitizeProfile(v3);

    expect(profile.version).toBe(4);
    expect(profile.gemeinsam.board).toEqual(v3.layout.board);
    expect(profile.gemeinsam.content["scheibe"]).toEqual(v3.content.scheibe);
    expect(Object.keys(profile.spielarten)).toEqual(["x01"]);
    const x01 = profile.spielarten["x01"]!;
    expect(x01.content["aufnahme"]).toEqual(v3.content.aufnahme);
    expect(x01.content["spieler"]).toMatchObject({ verteilung: "beide", flaeche: false, average: false });
    expect(x01.content["spielinfo"]).toMatchObject({ on: false, spielart: true });
    expect(x01.layout.blocks.aufnahme).toEqual({ x: 33, y: 4, scale: 0.9 });
    expect(x01.layout.blocks["bereich-links"]).toEqual({ x: 1.4, y: 32.7, w: CARD.w * 0.7, h: CARD.h * 0.7 });
  });

  test("ohne Version 3 oder 4: neues Profil, der Name bleibt", () => {
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
