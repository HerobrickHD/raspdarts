/*
 * Kamerabilder fuer die Ansicht "Kamera": holt das jeweils letzte Bild einer
 * Kamera beim Pi ab (nie bei Autodarts), sobald der Pi ein neues meldet, und
 * haelt es als Objekt-URL fuer die Scheibe und die Vorschaubilder bereit.
 * Dazu die Entzerrung je Kamera (GET /api/board-camera).
 */
import { api } from "./profile-api.js";

export function createCameraFeed({ onChange }) {
  const urls = new Map();
  const versions = new Map();
  let matrices = new Map();
  /* Fehlt eine Entzerrung (Autodarts hatte die Ringpunkte noch nicht), hoechstens alle 5 s nachfragen. */
  const INFO_RETRY_MS = 5000;
  let infoAt = 0;

  async function load(cam, version) {
    if ((versions.get(cam) ?? 0) >= version) return;
    versions.set(cam, version);
    let response;
    try {
      // fetch statt <img src>: /api braucht den Header X-Raspdarts.
      response = await fetch(`/api/board-camera/${cam}?v=${version}`, { headers: { "X-Raspdarts": "1" } });
    } catch {
      return;
    }
    if (!response.ok || versions.get(cam) !== version) return;
    const url = URL.createObjectURL(await response.blob());
    const old = urls.get(cam);
    urls.set(cam, url);
    if (old) URL.revokeObjectURL(old);
    if (!matrices.has(cam)) await loadInfo();
    else onChange();
  }

  async function loadInfo() {
    infoAt = Date.now();
    let info;
    try {
      info = await api("GET", "/api/board-camera");
    } catch {
      return;
    }
    matrices = new Map(info.cams.filter((c) => c.matrix).map((c) => [c.n, c.matrix]));
    for (const cam of info.cams) if (cam.version !== null) void load(cam.n, cam.version);
    onChange();
  }

  /** Beim Pi ein frisches Bild anfordern (gebremst); es kommt als Meldung zurueck. */
  function refresh(cams) {
    api("POST", "/api/board-camera/refresh", { cams }).catch(() => {});
  }

  return {
    loadInfo,
    update: (cam, version) => void load(cam, version),
    refresh,
    url: (cam) => urls.get(cam) ?? null,
    matrix(cam) {
      const matrix = matrices.get(cam) ?? null;
      if (!matrix && Date.now() - infoAt > INFO_RETRY_MS) void loadInfo();
      return matrix;
    },
  };
}
