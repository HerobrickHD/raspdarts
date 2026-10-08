/*
 * Geometrie der Scheibe in Millimetern um den Mittelpunkt.
 *
 * Offizielle Turniermasse, weil der Viewer auf eine echte Scheibe projiziert:
 * das Licht soll auf den echten Draehten liegen. SVG-Richtung: x nach rechts,
 * y nach unten; Winkel im Uhrzeigersinn ab oben (die 20).
 *
 * Reine Funktionen ohne DOM - mit Vitest getestet.
 */

export const RADIUS = {
  bull: 6.35,
  outerBull: 15.9,
  tripleInner: 99,
  tripleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
  board: 225,
};

export const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const SEGMENT_DEG = 18;

const MISS = { multiplier: 0, number: 0, ring: null };
const round = (n) => Number(n.toFixed(3));

/** Autodarts-Koordinaten (1 = Aussenkante Double, y nach oben) → mm. */
export function coordsToPoint(coords) {
  return { x: coords.x * RADIUS.doubleOuter, y: -coords.y * RADIUS.doubleOuter };
}

export function pointAt(radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) };
}

function angleOf(point) {
  return ((Math.atan2(point.x, -point.y) * 180) / Math.PI + 360) % 360;
}

export function fieldAt(point) {
  const r = Math.hypot(point.x, point.y);
  if (r <= RADIUS.bull) return { multiplier: 2, number: 25, ring: null };
  if (r <= RADIUS.outerBull) return { multiplier: 1, number: 25, ring: null };
  if (r > RADIUS.doubleOuter) return { ...MISS };
  const index = Math.floor(((angleOf(point) + SEGMENT_DEG / 2) % 360) / SEGMENT_DEG);
  const number = NUMBERS[index];
  if (r > RADIUS.doubleInner) return { multiplier: 2, number, ring: null };
  if (r > RADIUS.tripleOuter) return { multiplier: 1, number, ring: "outer" };
  if (r > RADIUS.tripleInner) return { multiplier: 3, number, ring: null };
  return { multiplier: 1, number, ring: "inner" };
}

/** Radien [innen, aussen] der Flaechen eines Feldes; Single ohne Teil = beide Teile. */
function bands(field) {
  if (field.number === 25) {
    return field.multiplier === 2 ? [[0, RADIUS.bull]] : [[RADIUS.bull, RADIUS.outerBull]];
  }
  if (field.multiplier === 3) return [[RADIUS.tripleInner, RADIUS.tripleOuter]];
  if (field.multiplier === 2) return [[RADIUS.doubleInner, RADIUS.doubleOuter]];
  const inner = [RADIUS.outerBull, RADIUS.tripleInner];
  const outer = [RADIUS.tripleOuter, RADIUS.doubleInner];
  if (field.ring === "inner") return [inner];
  if (field.ring === "outer") return [outer];
  return [inner, outer];
}

function isField(field) {
  return field.multiplier !== 0 && (field.number === 25 || NUMBERS.includes(field.number));
}

/** Vollkreis bzw. Ring; mit fill-rule="evenodd" zeichnen. */
function ringPath(r1, r2) {
  const circle = (r, sweep) =>
    `M 0 ${round(-r)} A ${r} ${r} 0 1 ${sweep} 0 ${round(r)} A ${r} ${r} 0 1 ${sweep} 0 ${round(-r)} Z`;
  return r1 === 0 ? circle(r2, 1) : `${circle(r2, 1)} ${circle(r1, 0)}`;
}

function sectorPath(r1, r2, a1, a2) {
  const p1 = pointAt(r2, a1);
  const p2 = pointAt(r2, a2);
  const p3 = pointAt(r1, a2);
  const p4 = pointAt(r1, a1);
  return (
    `M ${round(p1.x)} ${round(p1.y)} A ${r2} ${r2} 0 0 1 ${round(p2.x)} ${round(p2.y)} ` +
    `L ${round(p3.x)} ${round(p3.y)} A ${r1} ${r1} 0 0 0 ${round(p4.x)} ${round(p4.y)} Z`
  );
}

export function fieldPath(field) {
  if (!isField(field)) return "";
  if (field.number === 25) {
    const [[r1, r2]] = bands(field);
    return ringPath(r1, r2);
  }
  const center = NUMBERS.indexOf(field.number) * SEGMENT_DEG;
  return bands(field)
    .map(([r1, r2]) => sectorPath(r1, r2, center - SEGMENT_DEG / 2, center + SEGMENT_DEG / 2))
    .join(" ");
}

/** Mitte eines Feldes - fuer Darts, die Autodarts ohne Koordinaten meldet. */
export function fieldCenter(field) {
  if (!isField(field)) return null;
  if (field.number === 25) {
    return field.multiplier === 2 ? { x: 0, y: 0 } : pointAt((RADIUS.bull + RADIUS.outerBull) / 2, 0);
  }
  const [r1, r2] = bands(field).at(-1);
  return pointAt((r1 + r2) / 2, NUMBERS.indexOf(field.number) * SEGMENT_DEG);
}
