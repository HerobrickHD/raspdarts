import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_BOARD, DEFAULT_MODE_LAYOUT } from "../src/viewer/layout.js";
import { ProfileError, ProfileStore } from "../src/viewer/profile-store.js";
import { sharedStandard, standardFor } from "../src/viewer/standards.js";

let root: string;
let dir: string;
let legacy: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "profile-test-"));
  dir = join(root, "profiles");
  legacy = join(root, "layouts");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

const onDisk = (file: string) => JSON.parse(readFileSync(join(dir, file), "utf8"));

/** Fehlercode eines Aufrufs, oder null, wenn er nicht wirft. */
function errorCode(run: () => unknown): string | null {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ProfileError);
    return (error as ProfileError).code;
  }
  return null;
}

const LEGACY = {
  version: 2,
  boardMode: "drawn",
  board: { cx: 48.2, cy: 47.5, diameter: 81.3, rotation: -2.4 },
  blocks: {
    kopf: { x: 5, y: 6, scale: 1.2 },
    aufnahme: { x: 30, y: 2, scale: 1.4 },
    "spieler-1": { x: 1, y: 30, scale: 1 },
  },
};

describe("erster Start", () => {
  test("ohne alte Datei entsteht Standard mit gemeinsamem Standard", () => {
    const store = new ProfileStore(dir, legacy);

    expect(store.list()).toEqual([{ id: "standard", name: "Standard" }]);
    expect(store.activeId).toBe("standard");
    expect(store.active()).toEqual({
      id: "standard",
      version: 4,
      name: "Standard",
      gemeinsam: { content: sharedStandard(), board: DEFAULT_BOARD },
      spielarten: {},
    });
    expect(onDisk("standard.json").name).toBe("Standard");
    expect(onDisk("active.json")).toEqual({ id: "standard" });
  });

  test("mit alter Datei (version 2): Scheibe gemeinsam, Rest als angepasstes X01", () => {
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "standard.json"), JSON.stringify(LEGACY));

    const profile = new ProfileStore(dir, legacy).active();

    expect(profile.gemeinsam.board).toEqual(LEGACY.board);
    expect(profile.gemeinsam.content["scheibe"]?.["darstellung"]).toBe("drawn");
    const x01 = profile.spielarten["x01"];
    expect(x01?.layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(x01?.layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(x01?.layout.blocks["bereich-links"]).toEqual({ x: 1, y: 30, w: 49, h: 34 });
    expect(x01?.content).toEqual(standardFor("x01").content);
  });

  test("uebernimmt nur beim ersten Start", () => {
    const first = new ProfileStore(dir, legacy);
    first.update("standard", { name: "Beamer" });
    first.flush();
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "standard.json"), JSON.stringify(LEGACY));

    const profile = new ProfileStore(dir, legacy).active();

    expect(profile.name).toBe("Beamer");
    expect(profile.gemeinsam.board).toEqual(DEFAULT_BOARD);
    expect(profile.spielarten).toEqual({});
  });

  test("ein leerer Ordner bekommt wieder Standard", () => {
    mkdirSync(dir, { recursive: true });

    expect(new ProfileStore(dir, legacy).list()).toEqual([{ id: "standard", name: "Standard" }]);
  });
});

describe("Version 3 auf der Karte", () => {
  test("wird beim Laden umgebaut, die Datei bleibt bis zur naechsten Aenderung Version 3", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "standard.json"),
      JSON.stringify({
        version: 3,
        name: "Standard",
        content: {},
        layout: { board: { cx: 42, cy: 28, diameter: 14, rotation: -103 }, blocks: {} },
      }),
    );

    const store = new ProfileStore(dir);

    expect(store.active().version).toBe(4);
    expect(store.active().gemeinsam.board).toEqual({ cx: 42, cy: 28, diameter: 14, rotation: -103 });
    expect(onDisk("standard.json").version).toBe(3);

    store.update("standard", { name: "Standard" });
    store.flush();
    expect(onDisk("standard.json").version).toBe(4);
  });
});

