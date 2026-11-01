/*
 * Scheibe automatisch ausrichten - der Rechenteil. Reine Funktionen ohne DOM.
 *
 * Der Beamer zeigt Punkte an bekannten Stellen der gezeichneten Scheibe
 * (ALIGN_DOTS, mm, 20 oben, y nach unten). Die Kameras sehen sie; ueber die
 * Homographie aus der Autodarts-Kalibrierung (camera-geometry.ts) wird jeder
 * Fleck zu mm auf der echten Scheibe. Daraus folgt eine Aehnlichkeit
 * q = s * R(theta) * p + t (gezeichnet -> echt), und aus ihr die neue Lage
 * der Scheibe im Layout. Siehe docs/superpowers/specs/2026-11-01-auto-ausrichten-design.md.
 */

/**
 * Mitte und 8 Punkte zwischen 86 und 132 mm (innerhalb des Double-Rings, also
 * sicher auf der Scheibenebene) - absichtlich unregelmaessig: Abstand und
 * Winkel sind alle verschieden. Ein gleichmaessiger Kreis saehe um 45 Grad
 * gedreht genauso aus, und eine stark verdrehte Scheibe ergaebe einen sicheren,
 * aber falschen Erfolg. Per Suche gefunden (Test "jeder Drehfehler").
 * [Abstand mm, Winkel Grad im Uhrzeigersinn von oben]
 */
const DOTS_POLAR = [
  [132, 354],
  [99, 31],
  [115, 93],
  [97, 148],
  [89, 173],
  [112, 224],
  [126, 258],
  [86, 317],
];
export const ALIGN_DOTS = [
  [0, 0],
  ...DOTS_POLAR.map(([r, deg]) => {
    const rad = (deg * Math.PI) / 180;
    return [r * Math.sin(rad), -r * Math.cos(rad)];
  }),
];
export const ALIGN_DOT_RADIUS = 6;

/** Durchmesser des Double-Rings in mm (layout.board.diameter misst ihn). */
const DOUBLE_MM = 340;
/** Kante des Einheitsquadrats der Homographie in mm. */
const SQUARE_MM = 450;
const MIN_DIFF = 40;
const MIN_AREA = 4;
const MAX_AREA_SHARE = 0.02;
export const MATCH_MAX_MM = 45;
export const OUTLIER_MM = 5;
const MIN_PAIRS = 4;
/** Schwerpunkt der gefundenen Soll-Punkte weiter als das von der Mitte: nur eine Seite gesehen (Haelften >= 47, ein Punkt fehlt <= 20). */
const MAX_MEAN_MM = 40;
const MAX_RMS_MM = 3;

const luminance = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** Helle Flecken, die im Bild mit Punkten dazugekommen sind (Pixel). */
export function findSpots(black, dots) {
  const { width, height } = dots;
  const n = width * height;
  const diff = new Float32Array(n);
  let max = 0;
  for (let j = 0; j < n; j++) {
    const v = Math.max(0, luminance(dots.data, j * 4) - luminance(black.data, j * 4));
    diff[j] = v;
    if (v > max) max = v;
  }
  if (max < MIN_DIFF) return [];

  const threshold = Math.max(MIN_DIFF, 0.5 * max);
  const maxArea = n * MAX_AREA_SHARE;
  const seen = new Uint8Array(n);
  const spots = [];
  const stack = [];
  for (let start = 0; start < n; start++) {
    if (seen[start] || diff[start] < threshold) continue;
    seen[start] = 1;
    stack.push(start);
    let area = 0;
    let weight = 0;
    let sx = 0;
    let sy = 0;
    while (stack.length > 0) {
      const j = stack.pop();
      const x = j % width;
      const y = (j - x) / width;
      area++;
      weight += diff[j];
      sx += x * diff[j];
      sy += y * diff[j];
      const next = [x > 0 ? j - 1 : -1, x < width - 1 ? j + 1 : -1, y > 0 ? j - width : -1, y < height - 1 ? j + width : -1];
      for (const k of next) {
        if (k >= 0 && !seen[k] && diff[k] >= threshold) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    if (area >= MIN_AREA && area <= maxArea) spots.push({ x: sx / weight, y: sy / weight, weight });
  }
  return spots;
}

export function applyHomography(h, [x, y]) {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/** Einheitsquadrat (Mitte 0.5/0.5) -> mm von der Bullmitte. */
export function toBoardMm([u, v]) {
  return [(u - 0.5) * SQUARE_MM, (v - 0.5) * SQUARE_MM];
}

/** Jeder gemessene Punkt zum naechsten Soll-Punkt, wenn er nah genug liegt. */
export function matchDots(measured) {
  const pairs = [];
  for (const q of measured) {
    let best = null;
    let bestDist = Infinity;
    for (const p of ALIGN_DOTS) {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best && bestDist <= MATCH_MAX_MM) pairs.push({ p: best, q });
  }
  return pairs;
}

const rotate = (deg, [x, y]) => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r) * x - Math.sin(r) * y, Math.sin(r) * x + Math.cos(r) * y];
};

