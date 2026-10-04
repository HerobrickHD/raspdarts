import { describe, expect, test } from "vitest";
import { DisplayHub, type DisplaySocket } from "../src/beamer/display-hub.js";
import { IDLE, type ScoreboardState } from "../src/beamer/game-state.js";

function fakeSocket() {
  const sent: string[] = [];
  let onClose = () => {};
  const socket: DisplaySocket = {
    send: (data) => sent.push(data),
    on: (_event, listener) => (onClose = listener),
  };
  return { socket, sent, close: () => onClose() };
}

const FINISHED: ScoreboardState = { phase: "finished", winner: "Arnold" };

describe("DisplayHub", () => {
  test("schickt einer neuen Anzeige sofort den aktuellen Stand", () => {
    const hub = new DisplayHub();
    const display = fakeSocket();

    hub.attach(display.socket);

    expect(display.sent).toEqual([JSON.stringify(IDLE)]);
  });

  test("verteilt neue Staende an alle Anzeigen und merkt sich den letzten", () => {
    const hub = new DisplayHub();
    const a = fakeSocket();
    const b = fakeSocket();
    hub.attach(a.socket);
    hub.attach(b.socket);

    hub.broadcast(FINISHED);

    expect(a.sent.at(-1)).toBe(JSON.stringify(FINISHED));
    expect(b.sent.at(-1)).toBe(JSON.stringify(FINISHED));
    expect(hub.state).toEqual(FINISHED);
  });

  test("vergisst geschlossene Anzeigen", () => {
    const hub = new DisplayHub();
    const display = fakeSocket();
    hub.attach(display.socket);

    display.close();

    expect(hub.clientCount).toBe(0);
  });
});
