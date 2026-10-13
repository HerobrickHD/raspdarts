/**
 * Uebersetzt die rohe Autodarts-Match-Nachricht in den ViewerState - den
 * einzigen Vertrag zwischen Dienst und Viewer.
 *
 * Diese Datei ist die einzige Stelle, die das Drahtformat von Autodarts kennt.
 * Spielregeln (Rest, Bust, Checkout-Weg, Sieger) entscheidet Autodarts; hier
 * wird nur uebersetzt, nie gerechnet. Felder geprueft am Mitschnitt vom
 * 8. Oktober 2026 (docs/referenz/autodarts-spielansicht/).
 *
 * Ausser X01 sind die Felder der Spielarten ungeprueft: uebersetzt wird, was
 * in allen gleich aussieht (Spieler, Punktestand, Aufnahme); was fehlt, bleibt
 * leer statt geraten. Die Reihenfolge der Spieler ist immer die von Autodarts -
 * man sieht, wer werfen muss.
 */
import { modeForVariant } from "./catalog.js";

/** Ein Feld der Scheibe. multiplier 0 / number 0 = daneben. */
export interface Field {
  multiplier: 0 | 1 | 2 | 3;
  number: number;
  /** Nur bei Single: innerer oder aeusserer Teil, sonst null. */
  ring: "inner" | "outer" | null;
}

export type Mode = "Straight" | "Double" | "Master";

export interface MatchInfo {
  /** Startpunkte bei X01; sonst null. */
  baseScore: number | null;
  legsToWin: number;
  setsToWin: number | null;
  inMode: Mode | null;
  outMode: Mode | null;
}

export interface PlayerView {
  /** Platz 1-6 = Stelle in den Autodarts-Daten dieses Stands (Wurfreihenfolge). */
  seat: number;
  name: string;
  avatarUrl: string | null;
  country: string | null;
  score: number;
  legs: number;
  sets: number;
  average: { leg: number; match: number };
  dartsThrown: number;
  isActive: boolean;
  isWinner: boolean;
  /** Der aktive Spieler hat in dieser Aufnahme ueberworfen. */
  busted: boolean;
  checkout: Field[] | null;
}

export interface TurnDart {
  field: Field;
  /** Autodarts-Koordinaten: 1 = Aussenkante Double-Ring, y nach oben. */
  coords: { x: number; y: number } | null;
}

export interface Highlight {
  field: Field;
  kind: "last-dart";
}

export type ViewerState =
  | { phase: "idle" }
  | {
      phase: "playing";
      /** Roher Wert von Autodarts. */
      variant: string;
      /** id aus dem Katalog; null = unbekannte Spielart. */
      mode: string | null;
      match: MatchInfo;
      players: PlayerView[];
      turn: { darts: TurnDart[]; points: number; busted: boolean };
      highlights: Highlight[];
    };

export const IDLE: ViewerState = { phase: "idle" };
export const MISS: Field = { multiplier: 0, number: 0, ring: null };

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asObject = (v: unknown): Json => (isObject(v) ? v : {});
const asNumber = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const asText = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** Frames kommen je nach Kanal entweder direkt oder in ein `data`-Feld verpackt. */
function unwrap(raw: unknown): unknown {
  if (isObject(raw) && "data" in raw && isObject(raw["data"])) return raw["data"];
  return raw;
}

/** Feld aus einem Autodarts-Segment ({ bed, multiplier, number }). */
export function toField(raw: unknown): Field {
  if (!isObject(raw)) return MISS;
  const number = asNumber(raw["number"]);
  const rawMultiplier = asNumber(raw["multiplier"]);
  const isNumber = (number >= 1 && number <= 20) || number === 25;
  if (!isNumber || (rawMultiplier !== 1 && rawMultiplier !== 2 && rawMultiplier !== 3)) return MISS;
  if (number === 25 && rawMultiplier === 3) return MISS;
  // TypeScript engt number nicht per Vergleich auf 1 | 2 | 3 ein.
  const multiplier = rawMultiplier as 1 | 2 | 3;

  const bed = raw["bed"];
  const ring =
    multiplier === 1 && number !== 25
      ? bed === "SingleInner"
        ? "inner"
        : bed === "SingleOuter"
          ? "outer"
          : null
      : null;
  return { multiplier, number, ring };
}

