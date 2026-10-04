# Autodarts-Protokoll

Autodarts veroeffentlicht keine offizielle API-Dokumentation. Was hier steht, ist
teils am lebenden System geprueft, teils aus Community-Quellen rekonstruiert. Die
Abschnitte sind entsprechend getrennt.

## Wichtig: Umstellung auf OAuth 2.0

Autodarts hat die Anmeldung von Keycloak auf ein eigenes OAuth-2.0-System
umgestellt und dabei die Domain auf **autodarts.com** gewechselt.

- `login.autodarts.io` ist abgeschaltet (antwortet mit Cloudflare 522)
- Der Passwort-Grant (`grant_type=password`) wird nicht mehr unterstuetzt
- Die alte Client-ID `autodarts-app` wird mit `invalid_client` abgewiesen
- Kanonischer Host laut Discovery-Dokument: `api.autodarts.com`

Aeltere Community-Projekte (darts-caller, python-autodarts, AutodartsClient)
zeigen noch den alten Ablauf. Der funktioniert nicht mehr.

### Quellen

- Migrationsleitfaden von lloydowen (Autodarts), Gist:
  https://gist.github.com/lloydowen/960079f2b518f6f5d68e160465298964
  Nicht aus der offiziellen Doku verlinkt - gefunden ueber das Home-Assistant-
  Projekt https://github.com/Dennis-Otto/HACSAutodarts, das dieselbe Umstellung
  macht. Jeder uebernommene Punkt wurde zusaetzlich am lebenden Server geprueft.
- Discovery-Dokument: https://api.autodarts.com/.well-known/openid-configuration

## Geprueft (am lebenden System, Stand 2026-09-20)

### Discovery

```
GET https://api.autodarts.com/.well-known/openid-configuration
```

Antwortet mit:

```json
{
  "issuer": "https://api.autodarts.com/auth",
  "device_authorization_endpoint": "https://api.autodarts.com/auth/v1/device/code",
  "token_endpoint": "https://api.autodarts.com/auth/v1/exchange",
  "authorization_endpoint": "https://api.autodarts.com/auth/v1/oauth/authorize",
  "userinfo_endpoint": "https://api.autodarts.com/auth/v1/userinfo",
  "grant_types_supported": ["authorization_code", "client_credentials",
                            "urn:ietf:params:oauth:grant-type:device_code",
                            "password", "otp", "refresh_token"],
  "code_challenge_methods_supported": ["S256"]
}
```

### Endpunkte der Anmeldung

| Zweck | Endpunkt |
|---|---|
| Geraetecode anfordern | `POST /auth/v1/device/code` |
| Auf Freigabe warten | `POST /auth/v1/device/token` |
| Token erneuern | `POST /auth/v1/refresh` |
| Autorisierung (Browser) | `GET /auth/v1/oauth/authorize` |
| Code eintauschen | `POST /auth/v1/exchange` |
| Client Credentials | `POST /auth/v1/token` |
| Benutzerprofil | `GET /auth/v1/userinfo` |

Alle Anfragen mit `Content-Type: application/json`, nicht formularkodiert.

### Client-ID wird geprueft

```
POST /auth/v1/device/code  {"client_id":"autodarts-app","scope":"openid profile email"}
-> HTTP 400 {"error":"invalid_client","error_description":"unknown client_id"}
```

Ohne registrierte Client-ID geht nichts. Siehe README, Abschnitt "Anmeldung".

## Der Geraete-Ablauf (in diesem Projekt verwendet)

Passend fuer einen Dienst auf dem Pi: kein Browser, kein Redirect-URI, kein
Passwort in der Konfiguration.

**1. Code anfordern**

```
POST /auth/v1/device/code
{"client_id": "...", "scope": "openid profile email"}
```

```json
{
  "device_code": "...",
  "user_code": "WDJB-MJHT",
  "verification_uri": "https://auth.autodarts.io/link",
  "verification_uri_complete": "https://auth.autodarts.io/link?user_code=WDJB-MJHT",
  "expires_in": 600,
  "interval": 5
}
```

**2. Benutzer gibt den Code frei**, waehrenddessen wird gepollt:

```
POST /auth/v1/device/token
{"grant_type": "urn:ietf:params:oauth:grant-type:device_code",
 "device_code": "...", "client_id": "..."}
```

Bis zur Freigabe kommt HTTP 400 mit einem dieser Fehler:

| Fehler | Bedeutung |
|---|---|
| `authorization_pending` | weiter warten |
| `slow_down` | Intervall um 5 s erhoehen |
| `access_denied` | Benutzer hat abgelehnt |
| `expired_token` | Code abgelaufen, neu beginnen |

**3. Tokens**: Access-Token 15 Minuten, Refresh-Token 30 Tage.

**Jede Erneuerung gibt ein neues Refresh-Token aus.** Wird das alte behalten,
fliegt man beim naechsten Start raus - deshalb schreibt `token-storage.ts`
sofort nach jedem Austausch.

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
Dafuer ist `npm run discover` da.

### WebSocket

```
wss://api.autodarts.com/ms/v0/subscribe?ticket=<ticket>
```

### Subscribe-Nachricht

```json
{ "channel": "autodarts.boards",  "type": "subscribe", "topic": "<boardId>.matches" }
{ "channel": "autodarts.matches", "type": "subscribe", "topic": "<matchId>.state" }
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

**Wenn die echte Struktur abweicht:** nur `src/game-state.ts` (Feldnamen) und
`src/autodarts-client.ts` (Subscribe-Format) anpassen. Server und Anzeige bleiben
unberuehrt, weil dazwischen der `ScoreboardState` als Vertrag steht.
