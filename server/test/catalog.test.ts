import { describe, expect, test } from "vitest";
import {
  CATALOG,
  DEFAULT_TEMPLATE,
  defaultContent,
  sanitizeContent,
  templateContent,
} from "../src/viewer/catalog.js";
import {
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
    const templates = CATALOG.templates.map((t) => t.id);
    expect(new Set(templates).size).toBe(templates.length);
    expect(templates).toContain(DEFAULT_TEMPLATE);
  });

  test("Vorlagen nennen nur Bausteine und Optionen, die es gibt, mit gueltigen Werten", () => {
    for (const template of CATALOG.templates) {
      for (const [partId, values] of Object.entries(template.content)) {
        const part = CATALOG.parts.find((p) => p.id === partId);
        expect(part, `${template.id}.${partId}`).toBeDefined();
        for (const [key, value] of Object.entries(values)) {
          if (key === "on") {
            expect(typeof value, `${template.id}.${partId}.on`).toBe("boolean");
            continue;
          }
          const option = part!.options.find((o) => o.id === key);
          expect(option, `${template.id}.${partId}.${key}`).toBeDefined();
          if (option!.type === "toggle") expect(typeof value).toBe("boolean");
          else expect(option!.choices.map((c) => c.id)).toContain(value);
        }
      }
    }
  });
});

describe("defaultContent", () => {
  test("enthaelt jeden Baustein mit an/aus und jeder Option", () => {
    const content = defaultContent();
    for (const part of CATALOG.parts) {
      expect(content[part.id]?.on, part.id).toBe(part.default);
      for (const option of part.options) {
        expect(content[part.id]?.[option.id], `${part.id}.${option.id}`).toBe(option.default);
      }
    }
  });

  test("Vorgaben wie in der Spec", () => {
    const c = defaultContent();
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

  test("liefert jedes Mal eine eigene Kopie", () => {
    const a = defaultContent();
    a["scheibe"]!.on = false;
    expect(defaultContent()["scheibe"]?.on).toBe(true);
  });
});

describe("templateContent", () => {
  test("Projektion: ohne Zahlenring und ohne Spielinfo, sonst Vorgaben", () => {
    const c = templateContent("projektion")!;
    expect(c["hintergrund"]?.on).toBe(false);
    expect(c["scheibe"]).toMatchObject({ on: true, darstellung: "light", zahlenring: false });
    expect(c["spielinfo"]?.on).toBe(false);
    expect(c["spieler"]?.profilbild).toBe(true);
  });

  test("Fernseher: Hintergrund an, Scheibe gezeichnet", () => {
    const c = templateContent("fernseher")!;
    expect(c["hintergrund"]?.on).toBe(true);
    expect(c["scheibe"]).toMatchObject({ darstellung: "drawn", zahlenring: true });
    expect(c["spielinfo"]?.on).toBe(true);
  });

  test("Minimal: nur Karten mit Flaeche, Name und Rest", () => {
    const c = templateContent("minimal")!;
    expect(c["aufnahme"]?.on).toBe(false);
    expect(c["spielinfo"]?.on).toBe(false);
    expect(c["spieler"]).toEqual({
      on: true,
      verteilung: "beide",
      flaeche: true,
      profilbild: false,
      name: true,
      flagge: false,
      rest: true,
      legs: false,
      checkout: false,
      average: false,
      dartzahl: false,
    });
  });

  test("unbekannte Vorlage ergibt null", () => {
    expect(templateContent("disco")).toBeNull();
    expect(templateContent(undefined)).toBeNull();
  });
});

describe("sanitizeContent", () => {
  test("Unbrauchbares ergibt die Vorgaben", () => {
    for (const stored of [null, "kaputt", 42, []]) expect(sanitizeContent(stored)).toEqual(defaultContent());
  });

  test("verwirft unbekannte Bausteine und Optionen", () => {
    const c = sanitizeContent({ disco: { on: true }, scheibe: { glitzer: true } });
    expect(c).not.toHaveProperty("disco");
    expect(c["scheibe"]).not.toHaveProperty("glitzer");
  });

  test("falsch getypte Werte und ungueltige Auswahl bekommen die Vorgabe", () => {
    const c = sanitizeContent({ scheibe: { on: "ja", darstellung: "disco", darts: 1 }, spieler: { name: "nein" } });
    expect(c["scheibe"]).toMatchObject({ on: true, darstellung: "light", darts: true });
    expect(c["spieler"]?.name).toBe(true);
  });

  test("uebernimmt gueltige Werte", () => {
    const c = sanitizeContent({ hintergrund: { on: true }, scheibe: { darstellung: "lines", zahlenring: false } });
    expect(c["hintergrund"]?.on).toBe(true);
    expect(c["scheibe"]).toMatchObject({ darstellung: "lines", zahlenring: false });
  });

  test("fehlende Werte kommen aus dem mitgegebenen Stand statt aus den Vorgaben", () => {
    const base = templateContent("fernseher")!;
    const c = sanitizeContent({ spieler: { average: false } }, base);
    expect(c["spieler"]?.average).toBe(false);
    expect(c["scheibe"]?.darstellung).toBe("drawn");
    expect(c["hintergrund"]?.on).toBe(true);
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
