/**
 * Nimmt die Autodarts-Nachrichten an, die die Extension auf play.autodarts.io
 * mitliest. Kennt keine Spielregeln - parst nur JSON und reicht weiter.
 */

export interface IngestStatus {
  ingest_connected: boolean;
  last_message_at: string | null;
}

const EXTENSION_ORIGIN = /^(chrome-extension|moz-extension):\/\/[^/]+$/;

/**
 * Browser koennen beim WebSocket-Aufbau keine eigenen Header setzen. Statt
 * X-Raspdarts wird deshalb die Herkunft geprueft: nur Extensions, keine Webseiten.
 */
export function isExtensionOrigin(origin: string | undefined): boolean {
  return typeof origin === "string" && EXTENSION_ORIGIN.test(origin);
}

export class Ingest {
  #connections = 0;
  #lastMessageAt: Date | null = null;

  constructor(
    private readonly onFrame: (frame: unknown) => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  open(): void {
    this.#connections += 1;
  }

  close(): void {
    this.#connections = Math.max(0, this.#connections - 1);
  }

  receive(raw: string): void {
    let frame: unknown;
    try {
      frame = JSON.parse(raw);
    } catch {
      console.warn(`Ingest: Nachricht ist kein JSON, uebersprungen (${raw.slice(0, 80)})`);
      return;
    }
    this.#lastMessageAt = this.now();
    this.onFrame(frame);
  }

  status(): IngestStatus {
    return {
      ingest_connected: this.#connections > 0,
      last_message_at: this.#lastMessageAt?.toISOString() ?? null,
    };
  }
}
