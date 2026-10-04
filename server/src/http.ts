/**
 * Die eine Fastify-App des Dienstes: Beamer-Anzeige, Spieldaten-Annahme und
 * Pi-Verwaltung auf einem Port.
 *
 * Schutz: Alles unter /api/ verlangt den Header X-Raspdarts: 1. Ein Browser
 * schickt einen eigenen Header von einer fremden Seite nur nach einer
 * CORS-Freigabe - und die gibt dieser Server nie. Damit kann keine Webseite,
 * die jemand im Heimnetz oeffnet, den Pi steuern.
 */
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import type { DisplayHub } from "./beamer/display-hub.js";
import { isExtensionOrigin, type Ingest } from "./beamer/ingest.js";
import type { LayoutStore } from "./beamer/layout-store.js";
import type { SystemStatus } from "./system/status.js";

export const CLIENT_HEADER = "x-raspdarts";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export interface AppDeps {
  hub: DisplayHub;
  layouts: LayoutStore;
  ingest: Ingest;
  status: () => Promise<SystemStatus>;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (request, reply) => {
    // Geprueft wird die erkannte Route, nicht die rohe URL (Prozent-Kodierung).
    if (request.routeOptions.url?.startsWith("/api/") && request.headers[CLIENT_HEADER] !== "1") {
      return reply.code(403).send({ error: "X-Raspdarts-Header fehlt" });
    }
  });

  await app.register(fastifyWebsocket);
  await app.register(fastifyStatic, { root: PUBLIC_DIR });

  app.get("/ws", { websocket: true }, (socket) => deps.hub.attach(socket));

  app.get(
    "/ingest",
    {
      websocket: true,
      preValidation: async (request, reply) => {
        if (!isExtensionOrigin(request.headers.origin)) {
          return reply.code(403).send({ error: "Nur fuer die Raspdarts-Extension" });
        }
      },
    },
    (socket) => {
      deps.ingest.open();
      socket.on("message", (data) => deps.ingest.receive(data.toString()));
      socket.on("close", () => deps.ingest.close());
    },
  );

  // Layout je Anzeige: der Beamer richtet sich anders aus als das Handy.
  app.get<{ Params: { display: string } }>("/api/layout/:display", (request, reply) =>
    withLayout(reply, () => deps.layouts.read(request.params.display)),
  );
  app.put<{ Params: { display: string } }>("/api/layout/:display", (request, reply) =>
    withLayout(reply, () => deps.layouts.write(request.params.display, request.body)),
  );

  app.get("/api/status", async (_request, reply) => {
    try {
      return { ...(await deps.status()), beamer: deps.ingest.status() };
    } catch (error) {
      return reply.code(500).send({ error: (error as Error).message });
    }
  });

  return app;
}

/** Ein ungueltiger Anzeigename ist ein Fehler des Aufrufers, kein Serverfehler. */
function withLayout(reply: FastifyReply, run: () => unknown) {
  try {
    return run();
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
}
