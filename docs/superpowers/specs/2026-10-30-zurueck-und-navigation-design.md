# Zurück (Strg+Z) im Viewer · Raspdarts-Knopf in der Navigation

Stand 30.10.2026. Zwei unabhängige Änderungen, nacheinander umzusetzen
(erst Teil 1, dann Teil 2). **Teil 1 wird zuerst allein ausgeliefert**
(Arnold 30.10.): nur Viewer/Pi, eigene Version, Pi per Update-Knopf, keine
neue Extension-ZIP nötig. Teil 2 folgt mit eigener Version und ZIP. Ein dritter Punkt – die Ringmaße der gezeichneten
Scheibe passen nicht ganz auf Arnolds echte Scheibe – ist bewusst geparkt und
kommt danach als eigenes Thema.

## Teil 1 – Zurück und Wiederholen beim Einstellen

### Warum

Der Beamer ist da. Beim Ausrichten verschiebt, vergrößert und verkleinert
Arnold ständig Scheibe, Spielinfo, Aufnahme und Spielerbereiche. Ein
Fehlgriff (falsch gezogen, versehentlich „Zurücksetzen“) lässt sich heute nur
von Hand rückgängig machen. Er will einen Knopf „Zurück“ und Strg+Z.

### Was zurückgeht – „für alles“

Jede Änderung, die das **aktuelle Profil** verändert:

- Lage auf der Bühne (`editor.js`): Ziehen (Verschieben, Größe, Drehen über
  die Griffe), Mausrad auf der Scheibe, Pfeiltasten, Strg+Pfeile, +/−, Q/E.
- Inhalte in der Leiste (`settings.js` → `changeContent`): alle Schalter,
  Auswahlen (Radio) und Kamera-Wahl.
- Format (`onFormat`).
- Name (`onRename`).
- „Zurücksetzen“ (`onReset`, `POST /api/profiles/:id/reset`) – gerade das
  soll man zurücknehmen können.

**Nicht** dabei: Profil wechseln, anlegen, löschen, die Spielerzahl der
Vorschau, Auf-/Zuklappen der Kästen. Das sind keine Änderungen am Profil.
Löschen bleibt mit Rückfrage wie bisher.

### Bedienung

- **Strg+Z** = Zurück, **Strg+Y** und **Strg+Umschalt+Z** = Wiederholen.
  Gilt, solange die Leiste offen ist (`step === "inhalte"`). Nicht, wenn der
  Fokus in einem Textfeld steht (der Namens-Dialog) – dort bleibt das
  Zurück des Browsers. Auch bei offenem Dialog nicht (`isDialogOpen`).
- **Knöpfe „Zurück“ und „Wiederholen“** im Kopf der Leiste (`panel-head` in
  `settings-panel.js`, neben dem ×), im Autodarts-Stil der Leiste, als
  Symbol-Knöpfe mit Hinweis (`title`: „Zurück (Strg+Z)“, „Wiederholen
  (Strg+Y)“). Sind sie ohne Wirkung, sind sie **gesperrt, nicht versteckt** –
  der Kopf springt nicht.
- Zurück wird **ganz normal gespeichert**, als hätte man es von Hand
  zurückgestellt: sofort ins eigene Bild (`applyLocalProfile`), gedrosselt
  über `sync.queue` an den Pi (`PUT /api/profiles/:id` mit den Feldern, die
  sich unterscheiden: `name`, `format`, `content`, `layout`). Der Beamer und
  alle anderen Viewer ziehen mit.
- Eine neue Änderung nach einem Zurück verwirft die Wiederholen-Schritte (wie
  überall üblich).

### Was ein Schritt ist

- Ein Schritt merkt sich den Stand des Profils **vorher** und **nachher**
  (`{ name, format, content, layout }`). Zurück stellt „vorher“ her,
  Wiederholen „nachher“.
- **Einmal Ziehen** (pointerdown bis pointerup) = ein Schritt.
- **Reihen** von Pfeiltasten, +/−, Q/E und Mausrad-Rasten fassen sich zu
  einem Schritt zusammen, solange zwischen zwei Änderungen weniger als
  **1 s** liegt und dasselbe Ding ausgewählt ist. Ziel: kein 30-mal Strg+Z
  nach Feinjustieren.
