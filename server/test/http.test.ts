import { connect, type AddressInfo } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp, isAllowedHost } from "../src/http.js";
import { createCams, type AutodartsHttp, type Cams } from "../src/system/cams.js";
import type { DisplaySocket } from "../src/viewer/display-hub.js";
import { toViewerState } from "../src/viewer/game-state.js";
import { standard } from "../src/viewer/standards.js";
import { testDeps } from "./helpers.js";

let app: FastifyInstance;
afterEach(async () => app.close());

describe("Header-Schutz", () => {
  test("weist /api-Anfragen ohne X-Raspdarts mit 403 ab", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/api/profiles" });

    expect(response.statusCode).toBe(403);
  });

  test("weist einen falschen Header-Wert ab", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/profiles",
      headers: { "x-raspdarts": "ja" },
    });

    expect(response.statusCode).toBe(403);
  });

  test("laesst /api-Anfragen mit X-Raspdarts: 1 durch", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/profiles",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ active: "standard", profiles: [{ id: "standard", name: "Standard" }] });
  });

  test("laesst sich nicht durch Prozent-Kodierung des Pfads umgehen", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/%61pi/profiles" });

    expect(response.statusCode).toBe(403);
  });

  test("liefert die Anzeige selbst ohne Header aus", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });

  test("beantwortet keine CORS-Vorabanfrage positiv", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/profiles",
      headers: { origin: "https://evil.example", "access-control-request-method": "PUT" },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("Host-Pruefung (DNS-Rebinding)", () => {
  const get = (host: string) =>
    app.inject({
      method: "GET",
      url: "/api/profiles",
      headers: { "x-raspdarts": "1", host },
    });

  test("weist einen fremden Host mit 403 ab", async () => {
    app = await buildApp(testDeps());

    const response = await get("evil.example");

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Unbekannter Host" });
  });

  test("laesst raspdarts.local durch", async () => {
    app = await buildApp(testDeps());

    expect((await get("raspdarts.local:8743")).statusCode).toBe(200);
  });

  test("laesst eine IP-Adresse durch", async () => {
    app = await buildApp(testDeps());

    expect((await get("192.168.1.42:8743")).statusCode).toBe(200);
  });
});

describe("isAllowedHost", () => {
  test.each([
    "raspdarts.local",
    "RASPDARTS.LOCAL:8743",
    "raspdarts",
    "raspdarts.fritz.box:8743",
    "localhost:8743",
    "127.0.0.1",
    "192.168.1.42:8743",
    "[::1]:8743",
  ])("erlaubt %s", (host) => {
    expect(isAllowedHost(host)).toBe(true);
  });

  test.each(["evil.example", "raspdarts.local.evil.example", "raspdarts.fritz.box.evil.example", undefined, ""])(
    "verweigert %s",
    (host) => {
      expect(isAllowedHost(host)).toBe(false);
    },
  );
});

describe("Profil-API", () => {
  const headers = { "x-raspdarts": "1" };
  const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
    app.inject({ method, url, headers, ...(payload === undefined ? {} : { payload }) });

  test("listet die Profile mit dem aktiven", async () => {
    app = await buildApp(testDeps());

    const response = await call("GET", "/api/profiles");

    expect(response.json()).toEqual({ active: "standard", profiles: [{ id: "standard", name: "Standard" }] });
  });

  test("liefert ein Profil mit id", async () => {
    app = await buildApp(testDeps());

    const response = await call("GET", "/api/profiles/standard");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "standard",
      version: 8,
      name: "Standard",
      format: "fenster",
      ...standard(),
    });
  });

  test("legt ein Profil nur mit Namen an und macht es aktiv", async () => {
    const deps = testDeps();
    app = await buildApp(deps);

    const response = await call("POST", "/api/profiles", { name: "Fernseher Küche" });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ id: "fernseher-kueche", name: "Fernseher Küche", version: 8, ...standard() });
    expect(deps.profiles.activeId).toBe("fernseher-kueche");
  });

  test("aendert Format, Inhalte und Layout, setzt editing fuer das aktive", async () => {
    const deps = testDeps();
    app = await buildApp(deps);

    const response = await call("PUT", "/api/profiles/standard", {
      name: "Beamer",
      format: "4:3",
      content: { hintergrund: { darstellung: "autodarts" }, aufnahme: { on: false } },
      layout: { board: { cx: 40, cy: 45, diameter: 80, rotation: 1.5 } },
      editing: { schritt: "inhalte", spieler: 3 },
    });

    expect(response.statusCode).toBe(200);
    const profile = response.json();
    expect(profile.name).toBe("Beamer");
    expect(profile.format).toBe("4:3");
    expect(profile.content.hintergrund.darstellung).toBe("autodarts");
    expect(profile.content.aufnahme.on).toBe(false);
    expect(profile.layout.board).toEqual({ cx: 40, cy: 45, diameter: 80, rotation: 1.5 });
    expect(deps.hub.editing).toEqual({ schritt: "inhalte", spieler: 3 });
  });

  test("ein PUT ohne editing laesst den Schritt stehen, editing null beendet ihn", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    const layout = { schritt: "layout", spieler: 2 };
    await call("PUT", "/api/profiles/standard", { editing: layout });

    await call("PUT", "/api/profiles/standard", { name: "Beamer" });
    expect(deps.hub.editing).toEqual(layout);

    await call("PUT", "/api/profiles/standard", { editing: null });
    expect(deps.hub.editing).toBeNull();
  });

  test("editing fuer ein nicht aktives Profil wird ignoriert", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    await call("POST", "/api/profiles", { name: "TV" });

    await call("PUT", "/api/profiles/standard", { editing: { schritt: "layout", spieler: 2 } });

    expect(deps.hub.editing).toBeNull();
  });

  test("setzt Inhalte und Layout samt Scheibe auf den Standard zurueck, Name und Format bleiben", async () => {
    app = await buildApp(testDeps());
    const board = { cx: 40, cy: 45, diameter: 80, rotation: 1.5 };
    await call("PUT", "/api/profiles/standard", { name: "Beamer", format: "4:3", layout: { board }, content: { aufnahme: { on: false } } });

    const response = await call("POST", "/api/profiles/standard/reset");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: "standard", version: 8, name: "Beamer", format: "4:3", ...standard() });
    expect((await call("POST", "/api/profiles/gibtsnicht/reset")).statusCode).toBe(404);
  });

  test("Uebernehmen von einer Spielart gibt es nicht mehr", async () => {
    app = await buildApp(testDeps());

    expect((await call("POST", "/api/profiles/standard/copy", { von: "x01", nach: "cricket" })).statusCode).toBe(404);
  });

  test("loescht ein Profil, aber nie das letzte", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    await call("POST", "/api/profiles", { name: "TV" });

    expect((await call("DELETE", "/api/profiles/tv")).statusCode).toBe(204);
    expect(deps.profiles.activeId).toBe("standard");
    expect((await call("DELETE", "/api/profiles/standard")).statusCode).toBe(409);
  });

  test("schaltet das aktive Profil um", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    await call("POST", "/api/profiles", { name: "TV" });

    const response = await call("PUT", "/api/active-profile", { id: "standard" });

    expect(response.json()).toEqual({ active: "standard" });
    expect(deps.profiles.activeId).toBe("standard");
    expect((await call("PUT", "/api/active-profile", { id: "gibtsnicht" })).statusCode).toBe(404);
    expect((await call("PUT", "/api/active-profile", {})).statusCode).toBe(400);
  });

  test("unbekanntes Profil ergibt 404", async () => {
    app = await buildApp(testDeps());

    expect((await call("GET", "/api/profiles/gibtsnicht")).statusCode).toBe(404);
  });

  test.each([
    ["GET", "/api/profiles/..%2Fx"],
    ["PUT", "/api/profiles/..%2Fx"],
    ["DELETE", "/api/profiles/Wohnzimmer%20TV"],
  ] as const)("%s %s: ungueltige id ergibt 400", async (method, url) => {
    app = await buildApp(testDeps());

    const response = await call(method, url, method === "PUT" ? { name: "x" } : undefined);

    expect(response.statusCode).toBe(400);
  });

  test("verlangt den X-Raspdarts-Header", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "POST",
      url: "/api/profiles",
      payload: { name: "X" },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe("/api/status", () => {
  test("liefert Systemwerte und den Beamer-Zustand", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/status",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      cpu_percent: 12.5,
      autodarts_version: "unknown",
      beamer: { ingest_connected: false, last_message_at: null },
    });
  });

  test("meldet 500, wenn die Systemwerte nicht lesbar sind", async () => {
    app = await buildApp(
      testDeps({
        status: async () => {
          throw new Error("/proc fehlt");
        },
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/status",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "/proc fehlt" });
  });
});

describe("/api/cams", () => {
  const get = (url: string, headers: Record<string, string> = { "x-raspdarts": "1" }) =>
    app.inject({ method: "GET", url, headers });

  test("liefert Board-ID, Kameraanzahl und Zaehler", async () => {
    app = await buildApp(testDeps());

    const response = await get("/api/cams");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ board_id: "b-1", cams: 3, fetched: 0 });
  });

  test("verlangt den X-Raspdarts-Header", async () => {
    app = await buildApp(testDeps());

    expect((await get("/api/cams", {})).statusCode).toBe(403);
    expect((await get("/api/cams/0", {})).statusCode).toBe(403);
  });

  test("meldet 502, wenn Autodarts nicht antwortet", async () => {
    const cams: Cams = {
      info: async () => {
        throw new Error("Zeitlimit");
      },
      image: async () => ({ ok: false, reason: "unavailable" }),
    };
    app = await buildApp(testDeps({ cams }));

    const response = await get("/api/cams");

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({ error: "unavailable" });
  });

  test("gibt den API-Key aus der Autodarts-Config nie weiter", async () => {
    const http: AutodartsHttp = {
      json: async (path) =>
        path === "/api/config"
          ? { auth: { api_key: "GEHEIM-123", board_id: "b-1" }, cam: { cams: ["a"] } }
          : { running: true, connected: true },
      bytes: async () => Buffer.from("jpeg"),
    };
    app = await buildApp(testDeps({ cams: createCams({ http, now: () => 0 }) }));

    const response = await get("/api/cams");

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("GEHEIM");
    expect(response.body).not.toContain("api_key");
  });

  test("liefert das Bild als JPEG, das nicht zwischengespeichert wird", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const asked: number[] = [];
    const cams: Cams = {
      info: async () => ({ board_id: "b-1", cams: 3, fetched: 0 }),
      image: async (n) => {
        asked.push(n);
        return { ok: true, jpeg };
      },
    };
    app = await buildApp(testDeps({ cams }));

    const response = await get("/api/cams/2");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("image/jpeg");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.rawPayload).toEqual(jpeg);
    expect(asked).toEqual([2]);
  });

  test.each([
    ["not-found", 404],
    ["board-stopped", 409],
    ["unavailable", 502],
  ] as const)("Grund %s ergibt %i", async (reason, code) => {
    const cams: Cams = {
      info: async () => ({ board_id: "b-1", cams: 3, fetched: 0 }),
      image: async () => ({ ok: false, reason }),
    };
    app = await buildApp(testDeps({ cams }));

    const response = await get("/api/cams/0");

    expect(response.statusCode).toBe(code);
    expect(response.json()).toEqual({ error: reason });
  });

  test("eine Nummer, die keine ganze Zahl ist, wird als ungueltig weitergegeben", async () => {
    const asked: number[] = [];
    const cams: Cams = {
      info: async () => ({ board_id: "b-1", cams: 3, fetched: 0 }),
      image: async (n) => {
        asked.push(n);
        return { ok: false, reason: "not-found" };
      },
    };
    app = await buildApp(testDeps({ cams }));

    expect((await get("/api/cams/abc")).statusCode).toBe(404);
    expect((await get("/api/cams/1.5")).statusCode).toBe(404);
    expect(asked).toEqual([-1, -1]);
  });
});

