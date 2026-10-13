/**
 * Die eine Fastify-App des Dienstes: Viewer, Spieldaten-Annahme und
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
import { parseEditing, type DisplayHub } from "./viewer/display-hub.js";
import { IDLE } from "./viewer/game-state.js";
import { isExtensionOrigin, type Ingest } from "./viewer/ingest.js";
import { ProfileError, type ProfileErrorCode, type ProfileStore } from "./viewer/profile-store.js";
import type { CamFailure, Cams } from "./system/cams.js";
import type { BoardCamera } from "./viewer/board-camera.js";
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
  profiles: ProfileStore;
  ingest: Ingest;
  status: () => Promise<SystemStatus>;
  jobs: JobRunner;
  cams: Cams;
  boardCamera: Pick<BoardCamera, "info" | "latest" | "refresh">;
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

const CAM_FAILURE_CODES: Record<CamFailure, number> = {
  "not-found": 404,
  "board-stopped": 409,
  unavailable: 502,
};

const PROFILE_ERROR_CODES: Record<ProfileErrorCode, number> = {
  "invalid-id": 400,
  "invalid-mode": 400,
  "not-found": 404,
  "last-profile": 409,
};

type Fields = Record<string, unknown>;
const fields = (body: unknown): Fields => (typeof body === "object" && body !== null ? body : {}) as Fields;

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

  // Alle Viewer zeigen das aktive Profil; ?display= alter Kiosk-Adressen wird ignoriert.
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

  // Die Extension meldet "Weitergabe ausgeschaltet": Viewer sollen nicht auf
  // dem letzten Stand stehen bleiben. Ein blosser Verbindungsabbruch setzt
  // bewusst nichts zurueck (WLAN-Wackler mitten im Spiel).
  app.post("/api/ingest/reset", async () => {
    deps.hub.broadcast(IDLE);
    return { ok: true };
  });

  // Profile: was der Viewer zeigt und wo. Jede Aenderung geht sofort an alle Viewer.
  app.get("/api/profiles", async () => ({ active: deps.profiles.activeId, profiles: deps.profiles.list() }));

  app.get<{ Params: { id: string } }>("/api/profiles/:id", async (request, reply) =>
    withProfiles(reply, () => deps.profiles.read(request.params.id)),
  );

  app.post<{ Body: unknown }>("/api/profiles", async (request, reply) =>
    withProfiles(reply, () => {
      const profile = deps.profiles.create(fields(request.body)["name"]);
      deps.hub.publishProfile();
      reply.code(201);
      return profile;
    }),
  );

  app.put<{ Params: { id: string }; Body: unknown }>("/api/profiles/:id", async (request, reply) =>
    withProfiles(reply, () => {
      const { id } = request.params;
      const body = fields(request.body);
      const profile = deps.profiles.update(id, {
        name: body["name"],
        format: body["format"],
        spielart: body["spielart"],
      });
      // Einstellen betrifft, was die Viewer zeigen - also nur das aktive Profil.
      if (body["editing"] !== undefined && id === deps.profiles.activeId) {
        deps.hub.setEditing(parseEditing(body["editing"]));
      }
      deps.hub.publishProfile();
      return profile;
    }),
  );

  app.post<{ Params: { id: string }; Body: unknown }>("/api/profiles/:id/reset", async (request, reply) =>
    withProfiles(reply, () => {
      const profile = deps.profiles.resetMode(request.params.id, fields(request.body)["spielart"]);
      deps.hub.publishProfile();
      return profile;
    }),
  );

  // Inhalte und Layout einer Spielart in eine andere kopieren ("Uebernehmen von").
  app.post<{ Params: { id: string }; Body: unknown }>("/api/profiles/:id/copy", async (request, reply) =>
    withProfiles(reply, () => {
      const body = fields(request.body);
      const profile = deps.profiles.copyMode(request.params.id, body["von"], body["nach"]);
      deps.hub.publishProfile();
      return profile;
    }),
  );

  app.delete<{ Params: { id: string } }>("/api/profiles/:id", async (request, reply) =>
    withProfiles(reply, () => {
      deps.profiles.remove(request.params.id);
      deps.hub.publishProfile();
      return reply.code(204).send();
    }),
  );

  app.put<{ Body: unknown }>("/api/active-profile", async (request, reply) =>
    withProfiles(reply, () => {
      const id = fields(request.body)["id"];
      deps.profiles.setActive(typeof id === "string" ? id : "");
      deps.hub.publishProfile();
      return { active: deps.profiles.activeId };
    }),
  );

  app.get("/api/status", async (_request, reply) => {
    try {
      return { ...(await deps.status()), beamer: deps.ingest.status() };
    } catch (error) {
      return reply.code(500).send({ error: (error as Error).message });
    }
  });

  // Kamerabilder fuer die Boards-Seite der Extension; die Bremse steckt in cams.ts.
  app.get("/api/cams", async (_request, reply) => {
    try {
      return await deps.cams.info();
    } catch {
      return reply.code(502).send({ error: "unavailable" });
    }
  });

  app.get<{ Params: { n: string } }>("/api/cams/:n", async (request, reply) => {
    const n = /^\d+$/.test(request.params.n) ? Number(request.params.n) : -1;
    const result = await deps.cams.image(n);
    if (result.ok) return reply.header("cache-control", "no-store").type("image/jpeg").send(result.jpeg);
    return reply.code(CAM_FAILURE_CODES[result.reason]).send({ error: result.reason });
  });

  // Kamera-Ansicht der Scheibe: letztes Bild je Kamera aus board-camera.ts -
  // Autodarts wird dabei nicht gefragt, die Bremse steckt dort.
  app.get("/api/board-camera", async () => deps.boardCamera.info());

  app.get<{ Params: { n: string } }>("/api/board-camera/:n", async (request, reply) => {
    const latest = /^\d+$/.test(request.params.n) ? deps.boardCamera.latest(Number(request.params.n)) : null;
    if (!latest) return reply.code(404).send({ error: "not-found" });
    return reply.header("cache-control", "no-store").type("image/jpeg").send(latest.jpeg);
  });

  app.post<{ Body: unknown }>("/api/board-camera/refresh", async (request) => {
    const raw = fields(request.body)["cams"];
    const cams = Array.isArray(raw) ? raw.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 8) : [];
    deps.boardCamera.refresh(cams);
    return { ok: true };
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

/** Fehler des Aufrufers (ungueltige id, letztes Profil ...) sind keine Serverfehler. */
function withProfiles(reply: FastifyReply, run: () => unknown) {
  try {
    return run();
  } catch (error) {
    if (error instanceof ProfileError) {
      return reply.code(PROFILE_ERROR_CODES[error.code]).send({ error: error.message });
    }
    throw error;
  }
}
