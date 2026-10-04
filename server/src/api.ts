/**
 * REST-Aufrufe gegen die Autodarts-API.
 *
 * Basis-URLs und Pfade sind in docs/protocol.md belegt.
 */
import type { AutodartsAuth } from "./auth.js";

const API_BASE = "https://api.autodarts.com";

export interface Board {
  id: string;
  name: string;
}

async function get<T>(auth: AutodartsAuth, path: string): Promise<T> {
  const token = await auth.getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`GET ${path} fehlgeschlagen: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Holt ein kurzlebiges Ticket. Der WebSocket akzeptiert kein Bearer-Token,
 * sondern nur dieses Ticket als Query-Parameter.
 */
export async function getTicket(auth: AutodartsAuth): Promise<string> {
  const token = await auth.getAccessToken();
  const response = await fetch(`${API_BASE}/ms/v0/ticket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Ticket konnte nicht geholt werden: HTTP ${response.status}`);
  }
  return (await response.text()).trim().replace(/^"|"$/g, "");
}

export function listBoards(auth: AutodartsAuth): Promise<Board[]> {
  return get<Board[]>(auth, "/bs/v0/boards");
}

export function getMatchState(auth: AutodartsAuth, matchId: string): Promise<unknown> {
  return get<unknown>(auth, `/gs/v0/matches/${matchId}/state`);
}
