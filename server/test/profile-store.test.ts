import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { templateContent } from "../src/viewer/catalog.js";
import { DEFAULT_LAYOUT } from "../src/viewer/layout.js";
import { ProfileError, ProfileStore } from "../src/viewer/profile-store.js";

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
  blocks: { kopf: { x: 5, y: 6, scale: 1.2 }, aufnahme: { x: 30, y: 2, scale: 1.4 } },
};

describe("erster Start", () => {
  test("ohne alte Datei entsteht Standard aus der Vorlage Projektion", () => {
    const store = new ProfileStore(dir, legacy);

    expect(store.list()).toEqual([{ id: "standard", name: "Standard" }]);
    expect(store.activeId).toBe("standard");
    expect(store.active()).toEqual({
      id: "standard",
      version: 3,
      name: "Standard",
      content: templateContent("projektion"),
      layout: DEFAULT_LAYOUT,
    });
    expect(onDisk("standard.json").name).toBe("Standard");
    expect(onDisk("active.json")).toEqual({ id: "standard" });
  });

  test("uebernimmt das bisher ausgerichtete Layout und die Darstellung", () => {
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "standard.json"), JSON.stringify(LEGACY));

    const profile = new ProfileStore(dir, legacy).active();

    expect(profile.layout.board).toEqual(LEGACY.board);
    expect(profile.layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(profile.layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(profile.content["scheibe"]?.darstellung).toBe("drawn");
    expect(profile.content["spielinfo"]?.on).toBe(false); // sonst wie Projektion
  });

  test("uebernimmt nur beim ersten Start", () => {
    const first = new ProfileStore(dir, legacy);
    first.update("standard", { name: "Beamer" });
    first.flush();
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "standard.json"), JSON.stringify(LEGACY));

    const profile = new ProfileStore(dir, legacy).active();

    expect(profile.name).toBe("Beamer");
    expect(profile.layout).toEqual(DEFAULT_LAYOUT);
  });

  test("ein leerer Ordner bekommt wieder Standard", () => {
    mkdirSync(dir, { recursive: true });

    expect(new ProfileStore(dir, legacy).list()).toEqual([{ id: "standard", name: "Standard" }]);
  });
});

describe("Profile", () => {
  test("legt aus Name und Vorlage an, vergibt die id und schaltet um", () => {
    const store = new ProfileStore(dir);

    const tv = store.create("Fernseher Küche", "fernseher");

    expect(tv).toMatchObject({ id: "fernseher-kueche", name: "Fernseher Küche", content: templateContent("fernseher") });
    expect(store.activeId).toBe("fernseher-kueche");
    expect(store.create("Fernseher Küche", "minimal").id).toBe("fernseher-kueche-2");
  });

  test("vergibt nie die id active (Datei active.json)", () => {
    expect(new ProfileStore(dir).create("Active", "minimal").id).toBe("active-2");
  });

  test("weist eine unbekannte Vorlage ab", () => {
    const store = new ProfileStore(dir);

    expect(errorCode(() => store.create("X", "disco"))).toBe("invalid-template");
    expect(store.list()).toHaveLength(1);
  });

  test("listet nach Name", () => {
    const store = new ProfileStore(dir);
    store.create("Zimmer", "minimal");
    store.create("Arbeit", "minimal");

    expect(store.list().map((p) => p.name)).toEqual(["Arbeit", "Standard", "Zimmer"]);
  });

  test("aendert nur, was mitgeschickt wird; die id bleibt beim Umbenennen", () => {
    const store = new ProfileStore(dir);
    const before = store.active();

    const after = store.update("standard", { name: "  Beamer  ", content: { hintergrund: { on: true } } });

    expect(after.id).toBe("standard");
    expect(after.name).toBe("Beamer");
    expect(after.content["hintergrund"]?.on).toBe(true);
    expect(after.content["spielinfo"]).toEqual(before.content["spielinfo"]);
    expect(after.layout).toEqual(before.layout);
  });

  test("prueft Layout und Inhalte; Unbrauchbares behaelt den bisherigen Wert", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { content: { scheibe: { darstellung: "drawn" } } });

    const after = store.update("standard", {
      layout: { board: { cx: -5 } },
      content: { scheibe: { darstellung: "disco" } },
    });

    expect(after.layout.board.cx).toBe(0);
    expect(after.content["scheibe"]?.darstellung).toBe("drawn");
  });

  test("setzt Inhalte auf eine Vorlage zurueck, das Layout bleibt", () => {
    const store = new ProfileStore(dir);
    const moved = { ...DEFAULT_LAYOUT, board: { cx: 40, cy: 45, diameter: 80, rotation: 1.5 } };
    store.update("standard", { layout: moved, content: { hintergrund: { on: true } } });

    const after = store.resetContent("standard", "minimal");

    expect(after.content).toEqual(templateContent("minimal"));
    expect(after.layout.board).toEqual(moved.board);
    expect(errorCode(() => store.resetContent("standard", "disco"))).toBe("invalid-template");
  });

  test("loescht samt Datei, aber nie das letzte; ein geloeschtes aktives macht das erste aktiv", () => {
    const store = new ProfileStore(dir);
    store.create("TV", "fernseher");
    store.flush();
    expect(existsSync(join(dir, "tv.json"))).toBe(true);

    store.remove("tv");

    expect(existsSync(join(dir, "tv.json"))).toBe(false);
    expect(store.activeId).toBe("standard");
    expect(errorCode(() => store.remove("standard"))).toBe("last-profile");
  });

  test("wechselt das aktive Profil; unbekannte und ungueltige ids werden abgewiesen", () => {
    const store = new ProfileStore(dir);
    store.create("TV", "fernseher");

    store.setActive("standard");

    expect(store.activeId).toBe("standard");
    expect(errorCode(() => store.setActive("gibtsnicht"))).toBe("not-found");
    expect(errorCode(() => store.read("../x"))).toBe("invalid-id");
    expect(errorCode(() => store.update("", {}))).toBe("invalid-id");
  });

  test("nach dem Neustart ist alles wieder da", () => {
    const store = new ProfileStore(dir);
    store.create("TV", "fernseher");
    store.update("tv", { content: { spieler: { average: false } } });
    store.setActive("standard");
    store.flush();

    const again = new ProfileStore(dir);

    expect(again.list()).toEqual([
      { id: "standard", name: "Standard" },
      { id: "tv", name: "TV" },
    ]);
    expect(again.activeId).toBe("standard");
    expect(again.read("tv").content["spieler"]?.average).toBe(false);
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

    expect(store.read("tv")).toMatchObject({ name: "Profil", content: templateContent("projektion") });
  });

  test("kaputtes active.json: das erste Profil nach Name wird aktiv", () => {
    const first = new ProfileStore(dir);
    first.create("Arbeit", "minimal");
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
