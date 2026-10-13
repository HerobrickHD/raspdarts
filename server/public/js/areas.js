/*
 * Spielerkarten in den beiden Bereichen anordnen. Reine Funktion ohne DOM.
 *
 * Alle Karten sind gleich gross: Die Groesse richtet sich nach dem volleren
 * Bereich und haengt nur von der Spielerzahl ab - waehrend eines Spiels
 * springt nichts. Die Breite eines Bereichs begrenzt die Groesse, damit eine
 * einzelne Karte nicht riesig wird.
 */

/** Grundgroesse einer Karte in vh (style.css: .card) und Abstand untereinander. */
export const CARD_W = 49;
export const CARD_H = 34;
export const GAP = 1.5;

const SIDES = ["links", "rechts"];

export function sideOf(seat, verteilung) {
  if (verteilung === "links" || verteilung === "rechts") return verteilung;
  return seat % 2 === 1 ? "links" : "rechts";
}

/**
 * seats: die Plaetze der Spieler (1-6); areas: { links, rechts } mit w/h in vh.
 * left/top der Karten in vh, relativ zur linken oberen Ecke ihres Bereichs.
 */
export function arrangeCards(seats, verteilung, areas) {
  const visible = { links: verteilung !== "rechts", rechts: verteilung !== "links" };
  const bySide = { links: [], rechts: [] };
  for (const seat of [...seats].sort((a, b) => a - b)) bySide[sideOf(seat, verteilung)].push(seat);

  const n = Math.max(1, bySide.links.length, bySide.rechts.length);
  const fit = (area) => Math.min(area.w / CARD_W, (area.h - GAP * (n - 1)) / (CARD_H * n));
  const scale = Math.max(0.05, Math.min(...SIDES.filter((side) => visible[side]).map((side) => fit(areas[side]))));

  const cards = [];
  for (const side of SIDES) {
    const area = areas[side];
    const list = bySide[side];
    const height = list.length * CARD_H * scale + Math.max(0, list.length - 1) * GAP;
    const top = (area.h - height) / 2;
    const left = side === "links" ? 0 : area.w - CARD_W * scale;
    list.forEach((seat, index) => {
      cards.push({ seat, side, left, top: top + index * (CARD_H * scale + GAP), scale });
    });
  }
  return { visible, scale, cards };
}
