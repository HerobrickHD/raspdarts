import { describe, expect, test } from "vitest";
import { displayFromSearch } from "../public/js/display-name.js";
import { displayName } from "../src/viewer/layout-store.ts";

describe("displayFromSearch", () => {
  test("uebernimmt einen schlichten Namen aus der Adresse", () => {
    expect(displayFromSearch("?display=beamer-wohnzimmer")).toBe("beamer-wohnzimmer");
  });

  test("nimmt ohne oder bei unbrauchbarem Namen den Standard", () => {
    expect(displayFromSearch("")).toBe("standard");
    expect(displayFromSearch("?display=")).toBe("standard");
    expect(displayFromSearch("?display=Wohnzimmer%20TV")).toBe("standard");
    expect(displayFromSearch("?display=..%2Fx")).toBe("standard");
  });

  test("entscheidet wie der Pi - sonst speichert der Editor unter einem anderen Namen", () => {
    for (const raw of ["beamer", "TV-1", "Wohnzimmer TV", "../x", "a".repeat(33), "-x", ""]) {
      expect(displayFromSearch(`?display=${encodeURIComponent(raw)}`), raw).toBe(displayName(raw));
    }
  });
});