describe("Profile", () => {
  test("legt aus dem Namen an, vergibt die id und schaltet um", () => {
    const store = new ProfileStore(dir);

    const tv = store.create("Fernseher Küche");

    expect(tv).toMatchObject({ id: "fernseher-kueche", name: "Fernseher Küche", spielarten: {} });
    expect(tv.gemeinsam.content).toEqual(sharedStandard());
    expect(store.activeId).toBe("fernseher-kueche");
    expect(store.create("Fernseher Küche").id).toBe("fernseher-kueche-2");
  });

  test("uebernimmt die Lage der Scheibe aus dem aktiven Profil (derselbe Beamer)", () => {
    const store = new ProfileStore(dir);
    const board = { cx: 40, cy: 30, diameter: 14, rotation: -103 };
    store.update("standard", { gemeinsam: { board } });

    expect(store.create("Fernseher").gemeinsam.board).toEqual(board);
  });

  test("vergibt nie die id active (Datei active.json)", () => {
    expect(new ProfileStore(dir).create("Active").id).toBe("active-2");
  });

  test("listet nach Name", () => {
    const store = new ProfileStore(dir);
    store.create("Zimmer");
    store.create("Arbeit");

    expect(store.list().map((p) => p.name)).toEqual(["Arbeit", "Standard", "Zimmer"]);
  });

  test("aendert nur, was mitgeschickt wird; die id bleibt beim Umbenennen", () => {
    const store = new ProfileStore(dir);
    const before = store.active();

    const after = store.update("standard", { name: "  Beamer  ", gemeinsam: { content: { hintergrund: { on: true } } } });

    expect(after.id).toBe("standard");
    expect(after.name).toBe("Beamer");
    expect(after.gemeinsam.content["hintergrund"]?.on).toBe(true);
    expect(after.gemeinsam.content["scheibe"]).toEqual(before.gemeinsam.content["scheibe"]);
    expect(after.gemeinsam.board).toEqual(before.gemeinsam.board);
    expect(after.spielarten).toEqual({});
  });

  test("gemeinsam: Unbrauchbares behaelt den bisherigen Wert", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { gemeinsam: { content: { scheibe: { darstellung: "drawn" } } } });

    const after = store.update("standard", {
      gemeinsam: { board: { cx: -5, cy: "x" }, content: { scheibe: { darstellung: "disco" } } },
    });

    expect(after.gemeinsam.board).toEqual({ ...DEFAULT_BOARD, cx: 0 });
    expect(after.gemeinsam.content["scheibe"]?.["darstellung"]).toBe("drawn");
  });

  test("die erste Aenderung an einer Spielart legt ihren Eintrag aus dem Standard an", () => {
    const store = new ProfileStore(dir);

    const profile = store.update("standard", { spielart: { id: "cricket", content: { aufnahme: { on: false } } } });

    expect(Object.keys(profile.spielarten)).toEqual(["cricket"]);
    expect(profile.spielarten["cricket"]?.content["aufnahme"]?.on).toBe(false);
    expect(profile.spielarten["cricket"]?.content["spieler"]).toEqual(standardFor("cricket").content["spieler"]);
    expect(profile.spielarten["cricket"]?.layout).toEqual(DEFAULT_MODE_LAYOUT);
  });

  test("Layout einer Spielart aendern laesst ihre Inhalte stehen", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { spielart: { id: "x01", content: { aufnahme: { on: false } } } });
    const blocks = { ...DEFAULT_MODE_LAYOUT.blocks, "bereich-links": { x: 1, y: 10, w: 40, h: 90 } };

    const profile = store.update("standard", { spielart: { id: "x01", layout: { blocks } } });

    expect(profile.spielarten["x01"]?.content["aufnahme"]?.on).toBe(false);
    expect(profile.spielarten["x01"]?.layout.blocks["bereich-links"]).toEqual({ x: 1, y: 10, w: 40, h: 90 });
  });

  test("unbekannte Spielart ist ein Fehler des Aufrufers", () => {
    const store = new ProfileStore(dir);

    expect(errorCode(() => store.update("standard", { spielart: { id: "killer", content: {} } }))).toBe("invalid-mode");
    expect(errorCode(() => store.update("standard", { spielart: "x01" }))).toBe("invalid-mode");
    expect(store.active().spielarten).toEqual({});
  });

  test("spielart nur mit id (ohne Inhalte/Layout) legt nichts an", () => {
    const store = new ProfileStore(dir);

    expect(store.update("standard", { spielart: { id: "x01" } }).spielarten).toEqual({});
  });

  test("setzt eine Spielart auf den Standard zurueck, der Rest bleibt", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { spielart: { id: "x01", content: { aufnahme: { on: false } } } });
    store.update("standard", { spielart: { id: "gotcha", content: { aufnahme: { on: false } } } });

    const profile = store.resetMode("standard", "x01");

    expect(Object.keys(profile.spielarten)).toEqual(["gotcha"]);
    expect(errorCode(() => store.resetMode("standard", "killer"))).toBe("invalid-mode");
  });

  test("loescht samt Datei, aber nie das letzte; ein geloeschtes aktives macht das erste aktiv", () => {
    const store = new ProfileStore(dir);
    store.create("TV");
    store.flush();
    expect(existsSync(join(dir, "tv.json"))).toBe(true);

    store.remove("tv");

    expect(existsSync(join(dir, "tv.json"))).toBe(false);
    expect(store.activeId).toBe("standard");
    expect(errorCode(() => store.remove("standard"))).toBe("last-profile");
  });

  test("wechselt das aktive Profil; unbekannte und ungueltige ids werden abgewiesen", () => {
    const store = new ProfileStore(dir);
    store.create("TV");

    store.setActive("standard");

    expect(store.activeId).toBe("standard");
    expect(errorCode(() => store.setActive("gibtsnicht"))).toBe("not-found");
    expect(errorCode(() => store.read("../x"))).toBe("invalid-id");
    expect(errorCode(() => store.update("", {}))).toBe("invalid-id");
  });

  test("nach dem Neustart ist alles wieder da", () => {
    const store = new ProfileStore(dir);
    store.create("TV");
    store.update("tv", { spielart: { id: "x01", content: { spieler: { average: false } } } });
    store.setActive("standard");
    store.flush();

    const again = new ProfileStore(dir);

    expect(again.list()).toEqual([
      { id: "standard", name: "Standard" },
      { id: "tv", name: "TV" },
    ]);
    expect(again.activeId).toBe("standard");
    expect(again.read("tv").spielarten["x01"]?.content["spieler"]?.["average"]).toBe(false);
  });
});

