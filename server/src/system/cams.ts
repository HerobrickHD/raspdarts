/**
 * Kamerabilder von Autodarts fuer die Boards-Seite der Extension.
 *
 * Raspdarts oeffnet die Kameras nie selbst - Autodarts belegt sie exklusiv.
 * Stattdessen liefert Autodarts das zuletzt aufgenommene Bild ueber seine
 * lokale Schnittstelle. Damit Autodarts davon nichts merkt, fragt dieser
 * Baustein hoechstens einmal pro Sekunde und Kamera nach, egal wie viele
 * Browser zuschauen, und im Standby gar nicht (dann liefert Autodarts ohnehin
 * nur schwarze Bilder). Siehe docs/superpowers/specs/2026-10-12-kameras-design.md.
 *
 * Die Config von Autodarts enthaelt den API-Key des Boards; hier werden nur
 * Board-ID und Kameraanzahl herausgenommen, der Rest verlaesst diese Datei nie.
 */
import { parseBoardState } from "./status.js";

export interface AutodartsHttp {
  /** GET mit Zeitlimit; wirft bei Netzfehler, Zeitueberschreitung oder Fehlerstatus. */
  json(path: string, timeoutMs: number): Promise<unknown>;
  bytes(path: string, timeoutMs: number): Promise<Buffer>;
}

export interface CamsDeps {
  http: AutodartsHttp;
  now: () => number;
}

export interface CamsInfo {
  board_id: string | null;
  cams: number;
  /** Bildabrufe bei Autodarts seit dem Start (fuer die Abnahme-Messung). */
  fetched: number;
}

export type CamFailure = "not-found" | "board-stopped" | "unavailable";
export type CamImage = { ok: true; jpeg: Buffer } | { ok: false; reason: CamFailure };

export interface Cams {
  /** Wirft, wenn Autodarts nicht antwortet. */
  info(): Promise<CamsInfo>;
  /** fresh: neues Bild holen, auch wenn das gemerkte juenger als eine Sekunde ist (Kamera-Ansicht nach einem Wurf). */
  image(n: number, options?: { fresh?: boolean }): Promise<CamImage>;
  /** Ringpunkte der Kalibrierung je Kamera (Autodarts: /api/config/calibration/ellipses); null, wenn nicht lesbar. */
  calibration(): Promise<unknown>;
}

const TIMEOUT_MS = 2000;
const IMAGE_TTL_MS = 1000;
const STATE_TTL_MS = 1000;
const CONFIG_TTL_MS = 30_000;
/** Die Kalibrierung aendert sich nur beim Kalibrieren - einmal pro Minute nachsehen reicht. */
const CALIBRATION_TTL_MS = 60_000;
const FAILURE_TTL_MS = 1000;

/** Nimmt aus der Autodarts-Config nur Board-ID und Anzahl belegter Kamera-Plaetze. */
export function parseCamsConfig(body: unknown): { board_id: string | null; cams: number } | null {
  if (typeof body !== "object" || body === null) return null;
  const { auth, cam } = body as Record<string, unknown>;
  const list = (cam as Record<string, unknown> | null | undefined)?.["cams"];
  if (!Array.isArray(list)) return null;
  const id = (auth as Record<string, unknown> | null | undefined)?.["board_id"];
  return {
    board_id: typeof id === "string" && id.length > 0 ? id : null,
    cams: list.filter((entry) => typeof entry === "string" && entry.length > 0).length,
  };
}

/**
 * Haelt das Ergebnis von `load` fuer `ttlMs` ab dem Ende des Abrufs. Solange
 * ein Abruf laeuft, bekommen alle Aufrufer denselben - auch wenn er laenger
 * als `ttlMs` dauert. Ein Fehler wird nicht gemerkt. Springt die Uhr zurueck
 * (der Pi hat keine Echtzeituhr), gilt der Wert als abgelaufen. force laedt
 * in jedem Fall neu und ersetzt den gemerkten Wert.
 */
