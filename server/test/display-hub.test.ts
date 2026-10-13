import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DisplayHub, parseEditing, type DisplaySocket, type Editing, type ViewerMessage } from "../src/viewer/display-hub.js";
import { IDLE, toViewerState, type ViewerState } from "../src/viewer/game-state.js";
import { ProfileStore } from "../src/viewer/profile-store.js";
import { viewerCatalog } from "../src/viewer/standards.js";

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
/** Ein laufendes Spiel aus dem Mitschnitt (Zeile 106). */
const PLAYING: ViewerState = toViewerState(
  JSON.parse(readFileSync("test/fixtures/autodarts-2026-10-08.ndjson", "utf8").split("\n")[106]!).frame,
);
const LAYOUT: Editing = { schritt: "layout", spielart: "x01", spieler: 2 };
const INHALTE: Editing = { schritt: "inhalte", spielart: "cricket", spieler: 4 };

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
      { type: "catalog", catalog: viewerCatalog() },
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

    hub.broadcast(PLAYING);

    expect(a.sent.at(-1)).toEqual({ type: "state", state: PLAYING });
    expect(b.sent.at(-1)).toEqual({ type: "state", state: PLAYING });
    expect(hub.state).toEqual(PLAYING);
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
    hub.setEditing(LAYOUT);
    const late = fakeSocket();

    hub.attach(late.socket);

    expect(late.sent.at(-1)).toMatchObject({ type: "profile", editing: LAYOUT });
  });

  test("Einstellen endet von selbst nach dem Zeitlimit", () => {
    vi.useFakeTimers();
    hub = new DisplayHub(store(), 60_000);
    const viewer = fakeSocket();
    hub.attach(viewer.socket);
    hub.setEditing(INHALTE);

    vi.advanceTimersByTime(59_000);
    hub.setEditing(INHALTE); // jede Meldung verlaengert
    vi.advanceTimersByTime(59_000);
    expect(hub.editing).toEqual(INHALTE);

    vi.advanceTimersByTime(1_000);
    expect(hub.editing).toBeNull();
    expect(viewer.sent.at(-1)).toMatchObject({ type: "profile", editing: null });
  });

  test("ein Wechsel des aktiven Profils beendet das Einstellen", () => {
    const profiles = store();
    hub = new DisplayHub(profiles);
    const viewer = fakeSocket();
    hub.attach(viewer.socket);
    hub.setEditing(LAYOUT);

    profiles.create("TV");
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

    hub.broadcast(PLAYING);

    expect(hub.clientCount).toBe(0);
  });
});

describe("parseEditing", () => {
  test("Schritt, Spielart und Spielerzahl; sonst wird nicht eingestellt", () => {
    expect(parseEditing({ schritt: "layout", spielart: "cricket", spieler: 4 })).toEqual({
      schritt: "layout",
      spielart: "cricket",
      spieler: 4,
    });
    for (const raw of [null, undefined, "layout", true, { schritt: "fertig" }]) expect(parseEditing(raw)).toBeNull();
  });

  test("unbekannte Spielart → X01, Spielerzahl ausserhalb 1-6 → 2", () => {
    expect(parseEditing({ schritt: "inhalte", spielart: "killer", spieler: 9 })).toEqual({
      schritt: "inhalte",
      spielart: "x01",
      spieler: 2,
    });
    expect(parseEditing({ schritt: "inhalte", spieler: 2.5 })?.spieler).toBe(2);
  });
});
