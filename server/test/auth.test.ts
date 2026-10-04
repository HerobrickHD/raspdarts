import { describe, expect, test, vi } from "vitest";
import { AutodartsAuth, type TokenSet, type TokenStorage } from "../src/auth.js";

/** Speicher im Arbeitsspeicher statt auf Platte. */
function memoryStorage(initial: TokenSet | null = null): TokenStorage & { value: TokenSet | null } {
  return {
    value: initial,
    read() {
      return this.value;
    },
    write(tokens: TokenSet) {
      this.value = tokens;
    },
  };
}

/** Fetch-Double: liefert der Reihe nach die angegebenen Antworten. */
function stubFetch(...responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; body: unknown }[] = [];
  const fn = async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "null")) });
    const next = responses.shift() ?? { status: 500, body: {} };
    const status = next.status ?? 200;
    return {
      ok: status < 400,
      status,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
    } as Response;
  };
  return Object.assign(fn, { calls });
}

const authFor = (
  fetch: ReturnType<typeof stubFetch>,
  storage: TokenStorage,
  extra: Record<string, unknown> = {},
) =>
  new AutodartsAuth({
    clientId: "test-client",
    storage,
    fetch,
    now: () => 0,
    sleep: async () => {},
    ...extra,
  });

const tokens = (access: string, refresh: string, expiresIn = 900) => ({
  access_token: access,
  refresh_token: refresh,
  expires_in: expiresIn,
});

describe("AutodartsAuth - gespeicherte Tokens", () => {
  test("nutzt ein gueltiges Token, ohne irgendetwas anzufragen", async () => {
    const fetch = stubFetch();
    const storage = memoryStorage({
      accessToken: "gueltig",
      refreshToken: "r1",
      expiresAt: 60_000,
    });

    expect(await authFor(fetch, storage).getAccessToken()).toBe("gueltig");
    expect(fetch.calls).toHaveLength(0);
  });

  test("erneuert ein abgelaufenes Token ueber /auth/v1/refresh", async () => {
    const fetch = stubFetch({ body: tokens("neu", "r2") });
    const storage = memoryStorage({ accessToken: "alt", refreshToken: "r1", expiresAt: -1 });

    expect(await authFor(fetch, storage).getAccessToken()).toBe("neu");
    expect(fetch.calls[0]!.url).toBe("https://api.autodarts.com/auth/v1/refresh");
    expect(fetch.calls[0]!.body).toMatchObject({ refresh_token: "r1", client_id: "test-client" });
  });

  test("speichert das rotierte Refresh-Token sofort", async () => {
    // Jede Erneuerung gibt ein neues Refresh-Token aus. Wird das alte behalten,
    // fliegt man beim naechsten Start raus.
    const fetch = stubFetch({ body: tokens("neu", "r2") });
    const storage = memoryStorage({ accessToken: "alt", refreshToken: "r1", expiresAt: -1 });

    await authFor(fetch, storage).getAccessToken();

    expect(storage.value?.refreshToken).toBe("r2");
  });
});

describe("AutodartsAuth - Geraete-Login", () => {
  const deviceCode = {
    device_code: "dev-123",
    user_code: "WDJB-MJHT",
    verification_uri: "https://auth.autodarts.io/link",
    verification_uri_complete: "https://auth.autodarts.io/link?user_code=WDJB-MJHT",
    expires_in: 600,
    interval: 5,
  };

  test("fordert einen Geraetecode an und zeigt ihn dem Benutzer", async () => {
    const fetch = stubFetch({ body: deviceCode }, { body: tokens("frisch", "r1") });
    const onUserCode = vi.fn();

    const token = await authFor(fetch, memoryStorage(), { onUserCode }).getAccessToken();

    expect(token).toBe("frisch");
    expect(fetch.calls[0]!.url).toBe("https://api.autodarts.com/auth/v1/device/code");
    expect(onUserCode).toHaveBeenCalledWith(
      expect.objectContaining({
        userCode: "WDJB-MJHT",
        verificationUri: "https://auth.autodarts.io/link",
      }),
    );
  });

  test("pollt weiter, solange die Freigabe aussteht", async () => {
    const fetch = stubFetch(
      { body: deviceCode },
      { status: 400, body: { error: "authorization_pending" } },
      { status: 400, body: { error: "authorization_pending" } },
      { body: tokens("endlich", "r1") },
    );

    expect(await authFor(fetch, memoryStorage()).getAccessToken()).toBe("endlich");
    expect(fetch.calls).toHaveLength(4);
  });

  test("verlaengert das Intervall, wenn der Server slow_down meldet", async () => {
    const waits: number[] = [];
    const fetch = stubFetch(
      { body: deviceCode },
      { status: 400, body: { error: "slow_down" } },
      { body: tokens("ok", "r1") },
    );

    await authFor(fetch, memoryStorage(), {
      sleep: async (ms: number) => void waits.push(ms),
    }).getAccessToken();

    expect(waits[0]).toBe(5000);
    expect(waits[1]).toBe(10000); // 5 Sekunden mehr, wie im Standard vorgesehen
  });

  test("bricht ab, wenn der Benutzer die Freigabe verweigert", async () => {
    const fetch = stubFetch({ body: deviceCode }, { status: 400, body: { error: "access_denied" } });

    await expect(authFor(fetch, memoryStorage()).getAccessToken()).rejects.toThrow(/abgelehnt/i);
  });

  test("bricht ab, wenn der Code abgelaufen ist", async () => {
    const fetch = stubFetch({ body: deviceCode }, { status: 400, body: { error: "expired_token" } });

    await expect(authFor(fetch, memoryStorage()).getAccessToken()).rejects.toThrow(/abgelaufen/i);
  });

  test("erklaert eine nicht registrierte client_id", async () => {
    const fetch = stubFetch({
      status: 400,
      body: { error: "invalid_client", error_description: "unknown client_id" },
    });

    await expect(authFor(fetch, memoryStorage()).getAccessToken()).rejects.toThrow(
      /AUTODARTS_CLIENT_ID/,
    );
  });
});
