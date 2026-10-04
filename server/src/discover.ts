/**
 * Schritt 0 aus dem Plan: das Protokoll verifizieren.
 *
 * Meldet sich an, listet die Boards auf, oeffnet den WebSocket und zeigt jeden
 * empfangenen Frame an - zusaetzlich zur vollstaendigen Aufzeichnung.
 *
 *     npm run discover
 *
 * Danach ein Leg werfen. Was hier durchlaeuft, ist die Grundwahrheit fuer
 * game-state.ts. Beenden mit Strg+C.
 */
import { loadConfig } from "./config.js";
import { AutodartsAuth } from "./auth.js";
import { FileTokenStorage } from "./token-storage.js";
import { showUserCode } from "./user-code.js";
import { listBoards } from "./api.js";
import {
  AutodartsClient,
  boardMatchesTopic,
  matchStateTopic,
  subscribeMessage,
} from "./autodarts-client.js";
import { Recorder, sessionPath } from "./recorder.js";

/** Sammelt die Feldnamen eines Objekts, damit die Struktur auf einen Blick sichtbar wird. */
function shapeOf(value: unknown, depth = 2): string {
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : `[${shapeOf(value[0], depth - 1)} x${value.length}]`;
  }
  if (value === null || typeof value !== "object") return typeof value;
  if (depth <= 0) return "{...}";
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, v]) => `${key}: ${shapeOf(v, depth - 1)}`)
    .join(", ");
  return `{ ${entries} }`;
}

/** Sucht rekursiv nach einer Match-ID, um automatisch den Spielverlauf zu abonnieren. */
function findMatchId(value: unknown): string | null {
  if (value === null || typeof value !== "object") return null;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if ((key === "id" || key === "matchId") && typeof v === "string" && v.length > 20) {
      return v;
    }
    const nested = findMatchId(v);
    if (nested) return nested;
  }
  return null;
}

const quiet = process.argv.includes("--quiet");

async function main(): Promise<void> {
  const config = loadConfig();
  const auth = new AutodartsAuth({
    clientId: config.clientId,
    storage: new FileTokenStorage("data/tokens.json"),
    onUserCode: showUserCode,
  });

  console.log("Melde mich bei Autodarts an ...");
  const boards = await listBoards(auth);
  console.log(`\nDeine Boards (${boards.length}):`);
  for (const board of boards) {
    console.log(`  ${board.id}   ${board.name}`);
  }

  const boardId = config.boardId ?? boards[0]?.id;
  if (!boardId) {
    throw new Error("Kein Board gefunden. Ist das Board in autodarts.com registriert?");
  }
  if (!config.boardId) {
    console.log(`\nAUTODARTS_BOARD_ID ist nicht gesetzt - nehme ${boardId}.`);
    console.log("Trage diese ID in die .env ein, wenn es das richtige Board ist.");
  }

  const recorder = new Recorder(sessionPath("data/sessions"));
  const client = new AutodartsClient(auth);
  const subscribedMatches = new Set<string>();

  client.on("open", () => {
    const sub = boardMatchesTopic(boardId);
    console.log(`\nVerbunden. Sende: ${subscribeMessage(sub)}`);
    console.log("Starte jetzt ein Spiel und wirf ein Leg.\n");
  });
  client.on("close", (reason) => console.log(`Verbindung getrennt (${reason}), verbinde neu ...`));
  client.on("error", (error) => console.error("Fehler:", error.message));

  client.on("frame", (frame) => {
    recorder.write(frame);
    if (quiet) {
      process.stdout.write(`\rFrames aufgezeichnet: ${recorder.count}`);
    } else {
      console.log(`\n--- Frame ${recorder.count} ---`);
      console.log("Struktur:", shapeOf(frame));
      console.log(JSON.stringify(frame, null, 2).slice(0, 2000));
    }

    const matchId = findMatchId(frame);
    if (matchId && !subscribedMatches.has(matchId)) {
      subscribedMatches.add(matchId);
      const sub = matchStateTopic(matchId);
      console.log(`\n>>> Match ${matchId} erkannt. Sende: ${subscribeMessage(sub)}`);
      client.subscribe(sub);
    }
  });

  client.subscribe(boardMatchesTopic(boardId));
  await client.start();

  const shutdown = async () => {
    client.stop();
    await recorder.close();
    console.log(`\n${recorder.count} Frames aufgezeichnet unter ${recorder.path}`);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
}

main().catch((error: Error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
