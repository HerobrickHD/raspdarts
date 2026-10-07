# Raspdarts-Seite in Autodarts statt Popup

Stand: 7. Oktober 2026

## Ziel

Autodarts hat seine Oberfläche umgebaut: Statt einer Seitenleiste gibt es eine
Kopfleiste mit Hauptnavigation (Start · Spielen · Online · Turniere · Stats),
und ein Klick tauscht nur den Inhaltsbereich darunter aus. Der Eintrag
„Raspdarts“ sitzt seit `c398eca` wieder in dieser Navigation, öffnet aber noch
das alte Popup (`modal.html`).

Künftig öffnet „Raspdarts“ eine eigene Seite im Inhaltsbereich, die aussieht
wie eine Autodarts-Seite. Die Funktionen bleiben dieselben wie im Popup.

**Fertig heißt:** Arnold klickt auf „Raspdarts“, der Eintrag wird aktiv wie
„Start“ oder „Spielen“, und im Inhaltsbereich erscheint die Raspdarts-Seite im
Autodarts-Stil, in der Sprache von Autodarts. Ein Klick auf einen anderen
Eintrag führt zurück zu Autodarts. Update, Installation, Neustart usw.
funktionieren am echten Pi wie bisher; das Protokoll läuft in der Seite mit.

**Nicht im Umfang:** neue Funktionen (z. B. Beamer-Einstellungen über
`/api/layout`), Bedienung auf schmalen Bildschirmen und Handys, Änderungen am
Pi-Dienst.

## Einbindung in Autodarts

Autodarts ist eine Single-Page-App (TanStack Router). Aufbau:

```
#root > div.h-screen
  header                     Logo · nav[aria-label="Hauptnavigation"] · Avatar/Freunde/Glocke
  div.flex-1 > … > main      Inhaltsbereich, wird bei jedem Seitenwechsel neu befüllt
```

- **Unsere Seite** ist ein `div#raspdarts-page` als zusätzliches Kind von
  `main` (Höhe 100 %, eigener Scrollbereich). Ihr Inhalt steckt in einem
  Shadow DOM, damit Autodarts' CSS und unseres sich nicht beeinflussen.
- **Sichtbar schalten** über das Attribut `data-raspdarts-page` an `<html>`.
  Ein eigenes `<style>` im Dokument blendet dann die übrigen Kinder von `main`
  aus, macht den aktiven Autodarts-Eintrag grau und unseren weiß. An
  Autodarts' eigenen Elementen ändern wir dafür keine Klassen.
- **Unterstrich:** Autodarts schiebt einen Balken (letztes Kind der Navigation,
  per Inline-`left`/`width`) unter den aktiven Eintrag. Beim Öffnen merken wir
  uns diese beiden Werte und schieben den Balken unter „Raspdarts“; beim
  Verlassen stellen wir sie wieder her.
- **Adresse:** bleibt unverändert. Neuladen führt zur Autodarts-Seite zurück,
  auf der man vorher war.

### Öffnen und Verlassen

- Klick auf „Raspdarts“ zeigt die Seite. Beim ersten Mal wird sie gebaut.
- Verlassen bei
  - jeder Adressänderung (Prüfung von `location.href` im ohnehin laufenden
    MutationObserver, zusätzlich `popstate`),
  - jedem Klick auf einen Link (`a`) in der Kopfleiste, auch wenn sich die
    Adresse nicht ändert (z. B. „Start“, während man auf `/` ist).
- Avatar, Freunde und Glocke öffnen Schubladen über der Seite; unsere Seite
  bleibt dabei stehen.
- Beim Verlassen wird die Seite nur versteckt, nicht abgebaut. Eine laufende
  Aktion samt Protokoll läuft weiter und ist beim Zurückkommen zu sehen.
- Baut Autodarts `main` neu auf (Seitenwechsel), hängt `content.js` die Seite
  beim nächsten Öffnen wieder ein; der Zustand (Protokoll, letzte Werte) liegt
  in JavaScript, nicht im DOM.

