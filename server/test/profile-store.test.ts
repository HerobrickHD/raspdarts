import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_AREA_W, DEFAULT_LAYOUT } from "../src/viewer/layout.js";
import { ProfileError, ProfileStore } from "../src/viewer/profile-store.js";
import { standard } from "../src/viewer/standards.js";

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
  test("ohne alte Datei entsteht Standard: ganzes Fenster, Inhalte und Layout im Standard", () => {
    const store = new ProfileStore(dir, legacy);

    expect(store.list()).toEqual([{ id: "standard", name: "Standard" }]);
    expect(store.activeId).toBe("standard");
    expect(store.active()).toEqual({ id: "standard", version: 8, name: "Standard", format: "fenster", ...standard() });
    expect(onDisk("standard.json").name).toBe("Standard");
    expect(onDisk("active.json")).toEqual({ id: "standard" });
  });

  test("mit alter Datei (version 2): ihr Layout und ihre Scheibe", () => {
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "standard.json"), JSON.stringify(LEGACY));

    const profile = new ProfileStore(dir, legacy).active();

    expect(profile.layout.board).toEqual(LEGACY.board);
    expect(profile.content["scheibe"]?.["darstellung"]).toBe("drawn");
    expect(profile.layout.blocks.spielinfo).toEqual({ x: 5, y: 6, scale: 1.2 });
    expect(profile.layout.blocks.aufnahme).toEqual({ x: 30, y: 2, scale: 1.4 });
    expect(profile.layout.blocks["bereich-links"]).toEqual({ x: 1, y: 10, w: DEFAULT_AREA_W, h: 88 });
  });

  test("uebernimmt nur beim ersten Start", () => {
    const first = new ProfileStore(dir, legacy);
    first.update("standard", { name: "Beamer" });
    first.flush();
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "standard.json"), JSON.stringify(LEGACY));

    const profile = new ProfileStore(dir, legacy).active();

    expect(profile.name).toBe("Beamer");
    expect(profile.layout).toEqual(standard().layout);
  });

  test("ein leerer Ordner bekommt wieder Standard", () => {
    mkdirSync(dir, { recursive: true });

    expect(new ProfileStore(dir, legacy).list()).toEqual([{ id: "standard", name: "Standard" }]);
  });
});

describe("fruehere Version auf der Karte", () => {
  test("startet beim Laden im Standard (Name und Format bleiben), die Datei bleibt bis zur naechsten Aenderung", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "standard.json"),
      JSON.stringify({
        version: 7,
        name: "Beamer",
        format: "4:3",
        spielarten: { x01: { layout: { board: { cx: 42, cy: 28, diameter: 14, rotation: -103 } } } },
      }),
    );

    const store = new ProfileStore(dir);

    expect(store.active()).toEqual({ id: "standard", version: 8, name: "Beamer", format: "4:3", ...standard() });
    expect(onDisk("standard.json").version).toBe(7);

    store.update("standard", { name: "Beamer" });
    store.flush();
    expect(onDisk("standard.json").version).toBe(8);
    expect(onDisk("standard.json")).not.toHaveProperty("spielarten");
  });
});

describe("Profile", () => {
  test("legt aus dem Namen an, vergibt die id und schaltet um", () => {
    const store = new ProfileStore(dir);

    const tv = store.create("Fernseher Küche");

    expect(tv).toMatchObject({ id: "fernseher-kueche", name: "Fernseher Küche", format: "fenster", ...standard() });
    expect(store.activeId).toBe("fernseher-kueche");
    expect(store.create("Fernseher Küche").id).toBe("fernseher-kueche-2");
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

    const after = store.update("standard", { name: "  Beamer  " });

    expect(after.id).toBe("standard");
    expect(after.name).toBe("Beamer");
    expect(after.format).toBe("fenster");
    expect(after.content).toEqual(standard().content);
  });

  test("Scheibe: Unbrauchbares behaelt den bisherigen Wert", () => {
    const store = new ProfileStore(dir);
    const board = { cx: 40, cy: 30, diameter: 14, rotation: -103 };
    store.update("standard", { layout: { board } });

    const after = store.update("standard", { layout: { board: { cx: -5, cy: "x" } } });

    expect(after.layout.board).toEqual({ ...board, cx: 0 });
  });

  test("Inhalte aendern laesst das Layout stehen und umgekehrt", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { content: { aufnahme: { on: false } } });
    const blocks = { ...DEFAULT_LAYOUT.blocks, "bereich-links": { x: 1, y: 10, w: 40, h: 90 } };

    const profile = store.update("standard", { layout: { blocks } });

    expect(profile.content["aufnahme"]?.on).toBe(false);
    expect(profile.content["spieler"]).toEqual(standard().content["spieler"]);
    expect(profile.layout.blocks["bereich-links"]).toEqual({ x: 1, y: 10, w: 40, h: 90 });
    expect(profile.layout.board).toEqual(DEFAULT_LAYOUT.board);
  });

  test("Inhalte: Unbrauchbares behaelt den bisherigen Wert", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { content: { spieler: { verteilung: "links" } } });

    const profile = store.update("standard", { content: { spieler: { verteilung: "oben", average: false } } });

    expect(profile.content["spieler"]).toMatchObject({ verteilung: "links", average: false });
  });

  test("Zuruecksetzen: Inhalte und Layout auf den Standard, Name und Format bleiben", () => {
    const store = new ProfileStore(dir);
    store.update("standard", {
      name: "Beamer",
      format: "4:3",
      content: { aufnahme: { on: false } },
      layout: { board: { cx: 10, cy: 20, diameter: 30, rotation: 40 } },
    });

    const profile = store.reset("standard");

    expect(profile).toEqual({ id: "standard", version: 8, name: "Beamer", format: "4:3", ...standard() });
    expect(errorCode(() => store.reset("gibtsnicht"))).toBe("not-found");
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
    store.update("tv", { content: { spieler: { average: false } } });
    store.setActive("standard");
    store.flush();

    const again = new ProfileStore(dir);

    expect(again.list()).toEqual([
      { id: "standard", name: "Standard" },
      { id: "tv", name: "TV" },
    ]);
    expect(again.activeId).toBe("standard");
    expect(again.read("tv").content["spieler"]?.["average"]).toBe(false);
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

    expect(store.read("tv")).toMatchObject({ name: "Profil", format: "fenster", ...standard() });
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

describe("Format im Speicher", () => {
  test("PUT format setzt es, Unsinn behaelt den bisherigen Wert", () => {
    const store = new ProfileStore(dir);
    expect(store.update("standard", { format: "16:10" }).format).toBe("16:10");
    expect(store.update("standard", { format: "disco" }).format).toBe("16:10");
  });

  test("ein neues Profil uebernimmt das Format des aktiven (derselbe Bildschirm)", () => {
    const store = new ProfileStore(dir);
    store.update("standard", { format: "4:3" });
    expect(store.create("Zweites").format).toBe("4:3");
  });
});