export function cached<T>(ttlMs: number, now: () => number, load: () => Promise<T>): (force?: boolean) => Promise<T> {
  let entry: { promise: Promise<T>; settledAt: number | null } | null = null;
  const fresh = (settledAt: number) => {
    const age = now() - settledAt;
    return age >= 0 && age < ttlMs;
  };
  return (force = false) => {
    if (!force && entry && (entry.settledAt === null || fresh(entry.settledAt))) return entry.promise;
    const current: { promise: Promise<T>; settledAt: number | null } = { promise: load(), settledAt: null };
    entry = current;
    current.promise.then(
      () => {
        current.settledAt = now();
      },
      () => {
        if (entry === current) entry = null;
      },
    );
    return current.promise;
  };
}

export function createCams(deps: CamsDeps): Cams {
  let fetched = 0;

  const configOk = cached(CONFIG_TTL_MS, deps.now, async () => {
    const parsed = parseCamsConfig(await deps.http.json("/api/config", TIMEOUT_MS));
    if (!parsed) throw new Error("Unerwartete Config");
    return parsed;
  });
  // Ein Fehler gilt eine Sekunde, damit Autodarts auch dann gebremst gefragt wird.
  const configOrNull = cached(FAILURE_TTL_MS, deps.now, async () => {
    try {
      return await configOk();
    } catch {
      return null;
    }
  });
  async function config(): Promise<{ board_id: string | null; cams: number }> {
    const result = await configOrNull();
    if (!result) throw new Error("Autodarts-Config nicht lesbar");
    return result;
  }

  // null = keine brauchbare Antwort; auch das gilt eine Sekunde.
  const running = cached(STATE_TTL_MS, deps.now, async (): Promise<boolean | null> => {
    try {
      return parseBoardState(await deps.http.json("/api/state", TIMEOUT_MS))?.running ?? null;
    } catch {
      return null;
    }
  });

  const calibrationOk = cached(CALIBRATION_TTL_MS, deps.now, () =>
    deps.http.json("/api/config/calibration/ellipses", TIMEOUT_MS),
  );
  const calibration = cached(FAILURE_TTL_MS, deps.now, async (): Promise<unknown> => {
    try {
      return await calibrationOk();
    } catch {
      return null;
    }
  });

  const images = new Map<number, (force?: boolean) => Promise<CamImage>>();
  function imageOf(n: number, fresh: boolean): Promise<CamImage> {
    let load = images.get(n);
    if (!load) {
      load = cached(IMAGE_TTL_MS, deps.now, async (): Promise<CamImage> => {
        fetched += 1;
        try {
          return { ok: true, jpeg: await deps.http.bytes(`/api/img/cams/${n}`, TIMEOUT_MS) };
        } catch {
          return { ok: false, reason: "unavailable" };
        }
      });
      images.set(n, load);
    }
    return load(fresh);
  }

  return {
    async info() {
      const { board_id, cams } = await config();
      return { board_id, cams, fetched };
    },
    calibration: () => calibration(),
    async image(n, options = {}) {
      let cams: number;
      try {
        ({ cams } = await config());
      } catch {
        return { ok: false, reason: "unavailable" };
      }
      if (!Number.isInteger(n) || n < 0 || n >= cams) return { ok: false, reason: "not-found" };
      const state = await running();
      if (state === null) return { ok: false, reason: "unavailable" };
      if (!state) return { ok: false, reason: "board-stopped" };
      return imageOf(n, options.fresh === true);
    },
  };
}

export function autodartsHttp(baseUrl: string): AutodartsHttp {
  async function get(path: string, timeoutMs: number): Promise<Response> {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  }
  return {
    json: async (path, timeoutMs) => (await get(path, timeoutMs)).json(),
    bytes: async (path, timeoutMs) => Buffer.from(await (await get(path, timeoutMs)).arrayBuffer()),
  };
}
