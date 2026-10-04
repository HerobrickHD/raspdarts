import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_LAYOUT } from "../src/layout.js";
import { LayoutStore } from "../src/layout-store.js";

let dir: string;
let store: LayoutStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "layout-test-"));
  store = new LayoutStore(dir);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("LayoutStore", () => {
  test("liefert das Standard-Layout, solange nichts gespeichert ist", () => {
    expect(store.read("beamer")).toEqual(DEFAULT_LAYOUT);
  });

  test("schreibt ein Layout und liest es zurueck", () => {
    store.write("beamer", { checkout: { x: 60, y: 12, scale: 2 } });

    expect(store.read("beamer").checkout).toEqual({ x: 60, y: 12, scale: 2 });
  });

  test("haelt verschiedene Anzeigen auseinander", () => {
    store.write("beamer", { meta: { x: 70, y: 70, scale: 1 } });
    store.write("handy", { meta: { x: 10, y: 10, scale: 1 } });

    expect(store.read("beamer").meta.x).toBe(70);
    expect(store.read("handy").meta.x).toBe(10);
  });

  test("faellt auf den Standard zurueck, wenn die Datei unlesbar ist", () => {
    writeFileSync(join(dir, "beamer.json"), "{ kein json");

    expect(store.read("beamer")).toEqual(DEFAULT_LAYOUT);
  });

  test("weist Anzeigenamen ab, die aus dem Verzeichnis ausbrechen", () => {
    // Der Name kommt aus der URL - ohne Pruefung liesse sich damit eine
    // beliebige Datei im Dateisystem ueberschreiben.
    expect(() => store.read("../../../etc/passwd")).toThrow(/Anzeigename/);
    expect(() => store.write("..\..\windows", {})).toThrow(/Anzeigename/);
    expect(() => store.read("")).toThrow(/Anzeigename/);
  });

  test("erlaubt schlichte Namen", () => {
    expect(() => store.write("beamer-wohnzimmer", {})).not.toThrow();
  });
});
