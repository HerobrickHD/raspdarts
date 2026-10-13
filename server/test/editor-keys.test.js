import { describe, expect, test } from "vitest";
import { isStageKey } from "../public/js/editor.js";

/** Ein Tastendruck, dessen Ziel in einem bestimmten Bereich liegt. */
const keyIn = (selectorsHit) => ({
  target: { closest: (selector) => (selectorsHit.some((s) => selector.includes(s)) ? {} : null) },
});

describe("isStageKey", () => {
  test("Tasten auf der Buehne (oder ohne Fokus) gehoeren dem Editor", () => {
    expect(isStageKey(keyIn([]))).toBe(true);
    expect(isStageKey({ target: null })).toBe(true);
  });

  test("Tasten in der Leiste, in Eingabefeldern und Auswahlen gehoeren nicht dem Editor", () => {
    expect(isStageKey(keyIn(["#settings"]))).toBe(false);
    expect(isStageKey(keyIn(["input"]))).toBe(false);
    expect(isStageKey(keyIn(["select"]))).toBe(false);
  });
});
