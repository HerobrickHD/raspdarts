import { describe, expect, test } from "vitest";
import { layoutChange } from "../public/js/editor-changes.js";
import { newProfile } from "../src/viewer/profile.ts";

describe("layoutChange", () => {
  test("Scheibe verschoben: neues Layout des Profils, Inhalte bleiben", () => {
    const profile = newProfile("P");
    const before = profile.layout;
    const after = structuredClone(before);
    after.board.cx = 12;

    const { profile: next, patch } = layoutChange(profile, before, after);

    expect(patch).toEqual({ layout: after });
    expect(next.layout.board.cx).toBe(12);
    expect(next.content).toBe(profile.content);
  });

  test("nichts geaendert: kein patch, dasselbe Profil", () => {
    const profile = newProfile("P");

    const result = layoutChange(profile, profile.layout, structuredClone(profile.layout));

    expect(result.patch).toEqual({});
    expect(result.profile).toBe(profile);
  });
});
