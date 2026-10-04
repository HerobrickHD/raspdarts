/**
 * Startet die festen Root-Skripte unter /usr/local/lib/raspdarts per sudo.
 *
 * Nur diese Skripte stehen in /etc/sudoers.d/raspdarts. Das verhindert, dass
 * ueber das Netz beliebige Befehle als root laufen. Wer bereits als Dienst-Benutzer
 * Code ausfuehrt, kommt ueber das Update-Skript an root (es nutzt Dateien aus dem
 * Klon) - auf Raspberry Pi OS hat der Benutzer ohnehin volle sudo-Rechte.
 * Es laeuft immer hoechstens ein Auftrag. Ein Auftrag wird nicht abgebrochen, wenn
 * niemand mehr zusieht: ein halb installiertes Autodarts waere schlimmer als ein
 * Lauf ohne Zuschauer.
 */
import { spawn, type ChildProcess } from "node:child_process";

export const SCRIPT_DIR = "/usr/local/lib/raspdarts";

export type JobEvent =
  | { type: "log"; line: string }
  | { type: "done"; success: boolean; error?: string };

type DoneEvent = Extract<JobEvent, { type: "done" }>;

export type Spawner = (script: string) => ChildProcess;

/**
 * `sudo -n` bricht ab statt nach einem Passwort zu fragen. Stdin ist zu: ein
 * Skript, das etwas lesen will, soll scheitern statt die Sperre ewig zu halten.
 */
export const sudoSpawner: Spawner = (script) =>
  spawn("sudo", ["-n", `${SCRIPT_DIR}/${script}`], { stdio: ["ignore", "pipe", "pipe"] });

export class JobRunner {
  #busy = false;

  constructor(private readonly spawner: Spawner = sudoSpawner) {}

  get busy(): boolean {
    return this.#busy;
  }

  /** Startet ein Skript. Liefert false, wenn schon eines laeuft. */
  run(script: string, emit: (event: JobEvent) => void): boolean {
    if (this.#busy) return false;
    this.#busy = true;

    let finished = false;
    const finish = (event: DoneEvent) => {
      if (finished) return;
      finished = true;
      this.#busy = false;
      emit(event);
    };

    let child: ChildProcess;
    try {
      child = this.spawner(script);
    } catch (error) {
      finish({ type: "done", success: false, error: (error as Error).message });
      return true;
    }

    // Pro Datenstrom puffern: eine Zeile kann auf mehrere Bloecke verteilt
    // ankommen, ein UTF-8-Zeichen auch (setEncoding setzt es richtig zusammen).
    const rests: string[] = [];
    for (const stream of [child.stdout, child.stderr]) {
      if (!stream) continue;
      const index = rests.push("") - 1;
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => {
        const lines = ((rests[index] ?? "") + chunk).split("\n");
        rests[index] = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) emit({ type: "log", line });
      });
    }
    const flushRests = () => {
      for (const rest of rests.splice(0)) if (rest.trim()) emit({ type: "log", line: rest });
    };
    child.on("error", (error) => finish({ type: "done", success: false, error: error.message }));
    child.on("close", (code) => {
      if (finished) return;
      flushRests();
      finish(
        code === 0
          ? { type: "done", success: true }
          : { type: "done", success: false, error: `Exit code ${code}` },
      );
    });
    return true;
  }

  /** Startet ein Skript ohne auf Ausgabe oder Ende zu warten (Neustart, Herunterfahren). */
  fire(script: string): void {
    try {
      this.spawner(script).on("error", (error) => console.error(`${script}: ${error.message}`));
    } catch (error) {
      console.error(`${script}: ${(error as Error).message}`);
    }
  }
}
