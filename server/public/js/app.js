/*
 * Viewer: verbindet sich mit dem Pi und zeichnet, was er schickt.
 *
 * Spielregeln kennt der Viewer nicht - Rest, Bust, Checkout und Sieger kommen
 * fertig vom Pi. Was angezeigt wird und wo, steht im aktiven Profil: ein
 * gemeinsamer Teil und je Spielart Inhalte und Layout (resolve-profile.js).
 */
import { arrangeCards } from "./areas.js";
import { renderHead, renderPlayers, renderTurn } from "./blocks.js";
import { createBoard } from "./board.js";
import { applyContent } from "./content-view.js";
import { createEditor } from "./editor.js";
import { applyLayout } from "./layout-view.js";
import { createSync } from "./profile-sync.js";
import { FALLBACK_MODE, resolveProfile } from "./resolve-profile.js";
import { previewState } from "./sample-state.js";
import { createSettings } from "./settings.js";
import { fitStage } from "./stage.js";

const viewer = document.getElementById("viewer");
const boardSvg = document.getElementById("board-svg");
const messageEl = document.getElementById("message");
const headEl = viewer.querySelector('[data-block="spielinfo"] .head');
const turnEl = viewer.querySelector('[data-block="aufnahme"] .turn');
const areaEls = {
  links: viewer.querySelector('[data-block="bereich-links"]'),
  rechts: viewer.querySelector('[data-block="bereich-rechts"]'),
};

const stageEl = document.getElementById("stage");
const panelEl = viewer.querySelector("#settings");

const board = createBoard(boardSvg);

let state = { phase: "idle" };
/* Spielart des letzten Spiels - bleibt nach dem Spiel stehen; vor dem ersten X01. */
let lastMode = FALLBACK_MODE;
/* Vom Pi: Katalog, aktives Profil, Profilliste und wer gerade einstellt. */
const view = { catalog: null, profile: null, profiles: [], remoteEditing: null };

const sync = createSync({
  onStatus: (text) => settings.setStatus(text),
});

/* Eigene Leiste oder die eines anderen Geraets: { schritt, spielart, spieler } oder null. */
const editing = () => settings.editing() ?? view.remoteEditing;

/**
 * Die Spielart, nach der gezeichnet wird: beim Einstellen die aus der Leiste,
 * sonst die des Spiels (null = unbekannt), nach dem Spiel die letzte.
 */
function shownMode() {
  const edit = editing();
  if (edit) return edit.spielart;
  if (state.phase === "playing") return state.mode;
  return lastMode;
}

const shownState = () => previewState(state, editing());

const resolved = () =>
  view.catalog && view.profile ? resolveProfile(view.profile, view.catalog, shownMode()) : null;

const modeLabel = (mode) =>
  view.catalog?.modes.find((m) => m.id === mode)?.label ?? (state.phase === "playing" ? state.variant : "");

/* Lokale Aenderung sofort ins eigene Bild; an den Pi geht sie ueber sync. */
function applyLocalProfile(profile) {
  view.profile = profile;
  settings.refresh();
  render();
}

const editor = createEditor({
  viewer,
  sync,
  getProfile: () => view.profile,
  getCatalog: () => view.catalog,
  getMode: () => shownMode() ?? FALLBACK_MODE,
  getLayout: () => resolved()?.layout ?? null,
  getEditing: () => settings.editing(),
  applyLocalProfile,
});

const settings = createSettings({
  viewer,
  editor,
  sync,
  getView: () => view,
  getGameMode: () => (state.phase === "playing" ? (state.mode ?? FALLBACK_MODE) : null),
  getResolved: resolved,
  applyLocalProfile,
  onChange: () => render(),
});

/**
 * Lage der Buehne: Format des Profils, und auf diesem Geraet Platz fuer die
 * offene Seitenleiste - so verdeckt sie nichts. Andere Geraete zeigen die
 * Buehne unveraendert.
 */
function placeStage() {
  const panel = panelEl.getBoundingClientRect();
  const reserve = {
    right: settings.editing() && panel.width > 0 ? window.innerWidth - panel.left : 0,
    bottom: 0,
  };
  const format = view.profile?.gemeinsam.format ?? "fenster";
  const { left, top, width, height } = fitStage({ width: window.innerWidth, height: window.innerHeight }, format, reserve);
  Object.assign(stageEl.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
}

function render() {
  placeStage();
  const shown = shownState();
  const mode = shownMode();
  const current = resolved();
  viewer.dataset.phase = shown.phase;
  viewer.dataset.spielart = mode ?? "unbekannt";
  if (current) {
    applyContent(viewer, view.catalog, current.content, mode);
    applyLayout(viewer, current.layout);
  }
  messageEl.textContent = shown.phase === "idle" ? "Warte auf ein Spiel" : "";
  boardSvg.dataset.mode = current?.content.scheibe?.darstellung ?? "light";
  board.render(shown);
  if (shown.phase === "playing" && current) {
    renderHead(headEl, shown.match, modeLabel(mode));
    renderTurn(turnEl, shown.turn);
    const verteilung = current.content.spieler?.verteilung ?? "beide";
    const areas = { links: current.layout.blocks["bereich-links"], rechts: current.layout.blocks["bereich-rechts"] };
    renderPlayers(areaEls, shown.players, arrangeCards(shown.players.map((p) => p.seat), verteilung, areas));
  }
}

function onMessage(message) {
  if (message.type === "state") {
    state = message.state;
    if (state.phase === "playing") lastMode = state.mode ?? FALLBACK_MODE;
  }
  if (message.type === "catalog") view.catalog = message.catalog;
  if (message.type === "profile") {
    // Solange eigene Aenderungen unterwegs sind, ist das Echo des Pi veraltet -
    // es wuerde neuere Klicks im eigenen Bild zuruecksetzen. Der Name gilt trotzdem.
    const same = message.profile.id === view.profile?.id;
    view.profile = same && sync.isBusy() ? { ...view.profile, name: message.profile.name } : message.profile;
    view.profiles = message.profiles;
    view.remoteEditing = message.editing;
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

/* Fenstergroesse, und die Leiste geht auf und zu (auch erst nach dem Zeichnen). */
window.addEventListener("resize", placeStage);
const resizeWatch = new ResizeObserver(() => placeStage());
resizeWatch.observe(panelEl);

render();
connect();