## Aufbau der Seite

Freigegeben als Entwurf im Browser am 7. Oktober 2026.

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Logo] RASPDARTS        │ CPU   │ RAM          │ Temperatur │ Laufzeit │
│        ● Pi online · IP │ 12%   │ 1.2 / 3.7 GB │ 48°C       │ 3h 12m   │
└──────────────────────────────────────────────────────────────────────┘
┌───────────────────────────────┐ ┌──────────────────────────────────────┐
│ AUTODARTS        🗑 Deinstall. │ │ RASPBERRY PI  🗑 Raspdarts deinstall. │
│ Version              0.27.4   │ │ Raspdarts                  v2.0.0    │
│ Status          ● Installiert │ │ Beamer               ● Verbunden     │
│ [Autodarts aktualisieren]     │ │ [Raspdarts aktualisieren]            │
│ [Monitor öffnen ↗]            │ │ [Neu starten] [Herunterfahren]       │
└───────────────────────────────┘ └──────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ RASPDARTS AKTUALISIEREN                               ◌ Läuft …      │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Protokoll (Monospace, scrollt mit)                               │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

- **Raster** wie Autodarts' Startseite: max. 1600 px breit, zentriert,
  Innenabstand 40 px oben / 24 px seitlich, 24 px Abstand zwischen Karten.
  Die beiden Karten stehen nebeneinander (je halbe Breite).
- **Banner** nach Vorbild von Autodarts' Spieler-Banner: blau getönter
  Verlauf mit blauem Rand; Logo (`icons/button.png` auf blauem Kreis),
  „RASPDARTS“ und darunter eine Pille mit Erreichbarkeit und IP-Adresse;
  daneben vier Kennzahlen mit blauem Trennstrich links.
- **Karten** wie „TURNIERE“/„FREUNDE“: Hintergrund `--color-black-80`, Radius
  12 px, Innenabstand 16 px, Überschrift in Bebas Neue 24 px. Die Wertezeilen
  darin sind etwas heller (`rgb(27,31,41)`, Radius 10 px).
- **Deinstallieren** steht dezent als Mülleimer mit Text rechts in der
  Kartenüberschrift (grau, beim Darüberfahren rot).
- **Monitor öffnen** ist nur sichtbar, wenn Autodarts installiert und die IP
  bekannt ist; öffnet `http://<ip>:3180/monitor` in einem neuen Tab.
- **Protokoll-Karte** erscheint nur, solange eine Aktion läuft oder bis man
  das Ergebnis schließt.

### Stil

Die Seite nutzt Autodarts' CSS-Variablen und Schriften, die im Dokument schon
vorhanden sind und ins Shadow DOM durchgreifen:

| Zweck | Wert |
|---|---|
| Text | `--color-mono-white`; gedämpft `--color-black-20` / `--color-black-30` |
| Kartenfläche | `--color-black-80` |
| Protokollfläche | `--color-black-90` |
| Hauptknopf | `--color-blue-60`, beim Darüberfahren `--color-blue-50`, Text `rgb(240,245,253)` |
| Normaler Knopf | Weiß mit 8 % Deckkraft, beim Darüberfahren 14 % |
| Gefahr (Herunterfahren, Deinstallieren bestätigen) | `--color-red-60` 20 % als Fläche, Text `--color-red-50` |
| Statuspunkt ok / aus / Fehler | `--color-green-50` / `--color-black-50` / `--color-red-50` |
| Überschriften | „Bebas Neue“, 24 px, Großbuchstaben |
| Fließtext und Knöpfe | „Manrope Variable“, Knöpfe 14 px fett, Radius 8 px |
| Kennzahlen | „League Spartan Variable“, 22 px, halbfett |

Fehlt eine Variable (Autodarts benennt sie um), bekommt jede Verwendung einen
festen Ersatzwert (`var(--color-blue-60, #0b55df)`), damit die Seite lesbar
bleibt.

## Aktionen

