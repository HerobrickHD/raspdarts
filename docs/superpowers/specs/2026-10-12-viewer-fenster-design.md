# Viewer-Knopf statt Board Manager, Raspdarts-Seite ins Fenster

Stand: 12. Oktober 2026

## Ziel

Auf `play.autodarts.com/boards` ersetzt auf der Karte des Raspdarts-Boards
ein eigener **Viewer-Knopf** den Knopf „Board Manager“ (unter Autodarts v2
ohne Funktion: öffnet nur „Board Manager is no longer supported“). Ein Klick
öffnet ein Fenster wie beim Kamera-Knopf. Darin: ein Schalter, ob die
Extension Spieldaten an den Pi weitergibt, und alles, was bisher auf der
Raspdarts-Seite war. Der Eintrag „Raspdarts“ in Autodarts' Hauptnavigation
fällt samt eigener Seite weg.

Zweck des Schalters (Arnold, 12.10.): wenn ohne Beamer/Viewer gespielt wird,
soll nichts unnötig an den Pi gehen; und die Spieldaten sollen den Browser
nicht verlassen, wenn Arnold das nicht will.

**Fertig heißt:** Auf Arnolds Karte stehen links Starten/Stoppen,
Kalibrieren, Kameras, Viewer; „Board Manager“ ist weg. Der Viewer-Knopf zeigt
an, ob die Weitergabe an oder aus ist, und öffnet das Fenster. Schaltet Arnold
dort aus, hat die Extension keine Verbindung mehr zum Pi und der Viewer zeigt
„Warte auf Spieldaten …“; schaltet er an, kommt der Spielstand mit dem
nächsten Autodarts-Ereignis zurück. Der Zustand bleibt nach Neuladen
erhalten. Werte, Versionen, Aktualisieren, Neu starten, Herunterfahren und
Deinstallieren funktionieren im Fenster wie bisher auf der Seite. In der
Navigation gibt es keinen Eintrag „Raspdarts“ mehr.

**Nicht im Umfang:** den Beamer oder Kiosk-Browser selbst ausschalten,
Schalter auf dem Pi (gilt für alle Browser), Umbenennen des Felds `beamer` in
`/api/status`, neue Funktionen im Fenster, die zurückgestellten Kleinigkeiten
des Kamera-Features.

## Teil 1: Weitergabe an/aus

- **Ort des Schalters:** in der Extension, je Browser, gespeichert in
  `chrome.storage.local` unter `forwardGameData` (Boolean). Fehlt der Wert,
  gilt **an** (bisheriges Verhalten).
- **Aus:**
  - `bridge.js` verwirft die von `page-hook.js` mitgelesenen Nachrichten und
    trennt den Port `raspdarts-ingest`. Der Background baut die
    WebSocket-Verbindung zu `/ingest` ab, sobald kein Port mehr offen ist
    (besteht schon). Es gehen keine Spieldaten mehr an den Pi.
  - `page-hook.js` liest weiter innerhalb der Seite mit (es läuft vor jedem
    Speicherzugriff im Seitenkontext); die Nachrichten bleiben in der Seite
    und werden in `bridge.js` verworfen.
  - Der Heartbeat von `bridge.js` (hält den Service-Worker wach) entfällt
    bei „aus“; ohne Verbindung muss nichts wach bleiben.
  - Beim Umschalten auf „aus“ schickt die Extension einmal
    `POST /api/ingest/reset` an den Pi (ohne Spieldaten, über den
    Background-Teil). Antwortet der Pi nicht, ist das kein Fehler.
- **An:** `bridge.js` öffnet den Port wieder, der Background verbindet sich
  neu; mit dem nächsten Autodarts-Ereignis (Autodarts schickt jeweils den
  vollen Stand) zeigt der Viewer wieder das Spiel.
- **Live in allen Tabs:** jede `bridge.js`-Instanz hört auf
  `chrome.storage.onChanged` und schaltet sofort mit.
- **Bewusst kein Zurücksetzen bei Verbindungsabbruch:** bricht die
  Verbindung ohne Ausschalten ab (WLAN), bleibt der Viewer auf dem letzten
  Stand – sonst stünde er mitten im Spiel leer bis zum nächsten Wurf.
- **Folge auf dem Pi:** ohne eingehende Spieldaten zeichnet der Pi auch keine
  Session auf.

## Teil 2: Navigation und Knöpfe

- **Navigation:** Der Eintrag „Raspdarts“ (samt Punkt), die Seite im
  Inhaltsbereich, das Verschieben von Autodarts' Unterstrich und die
  Hintergrundabfrage von `/api/status` alle 30 s entfallen.
