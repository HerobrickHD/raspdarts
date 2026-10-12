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

  test("bleibt idle ohne Spielstand", () => {
    const hub = newHub();
    createFramePipeline(hub, null)({ irgendwas: 1 });
    expect(hub.state).toBe(IDLE);
  });
});