| Knopf | Art | Bestätigung | Knopffarbe im Dialog |
|---|---|---|---|
| Autodarts installieren / aktualisieren | Stream `/api/autodarts/install` | ja | blau |
| Autodarts deinstallieren | Stream `/api/autodarts/uninstall` | ja | rot |
| Raspdarts aktualisieren | Stream `/api/system/update` | ja | blau |
| Raspdarts deinstallieren | Stream `/api/system/uninstall` | ja | rot |
| Neu starten | POST `/api/system/reboot` | ja | blau |
| Herunterfahren | POST `/api/system/shutdown` | ja | rot |

- **Bestätigungsdialog:** mittig über der abgedunkelten, unscharfen Seite
  (`backdrop-filter: blur`), Karte mit Radius 18 px, Titel, ein bis zwei Sätze,
  was passiert, rechts „Abbrechen“ und der Bestätigungsknopf. Klick daneben
  oder Escape bricht ab.
- **Stream-Aktionen:** Nach dem Bestätigen erscheint die Protokoll-Karte mit
  dem Aktionsnamen als Überschrift, „Läuft …“ mit Drehkreis und dem Protokoll,
  das automatisch mitscrollt. Alle Aktionsknöpfe sind gesperrt, bis die Aktion
  fertig ist. Danach zeigt die Karte „Erfolgreich abgeschlossen“ (grün) oder
  den Fehler (rot) und einen Knopf „Schließen“.
- **Neustart/Herunterfahren:** dieselbe Karte ohne Protokoll, nur mit der
  Meldung „Pi startet neu …“ bzw. „Pi fährt herunter …“; sie schließt sich nach
  3 Sekunden. Danach greift der Zustand „nicht erreichbar“.
- **Läuft bereits (409):** Die Karte zeigt „Läuft bereits – versuch es gleich
  noch einmal.“
- **Verbindung abgerissen:** „Verbindung zum Pi unterbrochen.“ Die Aktion kann
  auf dem Pi trotzdem weiterlaufen.

Die Kommunikation mit dem Pi läuft unverändert über `background.js`
(`sendMessage` für Abfragen und POST, Port `raspdarts-stream` für Streams).

## Zustände

| Zustand | Banner | Karten | Knöpfe |
|---|---|---|---|
| Lädt (noch keine Antwort) | Pille „Verbinde …“, Werte „--“ | Werte „--“ | gesperrt |
| Erreichbar | Pille grün „Pi online · IP“ | aktuelle Werte | frei, außer s. u. |
| Autodarts nicht installiert (`autodarts_version === 'unknown'`) | – | Version „--“, Status grau „Nicht installiert“ | „Autodarts installieren“ statt „aktualisieren“; Deinstallieren und Monitor aus |
| Aktion läuft | – | – | alle Aktionsknöpfe gesperrt |
| Nicht erreichbar | Pille rot „Pi nicht erreichbar“, Werte „--“ | Hinweiskarte statt der zwei Karten: „Ist der Pi eingeschaltet und im selben Netzwerk? Erwartete Adresse: raspdarts.local“ | keine |

- „Nicht erreichbar“ gilt ab der ersten fehlgeschlagenen Abfrage. Die Seite
  fragt weiter und schaltet von selbst zurück, sobald der Pi antwortet.
- Läuft gerade eine Aktion, bleibt die Protokoll-Karte auch im Zustand „nicht
  erreichbar“ sichtbar (ein Neustart nach einem Update ist normal).

### Abfragen

- Alle 10 s `/api/status`, solange die Seite sichtbar ist und kein Stream läuft.
- Alle 30 s im Hintergrund für den Punkt im Navigationseintrag (wie heute).

### Navigationseintrag

Gegenüber `c398eca` ändert sich: Der Eintrag ist bei nicht erreichbarem Pi
nicht mehr blass und nicht mehr gesperrt, nur der Punkt ist grau. Tooltip
entfällt. Punkt grün = Beamer bekommt Spieldaten (`beamer.ingest_connected`).

## Sprache

