# Autodarts Beamer — worum es geht

Stand: 20. September 2026

## Die Idee

An der Dartscheibe hängen drei Kameras, die jeden Wurf erkennen und an
[autodarts.com](https://autodarts.com) melden. Der Punktestand steht dadurch
zuverlässig fest — nur eben auf einem Laptop, der irgendwo an der Seite liegt.
Nach jedem Wurf hinübergehen und nachschauen unterbricht den Rhythmus.

Ein Beamer löst das: Er wirft den Spielstand direkt an die Wand neben die
Scheibe, in der Größe, in der man ihn aus der Wurfposition im Augenwinkel
erfassen kann.

Und weil die Spieldaten ohnehin in Echtzeit vorliegen, liegt der nächste
Gedanke nahe: Man könnte mehr zeigen als nur Zahlen. Das Zielfeld hervorheben.
Sehen, wo die letzten drei Darts tatsächlich eingeschlagen sind. Am Ende sogar
die Felder auf der Scheibe selbst anleuchten.

## Das Ziel

Eine Anzeige, die neben der Scheibe hängt und alles zeigt, was man beim Spielen
wissen will — ohne dass man den Kopf drehen oder etwas bedienen muss.

Gebaut wird **Feature für Feature**, nicht alles auf einmal. Jede Stufe ist für
sich benutzbar und wird an der echten Scheibe erprobt, bevor die nächste
beginnt. Das ist eine bewusste Entscheidung: Ein Projekt, das alles gleichzeitig
versucht, wird chaotisch und nie fertig.

## Aufbau

```
Raspberry Pi 5 (läuft ohnehin durch, hat die Kameras)
│
├── autodarts-beamer (Node-Dienst)
│     hält die Verbindung zu Autodarts, rechnet Checkout-Wege aus
│     und verteilt einen fertigen Spielstand-Schnappschuss
│
└── Beamer ← Browser im Vollbild, zeigt nur an
```

Dazwischen steht genau ein Vertrag: der `ScoreboardState`. Der Dienst schickt
bei jeder Änderung einen vollständigen Schnappschuss, die Anzeige rendert ihn
und hält selbst keinen Zustand.

**Warum diese Trennung wichtig ist:**

- Die Anzeige ist nur eine URL. Ob der Beamer am Pi, am Laptop oder an einem
  Mini-PC hängt, ändert am Code nichts. Falls die Kamera-Erkennung auf dem Pi
  unter dem Browser leidet, wird das Gerät getauscht, nicht das Projekt.
- Mehrere Anzeigen gleichzeitig gehen ohne Zusatzaufwand — Beamer an der Wand,
  Handy in der Hand, beide aktuell.
- Autodarts hat keine offizielle API. Ändert sich ihr Datenformat, ist genau
  eine Datei betroffen (`game-state.ts`). Server und Anzeige merken nichts davon.

## Ohne Dartscheibe entwickeln

Jede Sitzung wird als Datei mitgeschrieben und lässt sich zurückspielen. Ein
einziges echtes Leg reicht, um danach die komplette Anzeige am Schreibtisch zu
bauen — Schriftgrößen, Farben, Anordnung — ohne für jede Änderung aufzustehen
und zu werfen.

Dabei landen auch die **Einschlagkoordinaten** jedes Darts im Protokoll. Die
werden noch nicht angezeigt, sind aber genau das Material, das die späteren
Stufen brauchen. Das Archiv füllt sich also, bevor es gebraucht wird.

## Stufen

**Stufe 1 — Scoreboard** *(gebaut)*

Restpunkte, aktiver Spieler, gewonnene Legs, die Darts der laufenden Aufnahme
und der empfohlene Checkout-Weg. Schwarzer Grund, große Zahlen, drei Farben.

Die drei Bausteine — Kopfzeile, Spielerblock, Checkout — lassen sich einzeln
verschieben und in der Größe ändern, damit das Bild zur eigenen Wand passt.
Gespeichert wird pro Anzeige, sodass der Beamer sein Layout behält, wenn am
Handy etwas verstellt wird.

**Stufe 2 — Zielfeld am Rand**

Ein Marker am Bildrand zeigt auf das nächste zu treffende Segment. Braucht noch
keine Kalibrierung.

**Stufe 3 — Trefferanzeige**

Die letzten drei Darts als Punktwolke, zunächst in einer kleinen Scheiben-Grafik
neben dem Score. Die Koordinaten dafür liegen dann längst vor.

**Stufe 4 — Statistik**

Average, Checkout-Quote, Streuung über die Sitzung.

**Stufe 5 — Projektion auf die Scheibe**

Felder direkt anleuchten. Die anspruchsvollste Stufe, mit einem offenen Risiko
(siehe unten).

## Das offene Risiko

Die Dart-Erkennung funktioniert über Bildunterschiede: Die Kameras vergleichen,
was sich auf der Scheibenoberfläche verändert hat. Ein Beamer, der Muster **auf
die Scheibe** wirft, verändert genau dieses Bild.

Ob das die Erkennung tatsächlich stört, weiß niemand, bevor es gemessen wurde.
Deshalb gilt für Stufe 5: **erst mit einem einfachen Testbild messen, dann
bauen.** Mögliche Auswege, falls es klemmt — nur zwischen den Aufnahmen
projizieren, statische statt bewegter Flächen, Helligkeit reduzieren.

Solange das ungeklärt ist, bleibt die Scheibenfläche dunkel. Die Stufen 1 bis 4
berühren das Problem nicht.

## Wo es gerade hakt

Autodarts hat die Anmeldung im Herbst 2026 von Keycloak auf ein eigenes
OAuth-2.0-System umgestellt und dabei den Passwort-Login gestrichen. Der alte
Anmeldeserver ist abgeschaltet.

Für neue Anwendungen heißt das: Man braucht eine bei Autodarts registrierte
**Client-ID**. Die ist angefragt, aber noch nicht da. Bis dahin lässt sich
nichts gegen die echte API testen.

Der Rest ist davon unberührt — die Anzeige wird gegen aufgezeichnete Daten
entwickelt und läuft.

## Was danach ansteht

Sobald die Client-ID vorliegt, ein einziges Leg mit `npm run discover` an der
Scheibe aufzeichnen. Damit wird geprüft, ob das Datenformat den Annahmen
entspricht, die aus Community-Quellen rekonstruiert wurden. Danach ist das
Projekt eigenständig lauffähig.

## Grundsätze

- **Feature für Feature.** Jede Stufe einzeln fertig und erprobt.
- **Messen statt hoffen.** Bei der Kamera-Störung und bei der Rechenlast auf dem
  Pi wird geprüft, nicht vermutet.
- **Annahmen kennzeichnen.** Was aus Community-Quellen stammt und nicht am
  lebenden System geprüft wurde, steht in `docs/protocol.md` als solches markiert.
- **Die Anzeige bleibt dumm.** Keine Spiellogik im Browser. Das hält sie
  austauschbar und die Logik testbar.
