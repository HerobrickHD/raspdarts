# Raspdarts

Alles rund um die Autodarts-Scheibe am Raspberry Pi – in einem Repo:

- **Pi-Verwaltung** direkt aus play.autodarts.com: CPU, RAM, Temperatur, Version und
  Zustand von Autodarts, Raspdarts aktualisieren, Pi neu starten oder herunterfahren.
- **Beamer-Scoreboard**: Restpunkte, aktiver Spieler und Checkout-Weg groß an der
  Wand neben der Scheibe.

## Aufbau

```
play.autodarts.com (Laptop)
  └─ Raspdarts-Extension ── liest den Spielstand mit ──┐
                          └─ Seite: Status, Updates ───┤
                                                       ▼
Raspberry Pi 5 ── raspdarts (ein Dienst, Port 8743) ── Beamer: http://raspdarts.local:8743/
```

Auf neueren Pi-OS-Versionen heißt der Befehl `chromium` statt `chromium-browser`.

| Ordner | Inhalt |
|---|---|
| `server/` | der Dienst auf dem Pi (TypeScript, Fastify) |
| `extension/` | Browser-Extension für Chrome und Firefox ≥ 128 |
| `deploy/`, `install.sh` | Installation auf dem Pi |
| `docs/` | Projektbeschreibung, Autodarts-Protokoll, Entwürfe |

Die Spieldaten kommen von der Extension: Sie liest auf play.autodarts.com die
WebSocket-Nachrichten der Seite mit und reicht sie an den Pi weiter. Der Pi braucht
deshalb keine Autodarts-Zugangsdaten. Der Beamer zeigt nur etwas an, solange ein Tab
mit play.autodarts.com offen ist.

## Installation auf dem Pi

Voraussetzung ist Autodarts headless v2. Falls noch nicht vorhanden, auf dem Pi:

```bash
curl -fsSL autodarts.sh | bash -s -- --headless
```

Danach `ad` starten und unter „Service“ den Dienst einschalten, damit die Scheibe
nach einem Neustart von selbst läuft. Raspdarts installiert und aktualisiert
Autodarts nicht; v2 aktualisiert sich selbst.

```bash
curl -fsSL https://raw.githubusercontent.com/HerobrickHD/raspdarts/main/install.sh | bash
```

Der Installer richtet Node.js 22 ein, klont nach `~/raspdarts`, baut den Dienst, setzt
den Hostnamen auf `raspdarts` und startet den systemd-Dienst `raspdarts`. Eine alte
Installation des Raspdarts-Backends wird erkannt und ersetzt.

Erneut ausführen aktualisiert. Deinstallieren:

```bash
curl -fsSL https://raw.githubusercontent.com/HerobrickHD/raspdarts/main/install.sh | bash -s -- --uninstall
```

Beamer im Kiosk-Modus (am Pi oder an jedem anderen Gerät im Netz):

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://raspdarts.local:8743/
```

## Extension installieren

```bash
cd extension && bash build.sh
```

- **Chrome:** `chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden“ → `extension/dist/chrome`
- **Firefox (≥ 128):** `about:debugging#/runtime/this-firefox` → „Temporäres Add-on laden“ → `extension/dist/firefox/manifest.json`.
  Falls die Raspdarts-Seite den Pi nicht erreicht: unter `about:addons` → Raspdarts → Berechtigungen den Zugriff auf `raspdarts.local` erlauben.

## Sicherheit

- Jede Anfrage an `/api/*` braucht den Header `X-Raspdarts: 1`. Fremde Webseiten
  können ihn nicht senden; eine Seite im Heimnetz kann den Pi also nicht steuern.
- `/api` nimmt nur Anfragen an `raspdarts.local`, `raspdarts`, `localhost` oder eine
  IP-Adresse an. Das verhindert, dass eine Webseite den Pi per DNS-Rebinding erreicht.
  Wer einen eigenen Hostnamen nutzt, muss ihn in `server/src/http.ts` ergänzen.
- `/ingest` nimmt nur Verbindungen von Browser-Extensions an.
- Root-Rechte hat der Dienst nur für sechs feste Skripte unter
  `/usr/local/lib/raspdarts/`.
- Andere Geräte im Heimnetz können den Header selbst setzen. Eine Kopplung per Code
  gibt es (noch) nicht.

## API

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/` | Beamer-Anzeige (`?display=handy` für ein eigenes Layout) |
| WS | `/ws` | Spielstand für Anzeigen |
| WS | `/ingest` | Spieldaten von der Extension |
| GET | `/api/status` | Systemwerte, Autodarts-Version und -Zustand, Beamer-Verbindung |
| POST | `/api/system/update`, `/api/system/uninstall` | SSE-Stream |
| POST | `/api/system/reboot`, `/api/system/shutdown` | sofort |
| GET/PUT | `/api/layout/:display` | Layout einer Anzeige |

```bash
curl -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/status
```

## Entwicklung

```bash
cd server
npm install
npm run dev                                         # http://localhost:8743/
npm test && npm run typecheck
npm run replay test/fixtures/demo-session.ndjson    # Demo ohne Scheibe
npm run replay data/sessions/<datei>.ndjson --speed 4
```

Jede Sitzung wird nach `server/data/sessions/` aufgezeichnet und lässt sich
zurückspielen – so lässt sich die Anzeige am Schreibtisch weiterbauen.

Extension: `cd extension && npm install && npm test`.

## Layout einrichten

Unten links schaltet **Layout** den Bearbeiten-Modus ein: Bausteine ziehen, am blauen
Anfasser skalieren, gespeichert wird automatisch pro Anzeige unter
`server/data/layouts/<name>.json`. Positionen sind Prozentwerte und passen deshalb bei
jeder Beamer-Auflösung.

## Hinweis

Inoffiziell. Autodarts kann sein Datenformat jederzeit ändern – dann ist nur
`server/src/beamer/game-state.ts` betroffen. Siehe `docs/protocol.md`.

## Lizenz

MIT
