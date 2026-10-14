import { describe, expect, test } from "vitest";
import { CATALOG, MODES, contentDefaults, isMode, modeForVariant, sanitizeContent } from "../src/viewer/catalog.js";

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

  test("Hintergrund ist immer da, mit Darstellung und Rahmen", () => {
    expect(CATALOG.parts.map((p) => p.id)).toEqual(["hintergrund", "scheibe", "aufnahme", "spielinfo", "spieler"]);
    for (const part of CATALOG.parts) expect(part, part.id).not.toHaveProperty("scope");
    const hintergrund = CATALOG.parts[0]!;
    expect(hintergrund.fixed).toBe(true);
    expect(hintergrund.options.map((o) => o.id)).toEqual(["darstellung", "rahmen"]);
  });
});

describe("Vorgaben", () => {
  test("enthalten jeden Baustein mit an/aus und jeder Option - auch denen, die es nur in einigen Spielarten gibt", () => {
    const content = contentDefaults();
    for (const part of CATALOG.parts) {
      expect(content[part.id]?.on, part.id).toBe(part.default);
      for (const option of part.options) {
        expect(content[part.id]?.[option.id], `${part.id}.${option.id}`).toBe(option.default);
      }
    }
  });

  test("Vorgaben wie in der Spec", () => {
    const c = contentDefaults();
    expect(c["hintergrund"]).toEqual({ on: true, darstellung: "schwarz", rahmen: false });
    expect(c["scheibe"]).toEqual({ on: true, darstellung: "light", kamera: "0", zahlenring: true, darts: true, letzterDart: true });
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
    const a = contentDefaults();
    a["scheibe"]!.on = false;
    expect(contentDefaults()["scheibe"]?.on).toBe(true);
  });
});

describe("Pruefung der Inhalte", () => {
  test("Unbrauchbares ergibt die Vorgaben", () => {
    for (const stored of [null, "kaputt", 42, []]) {
      expect(sanitizeContent(stored)).toEqual(contentDefaults());
    }
  });

  test("verwirft unbekannte Bausteine und Optionen", () => {
    const c = sanitizeContent({ disco: { on: true }, scheibe: { glitzer: true } });
    expect(c).not.toHaveProperty("disco");
    expect(c["scheibe"]).not.toHaveProperty("glitzer");
  });

  test("falsch getypte Werte und ungueltige Auswahl bekommen die Vorgabe", () => {
    const c = sanitizeContent({ scheibe: { on: "ja", darstellung: "disco", darts: 1 }, spieler: { name: "nein" } });
    expect(c["scheibe"]).toMatchObject({ on: true, darstellung: "light", darts: true });
    expect(c["spieler"]?.["name"]).toBe(true);
  });

  test("uebernimmt gueltige Werte, auch von Optionen, die es nur in einigen Spielarten gibt", () => {
    const c = sanitizeContent({
      hintergrund: { darstellung: "autodarts", rahmen: true },
      scheibe: { darstellung: "lines" },
      spieler: { checkout: false },
    });
    expect(c["hintergrund"]).toEqual({ on: true, darstellung: "autodarts", rahmen: true });
    expect(c["scheibe"]?.["darstellung"]).toBe("lines");
    expect(c["spieler"]?.["checkout"]).toBe(false);
  });

  test("Hintergrund laesst sich nicht ausschalten", () => {
    expect(sanitizeContent({ hintergrund: { on: false, darstellung: "schwarz" } })["hintergrund"]?.on).toBe(true);
  });

  test("Fehlendes und Unbrauchbares kommt aus fallback", () => {
    const fallback = contentDefaults();
    fallback["aufnahme"] = { on: false, darts: false, summe: true };
    const content = sanitizeContent({ spieler: { verteilung: "oben" } }, fallback);
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

describe("Darstellung der Scheibe", () => {
  test("Reihenfolge: Kamera, Gezeichnet, Linien, Nur Licht", () => {
    const scheibe = CATALOG.parts.find((p) => p.id === "scheibe")!;
    const darstellung = scheibe.options.find((o) => o.id === "darstellung");
    expect(darstellung?.type === "choice" && darstellung.choices.map((c) => c.label)).toEqual([
      "Kamera",
      "Gezeichnet",
      "Linien",
      "Nur Licht",
    ]);
  });

  test("Kamera-Wahl 1 bis 3 (Autodarts-Kameras 0 bis 2), nur sichtbar bei Darstellung Kamera", () => {
    const scheibe = CATALOG.parts.find((p) => p.id === "scheibe")!;
    const kamera = scheibe.options.find((o) => o.id === "kamera")!;
    expect(kamera.type === "choice" && kamera.choices.map((c) => [c.id, c.label])).toEqual([
      ["0", "Kamera 1"],
      ["1", "Kamera 2"],
      ["2", "Kamera 3"],
    ]);
    expect(kamera.default).toBe("0");
    expect(kamera.showIf).toEqual({ option: "darstellung", value: "kamera" });
    expect(sanitizeContent({ scheibe: { darstellung: "kamera", kamera: "2" } })["scheibe"]).toMatchObject({
      darstellung: "kamera",
      kamera: "2",
    });
  });
});
