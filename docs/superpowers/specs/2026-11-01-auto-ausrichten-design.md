# Scheibe automatisch ausrichten

Stand 01.11.2026. Nur Viewer/Pi (Server-Version 2.9.0), keine neue Extension.

## Warum

Arnolds Beamer (JMGO Iris Ultra Max) sitzt auf einem Gimbal und wird zwischen
mehreren Leinwänden hin- und hergeschwenkt. Schwenkt er zur Dartscheibe
zurück, sitzt das projizierte Bild ein paar Zentimeter daneben, und die Größe
weicht etwas ab, weil der Abstand nie ganz gleich ist. Es kann sich auch leicht
verdrehen. **Schief oder trapezförmig ist das Bild nie**, der Beamer liefert
immer ein sauberes Rechteck. Heute richtet Arnold die Scheibe jedes Mal von
Hand im Viewer aus: Pfeiltasten verschieben, +/− ändert die Größe, Q/E dreht.

Das soll ein Knopf übernehmen. Der Beamer projiziert ein Prüfbild auf die
Scheibe, Raspdarts findet es in den Bildern der drei Autodarts-Kameras und
stellt die Scheibe im Profil passend ein.

## Was Arnold entschieden hat

- **Erst ein Knopf in den Einstellungen.** Eine Automatik, die das Schwenken
  selbst bemerkt, kommt später und ist nicht Teil dieser Arbeit.
- **Ergebnis direkt übernehmen**, ohne Vorher/Nachher-Abfrage. Zurück (↶ /
  Strg+Z) stellt den alten Stand wieder her. Das reicht.
- Den beschriebenen Ablauf (unten) hat er mit „passt so“ bestätigt.

## Ziele

- Ein Knopfdruck stellt die vier Werte der Scheibe im aktiven Profil ein:
  `layout.board.cx`, `cy`, `diameter`, `rotation`. Das sind genau die Werte,
  die Arnold heute mit Pfeilen, +/− und Q/E einstellt.
- Ziel-Genauigkeit 1–2 mm auf der Scheibe. Das ist besser, als man es mit den
  Tasten schnell hinbekommt.
- Abweichungen von ein paar Zentimetern und ein paar Grad werden sicher
  gefunden.
- Die Messung dauert nur wenige Sekunden.

## Nicht-Ziele

- Keine Automatik beim Schwenken (später).
- Keine Trapez- oder Verzerrungskorrektur. Die Abbildung ist eine Ähnlichkeit:
  verschieben, gleichmäßig skalieren, drehen.
- Keine Ausrichtung der anderen Bausteine (Spielerkarten, Spielinfo …). Sie
  bleiben, wo sie sind.
- Keine neue Kalibrierung der Kameras. Wir nutzen die von Autodarts.
- Keine Ringmaße (die Scheibe passt, siehe Projektstand).

## Darf auf keinen Fall passieren (Anti-Ziele)

- **Autodarts stören.** Kein Prüfbild während eines Spiels, weil Licht auf
  der Scheibe als Wurf zählen kann (siehe Erfahrung mit dem Blinken). Kein
  Zugriff auf die Kameras außer über die Bild-Schnittstelle von Autodarts.
  Nicht mehr Bilder holen als die heutige Bremse erlaubt.
- **Ein falsches Ergebnis übernehmen.** Ist die Messung unsicher, bleibt die
  Scheibe, wo sie ist, und es kommt ein Hinweis. Eine sichtbar verrutschte
  Scheibe ist schlimmer als keine Änderung.
- **Profil-Migration.** Es kommt kein neues Feld ins Profil, die
  Profil-Version bleibt.
- **Springen.** Außer der Scheibe selbst darf sich in der Leiste und auf der
  Bühne nichts verschieben (Arnolds Vorliebe „nichts springt“).

## Was es schon gibt (Grundlage)

- **Kamerabilder:** `server/src/system/cams.ts` holt JPEGs von Autodarts
  (`/api/img/cams/<n>`), höchstens eines pro Sekunde und Kamera, im Standby
  gar keine (`board-stopped`). Raspdarts öffnet die Kameras nie selbst.
- **Kamera → Scheibe:** `server/src/viewer/camera-geometry.ts` baut aus der
  Autodarts-Kalibrierung (`/api/config/calibration/ellipses`) je Kamera eine
  Homographie von Kamerapixeln auf ein Einheitsquadrat: 450 mm Kante, Mitte
  0.5/0.5, die 20 oben, y nach unten. Ein Punkt (u, v) im Quadrat liegt also
  bei `((u−0.5)·450, (v−0.5)·450)` mm von der echten Bullmitte, in der Lage der
  echten Scheibe (20 oben). Damit ist für jedes Kamerapixel bekannt, wo es auf
  der echten Scheibe liegt. Die Kamera-Ansicht nutzt das schon
  (`GET /api/board-camera` liefert die Matrizen).
