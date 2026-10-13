/**
 * Was mit jeder eingehenden Autodarts-Nachricht passiert: aufzeichnen,
 * in einen ViewerState uebersetzen, an die Anzeigen verteilen.
 *
 * Nachrichten, die kein Spielstand sind (Lobby, Board-Status ...), ergeben
 * IDLE und aendern die Anzeige nicht. Angezeigt wird also immer das Match, fuer
 * das zuletzt Daten kamen.
 */
import type { DisplayHub } from "./display-hub.js";
import { IDLE, toViewerState, type ViewerState } from "./game-state.js";

export interface FrameSink {
  write(frame: unknown): void;
}

/** Bekommt jeden neuen Stand mit dem vorigen - fuer die Kamera-Ansicht (board-camera.ts). */
export interface StateWatcher {
  onState(prev: ViewerState, next: ViewerState): void;
}

export function createFramePipeline(
  hub: DisplayHub,
  recorder: FrameSink | null,
  camera: StateWatcher | null = null,
): (frame: unknown) => void {
  /* Jede unbekannte Spielart nur einmal ins Log - sonst bei jedem Wurf. */
  const reported = new Set<string>();
  return (frame) => {
    try {
      recorder?.write(frame);
    } catch (error) {
      console.warn(`Aufzeichnung fehlgeschlagen: ${(error as Error).message}`);
    }

    let state: ViewerState;
    try {
      state = toViewerState(frame);
    } catch (error) {
      console.warn(`Nachricht nicht auswertbar, uebersprungen: ${(error as Error).message}`);
      return;
    }
    if (state === IDLE) return;
    if (state.phase === "playing" && state.mode === null && !reported.has(state.variant)) {
      reported.add(state.variant);
      console.warn(`Spielart "${state.variant}" unbekannt - allgemeine Darstellung`);
    }
    camera?.onState(hub.state, state);
    hub.broadcast(state);
  };
}
