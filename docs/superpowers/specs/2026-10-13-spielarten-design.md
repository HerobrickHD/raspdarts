# Spielarten und Spielerbereiche im Profil

Stand: 13. Oktober 2026

## Ziel

Autodarts bietet elf Spielarten (ohne die Abo-Spielarten 121 und Killer), und
Lobbys haben bis zu sechs Spieler. Jede Spielart braucht womöglich ein anderes
Layout, und der Viewer muss mit 1 bis 6 Spielern zurechtkommen.

Deshalb bekommt jedes Profil einen **gemeinsamen Teil** (Scheibe und
Hintergrund) und einen **Teil je Spielart** (Bausteine, Optionen, Layout).
Jede Spielart hat einen **Standard**; ein Profil speichert nur die Spielarten,
die man angepasst hat. Startet ein Spiel, zeichnet der Viewer nach dem Teil
des aktiven Profils für diese Spielart. Die Spieler stehen nicht mehr auf
sechs festen Plätzen, sondern in **zwei Spielerbereichen**, in denen sich die
Karten selbst anordnen.

Dieser Schritt ist das **Grundgerüst**. Die Logik einzelner Spielarten
(z. B. die Cricket-Tabelle) kommt später, je mit einem Mitschnitt.

**Fertig heißt:**

- Alle elf Spielarten stehen im Katalog, jede mit Standard und Beispieldaten.
- In der Seitenleiste wählt man die Spielart und die Spielerzahl der Vorschau;
  alle Geräte zeigen live, was man einstellt.
- Spielarten lassen sich anpassen und auf den Standard zurücksetzen.
- Ein laufendes Spiel wird nach seiner Spielart gezeichnet; andere
  Spielarten als X01 zeigen den allgemeinen Teil (Scheibe, Darts, Aufnahme,
  Spielerkarten mit Name und Punktestand) statt „nicht unterstützt“.
- 1 bis 6 Spieler verteilen sich auf die beiden Bereiche, alle Karten gleich
  groß, nichts springt während des Spiels.
- Nach dem Update sieht X01 mit 2 Spielern auf dem Pi genauso aus wie vorher.
- Alle Tests laufen grün; Arnold hat den Viewer mit der Maus abgenommen.

**Nicht im Umfang:** Bausteine einzelner Spielarten (Cricket-Tabelle, Ziel
bei Around The Clock …), Prüfung der Autodarts-Daten anderer Spielarten
(braucht Mitschnitte), Aussehen anpassen (Größe/Farbe/Kartenstil), 121 und
Killer, Änderungen an der Extension.

## Spielarten

Der Katalog (`server/src/viewer/catalog.ts`) bekommt die Liste der
Spielarten. Sie ist die einzige Stelle, an der Spielarten beschrieben werden.

```ts
type GameMode = {
  id: string;          // "x01"
  label: string;       // „X01“
  group: "spiele" | "training" | "party";
  /** Werte von `variant` in den Autodarts-Daten, die diese Spielart meinen. */
  variants: string[];
  /** true, sobald ein Mitschnitt die Daten bestätigt hat. */
  verified: boolean;
};
```

