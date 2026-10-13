import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { IDLE, MISS, toField, toViewerState, type ViewerState } from "../src/viewer/game-state.js";
import type { RecordedFrame } from "../src/viewer/recorder.js";

/**
 * Echter Mitschnitt vom 8. Oktober 2026 (docs/referenz/autodarts-spielansicht/):
 * 301 SI-SO, 1 Leg, testuser01 gegen den lokalen Spieler TEST. Index = Zeile
 * in der Datei, ab 0 gezaehlt (= Index im Mitschnitt).
 */
const FRAMES = readFileSync("test/fixtures/autodarts-2026-10-08.ndjson", "utf8")
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .map((line) => (JSON.parse(line) as RecordedFrame).frame);

type Playing = Extract<ViewerState, { phase: "playing" }>;

function playingAt(index: number): Playing {
  const state = toViewerState(FRAMES[index]);
  if (state.phase !== "playing") throw new Error(`Frame ${index} ist kein laufendes Spiel`);
  return state;
}

const T20 = { multiplier: 3, number: 20, ring: null };
const GRAVATAR = "https://gravatar.com/avatar/0f8c028d2738c5edbd60683b2222996c";

describe("toViewerState mit dem Mitschnitt", () => {
  test("ein Dart: Rest, Averages, Spieldaten und Hervorhebung", () => {
    const state = playingAt(106);

    expect(state.variant).toBe("X01");
    expect(state.mode).toBe("x01");
    expect(state.match).toEqual({
      baseScore: 301,
      legsToWin: 1,
      setsToWin: null,
      inMode: "Straight",
      outMode: "Straight",
    });
    expect(state.players[0]).toEqual({
      seat: 1,
      name: "testuser01",
      avatarUrl: GRAVATAR,
      country: "de",
      score: 241,
      legs: 0,
      sets: 0,
      average: { leg: 180, match: 180 },
      dartsThrown: 1,
      isActive: true,
      isWinner: false,
      busted: false,
      checkout: null,
    });
    expect(state.players[1]).toMatchObject({
      seat: 2,
      name: "TEST",
      avatarUrl: null,
      country: null,
      score: 301,
      isActive: false,
    });
    expect(state.turn).toEqual({
      darts: [{ field: T20, coords: { x: -0.03407105416423997, y: 0.5896913220733837 } }],
      points: 60,
      busted: false,
    });
    expect(state.highlights).toEqual([{ field: T20, kind: "last-dart" }]);
  });

  test("drei Darts: Single mit Ring, Bull, letzter Dart hervorgehoben", () => {
    const state = playingAt(111);

    expect(state.turn.darts.map((dart) => dart.field)).toEqual([
      T20,
      { multiplier: 1, number: 12, ring: "outer" },
      { multiplier: 2, number: 25, ring: null },
    ]);
    expect(state.turn.points).toBe(122);
    expect(state.players[0].score).toBe(179);
    expect(state.highlights).toEqual([
      { field: { multiplier: 2, number: 25, ring: null }, kind: "last-dart" },
    ]);
  });

  test("Spielerwechsel: neuer aktiver Spieler, leere Aufnahme, keine Hervorhebung", () => {
    const state = playingAt(113);

    expect(state.players.map((player) => player.isActive)).toEqual([false, true]);
    expect(state.turn).toEqual({ darts: [], points: 0, busted: false });
    expect(state.highlights).toEqual([]);
  });

  test("Bust: Rest zurueckgesetzt, Karte und Aufnahme als ueberworfen markiert", () => {
    const state = playingAt(129);

    expect(state.players[0]).toMatchObject({ score: 179, busted: true, isActive: true });
    expect(state.players[1].busted).toBe(false);
    expect(state.turn.busted).toBe(true);
    expect(state.turn.darts).toHaveLength(3);
  });

  test("Checkout-Weg auch dann, wenn er erst fuer die naechste Aufnahme gilt", () => {
    // 119 Rest nach einem Dart, Weg mit drei Darts - Autodarts zeigt ihn trotzdem.
    const state = playingAt(124);

    expect(state.players[0].checkout).toEqual([
      T20,
      { multiplier: 2, number: 20, ring: null },
      { multiplier: 1, number: 19, ring: null },
    ]);
    expect(state.players[1].checkout).toBeNull();
  });

  test("Checkout-Weg fuer jeden Spieler, nicht nur den aktiven", () => {
    const state = playingAt(142);

    expect(state.players[0].isActive).toBe(true);
    expect(state.players[1].checkout).toEqual([
      T20,
      { multiplier: 3, number: 19, ring: null },
      { multiplier: 2, number: 18, ring: null },
    ]);
  });

  test("Sieger: gruene Karte statt eigenem Endzustand, leerer Weg wird null", () => {
    const state = playingAt(156);

    expect(state.players[1]).toMatchObject({ isWinner: true, legs: 1, score: 0, checkout: null });
    expect(state.players[0]).toMatchObject({ isWinner: false, checkout: [{ multiplier: 1, number: 9, ring: null }] });
  });

  test("Nachrichten ohne Spielstand ergeben idle", () => {
    expect(toViewerState(FRAMES[0])).toEqual(IDLE); // autodarts.users
    const gameEvent = FRAMES.find(
      (frame) => JSON.stringify(frame).includes('"event":"throw"'),
    );
    expect(toViewerState(gameEvent)).toEqual(IDLE);
  });
});

