import { describe, expect, test, vi } from "vitest";
import { DisplayHub } from "../src/beamer/display-hub.js";
import { IDLE } from "../src/beamer/game-state.js";
import { createFramePipeline } from "../src/beamer/pipeline.js";

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
    const hub = new DisplayHub();
    const recorder = { write: vi.fn() };
    const handle = createFramePipeline(hub, recorder);

    handle(MATCH_FRAME);

    expect(recorder.write).toHaveBeenCalledWith(MATCH_FRAME);
    expect(hub.state.phase).toBe("playing");
  });

  test("laesst den Stand stehen, wenn eine Nachricht kein Spielstand ist", () => {
    const hub = new DisplayHub();
    const handle = createFramePipeline(hub, null);
    handle(MATCH_FRAME);

    handle({ channel: "autodarts.boards", data: { status: "Throw" } });

    expect(hub.state.phase).toBe("playing");
  });

  test("bleibt idle ohne Spielstand", () => {
    const hub = new DisplayHub();
    createFramePipeline(hub, null)({ irgendwas: 1 });
    expect(hub.state).toBe(IDLE);
  });
});