- **Scheibe auf der Bühne:** `layout.board` (`server/src/viewer/layout.ts`):
  `cx` = Mitte in % der Bühnenbreite, `cy` = Mitte in % der Bühnenhöhe,
  `diameter` = Durchmesser des Double-Rings (340 mm) in % der Bühnenhöhe,
  `rotation` = Grad im Uhrzeigersinn. Gezeichnet in
  `public/js/layout-view.js`.
- **Ändern mit Zurück:** Im Editor (`public/js/editor.js`) läuft jede
  Tastenänderung über `change(mutate, key)`. Das speichert per `sync.queue`
  und legt einen Schritt für Zurück an (`record`).
- **Bildschirme:** `server/src/viewer/display-hub.ts` schickt allen Viewern
  per WebSocket vollständige Nachrichten (`catalog`, `state`, `profile`,
  `camera`).

## Ablauf (so mit Arnold abgestimmt)

1. Im Kasten **Scheibe** der Leiste steht ein Knopf **„Automatisch
   ausrichten“**. (Ort: meine Wahl.)
2. Der Knopf geht nur, wenn **kein Spiel läuft** (`phase` ≠ `playing`) und das
   **Autodarts-Board an ist** (nicht im Standby). Sonst ist er gesperrt oder
   meldet beim Drücken kurz, warum, zum Beispiel „Nur ohne laufendes Spiel“
   oder „Board ist im Standby – in Autodarts starten“.
3. Alle Viewer zeigen für ein paar Sekunden ein **Prüfbild**: erst die ganze
   Bühne schwarz, dann helle Punkte auf Schwarz.
4. Raspdarts holt von **allen Kameras** ein Bild mit Schwarz und eines mit
   Punkten, sucht die Punkte und rechnet mit der Autodarts-Kalibrierung aus, wo
   sie auf der echten Scheibe gelandet sind.
5. Daraus ergeben sich Mitte, Durchmesser und Drehung. Die neuen Werte gehen
   **sofort** ins aktive Profil, als **ein** Schritt für Zurück.
6. Ist die Messung unsicher, ändert sich nichts. Es kommt ein Hinweis, zum
   Beispiel „Punkte nicht gefunden – Beamer an und auf die Scheibe
   gerichtet?“.
7. Danach zeigen die Viewer wieder das Normale (Warte-Bildschirm bzw.
   Vorschau).

## Wie gemessen wird

### Prüfbild

- Die Punkte werden **im Koordinatensystem der gezeichneten Scheibe**
  platziert, also im Scheiben-Block. Sie verschieben, skalieren und drehen
  sich mit `layout.board`. Ein Punkt hat damit eine bekannte Lage `p` in mm
  auf der *gezeichneten* Scheibe.
- Vorschlag: 8 Punkte auf einem Kreis mit etwa 130 mm Radius und einer in der
  Mitte, jeder etwa 10–15 mm groß, reines Weiß. Der Radius bleibt innerhalb
  des Double-Rings, damit die Punkte sicher auf der Scheibenebene liegen, für
  die die Autodarts-Kalibrierung gilt. Ein Umfeld neben der Scheibe ist
  vielleicht nicht in derselben Ebene. Genaue Anzahl, Größe und Lage
  entscheidet der Builder.
- Die Zuordnung „welcher gefundene Fleck ist welcher Punkt“ läuft über die
  Nähe zur erwarteten Lage. Bei ein paar Zentimetern und ein paar Grad
  Abweichung ist das eindeutig, solange die Punkte deutlich weiter
  auseinanderliegen als die Abweichung (bei 8 Punkten auf 130 mm sind es
  ~100 mm). Ein unsymmetrisches Muster wäre robuster. Das entscheidet der
  Builder.
- Während des Prüfbilds wird **alles andere** der Bühne ausgeblendet, auch
  die Leuchtfelder des Warte-Bildschirms, damit nur die Punkte hell sind.

### Bilder und Flecken

- Für jede Kamera ein Bild bei schwarzer Bühne und eines mit Punkten. Der
  Unterschied (Punkte − Schwarz) blendet Raumlicht und die Scheibe selbst aus.