describe("toViewerState mit Ersatzwerten", () => {
  test("idle ohne Match", () => {
    expect(toViewerState(null)).toEqual(IDLE);
    expect(toViewerState({ irgendwas: true })).toEqual(IDLE);
  });


  test("drei Spieler ohne turns, stats und settings", () => {
    const state = toViewerState({
      variant: "X01",
      player: 2,
      players: [{ name: "A" }, {}, { name: "C", avatarUrl: "" }],
      gameScores: [501, 480],
      winner: -1,
    });

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.players).toHaveLength(3);
    expect(state.players[1]).toEqual({
      seat: 2,
      name: "Spieler 2",
      avatarUrl: null,
      country: null,
      score: 480,
      legs: 0,
      sets: 0,
      average: { leg: 0, match: 0 },
      dartsThrown: 0,
      isActive: false,
      isWinner: false,
      busted: false,
      checkout: null,
    });
    expect(state.players[2]).toMatchObject({ name: "C", score: 0, isActive: true });
    // ohne settings: nichts geraten
    expect(state.match).toEqual({
      baseScore: null,
      legsToWin: 1,
      setsToWin: null,
      inMode: null,
      outMode: null,
    });
    expect(state.turn).toEqual({ darts: [], points: 0, busted: false });
  });

  test("Daneben als letzter Dart: keine Hervorhebung, Dart ohne Koordinaten", () => {
    const state = toViewerState({
      variant: "X01",
      player: 0,
      players: [{ name: "A" }],
      gameScores: [501],
      turns: [{ throws: [{ segment: { number: 0, multiplier: 0, bed: "Outside" } }] }],
    });

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.turn.darts).toEqual([{ field: MISS, coords: null }]);
    expect(state.highlights).toEqual([]);
  });

  test("Saetze werden uebernommen, wenn Autodarts sie meldet", () => {
    const state = toViewerState({
      variant: "X01",
      players: [{ name: "A" }],
      gameScores: [501],
      legs: 3,
      sets: 2,
      settings: { baseScore: 501, inMode: "Double", outMode: "Master" },
    });

    if (state.phase !== "playing") throw new Error("unerreichbar");
    expect(state.match).toEqual({
      baseScore: 501,
      legsToWin: 3,
      setsToWin: 2,
      inMode: "Double",
      outMode: "Master",
    });
  });
});

describe("toField", () => {
  test("liest Triple, Double, Bull und den Teil eines Single", () => {
    expect(toField({ bed: "Triple", multiplier: 3, number: 20 })).toEqual(T20);
    expect(toField({ bed: "Double", multiplier: 2, number: 25 })).toEqual({
      multiplier: 2,
      number: 25,
      ring: null,
    });
    expect(toField({ bed: "SingleInner", multiplier: 1, number: 5 })).toEqual({
      multiplier: 1,
      number: 5,
      ring: "inner",
    });
    expect(toField({ bed: "Single", multiplier: 1, number: 19 })).toEqual({
      multiplier: 1,
      number: 19,
      ring: null,
    });
  });

  test("macht aus allem Unbrauchbaren einen Daneben-Wurf", () => {
    expect(toField(null)).toEqual(MISS);
    expect(toField({ number: 0, multiplier: 1 })).toEqual(MISS);
    expect(toField({ number: 21, multiplier: 1 })).toEqual(MISS);
    expect(toField({ number: 25, multiplier: 3 })).toEqual(MISS);
    expect(toField({ number: 20, multiplier: 4 })).toEqual(MISS);
  });
});

/** Ein Frame aus dem Mitschnitt, umgebaut. */
function rewritten(index: number, change: (state: Record<string, unknown>) => void): unknown {
  const frame = structuredClone(FRAMES[index]) as Record<string, unknown>;
  const state = (frame["data"] ?? frame) as Record<string, unknown>;
  change(state);
  return frame;
}

describe("andere Spielarten", () => {
  test("Cricket: allgemeiner Stand mit Spielern, Aufnahme und Spielart", () => {
    const state = toViewerState(
      rewritten(106, (s) => {
        s["variant"] = "Cricket";
        s["settings"] = {};
      }),
    );
    if (state.phase !== "playing") throw new Error("kein Spiel");
    expect(state.mode).toBe("cricket");
    expect(state.variant).toBe("Cricket");
    expect(state.players).toHaveLength(2);
    expect(state.players[0]?.name).toBe("testuser01");
    expect(state.turn.darts).toHaveLength(1);
    expect(state.match).toEqual({ baseScore: null, legsToWin: 1, setsToWin: null, inMode: null, outMode: null });
  });

  test("unbekannte Spielart: mode null, trotzdem ein Spiel", () => {
    const state = toViewerState(rewritten(106, (s) => (s["variant"] = "Killer")));
    expect(state.phase).toBe("playing");
    if (state.phase === "playing") expect(state.mode).toBeNull();
  });
});

describe("Reihenfolge", () => {
  test("seat folgt der Reihenfolge, die Autodarts schickt - auch wenn sie sich aendert", () => {
    const swapped = rewritten(106, (s) => {
      // wie ein neues Leg, in dem Autodarts die Spieler umstellt
      for (const key of ["players", "gameScores", "scores", "stats"]) {
        if (Array.isArray(s[key])) (s[key] as unknown[]).reverse();
      }
    });
    const before = playingAt(106);
    const after = toViewerState(swapped);
    if (after.phase !== "playing") throw new Error("kein Spiel");

    expect(before.players.map((p) => [p.name, p.seat])).toEqual([
      ["testuser01", 1],
      ["TEST", 2],
    ]);
    expect(after.players.map((p) => [p.name, p.seat])).toEqual([
      ["TEST", 1],
      ["testuser01", 2],
    ]);
  });
});
