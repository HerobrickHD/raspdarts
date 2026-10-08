# Viewer – Zwischenstand des Brainstormings

Stand: 8. Oktober 2026. Protokoll der Klärung. **Die Spec ist
`2026-10-08-viewer-design.md`** – bei Widersprüchen gilt sie.

## Neue Ausrichtung (Arnold, 8. Oktober 2026)

- Raspdarts ist ab jetzt nur noch die Anzeige. Teilprojekt B (Board-Verwaltung)
  ist verworfen.
- „Beamer“ heißt künftig allgemein **Viewer** (Arbeitsname): Die Anzeige ist nur
  eine Adresse, jedes Gerät mit Browser kann sie öffnen.
- Erste Instanz: Der Viewer sieht aus und verhält sich wie die Spielansicht auf
  play.autodarts.com – gezeichnete, animierte Scheibe und alles, was Autodarts
  dort anzeigen kann. Das bisherige Scoreboard (Stufe 1) wird ersetzt.
- Der Raspdarts-Eintrag in der Navigationsleiste fällt weg. Stattdessen eine
  eigene Kachel auf play.autodarts.com/boards (Pi-Werte, Anzeige einstellen –
  Details später).
- Reihenfolge: **erst der Viewer, danach die Kachel**.
- Datenquelle bleibt die Extension im Autodarts-Tab (Annahme, nicht widersprochen).

## Vorlage: Autodarts-Spielansicht (aufgenommen am 8. Oktober 2026)

Bilder und kompletter WebSocket-Mitschnitt (157 Nachrichten) in
`docs/referenz/autodarts-spielansicht/`. Gespielt: 301, SI-SO, 1 Leg,
testuser01 gegen lokalen Spieler „TEST“, Darts per Klick eingegeben
(`entry: "manual_coords"`).

**Aufbau (1440×765 CSS-Pixel)**

- Oben links: „Verlassen“, darunter Chips mit Spielmodus (`301`,
  `Erster bis 1 Leg`, `SI-SO`).
- Oben Mitte: Aufnahmeleiste – drei Felder (leer: Dart-Symbol, sonst `T20`,
  `S12`, `BULL`) und rechts die Summe der Aufnahme.
- Mitte: Scheibe. Links und rechts je eine Spielerkarte.
- Oben rechts: Zuschauerzahl, Statistik, Einstellungen. Unten: Steuerleiste
  (Weiter, Rückgängig). Bedienelemente braucht der Viewer nicht.

**Spielerkarte**

- Avatar, Name (Bebas Neue), Flagge; weißer Punkt links = vermutlich Anwurf.
- Restpunkte groß; schwarzes Kästchen daneben = gewonnene Legs.
- „Leg 61.0 / Match 61.0“ (Averages), darunter Dart-Symbol + Zahl geworfener Darts.
- Aktiv: lila-roter Verlauf, Restzahl weiß. Inaktiv: dunkelgrau, Restzahl grau.
- Checkout-Weg: grüne Kästchen untereinander links neben der Restzahl.
  **Autodarts zeigt ihn auch, wenn er erst für die nächste Aufnahme gilt**
  (unser bisheriger Code blendet ihn dann aus – Entscheidung offen).
- Bust: grauer „zersplittertes Glas“-Hintergrund, Aufnahmeleiste mit rotem
  Rahmen, statt Summe „BUST“. Dazu eine Animation (noch nicht aufgenommen).
- Sieger: grüner Verlauf, Legs-Kästchen zählt hoch. Endanimation (noch nicht
  aufgenommen).

**Scheibe** – vier übereinanderliegende SVGs:

1. Segmente, `viewBox 0 0 1000 1000`, Mittelpunkt (500,500), mit d3-Bögen
   gezeichnet. Radien: Bull 15.556, Single-Bull 37.778, Triple 215.556–237.778,
   Double 355.556–377.778, Rand bis 500. Farben: Schwarz `#01040B`,
   Rot `#E72946`, Grün `#009856`, helle Felder cremefarben. Jedes Feld hat
   `fill-opacity` mit `transition 120ms` (zum Abblenden/Hervorheben).
2. Winmau-Blade-X-Aufdruck (Markenlogos, PDC) – `viewBox 0 0 1281.3 1281.3`.
3. Zahlenring („Number Shroud“), gleiches Format.
4. Darts-Ebene: je Dart `circle r=5`, weiß umrandet (2), blau gefüllt, mit
   Schlagschatten; das Feld des **letzten** Darts als Pfad
   `rgba(255,220,0,0.65)` mit Klasse `dart-segment-blink`
   (`@keyframes`: Deckkraft 0.2 → 0.8 → 0.2, 0,8 s, endlos).

**Koordinaten:** `coords` aus Autodarts sind normiert, 1 = Außenkante des
Double-Rings. Umrechnung in die Scheiben-SVG: `x · 377.78`, `−y · 377.78`
(y zeigt in Autodarts nach oben).

**Schriften:** Manrope Variable (Text), Bebas Neue (Namen, Überschriften),
League Spartan Variable.

