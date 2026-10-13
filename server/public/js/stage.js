/*
 * Lage der Buehne im Fenster. Reine Funktion ohne DOM.
 *
 * Die Buehne hat das Seitenverhaeltnis des gewaehlten Formats ("fenster" =
 * das des Fensters) und ist so gross wie moeglich. Ist auf diesem Geraet die
 * Seitenleiste oder die Werkzeugleiste offen, rueckt sie in den freien Platz
 * daneben - kleiner, aber unverzerrt und ganz sichtbar. Andere Geraete (der
 * Beamer) merken davon nichts.
 */

const RATIOS = { "16:9": 16 / 9, "16:10": 16 / 10, "4:3": 4 / 3 };

/** win: { width, height } in px; reserve: { right, bottom } - frei zu haltender Platz in px. */
export function fitStage(win, format, reserve = { right: 0, bottom: 0 }) {
  const ratio = RATIOS[format] ?? win.width / win.height;
  const availWidth = Math.max(1, win.width - reserve.right);
  const availHeight = Math.max(1, win.height - reserve.bottom);
  const width = Math.min(availWidth, availHeight * ratio);
  const height = width / ratio;
  return { left: (availWidth - width) / 2, top: (availHeight - height) / 2, width, height };
}
