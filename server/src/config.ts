import "dotenv/config";

export interface Config {
  clientId: string;
  boardId: string | null;
  port: number;
}

function required(name: string, hint: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt. ${hint}`);
  return value;
}

export function loadConfig(): Config {
  return {
    clientId: required(
      "AUTODARTS_CLIENT_ID",
      "Autodarts vergibt Client-IDs auf Anfrage - siehe README, Abschnitt Anmeldung.",
    ),
    boardId: process.env["AUTODARTS_BOARD_ID"]?.trim() || null,
    port: Number(process.env["PORT"] ?? 8080),
  };
}