- **Gemeinsamer Baustein `src/board-card.js`** (aus `cams.js` herausgelöst):
  - Board-ID des Pi laden (`GET /api/cams`) und in `chrome.storage.local`
    unter `boardId` merken; ist der Pi nicht erreichbar, gilt die gemerkte ID.
  - Karte des Boards finden (Link `/boards/<id>/follow`, Aufbau wie in der
    Kamera-Spec), linke Knopfgruppe, Zustands-Abzeichen, Board-Name.
  - Einen Knopf in der linken Gruppe an einer Position einsetzen und dabei
    die Klassen eines Nachbarknopfs übernehmen.
  - Ein Fenster über der Seite öffnen und schließen (Rahmen, Titel, X, Esc,
    Klick daneben), Inhalt im Shadow DOM.
  - Seitenwechsel beobachten (nur auf `/boards` aktiv).
- **Board Manager ausblenden:** auf der Karte des Pi den letzten
  Autodarts-Knopf der linken Gruppe (erkannt an der Position, nicht am Text)
  per Inline-Style `display: none !important` verstecken (Autodarts' Klassen
  würden `hidden` überstimmen), nicht entfernen. Andere Karten bleiben unberührt.
- **Viewer-Knopf** an dessen Stelle, also hinter dem Kamera-Knopf:
  - an: Aussehen wie die Nachbarn, Symbol Lucide `monitor`, Hinweis
    „Viewer (an)“;
  - aus: grau (Farben wie Autodarts' deaktivierte Knöpfe, aber klickbar),
    Symbol Lucide `monitor-off`, Hinweis „Viewer (aus)“;
  - immer klickbar, unabhängig vom Board-Zustand; schaltet nichts um, sondern
    öffnet das Fenster.
- **Lucide-Symbole** (Kamera, Monitor, Monitor-aus) bekommen einen Kommentar
  mit Herkunft und Lizenz (ISC).

## Teil 3: Viewer-Fenster

- Rahmen aus `board-card.js`, Titel „Raspdarts – <Board-Name>“.
- Inhalt: die bisherige Raspdarts-Seite (`page.html`, `page.css`,
  `page.js`, `view-model.js`, `stream.js`), umgebaut auf das Fenster:
  - **neu oben: Viewer-Block** – Kippschalter „Spieldaten an den Pi senden“
    (an/aus wie Teil 1) und Verbindungszustand aus `/api/status`
    (`beamer.ingest_connected`, `beamer.last_message_at`): „Verbunden –
    letzte Nachricht vor N s“ / „Verbunden – noch keine Nachricht“ / „Nicht
    verbunden“ / bei „aus“: „Weitergabe ausgeschaltet“.
  - darunter unverändert: Pi-Werte (CPU, RAM, Temperatur, Laufzeit), Karte
    Autodarts (Version, Zustand, Installationshinweis), Karte Raspberry Pi
    (Raspdarts-Version, Aktualisieren, Neu starten, Herunterfahren,
    Deinstallieren), Rückfragen, Protokoll.
  - die Zeile „Beamer“ der Pi-Karte entfällt (steht jetzt im Viewer-Block).
- `/api/status` alle 10 s, nur solange das Fenster offen ist; beim Öffnen
  sofort.
- Schließen während eines Updates: das Update läuft weiter; beim
  Wiederöffnen steht das Protokoll da (die Seite wird nur aus- und
  eingehängt, nicht neu gebaut).
- Esc bei offener Rückfrage schließt nur die Rückfrage.
- Pi nicht erreichbar: Hinweis wie bisher; der Viewer-Schalter funktioniert
  trotzdem.
- Texte Deutsch und Englisch; Schlüssel, die nur die Navigation brauchte,
  entfallen.

## Teil 4: Pi

- Neuer Pfad `POST /api/ingest/reset` (Header `X-Raspdarts: 1`, erlaubter
  Host): setzt den Stand aller Viewer auf `idle` („Warte auf Spieldaten …“),
  Antwort `200 {"ok":true}`. Sonst keine Änderung am Pi.

## Testen und Ausrollen

- **Automatisch:**
  - Server: `/api/ingest/reset` setzt alle Viewer auf `idle`; ohne Header
    `403`.
  - Extension (ohne Browser): Viewer-Knopf-Zustand (an/aus → Symbol,
    Hinweis), Viewer-Block (Verbindungstexte), Weitergabe-Entscheidung in
    `bridge.js` (nur bei „an“ senden; fehlender Wert = an), Board-ID-Merken
    (gemerkte ID bei unerreichbarem Pi). Bestehende Tests für `view-model`
    und Texte laufen weiter.
- **Browser** (Test-Chrome, Arnolds Karte): Board Manager weg, Viewer-Knopf
  an seiner Stelle; Fenster mit Viewer-Block und allen Pi-Funktionen;
  Schalter aus → Pi meldet „nicht verbunden“, Viewer zeigt „Warte auf
  Spieldaten …“; an → verbunden; Zustand nach Neuladen erhalten; keine
  „Raspdarts“-Navigation; Kamera-Knopf funktioniert weiter.
- **Ausrollen:** Push, Update auf dem Pi über den Aktualisieren-Knopf im
  neuen Fenster, Arnold lädt die Extension neu.
