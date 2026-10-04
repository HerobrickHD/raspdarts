/**
 * Hauptprogramm: verbindet Autodarts mit der Beamer-Anzeige.
 *
 *     npm run dev     (Entwicklung)
 *     npm start       (nach npm run build, z.B. per systemd auf dem Pi)
 */
import { loadConfig } from "./config.js";
import { AutodartsAuth } from "./auth.js";
import { FileTokenStorage } from "./token-storage.js";
import { showUserCode } from "./user-code.js";
import { listBoards } from "./api.js";
import { AutodartsClient, boardMatchesTopic, matchStateTopic } from "./autodarts-client.js";
import { toScoreboardState, IDLE } from "./game-state.js";
import { Recorder, sessionPath } from "./recorder.js";
import { ScoreboardServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const auth = new AutodartsAuth({
    clientId: config.clientId,
    storage: new FileTokenStorage("data/tokens.json"),
    onUserCode: showUserCode,
  });

  const server = new ScoreboardServer(config.port);
  await server.start();
  console.log(`Beamer-Anzeige laeuft auf http://localhost:${config.port}/`);

  const boardId = config.boardId ?? (await listBoards(auth))[0]?.id;
  if (!boardId) throw new Error("Kein Board gefunden - setze AUTODARTS_BOARD_ID in der .env.");

  // Jede Session wird mitgeschrieben: Material fuer Tests und fuer die
  // spaeteren Features (die Wurf-Koordinaten stecken schon in den Frames).
  const recorder = new Recorder(sessionPath());
  const client = new AutodartsClient(auth);
  const subscribedMatches = new Set<string>();

  client.on("open", () => console.log(`Mit Autodarts verbunden (Board ${boardId}).`));
  client.on("close", (reason) => console.log(`Verbindung getrennt (${reason}), verbinde neu ...`));
  client.on("error", (error) => console.error("Fehler:", error.message));

  client.on("frame", (frame) => {
    recorder.write(frame);

    const state = toScoreboardState(frame);
    if (state !== IDLE) server.broadcast(state);

    // Sobald ein Match auf dem Board startet, zusaetzlich dessen Verlauf abonnieren.
    const matchId = matchIdOf(frame);
    if (matchId && !subscribedMatches.has(matchId)) {
      subscribedMatches.add(matchId);
      client.subscribe(matchStateTopic(matchId));
      console.log(`Match ${matchId} abonniert.`);
    }
  });

  client.subscribe(boardMatchesTopic(boardId));
  await client.start();

  const shutdown = async () => {
    client.stop();
    await recorder.close();
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

function matchIdOf(frame: unknown): string | null {
  if (frame === null || typeof frame !== "object") return null;
  for (const [key, value] of Object.entries(frame as Record<string, unknown>)) {
    if ((key === "id" || key === "matchId") && typeof value === "string" && value.length > 20) {
      return value;
    }
    const nested = matchIdOf(value);
    if (nested) return nested;
  }
  return null;
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
