import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import WebSocket from "ws";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/http.js";
import { IDLE, toViewerState } from "../src/viewer/game-state.js";
import type { RecordedFrame } from "../src/viewer/recorder.js";
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
const profileMessages = (messages: string[]) =>
  messages.map((m) => JSON.parse(m)).filter((m) => m.type === "profile");

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
  test("schickt Katalog, Stand und aktives Profil, auch bei alter Adresse mit ?display=", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);

    const viewer = connect(`ws://${host}/ws?display=beamer`);
    await viewer.opened;

    await vi.waitFor(() => expect(viewer.messages).toHaveLength(3));
    expect(viewer.messages.map((m) => JSON.parse(m).type)).toEqual(["catalog", "state", "profile"]);
    expect(profileMessages(viewer.messages)[0]).toMatchObject({ profile: { id: "standard" }, editing: null });
  });

  test("ein neues Profil per POST erreicht alle Viewer", async () => {
    app = await buildApp(testDeps());
    const host = await listen(app);
    const a = connect(`ws://${host}/ws`);
    const b = connect(`ws://${host}/ws`);
    await Promise.all([a.opened, b.opened]);
    await vi.waitFor(() => expect(profileMessages(b.messages)).toHaveLength(1));

    await app.inject({
      method: "POST",
      url: "/api/profiles",
      headers: { "x-raspdarts": "1" },
      payload: { name: "TV" },
    });

    for (const viewer of [a, b]) {
      await vi.waitFor(() =>
        expect(profileMessages(viewer.messages).at(-1)).toMatchObject({
          profile: { id: "tv", version: 4, spielarten: {} },
          profiles: [{ id: "standard" }, { id: "tv" }],
        }),
      );
    }
  });
});
