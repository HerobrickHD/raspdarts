import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import {
  autodartsHttp,
  cached,
  createCams,
  parseCamsConfig,
  type AutodartsHttp,
} from "../src/system/cams.js";

const CONFIG = {
  auth: { api_key: "GEHEIM-123", board_id: "b-1" },
  cam: { cams: ["native=/dev/video0", "", "native=/dev/video2", "native=/dev/video4"] },
};

/** Nachgemachtes Autodarts: zaehlt Aufrufe, Antworten lassen sich je Test aendern. */
class FakeAutodarts implements AutodartsHttp {
  calls: string[] = [];
  config: unknown = CONFIG;
  state: unknown = { running: true, connected: true, status: "Throw" };
  ellipses: unknown = { "0": { bull: [1, 2] } };
  image: (path: string) => Promise<Buffer> = async (path) => Buffer.from(`jpeg ${path}`);

  async json(path: string): Promise<unknown> {
    this.calls.push(path);
    const answer =
      path === "/api/config"
        ? this.config
        : path === "/api/state"
          ? this.state
          : path === "/api/config/calibration/ellipses"
            ? this.ellipses
            : undefined;
    if (answer === undefined) throw new Error(`unbekannter Pfad ${path}`);
    if (answer instanceof Error) throw answer;
    return answer;
  }

  async bytes(path: string): Promise<Buffer> {
    this.calls.push(path);
    return this.image(path);
  }

  count(path: string): number {
    return this.calls.filter((call) => call === path).length;
  }
}

