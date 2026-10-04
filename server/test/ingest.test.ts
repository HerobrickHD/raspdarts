import { describe, expect, test, vi } from "vitest";
import { Ingest, isExtensionOrigin } from "../src/beamer/ingest.js";

describe("isExtensionOrigin", () => {
  test.each([
    ["chrome-extension://abcdefghijklmnop", true],
    ["moz-extension://0f1e2d3c-aaaa-bbbb-cccc-112233445566", true],
    ["https://play.autodarts.io", false],
    ["http://raspdarts.local:8743", false],
    ["chrome-extension://abc/pfad", false],
    ["", false],
    [undefined, false],
  ])("%s -> %s", (origin, expected) => {
    expect(isExtensionOrigin(origin)).toBe(expected);
  });
});

describe("Ingest", () => {
  test("reicht geparste Nachrichten weiter und merkt sich den Zeitpunkt", () => {
    const onFrame = vi.fn();
    const ingest = new Ingest(onFrame, () => new Date("2026-10-04T12:00:00Z"));

    ingest.receive('{"channel":"autodarts.matches","data":{}}');

    expect(onFrame).toHaveBeenCalledWith({ channel: "autodarts.matches", data: {} });
    expect(ingest.status().last_message_at).toBe("2026-10-04T12:00:00.000Z");
  });

  test("ueberspringt Nachrichten, die kein JSON sind", () => {
    const onFrame = vi.fn();
    const ingest = new Ingest(onFrame);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    ingest.receive("kein json");

    expect(onFrame).not.toHaveBeenCalled();
    expect(ingest.status().last_message_at).toBeNull();
  });

  test("faengt Fehler beim Weiterreichen ab", () => {
    const ingest = new Ingest(
      () => {
        throw new Error("kaputt");
      },
      () => new Date("2026-10-04T12:00:00Z"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => ingest.receive("{}")).not.toThrow();
    expect(warn).toHaveBeenCalled();
    expect(ingest.status().last_message_at).toBe("2026-10-04T12:00:00.000Z");
  });

  test("meldet verbunden, solange mindestens eine Verbindung offen ist", () => {
    const ingest = new Ingest(() => {});
    expect(ingest.status().ingest_connected).toBe(false);

    ingest.open();
    ingest.open();
    ingest.close();
    expect(ingest.status().ingest_connected).toBe(true);

    ingest.close();
    ingest.close();
    expect(ingest.status().ingest_connected).toBe(false);
  });
});
