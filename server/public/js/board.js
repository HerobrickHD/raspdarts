/*
 * Die Scheibe als SVG in Millimetern.
 *
 * Felder, Zahlen und Draehte werden einmal gezeichnet; welche Ebene sichtbar
 * ist, entscheidet data-mode an der SVG (light, drawn, lines) per CSS. Darts
 * und Hervorhebungen werden bei jedem Stand neu gesetzt.
 */
import {
  NUMBERS,
  RADIUS,
  SEGMENT_DEG,
  coordsToPoint,
  fieldCenter,
  fieldColor,
  fieldPath,
  numberRingOuter,
  numberSpots,
  pointAt,
} from "./geometry.js";

const SVG = "http://www.w3.org/2000/svg";
const DART_RADIUS = 2.25; // wie Autodarts: 5 von 377,78 Einheiten bis zum Double

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function drawFields(group) {
  group.append(el("circle", { r: RADIUS.board, class: "field-surround" }));
  for (const number of NUMBERS) {
    for (const [multiplier, ring] of [
      [1, "inner"],
      [1, "outer"],
      [3, null],
      [2, null],
    ]) {
      const field = { multiplier, number, ring };
      group.append(el("path", { d: fieldPath(field), class: `field-${fieldColor(field)}` }));
    }
  }
  group.append(
    el("path", {
      d: fieldPath({ multiplier: 1, number: 25, ring: null }),
      class: "field-green",
      "fill-rule": "evenodd",
    }),
  );
  group.append(el("path", { d: fieldPath({ multiplier: 2, number: 25, ring: null }), class: "field-red" }));
}

/* Ausrichtung und Abstand aus dem Profil; numberSpots rechnet die Lage. */
/** Kreisring von r1 bis r2 als Pfad (mit fill-rule evenodd). */
function ringPath(r1, r2) {
  const circle = (r) => `M ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 Z`;
  return `${circle(r2)} ${circle(r1)}`;
}

function drawNumbers(group, options) {
  group.replaceChildren(
    // Grund fuer "Zahlenring invertieren" - nur dann sichtbar (style.css).
    el("path", { d: ringPath(RADIUS.doubleOuter, numberRingOuter(options.offset)), class: "number-ring", "fill-rule": "evenodd" }),
    ...numberSpots(options).map(({ number, x, y, turn }) => {
      const text = el("text", {
        x: x.toFixed(2),
        y: y.toFixed(2),
        class: "board-number",
        "text-anchor": "middle",
        "dominant-baseline": "central",
        transform: `rotate(${turn} ${x.toFixed(2)} ${y.toFixed(2)})`,
      });
      text.textContent = String(number);
      return text;
    }),
  );
}

function drawWires(group) {
  for (const radius of [
    RADIUS.bull,
    RADIUS.outerBull,
    RADIUS.tripleInner,
    RADIUS.tripleOuter,
    RADIUS.doubleInner,
    RADIUS.doubleOuter,
  ]) {
    group.append(el("circle", { r: radius }));
  }
  NUMBERS.forEach((_, index) => {
    const angle = index * SEGMENT_DEG + SEGMENT_DEG / 2;
    const from = pointAt(RADIUS.outerBull, angle);
    const to = pointAt(RADIUS.doubleOuter, angle);
    group.append(el("line", { x1: from.x.toFixed(2), y1: from.y.toFixed(2), x2: to.x.toFixed(2), y2: to.y.toFixed(2) }));
  });
}

function dartMarker(dart) {
  const point = dart.coords ? coordsToPoint(dart.coords) : fieldCenter(dart.field);
  if (!point) return null; // daneben ohne Koordinaten
  return el("circle", { cx: point.x.toFixed(2), cy: point.y.toFixed(2), r: DART_RADIUS, class: "dart" });
}

/* Beim Warten je Feldfarbe ein Testfeld - zum Pruefen von Ausrichtung und Leuchtfarben:
   1 aussen (weiss), 8 aussen (schwarz), Triple 20 (rot), Triple 19 (gruen). */
const WAIT_FIELDS = [
  { multiplier: 1, number: 1, ring: "outer" },
  { multiplier: 1, number: 8, ring: "outer" },
  { multiplier: 3, number: 20, ring: null },
  { multiplier: 3, number: 19, ring: null },
].map((field) => ({ field, kind: "warten" }));

/**
 * Was leuchtet: im Spiel, was der Pi schickt; beim Warten die Testfelder
 * (ob sie zu sehen sind, entscheidet style.css). Im Spiel nie die Warte-Felder -
 * sie pulsieren, und Autodarts saehe jeden Impuls als Wurf.
 */
export function boardHighlights(state) {
  return state.phase === "playing" ? state.highlights : WAIT_FIELDS.map((h) => ({ ...h, field: { ...h.field } }));
}

export function createBoard(svg) {
  svg.setAttribute("viewBox", `${-RADIUS.board} ${-RADIUS.board} ${2 * RADIUS.board} ${2 * RADIUS.board}`);
  const fields = el("g", { class: "board-fields" });
  const numbers = el("g", { class: "board-numbers" });
  const wires = el("g", { class: "board-wires" });
  const highlights = el("g", { class: "board-highlights" });
  const darts = el("g", { class: "board-darts" });
  drawFields(fields);
  let numbersKey = "";
  drawWires(wires);
  svg.append(fields, numbers, wires, highlights, darts);

  return {
    /** Zahlen neu setzen - nur wenn sich Abstand, Ausrichtung oder (bei gerade) die Drehung aendert. */
    setNumbers({ offset = 0, upright = false, boardRotation = 0 } = {}) {
      const options = { offset, upright, boardRotation: upright ? boardRotation : 0 };
      const key = JSON.stringify(options);
      if (key === numbersKey) return;
      numbersKey = key;
      drawNumbers(numbers, options);
    },
    render(state) {
      const playing = state.phase === "playing";
      highlights.replaceChildren(
        ...boardHighlights(state).map((highlight) =>
          el("path", {
            d: fieldPath(highlight.field),
            class: `highlight highlight-${highlight.kind}`,
            // Leuchtfarbe nach der Feldfarbe darunter (style.css, --leucht-*)
            "data-farbe": fieldColor(highlight.field),
            "fill-rule": "evenodd",
          }),
        ),
      );
      darts.replaceChildren(...(playing ? state.turn.darts : []).map(dartMarker).filter(Boolean));
    },
  };
}
