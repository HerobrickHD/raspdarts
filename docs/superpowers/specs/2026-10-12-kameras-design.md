# Kamerabilder auf der Boards-Seite

Stand: 12. Oktober 2026

## Ziel

Auf `play.autodarts.com/boards` bekommt die Karte des Raspdarts-Boards einen
zusätzlichen Knopf mit Kamera-Symbol direkt hinter „Kalibrieren“. Ein Klick
öffnet ein Fenster über der Seite mit den Bildern aller Kameras, die sich etwa
einmal pro Sekunde erneuern. Zweck: schnell prüfen, ob die Kameras richtig
sitzen und scharf sind oder ob ein Dart erkannt wurde.

**Wichtigste Anforderung:** Das Abgreifen der Bilder darf Autodarts nicht
stören.

**Fertig heißt:** Arnold sieht auf seiner Board-Karte den Kamera-Knopf. Läuft
das Board nicht, ist der Knopf ausgegraut. Läuft es, öffnet ein Klick das
Fenster mit den drei Kamerabildern; X, Esc oder ein Klick daneben schließt es.
Eine Messung am Pi zeigt, dass Autodarts' Bildrate gleich bleibt und Autodarts
höchstens eine Bildanfrage pro Sekunde und Kamera bekommt – auch bei zwei
offenen Fenstern.

**Nicht im Umfang:** Livestream (MJPEG), Erkennungs- oder Bewegungsbilder,
Bilder drehen oder vergrößern, Autodarts starten oder stoppen, Knopf auf
anderen Seiten als `/boards`.

## Warum das Autodarts nicht stört

- Raspdarts öffnet die Kameras **nie selbst**. Autodarts belegt sie exklusiv;
  ein zweiter Zugriff könnte die Erkennung abbrechen. Stattdessen liefert
  Autodarts die Bilder über seine lokale Schnittstelle
  `GET 127.0.0.1:3180/api/img/cams/<n>` (siehe
  `docs/autodarts-v2-board-api.md`): das zuletzt aufgenommene Bild als JPEG
  1280×720, ca. 90–100 KB.
- Kosten für Autodarts: ein JPEG-Kodieren je Anfrage. Der Raspdarts-Server
  bremst zentral auf höchstens eine Anfrage pro Sekunde und Kamera, egal wie
  viele Browser zuschauen.
- Im Standby (`running:false`) sind die Kameras geschlossen und Autodarts
  liefert nur schwarze Bilder. Dann fragt der Server gar nicht nach Bildern.
- Vormessung am 12.10. (Board läuft, je 10 s): ohne Abruf CPU von Autodarts
  81–94 % (Ø ≈ 84 %), 30–31 fps; mit Abruf aller 3 Kameras je 1×/s 80–99 %
  (Ø ≈ 87 %), 30–31 fps. Bildrate unverändert, CPU-Unterschied im Rauschen.
- **Abnahme-Messung am 12.10.** (ausgerollter Stand `92a8617` auf dem Pi, Board
  läuft, je 60 s, `/api/state/stats` jede Sekunde):

  | Durchgang | CPU Autodarts Ø | fps Ø (min) | Bildabrufe bei Autodarts |
  |---|---|---|---|
  | ohne Fenster | 86,6 % | 30,6 (30) | 0 |
  | ein Fenster | 86,4 % | 30,5 (30) | 166 |
  | zwei Fenster | 88,3 % | 30,5 (30) | 178 |

  Bestanden: Bildrate unverändert, Bildabrufe unter der Grenze von 183
  (60 s × 3 Kameras + 3); ohne Bremse wären es mit zwei Fenstern ≈ 260
  gewesen. Beobachtet nebenbei: Autodarts' Standby nach 15 Minuten ohne Wurf
  greift auch bei offenem Kamerafenster – die Bildabrufe halten Autodarts
  nicht wach. Ein verdecktes Chrome-Fenster gilt unter Windows als versteckt;
  das Kamerafenster ruft dann nichts ab.

## Teil 1: Raspdarts-Server

### Neue Datei `server/src/system/cams.ts`

Kapselt den Zugriff auf Autodarts' Bilder samt Bremse. Abhängigkeiten
(Abruf, Uhr) werden hineingereicht, damit Tests ein nachgemachtes Autodarts
und eine künstliche Uhr nutzen können.

