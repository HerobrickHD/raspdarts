import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { DisplayHub } from "../src/viewer/display-hub.js";
import { IDLE } from "../src/viewer/game-state.js";
import { createFramePipeline } from "../src/viewer/pipeline.js";
import { ProfileStore } from "../src/viewer/profile-store.js";

const newHub = () => new DisplayHub(new ProfileStore(mkdtempSync(join(tmpdir(), "pipeline-test-"))));

const MATCH_FRAME = {
  channel: "autodarts.matches",
  topic: "x.state",
  data: {
    variant: "X01",
    player: 0,
    players: [{ name: "Arnold" }],
    gameScores: [40],
    scores: [{ legs: 0 }],
    turns: [{ throws: [] }],
    winner: -1,
  },
};

describe("createFramePipeline", () => {
  test("zeichnet jede Nachricht auf und verteilt Spielstaende", () => {
    const hub = newHub();
    const recorder = { write: vi.fn() };
    const handle = createFramePipeline(hub, recorder);

    handle(MATCH_FRAME);

    expect(recorder.write).toHaveBeenCalledWith(MATCH_FRAME);
    expect(hub.state.phase).toBe("playing");
  });

  test("laesst den Stand stehen, wenn eine Nachricht kein Spielstand ist", () => {
    const hub = newHub();
    const handle = createFramePipeline(hub, null);
    handle(MATCH_FRAME);

    handle({ channel: "autodarts.boards", data: { status: "Throw" } });

    expect(hub.state.phase).toBe("playing");
  });

  test("aktualisiert die Anzeige auch wenn die Aufzeichnung fehlschlaegt", () => {
    const hub = newHub();
    const recorder = {
      write: () => {
        throw new Error("Platte voll");
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    createFramePipeline(hub, recorder)(MATCH_FRAME);

    expect(warn).toHaveBeenCalled();
    expect(hub.state.phase).toBe("playing");
  });

  test("meldet eine unbekannte Spielart einmal je Wert und zeigt sie trotzdem", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hub = newHub();
    const handle = createFramePipeline(hub, null);
    const killer = { ...MATCH_FRAME, data: { ...MATCH_FRAME.data, variant: "Killer" } };

    handle(killer);
    handle(killer);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("Killer");
    expect(hub.state).toMatchObject({ phase: "playing", mode: null, variant: "Killer" });
    warn.mockRestore();
  });

  test("meldet jeden neuen Stand mit dem vorigen an die Kamera-Ansicht", () => {
    const hub = newHub();
    const seen: [string, string][] = [];
    const camera = { onState: (prev: { phase: string }, next: { phase: string }) => seen.push([prev.phase, next.phase]) };
    const handle = createFramePipeline(hub, null, camera);

    handle(MATCH_FRAME);
    handle(MATCH_FRAME);

    expect(seen).toEqual([
      ["idle", "playing"],
      ["playing", "playing"],
    ]);
  });

  test("Spiel abgebrochen: das Loeschen des gezeigten Matches setzt die Anzeige auf Warten", () => {
    const hub = newHub();
    const handle = createFramePipeline(hub, null);
    const shown = { ...MATCH_FRAME, data: { ...MATCH_FRAME.data, id: "m-1" } };
    handle(shown);

    handle({ channel: "autodarts.matches", topic: "m-2.events", data: { body: {}, event: "delete", id: "m-2" } });
    expect(hub.state.phase).toBe("playing");

    handle({ channel: "autodarts.matches", topic: "m-1.events", data: { body: {}, event: "delete", id: "m-1" } });
    expect(hub.state).toBe(IDLE);
  });

  test("bleibt idle ohne Spielstand", () => {
    const hub = newHub();
    createFramePipeline(hub, null)({ irgendwas: 1 });
    expect(hub.state).toBe(IDLE);
  });
});
