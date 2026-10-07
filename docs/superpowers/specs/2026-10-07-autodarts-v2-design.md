# Raspdarts für Autodarts v2

Stand: 7. Oktober 2026

## Ziel

Autodarts hat am 7. Oktober 2026 den headless Client v2 veröffentlicht. Er wird
mit dem offiziellen Befehl als normaler Nutzer installiert, läuft als
Nutzer-Dienst, aktualisiert sich selbst und wird über die Terminal-App `ad`
verwaltet. Den Board-Manager im Browser (Port 3180) gibt es nicht mehr.

Raspdarts installiert, aktualisiert und entfernt Autodarts deshalb nicht mehr
selbst, sondern **zeigt nur noch an**: welche Version installiert ist und ob
die Scheibe läuft. Ist Autodarts nicht installiert, zeigt die Raspdarts-Seite
den offiziellen Befehl zum Kopieren.

**Annahme:** Wer Raspdarts installiert, hat Autodarts v2 schon (oder holt es
mit dem angezeigten Befehl). Raspdarts unterstützt v1 nicht mehr. Der einzige
Pi mit Raspdarts und früherem v1 ist Arnolds; er ist seit dem 7. Oktober auf
v2 umgestellt und wird einmalig von Hand aufgeräumt (siehe unten).

**Fertig heißt:** Die Raspdarts-Seite zeigt auf Arnolds Pi „Autodarts 2.0.2 ·
Läuft“. Stoppt man den Autodarts-Dienst, zeigt sie spätestens nach der
nächsten Abfrage „Keine Antwort“. Es gibt keine Knöpfe mehr, die Autodarts
verändern.

**Nicht im Umfang:** Umstieg von v1, Board-Verwaltung (Kameras, Kalibrierung,
Einstellungen – eigenes Teilprojekt B), Aktualisieren von Autodarts.

## Was v2 bereitstellt (geprüft am 7. Oktober 2026, v2.0.2)

- Programm: `~/.local/share/autodarts/autodarts`, Befehl als Symlink
  `~/.local/bin/autodarts` (und `ad`).
- `autodarts --version` gibt `autodarts v2.0.2 (vision 2.0.0)` aus; der
  vorhandene `parseVersion` liest daraus `2.0.2`.
- HTTP-Schnittstelle der Scheibe auf Port 3180, ohne Anmeldung im Heimnetz.
  `GET /api/state` liefert z. B.
  `{"connected":true,"event":"Started","numThrows":0,"running":true,"status":"Throw"}`.
  - `running`: die Erkennung läuft
  - `connected`: Verbindung zum Autodarts-Server steht
- `GET /api/config` liefert auch den API-Key des Boards. Raspdarts ruft diesen
  Endpunkt nicht auf.

## Pi-Dienst (`server/`)

### Entfällt

- Endpunkte `POST /api/autodarts/install` und `POST /api/autodarts/uninstall`
  (Einträge in `JOB_ROUTES`, `server/src/http.ts`).
- Skripte `server/scripts/autodarts-install.sh` und
  `server/scripts/autodarts-uninstall.sh`.
- Beide Namen in `SUDO_SCRIPTS` (`server/scripts/setup-root.sh`) und damit in
  `/etc/sudoers.d/raspdarts`.
- Tests, die diese Endpunkte und Skripte verwenden (`server/test/jobs.test.ts`),
  werden auf ein verbleibendes Skript (`raspdarts-update.sh`) umgestellt.

### Versionserkennung

`autodartsCandidates` liefert nur noch `${home}/.local/bin/autodarts`. Die
v1-Orte (`/usr/local/bin/autodarts`, `autodarts` im PATH,
`~/.local/opt/autodarts/autodarts`, `~/.autodarts/autodarts`) entfallen.
Fehlt das Programm oder liefert es keine Version, bleibt `autodarts_version`
wie bisher `"unknown"`.

### Zustand der Scheibe

`SystemStatus` bekommt ein Feld

```ts
autodarts_board: { running: boolean; connected: boolean; status: string } | null;
```

