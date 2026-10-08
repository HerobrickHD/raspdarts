/**
 * Was mit jeder eingehenden Autodarts-Nachricht passiert: aufzeichnen,
 * in einen ScoreboardState uebersetzen, an die Anzeigen verteilen.
 *
 * Nachrichten, die kein Spielstand sind (Lobby, Board-Status ...), ergeben
 * IDLE und aendern die Anzeige nicht. Angezeigt wird also immer das Match, fuer
 * das zuletzt Daten kamen.
 */
import type { DisplayHub } from "./display-hub.js";
import { IDLE, toScoreboardState, type ScoreboardState } from "./game-state.js";

export interface FrameSink {
  write(frame: unknown): void;
}

export function createFramePipeline(
  hub: DisplayHub,
  recorder: FrameSink | null,
): (frame: unknown) => void {
  return (frame) => {
    try {
      recorder?.write(frame);
    } catch (error) {
      console.warn(`Aufzeichnung fehlgeschlagen: ${(error as Error).message}`);
    }

    let state: ScoreboardState;
    try {
      state = toScoreboardState(frame);
    } catch (error) {
      console.warn(`Nachricht nicht auswertbar, uebersprungen: ${(error as Error).message}`);
      return;
    }
    if (state !== IDLE) hub.broadcast(state);
  };
}
