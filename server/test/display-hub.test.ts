import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CATALOG } from "../src/viewer/catalog.js";
import { DisplayHub, editStep, type DisplaySocket, type ViewerMessage } from "../src/viewer/display-hub.js";
import { IDLE, type ViewerState } from "../src/viewer/game-state.js";
import { ProfileStore } from "../src/viewer/profile-store.js";

function fakeSocket() {
  const sent: ViewerMessage[] = [];
  let onClose = () => {};
  const socket: DisplaySocket = {
    send: (data) => sent.push(JSON.parse(data) as ViewerMessage),
    on: (_event, listener) => (onClose = listener),
  };
  return { socket, sent, close: () => onClose() };
}

const store = () => new ProfileStore(mkdtempSync(join(tmpdir(), "hub-test-")));
const UNSUPPORTED: ViewerState = { phase: "unsupported", variant: "Cricket" };

let hub: DisplayHub;
afterEach(() => {
  hub?.close();
  vi.useRealTimers();
});

describe("DisplayHub", () => {
  test("schickt einem neuen Viewer Katalog, Stand und aktives Profil", () => {
    const profiles = store();
    hub = new DisplayHub(profiles);
    const viewer = fakeSocket();

    hub.attach(viewer.socket);

    expect(viewer.sent).toEqual([
      { type: "catalog", catalog: CATALOG },
      { type: "state", state: IDLE },
      { type: "profile", profile: profiles.active(), profiles: profiles.list(), editing: null },
    ]);
  });

  test("verteilt neue Staende an alle Viewer", () => {
    hub = new DisplayHub(store());
    const a = fakeSocket();
    const b = fakeSocket();
    hub.attach(a.socket);
    hub.attach(b.socket);

    hub.broadcast(UNSUPPORTED);

    expect(a.sent.at(-1)).toEqual({ type: "state", state: UNSUPPORTED });
    expect(b.sent.at(-1)).toEqual({ type: "state", state: UNSUPPORTED });
    expect(hub.state).toEqual(UNSUPPORTED);
  });

  test("schickt Profilaenderungen samt Liste an alle Viewer", () => {
    const profiles = store();
    hub = new DisplayHub(profiles);
    const a = fakeSocket();
    const b = fakeSocket();
    hub.attach(a.socket);
    hub.attach(b.socket);

    profiles.update("standard", { name: "Beamer" });
    hub.publishProfile();

    for (const viewer of [a, b]) {
      expect(viewer.sent.at(-1)).toMatchObject({
        type: "profile",
        profile: { id: "standard", name: "Beamer" },
        profiles: [{ id: "standard", name: "Beamer" }],
      });
    }
  });

  test("ein spaeter verbundener Viewer erfaehrt, dass gerade eingestellt wird", () => {
    hub = new DisplayHub(store());
    hub.setEditing("layout");
    const late = fakeSocket();

    hub.attach(late.socket);

    expect(late.sent.at(-1)).toMatchObject({ type: "profile", editing: "layout" });
  });

  test("Einstellen endet von selbst nach dem Zeitlimit", () => {
    vi.useFakeTimers();
    hub = new DisplayHub(store(), 60_000);
    const viewer = fakeSocket();
    hub.attach(viewer.socket);
    hub.setEditing("inhalte");

    vi.advanceTimersByTime(59_000);
    hub.setEditing("inhalte"); // jede Meldung verlaengert
    vi.advanceTimersByTime(59_000);
    expect(hub.editing).toBe("inhalte");

    vi.advanceTimersByTime(1_000);
    expect(hub.editing).toBeNull();
    expect(viewer.sent.at(-1)).toMatchObject({ type: "profile", editing: null });
  });

  test("ein Wechsel des aktiven Profils beendet das Einstellen", () => {
    const profiles = store();
    hub = new DisplayHub(profiles);
    const viewer = fakeSocket();
    hub.attach(viewer.socket);
    hub.setEditing("layout");

    profiles.create("TV", "fernseher");
    hub.publishProfile();

    expect(hub.editing).toBeNull();
    expect(viewer.sent.at(-1)).toMatchObject({ type: "profile", profile: { id: "tv" }, editing: null });
  });

  test("vergisst geschlossene und kaputte Viewer", () => {
    hub = new DisplayHub(store());
    const closed = fakeSocket();
    hub.attach(closed.socket);
    closed.close();
    const broken: DisplaySocket = {
      send: () => {
        throw new Error("weg");
      },
      on: () => undefined,
    };
    hub.attach(broken);

    hub.broadcast(UNSUPPORTED);

    expect(hub.clientCount).toBe(0);
  });
});

describe("editStep", () => {
  test("kennt nur die beiden Schritte", () => {
    expect(editStep("inhalte")).toBe("inhalte");
    expect(editStep("layout")).toBe("layout");
    for (const raw of [null, undefined, "ja", true, 1]) expect(editStep(raw)).toBeNull();
  });
});