- Jeder Klick in der Leiste (Schalter, Auswahl, Format) = ein Schritt.
- Umbenennen = ein Schritt.
- **Zurücksetzen** = ein Schritt: „vorher“ ist der Stand vor dem Klick,
  „nachher“ der Stand, den der Pi als Antwort zurückgibt
  (`POST …/reset` liefert das Profil). Zurück schickt „vorher“ per `PUT`.
- Änderungen ohne Wirkung (gleicher Stand) erzeugen keinen Schritt.
- Höchstens **100 Schritte**; ältere fallen weg.

### Wann der Verlauf neu beginnt

- Je **Gerät** (nur im Speicher des Browsers, nichts am Pi, nicht in
  localStorage).
- Je **Profil**: Wechselt das aktive Profil (egal von welchem Gerät), wird
  der Verlauf geleert.
- Beim **Schließen der Leiste** bleibt er erhalten, bis die Seite neu lädt –
  wer die Leiste kurz zumacht, um das Bild ohne Rahmen zu sehen, soll danach
  noch zurück können.
- Änderungen von **anderen Geräten** am selben Profil werden nicht
  erkannt; ein Zurück hier kann sie überschreiben. Bewusst so (eine Person
  stellt ein; siehe „Risiken“).

### Umbau (Vorschlag, dem Umsetzer überlassen, solange das Verhalten stimmt)

- Neues reines Modul `server/public/js/history.js` ohne DOM:
  `createHistory({ limit, mergeMs, now })` mit `record(before, after, key)`
  (key = Zusammenfass-Schlüssel, z. B. `"keys:scheibe"`; `null` = nie
  zusammenfassen), `undo()`/`redo()` → Stand oder `null`, `canUndo`,
  `canRedo`, `clear()`. Vitest-Tests in `server/test/history.test.js`
  (Zusammenfassen nach Zeit und Schlüssel, Grenze 100, Wiederholen verfällt
  nach neuer Änderung, leere Änderungen).
- `editor.js` und `settings.js` melden jede Änderung an eine gemeinsame
  Stelle (in `app.js` angelegt). Ziehen: Stand beim pointerdown merken,
  beim pointerup einen Schritt aufnehmen (nicht bei jedem pointermove).
- Profil-Echo vom Pi (`onMessage` → `profile`) mit anderer `id` → Verlauf
  leeren.
- Tastatur: im bestehenden `keydown`-Muster (`isStageKey` reicht nicht – Strg+Z
  soll auch gehen, wenn der Fokus auf einem Schalter in der Leiste liegt; nur
  Textfelder und offener Dialog sind ausgenommen). `event.preventDefault()`,
  damit der Browser nichts anderes tut.

### Abnahme

- Scheibe ziehen, dann Strg+Z → Scheibe exakt zurück, auch am Beamer (zweites
  Fenster).
- 20× Pfeil rechts in Folge, Strg+Z → ganze Reihe auf einmal zurück.
- Schalter umlegen, Format ändern, Zurücksetzen, dann dreimal Zurück → alles
  wie vorher; dreimal Wiederholen → wieder wie danach.
- Knöpfe gesperrt, wenn nichts da ist; Kopf der Leiste springt nicht.
- Profil wechseln → beide Knöpfe gesperrt.
- Alle bestehenden Tests grün; Version erhöht, nach Arnolds „ja“ gepusht und
  per Update-Knopf auf dem Pi.

## Teil 2 – Board-Karte aufräumen, Raspdarts-Knopf in die Navigation

### Warum

Autodarts hat den **Board Manager** wieder (mit eigenen Kamerabildern). Unser
Ersatz ist überflüssig: Die Extension versteckt heute den Board-Manager-Knopf
auf der Board-Karte und setzt dort zwei eigene Knöpfe ein (Kameras, Viewer).
Arnold will die Bedienung jetzt **in der oberen Navigationsleiste** von
Autodarts – das ersetzt seine frühere Vorgabe „Bedienung auf der
Board-Karte“.

### Board-Karte

- Die Extension fügt auf `play.autodarts.com/boards` **nichts mehr** ein und
  versteckt nichts mehr. Der Board Manager von Autodarts ist wieder sichtbar.
- Entfernt: Knopf „Kameras“ samt Fenster (`extension/src/cams.js`,
  `cams-view.js`, Tests, Texte), der Viewer-Knopf auf der Karte, das Suchen
  der Karte (`locateCard`, `ensureButton`, …) und die Board-ID in der
  Extension (`BOARD_ID_KEY`, `pickBoardId`, `loadBoard`), soweit nichts
  anderes sie braucht.
