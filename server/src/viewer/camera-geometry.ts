/**
 * Entzerrung eines Kamerabilds auf die Scheibe.
 *
 * Autodarts liefert je Kamera die Bildpunkte, an denen die 20 Draehte die
 * Ringe kreuzen (GET /api/config/calibration/ellipses) - gemessen bei seiner
 * eigenen Kalibrierung. Punkt 0 liegt am Draht zwischen 20 und 1, die
 * Zaehlung laeuft im Uhrzeigersinn (am 13.10.2026 an allen drei Kameras
 * geprueft). Daraus ergibt sich eine Homographie vom Kamerabild auf ein
 * Einheitsquadrat: 450 mm Kante (Scheibe samt Zahlenring), Mitte 0.5/0.5,
 * 20 oben, y nach unten. Der Viewer legt damit das Bild per CSS matrix3d auf
 * die Scheibe - der Pi rechnet nur einmal je Kalibrierung.
 */

export type Point = [number, number];
/** h11 h12 h13 h21 h22 h23 h31 h32 h33 (h33 = 1), Kamerapixel -> Einheitsquadrat. */
export type Homography = number[];

/** Radien in mm der Ringe, deren Punkte Autodarts liefert. */
const RINGS = {
  doubleOuterPoints: 170,
  doubleInnerPoints: 162,
  trebleOuterPoints: 107,
  trebleInnerPoints: 99,
} as const;
const SQUARE_MM = 450;
const WIRES = 20;

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;

const isPoint = (p: unknown): p is Point =>
  Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && Number.isFinite(v));

function onBoard(deg: number, mm: number): Point {
  const rad = (deg * Math.PI) / 180;
  return [0.5 + (mm / SQUARE_MM) * Math.sin(rad), 0.5 - (mm / SQUARE_MM) * Math.cos(rad)];
}

/** Loest das lineare Gleichungssystem A x = b (Gauss mit Spaltenpivot). */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[pivot]![c]!)) pivot = r;
    if (Math.abs(M[pivot]![c]!) < 1e-12) return null;
    [M[c], M[pivot]] = [M[pivot]!, M[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / M[c]![c]!;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/** Homographie nach kleinsten Quadraten aus Punktpaaren (Bild -> Ziel). */
function fit(pairs: [Point, Point][]): Homography | null {
  const AtA = Array.from({ length: 8 }, () => Array<number>(8).fill(0));
  const Atb = Array<number>(8).fill(0);
  for (const [[x, y], [u, v]] of pairs) {
    const rows: [number[], number][] = [
      [[x, y, 1, 0, 0, 0, -u * x, -u * y], u],
      [[0, 0, 0, x, y, 1, -v * x, -v * y], v],
    ];
    for (const [row, rhs] of rows) {
      for (let i = 0; i < 8; i++) {
        Atb[i]! += row[i]! * rhs;
        for (let j = 0; j < 8; j++) AtA[i]![j]! += row[i]! * row[j]!;
      }
    }
  }
  const h = solve(AtA, Atb);
  return h ? [...h, 1] : null;
}

export function applyHomography(h: Homography, [x, y]: Point): Point {
  const w = h[6]! * x + h[7]! * y + h[8]!;
  return [(h[0]! * x + h[1]! * y + h[2]!) / w, (h[3]! * x + h[4]! * y + h[5]!) / w];
}

/** Homographie einer Kamera aus ihren Ellipsen-Punkten; null, wenn sie nicht brauchbar sind. */
export function cameraMatrix(ellipse: unknown): Homography | null {
  const source = asRecord(ellipse);
  const pairs: [Point, Point][] = [];
  for (const [ring, mm] of Object.entries(RINGS)) {
    const points = source[ring];
    if (!Array.isArray(points) || points.length !== WIRES || !points.every(isPoint)) continue;
    points.forEach((p, k) => pairs.push([p, onBoard(9 + (360 / WIRES) * k, mm)]));
  }
  if (isPoint(source["bull"])) pairs.push([source["bull"], [0.5, 0.5]]);
  // Mindestens ein ganzer Ring - sonst ist die Homographie geraten.
  if (pairs.length < WIRES) return null;
  const h = fit(pairs);
  return h && h.every(Number.isFinite) ? h : null;
}

/** Je Kamera-Nummer (Schluessel wie bei Autodarts) eine Homographie; Unbrauchbares faellt weg. */
export function cameraMatrices(ellipses: unknown): Record<string, Homography> {
  const result: Record<string, Homography> = {};
  for (const [cam, ellipse] of Object.entries(asRecord(ellipses))) {
    const h = cameraMatrix(ellipse);
    if (h) result[cam] = h;
  }
  return result;
}
