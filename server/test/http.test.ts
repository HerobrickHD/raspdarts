import { afterEach, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/http.js";
import { DEFAULT_LAYOUT } from "../src/beamer/layout.js";
import { testDeps } from "./helpers.js";

let app: FastifyInstance;
afterEach(async () => app.close());

describe("Header-Schutz", () => {
  test("weist /api-Anfragen ohne X-Raspdarts mit 403 ab", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/api/layout/beamer" });

    expect(response.statusCode).toBe(403);
  });

  test("weist einen falschen Header-Wert ab", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/layout/beamer",
      headers: { "x-raspdarts": "ja" },
    });

    expect(response.statusCode).toBe(403);
  });

  test("laesst /api-Anfragen mit X-Raspdarts: 1 durch", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({
      method: "GET",
      url: "/api/layout/beamer",
      headers: { "x-raspdarts": "1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(DEFAULT_LAYOUT);
  });

  test("laesst sich nicht durch Prozent-Kodierung des Pfads umgehen", async () => {
    app = await buildApp(testDeps());

    const response = await app.inject({ method: "GET", url: "/%61pi/layout/beamer" });

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
      url: "/api/layout/beamer",
      headers: { origin: "https://evil.example", "access-control-request-method": "PUT" },
    });

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("Layout-API", () => {
  test("speichert ein Layout und liefert es zurueck", async () => {
    app = await buildApp(testDeps());
    const headers = { "x-raspdarts": "1" };

    await app.inject({
      method: "PUT",
      url: "/api/layout/handy",
      headers,
      payload: { checkout: { x: 60, y: 12, scale: 2 } },
    });
    const response = await app.inject({ method: "GET", url: "/api/layout/handy", headers });

    expect(response.json().checkout).toEqual({ x: 60, y: 12, scale: 2 });
  });
});
