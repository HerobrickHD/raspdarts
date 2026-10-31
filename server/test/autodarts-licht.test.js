import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/* Im Spiel darf nichts auf der Scheibe pulsieren - Autodarts saehe jeden Lichtimpuls als Wurf. */
describe("Leuchten im Spiel", () => {
  test("der letzte Dart leuchtet ruhig, ohne Animation", () => {
    const css = readFileSync("public/style.css", "utf8");
    const rule = css.match(/\.highlight-last-dart\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("fill");
    expect(rule).not.toMatch(/animation|transition/);
  });
});
