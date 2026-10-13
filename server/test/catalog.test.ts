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

  test("alle Bausteine gehoeren zur Spielart; Hintergrund ist immer da, mit Darstellung und Rahmen", () => {
    expect(CATALOG.parts.map((p) => p.id)).toEqual(["hintergrund", "scheibe", "aufnahme", "spielinfo", "spieler"]);
    for (const part of CATALOG.parts) expect(part, part.id).not.toHaveProperty("scope");
    const hintergrund = CATALOG.parts[0]!;
    expect(hintergrund.fixed).toBe(true);
    expect(hintergrund.options.map((o) => o.id)).toEqual(["darstellung", "rahmen"]);
  });
});

describe("Vorgaben", () => {
  test("enthalten jeden Baustein mit an/aus und jeder Option, die es in X01 gibt", () => {
    const content = modeDefaults("x01");
    for (const part of CATALOG.parts) {
      expect(content[part.id]?.on, part.id).toBe(part.default);
      for (const option of part.options) {
        expect(content[part.id]?.[option.id], `${part.id}.${option.id}`).toBe(option.default);
      }
    }
  });

  test("Vorgaben wie in der Spec", () => {
    const c = modeDefaults("x01");
    expect(c["hintergrund"]).toEqual({ on: true, darstellung: "schwarz", rahmen: false });
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
    const a = modeDefaults("x01");
    a["scheibe"]!.on = false;
    expect(modeDefaults("x01")["scheibe"]?.on).toBe(true);
  });

  test("modeDefaults enthaelt nur, was es in der Spielart gibt", () => {
    const gotcha = modeDefaults("gotcha");
    expect(Object.keys(gotcha)).toEqual(["hintergrund", "scheibe", "aufnahme", "spielinfo", "spieler"]);
    expect(gotcha["spieler"]).not.toHaveProperty("checkout");
    expect(gotcha["spieler"]).not.toHaveProperty("average");
    expect(gotcha["spieler"]).not.toHaveProperty("legs");
    expect(gotcha["spielinfo"]).toEqual({ on: true, spielart: true });
    expect(modeDefaults("random-checkout")["spieler"]).toHaveProperty("checkout", true);
    expect(modeDefaults("cricket")["spieler"]).toHaveProperty("legs", true);
  });
});

describe("Pruefung der Inhalte", () => {
  test("Unbrauchbares ergibt die Vorgaben", () => {
    for (const stored of [null, "kaputt", 42, []]) {
      expect(sanitizeModeContent(stored, "x01")).toEqual(modeDefaults("x01"));
    }
  });

  test("verwirft unbekannte Bausteine und Optionen", () => {
    const c = sanitizeModeContent({ disco: { on: true }, scheibe: { glitzer: true } }, "x01");
    expect(c).not.toHaveProperty("disco");
    expect(c["scheibe"]).not.toHaveProperty("glitzer");
  });

  test("falsch getypte Werte und ungueltige Auswahl bekommen die Vorgabe", () => {
    const c = sanitizeModeContent({ scheibe: { on: "ja", darstellung: "disco", darts: 1 }, spieler: { name: "nein" } }, "x01");
    expect(c["scheibe"]).toMatchObject({ on: true, darstellung: "light", darts: true });
    expect(c["spieler"]?.["name"]).toBe(true);
  });

  test("uebernimmt gueltige Werte, Optionen anderer Spielarten fallen weg", () => {
    const c = sanitizeModeContent(
      { hintergrund: { darstellung: "autodarts", rahmen: true }, scheibe: { darstellung: "lines" }, spieler: { checkout: false } },
      "gotcha",
    );
    expect(c["hintergrund"]).toEqual({ on: true, darstellung: "autodarts", rahmen: true });
    expect(c["scheibe"]?.["darstellung"]).toBe("lines");
    expect(c["spieler"]).not.toHaveProperty("checkout");
  });

  test("Fehlendes und Unbrauchbares kommt aus fallback", () => {
    const fallback = modeDefaults("x01");
    fallback["aufnahme"] = { on: false, darts: false, summe: true };
    const content = sanitizeModeContent({ spieler: { verteilung: "oben" } }, "x01", fallback);
    expect(content["aufnahme"]).toEqual({ on: false, darts: false, summe: true });
    expect(content["spieler"]?.["verteilung"]).toBe("beide");
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

describe("Hintergrund aus aelteren Profilen", () => {
  test("Hintergrund an wird Darstellung Autodarts, aus wird Schwarz", () => {
    expect(sanitizeModeContent({ hintergrund: { on: true } }, "x01")["hintergrund"]).toEqual({
      on: true,
      darstellung: "autodarts",
      rahmen: false,
    });
    expect(sanitizeModeContent({ hintergrund: { on: false } }, "x01")["hintergrund"]?.["darstellung"]).toBe("schwarz");
  });

  test("der fruehere Baustein Rahmen wird zur Option im Hintergrund", () => {
    expect(sanitizeModeContent({ rahmen: { on: true } }, "x01")["hintergrund"]?.["rahmen"]).toBe(true);
  });

  test("Hintergrund laesst sich nicht ausschalten", () => {
    expect(sanitizeModeContent({ hintergrund: { on: false, darstellung: "schwarz" } }, "x01")["hintergrund"]?.on).toBe(true);
  });
});
