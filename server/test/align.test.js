import { describe, expect, test } from "vitest";
import {
  ALIGN_DOTS,
  alignBoard,
  applyHomography,
  findSpots,
  fitSimilarity,
  matchDots,
  measureBoard,
  toBoardMm,
} from "../public/js/align.js";

/* --- Hilfen ------------------------------------------------------------- */

function image(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width, height, data };
}

/** Helles Quadrat (Kante size) mit Mitte bei cx/cy (ganzzahlig). */
function square(img, cx, cy, size = 5, value = 255) {
  const half = Math.floor(size / 2);
  for (let y = cy - half; y <= cy + half; y++) {
    for (let x = cx - half; x <= cx + half; x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = value;
    }
  }
}

const rot = (deg, [x, y]) => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r) * x - Math.sin(r) * y, Math.sin(r) * x + Math.cos(r) * y];
};

/** Gezeichneter Punkt p (mm) -> Buehne in Hoehen-% (x und y). */
function stagePoint(board, p, aspect) {
  const k = board.diameter / 340;
  const [rx, ry] = rot(board.rotation, p);
  return [board.cx * aspect + k * rx, board.cy + k * ry];
}

/** Buehnenpunkt -> mm auf der echten Scheibe, die dort liegt, wo `truth` sie zeichnen wuerde. */
function realPoint(truth, [sx, sy], aspect) {
  const k = truth.diameter / 340;
  const [x, y] = rot(-truth.rotation, [sx - truth.cx * aspect, sy - truth.cy]);
  return [x / k, y / k];
}

const pairsFor = (board, truth, aspect, dots = ALIGN_DOTS) =>
  dots.map((p) => ({ p, q: realPoint(truth, stagePoint(board, p, aspect), aspect) }));

function expectBoard(actual, expected, digits) {
  expect(actual.cx).toBeCloseTo(expected.cx, digits);
  expect(actual.cy).toBeCloseTo(expected.cy, digits);
  expect(actual.diameter).toBeCloseTo(expected.diameter, digits);
  expect(actual.rotation).toBeCloseTo(expected.rotation, digits);
}

/* --- Tests -------------------------------------------------------------- */

describe("ALIGN_DOTS", () => {
  test("Mitte und 8 Punkte innerhalb des Double-Rings, alle Abstaende verschieden", () => {
    expect(ALIGN_DOTS).toHaveLength(9);
    expect(ALIGN_DOTS[0]).toEqual([0, 0]);
    const radii = ALIGN_DOTS.slice(1).map(([x, y]) => Math.round(Math.hypot(x, y)));
    for (const r of radii) expect(r).toBeGreaterThanOrEqual(80), expect(r).toBeLessThanOrEqual(150);
    expect(new Set(radii).size).toBe(8);
  });
});

describe("findSpots", () => {
  test("findet zwei helle Quadrate mit ihrer Mitte", () => {
    const black = image(200, 150);
    const dots = image(200, 150);
    square(dots, 40, 30);
    square(dots, 150, 100);

    const spots = findSpots(black, dots).sort((a, b) => a.x - b.x);

    expect(spots).toHaveLength(2);
    expect(spots[0].x).toBeCloseTo(40, 1);
    expect(spots[0].y).toBeCloseTo(30, 1);
    expect(spots[1].x).toBeCloseTo(150, 1);
    expect(spots[1].y).toBeCloseTo(100, 1);
  });

  test("ohne Unterschied keine Flecken", () => {
    const black = image(200, 150);
    const dots = image(200, 150);
    square(black, 40, 30);
    square(dots, 40, 30);

    expect(findSpots(black, dots)).toEqual([]);
  });

  test("ein einzelnes helles Pixel ist kein Fleck", () => {
    const black = image(200, 150);
    const dots = image(200, 150);
    square(dots, 40, 30, 5);
    square(dots, 120, 80, 1);

    expect(findSpots(black, dots)).toHaveLength(1);
  });
});

