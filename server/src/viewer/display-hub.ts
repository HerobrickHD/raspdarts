/**
 * Verteilt Stand und Layout an die verbundenen Viewer.
 *
 * Der Stand geht an alle, das Layout nur an die Viewer derselben Anzeige
 * (?display=beamer). Es werden immer vollstaendige Schnappschuesse gesendet,
 * keine Deltas: Ein Viewer, der sich spaeter verbindet, ist sofort richtig.
 *
 * "editing" sagt allen Viewern einer Anzeige, dass gerade jemand das Layout
 * einrichtet - dann zeigen sie die Scheibe als Linien. Bleibt eine Aenderung
 * aus (Editor-Fenster geschlossen), faellt es nach dem Zeitlimit zurueck.
 */
import { IDLE, type ViewerState } from "./game-state.js";
import type { DisplayLayout } from "./layout.js";

export interface DisplaySocket {
  send(data: string): void;
  on(event: "close", listener: () => void): unknown;
}

export interface LayoutSource {
  read(display: string): DisplayLayout;
  write(display: string, layout: unknown): DisplayLayout;
}

export type ViewerMessage =
  | { type: "state"; state: ViewerState }
  | { type: "layout"; layout: DisplayLayout; editing: boolean };

export const EDIT_TIMEOUT_MS = 60_000;

export class DisplayHub {
  readonly #clients = new Map<DisplaySocket, string>();
  readonly #editing = new Map<string, NodeJS.Timeout>();
  #state: ViewerState = IDLE;

  constructor(
    private readonly layouts: LayoutSource,
    private readonly editTimeoutMs = EDIT_TIMEOUT_MS,
  ) {}

  attach(socket: DisplaySocket, display: string): void {
    this.#clients.set(socket, display);
    socket.on("close", () => this.#clients.delete(socket));
    this.#send(socket, { type: "state", state: this.#state });
    this.#send(socket, {
      type: "layout",
      layout: this.layouts.read(display),
      editing: this.isEditing(display),
    });
  }

  /** Setzt den Stand und schiebt ihn an alle Viewer. */
  broadcast(state: ViewerState): void {
    this.#state = state;
    for (const socket of [...this.#clients.keys()]) this.#send(socket, { type: "state", state });
  }

  /** Prueft und speichert das Layout und schickt es an alle Viewer dieser Anzeige. */
  updateLayout(display: string, layout: unknown, editing: boolean): DisplayLayout {
    const saved = this.layouts.write(display, layout);
    this.#setEditing(display, editing);
    this.#publishLayout(display, saved);
    return saved;
  }

  isEditing(display: string): boolean {
    return this.#editing.has(display);
  }

  close(): void {
    for (const timer of this.#editing.values()) clearTimeout(timer);
    this.#editing.clear();
  }

  get state(): ViewerState {
    return this.#state;
  }

  get clientCount(): number {
    return this.#clients.size;
  }

  #setEditing(display: string, editing: boolean): void {
    clearTimeout(this.#editing.get(display));
    this.#editing.delete(display);
    if (!editing) return;
    const timer = setTimeout(() => {
      this.#editing.delete(display);
      this.#publishLayout(display, this.layouts.read(display));
    }, this.editTimeoutMs);
    timer.unref?.();
    this.#editing.set(display, timer);
  }

  #publishLayout(display: string, layout: DisplayLayout): void {
    const message: ViewerMessage = { type: "layout", layout, editing: this.isEditing(display) };
    for (const [socket, name] of [...this.#clients]) {
      if (name === display) this.#send(socket, message);
    }
  }

  #send(socket: DisplaySocket, message: ViewerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      this.#clients.delete(socket);
    }
  }
}
