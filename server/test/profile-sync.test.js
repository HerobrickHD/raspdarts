import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createSync } from "../public/js/profile-sync.js";

let calls;
let answer;

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  answer = { ok: true, status: 200, json: async () => ({}) };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, body: JSON.parse(init.body) });
      return answer;
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createSync", () => {
  test("fasst Aenderungen zusammen und sendet hoechstens alle 100 ms", () => {
    const sync = createSync({ onStatus: () => {} });

    sync.queue("standard", { layout: 1 });
    sync.queue("standard", { editing: "layout" });
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(0);

    expect(calls).toEqual([
      {
        url: "/api/profiles/standard",
        method: "PUT",
        headers: { "X-Raspdarts": "1", "Content-Type": "application/json" },
        body: { layout: 1, editing: "layout" },
      },
    ]);

    sync.queue("standard", { layout: 2 });
    vi.advanceTimersByTime(50);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(50);
    expect(calls.at(-1).body).toEqual({ layout: 2 });
  });

  test("flush sendet sofort", () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { content: { a: 1 } });

    sync.flush();

    expect(calls).toHaveLength(1);
  });

  test("Aenderungen am bisherigen Profil gehen vor einem Wechsel raus", () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { content: 1 });

    sync.queue("tv", { editing: "inhalte" });
    vi.advanceTimersByTime(100);

    expect(calls.map((c) => [c.url, c.body])).toEqual([
      ["/api/profiles/standard", { content: 1 }],
      ["/api/profiles/tv", { editing: "inhalte" }],
    ]);
  });

  test("ohne Profil wird nichts gesendet", () => {
    const sync = createSync({ onStatus: () => {} });

    sync.queue(undefined, { editing: "layout" });
    vi.advanceTimersByTime(100);

    expect(calls).toHaveLength(0);
  });

  test("meldet Fehler und loescht die Meldung beim naechsten Erfolg", async () => {
    const status = [];
    const sync = createSync({ onStatus: (text) => status.push(text) });
    answer = { ok: false, status: 403, json: async () => ({}) };

    sync.queue("standard", { layout: 1 });
    sync.flush();
    await vi.waitFor(() => expect(status).toEqual(["Nicht gespeichert: Fehler 403"]));

    answer = { ok: true, status: 200, json: async () => ({}) };
    sync.queue("standard", { layout: 2 });
    sync.flush();
    await vi.waitFor(() => expect(status.at(-1)).toBe(""));
  });
});
