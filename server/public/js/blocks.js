/*
 * Kopf, Aufnahmeleiste und Spielerkarten im Stil der Autodarts-Spielansicht.
 *
 * Die Karten werden je Platz einmal aufgebaut und danach nur aktualisiert:
 * Bilder bei jedem Wurf neu zu setzen liesse sie kurz aufblitzen - auf der
 * Wand sieht man das.
 */
import { fieldLabel, formatAverage, matchChips } from "./labels.js";

/** Autodarts-Standardbild fuer Spieler ohne eigenes Profilbild. Der Dateiname
 *  enthaelt eine Build-Kennung von Autodarts und kann sich mit einer neuen
 *  Autodarts-Version aendern - dann bleibt der Platz leer. */
export const DEFAULT_AVATAR_URL = "https://play.autodarts.com/assets/player-silhouette-X1nJGQO_.png";

const flagUrl = (country) =>
  `https://play.autodarts.com/flags/4x3/${encodeURIComponent(country)}.svg`;

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function dartIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "dart-icon");
  svg.setAttribute("viewBox", "0 0 100 24");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#dart-icon");
  svg.append(use);
  return svg;
}

/* Reihenfolge wie matchChips; die Schluessel sind die Optionen der Spielinfo im Katalog. */
const CHIP_KEYS = ["punktzahl", "legs", "modus"];

export function renderHead(el, match) {
  el.replaceChildren(
    ...matchChips(match).map((text, index) => {
      const chip = node("span", "chip", text);
      chip.dataset.chip = CHIP_KEYS[index];
      return chip;
    }),
  );
}

export function renderTurn(bar, turn) {
  bar.classList.toggle("is-busted", turn.busted);
  const slots = [0, 1, 2].map((index) => {
    const dart = turn.darts[index];
    const slot = node("span", "turn-dart");
    if (dart) slot.textContent = fieldLabel(dart.field);
    else slot.append(dartIcon());
    return slot;
  });
  bar.replaceChildren(...slots, node("span", "turn-total", turn.busted ? "BUST" : String(turn.points)));
}

/* --- Spielerkarten -------------------------------------------------------- */

/** Setzt ein Bild nur, wenn sich die Quelle aendert - sonst kein Neuladen. */
function setImage(img, url) {
  if (img.dataset.url === url) return;
  img.dataset.url = url;
  img.dataset.fallback = "";
  img.style.visibility = "";
  img.src = url;
}

function buildCard() {
  const card = node("article", "card");

  const head = node("header", "card-head");
  const avatar = node("img", "card-avatar");
  avatar.alt = "";
  // Eigenes Bild kaputt → Autodarts-Standardbild; auch das kaputt → leer.
  avatar.addEventListener("error", () => {
    if (avatar.dataset.fallback !== "1" && avatar.dataset.url !== DEFAULT_AVATAR_URL) {
      avatar.dataset.fallback = "1";
      avatar.src = DEFAULT_AVATAR_URL;
    } else {
      avatar.style.visibility = "hidden";
    }
  });
  const name = node("span", "card-name");
  const flag = node("img", "card-flag");
  flag.alt = "";
  flag.addEventListener("error", () => {
    flag.style.visibility = "hidden";
  });
  head.append(avatar, name, flag);

  const main = node("div", "card-main");
  const checkout = node("ol", "card-checkout");
  const score = node("span", "card-score");
  const legs = node("span", "card-legs");
  main.append(checkout, score, legs);

  const averages = node("p", "card-averages");
  const darts = node("p", "card-darts");
  const dartsCount = node("b");
  darts.append(dartIcon(), dartsCount);

  card.append(head, main, averages, darts);
  return { card, avatar, name, flag, checkout, score, legs, averages, dartsCount };
}

function updateCard(parts, player) {
  parts.card.classList.toggle("is-winner", player.isWinner);
  parts.card.classList.toggle("is-busted", player.busted && !player.isWinner);
  parts.card.classList.toggle("is-active", player.isActive && !player.isWinner && !player.busted);

  setImage(parts.avatar, player.avatarUrl ?? DEFAULT_AVATAR_URL);
  parts.name.textContent = player.name;
  parts.flag.hidden = !player.country;
  if (player.country) setImage(parts.flag, flagUrl(player.country));

  parts.checkout.replaceChildren(
    ...(player.checkout ?? []).map((field) => node("li", "", fieldLabel(field))),
  );
  parts.score.textContent = String(player.score);
  parts.legs.textContent = String(player.legs);
  parts.averages.replaceChildren(
    "Leg ",
    node("b", "", formatAverage(player.average.leg)),
    " / Match ",
    node("b", "", formatAverage(player.average.match)),
  );
  parts.dartsCount.textContent = String(player.dartsThrown);
}

const cards = new WeakMap();

/** slots: die sechs Bloecke spieler-1 … spieler-6; ueberzaehlige werden versteckt. */
export function renderPlayers(slots, players) {
  slots.forEach((slot, index) => {
    const player = players[index];
    slot.hidden = !player;
    if (!player) return;
    let parts = cards.get(slot);
    if (!parts) {
      parts = buildCard();
      cards.set(slot, parts);
      slot.prepend(parts.card);
    }
    updateCard(parts, player);
  });
}
