/*
 * Einstellungen: Seitenleiste rechts, und die Buehne daneben ist direkt
 * bearbeitbar (editor.js). Haelt die Spielerzahl der Vorschau, spricht mit
 * dem Pi und meldet alles als editing - dann zeigen alle Geraete
 * Beispieldaten (X01), auch wenn ein Spiel laeuft. Nach dem Schliessen
 * wieder das Spiel.
 */
import { api } from "./profile-api.js";
import { createPanel } from "./settings-panel.js";

/* Der Pi beendet editing nach 60 s ohne Meldung; solange eingestellt wird,
   haelt ein Lebenszeichen es an. */
const KEEPALIVE_MS = 30_000;
/* Der Knopf wuerde sonst an die Wand projiziert: nur bei Mausbewegung zeigen. */
const BUTTON_HIDE_MS = 3000;

export function createSettings({
  viewer,
  editor,
  sync,
  getView,
  applyLocalProfile,
  onChange,
  cameraUrl,
  refreshCameras,
}) {
  const button = viewer.querySelector("#settings-toggle");
  const root = viewer.querySelector("#settings");
  let step = null;
  /* Was die Leiste gerade einstellt und zeigt. */
  const preview = { spieler: 2 };
  let keepalive = null;
  let hideTimer = null;

  const profileId = () => getView().profile?.id;
  const path = (id, suffix = "") => `/api/profiles/${encodeURIComponent(id)}${suffix}`;
  const report = (error) => panel.setStatus(`Fehlgeschlagen: ${error.message}`);
  const editing = () => (step ? { schritt: step, spieler: preview.spieler } : null);

  function announce() {
    sync.queue(profileId(), { editing: editing() });
    sync.flush();
  }

  /* Nach einem Wechsel des aktiven Profils gilt editing fuer das neue. */
  async function afterSwitch() {
    const { active } = await api("GET", "/api/profiles");
    sync.queue(active, { editing: editing() });
    sync.flush();
  }

  /* Eine Aenderung an den Inhalten: sofort im eigenen Bild, gedrosselt an den Pi. */
  function changeContent(content) {
    const { profile } = getView();
    if (JSON.stringify(content) === JSON.stringify(profile.content)) return;
    applyLocalProfile({ ...profile, content });
    sync.queue(profile.id, { content, editing: editing() });
  }

  const panel = createPanel(root, {
    onContent: changeContent,
    onFormat(format) {
      const { profile } = getView();
      applyLocalProfile({ ...profile, format });
      sync.queue(profile.id, { format, editing: editing() });
    },
    onPlayers: (count) => setPlayers(count),
    onSelect(id) {
      sync.flush();
      api("PUT", "/api/active-profile", { id }).then(afterSwitch).catch(report);
    },
    onCreate(name) {
      sync.flush();
      api("POST", "/api/profiles", { name }).then(afterSwitch).catch(report);
    },
    onRename(id, name) {
      sync.queue(id, { name, editing: editing() });
      sync.flush();
    },
    onDelete(id) {
      sync.flush();
      api("DELETE", path(id)).then(afterSwitch).catch(report);
    },
    onReset(id) {
      sync.flush();
      api("POST", path(id, "/reset")).catch(report);
    },
    onClose: () => open(null),
  });

  function setPlayers(count) {
    preview.spieler = count;
    announce();
    refresh();
    onChange();
  }

  function refresh() {
    const { catalog, profile, profiles } = getView();
    if (!catalog || !profile) return;
    panel.render({ catalog, profile, profiles, players: preview.spieler, cameraUrl });
  }

  function open(next) {
    if (!getView().profile) return; // noch kein Profil vom Pi
    // Frische Vorschaubilder fuer die Kamera-Wahl - einmal je Oeffnen.
    if (next && !step) refreshCameras();
    step = next;
    root.hidden = step !== "inhalte";
    if (step !== "inhalte") panel.cancelAsk(); // keine alte Rueckfrage beim naechsten Oeffnen
    viewer.classList.toggle("is-settings", step !== null);
    clearInterval(keepalive);
    if (step) {
      keepalive = setInterval(() => sync.queue(profileId(), { editing: editing() }), KEEPALIVE_MS);
    } else {
      // Sofort weg - der Ausblende-Timer ist meist schon abgelaufen, sonst
      // bliebe der Knopf an der Wand stehen.
      clearTimeout(hideTimer);
      button.classList.remove("is-visible");
      button.blur();
    }
    announce();
    refresh();
    onChange();
    // Erst nach dem Zeichnen: der Editor waehlt einen sichtbaren Block aus.
    editor.setActive(step !== null);
  }

  window.addEventListener("pointermove", () => {
    button.classList.add("is-visible");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!step) button.classList.remove("is-visible");
    }, BUTTON_HIDE_MS);
  });

  button.addEventListener("click", () => open(step ? null : "inhalte"));

  window.addEventListener("keydown", (event) => {
    if (step !== "inhalte" || event.key !== "Escape") return;
    // Erst ein offenes Formular schliessen, dann die Leiste.
    if (!panel.cancelAsk()) open(null);
  });

  return {
    editing,
    open,
    refresh,
    setStatus: (text) => panel.setStatus(text),
  };
}
