# Viewer – Grundlage für die Projektion auf die Scheibe

Stand: 8. Oktober 2026

## Ziel

Raspdarts konzentriert sich ab jetzt auf die Anzeige. Was bisher „Beamer“
hieß, heißt **Viewer**: eine Adresse auf dem Pi, die jedes Gerät mit Browser
öffnen kann. Der wichtigste Anwendungsfall ist ein Beamer, der **direkt auf die
Dartscheibe** projiziert: Die gezeichnete Scheibe wird per Editor deckungsgleich
auf die echte gelegt, und Treffer und Hervorhebungen leuchten live auf den
echten Feldern. Rundherum an der Wand stehen Spielerkarten und Aufnahme im
Stil der Autodarts-Spielansicht.

Dieses Dokument beschreibt die **Grundlage**: alles, was der Viewer unabhängig
davon braucht, ob Licht auf der Scheibe die Kameraerkennung stört. Diese
Messung ist noch nicht möglich (Beamer und Darts fehlen) und folgt als eigener
Schritt (siehe „Danach“).

**Fertig heißt:**

- Spielt man den Mitschnitt vom 8. Oktober 2026 mit `npm run replay` ab, zeigt
  der Viewer jeden aufgenommenen Zustand (Start, ein Dart, drei Darts, Wechsel,
  Bust, Checkout-Weg, Sieger) wie in den Referenzbildern – auf schwarzem Grund,
  ohne Bedienelemente, mit eigener Scheibe ohne Logos.
- Die Scheibe lässt sich in den Darstellungen „Nur Licht“ und „Gezeichnet“
  anzeigen; im Editor erscheint sie als „Linien“.
- Öffnet man denselben Anzeigenamen auf zwei Geräten und bearbeitet auf einem
  das Layout, folgt das andere live. Position, Größe und Drehung der Scheibe
  lassen sich grob mit der Maus und fein per Tastatur einstellen.
- Alle Tests laufen grün; Arnold hat den Viewer am Bildschirm abgenommen.

**Nicht im Umfang:** Messung der Kamerastörung und das endgültige
Licht-Verhalten auf der Scheibe, 4-Ecken-Entzerrung, Bust- und Endanimation,
andere Spielarten als X01, Ton, die Kachel auf play.autodarts.com/boards,
Änderungen an der Extension.

## Grundsatz

Ersetzt „Die Anzeige bleibt dumm“ aus `docs/projekt.md`:

- **Spielregeln und das Autodarts-Datenformat kennt nur der Pi.** Wer dran ist,
  Rest, Bust, Checkout-Weg, Sieger – das entscheidet Autodarts, und
  `game-state.ts` übersetzt es. Ändert Autodarts sein Format, ist genau diese
  Datei betroffen.
- **Der Viewer darf in der Darstellung beliebig schlau sein:** Geometrie der
  Scheibe, Hervorhebungen, Animationen, Layout. Der Pi sagt, *was*
  hervorgehoben wird, der Viewer, *wie*.

Beispiel für später: Bei Gotcha rechnet der Pi aus, mit welchem Feld man
welchen Gegner zurücksetzt, und schickt das als Hervorhebung; der Viewer färbt
das Feld in der Farbe des Gegners.

## Aufbau

```
Autodarts-Tab → Extension → Pi /ingest → game-state.ts → ViewerState
                                                            │
                         Layout-Speicher ── Layout je Anzeige
                                                            ▼
                                           /ws?display=<name> → Viewer
```

Der Weg der Spieldaten bleibt wie bisher. Neu sind der Inhalt des
Schnappschusses, die Live-Verteilung des Layouts und der Viewer selbst.

**Umbenennung:**

| Bisher | Neu |
|---|---|
| `server/src/beamer/` | `server/src/viewer/` |
| `ScoreboardState`, `toScoreboardState` | `ViewerState`, `toViewerState` |
| „Beamer“ in Texten und Kommentaren | „Viewer“ |
| Standard-Anzeigename `beamer` | `standard` |

