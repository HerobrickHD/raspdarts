import { describe, expect, test } from "vitest";
import {
  CATALOG,
  FALLBACK_MODE,
  MODES,
  availableIn,
  isMode,
  modeDefaults,
  modeForVariant,
  sanitizeModeContent,
  sanitizeShared,
  sharedDefaults,
} from "../src/viewer/catalog.js";

describe("Katalog", () => {
  test("Ids sind eindeutig, keine Option heisst 'on'", () => {
    const parts = CATALOG.parts.map((p) => p.id);
    expect(new Set(parts).size).toBe(parts.length);
    for (const part of CATALOG.parts) {
      const options = part.options.map((o) => o.id);
      expect(new Set(options).size, part.id).toBe(options.length);
      expect(options, part.id).not.toContain("on");
    }
  });
});

describe("Vorgaben", () => {
  test("enthalten jeden Baustein mit an/aus und jeder Option, die es in X01 gibt", () => {
    const content = { ...sharedDefaults(), ...modeDefaults("x01") };
    for (const part of CATALOG.parts) {
      expect(content[part.id]?.on, part.id).toBe(part.default);
      for (const option of part.options) {
        expect(content[part.id]?.[option.id], `${part.id}.${option.id}`).toBe(option.default);
      }
    }
  });

  test("Vorgaben wie in der Spec", () => {
    const c = { ...sharedDefaults(), ...modeDefaults("x01") };
    expect(c["hintergrund"]).toEqual({ on: false });
    expect(c["scheibe"]).toEqual({ on: true, darstellung: "light", zahlenring: true, darts: true, letzterDart: true });
    expect(c["aufnahme"]).toEqual({ on: true, darts: true, summe: true });
    expect(c["spielinfo"]).toEqual({ on: true, spielart: true, punktzahl: true, legs: true, modus: true });
    expect(c["spieler"]).toEqual({
      on: true,
      verteilung: "beide",
      flaeche: true,
      profilbild: true,
      name: true,
      flagge: true,
      rest: true,
      legs: true,
      checkout: true,
      average: true,
      dartzahl: true,
    });
  });

  test("liefern jedes Mal eine eigene Kopie", () => {
    const a = sharedDefaults();
    a["scheibe"]!.on = false;
    expect(sharedDefaults()["scheibe"]?.on).toBe(true);
  });
});

describe("Pruefung der Inhalte", () => {
  test("Unbrauchbares ergibt die Vorgaben", () => {
    for (const stored of [null, "kaputt", 42, []]) {
      expect(sanitizeShared(stored)).toEqual(sharedDefaults());
      expect(sanitizeModeContent(stored, "x01")).toEqual(modeDefaults("x01"));
    }
  });

  test("verwirft unbekannte Bausteine und Optionen", () => {
    const c = sanitizeShared({ disco: { on: true }, scheibe: { glitzer: true } });
    expect(c).not.toHaveProperty("disco");
    expect(c["scheibe"]).not.toHaveProperty("glitzer");
  });

  test("falsch getypte Werte und ungueltige Auswahl bekommen die Vorgabe", () => {
    const shared = sanitizeShared({ scheibe: { on: "ja", darstellung: "disco", darts: 1 } });
    expect(shared["scheibe"]).toMatchObject({ on: true, darstellung: "light", darts: true });
    expect(sanitizeModeContent({ spieler: { name: "nein" } }, "x01")["spieler"]?.["name"]).toBe(true);
  });

  test("uebernimmt gueltige Werte", () => {
    const c = sanitizeShared({ hintergrund: { on: true }, scheibe: { darstellung: "lines", zahlenring: false } });
    expect(c["hintergrund"]?.on).toBe(true);
    expect(c["scheibe"]).toMatchObject({ darstellung: "lines", zahlenring: false });
  });
});

