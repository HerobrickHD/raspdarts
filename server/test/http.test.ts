import { afterEach, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp, isAllowedHost } from "../src/http.js";
import { createCams, type AutodartsHttp, type Cams } from "../src/system/cams.js";
import { DEFAULT_LAYOUT } from "../src/viewer/layout.js";
import { testDeps } from "./helpers.js";

let app: FastifyInstance;
afterEach(async () => app.close());

describe("Header-Schutz", () => {
  test("weist /api-Anfragen ohne X-Raspdarts mit 403 ab", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/api/layout/standard" });

    expect(response.statusCode).toBe(403);
  });

  test("weist einen falschen Header-Wert ab", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/layout/standard",
      headers: { "x-raspdarts": "ja" },
    });

    expect(response.statusCode).toBe(403);
  });

  test("laesst /api-Anfragen mit X-Raspdarts: 1 durch", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/layout/standard",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(DEFAULT_LAYOUT);
  });

  test("laesst sich nicht durch Prozent-Kodierung des Pfads umgehen", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/%61pi/layout/standard" });

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
      url: "/api/layout/standard",
      headers: { origin: "https://evil.example", "access-control-request-method": "PUT" },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("Host-Pruefung (DNS-Rebinding)", () => {
  const get = (host: string) =>
    app.inject({
      method: "GET",
      url: "/api/layout/standard",
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
    "localhost:8743",
    "127.0.0.1",
    "192.168.1.42:8743",
    "[::1]:8743",
  ])("erlaubt %s", (host) => {
    expect(isAllowedHost(host)).toBe(true);
  });

  test.each(["evil.example", "raspdarts.local.evil.example", undefined, ""])(
    "verweigert %s",
    (host) => {
      expect(isAllowedHost(host)).toBe(false);
    },
  );
});

describe("Layout-API", () => {
  const headers = { "x-raspdarts": "1" };
  const MOVED = { version: 2, board: { cx: 40, cy: 45, diameter: 80, rotation: 1.5 } };

  test("liefert ohne gespeichertes Layout den Standard", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/api/layout/handy", headers });

    expect(response.json()).toEqual(DEFAULT_LAYOUT);
  });

  test("speichert ein Layout mit Bearbeiten-Zustand und liefert es zurueck", async () => {
    app = await buildApp(testDeps());

    const put = await app.inject({
      method: "PUT",
      url: "/api/layout/handy",
      headers,
      payload: { layout: MOVED, editing: true },
    });
    const get = await app.inject({ method: "GET", url: "/api/layout/handy", headers });

    expect(put.statusCode).toBe(200);
    expect(put.json()).toMatchObject({ layout: { board: MOVED.board }, editing: true });
    expect(get.json().board).toEqual(MOVED.board);
  });

  test("macht aus unbrauchbarem Inhalt das Standardlayout statt eines Fehlers", async () => {
    app = await buildApp(testDeps());

    for (const payload of [{}, { layout: "kaputt" }, { meta: { x: 1, y: 1, scale: 1 } }]) {
      const response = await app.inject({ method: "PUT", url: "/api/layout/handy", headers, payload });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ layout: DEFAULT_LAYOUT, editing: false });
    }
  });

  test("weist ungueltige Anzeigenamen mit 400 ab", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "PUT",
      url: "/api/layout/..%2Fx",
      headers,
      payload: { layout: MOVED, editing: false },
    });

    expect(response.statusCode).toBe(400);
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
