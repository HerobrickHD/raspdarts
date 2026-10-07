/**
 * Die eine Fastify-App des Dienstes: Beamer-Anzeige, Spieldaten-Annahme und
 * Pi-Verwaltung auf einem Port.
 *
 * Schutz: Alles unter /api/ verlangt den Header X-Raspdarts: 1. Ein Browser
 * schickt einen eigenen Header von einer fremden Seite nur nach einer
 * CORS-Freigabe - und die gibt dieser Server nie. Damit kann keine Webseite,
 * die jemand im Heimnetz oeffnet, den Pi steuern.
 *
 * Zusaetzlich muss der Host-Header zu /api passen (raspdarts.local, raspdarts,
 * localhost oder eine IP-Adresse). Sonst koennte eine Webseite ihren eigenen
 * Namen per DNS-Rebinding auf die Adresse des Pi legen, damit same-origin
 * werden und den Header selbst setzen.
 */
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import type { DisplayHub } from "./beamer/display-hub.js";
import { isExtensionOrigin, type Ingest } from "./beamer/ingest.js";
import type { LayoutStore } from "./beamer/layout-store.js";
import type { JobRunner } from "./system/jobs.js";
import type { SystemStatus } from "./system/status.js";

export const CLIENT_HEADER = "x-raspdarts";

const ALLOWED_HOSTNAMES = new Set(["raspdarts.local", "raspdarts", "localhost"]);
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_BRACKETED = /^\[[0-9a-f:.]+\]$/;

/** Erlaubt nur Namen des Pi und IP-Adressen; alles andere ist ein fremder Name. */
export function isAllowedHost(host: string | undefined): boolean {
  if (!host) return false;
  const lower = host.toLowerCase();
  const name = lower.startsWith("[") ? lower.slice(0, lower.indexOf("]") + 1) : lower.replace(/:\d*$/, "");
  return ALLOWED_HOSTNAMES.has(name) || IPV4.test(name) || IPV6_BRACKETED.test(name);
}

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export interface AppDeps {
  hub: DisplayHub;
  layouts: LayoutStore;
  ingest: Ingest;
  status: () => Promise<SystemStatus>;
  jobs: JobRunner;
}

/** Langlaeufer: Ausgabe wird zeilenweise als Server-Sent Events gestreamt. */
const JOB_ROUTES: Record<string, string> = {
  "/api/system/update": "raspdarts-update.sh",
  "/api/system/uninstall": "raspdarts-uninstall.sh",
};

/** Sofort-Aktionen: erst antworten, dann ausfuehren - danach ist der Pi weg. */
const POWER_ROUTES: Record<string, string> = {
  "/api/system/reboot": "reboot.sh",
  "/api/system/shutdown": "shutdown.sh",
};

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (request, reply) => {
    // Geprueft wird die erkannte Route, nicht die rohe URL (Prozent-Kodierung).
    if (!request.routeOptions.url?.startsWith("/api/")) return;
    if (!isAllowedHost(request.headers.host)) {
      return reply.code(403).send({ error: "Unbekannter Host" });
    }
    if (request.headers[CLIENT_HEADER] !== "1") {
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

  for (const [path, script] of Object.entries(JOB_ROUTES)) {
    app.post(path, (_request, reply) => {
      if (deps.jobs.busy) return reply.code(409).send({ error: "Already running" });

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      });
      // Kopfzeilen sofort senden: der Aufrufer soll den Stream sehen, bevor
      // das Skript die erste Zeile ausgibt.
      raw.flushHeaders();
      deps.jobs.run(script, (event) => {
        if (raw.writableEnded || raw.destroyed) return;
        raw.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.type === "done") raw.end();
      });
    });
  }

  for (const [path, script] of Object.entries(POWER_ROUTES)) {
    app.post(path, async (_request, reply) => {
      // Mitten in einer Installation oder einem Update darf der Pi nicht ausgehen.
      if (deps.jobs.busy) return reply.code(409).send({ error: "Already running" });
      setTimeout(() => deps.jobs.fire(script), 500);
      return { ok: true };
    });
  }

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
