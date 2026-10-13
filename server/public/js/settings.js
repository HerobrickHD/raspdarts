/*
 * Einstellungen in zwei Schritten: "inhalte" (Seitenleiste) und "layout"
 * (Ausrichten, editor.js). Haelt Schritt, Spielart und Spielerzahl der
 * Vorschau, spricht mit dem Pi und meldet alles als editing - dann zeigen alle
 * Geraete Beispieldaten der gewaehlten Spielart, auch wenn ein Spiel laeuft;
 * im Layout-Schritt die Scheibe als Linien. Nach "Fertig" wieder das Spiel.
 */
import { api } from "./profile-api.js";
import { withContent, withFormat } from "./resolve-profile.js";
import { createPanel } from "./settings-panel.js";

/* Der Pi beendet editing nach 60 s ohne Meldung; solange eingestellt wird,
   haelt ein Lebenszeichen es an. */
const KEEPALIVE_MS = 30_000;
/* Der Knopf wuerde sonst an die Wand projiziert: nur bei Mausbewegung zeigen. */
const BUTTON_HIDE_MS = 3000;

export function createSettings({ viewer, editor, sync, getView, getGameMode, getResolved, applyLocalProfile, onChange }) {
  const button = viewer.querySelector("#settings-toggle");
  const root = viewer.querySelector("#settings");
  let step = null;
  /* Was die Leiste gerade einstellt und zeigt. */
  const preview = { spielart: "x01", spieler: 2 };
  let keepalive = null;
  let hideTimer = null;

  const profileId = () => getView().profile?.id;
  const path = (id, suffix = "") => `/api/profiles/${encodeURIComponent(id)}${suffix}`;
  const report = (error) => panel.setStatus(`Fehlgeschlagen: ${error.message}`);
  const editing = () => (step ? { schritt: step, spielart: preview.spielart, spieler: preview.spieler } : null);

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
  function changeContent(content, scope) {
    const { profile, catalog } = getView();
    const next = withContent(profile, catalog, preview.spielart, content);
    if (next === profile) return;
    applyLocalProfile(next);
    const patch =
      scope === "gemeinsam"
        ? { gemeinsam: { content: next.gemeinsam.content } }
        : { spielart: { id: preview.spielart, content: next.spielarten[preview.spielart].content } };
    sync.queue(profile.id, { ...patch, editing: editing() });
  }

  const panel = createPanel(root, {
    onShared: (content) => changeContent(content, "gemeinsam"),
    onModeContent: (content) => changeContent(content, "spielart"),
    onFormat(format) {
      const { profile } = getView();
      applyLocalProfile(withFormat(profile, format));
      sync.queue(profile.id, { gemeinsam: { format }, editing: editing() });
    },
    onMode(mode) {
      preview.spielart = mode;
      announce();
      refresh();
      onChange();
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
    onReset(id, mode) {
      sync.flush();
      api("POST", path(id, "/reset"), { spielart: mode }).catch(report);
    },
    onNext: () => open("layout"),
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
    const resolved = getResolved();
    if (!catalog || !profile || !resolved) return;
    panel.render({ catalog, profile, profiles, mode: preview.spielart, players: preview.spieler, resolved });
    const label = catalog.modes.find((m) => m.id === preview.spielart)?.label ?? preview.spielart;
    editor.setPreview(`${label} · ${preview.spieler} Spieler`, preview.spieler);
  }

  function open(next) {
    if (!getView().profile) return; // noch kein Profil vom Pi
    // Laeuft ein Spiel, schlaegt die Leiste beim Oeffnen dessen Spielart vor - nur als Startpunkt.
    if (next && !step && getGameMode() !== null) preview.spielart = getGameMode();
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
    editing,
    setPlayers,
    open,
    refresh,
    setStatus: (text) => panel.setStatus(text),
  };
}
