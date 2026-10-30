/*
 * Zurueck und Wiederholen im Viewer: Editor und Leiste melden jede Aenderung
 * am Profil hierher (history.js). Ein Zurueck wird gespeichert wie jede
 * andere Aenderung - sofort ins eigene Bild, gedrosselt an den Pi -, also
 * zieht der Beamer mit. Der Verlauf lebt nur auf diesem Geraet.
 */
import { createHistory, snapshotOf, snapshotPatch } from "./history.js";

/**
 * Strg+Z / Strg+Y / Strg+Umschalt+Z (Mac: Befehlstaste); null, wenn die Taste
 * nichts bedeutet. event.key, nicht event.code: Auf deutschen Tastaturen
 * liegt Z dort, wo code "KeyY" meldet. Im Textfeld bleibt das Zurueck des
 * Browsers; AltGr (Strg+Alt) ist kein Kuerzel.
 */
export function undoKey(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  if (event.target?.closest?.('input[type="text"], textarea')) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y") return "redo";
  return null;
}

export function createUndo({ getProfile, applyLocalProfile, sync, getEditing, onChange, history = createHistory() }) {
  function record(beforeProfile, afterProfile, key = null) {
    history.record(snapshotOf(beforeProfile), snapshotOf(afterProfile), key);
    onChange();
  }

  function restore(target) {
    const profile = getProfile();
    if (!target || !profile) return;
    const patch = snapshotPatch(snapshotOf(profile), target);
    if (Object.keys(patch).length > 0) {
      applyLocalProfile({ ...profile, ...target });
      sync.queue(profile.id, { ...patch, editing: getEditing() });
      sync.flush();
    }
    onChange();
  }

  return {
    record,
    // Ohne Profil bleibt der Schritt im Verlauf - sonst ginge er verloren.
    undo: () => getProfile() && restore(history.undo()),
    redo: () => getProfile() && restore(history.redo()),
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    clear() {
      history.clear();
      onChange();
    },
  };
}
