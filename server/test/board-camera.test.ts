import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BoardCamera, cameraTrigger, wantedCamera } from "../src/viewer/board-camera.js";
import { newProfile } from "../src/viewer/profile.js";
import { standardFor } from "../src/viewer/standards.js";
import type { CamImage } from "../src/system/cams.js";
import type { ViewerState } from "../src/viewer/game-state.js";

const ELLIPSES = JSON.parse(readFileSync("test/fixtures/autodarts-ellipses-2026-10-13.json", "utf8"));

/** Ein laufendes Spiel mit `darts` Darts in der Aufnahme von Spieler `player`. */
function playing(darts: number, player = 0): ViewerState {
  return {
    phase: "playing",
    variant: "X01",
    mode: "x01",
    match: { baseScore: 501, legsToWin: 1, setsToWin: null, inMode: null, outMode: null },
    players: [0, 1].map((i) => ({
      seat: i + 1,
      name: `S${i}`,
      avatarUrl: null,
      country: null,
      score: 501,
      legs: 0,
      sets: 0,
      average: { leg: 0, match: 0 },
      dartsThrown: 0,
      isActive: i === player,
      isWinner: false,
      busted: false,
      checkout: null,
    })),
    turn: {
      darts: Array.from({ length: darts }, () => ({ field: { multiplier: 1, number: 20, ring: "inner" }, coords: null })),
      points: 20 * darts,
      busted: false,
    },
    highlights: [],
  } as ViewerState;
}
const IDLE: ViewerState = { phase: "idle" };

describe("cameraTrigger", () => {
  test("ein neuer Pfeil", () => {
    expect(cameraTrigger(playing(0), playing(1))).toBe(true);
    expect(cameraTrigger(playing(2), playing(3))).toBe(true);
  });

  test("Pfeile herausgezogen: die neue Aufnahme beginnt leer", () => {
    expect(cameraTrigger(playing(3, 0), playing(0, 1))).toBe(true);
  });

  test("sonst nicht: gleicher Stand, Spielbeginn ohne Pfeil, idle", () => {
    expect(cameraTrigger(playing(1), playing(1))).toBe(false);
    expect(cameraTrigger(IDLE, playing(0))).toBe(false);
    expect(cameraTrigger(playing(1), IDLE)).toBe(false);
  });
});

describe("BoardCamera", () => {
  let images: CamImage[];
  let calls: { n: number; fresh: boolean }[];
  let wanted: number | null;
  let notified: { cam: number; version: number }[];
  let camera: BoardCamera;

  beforeEach(() => {
    vi.useFakeTimers();
    images = [];
    calls = [];
    wanted = 2;
    notified = [];
    camera = new BoardCamera({
      cams: {
        image: async (n, options) => {
          calls.push({ n, fresh: options?.fresh === true });
          return images.shift() ?? { ok: true, jpeg: Buffer.from(`bild ${calls.length}`) };
        },
        calibration: async () => ELLIPSES,
      },
      wanted: () => wanted,
      notify: (update) => notified.push(update),
    });
  });

  afterEach(() => {
    camera.close();
    vi.useRealTimers();
  });

  test("nach einem Pfeil: eine halbe Sekunde spaeter ein frisches Bild der gewuenschten Kamera", async () => {
    camera.onState(playing(0), playing(1));
    await vi.advanceTimersByTimeAsync(400);
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(200);

    expect(calls).toEqual([{ n: 2, fresh: true }]);
    expect(camera.latest(2)?.jpeg.toString()).toBe("bild 1");
    expect(notified).toEqual([{ cam: 2, version: 1 }]);
  });

  test("ohne Kamera-Ansicht wird nichts geholt", async () => {
    wanted = null;
    camera.onState(playing(0), playing(1));
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toEqual([]);
  });

  test("hoechstens zweimal pro Sekunde je Kamera; der letzte Wurf kommt trotzdem ins Bild", async () => {
    camera.onState(playing(0), playing(1));
    await vi.advanceTimersByTimeAsync(500);
    camera.onState(playing(1), playing(2));
    await vi.advanceTimersByTimeAsync(100);
    camera.onState(playing(2), playing(3));
    await vi.advanceTimersByTimeAsync(2000);

    expect(calls).toHaveLength(2);
    expect(camera.latest(2)?.version).toBe(2);
  });

  test("Standby: das letzte Bild bleibt, keine Meldung", async () => {
    camera.onState(playing(0), playing(1));
    await vi.advanceTimersByTimeAsync(600);
    images.push({ ok: false, reason: "board-stopped" });
    camera.onState(playing(1), playing(2));
    await vi.advanceTimersByTimeAsync(1000);

    expect(camera.latest(2)?.jpeg.toString()).toBe("bild 1");
    expect(notified).toHaveLength(1);
  });

  test("refresh holt die genannten Kameras sofort (Vorschaubilder), ebenfalls gebremst", async () => {
    camera.refresh([0, 1, 2]);
    await vi.advanceTimersByTimeAsync(0);
    camera.refresh([0, 1, 2]);
    await vi.advanceTimersByTimeAsync(0);

    expect(calls.map((c) => c.n).sort()).toEqual([0, 1, 2]);
    await vi.advanceTimersByTimeAsync(600);
    expect(calls).toHaveLength(6);
  });

  test("info: je Kamera Version und Entzerrung", async () => {
    camera.refresh([2]);
    await vi.advanceTimersByTimeAsync(0);
    const info = await camera.info();

    expect(info.cams.map((c) => c.n)).toEqual([0, 1, 2]);
    expect(info.cams[2]?.version).toBe(1);
    expect(info.cams[0]?.version).toBeNull();
    expect(info.cams[2]?.matrix).toHaveLength(9);
  });
});

describe("wantedCamera", () => {
  test("Kamera der gezeigten Spielart, wenn ihre Scheibe die Kamera zeigt", () => {
    const profile = newProfile("P");
    expect(wantedCamera(profile, "x01")).toBeNull();
    profile.spielarten["x01"] = structuredClone(standardFor("x01"));
    profile.spielarten["x01"].content["scheibe"] = { ...profile.spielarten["x01"].content["scheibe"]!, darstellung: "kamera", kamera: "2" };
    expect(wantedCamera(profile, "x01")).toBe(2);
    expect(wantedCamera(profile, null)).toBe(2);
    expect(wantedCamera(profile, "cricket")).toBeNull();
  });

  test("Scheibe aus: keine Kamera", () => {
    const profile = newProfile("P");
    profile.spielarten["x01"] = structuredClone(standardFor("x01"));
    profile.spielarten["x01"].content["scheibe"] = { ...profile.spielarten["x01"].content["scheibe"]!, on: false, darstellung: "kamera" };
    expect(wantedCamera(profile, "x01")).toBeNull();
  });
});
