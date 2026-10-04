# Autodarts-Protokoll

Autodarts veroeffentlicht keine offizielle API-Dokumentation. Was hier steht, ist
teils am lebenden System geprueft, teils aus Community-Quellen rekonstruiert. Die
Abschnitte sind entsprechend getrennt.

## Woher die Daten kommen

Seit der Zusammenführung zu Raspdarts meldet sich der Pi nicht mehr selbst bei
Autodarts an. Die Extension liest auf play.autodarts.io jede eingehende
Textnachricht von WebSocket-Verbindungen zu `autodarts.io`/`autodarts.com` mit
und schickt sie unverändert an `ws://raspdarts.local:8743/ingest`. Welche
Kanäle die Seite abonniert, entscheidet die Seite selbst.

Damit entfällt alles rund um OAuth, Client-ID und Tickets. Zur Einordnung, falls
es später gebraucht wird: Autodarts hat im Herbst 2026 von Keycloak auf ein
eigenes OAuth 2.0 unter `api.autodarts.com` umgestellt und den Passwort-Login
gestrichen.

### Quellen zur OAuth-Umstellung

- Migrationsleitfaden von lloydowen (Autodarts), Gist:
  https://gist.github.com/lloydowen/960079f2b518f6f5d68e160465298964
  (gefunden ueber https://github.com/Dennis-Otto/HACSAutodarts)
- Discovery-Dokument: https://api.autodarts.com/.well-known/openid-configuration

## REST-Endpunkte der Anwendung

| Zweck | Endpunkt |
|---|---|
| Boards des Kontos | `GET /bs/v0/boards` |
| Board-Zustand | `GET /bs/v0/boards/{boardId}/state` |
| Match-Zustand | `GET /gs/v0/matches/{matchId}/state` |
| Match-Statistik | `GET /as/v0/matches/{matchId}/stats` |
| WebSocket-Ticket | `POST /ms/v0/ticket` |

`GET /bs/v0/boards` antwortet ohne Token mit 401 - der Pfad stimmt also.

### Lokaler Board-Manager

`ws://<pi>:3180/api/events` liefert Kamera- und Board-Ereignisse, aber **keinen
Spielstand**. Der Cloud-WebSocket ist daher nicht optional.

## Angenommen - noch zu verifizieren

Diese Punkte sind implementiert, aber noch nicht gegen echten Verkehr geprueft.
Geprüft wird das mit der ersten echten Aufzeichnung unter `server/data/sessions/`.

### WebSocket

```
wss://api.autodarts.com/ms/v0/subscribe?ticket=<ticket>
```

### Match-State-Nachricht

```json
{
  "variant": "X01",
  "player": 0,
  "players": [{ "name": "Arnold" }, { "name": "Marcus" }],
  "gameScores": [121, 284],
  "scores": [{ "legs": 2 }, { "legs": 1 }],
  "leg": 4,
  "settings": { "baseScore": 501 },
  "turns": [{ "throws": [{ "segment": { "name": "T20", "number": 20, "multiplier": 3 },
                           "coords": { "x": 0.12, "y": -0.34 } }] }],
  "winner": -1
}
```

Die `coords` sind normalisierte Einschlagkoordinaten. Sie werden von v1 noch nicht
angezeigt, aber von Anfang an mit aufgezeichnet - sie sind das Material fuer die
spaeteren Highlight-Features.

**Wenn die echte Struktur abweicht:** nur `server/src/beamer/game-state.ts`
anpassen und das Fixture `server/test/fixtures/demo-session.ndjson` durch einen
Ausschnitt der echten Aufzeichnung ersetzen. Server und Anzeige bleiben
unberührt, weil dazwischen der `ScoreboardState` als Vertrag steht.
