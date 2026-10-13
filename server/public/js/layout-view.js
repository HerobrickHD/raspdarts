/*
 * Wendet ein Layout auf die Bloecke an. Positionen in Prozent der Buehne,
 * Groessen in cqh (Hoehe der Buehne) - gespeichert ist beides als Zahl, die
 * Buehne bestimmt, worauf sie sich bezieht.
 */

/** Die SVG der Scheibe reicht bis zum Zahlenring (225 mm), das Layout misst den Double-Ring (170 mm). */
export const BOARD_PER_DOUBLE = 225 / 170;

export function applyLayout(viewer, layout) {
  for (const el of viewer.querySelectorAll(".block[data-block]")) {
    const id = el.dataset.block;
    if (id === "scheibe") {
      const { cx, cy, diameter, rotation } = layout.board;
      const size = diameter * BOARD_PER_DOUBLE;
      el.style.left = `${cx}%`;
      el.style.top = `${cy}%`;
      el.style.width = `${size}cqh`;
      el.style.height = `${size}cqh`;
      el.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
      continue;
    }
    const block = layout.blocks[id];
    if (!block) continue;
    el.style.left = `${block.x}%`;
    el.style.top = `${block.y}%`;
    if ("w" in block) {
      // Spielerbereich: feste Groesse, die Karten skaliert areas.js
      el.style.width = `${block.w}cqh`;
      el.style.height = `${block.h}cqh`;
      el.style.transform = "none";
    } else {
      el.style.transform = `scale(${block.scale})`;
    }
  }
}
