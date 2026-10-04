# Raspdarts — Zusammenführung von Beamer, Pi-Backend und Extension

Stand: 4. Oktober 2026

## Ziel

Drei getrennte Projekte werden zu einem:

| Bisher | Was es tut | Technik |
|---|---|---|
| `autodarts-beamer` | Scoreboard-Projektion (Stufe 1 fertig) | TypeScript, Fastify, ESM, Vitest |
| `Raspdarts-backend` | Pi-Verwaltung: Status, Updates, Neustart | JavaScript, Express, CommonJS, Jest |
| `Raspdarts` | Browser-Extension auf play.autodarts.io | JavaScript, Chrome MV3 / Firefox MV2 (künftig beide MV3) |

Ergebnis ist das Repo `raspdarts` (`C:\Projekte\raspdarts`, GitHub
`HerobrickHD/raspdarts`) mit **einem** Dienst auf dem Pi. Die Git-Historie der
alten Repos wird nicht übernommen; das neue Repo beginnt frisch.

**Fertig heißt:** Arnold startet am Laptop ein Spiel auf play.autodarts.io, und
der Beamer zeigt Restpunkte, Aufnahme und Checkout-Weg live. Das Pi-Panel der
Extension funktioniert wie bisher. Eine fremde Webseite kann den Pi nicht mehr
steuern. Die erste echte Aufzeichnung bestätigt oder korrigiert die Annahmen in
`docs/protocol.md`.

## Die zentrale Änderung: Spieldaten kommen von der Extension

Bisher sollte sich der Beamer-Dienst selbst per OAuth bei Autodarts anmelden.
Das entfällt. Stattdessen liest die Extension auf play.autodarts.io die
WebSocket-Nachrichten der Seite mit und reicht sie an den Pi weiter. Der Pi
braucht damit keine Autodarts-Zugangsdaten mehr.

Weil das dieselben Rohnachrichten sind, für die `game-state.ts`, `checkout.ts`
und die Aufzeichnungsdateien gebaut wurden, bleibt die vorhandene Spiellogik
unverändert.

**Bekannte Einschränkung:** Der Beamer zeigt nur etwas an, solange ein Tab mit
play.autodarts.io offen ist. Da Spiele ohnehin vom Laptop gestartet werden, ist
das akzeptiert.

Verworfen wurden: Auslesen der Seitenoberfläche (bricht bei jeder
Design-Änderung, liefert keine Einschlagkoordinaten) und eigene API-Abfragen mit
dem Seiten-Token (mehr Aufwand, kein Gewinn).

## Repo-Struktur

```
raspdarts/
├── server/                 ein Node-Dienst (TypeScript, Fastify, Port 8743)
│   ├── src/
│   │   ├── index.ts            Start, Konfiguration
│   │   ├── http.ts             Fastify-Setup, Header-Schutz
│   │   ├── system/             portiert aus Raspdarts-backend
│   │   │   ├── status.ts           CPU, RAM, Temperatur, Uptime, Versionen
│   │   │   ├── jobs.ts             Root-Skripte als SSE-Stream, Sperre gegen Doppelstart
│   │   │   └── power.ts            Neustart, Herunterfahren
│   │   └── beamer/             übernommen aus autodarts-beamer
│   │       ├── ingest.ts           nimmt Autodarts-Nachrichten der Extension an
│   │       ├── game-state.ts       unverändert
│   │       ├── checkout.ts         unverändert
│   │       ├── layout.ts, layout-store.ts
│   │       ├── recorder.ts         schreibt eingehende Nachrichten als NDJSON mit
│   │       └── replay.ts           spielt Aufzeichnungen ab (Entwicklung ohne Scheibe)
│   ├── public/             Beamer-Anzeige (index.html, app.js, style.css)
│   ├── scripts/            Root-Skripte, werden nach /usr/local/lib/raspdarts/ installiert
│   └── test/
├── extension/
│   ├── src/                content.js, background.js,
│   │                       forward.js, page-hook.js, bridge.js (neu)
│   ├── modal.html, modal.css, icons/
│   ├── manifest.chrome.json, manifest.firefox.json
│   └── build.sh
├── install.sh              Einzeiler-Installer
├── deploy/raspdarts.service
└── docs/                   projekt.md, protocol.md
```

