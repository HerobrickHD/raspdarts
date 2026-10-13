import { describe, expect, test } from "vitest";
import { layoutChange } from "../public/js/editor-changes.js";
import { resolveProfile } from "../public/js/resolve-profile.js";
import { newProfile } from "../src/viewer/profile.ts";
import { viewerCatalog } from "../src/viewer/standards.ts";

const catalog = viewerCatalog();

describe("layoutChange", () => {
  test("Scheibe verschoben: nur gemeinsam, die Spielart bleibt im Standard", () => {
    const profile = newProfile("P");
    const before = resolveProfile(profile, catalog, "cricket").layout;
    const after = structuredClone(before);
    after.board.cx = 12;

    const { profile: next, patch } = layoutChange(profile, catalog, "cricket", before, after);

    expect(patch).toEqual({ gemeinsam: { board: after.board } });
    expect(next.gemeinsam.board.cx).toBe(12);
    expect(next.spielarten).toEqual({});
  });

  test("Bereich verschoben: nur die Spielart, sie wird angepasst", () => {
    const profile = newProfile("P");
    const before = resolveProfile(profile, catalog, "gotcha").layout;
    const after = structuredClone(before);
    after.blocks["bereich-links"].h = 80;

    const { profile: next, patch } = layoutChange(profile, catalog, "gotcha", before, after);

    expect(patch).toEqual({ spielart: { id: "gotcha", layout: { blocks: after.blocks } } });
    expect(next.spielarten.gotcha.layout.blocks["bereich-links"].h).toBe(80);
    expect(next.gemeinsam).toEqual(profile.gemeinsam);
  });

  test("nichts geaendert: kein patch", () => {
    const profile = newProfile("P");
    const layout = resolveProfile(profile, catalog, "x01").layout;

    expect(layoutChange(profile, catalog, "x01", layout, structuredClone(layout)).patch).toEqual({});
  });
});
