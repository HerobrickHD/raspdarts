/**
 * Verteilt Katalog, Stand und das aktive Profil an die verbundenen Viewer.
 *
 * Alle Viewer zeigen dasselbe: den Spielstand und das aktive Profil. Es werden
 * immer vollstaendige Schnappschuesse gesendet, keine Deltas: Ein Viewer, der
 * sich spaeter verbindet, ist sofort richtig.
 *
 * "editing" sagt allen Viewern, dass gerade eingestellt wird, in welchem
 * Schritt, fuer welche Spielart und mit wie vielen Spielern in der Vorschau -
 * dann zeigen sie ohne Spiel Beispieldaten, beim Layout die Scheibe als Linien. Bleibt eine Meldung aus (Fenster geschlossen), faellt es
 * nach dem Zeitlimit zurueck; ein Wechsel des aktiven Profils beendet es.
 */
import { FALLBACK_MODE, isMode } from "./catalog.js";
import { IDLE, type ViewerState } from "./game-state.js";
import type { ProfileSummary, ProfileWithId } from "./profile.js";
import { viewerCatalog, type ViewerCatalog } from "./standards.js";

export interface DisplaySocket {
  send(data: string): void;
  on(event: "close", listener: () => void): unknown;
}

export interface ProfileSource {
  readonly activeId: string;
  active(): ProfileWithId;
  list(): ProfileSummary[];
}

/** Wer gerade einstellt: Schritt, die Spielart in der Leiste und die Spielerzahl der Vorschau. */
export interface Editing {
  schritt: "inhalte" | "layout";
  spielart: string;
  spieler: number;
}

export type ViewerMessage =
  | { type: "catalog"; catalog: ViewerCatalog }
  | { type: "state"; state: ViewerState }
  | { type: "profile"; profile: ProfileWithId; profiles: ProfileSummary[]; editing: Editing | null }
  | { type: "camera"; cam: number; version: number };

export const EDIT_TIMEOUT_MS = 60_000;

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;

/** Nur die beiden Schritte gelten; alles andere heisst "es wird nicht eingestellt". */
export function parseEditing(raw: unknown): Editing | null {
  const source = asRecord(raw);
  const schritt = source["schritt"];
  if (schritt !== "inhalte" && schritt !== "layout") return null;
  const spieler = source["spieler"];
  return {
    schritt,
    spielart: isMode(source["spielart"]) ? source["spielart"] : FALLBACK_MODE,
    spieler: typeof spieler === "number" && Number.isInteger(spieler) && spieler >= 1 && spieler <= 6 ? spieler : 2,
  };
}

export class DisplayHub {
  readonly #clients = new Set<DisplaySocket>();
  #state: ViewerState = IDLE;
  #editing: Editing | null = null;
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
    this.#send(socket, { type: "catalog", catalog: viewerCatalog() });
    this.#send(socket, { type: "state", state: this.#state });
    this.#send(socket, this.#profileMessage());
  }

  /** Setzt den Stand und schiebt ihn an alle Viewer. */
  broadcast(state: ViewerState): void {
    this.#state = state;
    for (const socket of [...this.#clients]) this.#send(socket, { type: "state", state });
  }

  /** Wer gerade einstellt. Jede Meldung verlaengert; ohne Meldung endet es nach dem Zeitlimit. */
  setEditing(editing: Editing | null): void {
    if (this.#editTimer) clearTimeout(this.#editTimer);
    this.#editTimer = null;
    this.#editing = editing;
    if (!editing) return;
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

  get editing(): Editing | null {
    return this.#editing;
  }

  /** Neues Kamerabild (board-camera.ts) - die Viewer holen es sich ab. */
  publishCamera(update: { cam: number; version: number }): void {
    const message: ViewerMessage = { type: "camera", ...update };
    for (const socket of [...this.#clients]) this.#send(socket, message);
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
