# Kamera-Ansicht der Scheibe

Stand: 13. Oktober 2026

## Ziel

Vierte Darstellung der Scheibe – **„Kamera“, vor „Gezeichnet“**: das echte
Bild einer Autodarts-Kamera, entzerrt und rund ausgeschnitten genau dort, wo
die Scheibe auf der Bühne liegt. Kein Video: ein neues Bild nach jedem Pfeil
und wenn die Pfeile herausgezogen sind (Arnolds Idee – der Rest ist statisch).
**Autodarts darf nie gestört werden.**

## Befunde der Probe (13.10., nur lesend)

- 3 Kameras, 1280 × 720. Bei Arnolds Board hängt Autodarts-Kamera 2 über der
  20; Raspdarts zählt wie Autodarts ab 0 (Erweiterung: Kamera 0–2).
- `GET /api/config/calibration/ellipses` (lokale Autodarts-Schnittstelle, von
  Autodarts' eigener Kalibrier-Ansicht genutzt) liefert je Kamera die
  Bildpunkte, an denen die 20 Drähte Double- und Triple-Ring (innen/außen)
  kreuzen, plus Bullmitte. **Punkt 0 liegt am Draht zwischen 20 und 1, die
  Zählung läuft im Uhrzeigersinn** – an allen drei Kameras geprüft. Bei
  stehendem Board ist die Antwort leer. `GET /api/config/calibration` gibt es
  lokal nicht (404).
- Homographie aus den 81 Punkten: Restfehler ≈ 1,5 px bei 600 px Scheibe.
- Klicks auf play.autodarts.com/play legen sofort eine Lobby an – dort nichts
  anklicken (siehe Arbeitsregeln).

## Umsetzung

- **Pi:** `camera-geometry.ts` rechnet je Kamera die Homographie Kamerabild →
  Einheitsquadrat (450 mm Kante, 20 oben). `cams.ts` liest die Ringpunkte
  höchstens einmal pro Minute und holt auf Wunsch ein frisches Bild
  (`fresh`). `board-camera.ts` holt Bilder nur bei Ereignissen: 0,5 s nach
  einem neuen Pfeil, wenn eine Aufnahme leer beginnt (Pfeile heraus), beim
  Öffnen der Leiste (alle drei für die Vorschau) und für frisch verbundene
  Viewer – höchstens zweimal pro Sekunde je Kamera, im Standby gar nicht,
  und nur, wenn die gezeigte Spielart die Kamera-Ansicht will. Das letzte
  Bild je Kamera bleibt im Speicher; Viewer bekommen `{type:"camera"}` und
  holen es über `/api/board-camera/:n` – Autodarts wird je Ereignis einmal
  gefragt, egal wie viele Bildschirme zuschauen.
- **Viewer:** `camera-feed.js` hält das letzte Bild je Kamera (Objekt-URL) und
  die Entzerrung; `camera-view.js` macht daraus CSS `matrix3d` in Größe der
  Scheibe. Das Bild liegt unter den eingezeichneten Darts und dem Leuchten,
  dreht mit der Scheibe.
- **Katalog:** Darstellung `kamera` (zuerst), Option `kamera` ("0"–"2",
  Kamera 1–3, Vorgabe "0") mit `showIf` – nur bei Darstellung Kamera sichtbar,
  in der Leiste als drei Vorschaubilder zum Anklicken.

## Schnittstelle

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/board-camera` | `{cams:[{n, version, matrix}]}` |
| GET | `/api/board-camera/:n` | letztes Bild (JPEG, `no-store`), 404 ohne Bild |
| POST | `/api/board-camera/refresh` | `{cams:[n…]}` – gebremst frische Bilder holen |

## Offen

- Wie steckende Pfeile aussehen (ragen aus der Ebene, wirken gestreckt) – beim
  ersten echten Wurf ansehen.
- Abnahme-Messung am Pi mit Würfen: Bildrate von Autodarts unverändert.
