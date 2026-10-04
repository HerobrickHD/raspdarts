import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { DisplayHub } from "../src/beamer/display-hub.js";
import { Ingest } from "../src/beamer/ingest.js";
import { LayoutStore } from "../src/beamer/layout-store.js";
import { createFramePipeline } from "../src/beamer/pipeline.js";
import type { AppDeps } from "../src/http.js";
import { JobRunner } from "../src/system/jobs.js";
import type { SystemStatus } from "../src/system/status.js";

/**
 * Abhaengigkeiten fuer Tests: echte Bausteine, Layouts im Temp-Ordner, keine
 * Aufzeichnung. Wer `hub` ueberschreibt, muss auch `ingest` passend mitgeben.
 */
export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const hub = new DisplayHub();
  return {
    hub,
    layouts: new LayoutStore(mkdtempSync(join(tmpdir(), "raspdarts-test-"))),
    ingest: new Ingest(createFramePipeline(hub, null)),
    status: async (): Promise<SystemStatus> => ({
      cpu_percent: 12.5,
      ram_total_mb: 4000,
      ram_used_mb: 1000,
      temp_celsius: 48.3,
      uptime_seconds: 3600,
      autodarts_version: "unknown",
      ip_address: "192.168.1.42",
      raspdarts_version: "2.0.0",
    }),
    jobs: new JobRunner(() => {
      throw new Error("In Tests werden keine echten Skripte gestartet");
    }),
    ...overrides,
  };
}

/** Startet die App auf einem freien Port und liefert "127.0.0.1:<port>". */
export async function listen(app: FastifyInstance): Promise<string> {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;
  return `127.0.0.1:${port}`;
}
