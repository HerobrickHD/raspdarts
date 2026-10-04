import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { DisplayHub } from "../src/beamer/display-hub.js";
import { LayoutStore } from "../src/beamer/layout-store.js";
import type { AppDeps } from "../src/http.js";

/** Abhaengigkeiten fuer Tests: echte Bausteine, Layouts im Temp-Ordner. */
export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const hub = new DisplayHub();
  return {
    hub,
    layouts: new LayoutStore(mkdtempSync(join(tmpdir(), "raspdarts-test-"))),
    ...overrides,
  };
}

/** Startet die App auf einem freien Port und liefert "127.0.0.1:<port>". */
export async function listen(app: FastifyInstance): Promise<string> {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;
  return `127.0.0.1:${port}`;
}
