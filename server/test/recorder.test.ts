import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Recorder } from "../src/beamer/recorder.js";

let dir: string;
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe("Recorder bei Schreibfehlern", () => {
  test("schaltet sich ab, statt den Dienst zu beenden", async () => {
    dir = mkdtempSync(join(tmpdir(), "raspdarts-rec-"));
    writeFileSync(join(dir, "datei"), "x");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Der Elternordner ist eine normale Datei: mkdir und Stream schlagen fehl.
    const recorder = new Recorder(join(dir, "datei", "sessions", "a.ndjson"));
    expect(() => recorder.write({ a: 1 })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(() => recorder.write({ a: 2 })).not.toThrow();
    await expect(recorder.close()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(recorder.count).toBe(0);
  });

  test("meldet einen Stream-Fehler nach dem Start genau einmal", async () => {
    dir = mkdtempSync(join(tmpdir(), "raspdarts-rec-"));
    // Pfad ist ein Ordner: mkdir klappt, das Oeffnen der Datei scheitert asynchron.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recorder = new Recorder(dir);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(() => recorder.write({ a: 1 })).not.toThrow();
    await expect(recorder.close()).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
