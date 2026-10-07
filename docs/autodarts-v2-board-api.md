# Autodarts v2 – lokale Board-Schnittstelle (Port 3180)

Mitgeschnitten am 7. Oktober 2026 an Autodarts headless **v2.0.2** (vision 2.0.0)
auf dem Raspdarts-Pi. Methode: Die offizielle Terminal-App lief über
`autodarts remote -H 127.0.0.1 -p 3190` gegen einen protokollierenden Proxy auf
Port 3190, der alles an `127.0.0.1:3180` weiterreichte. Jede Aktion wurde in der
App ausgelöst und der Mitschnitt notiert. Alle Änderungen sind danach
zurückgestellt worden.

**Inoffiziell.** Autodarts dokumentiert diese Schnittstelle nicht; sie kann sich
mit jeder Version ändern.

## Grundsätzliches

- HTTP ohne Anmeldung, lauscht auf `0.0.0.0:3180` – jedes Gerät im Heimnetz
  kann lesen und schreiben.
- Antworten tragen `Access-Control-Allow-Origin: *`.
- **`GET /api/config` und jede Antwort auf `PATCH /api/config` enthalten den
  API-Key des Boards** (`auth.api_key`). Raspdarts darf diese Antworten nie
  ungefiltert weitergeben. (`GET /api/system` enthält die Config ebenfalls,
  dort war `api_key` leer – nicht darauf verlassen.)
- Der alte Board-Manager im Browser (`/`, `/monitor`) zeigt nur noch „Board
  Manager is no longer supported“.

## Lesen

| Methode und Pfad | Antwort (gekürzt) |
|---|---|
| `GET /api/version` | `2.0.2` (text/plain) |
| `GET /api/state` | `{"connected":true,"event":"Started","numThrows":0,"running":true,"status":"Throw"}` |
| `GET /api/cams/state` | `{"isOpened":true,"isRunning":true}` |
| `GET /api/devices` | Liste der angeschlossenen Kameras: `bus` (USB-Platz, z. B. `1-1`), `card`, `formats[].path` (die ID für die Zuordnung, z. B. `native=/dev/video0&vid=0bdc&pid=8088&serial=HB202400001&location=1-1`), `formats[].resolutions[]` mit `width`, `height`, `framerates` |
| `GET /api/config` | ganze Config (siehe unten) – **enthält API-Key** |
| `GET /api/config/cam/resolution` | `{"height":720,"width":1280}` |
| `GET /api/config/calibration/geometry` | `calibrated` gesamt und je Kamera (`calibrated`, `calibrating`, `error_px`, `fit_failed`, Homographie …) |
| `GET /api/config/calibration/ellipses` | erkannte Ringe je Kamera (Bull, Double-Ringe als Ellipsen und Punkte) |
| `GET /api/config/pipeline` | 404 (die App fragt es trotzdem) |
| `GET /api/host` | Rechnerdaten: Modell, Kernel, IP, `clientVersion`, `visionVersion` |
| `GET /api/system` | Sammelstand: `calibrated`, `camState`, `camStats` (FPS je Kamera), `motion.camStates` (isDart, isHand, isStable, isTakeout je Kamera), `link`, `config` … |
| `GET /api/state/stats` | `{"cpuPercent":…,"fps":…,"memoryBytes":…,"resolution":{…}}` |

### Config (`GET /api/config`, Stand auf dem Pi)

```json
{
  "auth": { "api_key": "***", "board_id": "…" },
  "cam": {
    "auto_calibrate": true, "auto_calibrate_on_start": true, "auto_distortion": false,
    "cams": ["native=/dev/video0&…&location=1-1", "native=/dev/video2&…&location=3-1", "native=/dev/video4&…&location=3-2"],
    "fps": 30, "fps_max": 30, "height": 720, "width": 1280
  },
  "detection": { "kernel": 5, "threshold": 16 },
  "host": { "port": "3180", "tls_cert": "", "tls_key": "", "tls_port": "", "tls_self_signed": false },
  "link_server": { "enabled": false, "interfaces": [] },
  "motion": { "kernel": 3, "scale": 4.0, "stable_num_frames": 3, "standby_minutes": 15, "threshold": 16 }
}
```

## Bilder

