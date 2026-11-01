import { describe, expect, test, vi } from "vitest";
import { ALIGN_DOTS } from "../public/js/align.js";
import { alignBlocked, alignMessage, aspectOf, runAlign } from "../public/js/align-run.js";

const FIX = "Punkte nicht gefunden – Beamer an und auf die Scheibe gerichtet?";

describe("alignBlocked", () => {
  test("im Spiel gesperrt", () => {
    expect(alignBlocked({ phase: "playing", format: "16:9" })).toBe("Nur ohne laufendes Spiel");
  });

  test("bei ganzem Fenster gesperrt", () => {
    expect(alignBlocked({ phase: "idle", format: "fenster" })).toBe("Nur bei festem Format (z. B. 16:9)");
  });

  test("sonst frei", () => {
    expect(alignBlocked({ phase: "idle", format: "16:9" })).toBeNull();
  });
});

describe("alignMessage", () => {
  test("Erfolg mit Genauigkeit", () => {
    expect(alignMessage({ ok: true, rms: 0.84 })).toBe("Ausgerichtet (± 0,8 mm)");
  });

  test.each([
    ["playing", "Nur ohne laufendes Spiel"],
    ["busy", "Ausrichten läuft schon"],
    ["board-stopped", "Board ist im Standby – in Autodarts starten"],
    ["unavailable", "Autodarts nicht erreichbar"],
    ["no-calibration", "Autodarts-Kalibrierung fehlt"],
    ["no-spots", FIX],
    ["too-few", FIX],
    ["one-sided", "Zu wenige Punkte gefunden – Scheibe grob ausrichten und noch einmal versuchen"],
    ["inaccurate", "Messung zu ungenau – bitte noch einmal versuchen"],
    ["profile-changed", "Profil gewechselt – nichts geändert"],
  ])("%s", (reason, text) => {
    expect(alignMessage({ ok: false, reason })).toBe(text);
  });
});

describe("aspectOf", () => {
  test("feste Formate", () => {
    expect(aspectOf("16:9")).toBeCloseTo(16 / 9, 12);
    expect(aspectOf("16:10")).toBeCloseTo(1.6, 12);
    expect(aspectOf("4:3")).toBeCloseTo(4 / 3, 12);
  });
});

/* Kamera von vorn: Pixel = mm + 225 auf 450x450; die echte Scheibe liegt 10 mm rechts der gezeichneten. */
function image() {
  const data = new Uint8ClampedArray(450 * 450 * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: 450, height: 450, data };
}
function litImage() {
  const img = image();
  for (const [x, y] of ALIGN_DOTS) {
    // gezeichneter Punkt p liegt auf der echten Scheibe bei p - 10 mm (echte Scheibe 10 mm weiter rechts)
    const cx = Math.round(x - 10 + 225);
    const cy = Math.round(y + 225);
    for (let yy = cy - 2; yy <= cy + 2; yy++) {
      for (let xx = cx - 2; xx <= cx + 2; xx++) {
        const i = (yy * 450 + xx) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      }
    }
  }
  return img;
}

const PROFILE = { id: "test", format: "16:9", layout: { board: { cx: 50, cy: 50, diameter: 60, rotation: 0 } } };
const CAPTURE = { ok: true, cams: [{ n: 0, matrix: [1 / 450, 0, 0, 0, 1 / 450, 0, 0, 0, 1], black: "B", dots: "D" }] };
const decode = async (b64) => (b64 === "B" ? image() : litImage());

describe("runAlign", () => {
  test("Fehler vom Pi: nichts wird geaendert", async () => {
    const setBoard = vi.fn();
    const result = await runAlign({
      capture: async () => ({ ok: false, reason: "board-stopped" }),
      decode,
      getProfile: () => PROFILE,
      setBoard,
    });

    expect(result).toEqual({ ok: false, reason: "board-stopped" });
    expect(setBoard).not.toHaveBeenCalled();
  });

  test("Messung gelingt: neue Lage wird uebernommen", async () => {
    const setBoard = vi.fn();
    const result = await runAlign({ capture: async () => CAPTURE, decode, getProfile: () => PROFILE, setBoard });

    expect(result.ok).toBe(true);
    expect(setBoard).toHaveBeenCalledTimes(1);
    const board = setBoard.mock.calls[0][0];
    // 10 mm nach rechts = 10 * 60/340 % der Hoehe = 1,765 / (16/9) % der Breite
    expect(board.cx).toBeCloseTo(50 + (10 * 60) / 340 / (16 / 9), 1);
    expect(board.cy).toBeCloseTo(50, 1);
    // Testpunkte auf ganzen Pixeln (1 px = 1 mm) - der Durchmesser nur auf 0,3 genau
    expect(Math.abs(board.diameter - 60)).toBeLessThan(0.3);
  });

  test("Profil hat waehrend der Messung gewechselt: nichts wird uebernommen", async () => {
    const setBoard = vi.fn();
    let calls = 0;
    const result = await runAlign({
      capture: async () => CAPTURE,
      decode,
      getProfile: () => (calls++ === 0 ? PROFILE : { ...PROFILE, id: "anderes" }),
      setBoard,
    });

    expect(result).toEqual({ ok: false, reason: 'profile-changed' });
    expect(setBoard).not.toHaveBeenCalled();
  });
});