**Bleibt vorerst:** Das Feld `beamer` in `GET /api/status` behält seinen Namen,
weil die Extension es liest und in diesem Teil nicht geändert wird. Es wird mit
der Kachel umbenannt.

Der Viewer bleibt einfaches HTML, CSS und SVG ohne Build-Schritt
(`server/public/`), aufgeteilt in ES-Module, damit die reinen Funktionen
(Geometrie, Beschriftung) mit Vitest testbar sind.

## Der Schnappschuss `ViewerState`

```ts
type Field = {
  multiplier: 0 | 1 | 2 | 3;   // 0 = daneben
  number: number;              // 1–20, 25 = Bull, 0 = daneben
  ring: "inner" | "outer" | null; // nur bei Single: innerer oder äußerer Teil
                                  // (Autodarts „SingleInner“/„SingleOuter“),
                                  // sonst und bei Checkout-Feldern null
};

type ViewerState =
  | { phase: "idle" }
  | { phase: "unsupported"; variant: string }
  | {
      phase: "playing";
      variant: "X01";
      match: {
        baseScore: number;           // 301, 501 …
        legsToWin: number;           // „Erster bis N Legs“
        setsToWin: number | null;    // null = ohne Sätze
        inMode: "Straight" | "Double" | "Master";
        outMode: "Straight" | "Double" | "Master";
      };
      players: PlayerView[];
      turn: {
        darts: { field: Field; coords: { x: number; y: number } | null }[];
        points: number;
        busted: boolean;
      };
      highlights: { field: Field; kind: "last-dart" }[];
    };

type PlayerView = {
  name: string;
  avatarUrl: string | null;     // null = kein eigenes Bild
  country: string | null;       // „de“
  score: number;                // Rest
  legs: number;
  sets: number;
  average: { leg: number; match: number };
  dartsThrown: number;          // im laufenden Leg
  isActive: boolean;
  isWinner: boolean;
  busted: boolean;              // aktiver Spieler hat in dieser Aufnahme überworfen
  checkout: Field[] | null;
};
```

- Es gibt keinen eigenen Endzustand: Autodarts zeigt am Ende die normale
  Ansicht mit grüner Siegerkarte, also trägt der Spieler `isWinner`.
- `coords` sind die Autodarts-Koordinaten unverändert: normiert, 1 =
  Außenkante des Double-Rings (170 mm), y zeigt nach oben.
- `highlights` enthält vorerst nur das Feld des letzten Darts der laufenden
  Aufnahme (leer, solange die Aufnahme keine Darts hat). Weitere Arten
  (`checkout`, später `gotcha` …) kommen als neue `kind`-Werte dazu.
- Weiter wie bisher: Der Pi sendet immer vollständige Schnappschüsse.

### Übersetzung aus dem Autodarts-Stand

Quelle ist die Nachricht `autodarts.matches` / `<id>.state` (Felder geprüft am
Mitschnitt vom 8. Oktober 2026). Andere Nachrichten (`game-events`, `events`,
Lobby, Board) ergeben wie bisher `idle` und ändern die Anzeige nicht.

| ViewerState | Autodarts |
|---|---|
| `phase` | `players` und `gameScores` vorhanden → `variant === "X01"` ? `playing` : `unsupported` |
| `match.baseScore`, `inMode`, `outMode` | `settings.baseScore`, `settings.inMode`, `settings.outMode` |
| `match.legsToWin`, `setsToWin` | `legs`, `sets` (fehlt `sets` → `null`) |
| `players[i].name`, `avatarUrl` | `players[i].name`, `players[i].avatarUrl` (leer → `null`) |
| `players[i].country` | `players[i].user.country` (lokale Spieler haben keinen `user` → `null`) |
| `score` | `gameScores[i]` |
| `legs`, `sets` | `scores[i].legs`, `scores[i].sets` |
| `average.leg`, `average.match` | `stats[i].legStats.average`, `stats[i].matchStats.average` |
| `dartsThrown` | `stats[i].legStats.dartsThrown` |
| `isActive` | `i === player` |
| `isWinner` | `i === winner` (bei `winner >= 0`) |
| `busted` | `isActive && turnBusted` |
| `checkout` | `state.checkoutGuides[i]` (oder `state.checkoutGuide` für den aktiven Spieler); **auch wenn er erst für die nächste Aufnahme gilt** – wie Autodarts. Selbst gerechnet wird nicht. |
| `turn.darts` | `throws` der letzten Aufnahme in `turns`: `segment.multiplier`, `segment.number`, `coords` |
| `turn.points`, `turn.busted` | `turnScore`, `turnBusted` |

