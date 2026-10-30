import { describe, expect, test, vi } from "vitest";
import { createUndo } from "../public/js/undo.js";
import { newProfile } from "../src/viewer/profile.ts";

/* Ein Viewer im Kleinen: das Profil, das applyLocalProfile setzt, und ein sync zum Mitlesen. */
function setup() {
  const view = { profile: { ...newProfile("P"), id: "p1" } };
  const sync = { queue: vi.fn(), flush: vi.fn() };
  const onChange = vi.fn();
  const undo = createUndo({
    getProfile: () => view.profile,
    applyLocalProfile: (profile) => {
      view.profile = profile;
    },
    sync,
    getEditing: () => ({ schritt: "inhalte", spieler: 2 }),
    onChange,
  });
  return { view, sync, onChange, undo };
}

describe("createUndo", () => {
  test("undo stellt den alten Stand her und schickt nur die geaenderten Felder", () => {
    const { view, sync, undo } = setup();
    const before = view.profile;
    view.profile = { ...before, format: "16:9" };
    undo.record(before, view.profile);

    undo.undo();

    expect(view.profile.format).toBe(before.format);
    expect(view.profile.id).toBe("p1");
    expect(sync.queue).toHaveBeenCalledWith("p1", {
      format: before.format,
      editing: { schritt: "inhalte", spieler: 2 },
    });
    expect(sync.flush).toHaveBeenCalled();
  });

  test("redo stellt den neuen Stand her", () => {
    const { view, sync, undo } = setup();
    const before = view.profile;
    view.profile = { ...before, format: "16:9" };
    undo.record(before, view.profile);
    undo.undo();
    sync.queue.mockClear();

    undo.redo();

    expect(view.profile.format).toBe("16:9");
    expect(sync.queue).toHaveBeenCalledWith("p1", expect.objectContaining({ format: "16:9" }));
  });

  test("Zuruecksetzen zurueck: alle abweichenden Felder in einer Anfrage", () => {
    const { view, sync, undo } = setup();
    const before = structuredClone(view.profile);
    before.name = "Alt";
    before.content.spielinfo.on = !before.content.spielinfo.on;
    before.layout.board.cx = 12;
    undo.record(before, view.profile);

    undo.undo();

    const [, body] = sync.queue.mock.calls[0];
    expect(Object.keys(body).sort()).toEqual(["content", "editing", "layout", "name"]);
    expect(view.profile.layout.board.cx).toBe(12);
  });

  test("ohne Schritt: nichts gesendet", () => {
    const { sync, undo } = setup();
    undo.undo();
    undo.redo();
    expect(sync.queue).not.toHaveBeenCalled();
    expect(undo.canUndo()).toBe(false);
  });

  test("ohne Profil: nichts", () => {
    const { view, sync, undo } = setup();
    const before = view.profile;
    undo.record(before, { ...before, format: "16:9" });
    view.profile = null;
    undo.undo();
    expect(sync.queue).not.toHaveBeenCalled();
  });

  test("onChange nach record, undo und clear", () => {
    const { view, onChange, undo } = setup();
    const before = view.profile;
    view.profile = { ...before, format: "16:9" };
    undo.record(before, view.profile);
    expect(onChange).toHaveBeenCalledTimes(1);
    undo.undo();
    expect(onChange).toHaveBeenCalledTimes(2);
    undo.clear();
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(undo.canRedo()).toBe(false);
  });
});
