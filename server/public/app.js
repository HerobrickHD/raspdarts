/*
 * Reiner Renderer plus Layout-Editor.
 *
 * Keine Spiellogik hier - Restpunkte, Checkout-Weg und aktiver Spieler kommen
 * fertig berechnet vom Dienst. Die Anzeige entscheidet nur, wo etwas steht
 * und wie gross es ist.
 */

const board = document.getElementById("board");
const variantEl = document.getElementById("variant");
const legEl = document.getElementById("leg");
const playersEl = document.getElementById("players");
const checkoutEl = document.getElementById("checkout-path");
const checkoutBox = checkoutEl.parentElement;
const messageEl = document.getElementById("message");
const editToggle = document.getElementById("edit-toggle");

/* Mehrere Anzeigen, getrennte Layouts: ?display=handy neben dem Beamer. */
const display = new URLSearchParams(location.search).get("display") || "beamer";

/* Damit sich das Layout auch ohne laufendes Spiel einrichten laesst. */
const SAMPLE_STATE = {
  phase: "playing",
  variant: "X01",
  leg: 4,
  players: [
    { name: "Arnold", score: 110, legs: 2, isActive: true },
    { name: "Marcus", score: 284, legs: 1, isActive: false },
  ],
  currentTurn: { darts: ["T20"], turnScore: 60 },
  checkout: ["T20", "BULL"],
};

let lastState = { phase: "idle" };
let editing = false;

/* --- Darstellung -------------------------------------------------------- */

function render(state) {
  board.dataset.phase = state.phase;

  if (state.phase === "idle") {
    messageEl.textContent = "Warte auf ein Spiel";
    return;
  }
  if (state.phase === "finished") {
    messageEl.textContent = `${state.winner} gewinnt`;
    return;
  }

  variantEl.textContent = state.variant;
  legEl.textContent = state.leg ? `Leg ${state.leg}` : "";

  playersEl.replaceChildren(
    ...state.players.map((player) => renderPlayer(player, state.currentTurn)),
  );

  // Das Label "Checkout" verschwindet mit dem Weg - sonst steht es leer da.
  const hasCheckout = Boolean(state.checkout);
  checkoutEl.textContent = hasCheckout ? state.checkout.join("  ") : "";
  checkoutBox.classList.toggle("has-path", hasCheckout);
}

function renderPlayer(player, currentTurn) {
  const row = document.createElement("div");
  row.className = player.isActive ? "player is-active" : "player";

  // Links: Name und gewonnene Legs als eine Einheit. Frei zwischen Name und
  // Punktestand gesetzt wuerde die Leg-Zahl selbst wie ein Score aussehen.
  const identity = document.createElement("span");
  identity.className = "player-identity";

  const name = document.createElement("span");
  name.className = "player-name";
  name.textContent = player.name;
  identity.append(name);

  if (player.legs > 0) {
    const legs = document.createElement("span");
    legs.className = "player-legs";
    legs.textContent = player.legs + (player.legs === 1 ? " Leg" : " Legs");
    identity.append(legs);
  }

  // Rechts: die Darts der laufenden Aufnahme, dann der Punktestand.
  const tally = document.createElement("span");
  tally.className = "player-tally";

  if (player.isActive && currentTurn.darts.length > 0) {
    const turn = document.createElement("span");
    turn.className = "player-turn";
    turn.textContent = currentTurn.darts.join(" ");
    tally.append(turn);
  }

  const score = document.createElement("span");
  score.className = "player-score";
  score.textContent = String(player.score);
  tally.append(score);

  row.append(identity, tally);
  return row;
}

/* --- Layout: laden, anwenden, speichern --------------------------------- */

const blocks = new Map(
  [...document.querySelectorAll(".block")].map((el) => [el.dataset.block, el]),
);
let layout = null;

function applyLayout() {
  for (const [id, el] of blocks) {
    const block = layout[id];
    el.style.left = `${block.x}%`;
    el.style.top = `${block.y}%`;
    el.style.transform = `scale(${block.scale})`;
  }
}

async function loadLayout() {
  const response = await fetch(`/api/layout/${display}`);
  layout = await response.json();
  applyLayout();
}

/* Waehrend des Ziehens wird laufend gespeichert - gebuendelt, nicht bei jedem
   Mausschritt. */
let saveTimer = null;
function saveLayoutSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch(`/api/layout/${display}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    }).catch((error) => console.error("Layout konnte nicht gespeichert werden", error));
  }, 400);
}

/* --- Ziehen und Skalieren ------------------------------------------------ */

function startDrag(event, el, id) {
  const startX = event.clientX;
  const startY = event.clientY;
  const origin = { ...layout[id] };
  el.classList.add("is-dragging");
  el.setPointerCapture(event.pointerId);

  const onMove = (move) => {
    // Pixel in Prozent der Projektionsflaeche umrechnen, damit das Layout
    // aufloesungsunabhaengig bleibt.
    layout[id].x = clamp(origin.x + ((move.clientX - startX) / window.innerWidth) * 100);
    layout[id].y = clamp(origin.y + ((move.clientY - startY) / window.innerHeight) * 100);
    applyLayout();
  };

  const onUp = () => {
    el.classList.remove("is-dragging");
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    saveLayoutSoon();
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
}

function startResize(event, el, id) {
  event.stopPropagation(); // sonst wuerde der Baustein gleichzeitig verschoben
  const rect = el.getBoundingClientRect();
  const startDistance = distance(event.clientX, event.clientY, rect.left, rect.top);
  const startScale = layout[id].scale;
  el.setPointerCapture(event.pointerId);

  const onMove = (move) => {
    const factor = distance(move.clientX, move.clientY, rect.left, rect.top) / startDistance;
    layout[id].scale = Math.min(4, Math.max(0.2, startScale * factor));
    applyLayout();
  };

  const onUp = () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    saveLayoutSoon();
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
}

const clamp = (value) => Math.min(95, Math.max(0, value));
const distance = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

for (const [id, el] of blocks) {
  el.addEventListener("pointerdown", (event) => {
    if (!editing) return;
    if (event.target.classList.contains("size-handle")) startResize(event, el, id);
    else startDrag(event, el, id);
  });
}

/* --- Bearbeiten-Modus ---------------------------------------------------- */

editToggle.addEventListener("click", () => {
  editing = !editing;
  board.classList.toggle("is-editing", editing);
  // Ohne laufendes Spiel gaebe es nichts zu positionieren - dann Beispieldaten.
  render(editing && lastState.phase !== "playing" ? SAMPLE_STATE : lastState);
});

/* --- Verbindung mit automatischem Wiederaufbau --------------------------- */

let retryDelay = 500;

function connect() {
  const socket = new WebSocket(`ws://${location.host}/ws`);

  socket.addEventListener("open", () => {
    retryDelay = 500;
    board.classList.remove("is-offline");
  });

  socket.addEventListener("message", (event) => {
    try {
      lastState = JSON.parse(event.data);
      // Beim Einrichten nicht dazwischenfunken.
      if (!editing) render(lastState);
    } catch (error) {
      console.error("Ungueltiger State empfangen", error);
    }
  });

  socket.addEventListener("close", () => {
    board.classList.add("is-offline");
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10000);
  });
}

messageEl.textContent = "Verbinde ...";
loadLayout().then(connect);