Fehlende oder unpassende Werte werden durch Ersatzwerte ersetzt (Zahlen 0,
Texte `null`, Listen leer); eine Nachricht, die gar nicht passt, wird wie heute
übersprungen.

## Der Viewer

### Grundbild

- **Schwarz heißt kein Licht.** Hintergrund rein schwarz (`#000`), keine
  Bedienelemente von Autodarts (Verlassen, Weiter, Zahnrad, Kamera, Zuschauer).
- Alle Grundgrößen hängen an der Bildschirmhöhe (`vh`), damit das Standardbild
  auf jeder Auflösung gleich aussieht.
- Schriften: Manrope (Text) und Bebas Neue (Namen), beide unter der SIL Open
  Font License, als `woff2` mit Lizenzdatei in `server/public/fonts/` – der
  Viewer braucht für die Schrift kein Internet.

### Blöcke und Standardlayout

| Block | Inhalt | Standardplatz |
|---|---|---|
| `kopf` | Chips: „301“, „Erster bis 1 Leg“ (bzw. „… N Legs“, „… N Sets“), „SI-SO“ | oben links |
| `aufnahme` | drei Dart-Felder und Summe | oben Mitte |
| `scheibe` | die Scheibe | Mitte, ca. 65 % der Bildhöhe |
| `spieler-1` … `spieler-6` | je eine Spielerkarte | 1 links, 2 rechts neben der Scheibe; 3–6 abwechselnd links/rechts darunter, kleiner |

Die Anordnung für 3 und mehr Spieler ist eine Annahme (nicht gegen Autodarts
geprüft) und per Editor änderbar. Karten für nicht vorhandene Spieler werden
nicht angezeigt.

### Die Scheibe

**Geometrie** nach den offiziellen Turniermaßen, in Millimetern um den
Mittelpunkt (Radien): Bull 6,35 · Single-Bull 15,9 · Triple 99–107 ·
Double 162–170. Zahlenreihenfolge im Uhrzeigersinn ab oben: 20, 1, 18, 4, 13,
6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5. Die Geometrie ist ein
eigenes Modul mit reinen Funktionen:

- `fieldPath(field)` → SVG-Pfad des Feldes (für Hervorhebungen)
- `coordsToPoint(coords)` → Punkt in Millimetern (x · 170, −y · 170)
- `fieldCenter(field)` → Mittelpunkt des Feldes (für Darts ohne Koordinaten)
- `fieldAt(point)` → Feld an einem Punkt (für Tests)

Über den Double-Ring hinaus zeichnet der Viewer einen Zahlenring bis 225 mm
(nur in „Gezeichnet“).

**Darstellungen** (pro Anzeige im Layout gespeichert, Standard „Nur Licht“):

| Darstellung | Was zu sehen ist |
|---|---|
| **Nur Licht** | alles schwarz; sichtbar nur Darts und Hervorhebungen |
| **Gezeichnet** | volle Scheibe im Autodarts-Stil, ohne Logos: Felder Schwarz `#01040B` / Creme, Ringe Rot `#E72946` / Grün `#009856`, dunkler Zahlenring mit grauen Zahlen; dazu Darts und Hervorhebungen |
| **Linien** | nur Drähte (Ringe und Segmentgrenzen), dünn und weiß; erscheint automatisch im Bearbeiten-Modus, auf allen Geräten dieser Anzeige |