- **`info()`** → `{ board_id: string | null, cams: number }`.
  Liest `GET <AUTODARTS_URL>/api/config` und nimmt daraus nur
  `auth.board_id` und die Anzahl nicht-leerer Einträge in `cam.cams`.
  **Die Config enthält den API-Key; sie wird nie weitergegeben**, auch nicht
  in Fehlermeldungen. Ergebnis 30 s zwischengespeichert.
- **`image(n)`** → JPEG-Bytes oder ein Fehlergrund:
  1. `n` muss eine ganze Zahl in `0 … cams-1` sein, sonst `not-found`.
  2. Board-Zustand über `GET /api/state`, 1 s zwischengespeichert. Bei
     `running:false` → `board-stopped`, **ohne** ein Bild anzufragen.
  3. Bild über `GET /api/img/cams/<n>`, je Kamera 1 s zwischengespeichert.
     Kommen Anfragen, während ein Abruf läuft, warten sie auf denselben
     Abruf (kein zweiter Abruf bei Autodarts).
  4. Antwortet Autodarts nicht binnen 2 s oder mit einem Fehler →
     `unavailable`. Auch dieses Ergebnis gilt 1 s lang, damit Fehler nicht
     öfter als einmal pro Sekunde und Kamera wiederholt werden.
- **Zähler:** `cams.ts` zählt die Bildabrufe bei Autodarts seit dem Start
  (für die Abnahme-Messung).

### Einstellung `AUTODARTS_URL`

`config.ts` bekommt `autodartsUrl` aus der Umgebungsvariable `AUTODARTS_URL`,
Vorgabe `http://127.0.0.1:3180`. `cams.ts` nutzt sie. (So kann der Server zum
Testen unter Windows laufen und die echten Bilder vom Pi holen.) Der
bestehende Zugriff in `status.ts` bleibt unverändert.

### Neue Pfade in `server/src/http.ts`

Beide verlangen wie alle `/api`-Pfade den Header `X-Raspdarts: 1` und einen
erlaubten Host.

| Pfad | Antwort |
|---|---|
| `GET /api/cams` | `200 {"board_id":"…","cams":3,"fetched":1234}` (`fetched` = Zähler der Bildabrufe bei Autodarts); Autodarts nicht erreichbar → `502 {"error":"unavailable"}` |
| `GET /api/cams/:n` | `200` `image/jpeg`, `Cache-Control: no-store`; `404 {"error":"not-found"}`; `409 {"error":"board-stopped"}`; `502 {"error":"unavailable"}` |

## Teil 2: Extension

### Neue Dateien

- **`src/cams-view.js`** – reine Logik ohne DOM, mit Tests:
  - Abzeichen-Text der Karte → Knopf-Zustand: klickbar nur bei genau
    `Running`; sonst ausgegraut. Hinweistext „Kameras“ bzw. „Kameras – Board
    ist nicht gestartet“.
  - Serverantworten einer Runde → Fensterinhalt: Bilder; „Board ist nicht
    gestartet“ (bei `409`); je Kamera „Kein Bild“ mit abgedunkeltem letztem
    Bild (bei `502`, `404` oder Pi nicht erreichbar).
- **`src/cams.js`** – Knopf, Fenster, Abrufe. Läuft als weiteres
  Content-Script auf `play.autodarts.com` (nach `texts.js` und
  `cams-view.js`). `content.js` bleibt unverändert, damit das Feature auch
  bleibt, wenn der Navigationseintrag „Raspdarts“ später wegfällt.

### Knopf

- Nur auf `/boards` (die App wechselt Seiten ohne Neuladen; ein
  `MutationObserver` erkennt Adresswechsel und neu aufgebaute Karten).
- Beim Betreten von `/boards` einmal `GET /api/cams` über den Background-Teil.
  Ohne Antwort oder ohne `board_id` erscheint kein Knopf.
- Die Karte des Raspdarts-Boards ist die mit dem Link
  `a[href="/boards/<board_id>/follow"]`. Andere Karten bleiben unberührt.
- Platz: in der linken Knopfgruppe der Karte direkt hinter dem zweiten Knopf
  („Kalibrieren“), also vor „Board Manager“. Erkannt an der Position, nicht
  am Text (Autodarts gibt es auch auf Englisch). Passt der Aufbau nicht, ans
  Ende der Gruppe.