| Gruppe | Spielart (`id`) | `variants` (ungeprüft außer X01) |
|---|---|---|
| Spiele | X01 (`x01`) | `X01` – geprüft |
| Spiele | Cricket / Taktik (`cricket`) | `Cricket`, `Tactics` |
| Training | Count Up (`count-up`) | `Count Up`, `CountUp` |
| Training | Around The Clock (`around-the-clock`) | `ATC`, `Around The Clock` |
| Training | Zufälliges Checkout (`random-checkout`) | `Random Checkout`, `RandomCheckout` |
| Training | Round the World (`round-the-world`) | `RTW`, `Round The World` |
| Training | Segmenttraining (`segment-training`) | `Segment Training`, `SegmentTraining` |
| Training | Bob's 27 (`bobs-27`) | `Bob's 27`, `Bobs27` |
| Party | Shanghai (`shanghai`) | `Shanghai` |
| Party | Gotcha (`gotcha`) | `Gotcha` |
| Party | Bermuda (`bermuda`) | `Bermuda` |

- Der Vergleich mit `variant` ignoriert Groß-/Kleinschreibung, Leerzeichen
  und Satzzeichen.
- Mit dem ersten Mitschnitt einer Spielart werden `variants` korrigiert und
  `verified` gesetzt.
- 121 und Killer stehen nicht im Katalog; sie laufen wie eine unbekannte
  Spielart.

### Erkennen

`game-state.ts` erkennt die Spielart aus `variant`:

- **X01** wie bisher, mit allen Feldern.
- **Jede andere (auch unbekannte)** Spielart: allgemeiner Stand mit
  Spielern (Name, Profilbild, Flagge, Punktestand aus `gameScores`, Legs,
  Sets, Dartzahl, aktiv, Sieger) und der laufenden Aufnahme (Darts mit
  Koordinaten, Summe). Alles, was fehlt oder nicht passt, wird weggelassen,
  nicht geraten. `phase: "unsupported"` entfällt.
- Der ViewerState bekommt `mode: string | null` (die `id` aus dem Katalog)
  und `variant: string` (roher Wert).
- Eine unbekannte `variant` ergibt `mode: null`. Der Pi meldet sie einmal je
  Wert im Log („Spielart ‚…‘ unbekannt – allgemeine Darstellung“). Der
  Viewer zeichnet sie nach dem Profilteil von **X01**, aber nur mit den
  Bausteinen und Optionen, die es in allen Spielarten gibt.

## Bausteine je Spielart

Bausteine und Optionen bekommen eine Angabe, in welchen Spielarten es sie
gibt (`modes`: Liste von ids; fehlt sie, gibt es sie überall).

| Baustein | Teil | Optionen (`id`) | Gibt es in |
|---|---|---|---|
| Hintergrund (`hintergrund`) | gemeinsam | – | – |
| Scheibe (`scheibe`) | gemeinsam | `darstellung`, `zahlenring`, `darts`, `letzterDart` | – |
| Aufnahme (`aufnahme`) | je Spielart | `darts`, `summe` | allen |
| Spielinfo (`spielinfo`) | je Spielart | `spielart` *(neu: Name der Spielart)* | allen |
| | | `punktzahl`, `modus` | X01 |
| | | `legs` | X01, Cricket |
| Spielerkarten (`spieler`) | je Spielart | `verteilung` *(neu)*, `flaeche`, `profilbild`, `name`, `flagge`, `rest` (Beschriftung neu: „Punktestand“), `dartzahl` | allen |
| | | `legs` | X01, Cricket |
| | | `average` | X01 |
| | | `checkout` | X01, Zufälliges Checkout |

- `verteilung` (choice): „Links und rechts“ `beide` (Vorgabe) / „Nur links“
  `links` / „Nur rechts“ `rechts`.
- Was es in einer Spielart nicht gibt, steht in ihrer Liste nicht und wird
  nicht gezeichnet; gespeicherte Werte dafür fallen beim Prüfen weg.
- Später kommen Bausteine einzelner Spielarten (z. B. `cricket-tabelle`,
  nur `cricket`) als eigene Katalogeinträge dazu.

### Standard je Spielart

Ein Standard ist wie bisher eine Vorlage aus Abweichungen von den Vorgaben,
jetzt mit Layout:

```ts
type ModeStandard = {
  mode: string;              // id der Spielart
  content: ContentPatch;     // nur Bausteine je Spielart
  layout: Partial<ModeLayout>;
};
```

Zu Beginn sind alle Standards gleich: Spielinfo aus, alles andere an, Layout
wie unten. Unterschiede kommen mit den Bausteinen der Spielarten.

**Gemeinsamer Standard** (für neue Profile): Hintergrund aus, Scheibe an,
Darstellung „Nur Licht“, Zahlenring aus, Darts und letzter Dart an – wie die
bisherige Vorlage „Projektion“.

Die Vorlagen **Projektion, Fernseher und Minimal entfallen**.

## Profil (Version 4)

`data/profiles/<id>.json`:

```ts
type Profile = {
  version: 4;
  name: string;
  gemeinsam: {
    content: { hintergrund: PartContent; scheibe: PartContent };
    board: { cx: number; cy: number; diameter: number; rotation: number };
  };
  /** Nur angepasste Spielarten; alle anderen folgen ihrem Standard. */
  spielarten: Record<ModeId, {
    content: Content;        // Bausteine je Spielart
    layout: ModeLayout;
  }>;
};

