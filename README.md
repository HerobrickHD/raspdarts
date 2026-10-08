# Raspdarts

Alles rund um die Autodarts-Scheibe am Raspberry Pi – in einem Repo:

- **Pi-Verwaltung** direkt aus play.autodarts.com: CPU, RAM, Temperatur, Version und
  Zustand von Autodarts, Raspdarts aktualisieren, Pi neu starten oder herunterfahren.
- **Viewer**: die Spielansicht im Stil von Autodarts auf schwarzem Grund – für einen
  Beamer, der direkt auf die Scheibe projiziert (Treffer leuchten auf den echten
  Feldern), oder für jeden anderen Bildschirm.

## Aufbau

```
play.autodarts.com (Laptop)
  └─ Raspdarts-Extension ── liest den Spielstand mit ──┐
                          └─ Seite: Status, Updates ───┤
                                                       ▼
Raspberry Pi 5 ── raspdarts (ein Dienst, Port 8743) ── Viewer: http://raspdarts.local:8743/
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
deshalb keine Autodarts-Zugangsdaten. Der Viewer zeigt nur etwas an, solange ein Tab
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

Viewer im Kiosk-Modus (am Pi oder an jedem anderen Gerät im Netz), z. B. für den Beamer:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars "http://raspdarts.local:8743/?display=beamer"
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
| GET | `/` | Viewer (`?display=beamer` für ein eigenes Layout, sonst `standard`) |
| WS | `/ws?display=<name>` | Viewer: `{type:"state", state}` und `{type:"layout", layout, editing}` |
| WS | `/ingest` | Spieldaten von der Extension |
| GET | `/api/status` | Systemwerte, Autodarts-Version und -Zustand, Beamer-Verbindung |
| POST | `/api/system/update`, `/api/system/uninstall` | SSE-Stream |
| POST | `/api/system/reboot`, `/api/system/shutdown` | sofort |
| GET | `/api/layout/:display` | Layout einer Anzeige |
| PUT | `/api/layout/:display` | `{layout, editing}` speichern und live an alle Viewer der Anzeige |

```bash
curl -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/status
```

## Entwicklung

```bash
cd server
npm install
npm run dev                                         # http://localhost:8743/
npm test && npm run typecheck
npm run replay test/fixtures/autodarts-2026-10-08.ndjson --instant --stop 139   # Mitschnitt bis Zeile 139
npm run replay data/sessions/<datei>.ndjson --speed 4
```

Jede Sitzung wird nach `server/data/sessions/` aufgezeichnet und lässt sich
zurückspielen – so lässt sich die Anzeige am Schreibtisch weiterbauen.

Extension: `cd extension && npm install && npm test`.

## Layout einrichten

Den Viewer am Laptop mit demselben Anzeigenamen öffnen wie am Beamer
(`?display=beamer`). Bei Mausbewegung erscheint unten rechts **Layout**; damit
startet der Bearbeiten-Modus. Alle Geräte mit diesem Namen folgen live, der Beamer
zeigt die Scheibe dabei als Linien – so lässt sie sich auf die echten Drähte legen.

- Scheibe: ziehen = verschieben, Ecke oder Mausrad = Größe, Kreis = drehen;
  fein mit Pfeiltasten, +/− und Q/E (mit Umschalt grob).
- Karten, Kopf, Aufnahmeleiste: ziehen und an der Ecke skalieren.
- „Nur Licht“ (nur Darts und Hervorhebungen, für die Projektion auf die Scheibe)
  oder „Gezeichnet“ (ganze Scheibe). Esc beendet.

Gespeichert wird automatisch unter `server/data/layouts/<name>.json`. Positionen
sind Prozentwerte, Größen hängen an der Bildhöhe – das Layout passt bei jeder
Auflösung.

## Hinweis

Inoffiziell. Autodarts kann sein Datenformat jederzeit ändern – dann ist nur
`server/src/viewer/game-state.ts` betroffen. Siehe `docs/protocol.md`.

## Lizenz

MIT
