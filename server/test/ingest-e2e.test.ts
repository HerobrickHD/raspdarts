import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import WebSocket from "ws";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/http.js";
import { IDLE, toViewerState } from "../src/viewer/game-state.js";
import type { RecordedFrame } from "../src/viewer/recorder.js";
import { DEFAULT_LAYOUT } from "../src/viewer/layout.js";
import { listen, testDeps } from "./helpers.js";

const EXTENSION = "chrome-extension://abcdefghijklmnop";

let app: FastifyInstance;
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await app.close();
});

/** Oeffnet einen WebSocket und sammelt ab dem ersten Moment alle Nachrichten. */
function connect(url: string, origin?: string) {
  const socket = origin === undefined ? new WebSocket(url) : new WebSocket(url, { origin });
  sockets.push(socket);
  const messages: string[] = [];
  socket.on("message", (data) => messages.push(data.toString()));
  const opened = new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("unexpected-response", (_request, response) =>
      reject(new Error(`HTTP ${response.statusCode}`)),
    );
    socket.once("error", reject);
  });
  return { socket, messages, opened };
}

/** Nur die Stand-Nachrichten eines Viewers, in Reihenfolge. */
const states = (messages: string[]) =>
  messages.map((m) => JSON.parse(m)).filter((m) => m.type === "state").map((m) => m.state);
const layouts = (messages: string[]) =>
  messages.map((m) => JSON.parse(m)).filter((m) => m.type === "layout");

describe("/ingest", () => {
  test("nimmt Verbindungen der Extension an", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    const host = await listen(app);

    await connect(`ws://${host}/ingest`, EXTENSION).opened;

    await vi.waitFor(() => expect(deps.ingest.status().ingest_connected).toBe(true));
  });

  test("weist Webseiten ab", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);

    await expect(connect(`ws://${host}/ingest`, "https://evil.example").opened).rejects.toThrow(
      "HTTP 403",
    );
  });

  test("weist Verbindungen ohne Origin ab", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);

    await expect(connect(`ws://${host}/ingest`).opened).rejects.toThrow("HTTP 403");
  });

  test("macht aus der Demo-Aufzeichnung den erwarteten Stand an /ws", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);
    const frames = readFileSync("test/fixtures/demo-session.ndjson", "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => (JSON.parse(line) as RecordedFrame).frame);
    const expected = frames
      .map((frame) => toViewerState(frame))
      .filter((state) => state !== IDLE)
      .at(-1);

    const display = connect(`ws://${host}/ws`);
    const ingest = connect(`ws://${host}/ingest`, EXTENSION);
    await Promise.all([display.opened, ingest.opened]);
    for (const frame of frames) ingest.socket.send(JSON.stringify(frame));

    await vi.waitFor(() => expect(states(display.messages).at(-1)).toEqual(expected));
  });
});

describe("/ws", () => {
  test("nutzt bei ungueltigem Anzeigenamen das Layout standard", async () => {
    const deps = testDeps();
    deps.hub.updateLayout("standard", { version: 2, board: { cx: 33, cy: 50, diameter: 50, rotation: 0 } }, false);
    app = await buildApp(deps);
    const host = await listen(app);

    const viewer = connect(`ws://${host}/ws?display=Wohnzimmer%20TV`);
    await viewer.opened;

    await vi.waitFor(() => expect(layouts(viewer.messages).at(-1)?.layout.board.cx).toBe(33));
  });

  test("Layout-Aenderung per PUT erreicht nur Viewer derselben Anzeige", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);
    const beamer = connect(`ws://${host}/ws?display=beamer`);
    const tv = connect(`ws://${host}/ws?display=tv`);
    await Promise.all([beamer.opened, tv.opened]);
    await vi.waitFor(() => expect(layouts(tv.messages)).toHaveLength(1));

    await app.inject({
      method: "PUT",
      url: "/api/layout/beamer",
      headers: { "x-raspdarts": "1" },
      payload: { layout: { version: 2, boardMode: "drawn" }, editing: true },
    });

    await vi.waitFor(() =>
      expect(layouts(beamer.messages).at(-1)).toMatchObject({ layout: { boardMode: "drawn" }, editing: true }),
    );
    expect(layouts(tv.messages)).toEqual([{ type: "layout", layout: DEFAULT_LAYOUT, editing: false }]);
  });
});
