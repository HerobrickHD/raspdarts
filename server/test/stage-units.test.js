import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";

/*
 * Groessen haengen an der Buehne (cqh), nicht am Fenster (vh) - sonst
 * verrutscht das Layout, sobald das Format der Buehne nicht dem Fenster
 * entspricht. Nur die Buehne selbst darf das Fenster messen (100vh/100vw).
 */
describe("Einheiten der Buehne", () => {
  test("style.css nutzt vh/vw nur fuer die Groesse der Buehne", () => {
    const css = readFileSync("public/style.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const units = css.match(/[\d.]+v[hw]\b/g) ?? [];
    expect(units.filter((unit) => unit !== "100vh" && unit !== "100vw")).toEqual([]);
  });

  test("der Viewer setzt keine Groessen in vh", () => {
    for (const file of readdirSync("public/js")) {
      const code = readFileSync(`public/js/${file}`, "utf8");
      expect(code, file).not.toMatch(/}vh`/);
    }
  });

  test("die Buehne ist ein Container, an dem sich cqh misst; ihre Lage setzt stage.js", () => {
    const css = readFileSync("public/style.css", "utf8");
    expect(css).toMatch(/\.stage\s*\{[^}]*container-type:\s*size/);
    expect(readFileSync("public/js/app.js", "utf8")).toContain("fitStage(");
  });
});