- Wartezeit nach jedem Bildwechsel, damit Beamer und Kamera das neue Bild
  sicher zeigen. Vorschlag 700–1000 ms, den genauen Wert misst der Builder am
  echten Aufbau. Höchstens ein Bild pro Sekunde und Kamera. Achtung:
  `cams.image(n, { fresh: true })` umgeht den 1-s-Zwischenspeicher in
  `cams.ts`, die neue Route muss die Bremse also selbst sicherstellen
  (zusammen mit `board-camera.ts`, das bis zu 2/s holt). Das Bild muss *nach*
  dem Wechsel aufgenommen sein.
- Flecken: Schwelle auf dem Unterschiedsbild, zusammenhängende Flächen, Mitte
  nach Helligkeit gewichtet. Viel zu kleine oder große Flecken fallen weg.
- Jede Fleckmitte (Kamerapixel) geht durch die Homographie dieser Kamera →
  echte Lage `q` in mm.
- **Zu prüfen:** dass die Pixel der Ellipsen-Punkte in derselben Auflösung
  vorliegen wie die Bilder aus `/api/img/cams/<n>`. Die Kamera-Ansicht deutet
  darauf hin, gesichert ist es nicht.

### Ausgleich

- Paare (`p` gezeichnet → `q` echt) aus allen Kameras zusammen. Sieht mehr als
  eine Kamera denselben Punkt, gehen alle Messungen ein.
- Ähnlichkeit nach kleinsten Quadraten (4 Werte: Maßstab `s`, Drehung `θ`,
  Verschiebung `t`), geschlossene Lösung. Ausreißer (z. B. > 5 mm Abstand
  nach dem ersten Ausgleich) fallen weg, danach wird noch einmal gerechnet.
- **Abbruch ohne Änderung**, wenn danach weniger als 4 Punkte übrig sind, die
  Punkte nicht über die Scheibe verteilt sind (z. B. alle auf einer Seite)
  oder die Restabweichung (RMS) über ~3 mm liegt. Die genauen Grenzen legt der
  Builder fest.

### Neue Werte

`q = s·R(θ)·p + t` sagt, wohin ein gezeichneter Punkt auf der echten Scheibe
fällt. Die gezeichnete Scheibe soll künftig auf der echten liegen. Mit `k` =
Bühnenhöhe-% pro mm (`diameter / 340`) und `r` = heutiger `rotation`:

- `diameter' = diameter / s`
- `rotation' = rotation − θ` (Vorzeichen gemäß Uhrzeigersinn-Konvention
  prüfen)
- neue Mitte = Bühnenpunkt der echten Bullmitte (`q = 0`), also
  `p₀ = −R(θ)⁻¹·t / s` auf der gezeichneten Scheibe, auf die Bühne
  umgerechnet: `Mitte + k·R(r)·p₀`.
- `cy` ist in % der Höhe und passt direkt. **`cx` ist in % der Breite** und
  braucht das Seitenverhältnis der Bühne am Beamer, Umrechnung
  `Δcx = Δ(Höhe-%) · Höhe/Breite`. Bei festem Format (16:9, 16:10, 4:3) ist es
  bekannt, egal wie groß das Fenster am Beamer ist (`STAGE_ASPECT` in
  `layout.ts`).
- **Nur feste Formate (meine Wahl):** Bei „Ganzes Fenster“ hängt das
  Seitenverhältnis am Fenster des Beamer-Viewers. Das kennt der Pi nicht, und
  welcher Viewer der Beamer ist, weiß niemand. Der Knopf ist dann gesperrt,
  mit dem Hinweis „Nur bei festem Format (z. B. 16:9)“. Arnolds Profile auf dem
  Pi stehen beide auf 16:9 (am 01.11.2026 nachgesehen), es fehlt ihm also
  nichts.
- Werte auf die bekannten Grenzen klemmen (`LIMITS` in `layout.ts`).

Eine Messung sollte reichen, weil die Abbildung linear ist. Wenn der Builder am
echten Aufbau sieht, dass ein zweiter Durchgang merklich besser wird, darf er
automatisch zweimal messen.

## Wo was läuft (meine Wahl)

- **Rechnen im Browser**, in dem die Leiste offen ist: JPEG über `<img>` /
  `createImageBitmap` in ein Canvas, Pixel lesen. So braucht der Pi keine neue
  Bibliothek zum Bilder-Entpacken. Die Rechenteile (Flecken suchen,
  Ähnlichkeit, neue Werte) sind reine Funktionen in einer eigenen Datei unter
  `public/js/` und werden mit `node:test` getestet wie die übrigen.
