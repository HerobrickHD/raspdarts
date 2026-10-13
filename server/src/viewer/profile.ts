/**
 * Ein Profil ist ein Bildschirm (Beamer, Fernseher ...): Name, Format der
 * Buehne und je Spielart Inhalte und Layout - aber nur fuer angepasste
 * Spielarten. Alle anderen folgen ihrem Standard (standards.ts). Genau ein
 * Profil ist aktiv; alle Geraete zeigen es.
 */
import { isMode, sanitizeModeContent, type Content } from "./catalog.js";
import {
  DEFAULT_FORMAT,
  sanitizeFormat,
  sanitizeModeLayout,
  splitLegacyLayout,
  type Format,
  type ModeLayout,
} from "./layout.js";
import { standardFor } from "./standards.js";

export const PROFILE_VERSION = 5;
export const MAX_NAME_LENGTH = 40;
export const FALLBACK_NAME = "Profil";

/**
 * Die id ist zugleich der Dateiname. Ohne Pruefung liesse sich ueber "../"
 * eine beliebige Datei lesen oder ueberschreiben - deshalb nur schlichte Namen.
 */
export const VALID_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

export interface ModeEntry {
  content: Content;
  /** Scheibe, Bloecke und Spielerbereiche. */
  layout: ModeLayout;
}

export interface Profile {
  version: 5;
  name: string;
  format: Format;
  /** Nur angepasste Spielarten. */
  spielarten: Record<string, ModeEntry>;
}

export interface ProfileWithId extends Profile {
  id: string;
}

export interface ProfileSummary {
  id: string;
  name: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, MAX_NAME_LENGTH).trim() : "";
  return name || FALLBACK_NAME;
}

/** Neues Profil: alle Spielarten im Standard. */
export function newProfile(name: unknown, format: Format = DEFAULT_FORMAT): Profile {
  return { version: PROFILE_VERSION, name: sanitizeName(name), format, spielarten: {} };
}

/** Eintrag einer Spielart; Fehlendes oder Unbrauchbares aus fallback (Vorgabe: ihr Standard). */
export function sanitizeModeEntry(stored: unknown, mode: string, fallback: ModeEntry = standardFor(mode)): ModeEntry {
  const source = asRecord(stored);
  return {
    content: sanitizeModeContent(source["content"], mode, fallback.content),
    layout: sanitizeModeLayout(source["layout"], fallback.layout),
  };
}

/** Alle brauchbaren Eintraege; ganz Unbrauchbares faellt weg - die Spielart folgt dann ihrem Standard. */
function sanitizeEntries(stored: unknown): Record<string, ModeEntry> {
  const spielarten: Record<string, ModeEntry> = {};
  for (const [mode, entry] of Object.entries(asRecord(stored))) {
    if (isMode(mode) && isRecord(entry)) spielarten[mode] = sanitizeModeEntry(entry, mode);
  }
  return spielarten;
}

function sanitizeV5(source: Record<string, unknown>): Profile {
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(source["name"]),
    format: sanitizeFormat(source["format"]),
    spielarten: sanitizeEntries(source["spielarten"]),
  };
}

/**
 * Profil-Version 3 (Oktober 2026): ein Satz Inhalte und ein Layout fuer alles.
 * Das wird die angepasste Spielart X01 - so sieht X01 mit 2 Spielern aus wie
 * vorher. Neue Optionen so, dass das Bild gleich bleibt.
 */
export function fromV3(source: Record<string, unknown>): Profile {
  const content = asRecord(source["content"]);
  const spielinfo = asRecord(content["spielinfo"]);
  const x01Content = {
    ...content,
    spieler: { ...asRecord(content["spieler"]), verteilung: "beide" },
    spielinfo: { ...spielinfo, spielart: spielinfo["spielart"] ?? false },
  };
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(source["name"]),
    format: DEFAULT_FORMAT,
    spielarten: {
      x01: {
        content: sanitizeModeContent(x01Content, "x01", standardFor("x01").content),
        layout: splitLegacyLayout(source["layout"]),
      },
    },
  };
}

/**
 * Profil-Version 4 (13. Oktober 2026): ein gemeinsamer Teil (Hintergrund,
 * Scheibe samt Lage, Format) und angepasste Spielarten. Der gemeinsame Teil
 * wandert in X01 und in jede angepasste Spielart - dort galt er ja auch.
 */
export function fromV4(source: Record<string, unknown>): Profile {
  const gemeinsam = asRecord(source["gemeinsam"]);
  const shared = asRecord(gemeinsam["content"]);
  const stored = asRecord(source["spielarten"]);
  const modes = new Set(["x01", ...Object.keys(stored).filter((mode) => isMode(mode) && isRecord(stored[mode]))]);
  const spielarten: Record<string, ModeEntry> = {};
  for (const mode of modes) {
    const entry = asRecord(stored[mode]);
    const layout = asRecord(entry["layout"]);
    spielarten[mode] = sanitizeModeEntry(
      {
        content: { ...asRecord(entry["content"]), ...shared },
        layout: { ...layout, board: gemeinsam["board"] },
      },
      mode,
    );
  }
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(source["name"]),
    format: sanitizeFormat(gemeinsam["format"]),
    spielarten,
  };
}

/** Macht aus beliebigem gespeichertem Inhalt ein brauchbares Profil. */
export function sanitizeProfile(stored: unknown): Profile {
  const source = asRecord(stored);
  if (source["version"] === PROFILE_VERSION) return sanitizeV5(source);
  if (source["version"] === 4) return fromV4(source);
  if (source["version"] === 3) return fromV3(source);
  return newProfile(source["name"]);
}

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** id aus dem Namen: Kleinbuchstaben, Ziffern, Bindestrich, hoechstens 32 Zeichen. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "");
  return slug || "profil";
}

/** id aus dem Namen, bei Doppelung mit -2, -3 ... */
export function uniqueId(name: string, taken: (id: string) => boolean): string {
  const base = slugify(name);
  if (!taken(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const id = `${base.slice(0, 32 - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken(id)) return id;
  }
}
