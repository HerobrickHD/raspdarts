/*
 * Kamerabild auf die Scheibe legen. Der Pi liefert je Kamera eine Homographie
 * vom Kamerabild auf ein Einheitsquadrat (Scheibe samt Zahlenring, 20 oben,
 * camera-geometry.ts); hier wird sie auf die Groesse der Scheibe gebracht und
 * als CSS matrix3d geschrieben - das Entzerren macht der Browser. Reine
 * Funktionen ohne DOM.
 */

/** Homographie auf ein Quadrat der Kante `size` (Pixel) statt 1. */
export function scaleHomography(h, size) {
  return [h[0] * size, h[1] * size, h[2] * size, h[3] * size, h[4] * size, h[5] * size, h[6], h[7], h[8]];
}

/** CSS matrix3d (spaltenweise) fuer transform-origin 0 0. */
export function cameraMatrix3d(h) {
  return `matrix3d(${[h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]].join(",")})`;
}
