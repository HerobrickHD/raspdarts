import { describe, expect, test } from "vitest";
import {
  cpuPercent,
  createStatusReader,
  firstIPv4,
  parseCpuSample,
  parseMeminfo,
  parseVersion,
  type StatusDeps,
} from "../src/system/status.js";

const FILES: Record<string, string[]> = {
  "/proc/stat": ["cpu  100 0 100 800 0 0 0 0 0 0\n", "cpu  150 0 150 900 0 0 0 0 0 0\n"],
  "/proc/meminfo": ["MemTotal:        4096000 kB\nMemAvailable:    2048000 kB\n"],
  "/sys/class/thermal/thermal_zone0/temp": ["52000\n"],
  "/proc/uptime": ["12060.50 23456.78\n"],
};

function fakeDeps(overrides: Partial<StatusDeps> = {}): StatusDeps {
  const reads = new Map<string, number>();
  return {
    readFile: async (path) => {
      const versions = FILES[path];
      if (!versions) throw new Error(`unerwarteter Pfad ${path}`);
      const index = reads.get(path) ?? 0;
      reads.set(path, index + 1);
      return versions[Math.min(index, versions.length - 1)] ?? "";
    },
    run: async () => {
      throw new Error("not found");
    },
    sleep: async () => {},
    interfaces: () => ({
      lo: [{ address: "127.0.0.1", family: "IPv4", internal: true } as never],
      eth0: [{ address: "192.168.1.42", family: "IPv4", internal: false } as never],
    }),
    home: "/home/pi",
    version: "2.0.0",
    ...overrides,
  };
}

describe("Einzelwerte", () => {
  test("rechnet die CPU-Last aus zwei Messungen", () => {
    const first = parseCpuSample("cpu  100 0 100 800 0 0 0 0 0 0");
    const second = parseCpuSample("cpu  150 0 150 900 0 0 0 0 0 0");
    expect(cpuPercent(first, second)).toBe(50);
  });

  test("meldet 0 %, wenn zwischen den Messungen keine Zeit verging", () => {
    const sample = parseCpuSample("cpu  1 1 1 1");
    expect(cpuPercent(sample, sample)).toBe(0);
  });

  test("liest RAM in MB", () => {
    expect(parseMeminfo("MemTotal:  4096000 kB\nMemAvailable:  2048000 kB\n")).toEqual({
      ram_total_mb: 4000,
      ram_used_mb: 2000,
    });
  });

  test("findet die Versionsnummer in der Ausgabe", () => {
    expect(parseVersion("autodarts version 0.27.1\n")).toBe("0.27.1");
    expect(parseVersion("keine Version")).toBeNull();
  });

  test("nimmt die erste externe IPv4-Adresse", () => {
    expect(firstIPv4(fakeDeps().interfaces())).toBe("192.168.1.42");
    expect(firstIPv4({})).toBeNull();
  });
});

describe("createStatusReader", () => {
  test("liefert alle Felder, Autodarts nicht installiert", async () => {
    const status = await createStatusReader(fakeDeps())();

    expect(status).toEqual({
      cpu_percent: 50,
      ram_total_mb: 4000,
      ram_used_mb: 2000,
      temp_celsius: 52,
      uptime_seconds: 12060.5,
      autodarts_version: "unknown",
      ip_address: "192.168.1.42",
      raspdarts_version: "2.0.0",
    });
  });

  test("erkennt die Autodarts-Version ueber den ersten antwortenden Pfad", async () => {
    const tried: string[] = [];
    const run = async (command: string) => {
      tried.push(command);
      if (command === "/home/pi/.local/bin/autodarts --version") return "autodarts 0.27.1";
      throw new Error("not found");
    };

    const status = await createStatusReader(fakeDeps({ run }))();

    expect(status.autodarts_version).toBe("0.27.1");
    expect(tried).toEqual([
      "/usr/local/bin/autodarts --version",
      "autodarts --version",
      "/home/pi/.local/bin/autodarts --version",
    ]);
  });
});
