/**
 * Verteilt Katalog, Stand und das aktive Profil an die verbundenen Viewer.
 *
 * Alle Viewer zeigen dasselbe: den Spielstand und das aktive Profil. Es werden
 * immer vollstaendige Schnappschuesse gesendet, keine Deltas: Ein Viewer, der
 * sich spaeter verbindet, ist sofort richtig.
 *
 * "editing" sagt allen Viewern, dass gerade eingestellt wird ("inhalte" oder
 * "layout") - dann zeigen sie ohne Spiel Beispieldaten, beim Layout die
 * Scheibe als Linien. Bleibt eine Meldung aus (Fenster geschlossen), faellt es
 * nach dem Zeitlimit zurueck; ein Wechsel des aktiven Profils beendet es.
 */
import { CATALOG, type Catalog } from "./catalog.js";
import { IDLE, type ViewerState } from "./game-state.js";
import type { ProfileSummary, ProfileWithId } from "./profile.js";

export interface DisplaySocket {
  send(data: string): void;
  on(event: "close", listener: () => void): unknown;
}

export interface ProfileSource {
  readonly activeId: string;
  active(): ProfileWithId;
  list(): ProfileSummary[];
}

export type EditStep = "inhalte" | "layout";

export type ViewerMessage =
  | { type: "catalog"; catalog: Catalog }
  | { type: "state"; state: ViewerState }
  | { type: "profile"; profile: ProfileWithId; profiles: ProfileSummary[]; editing: EditStep | null };

export const EDIT_TIMEOUT_MS = 60_000;

/** Nur die beiden Schritte gelten; alles andere heisst "es wird nicht eingestellt". */
export function editStep(raw: unknown): EditStep | null {
  return raw === "inhalte" || raw === "layout" ? raw : null;
}

export class DisplayHub {
  readonly #clients = new Set<DisplaySocket>();
  #state: ViewerState = IDLE;
  #editing: EditStep | null = null;
  #editTimer: NodeJS.Timeout | null = null;
  /** Das aktive Profil beim letzten Verteilen - ein Wechsel beendet das Einstellen. */
  #shownActive: string;

  constructor(
    private readonly profiles: ProfileSource,
    private readonly editTimeoutMs = EDIT_TIMEOUT_MS,
  ) {
    this.#shownActive = profiles.activeId;
  }

  attach(socket: DisplaySocket): void {
    this.#clients.add(socket);
    socket.on("close", () => this.#clients.delete(socket));
    this.#send(socket, { type: "catalog", catalog: CATALOG });
    this.#send(socket, { type: "state", state: this.#state });
    this.#send(socket, this.#profileMessage());
  }

  /** Setzt den Stand und schiebt ihn an alle Viewer. */
  broadcast(state: ViewerState): void {
    this.#state = state;
    for (const socket of [...this.#clients]) this.#send(socket, { type: "state", state });
  }

  /** Wer gerade einstellt. Jede Meldung verlaengert; ohne Meldung endet es nach dem Zeitlimit. */
  setEditing(step: EditStep | null): void {
    if (this.#editTimer) clearTimeout(this.#editTimer);
    this.#editTimer = null;
    this.#editing = step;
    if (!step) return;
    this.#editTimer = setTimeout(() => {
      this.#editTimer = null;
      this.#editing = null;
      this.publishProfile();
    }, this.editTimeoutMs);
    this.#editTimer.unref?.();
  }

  /** Schickt das aktive Profil und die Liste an alle Viewer. */
  publishProfile(): void {
    if (this.profiles.activeId !== this.#shownActive) {
      this.#shownActive = this.profiles.activeId;
      this.setEditing(null);
    }
    const message = this.#profileMessage();
    for (const socket of [...this.#clients]) this.#send(socket, message);
  }

  get editing(): EditStep | null {
    return this.#editing;
  }

  close(): void {
    if (this.#editTimer) clearTimeout(this.#editTimer);
    this.#editTimer = null;
  }

  get state(): ViewerState {
    return this.#state;
  }

  get clientCount(): number {
    return this.#clients.size;
  }

  #profileMessage(): ViewerMessage {
    return {
      type: "profile",
      profile: this.profiles.active(),
      profiles: this.profiles.list(),
      editing: this.#editing,
    };
  }

  #send(socket: DisplaySocket, message: ViewerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.#clients.delete(socket);
    }
  }
}
