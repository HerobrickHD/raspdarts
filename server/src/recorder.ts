/**
 * Schreibt jeden empfangenen Frame als NDJSON mit Zeitstempel weg.
 *
 * Das ist die Grundlage fuer die Offline-Entwicklung: eine einmal
 * aufgezeichnete Session laesst sich mit replay.ts beliebig oft
 * zuruecklaufen lassen, ohne dass jemand Darts werfen muss.
 */
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { dirname } from "node:path";

export interface RecordedFrame {
  /** Millisekunden seit Beginn der Aufzeichnung. */
  t: number;
  frame: unknown;
}

export class Recorder {
  readonly #stream: WriteStream;
  readonly #start = Date.now();
  #count = 0;

  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.#stream = createWriteStream(path, { flags: "a" });
  }

  write(frame: unknown): void {
    const line: RecordedFrame = { t: Date.now() - this.#start, frame };
    this.#stream.write(`${JSON.stringify(line)}\n`);
    this.#count += 1;
  }

  get count(): number {
    return this.#count;
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.#stream.end(resolve));
  }
}

/** Dateiname im Format data/sessions/2026-09-20T16-30-00.ndjson */
export function sessionPath(dir = "data/sessions"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${dir}/${stamp}.ndjson`;
}