**Entfällt:** `auth.ts`, `token-storage.ts`, `user-code.ts`,
`autodarts-client.ts`, `discover.ts`, die `.env` mit Client-ID und Board-ID,
Express, `cors`, Jest. Die Aufgabe von `discover` übernimmt der Recorder, der
alles mitschreibt, was die Extension liefert.

## Datenfluss

```
play.autodarts.io
  └─ page-hook.js   (Seitenkontext, umhüllt window.WebSocket)
       │ window.postMessage, markiert
       ▼
     bridge.js      (isolierter Kontext)
       │ runtime-Port
       ▼
     background.js  ══ WebSocket ══▶  Pi :8743/ingest
                                        │ game-state + checkout
                                        ▼
     Beamer-Browser ◀══ WebSocket ══  Pi :8743/ws   (ScoreboardState)
```

## Extension

### Mitlesen — `page-hook.js`

- Läuft im Seitenkontext ab `document_start`, damit `window.WebSocket` umhüllt
  ist, bevor die Seite ihre Verbindung öffnet.
- Beide Browser nutzen Manifest V3 mit einem Content-Script-Eintrag
  `"world": "MAIN"`, `"run_at": "document_start"`. Firefox kann das ab Version
  128; die Extension setzt `strict_min_version: "128.0"`. Eine
  Script-Tag-Injektion unter MV2 wäre nicht zuverlässig: Ein nachgeladenes
  Script startet asynchron, die Seite könnte ihren WebSocket vorher öffnen.
- Weitergereicht werden nur **eingehende** Textnachrichten von Verbindungen,
  deren Host `autodarts.io` oder `autodarts.com` ist (inklusive Subdomains). Die
  Entscheidung trifft eine reine Funktion `shouldForward(url)` in `forward.js`,
  die ohne Browser testbar ist.
- Das Verhalten der Seite bleibt unverändert: Der Wrapper ist eine Unterklasse
  des echten `WebSocket` und hängt nur einen zusätzlichen `message`-Listener an.

### Weiterleiten

- `page-hook.js` → `window.postMessage({ source: "raspdarts-hook", … })`.
  Ein eigenes Content-Script `bridge.js` (isolierter Kontext, ab
  `document_start`) nimmt nur Nachrichten mit dieser Markierung und von
  `event.source === window` an. `content.js` bleibt reine Oberfläche.
- `bridge.js` → `background.js` über einen langlebigen Port. `bridge.js`
  schickt alle 20 s ein Lebenszeichen über den Port, damit der Chrome-Service-Worker
  und mit ihm die Verbindung zum Pi nicht nach 30 s Leerlauf beendet wird.
- `background.js` hält die WebSocket-Verbindung zu
  `ws://raspdarts.local:8743/ingest`. Der Umweg über den Hintergrund ist nötig,
  weil eine `ws://`-Verbindung aus einer `https`-Seite als Mixed Content
  blockiert würde.
- Die Verbindung zum Pi besteht nur, solange mindestens ein Autodarts-Tab einen
  Port offen hat.
- Bei Abbruch: Wiederverbinden mit wachsendem Abstand (1 s, 2 s, 4 s … höchstens
  30 s). Nachrichten während der Unterbrechung werden verworfen; Autodarts
  schickt bei jeder Änderung den vollständigen Match-Stand.

### Oberfläche

- Der Raspdarts-Button bekommt einen kleinen Punkt: weiß, wenn die Verbindung
  zum Pi für Spieldaten steht, sonst abgedunkelt. (Der Button selbst ist grün,
  ein grüner Punkt wäre darauf unsichtbar.) Aktualisiert wird er mit der
  vorhandenen Statusabfrage alle 30 s.
- Das Panel zeigt eine Zeile „Beamer: verbunden / keine Verbindung“, gespeist aus
  `/api/status` (`beamer.ingest_connected`).
- Alle `fetch`-Aufrufe nutzen die neuen `/api/…`-Pfade und senden
  `X-Raspdarts: 1`.
- Sonst bleibt das Panel wie es ist.

