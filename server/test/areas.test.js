import { describe, expect, test } from "vitest";
import { CARD_H, CARD_W, GAP, arrangeCards, sideOf } from "../public/js/areas.js";

const AREAS = {
  links: { x: 1.4, y: 32.7, w: 49, h: 34 },
  rechts: { x: 71, y: 32.7, w: 49, h: 34 },
};
const TALL = {
  links: { x: 1, y: 5, w: 40, h: 90 },
  rechts: { x: 70, y: 5, w: 40, h: 90 },
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
  test("Bereiche aus der Uebernahme ergeben die alten Karten (2 Spieler, Skalierung 1)", () => {
    const { cards, scale } = arrangeCards(seats(2), "beide", AREAS);
    expect(scale).toBe(1);
    expect(cards).toEqual([
      { seat: 1, side: "links", left: 0, top: 0, scale: 1 },
      { seat: 2, side: "rechts", left: 0, top: 0, scale: 1 },
    ]);
  });

  test("Uebernahme mit Skalierung 0,7: Karte fuellt den Bereich genau", () => {
    const small = {
      links: { x: 1, y: 30, w: CARD_W * 0.7, h: CARD_H * 0.7 },
      rechts: { x: 70, y: 30, w: CARD_W * 0.7, h: CARD_H * 0.7 },
    };
    const { cards } = arrangeCards(seats(2), "beide", small);
    expect(cards[0].scale).toBeCloseTo(0.7);
    expect(cards[0].top).toBeCloseTo(0);
    expect(cards[1].left).toBeCloseTo(0);
  });

  test("1 bis 6 Spieler: alle Karten gleich gross, keine ragt aus ihrem Bereich", () => {
    for (const verteilung of ["beide", "links", "rechts"]) {
      for (let n = 1; n <= 6; n++) {
        const { cards, scale } = arrangeCards(seats(n), verteilung, TALL);
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

  test("3 Spieler: Groesse nach dem volleren Bereich, auch rechts", () => {
    const { cards, scale } = arrangeCards(seats(3), "beide", TALL);
    const expected = Math.min(40 / CARD_W, (90 - GAP) / (CARD_H * 2));
    expect(scale).toBeCloseTo(expected);
    expect(cards.find((c) => c.seat === 2).scale).toBeCloseTo(expected);
  });

  test("senkrecht mittig, links buendig links, rechts buendig rechts", () => {
    const { cards, scale } = arrangeCards(seats(2), "beide", TALL);
    const height = CARD_H * scale;
    expect(cards[0].top).toBeCloseTo((90 - height) / 2);
    expect(cards[0].left).toBe(0);
    expect(cards[1].left).toBeCloseTo(40 - CARD_W * scale);
  });

  test("Breite begrenzt: 1 Spieler wird nie breiter als der Bereich", () => {
    const { scale } = arrangeCards(seats(1), "beide", TALL);
    expect(scale).toBeCloseTo(40 / CARD_W);
  });

  test("Verteilung links: rechter Bereich unsichtbar und zaehlt nicht fuer die Groesse", () => {
    const narrowRight = { links: TALL.links, rechts: { x: 70, y: 5, w: 5, h: 5 } };
    const { visible, scale, cards } = arrangeCards(seats(2), "links", narrowRight);
    expect(visible).toEqual({ links: true, rechts: false });
    expect(cards.every((c) => c.side === "links")).toBe(true);
    expect(scale).toBeCloseTo(Math.min(40 / CARD_W, (90 - GAP) / (CARD_H * 2)));
  });

  test("Karten eines Bereichs stehen nach Platz sortiert", () => {
    const { cards } = arrangeCards([5, 1, 3], "links", TALL);
    expect(cards.map((c) => c.seat)).toEqual([1, 3, 5]);
    expect(cards[0].top).toBeLessThan(cards[1].top);
  });
});