- Am Pi entfernt: `GET /api/cams` und `GET /api/cams/:n` (nur der Kameras-Knopf
  hat sie benutzt) und was danach unbenutzt ist (z. B. das Lesen der Board-ID
  aus `/api/config`, falls nur dafür). **Bleibt**: alles für die
  Kamera-Ansicht der Scheibe im Viewer (`/api/board-camera…`,
  `board-camera.ts`, Bilderholen in `system/cams.ts`).
- README und Store-Texte, die Kameras-Knopf oder Board-Karte nennen,
  anpassen.

### Knopf in der Navigation

Autodarts hat seit dem Update eine neue Oberfläche (Stand 30.10., gelesen
im Playwright-Browser): oben eine Leiste (`banner`, 64 px hoch), links Logo,
in der Mitte `navigation "Hauptnavigation"` (Start, Spielen, Online,
Turniere, Stats), ganz rechts `button "Benutzermenü öffnen"` (das
Profilbild, 32 × 32 px).

- Neuer Knopf **links neben dem Profilbild** (Arnold 30.10.), gleich
  groß (32 × 32), rund/im Stil des Profilknopfs, mit dem bekannten
  Monitor-Symbol (`ICONS.monitor`). Weitergabe aus → durchgestrichener
  Monitor (`ICONS.monitorOff`), Hinweis wie bisher (`viewerButtonState`).
- **Immer** sichtbar (Arnold 30.10.), auch ohne Pi oder wenn er aus ist –
  das Fenster zeigt dann „nicht erreichbar“ wie heute. Auf **allen** Seiten
  von play.autodarts.com, auch im laufenden Spiel. Kommt zurück, wenn Autodarts die Leiste neu zeichnet
  (MutationObserver wie in `match-viewer-link.js`). Gefunden **nicht** über
  das deutsche `aria-label` („Benutzermenü öffnen“), sondern sprachunabhängig
  über den Aufbau: letzter Knopf in `header`/`banner` (meine Entscheidung –
  Autodarts gibt es auch auf Englisch). Fehlt die Leiste, wird nichts
  eingefügt (kein Fehler). `detectLanguage` (liest heute `header nav`) gegen
  die neue Leiste prüfen.
- Ein Klick öffnet das **bisherige Raspdarts-Fenster** unverändert
  (Weitergabe an/aus, beide Viewer-Links, Status, Update, Neustart,
  Herunterfahren; `page.js` über `openOverlay`). Titel nur „Raspdarts“
  (statt „… – <Boardname>“). Status-Abfrage alle 10 s nur bei offenem
  Fenster, wie bisher.
- Seitenwechsel innerhalb von Autodarts schließt das Fenster nicht mehr
  zwingend (es hängt nicht mehr an /boards). Läuft eine Aktion (Update), läuft
  sie weiter wie heute.

### Bleibt unverändert

- Abschnitt „Raspdarts Viewer“ im Autodarts-Fenster „Board control“
  (`match-viewer-link.js`) – muss aber nach dem Autodarts-Redesign geprüft
  werden. Ist er kaputt (er sucht das englische `aria-label="Refresh camera
  images"`), wird er im Rahmen von Teil 2 repariert (meine Entscheidung).
- Weitergabe der Spieldaten (`forward.js`, `page-hook.js`, `bridge.js`).

### Abnahme

- Extension neu geladen: Board-Karte zeigt nur Autodarts' eigene Knöpfe,
  Board Manager sichtbar.
- Monitor-Knopf neben dem Profilbild auf /, /play, /boards und im Spiel;
  Klick öffnet das Raspdarts-Fenster; Weitergabe aus → Symbol durchgestrichen.
- Am Pi liefern `/api/cams` 404; Kamera-Ansicht im Viewer geht weiter.
- Alle Tests grün (Server und Extension), Version erhöht, Pi per Update-Knopf.

## Arbeitsweise

Wie bisher: Plan, Umsetzung, ein Review am Ende, Prüfung im Browser auf
Arnolds echter Seite (Autodarts nur lesen, nichts anlegen). Vor Tests, die
Profile ändern, `server/data/profiles` sichern. Push, Pi-Update und Release
erst nach Arnolds „ja“.

## Risiken

- Zurück überschreibt Änderungen eines zweiten Geräts am selben Profil –
  hingenommen.
- Autodarts kann die Navigationsleiste wieder umbauen; dann fehlt der Knopf,
  bis wir nachziehen (Fenster ist dann nicht erreichbar – Viewer selbst geht
  weiter).