### Board-Auswahl

`AUTODARTS_BOARD_ID` entfällt. Angezeigt wird das Match, für das zuletzt Daten
kamen.

## Server

### Endpunkte (alle auf Port 8743)

| Pfad | Schutz | Zweck |
|---|---|---|
| `GET /` und statische Dateien | — | Beamer-Anzeige |
| `WS /ws` | — | Anzeige erhält den `ScoreboardState` (nur lesend) |
| `WS /ingest` | Origin-Prüfung | Extension liefert Autodarts-Nachrichten |
| `GET /api/status` | Header | Systemwerte, dazu `beamer: { ingest_connected, last_message_at }` |
| `POST /api/autodarts/install` | Header | SSE-Stream |
| `POST /api/autodarts/uninstall` | Header | SSE-Stream |
| `POST /api/system/update` | Header | SSE-Stream, danach Dienst-Neustart |
| `POST /api/system/uninstall` | Header | SSE-Stream |
| `POST /api/system/reboot` | Header | Neustart |
| `POST /api/system/shutdown` | Header | Herunterfahren |
| `GET/PUT /api/layout/:display` | Header | Layout der Anzeige, wie bisher |

`/api/autodarts/install` ersetzt das bisherige `/autodarts/update`; der
Installer von Autodarts ist für Neuinstallation und Update derselbe.

Die Felder von `/api/status` bleiben wie im bisherigen Backend
(`cpu_percent`, `ram_used_mb`, `ram_total_mb`, `temp_celsius`,
`uptime_seconds`, `autodarts_version`, `ip_address`, `raspdarts_version`),
ergänzt um `beamer`. Ist Autodarts nicht installiert, ist
`autodarts_version` gleich `"unknown"`.

### Schutz

- **Header:** Jede Anfrage an `/api/*` braucht `X-Raspdarts: 1`, sonst 403. Ein
  Browser darf diesen Header von fremden Seiten nur nach einer CORS-Freigabe
  senden, und der Server gibt keine. Das bisherige offene CORS entfällt. Die
  Beamer-Anzeige (`app.js`) sendet den Header ebenfalls; sie läuft auf demselben
  Ursprung und braucht keine Freigabe.
- **Herkunft bei `/ingest`:** Browser können bei WebSockets keine eigenen Header
  setzen. `/ingest` nimmt deshalb nur Verbindungen mit einem `Origin` an, der mit
  `chrome-extension://` oder `moz-extension://` beginnt.
- **Bewusst nicht geschützt:** Andere Geräte im Heimnetz können den Header
  selbst setzen. Eine Kopplung per Code ist nicht Teil dieses Umfangs.

### sudo-Rechte

- Root-Aktionen sind feste Skripte: `autodarts-install.sh`,
  `autodarts-uninstall.sh`, `raspdarts-update.sh`, `raspdarts-uninstall.sh`,
  `reboot.sh`, `shutdown.sh`.
- Der Installer kopiert sie nach `/usr/local/lib/raspdarts/`, Eigentümer root,
  Rechte 755. Lägen sie im Installationsordner des Benutzers, könnte der Dienst
  sie umschreiben, und die Einschränkung wäre wertlos.
- `/etc/sudoers.d/raspdarts` erlaubt genau diese sechs Skripte ohne Passwort,
  ohne Argumente. Kein `bash -c *` mehr.
- `raspdarts-update.sh` führt `git pull` und den Build als Dienst-Benutzer aus
  (`sudo -u`), damit im Installationsordner keine Dateien root gehören. Danach
  ruft es `setup-root.sh` auf, das die Skripte neu nach
  `/usr/local/lib/raspdarts/` kopiert (per Umbenennen, damit das gerade laufende
  Skript nicht überschrieben wird), sudoers und Service-Datei schreibt. Der
  Dienst-Neustart wird per `systemd-run --on-active=2` verzögert, damit der
  SSE-Stream sauber zu Ende geht.
- `setup-root.sh` wird von `install.sh` und `raspdarts-update.sh` gemeinsam
  genutzt und steht selbst nicht in sudoers.