**Darts und Hervorhebungen** wie bei Autodarts:

- Jeder Dart der laufenden Aufnahme: Kreis, blau gefüllt, weiß umrandet, mit
  Schlagschatten, an `coordsToPoint(coords)`; ohne Koordinaten an
  `fieldCenter(field)`. Daneben-Würfe (`number 0`) ohne Koordinaten werden
  nicht eingezeichnet.
- Hervorhebung `last-dart`: das Feld (bei Single nur der getroffene Teil,
  `ring`) gefüllt mit `rgba(255, 220, 0, 0.65)`,
  Deckkraft pulsierend 0,2 → 0,8 → 0,2 in 0,8 s. Ob das auf der echten Scheibe
  so bleibt, entscheidet die Messung.

### Aufnahmeleiste (`aufnahme`)

- Drei Felder: leer ein Dart-Symbol, sonst die Beschriftung (`T20`, `D8`,
  `S12`, `25`, `BULL`; daneben `MISS` – Annahme, nicht gegen Autodarts
  geprüft). Rechts die Summe `turn.points`.
- Bust: roter Rahmen, statt der Summe „BUST“.
- Die Beschriftung entsteht im Viewer aus `Field` (reine Funktion, getestet).

### Spielerkarte (`spieler-n`)

- Oben: Profilbild, Name (Bebas Neue), Flagge.
- Mitte: Restzahl groß; daneben schwarzes Kästchen mit gewonnenen Legs;
  links davon der Checkout-Weg als grüne Kästchen untereinander.
- Unten: „Leg 61.0 / Match 61.0“ (eine Nachkommastelle, Punkt wie bei
  Autodarts), darunter Dart-Symbol und `dartsThrown`.
- Zustände: **aktiv** lila-roter Verlauf, Restzahl weiß · **inaktiv**
  dunkelgrau, Restzahl grau · **Bust** grau mit eigenem Riss-Muster (nicht die
  Autodarts-Grafik) · **Sieger** grüner Verlauf.
- **Profilbild:** `avatarUrl`; ohne eigenes Bild das Autodarts-Standardbild
  `https://play.autodarts.com/assets/player-silhouette-X1nJGQO_.png` (dunkler
  Schattenriss, gefunden im Seitencode am 8. Oktober 2026). Der Dateiname
  enthält eine Build-Kennung und kann sich mit jeder Autodarts-Version ändern;
  dann lädt das Bild nicht mehr und der Platz bleibt leer, bis die Adresse
  nachgezogen ist. Lädt ein Bild nicht, bleibt der Platz leer.
- **Flagge:** `https://play.autodarts.com/flags/4x3/<country>.svg`; lädt sie
  nicht oder fehlt `country`, entfällt sie.

### Sonderzustände

- `idle`: alles schwarz bis auf den kleinen, dunkelgrauen Hinweis „Warte auf
  ein Spiel“. Auf der Scheibe leuchtet nichts.
- `unsupported`: derselbe Hinweis als „Cricket wird noch nicht unterstützt“
  (mit dem gemeldeten Namen der Spielart).
- Keine Verbindung zum Pi: kleiner Hinweis in einer Ecke; der letzte Stand
  bleibt stehen. Wiederverbinden wie bisher mit wachsendem Abstand.

## Layout und Editor

### Layout-Modell

```ts
type DisplayLayout = {
  version: 2;
  boardMode: "light" | "drawn";
  board: {
    cx: number;        // Mittelpunkt, % der Breite
    cy: number;        // Mittelpunkt, % der Höhe
    diameter: number;  // Durchmesser des Double-Rings (340 mm), % der Höhe
    rotation: number;  // Grad, −180 … 180
  };
  blocks: Record<"kopf" | "aufnahme" | `spieler-${1|2|3|4|5|6}`, {
    x: number;         // linke obere Ecke, % der Breite
    y: number;         // % der Höhe
    scale: number;     // relativ zur Grundgröße
  }>;
};
```

