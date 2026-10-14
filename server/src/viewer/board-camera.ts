/**
 * Kamera-Ansicht der Scheibe: holt Bilder der Autodarts-Kameras nur, wenn
 * sich auf der Scheibe etwas aendert - nach jedem Pfeil und wenn die Pfeile
 * herausgezogen sind -, merkt sich das letzte Bild je Kamera und meldet neue
 * Bilder an die Viewer. Alle Bildschirme bekommen das Bild von hier; Autodarts
 * wird pro Ereignis nur einmal gefragt.
 *
 * Autodarts darf nie gestoert werden: hoechstens zwei Bilder pro Sekunde und
 * Kamera, und im Standby gar keine (cams.ts antwortet dann ohne Abruf).
 */
import { cameraMatrices, type Homography } from "./camera-geometry.js";
import type { CamImage } from "../system/cams.js";
import type { ViewerState } from "./game-state.js";
import type { Profile } from "./profile.js";

/** Nach dem Wurf kurz warten, damit der Pfeil schon im Kamerabild steckt. */
export const SETTLE_MS = 500;
/** Hoechstens zwei Bilder pro Sekunde und Kamera. */
export const MIN_GAP_MS = 500;

export interface BoardCameraDeps {
  cams: {
    image(n: number, options?: { fresh?: boolean }): Promise<CamImage>;
    calibration(): Promise<unknown>;
  };
  /** Welche Kamera das aktive Profil zeigt; null = keine Kamera-Ansicht. */
  wanted(): number | null;
  notify(update: { cam: number; version: number }): void;
}

export interface CameraInfo {
  cams: { n: number; version: number | null; matrix: Homography | null }[];
}

/** Welche Kamera das Profil zeigt; null = keine Kamera-Ansicht. */
export function wantedCamera(profile: Profile): number | null {
  const scheibe = profile.content["scheibe"];
  if (!scheibe?.on || scheibe["darstellung"] !== "kamera") return null;
  const cam = Number(scheibe["kamera"]);
  return Number.isInteger(cam) && cam >= 0 ? cam : null;
}

const dartCount = (state: ViewerState): number | null => (state.phase === "playing" ? state.turn.darts.length : null);

/** Hat sich auf der Scheibe etwas geaendert? Ein neuer Pfeil, oder die Pfeile sind heraus (neue Aufnahme leer). */
export function cameraTrigger(prev: ViewerState, next: ViewerState): boolean {
  const before = dartCount(prev);
  const after = dartCount(next);
  if (before === null || after === null) return false;
  return after > before || (after === 0 && before > 0);
}

interface Slot {
  latest: { jpeg: Buffer; version: number } | null;
  lastFetchAt: number | null;
  timer: NodeJS.Timeout | null;
  dueAt: number;
  busy: boolean;
}

export class BoardCamera {
  readonly #slots = new Map<number, Slot>();

  constructor(private readonly deps: BoardCameraDeps) {}

  /** Vom Datenfluss bei jedem neuen Spielstand aufgerufen. */
  onState(prev: ViewerState, next: ViewerState): void {
    if (!cameraTrigger(prev, next)) return;
    const cam = this.deps.wanted();
    if (cam !== null) this.#schedule(cam, SETTLE_MS);
  }

  /** Sofort holen (gebremst) - fuer die Vorschaubilder und frisch verbundene Viewer. */
  refresh(cams: number[]): void {
    for (const cam of cams) this.#schedule(cam, 0);
  }

  latest(cam: number): { jpeg: Buffer; version: number } | null {
    return this.#slots.get(cam)?.latest ?? null;
  }

  async info(): Promise<CameraInfo> {
    const matrices = cameraMatrices(await this.deps.cams.calibration());
    const numbers = new Set([...Object.keys(matrices).map(Number), ...this.#slots.keys()]);
    return {
      cams: [...numbers]
        .filter((n) => Number.isInteger(n) && n >= 0)
        .sort((a, b) => a - b)
        .map((n) => ({ n, version: this.latest(n)?.version ?? null, matrix: matrices[String(n)] ?? null })),
    };
  }

  close(): void {
    for (const slot of this.#slots.values()) if (slot.timer) clearTimeout(slot.timer);
  }

  #slot(cam: number): Slot {
    let slot = this.#slots.get(cam);
    if (!slot) {
      slot = { latest: null, lastFetchAt: null, timer: null, dueAt: 0, busy: false };
      this.#slots.set(cam, slot);
    }
    return slot;
  }

  /**
   * Holt spaetestens nach `delayMs` ein Bild, aber nie frueher als MIN_GAP_MS
   * nach dem letzten. Kommt waehrenddessen ein weiteres Ereignis, rueckt der
   * Abruf nach hinten - so ist der letzte Pfeil sicher im Bild.
   */
  #schedule(cam: number, delayMs: number): void {
    const slot = this.#slot(cam);
    const now = Date.now();
    const due = Math.max(now + delayMs, (slot.lastFetchAt ?? -Infinity) + MIN_GAP_MS, slot.timer ? slot.dueAt : 0);
    if (slot.timer) clearTimeout(slot.timer);
    slot.dueAt = due;
    slot.timer = setTimeout(() => {
      slot.timer = null;
      void this.#fetch(cam);
    }, due - now);
    slot.timer.unref?.();
  }

  async #fetch(cam: number): Promise<void> {
    const slot = this.#slot(cam);
    if (slot.busy) {
      this.#schedule(cam, MIN_GAP_MS);
      return;
    }
    slot.busy = true;
    slot.lastFetchAt = Date.now();
    try {
      const result = await this.deps.cams.image(cam, { fresh: true });
      // Standby oder Fehler: das letzte Bild bleibt stehen.
      if (!result.ok) return;
      const version = (slot.latest?.version ?? 0) + 1;
      slot.latest = { jpeg: result.jpeg, version };
      this.deps.notify({ cam, version });
    } finally {
      slot.busy = false;
    }
  }
}
