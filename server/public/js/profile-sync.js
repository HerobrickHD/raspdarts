/*
 * Schickt Aenderungen am Profil gedrosselt an den Pi: hoechstens alle 100 ms
 * eine Anfrage, Aenderungen dazwischen werden zusammengefasst. Die letzte
 * Aenderung geht immer noch raus.
 */
import { api } from "./profile-api.js";

const SEND_INTERVAL_MS = 100;

export function createSync({ onStatus }) {
  let target = null;
  let pending = null;
  let lastSent = 0;
  let timer = null;
  let inFlight = 0;

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!pending || !target) return;
    const id = target;
    const body = pending;
    pending = null;
    lastSent = Date.now();
    inFlight += 1;
    api("PUT", `/api/profiles/${encodeURIComponent(id)}`, body)
      .then(() => onStatus(""))
      // Ohne Meldung ginge eine Einstellung still verloren.
      .catch((error) => onStatus(`Nicht gespeichert: ${error.message}`))
      .finally(() => {
        inFlight -= 1;
      });
  }

  function queue(id, patch) {
    if (!id) return; // noch kein Profil vom Pi
    if (pending && target !== id) flush(); // Aenderungen am bisherigen Profil zuerst
    target = id;
    pending = { ...pending, ...patch };
    if (!timer) timer = setTimeout(flush, Math.max(0, SEND_INTERVAL_MS - (Date.now() - lastSent)));
  }

  /* Solange eigene Aenderungen ausstehen oder unterwegs sind, waeren Echos vom
     Pi veraltet - sie wuerden neuere Klicks im eigenen Bild zuruecksetzen. */
  const isBusy = () => pending !== null || inFlight > 0;

  return { queue, flush, isBusy };
}
