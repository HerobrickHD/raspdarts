/*
 * Viewer: verbindet sich mit dem Pi und zeichnet, was er schickt.
 *
 * Spielregeln kennt der Viewer nicht - Rest, Bust, Checkout und Sieger kommen
 * fertig vom Pi. Hier wird nur entschieden, wie es aussieht.
 */
import { renderHead, renderPlayers, renderTurn } from "./blocks.js";
import { createBoard } from "./board.js";
import { applyLayout } from "./layout-view.js";
import { SAMPLE_STATE } from "./sample-state.js";

const viewer = document.getElementById("viewer");
const boardSvg = document.getElementById("board-svg");
const messageEl = document.getElementById("message");
const headEl = viewer.querySelector('[data-block="kopf"] .head');
const turnEl = viewer.querySelector('[data-block="aufnahme"] .turn');
const playerSlots = [1, 2, 3, 4, 5, 6].map((n) => viewer.querySelector(`[data-block="spieler-${n}"]`));

/* Mehrere Anzeigen, getrennte Layouts: ?display=beamer, ?display=tv ... */
const display = new URLSearchParams(location.search).get("display") || "standard";
const board = createBoard(boardSvg);

let state = { phase: "idle" };
let layout = null;
let remoteEditing = false;

/* Beim Einrichten ohne laufendes Spiel gaebe es sonst nichts zu platzieren. */
function shownState() {
  return remoteEditing && state.phase !== "playing" ? SAMPLE_STATE : state;
}

function render() {
  const shown = shownState();
  viewer.dataset.phase = shown.phase;
  viewer.classList.toggle("is-remote-editing", remoteEditing);
  messageEl.textContent =
    shown.phase === "idle"
      ? "Warte auf ein Spiel"
      : shown.phase === "unsupported"
        ? `${shown.variant} wird noch nicht unterstützt`
        : "";
  boardSvg.dataset.mode = remoteEditing ? "lines" : (layout?.boardMode ?? "light");
  board.render(shown);
  if (shown.phase === "playing") {
    renderHead(headEl, shown.match);
    renderTurn(turnEl, shown.turn);
    renderPlayers(playerSlots, shown.players);
  }
}

function onMessage(message) {
  if (message.type === "state") state = message.state;
  if (message.type === "layout") {
    remoteEditing = message.editing;
    layout = message.layout;
    applyLayout(viewer, layout);
  }
  render();
}

/* --- Verbindung mit automatischem Wiederaufbau --------------------------- */

let retryDelay = 500;

function connect() {
  const socket = new WebSocket(`ws://${location.host}/ws?display=${encodeURIComponent(display)}`);

  socket.addEventListener("open", () => {
    retryDelay = 500;
    viewer.classList.remove("is-offline");
  });

  socket.addEventListener("message", (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (error) {
      console.error("Ungueltige Nachricht vom Pi", error);
    }
  });

  // Der letzte Stand bleibt stehen; nur ein kleiner Hinweis in der Ecke.
  socket.addEventListener("close", () => {
    viewer.classList.add("is-offline");
    setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10000);
  });
}

render();
connect();
