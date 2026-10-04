/**
 * Hauptprogramm des Raspdarts-Dienstes.
 *
 *     npm run dev     (Entwicklung)
 *     npm start       (nach npm run build, per systemd auf dem Pi)
 */
import { loadConfig } from "./config.js";
import { buildApp } from "./http.js";
import { createDeps } from "./runtime.js";

async function main(): Promise<void> {
  const { port } = loadConfig();
  const deps = createDeps({ record: true });
  const app = await buildApp(deps);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Raspdarts laeuft auf http://localhost:${port}/`);

  const shutdown = async () => {
    await app.close();
    await deps.recorder?.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
