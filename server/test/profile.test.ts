import { describe, expect, test } from "vitest";
import { templateContent } from "../src/viewer/catalog.js";
import { DEFAULT_LAYOUT } from "../src/viewer/layout.js";
import {
  VALID_ID,
  newProfile,
  sanitizeName,
  sanitizeProfile,
  slugify,
  uniqueId,
} from "../src/viewer/profile.js";

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
  test("belegt die Inhalte aus der Vorlage vor, Layout ist der Standard", () => {
    expect(newProfile("TV", "fernseher")).toEqual({
      version: 3,
      name: "TV",
      content: templateContent("fernseher"),
      layout: DEFAULT_LAYOUT,
    });
  });

  test("ohne oder mit unbekannter Vorlage gilt Projektion", () => {
    expect(newProfile("A").content).toEqual(templateContent("projektion"));
    expect(newProfile("A", "disco").content).toEqual(templateContent("projektion"));
  });
});

describe("sanitizeProfile", () => {
  test("ohne version 3 entsteht ein Profil aus Projektion; ein Name bleibt", () => {
    expect(sanitizeProfile({ name: "Alt", meta: {} })).toEqual(newProfile("Alt"));
    expect(sanitizeProfile(null)).toEqual(newProfile("Profil"));
  });

  test("prueft Name, Inhalte und Layout einzeln", () => {
    const profile = sanitizeProfile({
      version: 3,
      name: "  TV ",
      content: { hintergrund: { on: true }, disco: {} },
      layout: { board: { cx: 140 } },
    });

    expect(profile.name).toBe("TV");
    expect(profile.content["hintergrund"]?.on).toBe(true);
    expect(profile.content).not.toHaveProperty("disco");
    expect(profile.layout.board.cx).toBe(100);
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
