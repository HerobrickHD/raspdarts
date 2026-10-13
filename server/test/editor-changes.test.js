import { describe, expect, test } from "vitest";
import { layoutChange } from "../public/js/editor-changes.js";
import { resolveProfile } from "../public/js/resolve-profile.js";
import { newProfile } from "../src/viewer/profile.ts";
import { viewerCatalog } from "../src/viewer/standards.ts";

const catalog = viewerCatalog();

describe("layoutChange", () => {
  test("Scheibe verschoben: gilt fuer diese Spielart, sie wird angepasst, andere bleiben", () => {
    const profile = newProfile("P");
    const before = resolveProfile(profile, catalog, "cricket").layout;
    const after = structuredClone(before);
    after.board.cx = 12;

    const { profile: next, patch } = layoutChange(profile, catalog, "cricket", before, after);

    expect(patch).toEqual({ spielart: { id: "cricket", layout: after } });
    expect(next.spielarten.cricket.layout.board.cx).toBe(12);
    expect(Object.keys(next.spielarten)).toEqual(["cricket"]);
  });

  test("Bereich verschoben: ebenso nur die Spielart", () => {
    const profile = newProfile("P");
    const before = resolveProfile(profile, catalog, "gotcha").layout;
    const after = structuredClone(before);
    after.blocks["bereich-links"].h = 80;

    const { profile: next, patch } = layoutChange(profile, catalog, "gotcha", before, after);

    expect(patch).toEqual({ spielart: { id: "gotcha", layout: after } });
    expect(next.spielarten.gotcha.layout.blocks["bereich-links"].h).toBe(80);
  });

  test("nichts geaendert: kein patch", () => {
    const profile = newProfile("P");
    const layout = resolveProfile(profile, catalog, "x01").layout;

    expect(layoutChange(profile, catalog, "x01", layout, structuredClone(layout)).patch).toEqual({});
  });
});
