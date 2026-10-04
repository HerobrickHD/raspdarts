/**
 * Speichert das eingerichtete Layout pro Anzeige als JSON-Datei.
 *
 * Bewusst beim Dienst und nicht im Browser: so ueberlebt ein muehsam
 * ausgerichtetes Beamer-Layout das Leeren des Browser-Caches und eine
 * Neuinstallation des Pi. Und der Beamer behaelt seine Einstellung, wenn du
 * am Handy etwas verschiebst.
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

export const DEFAULT_DISPLAY = "beamer";

export class LayoutStore {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  read(display: string): DisplayLayout {
    const path = this.#pathFor(display);
    try {
      return sanitizeLayout(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      // Noch nicht vorhanden oder beschaedigt - der Standard ist immer brauchbar.
      return sanitizeLayout(null);
    }
  }

  /** Prueft, speichert und liefert das tatsaechlich gespeicherte Layout zurueck. */
  write(display: string, layout: unknown): DisplayLayout {
    const path = this.#pathFor(display);
    const sanitized = sanitizeLayout(layout);
    writeFileSync(path, `${JSON.stringify(sanitized, null, 2)}\n`);
    return sanitized;
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
