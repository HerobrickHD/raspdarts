# Viewer-Profile – Inhalte wählen, dann Layout

Stand: 12. Oktober 2026

## Ziel

Es gibt **einen** Viewer, und den stellt man sich so ein, wie man ihn gerade
braucht. Statt nur Bausteine zu verschieben, wählt man zuerst, **was**
angezeigt wird (Checkboxen), und richtet danach das **Layout** ein. Die
Einstellungen liegen als **Profile** auf dem Pi; genau eins ist aktiv, und
jedes Gerät, das den Viewer öffnet, zeigt dieses Profil.

Die Liste der Optionen wird mit der Zeit sehr groß. Deshalb gibt es genau
eine Stelle, an der Optionen beschrieben werden (den **Katalog**); die
Checkbox-Liste entsteht daraus automatisch, und der Pi prüft jedes Profil
dagegen.

**Fertig heißt:**

- Im Viewer öffnet der Knopf „Einstellungen“ eine Seitenleiste mit Profilwahl,
  Vorlagen und der Inhalte-Liste; jede Änderung ist sofort auf allen Geräten
  zu sehen. „Weiter: Layout“ führt zum bekannten Ausrichten.
- Profile lassen sich anlegen (aus einer Vorlage), umbenennen, löschen und
  aktiv schalten; der Wechsel wirkt sofort auf allen Geräten.
- Das heute auf dem Pi ausgerichtete Layout ist nach dem Update als Profil
  „Standard“ unverändert da.
- Beim Drehen der Scheibe rastet sie bei 0°, 90°, 180° und −90° ein.
- Alle Tests laufen grün; Arnold hat den Viewer mit der Maus abgenommen.

**Nicht im Umfang:** Aussehen einzelner Optionen anpassen (Größe, Farbe,
Kartenstil), weitere Optionen über den Katalog unten hinaus, Profilwahl auf
der Board-Karte, Licht-Messung, Animationen, weitere Spielarten, Änderungen
an der Extension.

## Der Katalog

`server/src/viewer/catalog.ts` beschreibt alle Bausteine, ihre Optionen und
die Vorlagen. Er ist reine Daten; der Pi schickt ihn an den Viewer, der daraus
die Liste baut.

```ts
type Option =
  | { id: string; label: string; type: "toggle"; default: boolean }
  | { id: string; label: string; type: "choice";
      choices: { id: string; label: string }[]; default: string };

type Part = {
  id: string;          // Schlüssel in content, z. B. "spieler"
  label: string;       // „Spielerkarten“
  default: boolean;    // an/aus
  options: Option[];   // Einzelteile, aufgeklappt sichtbar
};

type Template = {
  id: string;          // "projektion"
  label: string;       // „Projektion“
  content: ContentPatch; // nur die Abweichungen von den Vorgaben
};
```

Ein Profil speichert die Inhalte als
`content: Record<PartId, { on: boolean } & Record<OptionId, boolean | string>>`.

### Erster Katalog

| Baustein (`id`) | Vorgabe | Optionen (`id`: Vorgabe) |
|---|---|---|
| Hintergrund (`hintergrund`) | aus | – |
| Scheibe (`scheibe`) | an | Darstellung (`darstellung`): Nur Licht `light` / Gezeichnet `drawn` / Linien `lines` – `light` · Zahlenring (`zahlenring`): an · Darts einzeichnen (`darts`): an · Letzten Dart leuchten (`letzterDart`): an |
| Aufnahme (`aufnahme`) | an | Darts (`darts`): an · Summe (`summe`): an |
| Spielinfo (`spielinfo`) | an | Punktzahl (`punktzahl`): an · Legs/Sets (`legs`): an · Modus (`modus`): an |
| Spielerkarten (`spieler`) | an | Kartenfläche (`flaeche`) · Profilbild (`profilbild`) · Name (`name`) · Flagge (`flagge`) · Rest (`rest`) · Legs (`legs`) · Checkout-Weg (`checkout`) · Average (`average`) · Dartzahl (`dartzahl`) – alle an |

### Vorlagen

| Vorlage | Abweichungen von den Vorgaben |
|---|---|
| **Projektion** (`projektion`) | Scheibe: Zahlenring aus · Spielinfo aus |
| **Fernseher** (`fernseher`) | Hintergrund an · Scheibe: Darstellung `drawn` |
| **Minimal** (`minimal`) | Aufnahme aus · Spielinfo aus · Spielerkarten: nur Kartenfläche, Name und Rest an |

