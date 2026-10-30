import { describe, expect, test } from "vitest";
import { createHistory, snapshotOf, snapshotPatch } from "../public/js/history.js";
import { newProfile } from "../src/viewer/profile.ts";

/* Staende, die sich nur in der Lage der Scheibe unterscheiden. */
function states(count) {
  const base = snapshotOf(newProfile("P"));
  return Array.from({ length: count }, (_, i) => {
    const s = structuredClone(base);
    s.layout.board.cx = i;
    return s;
  });
}

describe("createHistory", () => {
  const [A, B, C, D] = states(4);

  test("ein Schritt: undo gibt vorher, redo nachher", () => {
    const h = createHistory({ now: () => 0 });
    h.record(A, B, null);
    expect(h.undo()).toEqual(A);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
    expect(h.redo()).toEqual(B);
    expect(h.canRedo()).toBe(false);
  });

  test("gleicher Schluessel unter 1 s: ein Schritt, vorher vom ersten, nachher vom letzten", () => {
    let t = 0;
    const h = createHistory({ now: () => t });
    h.record(A, B, "keys:scheibe");
    t = 900;
    h.record(B, C, "keys:scheibe");
    t = 1800;
    h.record(C, D, "keys:scheibe");
    expect(h.undo()).toEqual(A);
    expect(h.canUndo()).toBe(false);
    expect(h.redo()).toEqual(D);
  });

  test("1 s Pause oder anderer Schluessel: neuer Schritt", () => {
    let t = 0;
    const h = createHistory({ now: () => t });
    h.record(A, B, "k");
    t = 1000;
    h.record(B, C, "k");
    t = 1100;
    h.record(C, D, "j");
    expect(h.undo()).toEqual(C);
    expect(h.undo()).toEqual(B);
    expect(h.undo()).toEqual(A);
    expect(h.undo()).toBeNull();
  });

  test("key null fasst nie zusammen", () => {
    const h = createHistory({ now: () => 0 });
    h.record(A, B, null);
    h.record(B, C, null);
    expect(h.undo()).toEqual(B);
    expect(h.undo()).toEqual(A);
  });

  test("nach undo laeuft eine neue Reihe nicht in den alten Schritt", () => {
    let t = 0;
    const h = createHistory({ now: () => t });
    h.record(A, B, "k");
    expect(h.undo()).toEqual(A);
    h.record(A, C, "k");
    t = 100;
    expect(h.undo()).toEqual(A);
    expect(h.undo()).toBeNull();
  });

  test("nach redo laeuft eine neue Reihe nicht in den wiederholten Schritt", () => {
    let t = 0;
    const h = createHistory({ now: () => t });
    h.record(A, B, "k");
    h.undo();
    h.redo();
    t = 100;
    h.record(B, C, "k");
    expect(h.undo()).toEqual(B);
    expect(h.undo()).toEqual(A);
  });

  test("neue Aenderung verwirft redo", () => {
    const h = createHistory({ now: () => 0 });
    h.record(A, B, null);
    h.undo();
    h.record(A, C, null);
    expect(h.canRedo()).toBe(false);
    expect(h.redo()).toBeNull();
  });

  test("gleicher Stand vorher/nachher: kein Schritt", () => {
    const h = createHistory({ now: () => 0 });
    h.record(A, structuredClone(A), null);
    expect(h.canUndo()).toBe(false);
  });

  test("hoechstens 100 Schritte, die aeltesten fallen weg", () => {
    const S = states(102);
    const h = createHistory({ now: () => 0 });
    for (let i = 0; i <= 100; i++) h.record(S[i], S[i + 1], null);
    let last = null;
    for (let i = 0; i < 100; i++) last = h.undo();
    expect(last).toEqual(S[1]);
    expect(h.undo()).toBeNull();
  });

  test("clear leert beides", () => {
    const h = createHistory({ now: () => 0 });
    h.record(A, B, null);
    h.record(B, C, null);
    h.undo();
    h.clear();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });

  test("gespeicherte Staende aendern sich nicht mit dem Original", () => {
    const h = createHistory({ now: () => 0 });
    const before = structuredClone(A);
    h.record(before, B, null);
    before.layout.board.cx = 99;
    expect(h.undo()).toEqual(A);
  });
});

describe("snapshotOf", () => {
  test("nur name, format, content, layout - als Kopie", () => {
    const profile = { ...newProfile("P"), id: "p1", version: 8 };
    const s = snapshotOf(profile);
    expect(Object.keys(s).sort()).toEqual(["content", "format", "layout", "name"]);
    expect(s.layout).not.toBe(profile.layout);
    expect(s.layout).toEqual(profile.layout);
  });
});

describe("snapshotPatch", () => {
  const [A, B] = states(2);

  test("gleiche Staende: leer", () => {
    expect(snapshotPatch(A, structuredClone(A))).toEqual({});
  });

  test("nur layout anders: nur layout", () => {
    expect(snapshotPatch(A, B)).toEqual({ layout: B.layout });
  });
});
