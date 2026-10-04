/**
 * Anmeldung bei Autodarts ueber den Device Authorization Grant.
 *
 * Autodarts hat die Anmeldung von Keycloak auf ein eigenes OAuth-System
 * umgestellt. Der frueher von Community-Tools genutzte Passwort-Grant wurde
 * dabei gestrichen, login.autodarts.io ist abgeschaltet.
 *
 * Fuer einen Dienst auf dem Pi ist der Geraete-Ablauf der richtige: kein
 * Browser noetig, kein Redirect-URI, und vor allem kein Passwort in der .env.
 * Du bekommst einen kurzen Code, gibst ihn am Handy frei, fertig.
 *
 * Siehe docs/protocol.md.
 */

const AUTH_BASE = "https://api.autodarts.com/auth/v1";
const DEVICE_CODE_URL = `${AUTH_BASE}/device/code`;
const DEVICE_TOKEN_URL = `${AUTH_BASE}/device/token`;
const REFRESH_URL = `${AUTH_BASE}/refresh`;

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const SCOPE = "openid profile email";

/** Sicherheitsabstand, damit ein Token nicht mitten im Request ablaeuft. */
const EXPIRY_MARGIN_MS = 60_000;
/** Der Standard schreibt vor, das Intervall bei slow_down um 5 s zu erhoehen. */
const SLOW_DOWN_STEP_MS = 5_000;

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

export interface TokenSet {
  accessToken: string;
  /** 30 Tage gueltig und bei jeder Erneuerung neu - muss sofort gespeichert werden. */
  refreshToken: string;
  expiresAt: number;
}

export interface TokenStorage {
  read(): TokenSet | null;
  write(tokens: TokenSet): void;
}

/** Was dem Benutzer gezeigt werden muss, damit er das Geraet freigeben kann. */
export interface UserCodePrompt {
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresInSeconds: number;
}

export interface AutodartsAuthOptions {
  /** Bei Autodarts registrierte Client-ID. Siehe README. */
  clientId: string;
  storage: TokenStorage;
  onUserCode?: (prompt: UserCodePrompt) => void;
  /** Einspeisbar, damit die Anmeldung ohne Netzwerk testbar ist. */
  fetch?: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export class AutodartsAuth {
  readonly #clientId: string;
  readonly #storage: TokenStorage;
  readonly #onUserCode: (prompt: UserCodePrompt) => void;
  readonly #fetch: FetchLike;
  readonly #now: () => number;
  readonly #sleep: (ms: number) => Promise<void>;
  #pending: Promise<string> | null = null;

  constructor(options: AutodartsAuthOptions) {
    this.#clientId = options.clientId;
    this.#storage = options.storage;
    this.#onUserCode = options.onUserCode ?? (() => {});
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#now = options.now ?? Date.now;
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /**
   * Liefert ein gueltiges Access-Token: aus dem Speicher, per Erneuerung oder
   * - beim allerersten Mal - ueber den Geraete-Login.
   */
  async getAccessToken(): Promise<string> {
    const stored = this.#storage.read();
    if (stored && this.#now() < stored.expiresAt) return stored.accessToken;

    // Mehrere gleichzeitige Aufrufe duerfen nicht mehrere Geraete-Logins starten.
    this.#pending ??= this.#acquire(stored).finally(() => {
      this.#pending = null;
    });
    return this.#pending;
  }

  async #acquire(stored: TokenSet | null): Promise<string> {
    const tokens = stored?.refreshToken
      ? await this.#refresh(stored.refreshToken)
      : await this.#deviceLogin();
    return tokens.accessToken;
  }

  async #refresh(refreshToken: string): Promise<TokenSet> {
    const response = await this.#post(REFRESH_URL, {
      refresh_token: refreshToken,
      client_id: this.#clientId,
    });
    if (!response.ok) {
      // Refresh-Token verbraucht oder zurueckgezogen: von vorn anmelden.
      return this.#deviceLogin();
    }
    return this.#store((await response.json()) as TokenResponse);
  }

  async #deviceLogin(): Promise<TokenSet> {
    const response = await this.#post(DEVICE_CODE_URL, {
      client_id: this.#clientId,
      scope: SCOPE,
    });
    if (!response.ok) {
      throw new Error(describeAuthFailure(response.status, await response.text()));
    }

    const device = (await response.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      verification_uri_complete: string;
      expires_in: number;
      interval: number;
    };

    this.#onUserCode({
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      verificationUriComplete: device.verification_uri_complete,
      expiresInSeconds: device.expires_in,
    });

    return this.#pollForApproval(device.device_code, device.interval * 1000);
  }

  async #pollForApproval(deviceCode: string, startInterval: number): Promise<TokenSet> {
    let interval = startInterval;

    for (;;) {
      await this.#sleep(interval);

      const response = await this.#post(DEVICE_TOKEN_URL, {
        grant_type: DEVICE_GRANT,
        device_code: deviceCode,
        client_id: this.#clientId,
      });

      if (response.ok) return this.#store((await response.json()) as TokenResponse);

      const failure = (await response.json().catch(() => ({}))) as { error?: string };
      switch (failure.error) {
        case "authorization_pending":
          break; // weiter warten
        case "slow_down":
          interval += SLOW_DOWN_STEP_MS;
          break;
        case "access_denied":
          throw new Error("Die Freigabe wurde abgelehnt. Anmeldung erneut starten.");
        case "expired_token":
          throw new Error("Der Code ist abgelaufen. Anmeldung erneut starten.");
        default:
          throw new Error(describeAuthFailure(response.status, JSON.stringify(failure)));
      }
    }
  }

  #post(url: string, body: Record<string, string>): Promise<Response> {
    return this.#fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  #store(response: TokenResponse): TokenSet {
    const tokens: TokenSet = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: this.#now() + response.expires_in * 1000 - EXPIRY_MARGIN_MS,
    };
    // Sofort schreiben: das alte Refresh-Token ist ab jetzt wertlos.
    this.#storage.write(tokens);
    return tokens;
  }
}

/**
 * Formuliert aus einer fehlgeschlagenen Anmeldung eine Meldung, die in die
 * richtige Richtung zeigt.
 *
 * Der Unterschied ist wichtig: Bei HTTP 522 hat Cloudflare den Anmeldeserver
 * gar nicht erreicht. Ein Hinweis auf die eigene Konfiguration waere dann eine
 * falsche Faehrte und kostet nur Sucherei.
 */
export function describeAuthFailure(status: number, body: string): string {
  if (status >= 500) {
    return (
      `Autodarts ist gerade nicht erreichbar (HTTP ${status}). ` +
      `Das liegt nicht an deiner Konfiguration - der Anmeldeserver antwortet nicht. ` +
      `Spaeter noch einmal versuchen.`
    );
  }

  if (/invalid_client|unknown client_id/i.test(body)) {
    return (
      `Autodarts kennt diese Client-ID nicht. ` +
      `Pruefe AUTODARTS_CLIENT_ID in der .env - eine eigene ID musst du bei ` +
      `Autodarts registrieren lassen, siehe README.`
    );
  }

  const detail = shortDetail(body);
  const hint = `Anmeldung bei Autodarts abgelehnt (HTTP ${status}).`;
  return detail ? `${hint} Server meldet: ${detail}` : hint;
}

/**
 * Nimmt aus der Antwort nur, was im Terminal weiterhilft. Fehlerseiten sind
 * oft mehrere Kilobyte HTML - das gehoert nicht in eine Fehlermeldung.
 */
function shortDetail(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return "";
  if (/^\s*<|<html|<!doctype/i.test(trimmed)) return "";
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)} ...` : trimmed;
}