describe("Spielarten", () => {
  test("elf Spielarten ohne 121 und Killer, ids eindeutig", () => {
    expect(MODES.map((m) => m.id)).toEqual([
      "x01",
      "cricket",
      "count-up",
      "around-the-clock",
      "random-checkout",
      "round-the-world",
      "segment-training",
      "bobs-27",
      "shanghai",
      "gotcha",
      "bermuda",
    ]);
    expect(MODES.find((m) => m.id === FALLBACK_MODE)?.verified).toBe(true);
    expect(MODES.filter((m) => m.verified).map((m) => m.id)).toEqual(["x01"]);
  });

  test("erkennt variant ohne Ruecksicht auf Schreibweise", () => {
    expect(modeForVariant("X01")).toBe("x01");
    expect(modeForVariant("cricket")).toBe("cricket");
    expect(modeForVariant("Tactics")).toBe("cricket");
    expect(modeForVariant("Bob's 27")).toBe("bobs-27");
    expect(modeForVariant("BOBS 27")).toBe("bobs-27");
    expect(modeForVariant("Around The Clock")).toBe("around-the-clock");
    expect(modeForVariant("ATC")).toBe("around-the-clock");
  });

  test("unbekannt, 121, Killer und Unsinn ergeben null", () => {
    expect(modeForVariant("Killer")).toBeNull();
    expect(modeForVariant("121")).toBeNull();
    expect(modeForVariant("")).toBeNull();
    expect(modeForVariant(42)).toBeNull();
  });

  test("isMode kennt nur Katalog-ids", () => {
    expect(isMode("cricket")).toBe(true);
    expect(isMode("Cricket")).toBe(false);
    expect(isMode(undefined)).toBe(false);
  });

  test("modes der Bausteine und Optionen nennen nur bekannte Spielarten", () => {
    for (const part of CATALOG.parts) {
      for (const mode of part.modes ?? []) expect(isMode(mode), `${part.id}: ${mode}`).toBe(true);
      for (const option of part.options) {
        for (const mode of option.modes ?? []) expect(isMode(mode), `${part.id}.${option.id}: ${mode}`).toBe(true);
      }
    }
  });
});

describe("availableIn", () => {
  test("ohne modes ueberall, mit modes nur dort, bei unbekannter Spielart nur Allgemeines", () => {
    expect(availableIn({}, "gotcha")).toBe(true);
    expect(availableIn({}, null)).toBe(true);
    expect(availableIn({ modes: ["x01"] }, "x01")).toBe(true);
    expect(availableIn({ modes: ["x01"] }, "cricket")).toBe(false);
    expect(availableIn({ modes: ["x01"] }, null)).toBe(false);
  });
});

describe("gemeinsam und je Spielart", () => {
  test("Hintergrund und Scheibe sind gemeinsam, der Rest je Spielart", () => {
    const scope = Object.fromEntries(CATALOG.parts.map((p) => [p.id, p.scope]));
    expect(scope).toEqual({
      hintergrund: "gemeinsam",
      scheibe: "gemeinsam",
      aufnahme: "spielart",
      spielinfo: "spielart",
      spieler: "spielart",
    });
  });

  test("sharedDefaults enthaelt nur die gemeinsamen Bausteine", () => {
    expect(Object.keys(sharedDefaults()).sort()).toEqual(["hintergrund", "scheibe"]);
  });

  test("modeDefaults enthaelt nur, was es in der Spielart gibt", () => {
    const x01 = modeDefaults("x01");
    expect(Object.keys(x01).sort()).toEqual(["aufnahme", "spieler", "spielinfo"]);
    expect(x01["spieler"]).toMatchObject({ verteilung: "beide", checkout: true, average: true, legs: true });
    expect(x01["spielinfo"]).toEqual({ on: true, spielart: true, punktzahl: true, legs: true, modus: true });

    const gotcha = modeDefaults("gotcha");
    expect(gotcha["spieler"]).not.toHaveProperty("checkout");
    expect(gotcha["spieler"]).not.toHaveProperty("average");
    expect(gotcha["spieler"]).not.toHaveProperty("legs");
    expect(gotcha["spielinfo"]).toEqual({ on: true, spielart: true });

    expect(modeDefaults("random-checkout")["spieler"]).toHaveProperty("checkout", true);
    expect(modeDefaults("cricket")["spieler"]).toHaveProperty("legs", true);
  });

  test("sanitizeModeContent wirft Optionen anderer Spielarten und gemeinsame Bausteine weg", () => {
    const content = sanitizeModeContent(
      { scheibe: { on: false }, spieler: { checkout: false, name: false, verteilung: "links" } },
      "gotcha",
    );
    expect(content).not.toHaveProperty("scheibe");
    expect(content["spieler"]).not.toHaveProperty("checkout");
    expect(content["spieler"]).toMatchObject({ name: false, verteilung: "links" });
  });

  test("sanitizeModeContent nimmt Fehlendes aus fallback, Unbrauchbares auch", () => {
    const fallback = modeDefaults("x01");
    fallback["aufnahme"] = { on: false, darts: false, summe: true };
    const content = sanitizeModeContent({ spieler: { verteilung: "oben" } }, "x01", fallback);
    expect(content["aufnahme"]).toEqual({ on: false, darts: false, summe: true });
    expect(content["spieler"]?.["verteilung"]).toBe("beide");
  });

  test("sanitizeShared prueft nur Hintergrund und Scheibe", () => {
    const content = sanitizeShared({ scheibe: { darstellung: "drawn" }, spieler: { on: false } });
    expect(Object.keys(content).sort()).toEqual(["hintergrund", "scheibe"]);
    expect(content["scheibe"]?.["darstellung"]).toBe("drawn");
  });
});
