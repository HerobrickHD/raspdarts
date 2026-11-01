import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../public/js/profile-api.js";

/* fetch, das nie antwortet - bis das Zeitlimit abbricht. */
function hangingFetch() {
  return vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("abort")))));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("api Zeitlimit", () => {
  test("Standard: nach 5 s keine Antwort vom Pi", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const call = api("GET", "/api/profiles");
    const failed = expect(call).rejects.toThrow("keine Antwort vom Pi");

    await vi.advanceTimersByTimeAsync(5000);
    await failed;
  });

  test("eigenes Zeitlimit: das Ausrichten darf laenger dauern", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    let settled = false;
    const call = api("POST", "/api/align/capture", undefined, { timeoutMs: 20_000 }).catch(() => {});
    call.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(10_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(settled).toBe(true);
  });
});
