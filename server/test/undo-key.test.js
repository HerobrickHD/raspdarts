import { describe, expect, test } from "vitest";
import { undoKey } from "../public/js/undo.js";

/* Ziel ohne Textfeld bzw. im Textfeld (closest trifft). */
const stage = { closest: () => null };
const textField = { closest: (selector) => (selector.includes('input[type="text"]') ? {} : null) };
const press = (props) => ({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target: stage, ...props });

describe("undoKey", () => {
  test("Strg+Z ist zurueck, auch als grosses Z (Feststelltaste)", () => {
    expect(undoKey(press({ key: "z", ctrlKey: true }))).toBe("undo");
    expect(undoKey(press({ key: "Z", ctrlKey: true }))).toBe("undo");
  });

  test("Strg+Umschalt+Z und Strg+Y sind wiederholen", () => {
    expect(undoKey(press({ key: "Z", ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(undoKey(press({ key: "y", ctrlKey: true }))).toBe("redo");
  });

  test("Mac: Befehlstaste", () => {
    expect(undoKey(press({ key: "z", metaKey: true }))).toBe("undo");
  });

  test("ohne Strg oder mit AltGr: nichts", () => {
    expect(undoKey(press({ key: "z" }))).toBeNull();
    expect(undoKey(press({ key: "z", ctrlKey: true, altKey: true }))).toBeNull();
    expect(undoKey(press({ key: "x", ctrlKey: true }))).toBeNull();
  });

  test("im Textfeld bleibt das Zurueck des Browsers", () => {
    expect(undoKey(press({ key: "z", ctrlKey: true, target: textField }))).toBeNull();
  });

  test("Ziel ohne closest (window): zaehlt", () => {
    expect(undoKey(press({ key: "z", ctrlKey: true, target: {} }))).toBe("undo");
  });
});
