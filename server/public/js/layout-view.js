/*
 * Wendet ein Layout auf die Bloecke an. Positionen in Prozent der Buehne,
 * Groessen in cqh (Hoehe der Buehne) - gespeichert ist beides als Zahl, die
 * Buehne bestimmt, worauf sie sich bezieht.
 */

/** Die SVG der Scheibe reicht bis zum Zahlenring (225 mm), das Layout misst den Double-Ring (170 mm). */
export const BOARD_PER_DOUBLE = 225 / 170;

/** Bloecke, deren x/y die Mitte ist (der Warte-Text) - sie wachsen um die Mitte. */
export const CENTERED_BLOCKS = ["warten"];

/** Lage der Scheibe auf der Buehne als CSS - fuer die Scheibe und das Pruefbild zum Ausrichten. */
export function boardPlacement({ cx, cy, diameter, rotation }) {
  const size = `${diameter * BOARD_PER_DOUBLE}cqh`;
  return { left: `${cx}%`, top: `${cy}%`, width: size, height: size, transform: `translate(-50%, -50%) rotate(${rotation}deg)` };
}

export function applyLayout(viewer, layout) {
  for (const el of viewer.querySelectorAll(".block[data-block]")) {
    const id = el.dataset.block;
    if (id === "scheibe") {
      Object.assign(el.style, boardPlacement(layout.board));
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
    } else if (CENTERED_BLOCKS.includes(id)) {
      el.style.transform = `translate(-50%, -50%) scale(${block.scale})`;
    } else {
      el.style.transform = `scale(${block.scale})`;
    }
  }
}
