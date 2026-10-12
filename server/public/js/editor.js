/*
 * Schritt "Layout": Scheibe und Bloecke verschieben, skalieren, drehen.
 *
 * Jede Aenderung gilt sofort im eigenen Bild und geht gedrosselt an den Pi
 * (profile-sync.js), der sie an alle Viewer weiterreicht - so folgt der Beamer
 * live, waehrend man am Laptop zieht. Ausgelegt auf Maus und Tastatur.
 * Knopf, Seitenleiste und Lebenszeichen gehoeren zu settings.js.
 */
import { snapRotation } from "./rotation.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeAngle = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
const distance = (x, y, p) => Math.hypot(x - p.x, y - p.y);
const angle = (x, y, p) => (Math.atan2(y - p.y, x - p.x) * 180) / Math.PI;

const PLUS_KEYS = ["+", "*", "="];
const MINUS_KEYS = ["-", "_"];

/** Aenderung durch Ziehen an einem Block oder Griff. */
function drag(layout, id, handle, start, move, anchor) {
  const dx = ((move.clientX - start.x) / window.innerWidth) * 100;
  const dy = ((move.clientY - start.y) / window.innerHeight) * 100;
  const ratio = distance(move.clientX, move.clientY, anchor) / Math.max(1, distance(start.x, start.y, anchor));

  if (id === "scheibe") {
    const from = start.layout.board;
    const board = layout.board;
    if (handle === "move") {
      board.cx = clamp(from.cx + dx, 0, 100);
      board.cy = clamp(from.cy + dy, 0, 100);
    } else if (handle === "resize") {
      board.diameter = clamp(from.diameter * ratio, 5, 400);
    } else if (handle === "rotate") {
      const turned = angle(move.clientX, move.clientY, anchor) - angle(start.x, start.y, anchor);
      board.rotation = snapRotation(normalizeAngle(from.rotation + turned), { free: move.altKey });
    }
    return;
  }

  const from = start.layout.blocks[id];
  const block = layout.blocks[id];
  if (handle === "move") {
    block.x = clamp(from.x + dx, 0, 100);
    block.y = clamp(from.y + dy, 0, 100);
  } else if (handle === "resize") {
    block.scale = clamp(from.scale * ratio, 0.2, 4);
  }
}

/** Feinschritte per Tastatur; null, wenn die Taste nichts bedeutet. */
function keyAction(event, selected) {
  const step = event.shiftKey ? 1 : 0.1;
  const offset = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }[event.key];
  if (offset) {
    return (layout) => {
      if (selected === "scheibe") {
        layout.board.cx = clamp(layout.board.cx + offset[0], 0, 100);
        layout.board.cy = clamp(layout.board.cy + offset[1], 0, 100);
      } else {
        const block = layout.blocks[selected];
        block.x = clamp(block.x + offset[0], 0, 100);
        block.y = clamp(block.y + offset[1], 0, 100);
      }
    };
  }

  const grow =
    PLUS_KEYS.includes(event.key) || event.code === "NumpadAdd"
      ? 1
      : MINUS_KEYS.includes(event.key) || event.code === "NumpadSubtract"
        ? -1
        : 0;
  if (grow) {
    return (layout) => {
      if (selected === "scheibe") {
        layout.board.diameter = clamp(layout.board.diameter + grow * step, 5, 400);
      } else {
        const block = layout.blocks[selected];
        block.scale = clamp(block.scale + (grow * step) / 10, 0.2, 4);
      }
    };
  }

  const turn = event.code === "KeyQ" ? -1 : event.code === "KeyE" ? 1 : 0;
  if (turn && selected === "scheibe") {
    return (layout) => {
      layout.board.rotation = normalizeAngle(layout.board.rotation + turn * step);
    };
  }
  return null;
}

export function createEditor({ viewer, sync, getProfileId, getLayout, applyLocal, onBack, onDone }) {
  const toolbar = viewer.querySelector("#edit-toolbar");
  const status = viewer.querySelector("#edit-status");
  let editing = false;
  let selected = "scheibe";

  function change(mutate) {
    const layout = structuredClone(getLayout());
    mutate(layout);
    applyLocal(layout);
    sync.queue(getProfileId(), { layout, editing: "layout" });
  }

  function select(id) {
    selected = id;
    for (const block of viewer.querySelectorAll(".block[data-block]")) {
      block.classList.toggle("is-selected", block.dataset.block === id);
    }
  }

  /* Ausgeschaltete Bausteine sind unsichtbar - die Auswahl springt auf einen
     sichtbaren, sonst schoebe die Tastatur etwas, das man nicht sieht. */
  function selectVisible() {
    const shown = [...viewer.querySelectorAll(".block[data-block]")].filter(
      (block) => block.getClientRects().length > 0,
    );
    const current = shown.find((block) => block.dataset.block === selected);
    select(current ? selected : (shown[0]?.dataset.block ?? selected));
  }

  function setActive(next) {
    editing = next;
    viewer.classList.toggle("is-editing", editing);
    if (editing) selectVisible();
  }

  toolbar.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "back") onBack();
    if (action === "done") onDone();
  });

  viewer.addEventListener("pointerdown", (event) => {
    if (!editing || event.button !== 0) return;
    const block = event.target.closest(".block[data-block]");
    if (!block) return;
    event.preventDefault();
    const id = block.dataset.block;
    select(id);

    const handle = event.target.closest("[data-handle]")?.dataset.handle ?? "move";
    const start = { x: event.clientX, y: event.clientY, layout: structuredClone(getLayout()) };
    const rect = block.getBoundingClientRect();
    const anchor =
      id === "scheibe"
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: rect.left, y: rect.top };

    block.setPointerCapture(event.pointerId);
    const onMove = (move) => change((layout) => drag(layout, id, handle, start, move, anchor));
    const onUp = () => {
      block.removeEventListener("pointermove", onMove);
      block.removeEventListener("pointerup", onUp);
      block.removeEventListener("pointercancel", onUp);
      sync.flush();
    };
    block.addEventListener("pointermove", onMove);
    block.addEventListener("pointerup", onUp);
    block.addEventListener("pointercancel", onUp);
  });

  viewer.addEventListener(
    "wheel",
    (event) => {
      if (!editing || !event.target.closest('[data-block="scheibe"]')) return;
      event.preventDefault();
      // Mit Umschalt melden manche Browser die Bewegung als deltaX.
      const direction = Math.sign(event.deltaY || event.deltaX);
      const step = event.shiftKey ? 0.1 : 1;
      select("scheibe");
      change((layout) => {
        layout.board.diameter = clamp(layout.board.diameter - direction * step, 5, 400);
      });
    },
    { passive: false },
  );

  window.addEventListener("keydown", (event) => {
    if (!editing) return;
    if (event.key === "Escape") {
      onDone();
      return;
    }
    const action = keyAction(event, selected);
    if (!action) return;
    event.preventDefault();
    change(action);
  });

  return {
    setActive,
    isEditing: () => editing,
    setStatus: (text) => {
      status.textContent = text;
    },
  };
}
