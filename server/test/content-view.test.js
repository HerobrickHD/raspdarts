import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { contentAttributes } from "../public/js/content-view.js";
import { CATALOG, modeDefaults, sanitizeModeContent, sanitizeShared, sharedDefaults } from "../src/viewer/catalog.ts";

const defaultContent = () => ({ ...sharedDefaults(), ...modeDefaults("x01") });
const sanitizeContent = (stored) => ({ ...sanitizeShared(stored), ...sanitizeModeContent(stored, "x01") });

describe("contentAttributes", () => {
  test("setzt fuer jeden Baustein und jede Option ein Merkmal", () => {
    const attrs = contentAttributes(CATALOG, defaultContent());

    expect(attrs).toMatchObject({
      "data-hintergrund": "off",
      "data-scheibe": "on",
      "data-scheibe-darstellung": "light",
      "data-scheibe-letzterdart": "on",
      "data-spieler-profilbild": "on",
    });
    const count = CATALOG.parts.reduce((n, part) => n + 1 + part.options.length, 0);
    expect(Object.keys(attrs)).toHaveLength(count);
  });

  test("schreibt ausgeschaltete Optionen und Auswahlwerte", () => {
    const content = sanitizeContent({
      hintergrund: { on: true },
      scheibe: { darstellung: "drawn" },
      spieler: { flaeche: false },
    });

    expect(contentAttributes(CATALOG, content)).toMatchObject({
      "data-hintergrund": "on",
      "data-scheibe-darstellung": "drawn",
      "data-spieler-flaeche": "off",
    });
  });

  test("Merkmalnamen sind klein geschrieben", () => {
    for (const name of Object.keys(contentAttributes(CATALOG, defaultContent()))) {
      expect(name).toBe(name.toLowerCase());
    }
  });

  test("fehlende Werte gelten wie die Vorgaben", () => {
    expect(contentAttributes(CATALOG, {})).toEqual(contentAttributes(CATALOG, defaultContent()));
  });

  test("jede Option wirkt im Stylesheet (Darstellung der Scheibe setzt app.js)", () => {
    const css = readFileSync("public/style.css", "utf8");
    const handledInCode = ["data-scheibe-darstellung"];
    for (const name of Object.keys(contentAttributes(CATALOG, defaultContent()))) {
      if (handledInCode.includes(name)) continue;
      expect(css, name).toContain(`[${name}=`);
    }
  });
});
