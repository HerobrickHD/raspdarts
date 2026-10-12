export interface Config {
  port: number;
  /** Lokale Schnittstelle von Autodarts; zum Testen unter Windows auf den Pi zeigen lassen. */
  autodartsUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env["PORT"] ?? 8743),
    autodartsUrl: env["AUTODARTS_URL"] ?? "http://127.0.0.1:3180",
  };
}