type ModeLayout = {
  blocks: {
    spielinfo: { x: number; y: number; scale: number };
    aufnahme:  { x: number; y: number; scale: number };
    "bereich-links":  Area;
    "bereich-rechts": Area;
  };
};

type Area = {
  x: number;   // linke obere Ecke, Prozent der Breite
  y: number;   // Prozent der Höhe
  w: number;   // Breite in vh
  h: number;   // Höhe in vh
};
```

- Breite und Höhe der Bereiche in vh wie alle Größen im Viewer, damit das
  Layout bei jeder Auflösung passt. Grenzen: `w` 5–300, `h` 5–100.
- **Ausgewertet** wird ein Profil für eine Spielart so: gemeinsamer Teil +
  (angepasster Teil der Spielart oder ihr Standard). Das ergibt dieselbe Form,
  die der Viewer heute zeichnet (Inhalte + Layout), plus Bereiche.
- Eine Spielart gilt als **angepasst**, sobald sie in `spielarten` steht.
  Jede Änderung an ihren Inhalten oder ihrem Layout legt den Eintrag an
  (aus dem Standard, dann geändert). **Zurücksetzen** löscht den Eintrag.

### Prüfung

- `gemeinsam` und jeder Eintrag in `spielarten` werden wie bisher
  optionsweise gegen den Katalog geprüft; Optionen, die es in der Spielart
  nicht gibt, fallen weg; fehlende kommen aus dem Standard der Spielart.
- Unbekannte Spielart-ids in `spielarten` fallen weg.
- Layout: Grenzen je Wert, kaputter Block → Block aus dem Standard.

### Übernahme von Version 3

Beim Lesen eines Profils mit `version: 3`:

1. `gemeinsam.content` ← `content.hintergrund`, `content.scheibe`;
   `gemeinsam.board` ← `layout.board`.
2. `spielarten.x01` wird angelegt: `content` ← übrige Bausteine (Spielinfo,
   Aufnahme, Spielerkarten; `verteilung: "beide"`), `layout.blocks` ←
   `spielinfo` und `aufnahme` unverändert.
3. Bereiche aus den Karten 1 und 2: `bereich-links` ← `spieler-1` mit
   `x`, `y` wie gespeichert, `w = 49 · scale`, `h = 34 · scale`;
   `bereich-rechts` ebenso aus `spieler-2`. (49 vh × 34 vh ist die
   Grundgröße einer Karte.) Mit 2 Spielern füllt jede Karte ihren Bereich
   genau – das Bild ist dasselbe wie vorher.
4. `spieler-3` bis `spieler-6` werden nicht übernommen.
5. Die Datei wird beim nächsten Schreiben als Version 4 gespeichert.

Ohne `version: 3` oder `4` → neues Profil wie bisher.

### Neues Profil

`POST /api/profiles { name }`: gemeinsamer Standard, keine angepassten
Spielarten; `gemeinsam.board` wird aus dem **aktiven Profil** übernommen
(derselbe Beamer). Ohne aktives Profil: Standardlage der Scheibe.

## Spielerbereiche

Eine reine Funktion (`public/js/areas.js`, wird im Viewer und in Tests
benutzt) rechnet aus Spielerzahl, Verteilung und den beiden Rechtecken die
Lage jeder Karte:

- **Verteilung:** `beide` → Spieler 1, 3, 5 links, 2, 4, 6 rechts; `links` bzw.
  `rechts` → alle in diesen Bereich, der andere ist ausgeblendet.
- **Anordnung:** Karten untereinander, Abstand 1,5 vh, als Gruppe senkrecht
  mittig im Bereich; im linken Bereich links bündig, im rechten rechts
  bündig (zum Bildrand hin).
- **Größe:** `n` = Kartenzahl im volleren Bereich. Für jeden sichtbaren
  Bereich mit Breite `w` und Höhe `h`:
  `s = min(w / 49, (h − 1,5 · (n − 1)) / (34 · n))`. Es gilt das kleinere `s`
  der sichtbaren Bereiche; alle Karten sind gleich groß. 49 vh × 34 vh ist
  die Grundgröße einer Karte (`style.css`); beide Zahlen stehen als
  Konstanten in `areas.js`.
- Die Größe hängt nur von der Spielerzahl ab und ändert sich im Spiel nicht.
  Der aktive Spieler wird hervorgehoben wie bisher, nicht vergrößert.
- Verteilt wird nach dem **Platz** des Spielers (siehe unten), nicht nach
  seiner Stelle in den Autodarts-Daten.

### Feste Plätze im Match

Bei mehreren Legs oder Sets (z. B. Best of 3) kann Autodarts die Reihenfolge
der Spieler je Leg ändern. Damit niemand mitten im Match die Seite wechselt,
behält jeder Spieler seinen Platz für das ganze Match:

- Der Pi merkt sich je Match (`id` des Matches) die Reihenfolge der
  Spieler-`id`s aus dem **ersten** Stand, den er davon sieht. Platz 1 ist
  der erste Spieler darin, Platz 2 der zweite usw.
- `PlayerView` bekommt `seat` (1–6). Die Bereiche verteilen nach `seat`
  (Platz 1, 3, 5 links; 2, 4, 6 rechts); die Karten eines Bereichs stehen
  nach `seat` sortiert.
- Ein Spieler, der im gemerkten Match noch nicht vorkam, bekommt den
  nächsten freien Platz. Fehlt die Spieler-`id`, zählt die Stelle in den
  Daten.
- Ein neues Match (andere `id`) ordnet neu. Gemerkt wird nur das laufende
  Match, im Speicher, nicht auf der SD-Karte.
- Ob Autodarts die Liste `players` umstellt oder nur den beginnenden
  Spieler wechselt, ist ungeprüft (der Mitschnitt hat ein Leg). Die Plätze
  sind in beiden Fällen richtig; das erste Best-of-3 gegen den Mitschnitt
  bestätigt es.

**Standardlage** (alle Standards): `bereich-links { x: 1.4, y: 32.7, w: 49,
h: 34 }`, `bereich-rechts { x: 71, y: 32.7, w: 49, h: 34 }` – entspricht den
bisherigen Karten 1 und 2. Bei mehr Spielern muss man die Bereiche höher
ziehen; dafür gibt es die Vorschau mit 1 bis 6 Spielern.

## Schnittstelle

Schreibende Aufrufe brauchen wie bisher `X-Raspdarts: 1`.

| Methode | Pfad | Inhalt → Antwort |
|---|---|---|
| GET | `/api/profiles` | unverändert `{ active, profiles: [{ id, name }] }` |
| GET | `/api/profiles/:id` | → Profil (Version 4) `& { id }` |
| POST | `/api/profiles` | `{ name }` → neues Profil (201), wird aktiv |
| PUT | `/api/profiles/:id` | Teilweise: `{ name?, gemeinsam?: { content?, board? }, spielart?: { id, content?, layout? }, editing? }` |
| POST | `/api/profiles/:id/reset` | `{ spielart }` → Spielart auf Standard; 400 bei unbekannter |
| DELETE | `/api/profiles/:id` | unverändert |
| PUT | `/api/active-profile` | unverändert |

- `spielart` mit unbekannter id → 400.
- `editing`: `{ schritt: "inhalte" | "layout", spielart: id, spieler: 1–6 }`
  oder `null`; fällt wie bisher nach 60 s ohne Änderung zurück und endet beim
  Profilwechsel.

### WebSocket `/ws`

- `catalog` enthält zusätzlich `modes` und `standards`, ohne `templates`.
- `profile` schickt das rohe Profil (Version 4) mit `profiles` und `editing`;
  der Viewer wertet es für die anzuzeigende Spielart selbst aus (dieselbe
  Funktion wie der Pi, siehe „Was sich sonst ändert“).
- `state` bekommt `mode` (siehe Erkennen).

## Bedienung

### Schritt „Inhalte“

```
Profil: [Standard ▾]  [Neu] [Umbenennen] [Löschen]

