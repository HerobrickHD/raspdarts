/*
 * Viewer: verbindet sich mit dem Pi und zeichnet, was er schickt.
 *
 * Spielregeln kennt der Viewer nicht - Rest, Bust, Checkout und Sieger kommen
 * fertig vom Pi. Was angezeigt wird und wo, steht im aktiven Profil.
 */
import { renderHead, renderPlayers, renderTurn } from "./blocks.js";
import { createBoard } from "./board.js";
import { applyContent } from "./content-view.js";
import { createEditor } from "./editor.js";
import { applyLayout } from "./layout-view.js";
import { createSync } from "./profile-sync.js";
import { SAMPLE_STATE } from "./sample-state.js";
import { createSettings } from "./settings.js";

const viewer = document.getElementById("viewer");
const boardSvg = document.getElementById("board-svg");
const messageEl = document.getElementById("message");
const headEl = viewer.querySelector('[data-block="spielinfo"] .head');
const turnEl = viewer.querySelector('[data-block="aufnahme"] .turn');
const playerSlots = [1, 2, 3, 4, 5, 6].map((n) => viewer.querySelector(`[data-block="spieler-${n}"]`));

const board = createBoard(boardSvg);

let state = { phase: "idle" };
/* Vom Pi: Katalog, aktives Profil, Profilliste und wer gerade einstellt. */
const view = { catalog: null, profile: null, profiles: [], remoteEditing: null };

const sync = createSync({
  onStatus: (text) => {
    editor.setStatus(text);
    settings.setStatus(text);
  },
});

const editor = createEditor({
  viewer,
  sync,
  getProfileId: () => view.profile?.id,
  getLayout: () => view.profile?.layout ?? null,
  applyLocal: (layout) => {
    view.profile = { ...view.profile, layout };
    applyLayout(viewer, layout);
    render();
  },
  onBack: () => settings.open("inhalte"),
  onDone: () => settings.open(null),
});

const settings = createSettings({
  viewer,
  editor,
  sync,
  getView: () => view,
  applyLocalContent: (content) => {
    view.profile = { ...view.profile, content };
    render();
  },
  onChange: () => render(),
});

/* null, "inhalte" oder "layout" - auf diesem Geraet oder einem anderen. */
const editStep = () => settings.step() ?? view.remoteEditing;

/* Beim Einstellen ohne laufendes Spiel gaebe es sonst nichts zu sehen. */
function shownState() {
  return editStep() && state.phase !== "playing" ? SAMPLE_STATE : state;
}

function render() {
  const shown = shownState();
  const step = editStep();
  viewer.dataset.phase = shown.phase;
  viewer.classList.toggle("is-layout", step === "layout");
  if (view.catalog && view.profile) applyContent(viewer, view.catalog, view.profile.content);
  messageEl.textContent =
    shown.phase === "idle"
      ? "Warte auf ein Spiel"
      : shown.phase === "unsupported"
        ? `${shown.variant} wird noch nicht unterstützt`
        : "";
  boardSvg.dataset.mode = step === "layout" ? "lines" : (view.profile?.content.scheibe?.darstellung ?? "light");
  board.render(shown);
  if (shown.phase === "playing") {
    renderHead(headEl, shown.match);
    renderTurn(turnEl, shown.turn);
    renderPlayers(playerSlots, shown.players);
  }
}

function onMessage(message) {
  if (message.type === "state") state = message.state;
  if (message.type === "catalog") view.catalog = message.catalog;
  if (message.type === "profile") {
    // Solange eigene Aenderungen unterwegs sind, ist das Echo des Pi veraltet;
    // beim Ausrichten gilt ohnehin das eigene Layout.
    const same = message.profile.id === view.profile?.id;
    const keepContent = same && sync.isBusy();
    const keepLayout = same && (sync.isBusy() || editor.isEditing());
    const layout = keepLayout ? view.profile.layout : message.profile.layout;
    const content = keepContent ? view.profile.content : message.profile.content;
    view.profile = { ...message.profile, layout, content };
    view.profiles = message.profiles;
    view.remoteEditing = message.editing;
    applyLayout(viewer, layout);
  }
  settings.refresh();
  render();
}

/* --- Verbindung mit automatischem Wiederaufbau --------------------------- */

let retryDelay = 500;

function connect() {
  const socket = new WebSocket(`ws://${location.host}/ws`);

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
