/**
 * Checkout-Pfade fuer X01 mit Double-Out.
 *
 * Reine Funktion ohne Abhaengigkeiten - bewusst so, damit sie vollstaendig
 * per Unit-Test abgedeckt werden kann.
 */

/** Segment-Kurzschreibweise, wie sie auf dem Beamer erscheint: "T20", "D8", "BULL". */
export type Dart = string;

/** Restpunktzahl -> Segment, mit dem sich genau diese Zahl beenden laesst. */
const FINISHES = new Map<number, Dart>();
for (let n = 1; n <= 20; n++) FINISHES.set(n * 2, `D${n}`);
FINISHES.set(50, "BULL"); // Bull zaehlt als Double 25

/**
 * Kandidaten fuer die Darts *vor* dem Finish, in der Reihenfolge, in der ein
 * Spieler sie waehlen wuerde. Die Reihenfolge bestimmt, welcher Weg gefunden
 * wird - Trebles zuerst ergibt die uebliche Profi-Route (170 -> T20 T20 BULL).
 */
const SETUP_DARTS: { name: Dart; value: number }[] = [
  ...descending(20, (n) => ({ name: `T${n}`, value: n * 3 })),
  { name: "BULL", value: 50 },
  ...descending(20, (n) => ({ name: `S${n}`, value: n })),
  { name: "25", value: 25 },
  ...descending(20, (n) => ({ name: `D${n}`, value: n * 2 })),
];

function descending<T>(from: number, make: (n: number) => T): T[] {
  const out: T[] = [];
  for (let n = from; n >= 1; n--) out.push(make(n));
  return out;
}

/**
 * Liefert den kuerzesten Checkout-Weg fuer `remaining` Punkte mit `dartsLeft`
 * verbleibenden Darts, oder null, wenn kein Weg existiert (Bogey-Zahlen wie
 * 169, zu hohe Restpunktzahl, oder zu wenige Darts).
 */
export function checkoutPath(remaining: number, dartsLeft: number): Dart[] | null {
  for (let depth = 1; depth <= Math.min(dartsLeft, 3); depth++) {
    const path = findPath(remaining, depth);
    if (path) return path;
  }
  return null;
}

function findPath(remaining: number, depth: number): Dart[] | null {
  if (depth === 1) {
    const finish = FINISHES.get(remaining);
    return finish ? [finish] : null;
  }
  for (const dart of SETUP_DARTS) {
    const rest = remaining - dart.value;
    if (rest < 2) continue; // unter 2 ist kein Double-Out mehr moeglich
    const tail = findPath(rest, depth - 1);
    if (tail) return [dart.name, ...tail];
  }
  return null;
}