function setup() {
  const fake = new FakeAutodarts();
  const clock = { now: 0 };
  const cams = createCams({ http: fake, now: () => clock.now });
  return { fake, clock, cams };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("parseCamsConfig", () => {
  test("nimmt nur die Board-ID und zaehlt belegte Kamera-Plaetze", () => {
    expect(parseCamsConfig(CONFIG)).toEqual({ board_id: "b-1", cams: 3 });
  });

  test("ohne Board-ID bleibt board_id null", () => {
    expect(parseCamsConfig({ auth: {}, cam: { cams: ["a"] } })).toEqual({ board_id: null, cams: 1 });
  });

  test("Unerwartetes ergibt null", () => {
    expect(parseCamsConfig(null)).toBeNull();
    expect(parseCamsConfig({ cam: { cams: "a" } })).toBeNull();
    expect(parseCamsConfig("text")).toBeNull();
  });
});

describe("cached", () => {
  test("haelt einen Wert fuer die angegebene Zeit und laedt danach neu", async () => {
    const clock = { now: 0 };
    let loads = 0;
    const get = cached(1000, () => clock.now, async () => ++loads);

    expect(await get()).toBe(1);
    clock.now = 999;
    expect(await get()).toBe(1);
    clock.now = 2000;
    expect(await get()).toBe(2);
  });

  // Der Pi hat keine Echtzeituhr; springt die Uhr zurueck, darf nichts einfrieren.
  test("laedt neu, wenn die Uhr zurueckspringt", async () => {
    const clock = { now: 10_000 };
    let loads = 0;
    const get = cached(1000, () => clock.now, async () => ++loads);

    expect(await get()).toBe(1);
    clock.now = 5000;
    expect(await get()).toBe(2);
  });

  test("merkt sich einen Fehler nicht", async () => {
    let fail = true;
    const get = cached(30_000, () => 0, async () => {
      if (fail) throw new Error("weg");
      return "da";
    });

    await expect(get()).rejects.toThrow("weg");
    fail = false;
    expect(await get()).toBe("da");
  });
});

describe("info", () => {
  test("liefert Board-ID, Kameraanzahl und Zaehler – aber nie den API-Key", async () => {
    const { cams } = setup();

    const info = await cams.info();

    expect(info).toEqual({ board_id: "b-1", cams: 3, fetched: 0 });
    expect(JSON.stringify(info)).not.toContain("GEHEIM");
  });

  test("liest die Config hoechstens alle 30 s", async () => {
    const { fake, clock, cams } = setup();

    await cams.info();
    clock.now = 29_999;
    await cams.info();
    expect(fake.count("/api/config")).toBe(1);

    clock.now = 60_000;
    await cams.info();
    expect(fake.count("/api/config")).toBe(2);
  });

  test("wirft, wenn Autodarts nicht antwortet, und versucht es nach einer Sekunde erneut", async () => {
    const { fake, clock, cams } = setup();
    fake.config = new Error("Zeitlimit");

    await expect(cams.info()).rejects.toThrow();
    fake.config = CONFIG;
    clock.now = 1000;
    expect((await cams.info()).cams).toBe(3);
  });

  test("fragt die Config nach einem Fehler hoechstens einmal pro Sekunde", async () => {
    const { fake, clock, cams } = setup();
    fake.config = new Error("Zeitlimit");

    await expect(cams.info()).rejects.toThrow();
    clock.now = 500;
    await expect(cams.info()).rejects.toThrow();
    expect(await cams.image(0)).toEqual({ ok: false, reason: "unavailable" });
    expect(fake.count("/api/config")).toBe(1);

    clock.now = 1500;
    await expect(cams.info()).rejects.toThrow();
    expect(fake.count("/api/config")).toBe(2);
  });
});

describe("image", () => {
  test("holt das Bild der Kamera bei Autodarts", async () => {
    const { fake, cams } = setup();

    const result = await cams.image(1);

    expect(result).toEqual({ ok: true, jpeg: Buffer.from("jpeg /api/img/cams/1") });
    expect(fake.count("/api/img/cams/1")).toBe(1);
  });

  test("fragt Autodarts hoechstens einmal pro Sekunde und Kamera", async () => {
    const { fake, clock, cams } = setup();

    await cams.image(0);
    clock.now = 500;
    await cams.image(0);
    await cams.image(0);
    expect(fake.count("/api/img/cams/0")).toBe(1);

    clock.now = 1500;
    await cams.image(0);
    expect(fake.count("/api/img/cams/0")).toBe(2);
  });

  test("jede Kamera hat ihren eigenen Zwischenspeicher", async () => {
    const { fake, cams } = setup();

    await cams.image(0);
    await cams.image(2);

    expect(fake.count("/api/img/cams/0")).toBe(1);
    expect(fake.count("/api/img/cams/2")).toBe(1);
  });

  test("teilt einen laufenden Abruf auch nach Ablauf der Sekunde", async () => {
    const { fake, clock, cams } = setup();
    const slow = deferred<Buffer>();
    fake.image = () => slow.promise;

    const first = cams.image(0);
    const second = cams.image(0);
    clock.now = 1500; // Autodarts ist langsam, die Sekunde ist um
    const third = cams.image(0);
    // erst Config und Zustand abwarten lassen, dann zaehlen
    await new Promise((r) => setTimeout(r, 0));
    slow.resolve(Buffer.from("langsam"));

    const results = await Promise.all([first, second, third]);
    expect(fake.count("/api/img/cams/0")).toBe(1);
    for (const result of results) expect(result).toEqual({ ok: true, jpeg: Buffer.from("langsam") });
  });

  test("im Standby: board-stopped, ohne ein Bild anzufragen", async () => {
    const { fake, cams } = setup();
    fake.state = { running: false, connected: true, status: "Stopped" };

    expect(await cams.image(0)).toEqual({ ok: false, reason: "board-stopped" });
    expect(fake.count("/api/img/cams/0")).toBe(0);
  });

  test("fragt den Zustand hoechstens einmal pro Sekunde", async () => {
    const { fake, clock, cams } = setup();

    await cams.image(0);
    await cams.image(1);
    await cams.image(2);
    expect(fake.count("/api/state")).toBe(1);

    clock.now = 1000;
    await cams.image(0);
    expect(fake.count("/api/state")).toBe(2);
  });

  test("Zustand nicht lesbar: unavailable, ohne ein Bild anzufragen", async () => {
    const { fake, cams } = setup();
    fake.state = new Error("Zeitlimit");

    expect(await cams.image(0)).toEqual({ ok: false, reason: "unavailable" });
    expect(fake.count("/api/img/cams/0")).toBe(0);
  });

  test("falsche Kamera-Nummer: not-found, ohne Autodarts nach einem Bild zu fragen", async () => {
    const { fake, cams } = setup();

    for (const n of [3, -1, 1.5, Number.NaN]) {
      expect(await cams.image(n)).toEqual({ ok: false, reason: "not-found" });
    }
    expect(fake.calls.filter((call) => call.startsWith("/api/img/"))).toEqual([]);
  });

  test("Config nicht lesbar: unavailable", async () => {
    const { fake, cams } = setup();
    fake.config = new Error("weg");

    expect(await cams.image(0)).toEqual({ ok: false, reason: "unavailable" });
  });

  test("Bild nicht lesbar: unavailable, und erst nach einer Sekunde ein neuer Versuch", async () => {
    const { fake, clock, cams } = setup();
    fake.image = async () => {
      throw new Error("Zeitlimit");
    };

    expect(await cams.image(0)).toEqual({ ok: false, reason: "unavailable" });
    clock.now = 500;
    await cams.image(0);
    expect(fake.count("/api/img/cams/0")).toBe(1);

    clock.now = 1500;
    await cams.image(0);
    expect(fake.count("/api/img/cams/0")).toBe(2);
  });

  test("der Zaehler in info() zaehlt die Bildabrufe bei Autodarts", async () => {
    const { clock, cams } = setup();

    await cams.image(0);
    await cams.image(0);
    await cams.image(1);
    clock.now = 1000;
    await cams.image(0);

    expect((await cams.info()).fetched).toBe(3);
  });
});

describe("frische Bilder und Kalibrierung (Kamera-Ansicht)", () => {
  test("fresh holt ein neues Bild, auch innerhalb der Sekunde, und ersetzt das gemerkte", async () => {
    const { fake, cams } = setup();
    let n = 0;
    fake.image = async () => Buffer.from(`bild ${(n += 1)}`);
    await cams.image(2);

    const fresh = await cams.image(2, { fresh: true });
    const again = await cams.image(2);

    expect(fresh).toEqual({ ok: true, jpeg: Buffer.from("bild 2") });
    expect(again).toEqual({ ok: true, jpeg: Buffer.from("bild 2") });
    expect(fake.count("/api/img/cams/2")).toBe(2);
  });

  test("fresh im Standby: board-stopped, kein Bild", async () => {
    const { fake, cams } = setup();
    fake.state = { running: false, connected: true, status: "Stopped" };
    expect(await cams.image(0, { fresh: true })).toEqual({ ok: false, reason: "board-stopped" });
    expect(fake.count("/api/img/cams/0")).toBe(0);
  });

  test("calibration liest die Ringpunkte hoechstens alle 60 s", async () => {
    const { fake, clock, cams } = setup();
    expect(await cams.calibration()).toEqual({ "0": { bull: [1, 2] } });
    clock.now = 59_000;
    await cams.calibration();
    expect(fake.count("/api/config/calibration/ellipses")).toBe(1);
    clock.now = 61_000;
    await cams.calibration();
    expect(fake.count("/api/config/calibration/ellipses")).toBe(2);
  });

  test("calibration: Fehler ergibt null, neuer Versuch nach einer Sekunde", async () => {
    const { fake, clock, cams } = setup();
    fake.ellipses = new Error("weg");
    expect(await cams.calibration()).toBeNull();
    await cams.calibration();
    expect(fake.count("/api/config/calibration/ellipses")).toBe(1);
    clock.now = 1_500;
    fake.ellipses = { "1": {} };
    expect(await cams.calibration()).toEqual({ "1": {} });
  });
});

describe("autodartsHttp", () => {
  let server: Server;
  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

  async function start(handler: Parameters<typeof createServer>[1]): Promise<string> {
    server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  test("liest JSON und Bytes", async () => {
    const base = await start((req, res) => {
      if (req.url === "/api/state") res.end('{"running":true}');
      else res.end(Buffer.from([0xff, 0xd8, 0xff]));
    });
    const http = autodartsHttp(base);

    expect(await http.json("/api/state", 1000)).toEqual({ running: true });
    expect(await http.bytes("/api/img/cams/0", 1000)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  test("wirft bei Fehlerstatus", async () => {
    const base = await start((_req, res) => {
      res.statusCode = 500;
      res.end("kaputt");
    });

    await expect(autodartsHttp(base).json("/api/state", 1000)).rejects.toThrow("HTTP 500");
  });

  test("wirft nach dem Zeitlimit", async () => {
    const base = await start(() => {
      /* antwortet nie */
    });

    await expect(autodartsHttp(base).bytes("/api/img/cams/0", 50)).rejects.toThrow();
  });
});
