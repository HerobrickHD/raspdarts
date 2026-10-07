# Teilprojekt B: Board-Verwaltung – Zwischenstand vor der Pause

Stand: 7. Oktober 2026, abends. **Noch keine Spec**, sondern der Stand des
Brainstormings, damit es nach der Pause nahtlos weitergeht.

## Wo wir stehen

| Schritt | Stand |
|---|---|
| Teilprojekt A (Raspdarts zeigt Autodarts v2 nur noch an) | fertig, gepusht (`5c8594f`), auf dem Pi ausgerollt |
| B: Umfang festlegen | **erledigt** (siehe unten) |
| B: Test der Board-Schnittstelle | **erledigt** – Ergebnisse in `docs/autodarts-v2-board-api.md` |
| B: Ansätze vorschlagen | **als Nächstes** |
| B: Entwurf abschnittsweise freigeben, Spec, Plan, Umsetzung | offen |

Vorgehen wie bei den letzten Teilprojekten (superpowers:brainstorming,
architektonischer Pfad): Fragen einzeln, Entwurf als klickbares Beispiel in der
echten Autodarts-Seite, Spec in `docs/superpowers/specs/`, Plan, Umsetzung
„Native“ mit abschließendem Review.

## Ziel

Der Browser-Board-Manager ist in Autodarts v2 abgeschafft; offiziell verwaltet
man ein headless Board nur noch über die Terminal-App `ad` (per SSH) oder
`autodarts remote` (Linux/Mac). Raspdarts soll das in der Raspdarts-Seite auf
play.autodarts.com anbieten – vor allem für Windows-Nutzer ohne Terminal.

## Umfang (von Arnold gewählt: alles)

1. **Kameras & Kalibrierung:** je Platz (Kamera 1–3) die Kamera aus der Liste
   der angeschlossenen wählen; Kalibrier-Status je Kamera; „Kalibrieren“ je
   Kamera und für alle.
2. **Live-Ansicht:** Kamerabild je Kamera; Live-Zustand (wartet / ruhig / Dart /
   Hand / Darts ziehen); zuletzt erkannte Darts.
3. **Einstellungen:** Auflösung, Bildrate, Standby-Zeit, Erkennungsgeschwindigkeit,
   Linsenkorrektur – wie in der Terminal-App.
4. **Steuerung:** Erkennung stoppen/starten, zurücksetzen, Autodarts-Dienst neu
   starten.

## Erkenntnisse aus dem Test (Details in `docs/autodarts-v2-board-api.md`)

- Alles außer „Dienst neu starten“ geht über HTTP auf Port 3180, ohne Anmeldung.
- Schreiben: `PATCH /api/config` mit nur dem geänderten Teil; Kalibrieren
  `POST /api/config/calibration/auto[/n]`; `PUT /api/stop|start`; `POST /api/reset`.
- **Die Config enthält den API-Key**, auch jede Antwort auf `PATCH /api/config`.
- Bilder: JPEG je Kamera (`/api/img/cams/n`, 1280×720, ~85 KB, schnell) und
  MJPEG-Streams. play.autodarts.com ist https, die Scheibe http → der Browser
  bindet die Bilder nicht direkt ein (Mixed Content).
- Live-Ereignisse: WebSocket `/api/events/system` (Statistik ~1/s);
  `/api/events` lieferte ohne Würfe nichts – mit echten Darts prüfen.
- Kamera-Zuordnung startet die Erkennung neu; Kalibrierung bleibt erhalten.
- Auflösung ändern ist ungetestet (Risiko: Kalibrierung).
- „Dienst neu starten“ ist `systemctl --user restart autodarts` als `pi` – das
  kann der Raspdarts-Dienst (läuft als `pi`) selbst, ohne sudo.

## Vorüberlegungen für die Ansätze (noch nicht mit Arnold besprochen)

**Weg der Anfragen**

- *Empfehlung:* Extension → `background.js` → Raspdarts-Dienst (neue Endpunkte,
  z. B. `/api/board/...`) → `127.0.0.1:3180`. Der Raspdarts-Dienst reicht nur
  freigegebene Aktionen durch, **filtert den API-Key heraus** und behält den
  bestehenden Schutz (`X-Raspdarts`-Header, Hostprüfung).
- Alternative: Extension spricht direkt mit `raspdarts.local:3180` (braucht
  eine weitere Host-Berechtigung, API-Key landet in der Extension, kein Filter).

**Kamerabilder**

- MJPEG lässt sich nicht über die Nachrichten der Extension tunneln.
- *Vorschlag:* Einzelbilder abfragen (z. B. 2–5 pro Sekunde, nur solange die
  Ansicht offen ist): Dienst oder `background.js` holt das JPEG, die Seite zeigt
  es als Blob/Data-URL. 3 Kameras × 85 KB × 5/s ≈ 1,3 MB/s im Heimnetz.
- Alternativ `/api/img/live` (alle drei in einem Bild, ~200 KB).

**Offene Fragen an Arnold**

1. Wo in der Raspdarts-Seite? Eigene Karte „Board“ unter den bisherigen, oder
   Unterseiten/Reiter (z. B. „Übersicht“ / „Board“)?
2. Kamerabild: dauernd live oder erst auf Klick („Kameras anzeigen“)?
3. Welche Aktionen brauchen eine Bestätigung (z. B. Kamera-Zuordnung,
   Auflösung, Zurücksetzen)?
4. Auflösung überhaupt anbieten, solange ungeprüft ist, ob sie die
   Kalibrierung zerstört?
5. Standby: in der Autodarts-Karte „Gestoppt“ beibehalten oder „Gestoppt
   (z. B. Standby)“?

**Vor der Spec noch zu prüfen**

- `/api/events` mit echten Würfen (Arnold wirft ein paar Darts, ich lese mit).
- Auflösung ändern und zurück (nur mit Arnolds Zustimmung, ggf. neu kalibrieren).

## Sonstiges, beim Test aufgefallen

- Auf dem Pi ist `/usr/bin/node` **v20.20.2**, nicht 22 (der Raspdarts-Dienst
  läuft damit). Für Teilprojekt A unkritisch (`fetch`, `AbortSignal.timeout`
  gibt es in 20); vor B klären, ob Node 22 gewollt war (siehe Commit
  `3b1750b` „Node 22 installieren“).
- tmux ist auf dem Pi installiert (zum Ansehen der Terminal-App); kann bleiben.
- Werkzeuge für Tests am Pi (nach dem Test wieder gelöscht, bei Bedarf neu
  schreiben): protokollierender Proxy (Node, Port 3190, maskiert `api_key`),
  `click.sh` (Mausklick per tmux `send-keys -l $'\e[<0;Spalte;ZeileM'`).
  Die Terminal-App hat Tastenkürzel: `s` Stop/Start, `r` Reset, `c` Calibrate.
