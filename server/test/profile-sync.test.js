import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { canMerge, createSync, mergeBody } from "../public/js/profile-sync.js";

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
  test("fasst Aenderungen zusammen und sendet hoechstens alle 100 ms", async () => {
    const sync = createSync({ onStatus: () => {} });

    sync.queue("standard", { layout: 1 });
    sync.queue("standard", { editing: "layout" });
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(calls).toEqual([
      {
        url: "/api/profiles/standard",
        method: "PUT",
        headers: { "X-Raspdarts": "1", "Content-Type": "application/json" },
        body: { layout: 1, editing: "layout" },
      },
    ]);

    sync.queue("standard", { layout: 2 });
    await vi.advanceTimersByTimeAsync(50);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(50);
    expect(calls.at(-1).body).toEqual({ layout: 2 });
  });

  test("flush sendet sofort", () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { content: { a: 1 } });

    sync.flush();

    expect(calls).toHaveLength(1);
  });

  test("Aenderungen am bisherigen Profil gehen vor einem Wechsel raus", async () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { content: 1 });

    sync.queue("tv", { editing: "inhalte" });
    await vi.advanceTimersByTimeAsync(100);

    expect(calls.map((c) => [c.url, c.body])).toEqual([
      ["/api/profiles/standard", { content: 1 }],
      ["/api/profiles/tv", { editing: "inhalte" }],
    ]);
  });

  test("ist beschaeftigt, solange Aenderungen ausstehen oder unterwegs sind", async () => {
    let answerNow;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => (answerNow = () => resolve({ ok: true, status: 200, json: async () => ({}) })))),
    );
    const sync = createSync({ onStatus: () => {} });
    expect(sync.isBusy()).toBe(false);

    sync.queue("standard", { content: 1 });
    expect(sync.isBusy()).toBe(true);
    sync.flush();
    expect(sync.isBusy()).toBe(true); // unterwegs

    answerNow();
    await vi.waitFor(() => expect(sync.isBusy()).toBe(false));
  });

  test("sendet erst nach der Antwort auf die vorige Anfrage - aeltere Klicks ueberholen keine neueren", async () => {
    const answers = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return new Promise((resolve) => answers.push(() => resolve({ ok: true, status: 200, json: async () => ({}) })));
      }),
    );
    const sync = createSync({ onStatus: () => {} });

    sync.queue("standard", { content: "A" });
    sync.flush();
    sync.queue("standard", { content: "B" });
    await vi.advanceTimersByTimeAsync(500);
    expect(calls.map((c) => c.body.content)).toEqual(["A"]);

    answers[0]();
    await vi.advanceTimersByTimeAsync(100);
    expect(calls.map((c) => c.body.content)).toEqual(["A", "B"]);
  });

  test("gibt eine Anfrage ohne Antwort nach 5 s auf und meldet das", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (url, init) =>
          new Promise((_, reject) =>
            init.signal.addEventListener("abort", () => reject(new DOMException("abgebrochen", "AbortError"))),
          ),
      ),
    );
    const status = [];
    const sync = createSync({ onStatus: (text) => status.push(text) });

    sync.queue("standard", { content: 1 });
    sync.flush();
    await vi.advanceTimersByTimeAsync(4900);
    expect(sync.isBusy()).toBe(true);

    await vi.advanceTimersByTimeAsync(200);
    expect(status).toEqual(["Nicht gespeichert: keine Antwort vom Pi"]);
    expect(sync.isBusy()).toBe(false);
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

  test("Aenderungen an zwei Spielarten gehen als zwei Anfragen raus, der Reihe nach", async () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { spielart: { id: "x01", content: 1 } });
    sync.queue("standard", { spielart: { id: "cricket", content: 2 } });
    await vi.advanceTimersByTimeAsync(500);

    expect(calls.map((c) => c.body.spielart.id)).toEqual(["x01", "cricket"]);
  });

  test("Inhalte und Layout derselben Spielart kurz nacheinander: beides kommt an", async () => {
    const sync = createSync({ onStatus: () => {} });
    sync.queue("standard", { spielart: { id: "x01", content: 1 } });
    sync.queue("standard", { spielart: { id: "x01", layout: 2 } });
    await vi.advanceTimersByTimeAsync(0);

    expect(calls[0].body.spielart).toEqual({ id: "x01", content: 1, layout: 2 });
  });
});

describe("mergeBody", () => {
  test("gemeinsam und dieselbe Spielart werden eine Ebene tief zusammengefasst", () => {
    expect(
      mergeBody(
        { gemeinsam: { content: 1 }, spielart: { id: "x01", content: 2 } },
        { gemeinsam: { board: 3 }, spielart: { id: "x01", layout: 4 }, editing: 5 },
      ),
    ).toEqual({
      gemeinsam: { content: 1, board: 3 },
      spielart: { id: "x01", content: 2, layout: 4 },
      editing: 5,
    });
  });

  test("zwei Spielarten lassen sich nicht zusammenfassen", () => {
    expect(canMerge({ spielart: { id: "x01" } }, { spielart: { id: "cricket" } })).toBe(false);
    expect(canMerge({ spielart: { id: "x01" } }, { gemeinsam: {} })).toBe(true);
  });
});
