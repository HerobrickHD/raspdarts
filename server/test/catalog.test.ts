import { describe, expect, test } from "vitest";
import {
  CATALOG,
  DEFAULT_TEMPLATE,
  defaultContent,
  sanitizeContent,
  templateContent,
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
    expect(c["spielinfo"]).toEqual({ on: true, punktzahl: true, legs: true, modus: true });
    expect(c["spieler"]).toEqual({
      on: true,
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