describe("Speichern", () => {
  test("schreibt gebuendelt nach 500 ms", () => {
    vi.useFakeTimers();
    const store = new ProfileStore(dir);
    store.update("standard", { name: "A" });
    store.update("standard", { name: "B" });

    expect(onDisk("standard.json").name).toBe("Standard");
    vi.advanceTimersByTime(500);

    expect(onDisk("standard.json").name).toBe("B");
  });

  test("ein Aufruf ohne Aenderung schreibt nichts auf die Karte (Lebenszeichen)", () => {
    vi.useFakeTimers();
    const store = new ProfileStore(dir);
    rmSync(join(dir, "standard.json"));

    store.update("standard", {});
    vi.advanceTimersByTime(1000);

    expect(existsSync(join(dir, "standard.json"))).toBe(false);
  });

  test("hinterlaesst keine eigenen temporaeren Dateien und ignoriert fremde", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "alt.json.tmp"), "{ halb");
    const store = new ProfileStore(dir);
    store.update("standard", { name: "B" });
    store.flush();

    expect(readdirSync(dir).sort()).toEqual(["active.json", "alt.json.tmp", "standard.json"]);
    expect(store.list()).toEqual([{ id: "standard", name: "B" }]);
  });

  test("eine kaputte Profildatei wird mit Vorgaben gelesen", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "tv.json"), "{ kein json");

    const store = new ProfileStore(dir);

    expect(store.read("tv")).toMatchObject({ name: "Profil", gemeinsam: { content: sharedStandard() }, spielarten: {} });
  });

  test("kaputtes active.json: das erste Profil nach Name wird aktiv", () => {
    const first = new ProfileStore(dir);
    first.create("Arbeit");
    first.setActive("standard");
    first.flush();
    writeFileSync(join(dir, "active.json"), "kaputt");

    expect(new ProfileStore(dir).activeId).toBe("arbeit");
  });

  test("laeuft weiter, wenn nicht gespeichert werden kann", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mkdirSync(root, { recursive: true });
    writeFileSync(dir, "ich bin eine Datei, kein Ordner");

    const store = new ProfileStore(dir);
    store.update("standard", { name: "B" });
    store.flush();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(store.active().name).toBe("B");
  });
});