/** Aehnlichkeit nach kleinsten Quadraten, geschlossen geloest. */
function solveSimilarity(pairs) {
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const pm = [0, 0];
  const qm = [0, 0];
  for (const { p, q } of pairs) {
    pm[0] += p[0] / n;
    pm[1] += p[1] / n;
    qm[0] += q[0] / n;
    qm[1] += q[1] / n;
  }
  let dot = 0;
  let cross = 0;
  let norm = 0;
  for (const { p, q } of pairs) {
    const px = p[0] - pm[0];
    const py = p[1] - pm[1];
    const qx = q[0] - qm[0];
    const qy = q[1] - qm[1];
    dot += px * qx + py * qy;
    cross += px * qy - py * qx;
    norm += px * px + py * py;
  }
  if (norm === 0) return null;
  const a = dot / norm;
  const b = cross / norm;
  const s = Math.hypot(a, b);
  const theta = (Math.atan2(b, a) * 180) / Math.PI;
  const [rx, ry] = rotate(theta, pm);
  return { s, theta, tx: qm[0] - s * rx, ty: qm[1] - s * ry };
}

function residual(fit, { p, q }) {
  const [x, y] = rotate(fit.theta, p);
  return Math.hypot(fit.s * x + fit.tx - q[0], fit.s * y + fit.ty - q[1]);
}

/**
 * Aehnlichkeit gezeichnet -> echt. Ausreisser fallen einzeln weg - immer der
 * schlimmste, dann neu gerechnet -, bis keiner mehr als OUTLIER_MM daneben
 * liegt. Ein grober Ausreisser zieht den ersten Ausgleich sonst so weit, dass
 * auch gute Punkte zu weit weg wirkten.
 */
export function fitSimilarity(pairs) {
  let used = pairs;
  let fit = solveSimilarity(used);
  while (fit) {
    let worst = -1;
    let worstDist = OUTLIER_MM;
    used.forEach((pair, i) => {
      const d = residual(fit, pair);
      if (d > worstDist) {
        worstDist = d;
        worst = i;
      }
    });
    if (worst < 0) break;
    used = used.filter((_, i) => i !== worst);
    fit = solveSimilarity(used);
  }
  if (!fit) return null;
  const rms = Math.sqrt(used.reduce((sum, pair) => sum + residual(fit, pair) ** 2, 0) / used.length);
  return { ...fit, rms, used };
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function normalizeAngle(deg) {
  const a = ((deg % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

/** Neue Lage der Scheibe, damit die gezeichnete auf der echten liegt. aspect = Breite / Hoehe der Buehne. */
export function alignBoard(board, fit, aspect) {
  const k = board.diameter / DOUBLE_MM;
  const turned = board.rotation - fit.theta;
  const [ox, oy] = rotate(turned, [fit.tx, fit.ty]);
  const cx = board.cx * aspect - (k / fit.s) * ox;
  const cy = board.cy - (k / fit.s) * oy;
  return {
    cx: clamp(cx / aspect, 0, 100),
    cy: clamp(cy, 0, 100),
    diameter: clamp(board.diameter / fit.s, 5, 400),
    rotation: normalizeAngle(turned),
  };
}

/**
 * Ganze Messung: captures = [{ matrix, black, dots }] je Kamera. Ergebnis
 * { ok: true, board, rms, used } oder { ok: false, reason }.
 */
export function measureBoard(captures, board, aspect) {
  const measured = [];
  for (const { matrix, black, dots } of captures) {
    for (const spot of findSpots(black, dots)) measured.push(toBoardMm(applyHomography(matrix, [spot.x, spot.y])));
  }
  if (measured.length === 0) return { ok: false, reason: "no-spots" };
  const fit = fitSimilarity(matchDots(measured));
  if (!fit || fit.used.length < MIN_PAIRS) return { ok: false, reason: "too-few" };
  const mean = fit.used.reduce((m, { p }) => [m[0] + p[0] / fit.used.length, m[1] + p[1] / fit.used.length], [0, 0]);
  if (Math.hypot(mean[0], mean[1]) > MAX_MEAN_MM) return { ok: false, reason: "one-sided" };
  if (fit.rms > MAX_RMS_MM) return { ok: false, reason: "inaccurate" };
  return { ok: true, board: alignBoard(board, fit, aspect), rms: fit.rms, used: fit.used.length };
}
