/**
 * Speichert die Viewer-Profile als JSON-Dateien und merkt sich das aktive.
 *
 * Bewusst beim Dienst und nicht im Browser: ein muehsam auf die Scheibe
 * ausgerichtetes Profil ueberlebt so das Leeren des Browser-Caches und eine
 * Neuinstallation, und alle Geraete zeigen dasselbe.
 *
 * Alle Profile liegen im Speicher (es sind wenige, jedes ein paar KB). Beim
 * Ausrichten kommen bis zu zehn Aenderungen pro Sekunde; die gelten sofort,
 * auf die SD-Karte geht es gebuendelt und atomar (erst .tmp, dann umbenennen),
 * damit ein Stromausfall nie eine halbe Datei hinterlaesst.
 *
 * Profile frueherer Versionen starten beim Laden im Standard (nur Name und
 * Format bleiben) und werden erst beim naechsten Aendern neu geschrieben.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeContent } from "./catalog.js";
import { fromLegacyLayout, sanitizeFormat, sanitizeLayout } from "./layout.js";
import {
  VALID_ID,
  newProfile,
  sanitizeName,
  sanitizeProfile,
  uniqueId,
  type Profile,
  type ProfileSummary,
  type ProfileWithId,
} from "./profile.js";
import { standard } from "./standards.js";

export type ProfileErrorCode = "invalid-id" | "not-found" | "last-profile";

/** Fehler des Aufrufers; http.ts macht daraus 400/404/409. */
export class ProfileError extends Error {
  constructor(
    readonly code: ProfileErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface ProfilePatch {
  name?: unknown;
  format?: unknown;
  content?: unknown;
  /** Scheibe und Bloecke: { board, blocks } */
  layout?: unknown;
}

const ACTIVE_FILE = "active.json";
/** Waere der Dateiname des aktiven Profils - als Profil-id gesperrt. */
const RESERVED_ID = "active";
const FIRST_ID = "standard";

export class ProfileStore {
  readonly #profiles = new Map<string, Profile>();
  readonly #pending = new Set<string>();
  #active = FIRST_ID;
  #activePending = false;
  #timer: NodeJS.Timeout | null = null;
  #warned = false;

  constructor(
    private readonly dir: string,
    legacyDir: string | null = null,
    private readonly flushDelayMs = 500,
  ) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (error) {
      this.#warn(error as Error);
    }
    this.#load();
    if (this.#profiles.size === 0) this.#createFirst(legacyDir);
    this.#loadActive();
  }

  get activeId(): string {
    return this.#active;
  }

  /** Alle Profile nach Name. */
  list(): ProfileSummary[] {
    return [...this.#profiles]
      .map(([id, profile]) => ({ id, name: profile.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
  }

  read(id: string): ProfileWithId {
    return { id, ...structuredClone(this.#get(id)) };
  }

  active(): ProfileWithId {
    return this.read(this.#active);
  }

  /** Neues Profil im Standard; Format wie im aktiven (derselbe Bildschirm). */
  create(name: unknown): ProfileWithId {
    const profile = newProfile(name, this.#profiles.get(this.#active)?.format);
    const id = uniqueId(profile.name, (candidate) => candidate === RESERVED_ID || this.#profiles.has(candidate));
    this.#profiles.set(id, profile);
    this.#markDirty(id);
    this.#setActive(id);
    return this.read(id);
  }

  /** Aendert nur, was mitgeschickt wird; Unbrauchbares behaelt den bisherigen Wert. */
  update(id: string, patch: ProfilePatch): ProfileWithId {
    const current = this.#get(id);
    const next: Profile = structuredClone(current);
    let changed = false;

    if (patch.name !== undefined) {
      next.name = sanitizeName(patch.name);
      changed = true;
    }
    if (patch.format !== undefined) {
      next.format = sanitizeFormat(patch.format, current.format);
      changed = true;
    }
    if (patch.content !== undefined) {
      next.content = sanitizeContent(patch.content, current.content);
      changed = true;
    }
    if (patch.layout !== undefined) {
      next.layout = sanitizeLayout(patch.layout, current.layout);
      changed = true;
    }

    if (!changed) return this.read(id); // Lebenszeichen: nichts auf die SD-Karte
    this.#profiles.set(id, next);
    this.#markDirty(id);
    return this.read(id);
  }

  /** Inhalte und Layout auf den Standard; Name und Format (der Bildschirm) bleiben. */
  reset(id: string): ProfileWithId {
    const current = this.#get(id);
    this.#profiles.set(id, { ...current, ...standard() });
    this.#markDirty(id);
    return this.read(id);
  }

  remove(id: string): void {
    this.#get(id);
    if (this.#profiles.size <= 1) {
      throw new ProfileError("last-profile", "Das letzte Profil kann nicht geloescht werden");
    }
    this.#profiles.delete(id);
    this.#pending.delete(id);
    try {
      rmSync(this.#pathFor(id), { force: true });
    } catch (error) {
      this.#warn(error as Error);
    }
    const [first] = this.list();
    if (this.#active === id && first) this.#setActive(first.id);
  }

  setActive(id: string): void {
    this.#get(id);
    this.#setActive(id);
  }

  /** Schreibt alle offenen Aenderungen sofort (beim Beenden, in Tests). */
  flush(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    for (const id of this.#pending) {
      const profile = this.#profiles.get(id);
      if (profile) this.#writeAtomic(this.#pathFor(id), profile);
    }
    this.#pending.clear();
    if (this.#activePending) {
      this.#writeAtomic(join(this.dir, ACTIVE_FILE), { id: this.#active });
      this.#activePending = false;
    }
  }

  #get(id: string): Profile {
    if (!VALID_ID.test(id)) {
      throw new ProfileError(
        "invalid-id",
        `Ungueltiger Profilname "${id}". Erlaubt sind Kleinbuchstaben, Ziffern und Bindestriche.`,
      );
    }
    const profile = this.#profiles.get(id);
    if (!profile) throw new ProfileError("not-found", `Profil "${id}" gibt es nicht`);
    return profile;
  }

  #load(): void {
    let files: string[];
    try {
      files = readdirSync(this.dir);
    } catch {
      return; // Ordner fehlt oder ist keiner - dann eben ohne Dateien
    }
    for (const file of files) {
      if (!file.endsWith(".json") || file === ACTIVE_FILE) continue;
      const id = file.slice(0, -".json".length);
      if (!VALID_ID.test(id) || id === RESERVED_ID) continue;
      this.#profiles.set(id, sanitizeProfile(this.#readJson(join(this.dir, file))));
    }
  }

  /** Erster Start: das bisher ausgerichtete Layout wird zum Profil "Standard". */
  #createFirst(legacyDir: string | null): void {
    const legacy = legacyDir === null ? null : fromLegacyLayout(this.#readJson(join(legacyDir, "standard.json")));
    const profile = newProfile("Standard");
    if (legacy) {
      profile.content = sanitizeContent({ scheibe: { darstellung: legacy.boardMode } }, profile.content);
      profile.layout = legacy.layout;
    }
    this.#profiles.set(FIRST_ID, profile);
    this.#pending.add(FIRST_ID);
    this.#active = FIRST_ID;
    this.#activePending = true;
    this.flush();
  }

  #loadActive(): void {
    const stored = this.#readJson(join(this.dir, ACTIVE_FILE));
    const id = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>)["id"] : null;
    if (typeof id === "string" && this.#profiles.has(id)) {
      this.#active = id;
      return;
    }
    const [first] = this.list();
    if (first) this.#setActive(first.id);
  }

  #readJson(path: string): unknown {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return null; // fehlt oder beschaedigt - die Pruefung macht daraus Brauchbares
    }
  }

  #setActive(id: string): void {
    this.#active = id;
    this.#activePending = true;
    this.#schedule();
  }

  #markDirty(id: string): void {
    this.#pending.add(id);
    this.#schedule();
  }

  #schedule(): void {
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.flush();
    }, this.flushDelayMs);
    this.#timer.unref?.();
  }

  #writeAtomic(path: string, data: unknown): void {
    const temp = `${path}.tmp`;
    try {
      writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`);
      renameSync(temp, path);
    } catch (error) {
      this.#warn(error as Error);
    }
  }

  /** Einmal warnen; danach gelten die Profile bis zum Neustart nur im Speicher. */
  #warn(error: Error): void {
    if (this.#warned) return;
    this.#warned = true;
    console.warn(`Profile koennen nicht gespeichert werden: ${error.message}`);
  }

  #pathFor(id: string): string {
    return join(this.dir, `${id}.json`);
  }
}
