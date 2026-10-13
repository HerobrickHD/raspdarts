/*
 * Schickt Aenderungen am Profil gedrosselt an den Pi: hoechstens alle 100 ms
 * eine Anfrage, Aenderungen dazwischen werden zusammengefasst. Die letzte
 * Aenderung geht immer noch raus.
 *
 * Immer nur eine Anfrage zur Zeit: Liefen sie parallel, koennte im WLAN eine
 * aeltere eine neuere ueberholen, und der Pi zeigte den aelteren Stand.
 */
import { api } from "./profile-api.js";

const SEND_INTERVAL_MS = 100;

/* spielart eine Ebene tief zusammenfassen (nur bei gleicher id, siehe canMerge). */
export function mergeBody(a, b) {
  const merged = { ...a, ...b };
  if (a.spielart && b.spielart) merged.spielart = { ...a.spielart, ...b.spielart };
  return merged;
}

/* Aenderungen zweier Spielarten passen nicht in eine Anfrage. */
export const canMerge = (a, b) => !(a.spielart && b.spielart && a.spielart.id !== b.spielart.id);

export function createSync({ onStatus }) {
  /* Sammelt Aenderungen fuer ein Profil, bis gesendet wird. */
  let collecting = null; // { id, body }
  /* Fertig zum Senden, der Reihe nach. */
  const outbox = [];
  let inFlight = false;
  let lastSent = 0;
  let timer = null;

  function pump() {
    if (inFlight || outbox.length === 0) return;
    const { id, body } = outbox.shift();
    inFlight = true;
    lastSent = Date.now();
    api("PUT", `/api/profiles/${encodeURIComponent(id)}`, body)
      .then(() => onStatus(""))
      // Ohne Meldung ginge eine Einstellung still verloren.
      .catch((error) => onStatus(`Nicht gespeichert: ${error.message}`))
      .finally(() => {
        inFlight = false;
        pump();
      });
  }

  function enqueue(item) {
    const last = outbox.at(-1);
    if (last && last.id === item.id && canMerge(last.body, item.body)) last.body = mergeBody(last.body, item.body);
    else outbox.push(item);
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (collecting) enqueue(collecting);
    collecting = null;
    pump();
  }

  function queue(id, patch) {
    if (!id) return; // noch kein Profil vom Pi
    if (collecting && (collecting.id !== id || !canMerge(collecting.body, patch))) {
      // Bisheriges zuerst - anderes Profil oder andere Spielart
      enqueue(collecting);
      collecting = null;
      pump();
    }
    collecting = { id, body: collecting ? mergeBody(collecting.body, patch) : { ...patch } };
    if (!timer) timer = setTimeout(flush, Math.max(0, SEND_INTERVAL_MS - (Date.now() - lastSent)));
  }

  /* Solange eigene Aenderungen ausstehen oder unterwegs sind, waeren Echos vom
     Pi veraltet - sie wuerden neuere Klicks im eigenen Bild zuruecksetzen. */
  const isBusy = () => collecting !== null || outbox.length > 0 || inFlight;

  return { queue, flush, isBusy };
}
