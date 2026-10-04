/**
 * Uebersetzt die rohe Autodarts-Match-Nachricht in den ScoreboardState -
 * den einzigen Vertrag zwischen Dienst und Beamer-Anzeige.
 *
 * Diese Datei ist die einzige Stelle, die das Drahtformat von Autodarts kennt.
 * Wenn `npm run discover` zeigt, dass Felder anders heissen, wird nur hier
 * angepasst; Server und Anzeige bleiben unberuehrt.
 */
import { checkoutPath, type Dart } from "./checkout.js";

export interface PlayerView {
  name: string;
  score: number;
  legs: number;
  isActive: boolean;
}

export type ScoreboardState =
  | { phase: "idle" }
  | {
      phase: "playing";
      variant: string;
      leg: number | null;
      players: PlayerView[];
      currentTurn: { darts: Dart[]; turnScore: number };
      checkout: Dart[] | null;
    }
  | { phase: "finished"; winner: string };

export const IDLE: ScoreboardState = { phase: "idle" };

const DARTS_PER_TURN = 3;

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNumber = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Frames kommen je nach Kanal entweder direkt oder in ein `data`-Feld verpackt. */
function unwrap(raw: unknown): unknown {
  if (isObject(raw) && "data" in raw && isObject(raw["data"])) return raw["data"];
  return raw;
}

/** "T20" aus dem Segment lesen - notfalls aus Multiplikator und Nummer bauen. */
function dartLabel(thrown: unknown): Dart {
  if (!isObject(thrown)) return "?";
  const segment = isObject(thrown["segment"]) ? thrown["segment"] : {};
  const name = segment["name"];
  if (typeof name === "string" && name.length > 0) return name;

  const multiplier = asNumber(segment["multiplier"]);
  const number = asNumber(segment["number"]);
  if (number === 25) return multiplier === 2 ? "BULL" : "25";
  const prefix = multiplier === 3 ? "T" : multiplier === 2 ? "D" : "S";
  return `${prefix}${number}`;
}

function currentThrows(state: Json): unknown[] {
  const turns = asArray(state["turns"]);
  const turn = turns[turns.length - 1];
  return isObject(turn) ? asArray(turn["throws"]) : [];
}

export function toScoreboardState(raw: unknown): ScoreboardState {
  const state = unwrap(raw);
  if (!isObject(state)) return IDLE;

  const names = asArray(state["players"]);
  const gameScores = asArray(state["gameScores"]);
  if (names.length === 0 || gameScores.length === 0) return IDLE;

  const playerName = (index: number): string => {
    const player = names[index];
    const name = isObject(player) ? player["name"] : undefined;
    return typeof name === "string" ? name : `Spieler ${index + 1}`;
  };

  const winner = asNumber(state["winner"]);
  if (typeof state["winner"] === "number" && winner >= 0) {
    return { phase: "finished", winner: playerName(winner) };
  }

  const activeIndex = asNumber(state["player"]);
  const legScores = asArray(state["scores"]);

  const players: PlayerView[] = names.map((_, index) => ({
    name: playerName(index),
    score: asNumber(gameScores[index]),
    legs: isObject(legScores[index]) ? asNumber((legScores[index] as Json)["legs"]) : 0,
    isActive: index === activeIndex,
  }));

  const throws = currentThrows(state);
  const darts = throws.map(dartLabel);
  const turnScore = throws.reduce<number>((sum, thrown) => {
    if (!isObject(thrown) || !isObject(thrown["segment"])) return sum;
    const segment = thrown["segment"];
    return sum + asNumber(segment["number"]) * asNumber(segment["multiplier"]);
  }, 0);

  const remaining = players[activeIndex]?.score ?? 0;
  const variant = typeof state["variant"] === "string" ? state["variant"] : "X01";
  const leg = typeof state["leg"] === "number" ? state["leg"] : null;

  return {
    phase: "playing",
    variant,
    leg,
    players,
    currentTurn: { darts, turnScore },
    checkout: checkoutPath(remaining, DARTS_PER_TURN - darts.length),
  };
}
