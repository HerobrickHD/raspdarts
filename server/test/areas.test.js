import { describe, expect, test } from "vitest";
import { CARD_H, CARD_W, GAP, arrangeCards, sideOf } from "../public/js/areas.js";

const TALL = {
  links: { x: 1, y: 5, w: 49, h: 90 },
  rechts: { x: 70, y: 5, w: 49, h: 90 },
};
const seats = (n) => Array.from({ length: n }, (_, i) => i + 1);

describe("sideOf", () => {
  test("beide: ungerade links, gerade rechts; sonst alle auf eine Seite", () => {
    expect([1, 2, 3, 4, 5, 6].map((s) => sideOf(s, "beide"))).toEqual([
      "links",
      "rechts",
      "links",
      "rechts",
      "links",
      "rechts",
    ]);
    expect(sideOf(2, "links")).toBe("links");
    expect(sideOf(1, "rechts")).toBe("rechts");
  });
});

describe("arrangeCards", () => {
  /* Groesse fuer 3 Karten je Seite (6 Spieler) - im Bereich TALL. */
  const FULL = Math.min(49 / CARD_W, (90 - 2 * GAP) / (CARD_H * 3));

  test("Groesse haengt nicht an der Spielerzahl: 1 bis 6 Spieler gleich gross", () => {
    for (let n = 1; n <= 6; n++) {
      const { scales } = arrangeCards(seats(n), "beide", TALL);
      expect(scales.links, `${n} Spieler`).toBeCloseTo(FULL);
      expect(scales.rechts, `${n} Spieler`).toBeCloseTo(FULL);
    }
  });

  test("1 Karte steht senkrecht mittig", () => {
    const { cards } = arrangeCards(seats(2), "beide", TALL);
    const height = CARD_H * FULL;
    for (const card of cards) expect(card.top).toBeCloseTo((90 - height) / 2);
  });

  test("2 Karten: gleiche Abstaende oben, dazwischen und unten", () => {
    const { cards } = arrangeCards(seats(4), "beide", TALL);
    const height = CARD_H * FULL;
    const gap = (90 - 2 * height) / 3;
    const left = cards.filter((c) => c.side === "links");
    expect(left[0].top).toBeCloseTo(gap);
    expect(left[1].top).toBeCloseTo(2 * gap + height);
  });

  test("3 Karten fuellen den Bereich, mit Abstand GAP dazwischen", () => {
    const { cards } = arrangeCards(seats(6), "beide", TALL);
    const left = cards.filter((c) => c.side === "links");
    const height = CARD_H * FULL;
    expect(left[1].top - (left[0].top + height)).toBeCloseTo(GAP);
    expect(left[0].top).toBeCloseTo(90 - (left[2].top + height));
    expect(left[0].top).toBeLessThan(GAP);
  });

  test("innerhalb eines Bereichs sind alle Karten gleich gross", () => {
    const uneven = { links: TALL.links, rechts: { x: 70, y: 5, w: 30, h: 90 } };
    const { cards } = arrangeCards(seats(5), "beide", uneven);
    for (const side of ["links", "rechts"]) {
      const scales = new Set(cards.filter((c) => c.side === side).map((c) => c.scale));
      expect(scales.size, side).toBe(1);
    }
  });

  test("1 bis 6 Spieler: gleiche Bereiche ergeben gleich grosse Karten, keine ragt heraus", () => {
    for (const verteilung of ["beide", "links", "rechts"]) {
      for (let n = 1; n <= 6; n++) {
        const { cards, scales: { links: scale } } = arrangeCards(seats(n), verteilung, TALL);
        expect(cards, `${verteilung} ${n}`).toHaveLength(n);
        for (const card of cards) {
          expect(card.scale).toBe(scale);
          const area = TALL[card.side];
          expect(card.left).toBeGreaterThanOrEqual(-1e-9);
          expect(card.left + CARD_W * scale).toBeLessThanOrEqual(area.w + 1e-9);
          expect(card.top).toBeGreaterThanOrEqual(-1e-9);
          expect(card.top + CARD_H * scale).toBeLessThanOrEqual(area.h + 1e-9);
        }
      }
    }
  });

  test("mehr als 3 Karten auf einer Seite (Nur links): kleiner, damit alle passen", () => {
    const { scales: { links: scale } } = arrangeCards(seats(6), "links", TALL);
    expect(scale).toBeCloseTo(Math.min(49 / CARD_W, (90 - 5 * GAP) / (CARD_H * 6)));
    expect(scale).toBeLessThan(FULL);
  });

  test("links buendig links, rechts buendig rechts", () => {
    const { cards } = arrangeCards(seats(2), "beide", TALL);
    expect(cards[0].left).toBe(0);
    expect(cards[1].left).toBeCloseTo(49 - CARD_W * FULL);
  });

  test("Breite begrenzt: eine Karte wird nie breiter als der Bereich", () => {
    const narrow = { links: { x: 1, y: 5, w: 20, h: 90 }, rechts: TALL.rechts };
    const { scales } = arrangeCards(seats(1), "beide", narrow);
    expect(scales.links).toBeCloseTo(20 / CARD_W);
  });

  test("Verteilung links: rechter Bereich unsichtbar und zaehlt nicht fuer die Groesse", () => {
    const narrowRight = { links: TALL.links, rechts: { x: 70, y: 5, w: 5, h: 5 } };
    const { visible, scales: { links: scale }, cards } = arrangeCards(seats(2), "links", narrowRight);
    expect(visible).toEqual({ links: true, rechts: false });
    expect(cards.every((c) => c.side === "links")).toBe(true);
    expect(scale).toBeCloseTo(FULL);
  });

  test("Karten eines Bereichs stehen nach Platz sortiert", () => {
    const { cards } = arrangeCards([5, 1, 3], "links", TALL);
    expect(cards.map((c) => c.seat)).toEqual([1, 3, 5]);
    expect(cards[0].top).toBeLessThan(cards[1].top);
  });
});
