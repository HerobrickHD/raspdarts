/**
 * WebSocket-Verbindung zum Autodarts-Message-Service.
 *
 * Bewusst duenn gehalten: diese Klasse kennt keine Spielregeln. Sie stellt die
 * Verbindung her, haelt sie am Leben und reicht jeden empfangenen Frame roh
 * weiter. Die Auswertung passiert in game-state.ts, die Aufzeichnung in
 * recorder.ts - beide ohne Netzwerk testbar.
 */
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type { AutodartsAuth } from "./auth.js";
import { getTicket } from "./api.js";

const WS_URL = "wss://api.autodarts.com/ms/v0/subscribe";

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export interface Subscription {
  channel: string;
  topic: string;
}

/** Baut die Subscribe-Nachricht. Format laut docs/protocol.md. */
export function subscribeMessage(sub: Subscription): string {
  return JSON.stringify({ channel: sub.channel, type: "subscribe", topic: sub.topic });
}

/** Abonniert alle Match-Ereignisse, die auf diesem Board gestartet werden. */
export const boardMatchesTopic = (boardId: string): Subscription => ({
  channel: "autodarts.boards",
  topic: `${boardId}.matches`,
});

/** Abonniert den Spielverlauf eines konkreten Matches. */
export const matchStateTopic = (matchId: string): Subscription => ({
  channel: "autodarts.matches",
  topic: `${matchId}.state`,
});

export declare interface AutodartsClient {
  on(event: "frame", listener: (frame: unknown, raw: string) => void): this;
  on(event: "open", listener: () => void): this;
  on(event: "close", listener: (reason: string) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
}

export class AutodartsClient extends EventEmitter {
  readonly #auth: AutodartsAuth;
  #socket: WebSocket | null = null;
  #subscriptions = new Map<string, Subscription>();
  #reconnectDelay = RECONNECT_MIN_MS;
  #stopped = false;

  constructor(auth: AutodartsAuth) {
    super();
    this.#auth = auth;
  }

  async start(): Promise<void> {
    this.#stopped = false;
    await this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    this.#socket?.close();
    this.#socket = null;
  }

  /**
   * Abonniert ein Topic. Wirkt sofort, wenn die Verbindung steht, und wird
   * nach einem Reconnect automatisch erneut gesendet.
   */
  subscribe(sub: Subscription): void {
    this.#subscriptions.set(`${sub.channel}/${sub.topic}`, sub);
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(subscribeMessage(sub));
    }
  }

  async #connect(): Promise<void> {
    if (this.#stopped) return;
    try {
      const ticket = await getTicket(this.#auth);
      const socket = new WebSocket(`${WS_URL}?ticket=${encodeURIComponent(ticket)}`);
      this.#socket = socket;

      socket.on("open", () => {
        this.#reconnectDelay = RECONNECT_MIN_MS;
        for (const sub of this.#subscriptions.values()) {
          socket.send(subscribeMessage(sub));
        }
        this.emit("open");
      });

      socket.on("message", (data) => {
        const raw = data.toString();
        let parsed: unknown = raw;
        try {
          parsed = JSON.parse(raw);
        } catch {
          // Kein JSON - roh weiterreichen, damit discover.ts es trotzdem zeigt.
        }
        this.emit("frame", parsed, raw);
      });

      socket.on("error", (error) => this.emit("error", error as Error));
      socket.on("close", (code, reason) => {
        this.emit("close", `${code} ${reason.toString()}`.trim());
        this.#scheduleReconnect();
      });
    } catch (error) {
      this.emit("error", error as Error);
      this.#scheduleReconnect();
    }
  }

  #scheduleReconnect(): void {
    if (this.#stopped) return;
    const delay = this.#reconnectDelay;
    this.#reconnectDelay = Math.min(delay * 2, RECONNECT_MAX_MS);
    setTimeout(() => void this.#connect(), delay);
  }
}
