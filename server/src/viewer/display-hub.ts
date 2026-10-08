/**
 * Verteilt den ScoreboardState an alle verbundenen Anzeigen.
 *
 * Es werden immer vollstaendige Snapshots gesendet, keine Deltas. Dadurch
 * haelt der Browser keinen eigenen Zustand und eine Anzeige, die sich spaeter
 * verbindet, ist sofort korrekt.
 */
import { IDLE, type ScoreboardState } from "./game-state.js";

export interface DisplaySocket {
  send(data: string): void;
  on(event: "close", listener: () => void): unknown;
}

export class DisplayHub {
  readonly #clients = new Set<DisplaySocket>();
  #state: ScoreboardState = IDLE;

  attach(socket: DisplaySocket): void {
    this.#clients.add(socket);
    socket.send(JSON.stringify(this.#state));
    socket.on("close", () => this.#clients.delete(socket));
  }

  /** Setzt den Zustand und schiebt ihn an alle Anzeigen. */
  broadcast(state: ScoreboardState): void {
    this.#state = state;
    const payload = JSON.stringify(state);
    for (const client of this.#clients) {
      try {
        client.send(payload);
      } catch {
        this.#clients.delete(client);
      }
    }
  }

  get state(): ScoreboardState {
    return this.#state;
  }

  get clientCount(): number {
    return this.#clients.size;
  }
}
