/*
 * Viewer: verbindet sich mit dem Pi und zeichnet, was er schickt.
 *
 * Spielregeln kennt der Viewer nicht - Rest, Bust, Checkout und Sieger kommen
 * fertig vom Pi. Was angezeigt wird und wo, steht im aktiven Profil: das
 * Format der Buehne, Inhalte und Layout - fuer alle Spielarten gleich. Was es
 * in der angezeigten Spielart nicht gibt, bleibt weg (content-view.js).
 */
import { arrangeCards } from "./areas.js";
import { renderHead, renderPlayers, renderTurn } from "./blocks.js";
import { createBoard } from "./board.js";
import { createCameraFeed } from "./camera-feed.js";
import { cameraMatrix3d, scaleHomography } from "./camera-view.js";
import { applyContent } from "./content-view.js";
import { createEditor } from "./editor.js";
import { applyLayout } from "./layout-view.js";
import { createSync } from "./profile-sync.js";
import { PREVIEW_MODE, previewState } from "./sample-state.js";
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

const boardBlock = viewer.querySelector('[data-block="scheibe"]');
const cameraImg = document.getElementById("board-camera-img");

const board = createBoard(boardSvg);
const camera = createCameraFeed({
  onChange: () => {
    settings.refresh();
    render();
  },
});
/* Je Kamera nur einmal von sich aus nachfragen, wenn noch kein Bild da ist. */
const cameraAsked = new Set();

let state = { phase: "idle" };
/* Spielart des letzten Spiels (null = unbekannt) - bleibt nach dem Spiel stehen; vor dem ersten X01. */
let lastMode = PREVIEW_MODE;
/* Vom Pi: Katalog, aktives Profil, Profilliste und wer gerade einstellt. */
const view = { catalog: null, profile: null, profiles: [], remoteEditing: null };

const sync = createSync({
  onStatus: (text) => settings.setStatus(text),
});

/* Eigene Leiste oder die eines anderen Geraets: { schritt, spieler } oder null. */
const editing = () => settings.editing() ?? view.remoteEditing;

/**
 * Die Spielart, nach der gezeichnet wird: beim Einstellen die der
 * Beispieldaten, sonst die des Spiels (null = unbekannt), nach dem Spiel die letzte.
 */
function shownMode() {
  if (editing()) return PREVIEW_MODE;
  if (state.phase === "playing") return state.mode;
  return lastMode;
}

const shownState = () => previewState(state, editing());

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
  getEditing: () => settings.editing(),
  applyLocalProfile,
});

const settings = createSettings({
  viewer,
  editor,
  sync,
  getView: () => view,
  applyLocalProfile,
  onChange: () => render(),
  cameraUrl: (n) => camera.url(n),
  refreshCameras: () => camera.refresh([0, 1, 2]),
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
  const format = view.profile?.format ?? "fenster";
  const { left, top, width, height } = fitStage({ width: window.innerWidth, height: window.innerHeight }, format, reserve);
  Object.assign(stageEl.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
}

function render() {
  placeStage();
  const shown = shownState();
  const mode = shownMode();
  const current = view.catalog ? view.profile : null;
  viewer.dataset.phase = shown.phase;
  viewer.dataset.spielart = mode ?? "unbekannt";
  if (current) {
    applyContent(viewer, view.catalog, current.content, mode);
    applyLayout(viewer, current.layout);
  }
  messageEl.textContent = shown.phase === "idle" ? "Warte auf ein Spiel" : "";
  boardSvg.dataset.mode = current?.content.scheibe?.darstellung ?? "light";
  renderCamera(current);
  board.render(shown);
  if (shown.phase === "playing" && current) {
    renderHead(headEl, shown.match, modeLabel(mode));
    renderTurn(turnEl, shown.turn);
    const verteilung = current.content.spieler?.verteilung ?? "beide";
    const areas = { links: current.layout.blocks["bereich-links"], rechts: current.layout.blocks["bereich-rechts"] };
    renderPlayers(areaEls, shown.players, arrangeCards(shown.players.map((p) => p.seat), verteilung, areas));
  }
}

/** Ansicht "Kamera": letztes Bild der gewaehlten Kamera, entzerrt auf die Scheibe. */
function renderCamera(current) {
  const scheibe = current?.content.scheibe;
  if (scheibe?.darstellung !== "kamera") return;
  const cam = Number(scheibe.kamera ?? 0);
  const url = camera.url(cam);
  const matrix = camera.matrix(cam);
  if (!url && !cameraAsked.has(cam)) {
    cameraAsked.add(cam);
    camera.refresh([cam]);
  }
  if (url && cameraImg.getAttribute("src") !== url) cameraImg.src = url;
  cameraImg.hidden = !url || !matrix;
  // offsetWidth: Groesse der Scheibe ohne ihre Drehung - die dreht das Bild mit.
  if (matrix) cameraImg.style.transform = cameraMatrix3d(scaleHomography(matrix, boardBlock.offsetWidth));
}

function onMessage(message) {
  if (message.type === "camera") camera.update(message.cam, message.version);
  if (message.type === "state") {
    state = message.state;
    if (state.phase === "playing") lastMode = state.mode;
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
    void camera.loadInfo();
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
/* Das Kamerabild haengt an der Groesse der Scheibe - die aendert sich auch ohne Nachricht vom Pi (Fenster, Vollbild). */
const boardWatch = new ResizeObserver(() => renderCamera(view.catalog ? view.profile : null));
boardWatch.observe(boardBlock);

render();
connect();