**Spieleinstellungen (Zahnrad)** – Anzeige-relevant: Match-Durchschnitt,
Leg-Durchschnitt, Checkout-Hilfe, Animationen, Jeden Wurf zählen,
Zuschaueranzahl, Tafel anzeigen (aus). Dazu Caller (Punkte/Checkout ansagen,
Stimme Deutsch/Englisch, Lautstärke) und Soundeffekte (Dart geworfen, Dart
verfehlt, Spielerwechsel, Timer-Warnung, Killer-Effekte).

## Daten (aus dem Mitschnitt)

- `autodarts.matches` / `<id>.state`: kompletter Match-Stand wie bisher
  (`players`, `gameScores`, `scores`, `turns[].throws[]` mit `coords` und
  `segment`, `stats[].legStats`/`matchStats` mit Averages, `state.checkoutGuide`,
  `turnBusted`, `settings`, `chalkboards`, `winner` …).
- `autodarts.matches` / `<id>.game-events`: Ereignisse `throw` (coords +
  segment), `turn_start` (`isCheckout`, Spieler, Rest), `turn_end` (Punkte),
  `game_shot` (`type: "match"`). Kommt bisher schon über die Extension mit,
  wird aber von `game-state.ts` nicht ausgewertet.
- `autodarts.matches` / `<id>.events`: `finish` mit Match-Zusammenfassung.

## Entscheidungen

- **Scheibe:** eigene Zeichnung im gleichen Stil (Geometrie, Farben, dunkler
  Zahlenring), **ohne** Winmau-/Blade-X-/PDC-Logos. (Arnold, 8. Oktober 2026)
- **Ton:** keiner im Viewer, erstmal. Caller/Sounds kommen weiter aus dem
  Autodarts-Tab. Eigene Ansagen evtl. später.
- **Checkout-Weg:** wie Autodarts – auch zeigen, wenn er erst für die nächste
  Aufnahme gilt. Weiterhin nur, was Autodarts schickt (Annahme, Arnold hat
  nicht widersprochen).

- **Umfang erste Instanz:** nur X01. Später alle Spielarten (Gotcha, Cricket …).
- **Grundsatz neu gefasst** (statt „Die Anzeige bleibt dumm“): Spielregeln und
  Autodarts-Format nur auf dem Pi; der Viewer darf in der Darstellung beliebig
  schlau sein (Geometrie, Hervorhebungen, Animationen). Beispiele für später:
  Checkout-Felder leuchten; bei Gotcha Felder in Gegnerfarbe, mit denen man
  jemanden zurücksetzt (Pi rechnet, Viewer färbt).
- Daraus für den Schnappschuss: Felder **strukturiert** (Multiplikator + Zahl),
  nicht nur „T20“; dazu von Anfang an eine allgemeine Liste „Hervorhebungen
  auf der Scheibe“ (Feld + Art), vorerst nur das blinkende letzte Feld.

- **Ansatz A** bestätigt: Pi übersetzt in einen Schnappschuss, Viewer bleibt
  einfaches HTML/CSS/SVG ohne Build-Schritt.
- **Layout-Editor bleibt** und wird Kernstück: Layouts pro Anzeige; die Scheibe
  wird ein eigener Block (verschieben, skalieren, drehen). Anwendungsfall u. a.:
  Beamer projiziert auf die echte Scheibe, gezeichnete Scheibe per Editor
  deckungsgleich legen, Felder leuchten live auf der echten Scheibe.
- **Projektion auf die Scheibe** (4-Ecken-Entzerrung, Modus „nur Licht“,
  Messung der Kamerastörung) ist ein **eigener Teil direkt nach** der ersten
  Instanz.

- **Abschnitt 1 (Aufbau, `ViewerState`)** freigegeben: Umbenennung beamer →
  viewer, Schnappschuss mit strukturierten Feldern, `highlights`, `isWinner`
  statt eigener Endphase, Standard-Anzeigename `standard`.
- **Kurswechsel bei Abschnitt 2 (8. Oktober 2026):** Die erste Instanz ist die
  **Beamer-Ansicht direkt auf die Scheibe** (schwarzer Grund = kein Licht).
  Damit wird die Projektion doch zuerst gebaut, nicht danach. Abschnitt 2
  (blaue Autodarts-Vollbildansicht) ist damit hinfällig und wird neu gefasst.
- **Profilbilder:** die echten Autodarts-/Gravatar-Bilder anzeigen. Hat ein
  Spieler keins (lokaler Spieler „TEST“: `avatarUrl: ""`), das
  **Autodarts-Standardbild** verwenden – kein Buchstaben-Kreis. Adresse des
  Standardbilds noch unbekannt (beim nächsten laufenden Spiel aus der Karte
  auslesen; beendete Match-Seite zeigt nur „Oops“).
- **Flaggen:** Autodarts liefert sie als SVG: `https://play.autodarts.com/flags/4x3/<land>.svg`.

## Offene Punkte

- Messung vor dem Bau (Grundsatz „erst messen, dann bauen“ aus
  `docs/projekt.md`): stört Licht auf der Scheibe die Kameraerkennung?

- Bust- und Endanimation aufnehmen.
- Bilder/Mitschnitt in `docs/referenz/` committen oder nur lokal halten?
