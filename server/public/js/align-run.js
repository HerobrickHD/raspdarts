/*
 * Scheibe automatisch ausrichten - der Ablauf im Browser mit der Leiste: Pi
 * zeigt das Pruefbild und liefert die Kamerabilder (POST /api/align/capture),
 * hier werden sie entpackt und ausgewertet (align.js), das Ergebnis geht ueber
 * den Editor ins Profil - ein Schritt fuer Zurueck.
 */
import { measureBoard } from "./align.js";
import { RATIOS } from "./stage.js";

const MESSAGES = {
  playing: "Nur ohne laufendes Spiel",
  busy: "Ausrichten läuft schon",
  "board-stopped": "Board ist im Standby – in Autodarts starten",
  unavailable: "Autodarts nicht erreichbar",
  "no-calibration": "Autodarts-Kalibrierung fehlt",
  "no-spots": "Punkte nicht gefunden – Beamer an und auf die Scheibe gerichtet?",
  "too-few": "Punkte nicht gefunden – Beamer an und auf die Scheibe gerichtet?",
  "one-sided": "Zu wenige Punkte gefunden – Scheibe grob ausrichten und noch einmal versuchen",
  inaccurate: "Messung zu ungenau – bitte noch einmal versuchen",
  "profile-changed": "Profil gewechselt – nichts geändert",
};

/** Warum der Knopf gerade nicht geht; null = er geht. */
export function alignBlocked({ phase, format }) {
  if (phase === "playing") return MESSAGES.playing;
  if (!(format in RATIOS)) return "Nur bei festem Format (z. B. 16:9)";
  return null;
}

export function alignMessage(result) {
  if (result.ok) return `Ausgerichtet (± ${result.rms.toFixed(1).replace(".", ",")} mm)`;
  return MESSAGES[result.reason] ?? "Ausrichten fehlgeschlagen";
}

/** Breite zu Hoehe der Buehne bei festem Format. */
export const aspectOf = (format) => RATIOS[format];

/**
 * Eine Messung. capture: Anfrage an den Pi; decode: Base64-JPEG -> ImageData;
 * setBoard: neue Lage ins Profil. Uebernommen wird nur, wenn das aktive
 * Profil noch dasselbe ist wie beim Start.
 */
export async function runAlign({ capture, decode, getProfile, setBoard }) {
  const profile = getProfile();
  const shot = await capture();
  if (!shot.ok) return shot;
  const captures = await Promise.all(
    shot.cams.map(async ({ matrix, black, dots }) => ({ matrix, black: await decode(black), dots: await decode(dots) })),
  );
  const result = measureBoard(captures, profile.layout.board, aspectOf(profile.format));
  if (!result.ok) return result;
  if (getProfile()?.id !== profile.id) return { ok: false, reason: "profile-changed" };
  setBoard(result.board);
  return result;
}

/** Base64-JPEG -> ImageData (nur im Browser). */
export async function decodeJpeg(base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