- Quelle: `GET http://127.0.0.1:3180/api/state`, Zeitlimit 1,5 s.
- `null`, wenn die Anfrage scheitert (keine Verbindung, Zeitlimit, HTTP-Fehler,
  kein JSON) oder `running` bzw. `connected` keine Booleans sind. `status`
  wird übernommen, wenn es ein String ist, sonst `""`.
- Der Zugriff läuft über eine neue Abhängigkeit in `StatusDeps`
  (`fetchJson(url, timeoutMs)`), damit die Auswertung ohne Pi testbar bleibt.
- Die Abfrage läuft parallel zu den übrigen Werten und verlängert
  `/api/status` höchstens um das Zeitlimit.

## Extension, Karte „Autodarts“

### Entfällt

- Knöpfe „Autodarts installieren/aktualisieren“, „Monitor öffnen“ und
  „Deinstallieren“ samt Dialogtexten.
- Aktionen `installAutodarts`, `updateAutodarts`, `uninstallAutodarts` in
  `ACTIONS` (`view-model.js`) und ihre Texte in `texts.js`.
- `monitorUrl`, `showMonitor`, `canUninstall`, `mainAction`, `mainLabel` im
  View-Model.

### Anzeige

Zwei Zeilen wie bisher, die zweite heißt jetzt **Zustand**:

| Fall | Version | Zustand |
|---|---|---|
| Pi nicht erreichbar oder lädt | `--` | `--` (Karten wie bisher ausgeblendet bzw. leer) |
| Autodarts nicht installiert (`autodarts_version === "unknown"` und `autodarts_board === null`) | `--` | ⚪ Nicht installiert, dazu der Installationskasten |
| Version unbekannt, Scheibe antwortet (z. B. für einen anderen Benutzer installiert) | `--` | Zustand wie unten, kein Installationskasten |
| installiert, `autodarts_board === null` | Version | ⚪ Keine Antwort |
| `running && connected` | Version | 🟢 Läuft |
| `running && !connected` | Version | 🔴 Nicht mit Autodarts verbunden |
| `!running` | Version | ⚪ Gestoppt |

Farben: grün `--color-green-50`, rot `--color-red-50`, grau `--color-black-50`
(wie die übrigen Statuspunkte).

### Installationskasten

Nur sichtbar, wenn Autodarts nicht installiert ist:

- Ein Satz: „Autodarts ist auf dem Pi nicht installiert. Führe diesen Befehl per
  SSH auf dem Pi aus und schalte danach in `ad` unter „Service“ den Dienst ein.“
- Der Befehl in Monospace in einem dunklen Kasten (Stil wie das Protokoll):
  `curl -fsSL autodarts.sh | bash -s -- --headless`
- Knopf „Kopieren“ (`navigator.clipboard.writeText`); danach steht 2 s lang
  „Kopiert“ auf dem Knopf. Scheitert das Kopieren, bleibt der Text markierbar.

Texte auf Deutsch und Englisch wie bisher in `texts.js`.

## Einmalig von Hand auf Arnolds Pi

Nach dem Ausrollen des Umbaus:

- `/usr/local/lib/raspdarts/autodarts-install.sh` und
  `autodarts-uninstall.sh` löschen.
- `/root/.local/opt/autodarts` löschen (die Sicherung in
  `~/autodarts-v1-backup-20261007-155929` bleibt).
- `tmux` entfernen, falls Arnold es nicht behalten will.

## Tests

- **Server (Vitest):**
  - Versionserkennung fragt nur `~/.local/bin/autodarts`.
  - `autodarts_board`: gültige Antwort; Verbindungsfehler → `null`; Zeitlimit
    → `null`; kein JSON → `null`; `running`/`connected` keine Booleans → `null`;
    fehlender `status` → `""`.
  - Die entfernten Endpunkte antworten mit 404.
- **Extension (Vitest):** alle sechs Fälle der Tabelle oben; Installationskasten
  nur bei „nicht installiert“; keine Autodarts-Aktionen mehr in `ACTIONS`.
- **Am Pi:** nach dem Raspdarts-Update zeigt die Seite „2.0.2 · Läuft“;
  `systemctl --user stop autodarts` → „Keine Antwort“; wieder starten → „Läuft“.
- **Doku:** README (API-Tabelle, Beschreibung der Pi-Verwaltung) anpassen.
