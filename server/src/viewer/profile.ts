/**
 * Ein Profil: Name, was der Viewer zeigt (Inhalte, siehe catalog.ts) und wo
 * (Layout). Genau ein Profil ist aktiv; alle Geraete zeigen es.
 */
import { DEFAULT_TEMPLATE, sanitizeContent, templateContent, type Content } from "./catalog.js";
import { DEFAULT_LAYOUT, sanitizeLayout, type DisplayLayout } from "./layout.js";

export const PROFILE_VERSION = 3;
export const MAX_NAME_LENGTH = 40;
export const FALLBACK_NAME = "Profil";

/**
 * Die id ist zugleich der Dateiname. Ohne Pruefung liesse sich ueber "../"
 * eine beliebige Datei lesen oder ueberschreiben - deshalb nur schlichte Namen.
 */
export const VALID_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

export interface Profile {
  version: 3;
  name: string;
  content: Content;
  layout: DisplayLayout;
}

export interface ProfileWithId extends Profile {
  id: string;
}

export interface ProfileSummary {
  id: string;
  name: string;
}

export function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, MAX_NAME_LENGTH).trim() : "";
  return name || FALLBACK_NAME;
}

/** Neues Profil: Inhalte aus der Vorlage (unbekannt → Projektion), Standardlayout. */
export function newProfile(name: unknown, template: unknown = DEFAULT_TEMPLATE): Profile {
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(name),
    content: templateContent(template) ?? templateContent(DEFAULT_TEMPLATE) ?? sanitizeContent(null),
    layout: structuredClone(DEFAULT_LAYOUT),
  };
}

/** Macht aus beliebigem gespeichertem Inhalt ein brauchbares Profil. */
export function sanitizeProfile(stored: unknown): Profile {
  const source = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  if (source["version"] !== PROFILE_VERSION) return newProfile(source["name"]);
  return {
    version: PROFILE_VERSION,
    name: sanitizeName(source["name"]),
    content: sanitizeContent(source["content"]),
    layout: sanitizeLayout(source["layout"]),
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