| Pfad | Inhalt |
|---|---|
| `GET /api/img/cams/<n>` | Einzelbild einer Kamera (n ab 0), JPEG 1280×720, ca. 80–90 KB, Antwort in wenigen ms |
| `GET /api/img/live` | alle drei Kameras nebeneinander, JPEG 3840×720, ca. 200 KB |
| `GET /api/img/detection` | Erkennungsbild, JPEG, ca. 400 KB |
| `GET /api/streams/cams/<n>` | MJPEG-Livestream (`multipart/x-mixed-replace; boundary=advisionmjpg`), ca. 2,7 MB/s |

Weitere Pfade laut Programm (nicht getestet): `/api/img/detection/before|after|movement`,
`/api/img/motion`, `/api/streams/live`, `/api/streams/detection`,
`/api/streams/motion`, `/api/streams/start|stop`.

## Ereignisse (WebSocket)

| Pfad | Beobachtet |
|---|---|
| `ws://…:3180/api/events/system?except=timings` | etwa 1 Nachricht/s `{"type":"stats","data":{"camStats":[…],"stats":{"cpuPercent":…,"fps":…}}}`; die App abonniert diesen Kanal |
| `ws://…:3180/api/events` | 4 s lang keine Nachricht (ohne Würfe). Vermutlich Wurf-/Bewegungsereignisse – **mit echten Darts noch zu prüfen** |

## Schreiben (mitgeschnitten)

| Aktion in der Terminal-App | Anfrage | Antwort |
|---|---|---|
| Alle kalibrieren (Taste `c`) | `POST /api/config/calibration/auto` (ohne Inhalt) | `200 []` |
| Kamera n kalibrieren | `POST /api/config/calibration/auto/<n>` (n ab 0) | `200 {}` |
| Kamera-Platz zuordnen | `PATCH /api/config` `{"cam":{"cams":["<path Platz 1>","<path Platz 2>","<path Platz 3>"]}}` – immer die ganze Liste; `""` = keine Kamera | `200` + ganze Config |
| Linsenkorrektur an/aus | `PATCH /api/config` `{"cam":{"auto_distortion":true}}` | `200` + Config |
| Bildrate | `PATCH /api/config` `{"cam":{"fps":25}}` (Auswahl: 30, 25, 20, 15, 10) | `200` + Config |
| Standby-Zeit | `PATCH /api/config` `{"motion":{"standby_minutes":30}}` (Auswahl: 5, 10, 15, 30, 60) | `200` + Config |
| Erkennungsgeschwindigkeit | `PATCH /api/config` `{"motion":{"stable_num_frames":N}}` – Very low 5, Low 4, Default 3, High 2, Very high vermutlich 1 (nicht mitgeschnitten) | `200` + Config |
| Erkennung stoppen | `PUT /api/stop` | `200`, leer; `/api/state` → `running:false`, `status:"Stopped"` |
| Erkennung starten | `PUT /api/start` | `200`, leer |
| Zurücksetzen | `POST /api/reset` | `200`, leer; Ereignis „Manual reset“ |

Beobachtungen dazu:

- Wählt man in der App denselben Wert noch einmal, schickt sie nichts.
- Nach dem Ändern der Kamera-Zuordnung startet die Erkennung neu; die
  Kalibrierung blieb erhalten (v2 speichert sie je Kamera-Identität).
- **Auflösung** (Auswahl 640×480, 800×600, 848×480, 1280×720) wurde nicht
  geändert, weil das die Kalibrierung gefährden könnte. Vermutlich
  `PATCH /api/config {"cam":{"width":…,"height":…}}` – **ungeprüft**.
- Die Terminal-App fragt nach jeder Änderung die Config, Kalibrierung und
  Geräteliste neu ab.
- Nicht mitgeschnitten (nur im lokalen Modus der App, nicht über `remote`):
  Dienst ein/aus und „Restart“ des Dienstes. Das ist `systemctl --user` auf
  dem Pi, keine HTTP-Schnittstelle.
- Weitere Pfade laut Programm, nicht getestet: `/api/restart`,
  `/api/config/reset` („Reset board to defaults“), `/api/config/dynamic`,
  `/api/update/check|apply|track`, `/api/debug/*`, `/api/ping`.

## Standby

Nach `standby_minutes` ohne Aktivität: „Standby: 15 minutes without activity,
standing down“, danach `/api/state` → `running:false`, `event:"Stopped"`,
`status:"Stopped"`. Über die Schnittstelle nicht von einem manuellen Stopp zu
unterscheiden.