- Die Größe der Scheibe hängt am Double-Ring, damit „Scheibe passt“ genau
  heißt: Der Lichtring liegt auf dem echten Draht.
- `sanitizeLayout` prüft jeden Wert einzeln und setzt ihn notfalls auf den
  Standard (Grenzen: Position 0–100 %, `diameter` 5–400 %, `scale` 0,2–4,
  `rotation` −180–180). Fehlt `version: 2`, gilt das ganze Layout als Standard
  – damit fallen die alten Beamer-Layouts (`meta`, `players`, `checkout`)
  sauber weg.
- Die spätere 4-Ecken-Entzerrung kommt als optionales Feld in `board` dazu;
  Layouts ohne dieses Feld bleiben gültig.

### Live-Verteilung

- Der Viewer verbindet sich mit `/ws?display=<name>` (ungültiger oder fehlender
  Name → `standard`). Der Pi schickt beim Verbinden den aktuellen Stand und das
  Layout dieser Anzeige, danach jede Änderung.
- Nachrichten auf `/ws`: `{ "type": "state", "state": ViewerState }` und
  `{ "type": "layout", "layout": DisplayLayout, "editing": boolean }`.
- Bearbeiten schreibt über `PUT /api/layout/<name>` (mit `X-Raspdarts`-Header,
  wie bisher), Inhalt `{ "layout": DisplayLayout, "editing": boolean }`,
  Antwort ebenso. `GET /api/layout/<name>` liefert weiter nur das Layout. Der Pi prüft das Layout, schickt es **sofort** an alle Viewer
  dieser Anzeige und schreibt die Datei gebündelt (höchstens alle 500 ms).
  Der Editor sendet beim Ziehen höchstens alle 100 ms.
- Ob gerade bearbeitet wird, steht im Layout-Ereignis (`editing`), damit alle
  Geräte dieser Anzeige die Scheibe als „Linien“ zeigen. `editing` wird nicht
  gespeichert; ohne Änderung über 60 s fällt es von selbst auf `false`.
- Zwei Geräte bearbeiten gleichzeitig: Die letzte Änderung gewinnt.

### Bedienung (ausgelegt auf Bildschirm mit Maus und Tastatur)

- Knopf „Layout“ schaltet den Bearbeiten-Modus. Er ist unsichtbar und
  erscheint nur, solange die Maus bewegt wird (blendet nach 3 s ohne Bewegung
  aus) – sonst würde er auf die Wand projiziert. Ohne laufendes Spiel werden
  Beispieldaten angezeigt, damit es etwas zu platzieren gibt.
- Ein Umschalter im Bearbeiten-Modus wählt „Nur Licht“ / „Gezeichnet“.
- **Scheibe:** ziehen = verschieben; Griff unten rechts oder Mausrad = Größe;
  Drehgriff = Drehung. Fein per Tastatur, solange die Scheibe ausgewählt ist:
  Pfeiltasten 0,1 % (mit Umschalt 1 %), `+`/`−` 0,1 % Durchmesser (mit Umschalt
  1 %), `Q`/`E` 0,1° (mit Umschalt 1°).
- **Andere Blöcke:** ziehen = verschieben, Griff = Größe; Pfeiltasten wie oben.

## Fehlerfälle

- Unpassende Autodarts-Nachricht: übersprungen, letzter guter Stand bleibt.
- Dart ohne Koordinaten: Punkt in der Feldmitte; daneben ohne Koordinaten:
  kein Punkt.
- Profilbild oder Flagge lädt nicht: Ersatz wie oben, sonst leer.
- Kaputtes oder altes Layout: blockweise Standard (bzw. ganz Standard ohne
  `version: 2`).
