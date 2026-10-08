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
  fieldPath,
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
  NUMBERS.forEach((number, index) => {
    const dark = index % 2 === 0; // die 20 ist schwarz mit roten Ringen
    const single = dark ? "field-dark" : "field-light";
    const ring = dark ? "field-red" : "field-green";
    for (const [multiplier, part, cls] of [
      [1, "inner", single],
      [1, "outer", single],
      [3, null, ring],
      [2, null, ring],
    ]) {
      group.append(el("path", { d: fieldPath({ multiplier, number, ring: part }), class: cls }));
    }
  });
  group.append(
    el("path", {
      d: fieldPath({ multiplier: 1, number: 25, ring: null }),
      class: "field-green",
      "fill-rule": "evenodd",
    }),
  );
  group.append(el("path", { d: fieldPath({ multiplier: 2, number: 25, ring: null }), class: "field-red" }));
}

function drawNumbers(group) {
  const radius = (RADIUS.doubleOuter + RADIUS.board) / 2;
  NUMBERS.forEach((number, index) => {
    const angle = index * SEGMENT_DEG;
    const { x, y } = pointAt(radius, angle);
    // Unten stehende Zahlen nicht auf den Kopf stellen.
    const turn = angle > 90 && angle < 270 ? angle - 180 : angle;
    const text = el("text", {
      x: x.toFixed(2),
      y: y.toFixed(2),
      class: "board-number",
      "text-anchor": "middle",
      "dominant-baseline": "central",
      transform: `rotate(${turn} ${x.toFixed(2)} ${y.toFixed(2)})`,
    });
    text.textContent = String(number);
    group.append(text);
  });
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

export function createBoard(svg) {
  svg.setAttribute("viewBox", `${-RADIUS.board} ${-RADIUS.board} ${2 * RADIUS.board} ${2 * RADIUS.board}`);
  const fields = el("g", { class: "board-fields" });
  const numbers = el("g", { class: "board-numbers" });
  const wires = el("g", { class: "board-wires" });
  const highlights = el("g", { class: "board-highlights" });
  const darts = el("g", { class: "board-darts" });
  drawFields(fields);
  drawNumbers(numbers);
  drawWires(wires);
  svg.append(fields, numbers, wires, highlights, darts);

  return {
    render(state) {
      const playing = state.phase === "playing";
      highlights.replaceChildren(
        ...(playing ? state.highlights : []).map((highlight) =>
          el("path", {
            d: fieldPath(highlight.field),
            class: `highlight highlight-${highlight.kind}`,
            "fill-rule": "evenodd",
          }),
        ),
      );
      darts.replaceChildren(...(playing ? state.turn.darts : []).map(dartMarker).filter(Boolean));
    },
  };
}
