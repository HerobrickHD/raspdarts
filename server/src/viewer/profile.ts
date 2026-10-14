/**
 * Ein Profil ist ein Bildschirm (Beamer, Fernseher ...): Name, Format der
 * Buehne, Inhalte und Layout - einmal fuer alle Spielarten. Was es in einer
 * Spielart nicht gibt, laesst der Viewer dort weg. Genau ein Profil ist
 * aktiv; alle Geraete zeigen es.
 */
import { sanitizeContent, type Content } from "./catalog.js";
import { DEFAULT_FORMAT, sanitizeFormat, sanitizeLayout, type Format, type Layout } from "./layout.js";
import { standard } from "./standards.js";

export const PROFILE_VERSION = 8;
export const MAX_NAME_LENGTH = 40;
export const FALLBACK_NAME = "Profil";

/**
 * Die id ist zugleich der Dateiname. Ohne Pruefung liesse sich ueber "../"
 * eine beliebige Datei lesen oder ueberschreiben - deshalb nur schlichte Namen.
 */
export const VALID_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

export interface Profile {
  version: 8;
  name: string;
  format: Format;
  content: Content;
  /** Scheibe, Bloecke und Spielerbereiche. */
  layout: Layout;
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

export function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, MAX_NAME_LENGTH).trim() : "";
  return name || FALLBACK_NAME;
}

/** Neues Profil im Standard. */
export function newProfile(name: unknown, format: Format = DEFAULT_FORMAT): Profile {
  return { version: PROFILE_VERSION, name: sanitizeName(name), format, ...standard() };
}

/**
 * Macht aus beliebigem gespeichertem Inhalt ein brauchbares Profil; Fehlendes
 * kommt aus dem Standard. Profile frueherer Versionen (je Spielart) behalten
 * nur Name und Format und starten sonst im Standard.
 */
export function sanitizeProfile(stored: unknown): Profile {
  const source = asRecord(stored);
  const profile = newProfile(source["name"], sanitizeFormat(source["format"]));
  if (source["version"] !== PROFILE_VERSION) return profile;
  return {
    ...profile,
    content: sanitizeContent(source["content"], profile.content),
    layout: sanitizeLayout(source["layout"], profile.layout),
  };
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