Eine Vorlage ist nur ein **Startpunkt**: Sie belegt die Inhalte vor, danach
gehören sie dem Profil. Welche Vorlage einmal gewählt wurde, wird nicht
gespeichert.

### Eine Option dazunehmen

1. Eintrag im Katalog (mit Vorgabe; ggf. Wert in Vorlagen).
2. Im Viewer die Wirkung: meist eine CSS-Regel auf das Merkmal (siehe
   „Zeichnen“), sonst ein Blick in `content` beim Zeichnen.

Alte Profile bleiben gültig: Fehlende Optionen bekommen beim Lesen die
Vorgabe.

## Profile

### Datei

`data/profiles/<id>.json`:

```ts
type Profile = {
  version: 3;
  name: string;        // frei, 1–40 Zeichen, nur zur Anzeige
  content: Content;    // siehe Katalog
  layout: {
    board: { cx: number; cy: number; diameter: number; rotation: number };
    blocks: Record<"spielinfo" | "aufnahme" | `spieler-${1|2|3|4|5|6}`,
                   { x: number; y: number; scale: number }>;
  };
};
```

- Das Layout ist das bisherige ohne `boardMode` (das ist jetzt
  `content.scheibe.darstellung`); der Block `kopf` heißt jetzt `spielinfo`,
  wie der Baustein.
- Die `id` vergibt der Pi aus dem Namen (Kleinbuchstaben, Ziffern,
  Bindestrich; bei Doppelung `-2`, `-3` …; Muster wie bisher
  `^[a-z0-9][a-z0-9-]{0,31}$`). Sie ändert sich beim Umbenennen nicht.
- `data/profiles/active.json` enthält `{ "id": "<id>" }`.

### Prüfung

`sanitizeProfile` macht aus beliebigem Inhalt ein brauchbares Profil:

- `content`: pro Baustein und Option gegen den Katalog – unbekannte fallen weg,
  fehlende oder falsch getypte bekommen die Vorgabe, ein `choice`-Wert muss
  einer der `choices` sein.
- `layout`: wie bisher `sanitizeLayout` (Grenzen je Wert, blockweise Standard).
- `name`: getrimmt, länger als 40 Zeichen wird gekürzt, leer → „Profil“.
- Ohne `version: 3` → Standardprofil (Vorlage „Projektion“).

### Übernahme beim ersten Start

Gibt es `data/profiles/` noch nicht:

1. Liegt `data/layouts/standard.json` mit `version: 2` vor, entsteht das Profil
   `standard` „Standard“: Inhalte aus der Vorlage „Projektion“, Layout
   übernommen (`kopf` → `spielinfo`), `boardMode` → `scheibe.darstellung`.
2. Sonst entsteht `standard` „Standard“ aus „Projektion“ mit dem
   Standardlayout.
3. `standard` wird aktiv.

`data/layouts/` bleibt liegen (Rückweg), wird aber nicht mehr gelesen.

### Speichern

- Änderungen gelten sofort (Zwischenspeicher) und gehen gebündelt auf die
  SD-Karte (höchstens alle 500 ms), wie bisher.
- **Atomar:** erst `<id>.json.tmp` schreiben, dann umbenennen. (Offener Punkt
  aus dem Viewer-Review.)
- Es gibt immer mindestens ein Profil; das letzte lässt sich nicht löschen.
- Wird das aktive Profil gelöscht, wird das erste verbliebene (nach Name)
  aktiv.

## Schnittstelle

Alle schreibenden Aufrufe brauchen wie bisher den Header `X-Raspdarts: 1`.

| Methode | Pfad | Inhalt → Antwort |
|---|---|---|
| GET | `/api/profiles` | → `{ active: id, profiles: [{ id, name }] }` |
| GET | `/api/profiles/:id` | → `Profile & { id }` |
| POST | `/api/profiles` | `{ name, template }` → neues Profil (201), wird aktiv |
| PUT | `/api/profiles/:id` | Teilweise: `{ name?, content?, layout?, editing? }` → gültiges Profil; `editing`: `"inhalte"`, `"layout"` oder `null` |
| POST | `/api/profiles/:id/reset` | `{ template }` → Inhalte aus der Vorlage, Layout bleibt |
| DELETE | `/api/profiles/:id` | → 204; 409 beim letzten Profil |
| PUT | `/api/active-profile` | `{ id }` → `{ active }`; 404 bei unbekanntem Profil |

`/api/layout/:display` fällt weg (nur der Viewer selbst benutzte es).
`?display=` in der Adresse wird ignoriert; die Kiosk-Adresse in der README
wird angepasst.

### WebSocket `/ws`

