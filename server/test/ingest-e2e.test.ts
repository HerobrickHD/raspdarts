import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import WebSocket from "ws";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/http.js";
import { IDLE, toScoreboardState } from "../src/beamer/game-state.js";
import type { RecordedFrame } from "../src/beamer/recorder.js";
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
      .map((frame) => toScoreboardState(frame))
      .filter((state) => state !== IDLE)
      .at(-1);

    const display = connect(`ws://${host}/ws`);
    const ingest = connect(`ws://${host}/ingest`, EXTENSION);
    await Promise.all([display.opened, ingest.opened]);
    for (const frame of frames) ingest.socket.send(JSON.stringify(frame));

    await vi.waitFor(() => {
      const last = display.messages.at(-1);
      expect(last && JSON.parse(last)).toEqual(expected);
    });
  });
});
