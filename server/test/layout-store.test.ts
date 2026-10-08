import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_LAYOUT } from "../src/viewer/layout.js";
import { DEFAULT_DISPLAY, LayoutStore, displayName } from "../src/viewer/layout-store.js";

let dir: string;
let store: LayoutStore;

const MOVED = { version: 2, board: { cx: 40, cy: 45, diameter: 80, rotation: 1.5 } };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "layout-test-"));
  store = new LayoutStore(dir);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("LayoutStore", () => {
  test("liefert das Standard-Layout, solange nichts gespeichert ist", () => {
    expect(store.read("standard")).toEqual(DEFAULT_LAYOUT);
  });

  test("liefert ein geschriebenes Layout sofort zurueck", () => {
    const saved = store.write("beamer", MOVED);

    expect(saved.board).toEqual(MOVED.board);
    expect(store.read("beamer").board).toEqual(MOVED.board);
  });

  test("schreibt die Datei gebuendelt nach 500 ms", () => {
    vi.useFakeTimers();
    store.write("beamer", MOVED);
    store.write("beamer", { ...MOVED, board: { ...MOVED.board, cx: 41 } });

    expect(existsSync(join(dir, "beamer.json"))).toBe(false);
    vi.advanceTimersByTime(500);

    const onDisk = JSON.parse(readFileSync(join(dir, "beamer.json"), "utf8"));
    expect(onDisk.board.cx).toBe(41);
  });

  test("flush schreibt sofort, und ein neuer Speicher liest es wieder", () => {
    store.write("beamer", MOVED);
    store.flush();

    expect(new LayoutStore(dir).read("beamer").board).toEqual(MOVED.board);
  });

  test("haelt verschiedene Anzeigen auseinander", () => {
    store.write("beamer", MOVED);

    expect(store.read("tv")).toEqual(DEFAULT_LAYOUT);
  });

  test("faellt auf den Standard zurueck, wenn die Datei unlesbar ist", () => {
    writeFileSync(join(dir, "beamer.json"), "{ kein json");

    expect(store.read("beamer")).toEqual(DEFAULT_LAYOUT);
  });

  test("laeuft weiter, wenn die Datei nicht geschrieben werden kann", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rmSync(dir, { recursive: true, force: true });
    writeFileSync(dir, "ich bin eine Datei, kein Ordner");

    store.write("beamer", MOVED);
    store.flush();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(store.read("beamer").board).toEqual(MOVED.board);
    rmSync(dir, { force: true });
  });

  test("weist Anzeigenamen ab, die aus dem Verzeichnis ausbrechen", () => {
    expect(() => store.read("../../../etc/passwd")).toThrow(/Anzeigename/);
    expect(() => store.write("..\\..\\windows", {})).toThrow(/Anzeigename/);
    expect(() => store.read("")).toThrow(/Anzeigename/);
  });
});

describe("displayName", () => {
  test("uebernimmt schlichte Namen", () => {
    expect(displayName("beamer-wohnzimmer")).toBe("beamer-wohnzimmer");
  });

  test("nimmt fuer alles andere den Standard", () => {
    expect(DEFAULT_DISPLAY).toBe("standard");
    expect(displayName(undefined)).toBe("standard");
    expect(displayName("Wohnzimmer TV")).toBe("standard");
    expect(displayName("../x")).toBe("standard");
    expect(displayName(["beamer"])).toBe("standard");
  });
});