Gemeinsam – gilt für alle Spielarten
 ☑ Hintergrund
 ☑ Scheibe            ▾  Darstellung, Zahlenring, Darts, letzter Dart

Spielart: [X01 ▾]  angepasst · [Auf Standard zurücksetzen]
Vorschau mit Spielern: [1] [2] [3] [4] [5] [6]
 ☑ Spielerkarten      ▾  Verteilung, Profilbild, Name, …
 ☑ Aufnahme           ▸
 ☐ Spielinfo          ▸
                          [ Weiter: Layout → ]
```

- **Spielart-Auswahl** gruppiert nach Spiele / Training / Party; jede mit
  dem Zusatz „angepasst“ oder „Standard“. Darunter nur die Bausteine und
  Optionen dieser Spielart.
- **Vorschau:** Ohne laufendes Spiel zeigen alle Geräte Beispieldaten der
  gewählten Spielart mit der gewählten Spielerzahl. Läuft ein Spiel, steht
  die Auswahl beim Öffnen auf dessen Spielart, die Vorschau zeigt das echte
  Spiel und die Spielerzahl-Knöpfe sind gesperrt.
- Spielart und Spielerzahl gehen als `editing` an den Pi und von dort an
  alle Geräte.
- **Auf Standard zurücksetzen** (nur bei angepassten Spielarten) fragt in
  der Leiste nach: „X01 in ‚Standard‘ auf den Standard zurücksetzen? Inhalte
  und Layout dieser Spielart gehen verloren, die Scheibe bleibt.“
- **Neu:** nur noch Name; die Vorlagen-Knöpfe entfallen.
- Die erste Änderung an einer Spielart im Standard macht sie zu „angepasst“.

### Schritt „Layout“

- Werkzeugleiste: „X01 · 4 Spieler“, Spielerzahl-Knöpfe 1–6 (gesperrt bei
  laufendem Spiel), Hinweistext, „← Inhalte“, „Fertig“. Esc = Fertig.
- **Bereiche** erscheinen als Rahmen mit den Karten der Vorschau darin. Man
  verschiebt sie durch Ziehen und ändert Breite und Höhe an Ecken und
  Kanten (Mindestmaß wie die Grenzen). Tastatur: Pfeile verschieben wie
  bisher; Größe mit Umschalt+Pfeil (Breite links/rechts, Höhe hoch/runter).
- Ein ausgeblendeter Bereich (Verteilung „Nur links“/„Nur rechts“) wird
  nicht gezeigt.
- Die Scheibe lässt sich wie bisher ausrichten; der Hinweistext sagt, dass
  das für **alle** Spielarten gilt.
- Spielinfo und Aufnahme wie bisher (Ziehen, Größe).

## Zeichnen

- Der Viewer bestimmt die anzuzeigende Spielart: bei offener Leiste die aus
  `editing`, sonst die des laufenden Spiels, nach dem Spiel die zuletzt
  gespielte, nach dem Start X01.
- Er wertet das Profil dafür aus und setzt die Merkmale an `#viewer` wie
  bisher (`data-spieler-verteilung="beide"` usw.) sowie
  `data-spielart="cricket"`.
