/*
 * Spielerkarten in den beiden Bereichen anordnen. Reine Funktion ohne DOM.
 *
 * Alle Karten eines Bereichs sind gleich gross. Die Groesse haengt an Breite
 * und Hoehe des Bereichs und an der Kartenzahl des volleren Bereichs - also
 * nur an der Spielerzahl, waehrend eines Spiels springt nichts. Gleich grosse
 * Bereiche ergeben gleich grosse Karten; verschieden grosse Bereiche bleiben
 * verschieden (z. B. ein schraeg stehender Beamer, oder alte Profile mit
 * verschieden grossen Karten). Die Breite begrenzt die Groesse, damit eine
 * einzelne Karte nicht riesig wird.
 */

/** Grundgroesse einer Karte in cqh (style.css: .card) und Abstand untereinander. */
export const CARD_W = 49;
export const CARD_H = 34;
export const GAP = 1.5;

const SIDES = ["links", "rechts"];

export function sideOf(seat, verteilung) {
  if (verteilung === "links" || verteilung === "rechts") return verteilung;
  return seat % 2 === 1 ? "links" : "rechts";
}

/**
 * seats: die Plaetze der Spieler (1-6); areas: { links, rechts } mit w/h in cqh.
 * left/top der Karten in cqh, relativ zur linken oberen Ecke ihres Bereichs.
 */
export function arrangeCards(seats, verteilung, areas) {
  const visible = { links: verteilung !== "rechts", rechts: verteilung !== "links" };
  const bySide = { links: [], rechts: [] };
  for (const seat of [...seats].sort((a, b) => a - b)) bySide[sideOf(seat, verteilung)].push(seat);

  // Beide Seiten rechnen mit der Kartenzahl der volleren - so passt die
  // Groesse zur Spielerzahl, nicht dazu, wer gerade auf welcher Seite steht.
  const n = Math.max(1, bySide.links.length, bySide.rechts.length);
  const fit = (area) => Math.max(0.05, Math.min(area.w / CARD_W, (area.h - GAP * (n - 1)) / (CARD_H * n)));
  const scales = { links: fit(areas.links), rechts: fit(areas.rechts) };

  const cards = [];
  for (const side of SIDES) {
    const area = areas[side];
    const list = bySide[side];
    const scale = scales[side];
    const height = list.length * CARD_H * scale + Math.max(0, list.length - 1) * GAP;
    const top = (area.h - height) / 2;
    const left = side === "links" ? 0 : area.w - CARD_W * scale;
    list.forEach((seat, index) => {
      cards.push({ seat, side, left, top: top + index * (CARD_H * scale + GAP), scale });
    });
  }
  return { visible, scales, cards };
}
