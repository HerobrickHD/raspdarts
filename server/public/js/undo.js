/*
 * Zurueck und Wiederholen im Viewer: Editor und Leiste melden jede Aenderung
 * am Profil hierher (history.js). Ein Zurueck wird gespeichert wie jede
 * andere Aenderung - sofort ins eigene Bild, gedrosselt an den Pi -, also
 * zieht der Beamer mit. Der Verlauf lebt nur auf diesem Geraet.
 */
import { createHistory, snapshotOf, snapshotPatch } from "./history.js";

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
