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

/* Die Schluessel der Chips sind die Optionen der Spielinfo im Katalog. */
export function renderHead(el, match, modeLabel) {
  el.replaceChildren(
    ...matchChips(match, modeLabel).map(({ key, text }) => {
      const chip = node("span", "chip", text);
      chip.dataset.chip = key;
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

/* Je Platz eine Karte, einmal gebaut - sonst blitzten die Bilder bei jedem Wurf. */
const slots = new Map();

/**
 * areas: { links, rechts } - die Bereichs-Elemente; arrangement aus
 * areas.js. Karten ohne Platz in der Anordnung werden versteckt.
 */
export function renderPlayers(areas, players, arrangement) {
  const bySeat = new Map(players.map((player) => [player.seat, player]));
  const placed = new Set(arrangement.cards.map((card) => card.seat));
  for (const [seat, entry] of slots) if (!placed.has(seat)) entry.slot.hidden = true;

  for (const card of arrangement.cards) {
    const player = bySeat.get(card.seat);
    if (!player) continue;
    let entry = slots.get(card.seat);
    if (!entry) {
      const parts = buildCard();
      const slot = node("div", "card-slot");
      slot.append(parts.card);
      entry = { slot, parts };
      slots.set(card.seat, entry);
    }
    const area = areas[card.side];
    // vor den Griff, damit der Griff oben liegt
    if (entry.slot.parentElement !== area) area.prepend(entry.slot);
    entry.slot.hidden = false;
    entry.slot.style.left = `${card.left}vh`;
    entry.slot.style.top = `${card.top}vh`;
    entry.slot.style.transform = `scale(${card.scale})`;
    updateCard(entry.parts, player);
  }
}
