/*
 * Spielerkarten in den beiden Bereichen anordnen. Reine Funktion ohne DOM.
 *
 * Alle Karten eines Bereichs sind gleich gross. Ein Bereich ist fuer 3 Karten
 * ausgelegt (6 Spieler): Die Groesse haengt nur an Breite und Hoehe des
 * Bereichs, nicht an der Spielerzahl - mit weniger Spielern stehen weniger
 * Karten da, gleich gross. Erst mehr als 3 Karten auf einer Seite (Nur links /
 * Nur rechts) machen sie kleiner. Gleich grosse Bereiche ergeben gleich grosse
 * Karten; verschieden grosse bleiben verschieden (z. B. ein schraeg stehender
 * Beamer). Die Breite begrenzt die Groesse.
 *
 * Senkrecht verteilt mit gleichen Abstaenden oben, dazwischen und unten: eine
 * Karte mittig, zwei bei etwa einem und zwei Dritteln, drei fuellen den Bereich.
 */

/** Grundgroesse einer Karte in cqh (style.css: .card) und Abstand untereinander. */
export const CARD_W = 49;
export const CARD_H = 34;
export const GAP = 1.5;
/** Karten, fuer die ein Bereich ausgelegt ist. */
export const PER_SIDE = 3;

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

  // Beide Seiten rechnen mit derselben Kartenzahl - mindestens 3, sonst die
  // der volleren Seite. So haengt die Groesse nicht daran, wer wo steht.
  const n = Math.max(PER_SIDE, bySide.links.length, bySide.rechts.length);
  const fit = (area) => Math.max(0.05, Math.min(area.w / CARD_W, (area.h - GAP * (n - 1)) / (CARD_H * n)));
  const scales = { links: fit(areas.links), rechts: fit(areas.rechts) };

  const cards = [];
  for (const side of SIDES) {
    const area = areas[side];
    const list = bySide[side];
    const scale = scales[side];
    const cardHeight = CARD_H * scale;
    const free = area.h - list.length * cardHeight;
    // Gleiche Abstaende, zwischen den Karten aber nie weniger als GAP.
    const between = Math.max(GAP, free / (list.length + 1));
    const top = (free - between * (list.length - 1)) / 2;
    const left = side === "links" ? 0 : area.w - CARD_W * scale;
    list.forEach((seat, index) => {
      cards.push({ seat, side, left, top: top + index * (cardHeight + between), scale });
    });
  }
  return { visible, scales, cards };
}
