/*
 * Verlauf fuer Zurueck und Wiederholen beim Einstellen. Ein Schritt merkt sich
 * den Stand des Profils vorher und nachher. Reihen (Pfeiltasten, Mausrad)
 * mit demselben Schluessel und weniger als mergeMs Abstand werden ein
 * Schritt - sonst braeuchte man nach dem Feinjustieren 30-mal Strg+Z.
 * Reine Funktionen ohne DOM.
 */

const FIELDS = ["name", "format", "content", "layout"];

/** Was ein Schritt vom Profil festhaelt - als Kopie. */
export function snapshotOf(profile) {
  return structuredClone(Object.fromEntries(FIELDS.map((field) => [field, profile[field]])));
}

/** Die Felder von target, die sich von current unterscheiden. */
export function snapshotPatch(current, target) {
  const patch = {};
  for (const field of FIELDS) {
    if (JSON.stringify(current[field]) !== JSON.stringify(target[field])) patch[field] = target[field];
  }
  return patch;
}

/** key: Reihen mit gleichem Schluessel fassen sich zusammen; null = nie. */
export function createHistory({ limit = 100, mergeMs = 1000, now = Date.now } = {}) {
  let done = [];
  let undone = [];
  /* Nach Zurueck/Wiederholen beginnt die naechste Aenderung einen neuen
     Schritt - sie liefe sonst in einen gerade zurueckgenommenen hinein. */
  let sealed = false;

  function record(before, after, key = null) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    const top = done.at(-1);
    const at = now();
    if (!sealed && key !== null && top?.key === key && at - top.at < mergeMs) {
      top.after = structuredClone(after);
      top.at = at;
    } else {
      done.push({ before: structuredClone(before), after: structuredClone(after), key, at });
      if (done.length > limit) done = done.slice(-limit);
    }
    undone = [];
    sealed = false;
  }

  function undo() {
    const step = done.pop();
    if (!step) return null;
    undone.push(step);
    sealed = true;
    return structuredClone(step.before);
  }

  function redo() {
    const step = undone.pop();
    if (!step) return null;
    done.push(step);
    sealed = true;
    return structuredClone(step.after);
  }

  function clear() {
    done = [];
    undone = [];
    sealed = false;
  }

  return {
    record,
    undo,
    redo,
    canUndo: () => done.length > 0,
    canRedo: () => undone.length > 0,
    clear,
  };
}