describe("Homographie", () => {
  test("Einheitsquadrat -> mm von der Bullmitte", () => {
    const h = [1 / 450, 0, 0, 0, 1 / 450, 0, 0, 0, 1];
    expect(toBoardMm(applyHomography(h, [225, 225]))).toEqual([0, 0]);
    const [x, y] = toBoardMm(applyHomography(h, [355, 100]));
    expect(x).toBeCloseTo(130, 9);
    expect(y).toBeCloseTo(-125, 9);
  });
});

describe("fitSimilarity", () => {
  const known = (p) => {
    const [x, y] = rot(3, p);
    return [1.04 * x + 12, 1.04 * y - 7];
  };

  test("findet Massstab, Drehung und Verschiebung genau", () => {
    const fit = fitSimilarity(ALIGN_DOTS.map((p) => ({ p, q: known(p) })));

    expect(fit.s).toBeCloseTo(1.04, 6);
    expect(fit.theta).toBeCloseTo(3, 6);
    expect(fit.tx).toBeCloseTo(12, 6);
    expect(fit.ty).toBeCloseTo(-7, 6);
    expect(fit.rms).toBeLessThan(1e-6);
  });

  test("mit Rauschen von 0,5 mm", () => {
    const noise = [0.5, -0.3, 0.2, -0.5, 0.4, -0.1, 0.3, -0.4, 0.1];
    const fit = fitSimilarity(
      ALIGN_DOTS.map((p, i) => {
        const [x, y] = known(p);
        return { p, q: [x + noise[i], y - noise[(i + 3) % 9]] };
      }),
    );

    expect(Math.abs(fit.s - 1.04)).toBeLessThan(0.005);
    expect(Math.abs(fit.theta - 3)).toBeLessThan(0.3);
  });

  test("ein Ausreisser faellt weg", () => {
    const pairs = ALIGN_DOTS.map((p) => ({ p, q: known(p) }));
    pairs[3].q = [pairs[3].q[0] + 30, pairs[3].q[1]];

    const fit = fitSimilarity(pairs);

    expect(fit.used).toHaveLength(8);
    expect(fit.s).toBeCloseTo(1.04, 2);
    expect(fit.theta).toBeCloseTo(3, 2);
    expect(fit.tx).toBeCloseTo(12, 2);
    expect(fit.ty).toBeCloseTo(-7, 2);
  });

  test("zu wenige Paare", () => {
    expect(fitSimilarity([{ p: [0, 0], q: [1, 1] }])).toBeNull();
  });
});

describe("matchDots", () => {
  test("verwirft Punkte weit neben jedem Soll", () => {
    expect(matchDots([[60, 0]])).toEqual([]);
  });

  test("zwei Messungen desselben Punkts gehen beide ein", () => {
    const [p] = ALIGN_DOTS.slice(1);
    const pairs = matchDots([
      [p[0] + 0.5, p[1]],
      [p[0] - 0.5, p[1]],
    ]);

    expect(pairs).toHaveLength(2);
    expect(pairs[0].p).toEqual(p);
    expect(pairs[1].p).toEqual(p);
  });
});

describe("alignBoard", () => {
  const today = { cx: 48, cy: 50, diameter: 60, rotation: -2 };
  const cases = [
    ["alles zusammen", { cx: 49.5, cy: 48.5, diameter: 62, rotation: 1 }],
    ["nur verschoben", { cx: 49.5, cy: 48.5, diameter: 60, rotation: -2 }],
    ["nur Groesse", { cx: 48, cy: 50, diameter: 63, rotation: -2 }],
    ["nur gedreht", { cx: 48, cy: 50, diameter: 60, rotation: 2.5 }],
  ];

  for (const [name, truth] of cases) {
    test(`Rundreise 16:9 – ${name}`, () => {
      const fit = fitSimilarity(pairsFor(today, truth, 16 / 9));
      expectBoard(alignBoard(today, fit, 16 / 9), truth, 6);
    });
  }

  test("Rundreise 4:3", () => {
    const truth = cases[0][1];
    const fit = fitSimilarity(pairsFor(today, truth, 4 / 3));
    expectBoard(alignBoard(today, fit, 4 / 3), truth, 6);
  });

  test("Drehung bleibt in (-180, 180]", () => {
    const board = { cx: 50, cy: 50, diameter: 60, rotation: 179 };
    const truth = { cx: 50, cy: 50, diameter: 60, rotation: -178 };
    const fit = fitSimilarity(pairsFor(board, truth, 16 / 9));
    expect(alignBoard(board, fit, 16 / 9).rotation).toBeCloseTo(-178, 6);
  });
});

