import { describe, expect, test } from "vitest";
import { isStageKey, keyAction, wheelStep } from "../public/js/editor.js";

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

/* Ein Profil-Layout mit Scheibe und einem Block. */
const layoutWith = () => ({
  board: { cx: 50, cy: 50, diameter: 80, rotation: 0 },
  blocks: { spielinfo: { x: 10, y: 10, scale: 1 } },
});
const press = (key, props = {}) => ({ key, code: props.code ?? "", shiftKey: false, ctrlKey: false, ...props });
const apply = (event, selected) => {
  const layout = layoutWith();
  keyAction(event, selected)(layout);
  return layout;
};

describe("keyAction: Feinschritte der Scheibe (am Beamer 10-mal feiner)", () => {
  test("Pfeil verschiebt um 0,01, mit Umschalt um 1", () => {
    expect(apply(press("ArrowRight"), "scheibe").board.cx).toBeCloseTo(50.01, 6);
    expect(apply(press("ArrowUp", { shiftKey: true }), "scheibe").board.cy).toBeCloseTo(49, 6);
  });

  test("+ / − aendern den Durchmesser um 0,01, mit Umschalt um 1", () => {
    expect(apply(press("+"), "scheibe").board.diameter).toBeCloseTo(80.01, 6);
    expect(apply(press("-", { shiftKey: true }), "scheibe").board.diameter).toBeCloseTo(79, 6);
  });

  test("E dreht um 0,01 Grad", () => {
    expect(apply(press("e", { code: "KeyE" }), "scheibe").board.rotation).toBeCloseTo(0.01, 6);
  });

  test("andere Bausteine behalten 0,1", () => {
    expect(apply(press("ArrowRight"), "spielinfo").blocks.spielinfo.x).toBeCloseTo(10.1, 6);
  });
});

describe("wheelStep", () => {
  test("Mausrad: 1, mit Umschalt 0,01", () => {
    expect(wheelStep(false)).toBe(1);
    expect(wheelStep(true)).toBe(0.01);
  });
});
