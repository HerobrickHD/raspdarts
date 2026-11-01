import { describe, expect, test } from "vitest";
import { Aligner, PATTERN_SETTLE_MS } from "../src/viewer/align.js";
import type { CamImage } from "../src/system/cams.js";
import { cameraMatrices } from "../src/viewer/camera-geometry.js";
import { IDLE, type ViewerState } from "../src/viewer/game-state.js";
import type { Pattern } from "../src/viewer/display-hub.js";

/** Ellipsen-Punkte, aus denen cameraMatrix eine Homographie macht (ein ganzer Ring). */
function ellipse(): unknown {
  const ring = (mm: number) =>
    Array.from({ length: 20 }, (_, k) => {
      const rad = ((9 + 18 * k) * Math.PI) / 180;
      return [400 + mm * Math.sin(rad), 300 - mm * Math.cos(rad)];
    });
  return { doubleOuterPoints: ring(170), trebleOuterPoints: ring(107), bull: [400, 300] };
}
const CALIBRATION = { "0": ellipse(), "2": ellipse() };

type Log = (string | Pattern | null)[];

function setup(options: { image?: (n: number) => CamImage; calibration?: unknown; onSleep?: (count: number) => void } = {}) {
  const log: Log = [];
  const hub = {
    state: IDLE as ViewerState,
    setPattern(pattern: Pattern | null) {
      log.push(pattern);
    },
  };
  let sleeps = 0;
  const cams = {
    async image(n: number, opts?: { fresh?: boolean }): Promise<CamImage> {
      log.push(`image ${n}${opts?.fresh ? " fresh" : ""}`);
      return options.image?.(n) ?? { ok: true, jpeg: Buffer.from(`jpeg-${n}-${log.length}`) };
    },
    calibration: async () => (options.calibration === undefined ? CALIBRATION : options.calibration),
  };
  const aligner = new Aligner({
    cams,
    hub,
    sleep: async (ms) => {
      log.push(`sleep ${ms}`);
      options.onSleep?.(++sleeps);
    },
  });
  return { aligner, hub, log };
}

const PLAYING = { phase: "playing" } as unknown as ViewerState;

describe("Aligner.capture", () => {
  test("Schwarz, Bilder, Punkte, Bilder, aus", async () => {
    const { aligner, log } = setup();

    const result = await aligner.capture();

    expect(log).toEqual([
      "black",
      `sleep ${PATTERN_SETTLE_MS}`,
      "image 0 fresh",
      "image 2 fresh",
      "dots",
      `sleep ${PATTERN_SETTLE_MS}`,
      "image 0 fresh",
      "image 2 fresh",
      null,
    ]);
    expect(PATTERN_SETTLE_MS).toBe(1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cams.map((c) => c.n)).toEqual([0, 2]);
    expect(Buffer.from(result.cams[0]!.black, "base64").toString()).toBe("jpeg-0-3");
    expect(Buffer.from(result.cams[1]!.dots, "base64").toString()).toBe("jpeg-2-8");
    expect(result.cams[0]!.matrix).toEqual(cameraMatrices(CALIBRATION)["0"]);
  });

  test("bei laufendem Spiel kein Pruefbild", async () => {
    const { aligner, hub, log } = setup();
    hub.state = PLAYING;

    expect(await aligner.capture()).toEqual({ ok: false, reason: "playing" });
    expect(log).toEqual([]);
  });

  test("Spiel startet waehrend der Messung: Abbruch, Pruefbild aus", async () => {
    const ctx = setup({ onSleep: (n) => n === 1 && (ctx.hub.state = PLAYING) });

    expect(await ctx.aligner.capture()).toEqual({ ok: false, reason: "playing" });
    expect(ctx.log.at(-1)).toBeNull();
    expect(ctx.log).not.toContain("dots");
  });

  test("Board im Standby", async () => {
    const { aligner, log } = setup({ image: () => ({ ok: false, reason: "board-stopped" }) });

    expect(await aligner.capture()).toEqual({ ok: false, reason: "board-stopped" });
    expect(log.at(-1)).toBeNull();
  });

  test("Autodarts nicht erreichbar", async () => {
    const { aligner } = setup({ image: () => ({ ok: false, reason: "unavailable" }) });

    expect(await aligner.capture()).toEqual({ ok: false, reason: "unavailable" });
  });

  test("ohne Kalibrierung", async () => {
    const { aligner, log } = setup({ calibration: null });

    expect(await aligner.capture()).toEqual({ ok: false, reason: "no-calibration" });
    expect(log).toEqual([]);
  });

  test("zweite Messung waehrend der ersten: busy, das Pruefbild der ersten bleibt", async () => {
    let release = () => {};
    const ctx = setup();
    const gate = new Promise<void>((resolve) => (release = resolve));
    const aligner = new Aligner({
      cams: {
        image: async () => ({ ok: true, jpeg: Buffer.from("x") }),
        calibration: async () => CALIBRATION,
      },
      hub: ctx.hub,
      sleep: () => gate,
    });

    const first = aligner.capture();
    for (let i = 0; i < 20 && !ctx.log.includes("black"); i++) await Promise.resolve();
    expect(await aligner.capture()).toEqual({ ok: false, reason: "busy" });
    expect(ctx.log).toEqual(["black"]);

    release();
    expect((await first).ok).toBe(true);
  });
});
