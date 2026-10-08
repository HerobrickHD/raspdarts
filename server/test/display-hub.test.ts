import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DisplayHub, type DisplaySocket, type ViewerMessage } from "../src/viewer/display-hub.js";
import { IDLE, type ViewerState } from "../src/viewer/game-state.js";
import { DEFAULT_LAYOUT } from "../src/viewer/layout.js";
import { LayoutStore } from "../src/viewer/layout-store.js";

function fakeSocket() {
  const sent: ViewerMessage[] = [];
  let onClose = () => {};
  const socket: DisplaySocket = {
    send: (data) => sent.push(JSON.parse(data) as ViewerMessage),
    on: (_event, listener) => (onClose = listener),
  };
  return { socket, sent, close: () => onClose() };
}

const store = () => new LayoutStore(mkdtempSync(join(tmpdir(), "hub-test-")));
const UNSUPPORTED: ViewerState = { phase: "unsupported", variant: "Cricket" };
const MOVED = { version: 2, board: { cx: 40, cy: 45, diameter: 80, rotation: 1.5 } };

let hub: DisplayHub;
afterEach(() => {
  hub?.close();
  vi.useRealTimers();
});

describe("DisplayHub", () => {
  test("schickt einem neuen Viewer sofort Stand und Layout seiner Anzeige", () => {
    hub = new DisplayHub(store());
    const viewer = fakeSocket();

    hub.attach(viewer.socket, "beamer");

    expect(viewer.sent).toEqual([
      { type: "state", state: IDLE },
      { type: "layout", layout: DEFAULT_LAYOUT, editing: false },
    ]);
  });

  test("verteilt neue Staende an alle Viewer aller Anzeigen", () => {
    hub = new DisplayHub(store());
    const a = fakeSocket();
    const b = fakeSocket();
    hub.attach(a.socket, "beamer");
    hub.attach(b.socket, "tv");

    hub.broadcast(UNSUPPORTED);

    expect(a.sent.at(-1)).toEqual({ type: "state", state: UNSUPPORTED });
    expect(b.sent.at(-1)).toEqual({ type: "state", state: UNSUPPORTED });
    expect(hub.state).toEqual(UNSUPPORTED);
  });

  test("schickt eine Layout-Aenderung nur an Viewer derselben Anzeige", () => {
    hub = new DisplayHub(store());
    const beamer = fakeSocket();
    const tv = fakeSocket();
    hub.attach(beamer.socket, "beamer");
    hub.attach(tv.socket, "tv");

    const saved = hub.updateLayout("beamer", MOVED, true);

    expect(saved.board).toEqual(MOVED.board);
    expect(beamer.sent.at(-1)).toEqual({ type: "layout", layout: saved, editing: true });
    expect(tv.sent).toHaveLength(2);
  });

  test("ein spaeter verbundener Viewer erfaehrt, dass gerade bearbeitet wird", () => {
    hub = new DisplayHub(store());
    hub.updateLayout("beamer", MOVED, true);
    const late = fakeSocket();

    hub.attach(late.socket, "beamer");

    expect(late.sent.at(-1)).toMatchObject({ type: "layout", editing: true });
  });

  test("Bearbeiten endet von selbst nach dem Zeitlimit", () => {
    vi.useFakeTimers();
    hub = new DisplayHub(store(), 60_000);
    const viewer = fakeSocket();
    hub.attach(viewer.socket, "beamer");
    hub.updateLayout("beamer", MOVED, true);

    vi.advanceTimersByTime(59_000);
    hub.updateLayout("beamer", MOVED, true); // jede Aenderung verlaengert
    vi.advanceTimersByTime(59_000);
    expect(hub.isEditing("beamer")).toBe(true);

    vi.advanceTimersByTime(1_000);
    expect(hub.isEditing("beamer")).toBe(false);
    expect(viewer.sent.at(-1)).toMatchObject({ type: "layout", editing: false });
  });

  test("Bearbeiten beenden schaltet sofort zurueck", () => {
    hub = new DisplayHub(store());
    hub.updateLayout("beamer", MOVED, true);

    hub.updateLayout("beamer", MOVED, false);

    expect(hub.isEditing("beamer")).toBe(false);
  });

  test("vergisst geschlossene und kaputte Viewer", () => {
    hub = new DisplayHub(store());
    const closed = fakeSocket();
    hub.attach(closed.socket, "beamer");
    closed.close();
    const broken: DisplaySocket = {
      send: () => {
        throw new Error("weg");
      },
      on: () => undefined,
    };
    hub.attach(broken, "beamer");

    hub.broadcast(UNSUPPORTED);

    expect(hub.clientCount).toBe(0);
  });
});