- **Grenze dieses Schutzes:** Er verhindert, dass über das Netz beliebige
  Befehle als root laufen. Wer bereits als Dienst-Benutzer Code ausführt, kann
  den Klon ändern und über das Update-Skript root werden. Auf Raspberry Pi OS hat
  der Standardbenutzer ohnehin volle sudo-Rechte; das ist akzeptiert.

### Installation und Update

- `install.sh` (als normaler Benutzer, nutzt sudo): Node 20 bei Bedarf, Klon
  nach `~/raspdarts`, im Ordner `server/`: `npm ci`, `npm run build`,
  `npm prune --omit=dev`. Danach Root-Skripte, sudoers, Hostname `raspdarts`,
  systemd-Dienst.
- `deploy/raspdarts.service` mit `Nice=10`, damit die Kamera-Erkennung Vorrang
  behält, und `Restart=always`.
- **Umstieg:** Liegt in `~/raspdarts` ein Klon mit der Remote-URL von
  `Raspdarts-backend`, entfernt der Installer diese Installation (Dienst stoppen,
  alte sudoers-Datei löschen, Ordner löschen) und installiert neu.
- `--uninstall` wie bisher; der Hostname wird nicht zurückgesetzt.

### Laufzeit-Verhalten

- Gibt es keine Spieldaten, zeigt die Anzeige ihren bisherigen Wartezustand.
- Nachrichten, die `game-state.ts` nicht versteht, werden protokolliert und
  übersprungen; der Dienst stürzt nicht ab.
- Liefern mehrere Tabs gleichzeitig, gilt die Verbindung, von der zuletzt eine
  Nachricht kam.
- Der Recorder schreibt jede eingehende Nachricht als NDJSON nach
  `data/sessions/` (wie bisher), eine Datei pro Dienststart.
- Ein laufendes Root-Skript wird **nicht** abgebrochen, wenn das Panel
  geschlossen wird. Ein halb installiertes Autodarts oder ein halbes Update wäre
  schlimmer als ein Lauf ohne Zuschauer. Die Sperre gegen Doppelstart hält, bis
  das Skript fertig ist.
- `fetch`-Aufrufe ohne Body senden keinen `Content-Type: application/json`
  mehr; Fastify lehnt einen leeren JSON-Body sonst mit 400 ab.

## Tests

Alle Tests laufen mit Vitest.

- Die Beamer-Tests ziehen mit um und bleiben grün, bis auf die Tests zur
  Anmeldung (`auth.test.ts`, `auth-errors.test.ts`), die mit dem Code entfallen.
- Die Backend-Tests werden portiert. Der Status-Test, der heute `os_version` und
  `'unbekannt'` erwartet, wird an das tatsächliche Verhalten angepasst.
- Neu:
  - Header-Schutz: ohne `X-Raspdarts` 403, mit Header 200.
  - Origin-Prüfung an `/ingest`: Extension-Ursprung angenommen, Web-Ursprung
    und fehlender Ursprung abgewiesen.
  - Ende-zu-Ende über `/ingest`: `demo-session.ndjson` wird eingespielt, an
    `/ws` kommt der erwartete `ScoreboardState` an.
  - `shouldForward` der Extension.
- Root-Skripte und `install.sh` werden auf dem Pi geprüft, nicht unter Windows.

## Reihenfolge

1. Repo anlegen, Beamer-Dateien nach `server/`, Extension nach `extension/`,
   erster Commit.
2. Systemfunktionen nach TypeScript/Fastify portieren, Header-Schutz, Tests.
3. `/ingest` bauen, Autodarts-Anmeldung entfernen.
4. Extension: `page-hook.js`, Verbindung zum Pi, neue API-Pfade, Statusanzeige.
5. `install.sh`, Root-Skripte, Service-Datei, Doku (`README.md`, `projekt.md`,
   `protocol.md`).
6. Abnahme an der Scheibe durch Arnold: installieren, Extension laden, ein Leg
   werfen, Aufzeichnung gegen `protocol.md` prüfen.

## Nicht in diesem Umfang

- Bedienung des Beamers aus der Extension
- Kopplung per Code
- Veröffentlichung im Chrome Web Store oder bei Firefox Add-ons
- Beamer-Stufen 2 bis 5