describe("measureBoard", () => {
  const today = { cx: 48, cy: 50, diameter: 60, rotation: -2 };
  const truth = { cx: 49.5, cy: 48.5, diameter: 62, rotation: 1 };
  /* Kamera sieht die Scheibe von vorn: Pixel = mm + 225 auf einem 450er-Bild. */
  const matrix = [1 / 450, 0, 0, 0, 1 / 450, 0, 0, 0, 1];

  function capture(dots = ALIGN_DOTS) {
    const black = image(450, 450);
    const lit = image(450, 450);
    for (const { q } of pairsFor(today, truth, 16 / 9, dots)) {
      square(lit, Math.round(q[0] + 225), Math.round(q[1] + 225));
    }
    return { matrix, black, dots: lit };
  }

  test("findet die wahre Lage", () => {
    const result = measureBoard([capture()], today, 16 / 9);

    expect(result.ok).toBe(true);
    // Die Testpunkte liegen auf ganzen Pixeln (= ganzen mm) - daher nicht genauer.
    expect(Math.abs(result.board.cx - truth.cx)).toBeLessThan(0.1);
    expect(Math.abs(result.board.cy - truth.cy)).toBeLessThan(0.1);
    expect(Math.abs(result.board.diameter - truth.diameter)).toBeLessThan(0.15);
    expect(Math.abs(result.board.rotation - truth.rotation)).toBeLessThan(0.2);
    expect(result.rms).toBeLessThan(1);
  });

  test("leeres Bild -> no-spots", () => {
    expect(measureBoard([capture([])], today, 16 / 9)).toEqual({ ok: false, reason: "no-spots" });
  });

  test("nur 3 Punkte -> too-few", () => {
    expect(measureBoard([capture(ALIGN_DOTS.slice(0, 3))], today, 16 / 9)).toEqual({ ok: false, reason: "too-few" });
  });

  test("nur eine Haelfte -> one-sided", () => {
    const half = ALIGN_DOTS.filter(([x]) => x >= 0).slice(0, 5);
    expect(measureBoard([capture(half)], today, 16 / 9)).toEqual({ ok: false, reason: "one-sided" });
  });
});

describe("measureBoard bei grossem Drehfehler", () => {
  const matrix = [1 / 450, 0, 0, 0, 1 / 450, 0, 0, 0, 1];
  const today = { cx: 50, cy: 50, diameter: 60, rotation: 0 };

  /* Ein symmetrisches Muster kann einen falschen Erfolg melden (z. B. 45 Grad daneben, Restfehler 0). */
  test("jeder Drehfehler: entweder richtig oder abgebrochen - nie sicher falsch", () => {
    const wrong = [];
    for (let off = -180; off < 180; off += 3) {
      const truth = { ...today, rotation: off };
      const black = image(450, 450);
      const lit = image(450, 450);
      for (const { q } of pairsFor(today, truth, 16 / 9)) {
        const x = Math.round(q[0] + 225);
        const y = Math.round(q[1] + 225);
        if (x > 3 && y > 3 && x < 446 && y < 446) square(lit, x, y);
      }
      const result = measureBoard([{ matrix, black, dots: lit }], today, 16 / 9);
      if (!result.ok) continue;
      const diff = Math.abs(((result.board.rotation - off + 540) % 360) - 180);
      if (diff > 0.5) wrong.push(`${off}: ${result.board.rotation.toFixed(1)}`);
    }
    expect(wrong).toEqual([]);
  });
});
