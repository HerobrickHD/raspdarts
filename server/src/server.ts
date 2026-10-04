/**
 * Liefert die Beamer-Anzeige aus, verteilt den ScoreboardState an alle
 * verbundenen Anzeigen und verwaltet deren Layout.
 *
 * Es werden immer vollstaendige Snapshots gesendet, keine Deltas. Dadurch
 * haelt der Browser keinen eigenen Zustand und eine Anzeige, die sich spaeter
 * verbindet, ist sofort korrekt.
 */
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { IDLE, type ScoreboardState } from "./game-state.js";
import { LayoutStore } from "./layout-store.js";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export class ScoreboardServer {
  readonly #app = Fastify({ logger: false });
  readonly #clients = new Set<{ send: (data: string) => void }>();
  readonly #layouts: LayoutStore;
  #state: ScoreboardState = IDLE;

  constructor(
    private readonly port: number,
    layoutDir = "data/layouts",
  ) {
    this.#layouts = new LayoutStore(layoutDir);
  }

  async start(): Promise<void> {
    await this.#app.register(fastifyWebsocket);
    await this.#app.register(fastifyStatic, { root: PUBLIC_DIR });

    this.#app.get("/ws", { websocket: true }, (socket) => {
      this.#clients.add(socket);
      socket.send(JSON.stringify(this.#state));
      socket.on("close", () => this.#clients.delete(socket));
    });

    // Layout je Anzeige: der Beamer richtet sich anders aus als das Handy.
    this.#app.get<{ Params: { display: string } }>("/api/layout/:display", (request, reply) =>
      this.#withLayout(reply, () => this.#layouts.read(request.params.display)),
    );

    this.#app.put<{ Params: { display: string } }>("/api/layout/:display", (request, reply) =>
      this.#withLayout(reply, () => this.#layouts.write(request.params.display, request.body)),
    );

    await this.#app.listen({ port: this.port, host: "0.0.0.0" });
  }

  /** Ein ungueltiger Anzeigename ist ein Fehler des Aufrufers, kein Serverfehler. */
  #withLayout(reply: { code: (n: number) => { send: (body: unknown) => unknown } }, run: () => unknown) {
    try {
      return run();
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  }

  /** Setzt den Zustand und schiebt ihn an alle Anzeigen. */
  broadcast(state: ScoreboardState): void {
    this.#state = state;
    const payload = JSON.stringify(state);
    for (const client of this.#clients) {
      try {
        client.send(payload);
      } catch {
        this.#clients.delete(client);
      }
    }
  }

  get clientCount(): number {
    return this.#clients.size;
  }

  async stop(): Promise<void> {
    await this.#app.close();
  }
}
