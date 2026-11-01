/**
 * Scheibe automatisch ausrichten - der Teil auf dem Pi: Pruefbild an alle
 * Viewer schalten und je Kamera ein Bild bei Schwarz und eines mit Punkten
 * holen. Rechnen tut der Browser mit der Leiste (public/js/align.js), so
 * braucht der Pi keine Bibliothek zum Entpacken von JPEGs.
 *
 * Autodarts wird nur ueber seine Bild-Schnittstelle gefragt (cams.ts): je
 * Kamera zwei Bilder, dazwischen PATTERN_SETTLE_MS - also hoechstens eines pro
 * Sekunde. Im Spiel nie (Licht auf der Scheibe kann als Wurf zaehlen); startet
 * eines, bricht die Messung ab. Siehe
 * docs/superpowers/specs/2026-11-01-auto-ausrichten-design.md.
 */
import type { CamImage, Cams } from "../system/cams.js";
import { cameraMatrices, type Homography } from "./camera-geometry.js";
import type { DisplayHub } from "./display-hub.js";

/** Wartezeit nach jedem Bildwechsel, bis Beamer und Kamera ihn sicher zeigen. */
export const PATTERN_SETTLE_MS = 1000;

export type AlignFailure = "playing" | "busy" | "board-stopped" | "unavailable" | "no-calibration";
export type AlignCapture =
  | { ok: true; cams: { n: number; matrix: Homography; black: string; dots: string }[] }
  | { ok: false; reason: AlignFailure };

export interface AlignerDeps {
  cams: Pick<Cams, "image" | "calibration">;
  hub: Pick<DisplayHub, "setPattern" | "state">;
  sleep?: (ms: number) => Promise<void>;
}

class Abort extends Error {
  constructor(readonly reason: AlignFailure) {
    super(reason);
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class Aligner {
  #busy = false;

  constructor(private readonly deps: AlignerDeps) {}

  async capture(): Promise<AlignCapture> {
    if (this.#busy) return { ok: false, reason: "busy" };
    if (this.#playing()) return { ok: false, reason: "playing" };
    this.#busy = true;
    try {
      const matrices = cameraMatrices(await this.deps.cams.calibration({ fresh: true }));
      const cams = Object.keys(matrices)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0)
        .sort((a, b) => a - b);
      if (cams.length === 0) {
        // Im Standby hat Autodarts die Kameras zu und liefert auch keine Kalibrierung -
        // cams.image fragt dann nur den Zustand ab, kein Bild.
        const probe = await this.deps.cams.image(0);
        return { ok: false, reason: !probe.ok && probe.reason === "board-stopped" ? "board-stopped" : "no-calibration" };
      }
      try {
        const black = await this.#shoot("black", cams);
        const dots = await this.#shoot("dots", cams);
        return {
          ok: true,
          cams: cams.map((n, i) => ({ n, matrix: matrices[String(n)]!, black: black[i]!, dots: dots[i]! })),
        };
      } catch (error) {
        if (error instanceof Abort) return { ok: false, reason: error.reason };
        throw error;
      } finally {
        this.deps.hub.setPattern(null);
      }
    } finally {
      this.#busy = false;
    }
  }

  #playing(): boolean {
    return this.deps.hub.state.phase === "playing";
  }

  /** Pruefbild zeigen, warten, dann von jeder Kamera ein frisches Bild (Base64). */
  async #shoot(pattern: "black" | "dots", cams: number[]): Promise<string[]> {
    if (this.#playing()) throw new Abort("playing");
    this.deps.hub.setPattern(pattern);
    await (this.deps.sleep ?? wait)(PATTERN_SETTLE_MS);
    if (this.#playing()) throw new Abort("playing");
    const images: CamImage[] = await Promise.all(cams.map((n) => this.deps.cams.image(n, { fresh: true })));
    return images.map((image) => {
      if (image.ok) return image.jpeg.toString("base64");
      throw new Abort(image.reason === "board-stopped" ? "board-stopped" : "unavailable");
    });
  }
}