function toCoords(raw: unknown): { x: number; y: number } | null {
  if (!isObject(raw)) return null;
  const { x, y } = raw;
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

const toMode = (v: unknown): Mode => (v === "Double" || v === "Master" ? v : "Straight");

/** Ein leerer Weg (Autodarts schickt [] nach dem Leg) ist kein Weg. */
function toCheckout(raw: unknown): Field[] | null {
  const guide = asArray(raw);
  return guide.length === 0 ? null : guide.map(toField);
}

export function toViewerState(raw: unknown): ViewerState {
  const state = unwrap(raw);
  if (!isObject(state)) return IDLE;

  const players = asArray(state["players"]);
  const gameScores = asArray(state["gameScores"]);
  if (players.length === 0 || gameScores.length === 0) return IDLE;

  const variant = asText(state["variant"]) ?? "X01";
  const mode = modeForVariant(variant);

  const activeIndex = asNumber(state["player"], -1);
  const winner = asNumber(state["winner"], -1);
  const turnBusted = state["turnBusted"] === true;
  const scores = asArray(state["scores"]);
  const stats = asArray(state["stats"]);
  const inner = asObject(state["state"]);
  const guides = inner["checkoutGuides"];

  const playerViews: PlayerView[] = players.map((entry, index) => {
    const player = asObject(entry);
    const legStats = asObject(asObject(stats[index])["legStats"]);
    const matchStats = asObject(asObject(stats[index])["matchStats"]);
    const score = asObject(scores[index]);
    const isActive = index === activeIndex;
    const guide = Array.isArray(guides)
      ? guides[index]
      : isActive
        ? inner["checkoutGuide"]
        : null;
    return {
      seat: index + 1,
      name: asText(player["name"]) ?? `Spieler ${index + 1}`,
      avatarUrl: asText(player["avatarUrl"]),
      country: asText(asObject(player["user"])["country"]),
      score: asNumber(gameScores[index]),
      legs: asNumber(score["legs"]),
      sets: asNumber(score["sets"]),
      average: { leg: asNumber(legStats["average"]), match: asNumber(matchStats["average"]) },
      dartsThrown: asNumber(legStats["dartsThrown"]),
      isActive,
      isWinner: winner >= 0 && index === winner,
      busted: isActive && turnBusted,
      checkout: toCheckout(guide),
    };
  });

  const turns = asArray(state["turns"]);
  const throws = asArray(asObject(turns[turns.length - 1])["throws"]);
  const darts: TurnDart[] = throws.map((thrown) => {
    const t = asObject(thrown);
    return { field: toField(t["segment"]), coords: toCoords(t["coords"]) };
  });
  const last = darts[darts.length - 1];

  const settings = asObject(state["settings"]);
  const sets = state["sets"];
  const optionalMode = (v: unknown): Mode | null => (v === undefined ? null : toMode(v));
  return {
    phase: "playing",
    variant,
    mode,
    match: {
      baseScore: typeof settings["baseScore"] === "number" ? settings["baseScore"] : null,
      legsToWin: asNumber(state["legs"], 1),
      setsToWin: typeof sets === "number" ? sets : null,
      inMode: optionalMode(settings["inMode"]),
      outMode: optionalMode(settings["outMode"]),
    },
    players: playerViews,
    turn: { darts, points: asNumber(state["turnScore"]), busted: turnBusted },
    highlights: last && last.field.multiplier !== 0 ? [{ field: last.field, kind: "last-dart" }] : [],
  };
}
