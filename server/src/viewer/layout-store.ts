/**
 * Speichert das eingerichtete Layout pro Anzeige als JSON-Datei.
 *
 * Bewusst beim Dienst und nicht im Browser: so ueberlebt ein muehsam auf die
 * Scheibe ausgerichtetes Layout das Leeren des Browser-Caches und eine
 * Neuinstallation, und alle Geraete mit demselben Anzeigenamen sehen dasselbe.
 *
 * Beim Ausrichten kommen bis zu zehn Aenderungen pro Sekunde. Die gelten sofort
 * (Zwischenspeicher), auf die SD-Karte geschrieben wird gebuendelt.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeLayout, type DisplayLayout } from "./layout.js";

/**
 * Der Anzeigename kommt aus der URL (?display=beamer). Ohne Pruefung liesse
 * sich damit ueber "../" eine beliebige Datei im Dateisystem lesen oder
 * ueberschreiben - deshalb nur schlichte Namen.
 */
const VALID_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/i;

export const DEFAULT_DISPLAY = "standard";

/** Name aus der Adresse, oder der Standard, wenn er nicht taugt. */
export function displayName(raw: unknown): string {
  return typeof raw === "string" && VALID_NAME.test(raw) ? raw : DEFAULT_DISPLAY;
}

export class LayoutStore {
  readonly #cache = new Map<string, DisplayLayout>();
  readonly #pending = new Set<string>();
  #timer: NodeJS.Timeout | null = null;
  #warned = false;

  constructor(
    private readonly dir: string,
    private readonly flushDelayMs = 500,
  ) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error) {
      this.#warn(error as Error);
    }
  }

  read(display: string): DisplayLayout {
    const path = this.#pathFor(display);
    const cached = this.#cache.get(display);
    if (cached) return structuredClone(cached);
    let layout: DisplayLayout;
    try {
      layout = sanitizeLayout(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      // Noch nicht vorhanden oder beschaedigt - der Standard ist immer brauchbar.
      layout = sanitizeLayout(null);
    }
    this.#cache.set(display, layout);
    return structuredClone(layout);
  }

  /** Prueft, uebernimmt sofort und liefert das tatsaechlich gueltige Layout. */
  write(display: string, layout: unknown): DisplayLayout {
    this.#pathFor(display);
    const sanitized = sanitizeLayout(layout);
    this.#cache.set(display, sanitized);
    this.#pending.add(display);
    this.#schedule();
    return structuredClone(sanitized);
  }

  /** Schreibt alle offenen Aenderungen sofort (beim Beenden, in Tests). */
  flush(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    for (const display of this.#pending) {
      const layout = this.#cache.get(display);
      if (!layout) continue;
      try {
        writeFileSync(this.#pathFor(display), `${JSON.stringify(layout, null, 2)}\n`);
      } catch (error) {
        this.#warn(error as Error);
      }
    }
    this.#pending.clear();
  }

  #schedule(): void {
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.flush();
    }, this.flushDelayMs);
    this.#timer.unref?.();
  }

  /** Einmal warnen; danach gilt das Layout bis zum Neustart nur im Speicher. */
  #warn(error: Error): void {
    if (this.#warned) return;
    this.#warned = true;
    console.warn(`Layout kann nicht gespeichert werden: ${error.message}`);
  }

  #pathFor(display: string): string {
    if (!VALID_NAME.test(display)) {
      throw new Error(
        `Ungueltiger Anzeigename "${display}". Erlaubt sind Buchstaben, Ziffern und Bindestriche.`,
      );
    }
    return join(this.dir, `${display}.json`);
  }
}