- Aussehen: Klassen des Kalibrieren-Knopfs übernehmen, eigenes
  Kamera-Symbol (SVG). Ausgegraut über das `disabled`-Attribut; Autodarts'
  Klassen färben ihn dann wie andere deaktivierte Knöpfe.
- Zustand: aus dem Status-Abzeichen der Karte („Running“, „Stopped“,
  „Starting“ – auch bei deutscher Oberfläche englisch). Keine Abfrage beim
  Pi; der Knopf schaltet mit, sobald Autodarts das Abzeichen ändert.
  Weicht das Abzeichen vom echten Zustand ab, fängt der Server das mit `409`
  ab.

### Fenster

- Eigenes Element am Ende von `body`, Inhalt in einem Shadow DOM (wie die
  Raspdarts-Seite), damit Autodarts' CSS nicht hineinwirkt.
- Abgedunkelter Hintergrund, dunkles Fenster im Autodarts-Stil, Titel
  „Kameras – <Board-Name von der Karte>“, X-Knopf. Kameras nebeneinander, bei
  schmalem Fenster untereinander. Bilder unverändert (so gedreht, wie die
  Kamera hängt).
- Schließen mit X, Esc oder Klick auf den Hintergrund. Beim Öffnen wird
  `/api/cams` neu geholt (Kameraanzahl).
- Abrufe: eine Runde holt alle Kameras nacheinander über den Background-Teil;
  die nächste Runde startet 1 s nach dem Ende der vorigen (kein Stau bei
  langsamem WLAN). Kein Abruf, solange das Fenster zu oder der Tab
  versteckt ist (`document.hidden`).

### Background (`src/background.js`)

Neuer Nachrichtentyp `image`: holt `BASE_URL + /api/cams/<n>` mit dem
`X-Raspdarts`-Header und antwortet mit `{ ok, status, dataUrl }` (JPEG als
Base64-Daten-URL) bzw. `{ ok:false, status, error }`. Keine neue
Berechtigung nötig.

### Texte (`src/texts.js`)

Deutsch und Englisch: Hinweis „Kameras“, „Kameras – Board ist nicht
gestartet“, Fenstertitel „Kameras“, „Board ist nicht gestartet“, „Kein Bild“,
„Schließen“, „Kamera <n>“.

## Teil 3: Testen und Ausrollen

### Automatische Tests

- Server (`cams.test.ts`, `http.test.ts`): mehrere Anfragen binnen 1 s → ein
  Abruf; gleichzeitige Anfragen teilen einen Abruf; nach 1 s neuer Abruf;
  `running:false` → `409` ohne Bildabruf; Zeitüberschreitung → `502`; falsche
  Kamera-Nummer → `404`; ohne Header → `403`; `api_key` taucht nie in einer
  Antwort von `/api/cams` auf.
- Extension (`cams-view.test.js`): Abzeichen → Knopf-Zustand und Hinweis;
  Serverantworten → Fensterinhalt.

### Ausprobieren

Server lokal unter Windows mit `AUTODARTS_URL=http://raspdarts.local:3180`,
Extension im Test-Chrome (Shim-Umweg, Arnolds Konto). Prüfen auf der echten
Karte: Platz des Knopfs, Ausgrauen bei „Stopped“, Fenster, Esc, Klick
daneben, „Kein Bild“ und „Board ist nicht gestartet“.

### Ausrollen

Auf Arnolds Entscheidung vom 12.10. kommt der Viewer (bisher nur lokal in
`main`, nicht abgenommen) mit auf den Pi: `git push`, dann Update über die
Raspdarts-Seite. Der Viewer stört nicht, solange niemand `?display=beamer`
öffnet.

### Abnahme-Messung am Pi

Je 60 s ohne Fenster, mit einem offenen Fenster und mit zwei offenen Fenstern;
dabei `GET /api/state/stats` (cpuPercent, fps) jede Sekunde mitlesen.
Bestanden, wenn die Bildrate gleich bleibt und Autodarts nachweislich höchstens
eine Bildanfrage pro Sekunde und Kamera bekommt: Zuwachs von `fetched` in
`GET /api/cams` über die 60 s höchstens 60 × Kameraanzahl (plus eins je
Kamera für die Ränder).