describe("/api/board-camera", () => {
  const headers = { "x-raspdarts": "1" };
  const camera = (latest: Buffer | null) => {
    const refreshed: number[][] = [];
    return {
      refreshed,
      boardCamera: {
        info: async () => ({ cams: [{ n: 2, version: latest ? 1 : null, matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }] }),
        latest: (n: number) => (n === 2 && latest ? { jpeg: latest, version: 1 } : null),
        refresh: (cams: number[]) => refreshed.push(cams),
      },
    };
  };

  test("liefert je Kamera Version und Entzerrung", async () => {
    const { boardCamera } = camera(Buffer.from("jpeg"));
    app = await buildApp(testDeps({ boardCamera }));
    const response = await app.inject({ method: "GET", url: "/api/board-camera", headers });
    expect(response.json()).toEqual({ cams: [{ n: 2, version: 1, matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }] });
  });

  test("liefert das letzte Bild als JPEG ohne Zwischenspeichern, 404 ohne Bild", async () => {
    const { boardCamera } = camera(Buffer.from("jpeg"));
    app = await buildApp(testDeps({ boardCamera }));
    const ok = await app.inject({ method: "GET", url: "/api/board-camera/2", headers });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toBe("image/jpeg");
    expect(ok.headers["cache-control"]).toBe("no-store");
    expect(ok.rawPayload.toString()).toBe("jpeg");
    expect((await app.inject({ method: "GET", url: "/api/board-camera/0", headers })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/board-camera/x", headers })).statusCode).toBe(404);
  });

  test("refresh holt die genannten Kameras, nur gueltige Nummern", async () => {
    const { boardCamera, refreshed } = camera(null);
    app = await buildApp(testDeps({ boardCamera }));
    const response = await app.inject({ method: "POST", url: "/api/board-camera/refresh", headers, payload: { cams: [0, 2, -1, "x", 9] } });
    expect(response.statusCode).toBe(200);
    expect(refreshed).toEqual([[0, 2]]);
  });

  test("verlangt den X-Raspdarts-Header", async () => {
    app = await buildApp(testDeps());
    expect((await app.inject({ method: "GET", url: "/api/board-camera" })).statusCode).toBe(403);
  });
});

describe("/api/ingest/reset", () => {
  test("setzt alle Viewer auf Warten", async () => {
    const deps = testDeps();
    app = await buildApp(deps);
    const playing = toViewerState({ variant: "Cricket", players: [{ name: "A" }], gameScores: [0] });
    deps.hub.broadcast(playing);
    const sent: unknown[] = [];
    const socket: DisplaySocket = { send: (data) => sent.push(JSON.parse(data)), on: () => undefined };
    deps.hub.attach(socket);
    sent.length = 0;

    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/reset",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(sent).toEqual([{ type: "state", state: { phase: "idle" } }]);
  });

  test("verlangt den X-Raspdarts-Header", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "POST", url: "/api/ingest/reset" });

    expect(response.statusCode).toBe(403);
  });
});

