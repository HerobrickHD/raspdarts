/**
 * Schreibt jeden empfangenen Frame als NDJSON mit Zeitstempel weg.
 *
 * Das ist die Grundlage fuer die Offline-Entwicklung: eine einmal
 * aufgezeichnete Session laesst sich mit replay.ts beliebig oft
 * zuruecklaufen lassen, ohne dass jemand Darts werfen muss.
 *
 * Ein Fehler beim Aufzeichnen (Platte voll, Ordner nicht beschreibbar) darf den
 * Dienst nie beenden: einmal warnen, danach laeuft er ohne Aufzeichnung weiter.
 */
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { dirname } from "node:path";

export interface RecordedFrame {
  /** Millisekunden seit Beginn der Aufzeichnung. */
  t: number;
  frame: unknown;
}

export class Recorder {
  #stream: WriteStream | null = null;
  readonly #start = Date.now();
  #count = 0;
  #warned = false;

  constructor(readonly path: string) {
    try {
      mkdirSync(dirname(path), { recursive: true });
      const stream = createWriteStream(path, { flags: "a" });
      stream.on("error", (error) => this.#disable(error));
      this.#stream = stream;
    } catch (error) {
      this.#disable(error as Error);
    }
  }

  #disable(error: Error): void {
    if (!this.#warned) {
      this.#warned = true;
      console.warn(`Aufzeichnung abgeschaltet: ${error.message}`);
    }
    this.#stream = null;
  }

  write(frame: unknown): void {
    if (this.#stream === null) return;
    const line: RecordedFrame = { t: Date.now() - this.#start, frame };
    this.#stream.write(`${JSON.stringify(line)}\n`);
    this.#count += 1;
  }

  get count(): number {
    return this.#count;
  }

  close(): Promise<void> {
    const stream = this.#stream;
    this.#stream = null;
    if (stream === null || stream.destroyed) return Promise.resolve();
    return new Promise((resolve) => {
      stream.once("error", () => resolve());
      stream.end(() => resolve());
    });
  }
}

/** Dateiname im Format data/sessions/2026-09-20T16-30-00.ndjson */
export function sessionPath(dir = "data/sessions"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${dir}/${stamp}.ndjson`;
}
