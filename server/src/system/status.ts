/**
 * Systemwerte des Pi fuer das Panel der Extension. Feldnamen wie im
 * bisherigen Raspdarts-Backend, damit die Anzeige im Panel gleich bleibt.
 *
 * Alle Zugriffe auf Dateien, Befehle und Netzwerk laufen ueber StatusDeps,
 * damit die Auswertung ohne Pi testbar ist.
 */
import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir, networkInterfaces } from "node:os";

/** Zustand der Autodarts-Scheibe (v2) aus ihrer eigenen Schnittstelle. */
export interface AutodartsBoard {
  running: boolean;
  connected: boolean;
  status: string;
}

export interface SystemStatus {
  cpu_percent: number;
  ram_total_mb: number;
  ram_used_mb: number;
  temp_celsius: number;
  uptime_seconds: number;
  autodarts_version: string;
  autodarts_board: AutodartsBoard | null;
  ip_address: string | null;
  raspdarts_version: string;
}

type Interfaces = ReturnType<typeof networkInterfaces>;

export interface StatusDeps {
  readFile: (path: string) => Promise<string>;
  /** Fuehrt einen Befehl aus und liefert stdout; wirft bei Fehler. */
  run: (command: string) => Promise<string>;
  /** GET mit Zeitlimit, liefert das JSON; wirft bei Fehler, Zeitlimit oder HTTP-Fehler. */
  fetchJson: (url: string, timeoutMs: number) => Promise<unknown>;
  sleep: (ms: number) => Promise<void>;
  interfaces: () => Interfaces;
  home: string;
  version: string;
}

interface CpuSample {
  total: number;
  idle: number;
}

export function parseCpuSample(procStat: string): CpuSample {
  const fields = (procStat.split("\n")[0] ?? "").trim().split(/\s+/).slice(1).map(Number);
  return { total: fields.reduce((sum, value) => sum + value, 0), idle: fields[3] ?? 0 };
}

export function cpuPercent(first: CpuSample, second: CpuSample): number {
  const total = second.total - first.total;
  const idle = second.idle - first.idle;
  return total === 0 ? 0 : Math.round((1 - idle / total) * 1000) / 10;
}

export function parseMeminfo(meminfo: string): { ram_total_mb: number; ram_used_mb: number } {
  const megabytes = (key: string) =>
    Math.round(Number(new RegExp(`${key}:\\s+(\\d+)`).exec(meminfo)?.[1] ?? 0) / 1024);
  const total = megabytes("MemTotal");
  return { ram_total_mb: total, ram_used_mb: total - megabytes("MemAvailable") };
}

export function parseVersion(output: string): string | null {
  return /(\d+\.\d+[\d.]*)/.exec(output)?.[1] ?? null;
}

export function firstIPv4(interfaces: Interfaces): string | null {
  for (const list of Object.values(interfaces)) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

/** Autodarts v2 legt seinen Befehl immer hierhin (Symlink ins Programmverzeichnis). */
function autodartsBinary(home: string): string {
  return `${home}/.local/bin/autodarts`;
}

// GET /api/state der Scheibe; laeuft sie nicht, soll /api/status nicht lange warten.
const BOARD_STATE_URL = "http://127.0.0.1:3180/api/state";
const BOARD_TIMEOUT_MS = 1500;

/**
 * Liest running/connected/status aus der Antwort der Scheibe. Alles
 * Unerwartete (anderes Format einer kuenftigen Version) gilt als keine Antwort.
 */
export function parseBoardState(body: unknown): AutodartsBoard | null {
  if (typeof body !== "object" || body === null) return null;
  const { running, connected, status } = body as Record<string, unknown>;
  if (typeof running !== "boolean" || typeof connected !== "boolean") return null;
  return { running, connected, status: typeof status === "string" ? status : "" };
}

export function defaultStatusDeps(): StatusDeps {
  const pkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  return {
    readFile: (path) => readFile(path, "utf8"),
    run: (command) =>
      new Promise((resolve, reject) =>
        exec(command, { timeout: 5000 }, (error, stdout) => (error ? reject(error) : resolve(stdout))),
      ),
    fetchJson: async (url, timeoutMs) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    interfaces: networkInterfaces,
    home: homedir(),
    version: pkg.version,
  };
}

export function createStatusReader(deps: StatusDeps = defaultStatusDeps()): () => Promise<SystemStatus> {
  async function cpu(): Promise<number> {
    const first = parseCpuSample(await deps.readFile("/proc/stat"));
    await deps.sleep(500);
    const second = parseCpuSample(await deps.readFile("/proc/stat"));
    return cpuPercent(first, second);
  }

  async function autodartsVersion(): Promise<string> {
    try {
      return parseVersion(await deps.run(`${autodartsBinary(deps.home)} --version`)) ?? "unknown";
    } catch {
      return "unknown";
    }
  }

  async function autodartsBoard(): Promise<AutodartsBoard | null> {
    try {
      return parseBoardState(await deps.fetchJson(BOARD_STATE_URL, BOARD_TIMEOUT_MS));
    } catch {
      return null;
    }
  }

  return async () => {
    const [cpu_percent, meminfo, temp, uptime, autodarts_version, autodarts_board] = await Promise.all([
      cpu(),
      deps.readFile("/proc/meminfo"),
      deps.readFile("/sys/class/thermal/thermal_zone0/temp"),
      deps.readFile("/proc/uptime"),
      autodartsVersion(),
      autodartsBoard(),
    ]);
    return {
      cpu_percent,
      ...parseMeminfo(meminfo),
      temp_celsius: Number.parseInt(temp.trim(), 10) / 1000,
      uptime_seconds: Number.parseFloat(uptime.split(" ")[0] ?? "0"),
      autodarts_version,
      autodarts_board,
      ip_address: firstIPv4(deps.interfaces()),
      raspdarts_version: deps.version,
    };
  };
}