describe("Beenden", () => {
  /* Nach einem Update startet systemd den Dienst neu; haengt das Beenden, toetet systemd ihn erst nach 90 s. */
  const closesWithin = async (ms: number) => {
    const started = Date.now();
    await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error("haengt")), ms))]);
    return Date.now() - started;
  };

  const listen = async () => {
    app = await buildApp(testDeps());
    await app.listen({ port: 0, host: "127.0.0.1" });
    return (app.server.address() as AddressInfo).port;
  };

  test("wartet nicht auf eine Verbindung ohne Anfrage (Browser oeffnen sie vorsorglich)", async () => {
    const port = await listen();
    const socket = connect(port, "127.0.0.1");
    await new Promise((resolve) => socket.once("connect", resolve));
    expect(await closesWithin(2000)).toBeLessThan(2000);
    socket.destroy();
  });

  test("wartet nicht auf einen Viewer, der nicht mehr antwortet (Geraet schlaeft)", async () => {
    const port = await listen();
    const socket = connect(port, "127.0.0.1");
    socket.write(
      "GET /ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n",
    );
    await new Promise((resolve) => socket.once("data", resolve));
    socket.pause(); // liest nichts mehr, antwortet nie auf das Schliessen
    expect(await closesWithin(2000)).toBeLessThan(2000);
    socket.destroy();
  });
});