Beim Verbinden schickt der Pi nacheinander:

- `{ type: "catalog", catalog }` – Bausteine, Optionen, Vorlagen
- `{ type: "state", state }` – unverändert
- `{ type: "profile", profile: Profile & { id }, profiles: [{ id, name }], editing: "inhalte" | "layout" | null }`

Danach geht `profile` an **alle** Viewer bei jeder Änderung des aktiven
Profils, bei einem Wechsel des aktiven Profils und bei jeder Änderung der
Profilliste (anlegen, umbenennen, löschen). Änderungen an einem nicht aktiven
Profil gibt es über die Oberfläche nicht.

`editing` gilt für den ganzen Viewer (nicht mehr je Anzeigename) und sagt,
in welchem Schritt gerade eingestellt wird: Bei `"inhalte"` zeigen alle Geräte
ohne laufendes Spiel Beispieldaten in der echten Darstellung, bei `"layout"`
zusätzlich die Scheibe als Linien. Es wird mit `PUT /api/profiles/:id`
(nur für das aktive Profil, nur wenn mitgeschickt) gesetzt, fällt nach 60 s ohne Änderung von selbst
zurück und endet beim Wechsel des aktiven Profils.

## Bedienung im Viewer

Der Knopf unten heißt **„Einstellungen“** (bisher „Layout“). Er erscheint wie
bisher nur, solange sich die Maus bewegt (3 s). Er öffnet eine
**Seitenleiste rechts** über dem Bild; das Bild selbst springt nicht.

### Schritt 1 – Inhalte

```
Profil: [Standard ▾]  [＋ Neu] [✎ Umbenennen] [🗑]
Vorlage: [Projektion] [Fernseher] [Minimal]
Anpassen:
 ☑ Hintergrund
 ☑ Scheibe            ▾
     Darstellung (•) Nur Licht ( ) Gezeichnet ( ) Linien
     ☑ Zahlenring ☑ Darts einzeichnen ☑ Letzten Dart leuchten
 ☑ Spielerkarten      ▸
 ☑ Aufnahme           ▸
 ☐ Spielinfo          ▸
                       [ Weiter: Layout → ]
```

- Die Liste entsteht aus dem Katalog: je Baustein eine Checkbox (an/aus) und
  ein Pfeil zum Aufklappen der Optionen (`toggle` = Checkbox, `choice` =
  Auswahlknöpfe). Ist ein Baustein aus, sind seine Optionen ausgegraut.
- Jede Änderung geht sofort (gedrosselt, höchstens alle 100 ms) an den Pi und
  von dort an alle Geräte – am Beamer sieht man live, was man anklickt.
- Ohne laufendes Spiel zeigt der Viewer bei offener Leiste Beispieldaten,
  wie bisher im Editor.
- **Profil-Menü:** Auswahl macht das Profil für alle aktiv.
- **＋ Neu:** kleines Formular in der Leiste (Name, Vorlage), legt an und
  schaltet um.
- **✎ Umbenennen:** Name direkt in der Leiste bearbeiten.
- **🗑 Löschen** und **Vorlage anklicken** fragen vorher in der Leiste nach
  („Inhalte von ‚Standard‘ auf ‚Fernseher‘ zurücksetzen? Das Layout bleibt.“).
  Löschen ist beim letzten Profil gesperrt.
- In Schritt 1 zeigen alle Geräte die echte Darstellung (nicht „Linien“),
  ohne laufendes Spiel mit Beispieldaten.

### Schritt 2 – Layout

- Die Leiste schrumpft auf die Werkzeugleiste unten: Hinweistext,
  „← Inhalte“ und „Fertig“. **Esc** = Fertig.
- Ziehen, Größe, Drehen und Tastatur wie bisher. Die Knöpfe
  „Nur Licht“/„Gezeichnet“ fallen weg (jetzt in Schritt 1).
- Platzierbar ist nur, was in Schritt 1 eingeschaltet ist.
- Wie bisher zeigen alle Geräte in diesem Schritt die Scheibe als „Linien“
  (mit Zahlen, als Hilfe zum Ausrichten).

### Einrasten beim Drehen

- Beim Ziehen am Drehgriff rastet die Drehung bei 0°, 90°, 180° und −90°
  ein, solange sie weniger als **3°** davon entfernt ist.
- Mit gedrückter **Alt**-Taste dreht man frei.
- Die Tastatur (`Q`/`E`) rastet nie ein, damit Feinschritte um 0° möglich
  bleiben.