- **Server:** Er schaltet das Prüfbild für alle Viewer (neue Nachricht im
  `display-hub`, z. B. `{ type: "pattern", step: "black" | "dots" | null }`) und
  liefert frische Kamerabilder für die Messung. Eine schlanke Möglichkeit:
  eigene Route, die mit `cams.image(n, { fresh: true })` holt und `ok` /
  `board-stopped` / `unavailable` zurückgibt, ohne die Kamera-Ansicht
  (`board-camera.ts`) zu verändern. Der Builder darf das anders schneiden,
  solange die Bremse gilt und Autodarts nur über seine Schnittstelle gefragt
  wird.
- Läuft während der Messung ein Spiel an, bricht die Messung ab, das Prüfbild
  geht sofort weg, und es wird nichts übernommen.
- Das Prüfbild hat eine **Höchstdauer** (z. B. 10 s) auf dem Server. Bricht
  der auslösende Browser weg, gehen die Viewer trotzdem zurück zum Normalen.
- Ergebnis über den Editor-Weg `change(…, key)`, damit es genau ein
  Zurück-Schritt ist und wie eine Tastenänderung gespeichert und an alle
  Bildschirme verteilt wird.

## Bedienung im Detail

- Während der Messung zeigt der Knopf, dass er arbeitet (z. B. „Richte
  aus …“), und lässt sich nicht noch einmal drücken.
- Erfolg: kurzer Hinweis, z. B. „Ausgerichtet (± 0,8 mm)“.
- Fehler: kurzer Hinweis mit Grund, Scheibe unverändert.
- Der Knopf funktioniert unabhängig von der Darstellung der Scheibe
  (Kamera, Gezeichnet, Linien, Nur Licht) und davon, ob die Scheibe beim
  Warten gezeigt wird. Das Prüfbild bringt eigene Punkte mit.

## Tests

- Reine Funktionen: Flecken in einem künstlichen Unterschiedsbild,
  Ähnlichkeit aus Punktpaaren (mit Rauschen und einem Ausreißer), neue
  Board-Werte aus bekanntem Versatz (Verschiebung, Maßstab, Drehung einzeln
  und zusammen, verschiedene Formate), Abbruchregeln.
- Server: Prüfbild-Nachricht an alle Viewer, Höchstdauer, Abbruch bei
  Spielstart, Bremse beim Bilderholen, Antwort im Standby.
- Am echten Aufbau: Scheibe absichtlich ein paar cm verschieben, vergrößern
  und drehen, Knopf drücken, Ergebnis mit dem Auge und mit der Kamera-Ansicht
  prüfen. Danach mit Zurück den alten Stand holen.

## Ausrollen

Server-Version 2.9.0, nur Pi, keine Extension. Vorher `data/profiles`
sichern, wie üblich. Pushen erst nach Arnolds „ja“.

## Offen / dem Builder überlassen

- Anzahl, Größe, Lage und Form der Punkte; Wartezeiten; Schwellen und
  Abbruchgrenzen. Alles am echten Aufbau ausprobieren.
- Genauer Zuschnitt von Server-Route und WebSocket-Nachricht.
- Ob die Kamera-Kalibrierung von Autodarts beim Messen frisch geholt wird oder
  aus dem Zwischenspeicher (60 s) kommt.

## Nachtrag 01.11.2026 (Umsetzung)

- **Punktmuster unregelmäßig** statt 8 Punkte auf einem Kreis: Mitte plus 8
  Punkte zwischen 86 und 132 mm, alle Abstände und Winkel verschieden
  (`ALIGN_DOTS` in `public/js/align.js`). Der gleichmäßige Kreis ergab bei
  einer um ~27–45° verdrehten Scheibe einen sicheren, aber falschen Erfolg
  (Restfehler 0). Ein Test geht jetzt alle Drehfehler durch: entweder richtig
  oder Abbruch. Grenze „nur eine Seite“ dafür 40 mm statt 60.
- **Standby:** Autodarts liefert im Standby auch keine Kalibrierung (`{}`).
  Der Pi fragt dann den Board-Zustand ab und meldet „Board ist im Standby“.
  Die Kalibrierung wird fürs Ausrichten frisch gelesen (sonst 60 s alt).
- **Viewer** bekommen beim Verbinden immer den Prüfbild-Stand (auch „keins“)
  und verlassen das Prüfbild, wenn die Verbindung abreißt – sonst bliebe ein
  Viewer, der das Ende verpasst, schwarz.
- **Zeitlimit** der Anfrage im Browser 20 s statt 5 s (Antwort 1–2 MB, Pi
  braucht im schlimmsten Fall ~12 s).
- Noch offen für den Test am Beamer: Wartezeit, Schwellen, Auflösung der
  Kalibrier-Pixel gegenüber dem Kamerabild (Config: 1280×720).