- Deutsch, wenn die Hauptnavigation `aria-label="Hauptnavigation"` trägt,
  sonst Englisch. `<html lang>` taugt nicht: Autodarts setzt dort `en`, auch
  wenn die Oberfläche deutsch ist.
- Die Sprache wird beim Bauen der Seite bestimmt. Wechselt jemand in Autodarts
  die Sprache, gilt die neue nach dem Neuladen.
- Alle Texte der Seite, der Dialoge und der Protokoll-Karte stehen in
  `src/texts.js` als zwei Tabellen (`de`, `en`) mit denselben Schlüsseln.
  Die Ausgabe der Pi-Skripte im Protokoll bleibt, wie sie ist.

## Code

Muster wie `src/forward.js`: Jede Datei ist ein IIFE und hängt ihre Funktionen
an ein Objekt auf `globalThis`. So laufen die Dateien als Content-Script und
lassen sich in Vitest importieren.

| Datei | Aufgabe |
|---|---|
| `src/texts.js` (neu) | `globalThis.raspdartsTexts`: Tabellen `de`/`en`, `detectLanguage(navLabel)` |
| `src/view-model.js` (neu) | `globalThis.raspdartsViewModel`: reine Funktionen ohne DOM. `buildView({ status, reachable, loading, busy }, t)` liefert alles, was die Seite anzeigt: formatierte Werte (Laufzeit, RAM, Temperatur), Pillen, Knopfbeschriftungen, welche Knöpfe gesperrt bzw. sichtbar sind, ob die Hinweiskarte erscheint |
| `src/stream.js` (neu, nach dem Review) | `globalThis.raspdartsStream.runStream(...)`: Stream-Aktion über den Port zu `background.js`, mit Ping alle 20 s, damit Chrome den Service Worker bei stillen Phasen (z. B. `npm ci`) nicht beendet |
| `src/page.js` (neu) | `globalThis.raspdartsPage`: baut die Seite im Shadow DOM aus `page.html`/`page.css`, `render(view)`, Dialog öffnen, Protokoll-Karte steuern |
| `page.html`, `page.css` (neu) | Aufbau und Stil der Seite; ersetzen `modal.html` und `modal.css` (werden gelöscht) |
| `src/content.js` | Navigationseintrag, Seite zeigen/verstecken, Unterstrich, Adresswechsel, Abfragen, Aktionen über `background.js`. Das Popup samt `openModal`/`closeModal`/`openDialog` entfällt |
| `manifest.chrome.json`, `manifest.firefox.json` | Content-Script-Liste: `texts.js`, `view-model.js`, `page.js`, `content.js`; `web_accessible_resources`: `page.html`, `page.css`, `icons/*` |

`background.js`, `bridge.js`, `forward.js`, `page-hook.js` und der Pi-Dienst
bleiben unverändert.

## Tests

- **Vitest, zuerst geschrieben:**
  - `texts.js`: Spracherkennung („Hauptnavigation“ → `de`, „Main navigation“,
    leer oder `null` → `en`); beide Tabellen haben dieselben Schlüssel.
  - `view-model.js`: Formatierung (Laufzeit unter/über einer Stunde, RAM in
    GB mit einer Nachkommastelle); Zustände Lädt, Erreichbar, Autodarts nicht
    installiert, Aktion läuft, Nicht erreichbar, Nicht erreichbar während einer
    Aktion; Monitor nur mit installiertem Autodarts und bekannter IP.
- **Im echten Autodarts-Fenster** (Chrome DevTools, Code per Skript
  eingehängt): Einhängen in `main`, Ausblenden von Autodarts' Inhalt, aktiver
  Eintrag und Unterstrich, Verlassen über Navigation, Logo und Zurück,
  „Start“ auf `/`, Schubladen lassen die Seite stehen, Dialog, Protokoll-Karte,
  Zustand „nicht erreichbar“, deutsche Texte.
- **Abnahme durch Arnold** mit der gebauten Extension und dem echten Pi:
  einmal Neustart, einmal „Raspdarts aktualisieren“, einmal die Seite während
  des Updates verlassen und zurückkommen.