- Optionen, die es in der Spielart nicht gibt, gelten als aus.
- Die Spielerkarten werden aus `areas.js` nach `seat` platziert; Karten gibt
  es so viele wie Spieler (Autodarts erlaubt höchstens 6).
- Beispieldaten (`sample-state.js`): je Spielart ein Stand mit 6 Spielern,
  von dem die Vorschau die ersten n zeigt; Punktestände passend zur
  Spielart (X01: Rest, sonst Punkte), Checkout nur wo es ihn gibt.

## Fehlerfälle

- Unbekannte `variant`: allgemeine Darstellung nach dem X01-Teil, einmal je
  Wert im Log.
- Kaputter Spielart-Eintrag: optionsweise aus dem Standard ergänzt;
  ganz unbrauchbar → Eintrag fällt weg (Spielart folgt dem Standard).
- Alles andere wie bisher (kaputte Datei, `active.json`, ungültige id,
  nicht schreibbares Verzeichnis, letzte Änderung gewinnt).

## Tests

- **Katalog:** jede Spielart hat einen Standard, der ein gültiges Profil
  ergibt; `modes` der Bausteine verweisen nur auf bekannte Spielarten; jede
  Option kommt im CSS vor (bestehender Test).
- **Erkennen:** `variant` → Spielart (Schreibweisen, unbekannt → X01-Teil);
  allgemeiner Stand aus einem gebauten Nicht-X01-Frame; X01 unverändert
  (bestehende Tests).
