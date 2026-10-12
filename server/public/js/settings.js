/*
 * Einstellungen in zwei Schritten: "inhalte" (Seitenleiste) und "layout"
 * (Ausrichten, editor.js). Haelt den Schritt, spricht mit dem Pi und meldet
 * ihn als editing - dann zeigen alle Geraete ohne Spiel Beispieldaten, im
 * Layout-Schritt die Scheibe als Linien.
 */
import { api } from "./profile-api.js";
import { createPanel } from "./settings-panel.js";

/* Der Pi beendet editing nach 60 s ohne Meldung; solange eingestellt wird,
   haelt ein Lebenszeichen es an. */
const KEEPALIVE_MS = 30_000;
/* Der Knopf wuerde sonst an die Wand projiziert: nur bei Mausbewegung zeigen. */
const BUTTON_HIDE_MS = 3000;

export function createSettings({ viewer, editor, sync, getView, applyLocalContent, onChange }) {
  const button = viewer.querySelector("#settings-toggle");
  const root = viewer.querySelector("#settings");
  let step = null;
  let keepalive = null;
  let hideTimer = null;

  const profileId = () => getView().profile?.id;
  const path = (suffix = "") => `/api/profiles/${encodeURIComponent(profileId())}${suffix}`;
  const report = (error) => panel.setStatus(`Fehlgeschlagen: ${error.message}`);

  /* Nach einem Wechsel des aktiven Profils gilt editing fuer das neue. */
  async function afterSwitch() {
    const { active } = await api("GET", "/api/profiles");
    sync.queue(active, { editing: step });
    sync.flush();
  }

  const panel = createPanel(root, {
    onContent(content) {
      applyLocalContent(content);
      refresh(); // sonst baut der naechste Klick auf dem alten Stand der Leiste auf
      sync.queue(profileId(), { content, editing: step });
    },
    onSelect(id) {
      sync.flush();
      api("PUT", "/api/active-profile", { id }).then(afterSwitch).catch(report);
    },
    onCreate(name, template) {
      sync.flush();
      api("POST", "/api/profiles", { name, template }).then(afterSwitch).catch(report);
    },
    onRename(name) {
      sync.queue(profileId(), { name, editing: step });
      sync.flush();
    },
    onDelete() {
      sync.flush();
      api("DELETE", path()).then(afterSwitch).catch(report);
    },
    onTemplate(template) {
      sync.flush();
      api("POST", path("/reset"), { template }).catch(report);
    },
    onNext: () => open("layout"),
    onClose: () => open(null),
  });

  function refresh() {
    const { catalog, profile, profiles } = getView();
    if (catalog && profile) panel.render(catalog, profile, profiles);
  }

  function open(next) {
    if (!getView().profile) return; // noch kein Profil vom Pi
    step = next;
    root.hidden = step !== "inhalte";
    viewer.classList.toggle("is-settings", step !== null);
    clearInterval(keepalive);
    if (step) {
      keepalive = setInterval(() => sync.queue(profileId(), { editing: step }), KEEPALIVE_MS);
    } else {
      // Sofort weg - der Ausblende-Timer ist meist schon abgelaufen, sonst
      // bliebe der Knopf an der Wand stehen.
      clearTimeout(hideTimer);
      button.classList.remove("is-visible");
      button.blur();
    }
    sync.queue(profileId(), { editing: step });
    sync.flush();
    refresh();
    onChange();
    // Erst nach dem Zeichnen: der Editor waehlt einen sichtbaren Block aus.
    editor.setActive(step === "layout");
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
    step: () => step,
    open,
    refresh,
    setStatus: (text) => panel.setStatus(text),
  };
}
