/**
 * Spielt eine aufgezeichnete Session zurueck und fuettert damit die Anzeige.
 *
 *     npm run replay data/sessions/2026-09-20T16-30-00.ndjson
 *     npm run replay <datei> --speed 4     (vierfache Geschwindigkeit)
 *     npm run replay <datei> --instant     (ohne Pausen, springt ans Ende)
 *
 * Damit laesst sich die komplette Beamer-Anzeige am Schreibtisch entwickeln,
 * ohne an der Scheibe zu stehen.
 */
import { readFileSync } from "node:fs";
import type { RecordedFrame } from "./recorder.js";
import { buildApp } from "../http.js";
import { createDeps } from "../runtime.js";
import { JobRunner } from "../system/jobs.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error("Aufruf: npm run replay <datei.ndjson> [--speed 4] [--instant]");
    process.exit(1);
  }

  const speed = Number(flagValue("--speed") ?? 1);
  const instant = process.argv.includes("--instant");
  const port = Number(process.env.PORT ?? 8743);

  const frames = readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RecordedFrame);

  const deps = createDeps({ record: false });
  // Am Schreibtisch darf kein Reboot-Knopf den Rechner wirklich neu starten.
  deps.jobs = new JobRunner(() => {
    throw new Error("Im Replay werden keine Root-Skripte gestartet");
  });
  const app = await buildApp(deps);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Replay laeuft auf http://localhost:${port}/`);
  console.log(`${frames.length} Frames aus ${file}. Oeffne die Seite, dann startet es.`);

  await sleep(2000); // kurz warten, damit die Anzeige sich verbinden kann

  let previous = 0;
  for (const [index, recorded] of frames.entries()) {
    if (!instant) await sleep(Math.max(0, (recorded.t - previous) / speed));
    previous = recorded.t;

    deps.ingest.receive(JSON.stringify(recorded.frame));
    process.stdout.write(`\rFrame ${index + 1}/${frames.length}  (${deps.hub.state.phase})   `);
  }

  console.log("\nReplay beendet. Die letzte Anzeige bleibt stehen - Strg+C zum Beenden.");
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
