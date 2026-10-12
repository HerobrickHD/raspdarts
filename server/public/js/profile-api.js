/*
 * Anfragen an den Pi. Der Header X-Raspdarts ist Pflicht (Schutz vor fremden
 * Webseiten, siehe server/src/http.ts).
 */

/* Ohne Zeitlimit wuerde eine haengende Anfrage (Pi startet neu) alle weiteren
   Aenderungen blockieren - profile-sync.js sendet der Reihe nach. */
const REQUEST_TIMEOUT_MS = 5000;

export async function api(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const init = { method, headers: { "X-Raspdarts": "1" }, signal: controller.signal };
  // Content-Type nur mit Inhalt - sonst lehnt der Pi die Anfrage ab.
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error(controller.signal.aborted ? "keine Antwort vom Pi" : "keine Verbindung zum Pi");
  } finally {
    clearTimeout(timer);
  }
  // fetch wirft bei 400/403 nicht - ohne diese Pruefung ginge ein Fehler still unter.
  if (!response.ok) throw new Error(`Fehler ${response.status}`);
  return response.status === 204 ? null : response.json();
}