- Reine Funktion `snapRotation(deg, { free })` mit Tests; Werte und Winkel
  sind Konstanten, damit „später anpassen“ eine Zeile ist.

## Zeichnen

- Der Viewer setzt die Inhalte als Merkmale an `#viewer`, z. B.
  `data-hintergrund="on"`, `data-spieler-profilbild="off"`,
  `data-scheibe-darstellung="drawn"`. Ein-/Ausblenden läuft damit über CSS.
- Ausgeschaltete Bausteine werden nicht angezeigt, auch nicht im
  Layout-Schritt.
- **Scheibe:** `darstellung` ersetzt `boardMode` (im Layout-Schritt weiter
  `lines`). `zahlenring` wirkt in „Gezeichnet“ und „Linien“; in „Nur Licht“
  gibt es keinen Zahlenring. `darts` und `letzterDart` blenden die Ebenen der
  Darts bzw. Hervorhebungen aus.
- **Hintergrund:** eigener Nachbau des Autodarts-Hintergrunds mit CSS/SVG –
  dunkles Blau mit Verlauf und schwachen, großen Winkelformen; kein Bild von
  Autodarts. Aus = rein schwarz wie bisher.
- **Kartenfläche aus:** Die Karte hat keinen Hintergrund; nur Schrift, Zahlen
  und Kästchen leuchten. Der aktive Spieler ist dann an der lila-roten Schrift
  von Name und Rest zu erkennen, der Sieger an grüner, Bust an grauer.
- Ausgeschaltete Teile einer Karte (Profilbild, Flagge, Legs …) fallen weg,
  ohne dass die Karte ihre Grundgröße ändert.

## Fehlerfälle

- Kaputte Profildatei: optionsweise Vorgaben (siehe Prüfung); gar nicht
  lesbar → Standardprofil unter dieser `id`.
- `active.json` fehlt, kaputt oder zeigt auf ein fehlendes Profil: erstes
  Profil (nach Name) wird aktiv.
- Ordner leer: „Standard“ wird neu angelegt.
- Ungültige `id` in der Adresse: 400 (kein `../`), unbekannte: 404.
- Verzeichnis nicht schreibbar: einmal Warnung im Log, Änderungen gelten bis
  zum Neustart im Speicher (wie bisher).
- Zwei Geräte bearbeiten gleichzeitig: Die letzte Änderung gewinnt.

## Tests

- **Katalog und Prüfung:** Vorgaben vollständig; jede Vorlage ergibt ein
  gültiges Profil; unbekannte, fehlende und falsch getypte Optionen;
  ungültiger `choice`-Wert; Name; Layout-Grenzen.
- **Übernahme:** `standard.json` (version 2) → Profil mit gleichem Layout,
  `kopf` → `spielinfo`, `boardMode` → `darstellung`; ohne alte Datei
  Standard aus „Projektion“.
- **Profilspeicher:** anlegen (id aus Name, Doppelung), umbenennen (id
  bleibt), löschen (nicht das letzte, aktives → anderes aktiv), aktiv
  wechseln, gebündeltes und atomares Schreiben, kaputtes `active.json`.
- **Hub:** Katalog, Stand und Profil beim Verbinden; Änderung, Wechsel und
  Listenänderung an alle; `editing` fällt nach 60 s zurück und endet beim
  Wechsel.
- **HTTP:** alle neuen Endpunkte inkl. 400/404/409 und Header-Pflicht.
- **Einrasten:** `snapRotation` an den Grenzen (2,9° → 0, 3,1° → 3,1,
  178° → 180, −178° → −180, mit Alt unverändert).
- **Von Hand:** Mitschnitt abspielen
  (`npm run replay -- test/fixtures/autodarts-2026-10-08.ndjson --instant --stop 139`),
  zwei Fenster `http://localhost:8743/`: Inhalte umschalten (anderes Fenster
  folgt), Vorlagen, Profile anlegen/umbenennen/löschen/wechseln, Layout mit
  Einrasten, Esc. Danach Update auf den Pi und Kontrolle, dass „Standard“ das
  alte Layout hat.
- **Abnahme:** Arnolds Maus-Test.

## Was sich sonst ändert

- `layout-store.ts` wird zu `profile-store.ts`; `display-name.js` und
  `?display=` entfallen samt Tests.
- README: Kiosk-Adresse ohne `?display=`, Schnittstellentabelle, Abschnitt
  zur Bedienung.
- Der offene Punkt „Ziel von *Viewer öffnen*“ ist erledigt: Die Extension
  öffnet `http://raspdarts.local:8743/`, was dort erscheint, bestimmt das
  aktive Profil.
