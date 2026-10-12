/*
 * Einrasten beim Drehen der Scheibe mit der Maus: nahe 0, 90, 180 und -90
 * Grad springt sie auf den runden Winkel. Mit Alt dreht man frei; die Tastatur
 * rastet nie ein, damit Feinschritte um 0 Grad moeglich bleiben.
 */

export const SNAP_ANGLES = [-180, -90, 0, 90, 180];
/** Abstand in Grad, unter dem eingerastet wird. */
export const SNAP_DEG = 3;

export function snapRotation(deg, { free = false } = {}) {
  if (free) return deg;
  for (const target of SNAP_ANGLES) {
    if (Math.abs(deg - target) < SNAP_DEG) return target;
  }
  return deg;
}
