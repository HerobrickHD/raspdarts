import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { contentAttributes } from "../public/js/content-view.js";
import { CATALOG, contentDefaults as defaultContent, sanitizeContent } from "../src/viewer/catalog.ts";

describe("contentAttributes", () => {
  test("setzt fuer jeden Baustein und jede Option ein Merkmal", () => {
    const attrs = contentAttributes(CATALOG, defaultContent(), "x01");

    expect(attrs).toMatchObject({
      "data-hintergrund-darstellung": "schwarz",
      "data-scheibe": "on",
      "data-scheibe-darstellung": "light",
      "data-scheibe-letzterdart": "on",
      "data-spieler-profilbild": "on",
    });
    const count = CATALOG.parts.reduce((n, part) => n + (part.fixed ? 0 : 1) + part.options.length, 0);
    expect(Object.keys(attrs)).toHaveLength(count);
  });

  test("schreibt ausgeschaltete Optionen und Auswahlwerte", () => {
    const content = sanitizeContent({
      hintergrund: { darstellung: "autodarts" },
      scheibe: { darstellung: "drawn" },
      spieler: { flaeche: false },
    });

    expect(contentAttributes(CATALOG, content, "x01")).toMatchObject({
      "data-hintergrund-darstellung": "autodarts",
      "data-scheibe-darstellung": "drawn",
      "data-spieler-flaeche": "off",
    });
  });

  test("Optionen und Bausteine ausserhalb der Spielart gelten als aus", () => {
    expect(contentAttributes(CATALOG, defaultContent(), "gotcha")).toMatchObject({
      "data-spieler-checkout": "off",
      "data-spieler-average": "off",
      "data-spielinfo-punktzahl": "off",
      "data-spieler-name": "on",
    });
  });

  test("unbekannte Spielart: nur was es ueberall gibt", () => {
    expect(contentAttributes(CATALOG, defaultContent(), null)).toMatchObject({
      "data-spieler-legs": "off",
      "data-spieler-rest": "on",
    });
  });

  test("feste Bausteine (Hintergrund) bekommen kein an/aus-Merkmal, nur ihre Optionen", () => {
    const attrs = contentAttributes(CATALOG, defaultContent(), "x01");
    expect(attrs).not.toHaveProperty("data-hintergrund");
    expect(attrs).toMatchObject({ "data-hintergrund-darstellung": "schwarz", "data-hintergrund-rahmen": "off" });
  });

  test("Merkmalnamen sind klein geschrieben", () => {
    for (const name of Object.keys(contentAttributes(CATALOG, defaultContent(), "x01"))) {
      expect(name).toBe(name.toLowerCase());
    }
  });

  test("fehlende Werte gelten wie die Vorgaben", () => {
    expect(contentAttributes(CATALOG, {}, "x01")).toEqual(contentAttributes(CATALOG, defaultContent(), "x01"));
  });

  test("jede Option wirkt im Stylesheet (Darstellung der Scheibe setzt app.js)", () => {
    const css = readFileSync("public/style.css", "utf8");
    const handledInCode = ["data-scheibe-darstellung", "data-scheibe-kamera"];
    for (const name of Object.keys(contentAttributes(CATALOG, defaultContent(), "x01"))) {
      if (handledInCode.includes(name)) continue;
      expect(css, name).toContain(`[${name}=`);
    }
  });
});