- **Profil:** Auswerten (angepasst vs. Standard), Prüfung je Spielart,
  unbekannte Spielarten, Optionen außerhalb der Spielart.
- **Übernahme v3 → v4:** gemeinsamer Teil, X01 angepasst, Bereiche aus
  Karte 1/2 mit `w = 49 · scale`, `h = 34 · scale`; mit 2 Spielern liefert
  `areas.js` genau die alte Lage und Größe.
- **Feste Plätze:** gleiche Spieler in anderer Reihenfolge im selben Match
  → gleiche `seat`; neues Match → neu geordnet; Spieler ohne `id`; neuer
  Spieler im Match → nächster freier Platz.
- **Bereiche (`areas.js`):** 1 bis 6 Spieler × drei Verteilungen; gleiche
  Größe in beiden Bereichen; Breite begrenzt; Mittigkeit.
- **Profilspeicher:** anlegen (Scheibe aus aktivem Profil), Spielart ändern
  legt Eintrag an, zurücksetzen löscht ihn, gemeinsamen Teil ändern.
- **HTTP und Hub:** neue Felder, 400 bei unbekannter Spielart, `editing` mit
  Spielart und Spielerzahl.
- **Von Hand:** Mitschnitt abspielen
  (`npm run replay -- test/fixtures/autodarts-2026-10-08.ndjson --instant --stop 139`),
  zwei Fenster `http://localhost:8743/`: Spielart wechseln, Vorschau 1–6
  Spieler, Bereiche ziehen und Größe ändern, anpassen und zurücksetzen,
  Scheibe in einer Spielart verschieben → gilt in allen.
- **Pi:** vorher `data/profiles/` sichern; nach dem Update X01 mit 2
  Spielern gegen vorher vergleichen (Bildschirmfoto gleich).
- **Abnahme:** Arnolds Maus-Test.

## Was sich sonst ändert

- Die Auswertung „Profil + Spielart → Inhalte und Layout“ und die Aufteilung
  der Bereiche werden im Viewer gebraucht. Sie liegen deshalb in
  `public/js/` (`resolve-profile.js`, `areas.js`); die Server-Tests
  importieren sie von dort, wie schon bei `rotation.js` und
  `content-view.js`. Der Pi prüft, speichert und legt beim ersten Ändern
  einer Spielart ihren Eintrag aus dem Standard an.
- `PLAYER_BLOCKS` (`spieler-1` … `spieler-6`) entfallen aus `layout.ts`.
- README: Spielarten, Bereiche, neue Felder der Schnittstelle.
