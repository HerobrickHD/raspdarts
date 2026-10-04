# Autodarts-Protokoll

Autodarts veroeffentlicht keine offizielle API-Dokumentation. Was hier steht, ist
teils am lebenden System geprueft, teils aus Community-Quellen rekonstruiert. Die
Abschnitte sind entsprechend getrennt.

## Woher die Daten kommen

Seit der Zusammenführung zu Raspdarts meldet sich der Pi nicht mehr selbst bei
Autodarts an. Die Extension liest auf play.autodarts.com jede eingehende
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

## Geprüft - Aufzeichnung vom 2026-10-04

Geprüft an einem Leg X01/501 (ein Spieler) auf play.autodarts.com, das die
Extension mitgeschnitten hat. Alle Spielstände wurden von `game-state.ts` ohne
Änderung richtig übersetzt, inklusive Bust und Spielende.

### Rahmen

Jede Nachricht hat die Form `{ channel, topic, data }`. Mitgeschnitten wurden:

| `channel` | `topic` | Inhalt |
|---|---|---|
| `autodarts.matches` | `<matchId>.state` | vollständiger Match-Zustand (wird ausgewertet) |
| `autodarts.matches` | `<matchId>.game-events` | `turn_start`, `throw`, `turn_end`, `game_shot` |
| `autodarts.users` | `<userId>.events` | `lobby-enter`, `active-match` |
| `autodarts.lobbies` | `<lobbyId>.events` | Lobby, `start` |
| `autodarts.boards` | `<boardId>.state` | Board-Status (`Started`, `Takeout started` ...) |
| `autodarts.boards.images` | `<boardId>.live?cam=0&warp=true` | Kamerabilder |

Alles außer `<matchId>.state` ergibt IDLE und ändert die Anzeige nicht.

### Match-State-Nachricht (`data`, gekürzt)

```json
{
  "variant": "X01",
  "player": 0,
  "players": [{ "name": "herobrickhd", "boardName": "raspdarts" }],
  "gameScores": [52],
  "scores": [{ "legs": 0, "sets": 0 }],
  "leg": 1,
  "set": 1,
  "round": 7,
  "settings": { "baseScore": 501, "inMode": "Straight", "outMode": "Double" },
  "turns": [{ "throws": [{ "segment": { "name": "T20", "number": 20, "multiplier": 3, "bed": "Triple" },
                           "coords": { "x": 0.12, "y": -0.34 } }] }],
  "turnScore": 0,
  "turnBusted": false,
  "state": { "checkoutGuide": null },
  "winner": -1,
  "finished": false
}
```

- Pro Wurf kommt ein neuer Zustand. `turns` enthält nur die laufende Aufnahme,
  nach `turn_end` ist `throws` leer.
- Bull heißt im Segment `"Bull"` (nicht `"BULL"` wie im Checkout-Vorschlag).
- Bei einem Bust springt `gameScores` auf den Stand vor der Aufnahme zurück,
  `turnBusted` wird `true`.
- Am Spielende: `winner` und `gameWinner` = Index des Siegers,
  `finished: true`, `scores[i].legs` hochgezählt. Danach kommt nichts mehr; die
  Anzeige bleibt beim Sieger, bis das nächste Match Daten liefert.
- `state.checkoutGuide` liefert Autodarts im Checkout-Bereich selbst, als Liste von
  Segmenten wie in `throws` (52 Rest: `S20`, `D16`). Reichen die übrigen Darts
  der Aufnahme nicht mehr, zeigt er schon den Weg für die nächste Aufnahme
  (112 Rest, ein Dart übrig: `T20 S12 D20`). Raspdarts nutzt ihn noch nicht,
  der Vorschlag kommt aus `checkout.ts`.

Die `coords` sind normalisierte Einschlagkoordinaten. Sie werden noch nicht
angezeigt, aber mit aufgezeichnet - sie sind das Material für spätere
Highlight-Features.

**Wenn sich das Format ändert:** nur `server/src/beamer/game-state.ts`
anpassen und das Fixture `server/test/fixtures/demo-session.ndjson` durch einen
Ausschnitt einer neuen Aufzeichnung ersetzen. Server und Anzeige bleiben
unberührt, weil dazwischen der `ScoreboardState` als Vertrag steht.