- Layout-Datei nicht schreibbar: Warnung im Log, Änderungen gelten bis zum
  Neustart weiter (wie die Aufzeichnung: der Dienst läuft weiter).

## Tests

- **Übersetzung:** Der Mitschnitt vom 8. Oktober 2026
  (`docs/referenz/autodarts-spielansicht/mitschnitt.json`) wird in eine
  Test-Datei (`server/test/fixtures/`, NDJSON wie die Aufzeichnungen)
  übernommen. Geprüft wird `toViewerState` für Start, ein Dart, drei Darts,
  Wechsel, Bust, Checkout-Weg (auch für die nächste Aufnahme) und Sieger, dazu
  `unsupported` und Ersatzwerte bei fehlenden Feldern.
- **Geometrie:** `fieldAt(coordsToPoint(coords))` ergibt für jeden Dart im
  Mitschnitt, der mehr als 2 mm von der nächsten Feldgrenze entfernt liegt, das
  von Autodarts gemeldete Feld. (Autodarts' eigene Zeichnung rundet die Radien –
  Bull 7, Single-Bull 17, Triple 97–107, Double 160–170 mm –, Darts direkt an
  einer Grenze können deshalb abweichen.) Dazu Pfade und Mittelpunkte für
  Stichproben.
- **Beschriftung:** `Field` → `T20`, `D8`, `25`, `BULL`, `MISS`.
- **Layout:** `sanitizeLayout` (Grenzen, alte Layouts, fehlende Blöcke);
  Live-Verteilung nur an Viewer derselben Anzeige; gebündeltes Schreiben;
  `editing` fällt nach 60 s zurück.
- **Von Hand:** Mitschnitt mit `npm run replay` abspielen, Viewer in beiden
  Darstellungen und im Editor ansehen, Live-Verteilung mit zwei Fenstern.
  Danach Abnahme durch Arnold.

## Was wegfällt, was sich ändert

- Die alte Scoreboard-Anzeige in `server/public/` wird ersetzt.
- `checkout.ts` existiert schon nicht mehr; `game-state.ts` wird zu
  `toViewerState` umgebaut.
- Die Extension bleibt unverändert (auch der Navigationseintrag „Raspdarts“) –
  sie wird mit der Kachel umgebaut.
- `docs/projekt.md` wird an die neue Ausrichtung angepasst (Viewer statt
  Beamer, Projektion auf die Scheibe zuerst, Board-Verwaltung verworfen,
  neuer Grundsatz).
- `docs/referenz/autodarts-spielansicht/` (Referenzbilder und Mitschnitt) wird
  committet. Der Mitschnitt enthält nur Daten des Testkontos „testuser01“; die
  WebSocket-Adresse mit Zugangscode ist entfernt.

## Danach (Reihenfolge)

1. **Messung** mit Beamer und Darts: stört Licht auf der Scheibe die Erkennung
   (ruhig, blinkend, ohne Licht im Vergleich)? Danach Licht-Verhalten festlegen
   und ggf. 4-Ecken-Entzerrung.
2. Bust- und Endanimation (vorher aufnehmen).
3. Kachel auf play.autodarts.com/boards (Pi-Werte, Anzeige einstellen),
   Navigationseintrag entfällt, `beamer` in `/api/status` wird `viewer`.
4. Weitere Spielarten (Gotcha, Cricket …).

## Annahmen

- Die Anordnung der Spielerkarten bei 3+ Spielern und die Beschriftung `MISS`
  sind nicht gegen Autodarts geprüft.
- Der weiße Punkt neben dem Namen in der Autodarts-Karte wird nicht übernommen
  (Bedeutung unklar, kein eindeutiges Feld in den Daten).
- Autodarts' Koordinaten beziehen sich auf den Double-Ring außen (170 mm);
  abgeleitet aus der Autodarts-Zeichnung (Koordinate × 377,78 bei Double-Radius
  377,78) und durch den Geometrie-Test gegen die gemeldeten Felder abgesichert.
