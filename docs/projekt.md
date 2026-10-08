# Raspdarts — worum es geht

Stand: 8. Oktober 2026

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

Eine Anzeige – der **Viewer** –, die alles zeigt, was man beim Spielen wissen
will, ohne dass man den Kopf drehen oder etwas bedienen muss. Der wichtigste
Fall ist ein Beamer, der direkt auf die Scheibe projiziert: Treffer und
Hervorhebungen leuchten auf den echten Feldern, Spielerkarten und Aufnahme
stehen daneben an der Wand. Der Viewer ist nur eine Adresse auf dem Pi; jedes
Gerät mit Browser kann ihn öffnen (Beamer, Fernseher, Laptop).

Gebaut wird **Feature für Feature**, nicht alles auf einmal. Jede Stufe ist für
sich benutzbar und wird an der echten Scheibe erprobt, bevor die nächste
beginnt.

## Aufbau

```
Laptop: play.autodarts.com + Raspdarts-Extension
│   liest den Spielstand der Seite mit
▼
Raspberry Pi 5 (läuft ohnehin durch, hat die Kameras)
│
├── raspdarts (ein Node-Dienst)
│     nimmt die Spieldaten an, übersetzt sie in den Spielstand,
│     verteilt einen fertigen Spielstand-Schnappschuss
│     und verwaltet den Pi (Status, Updates, Neustart)
│
└── Viewer ← Browser im Vollbild (Beamer, Fernseher …)
```

Dazwischen steht genau ein Vertrag: der `ViewerState`. Der Dienst schickt
bei jeder Änderung einen vollständigen Schnappschuss, die Anzeige rendert ihn
und hält selbst keinen Spielstand (nur ihr Layout, das ebenfalls vom Dienst kommt).

Die Spieldaten kommen nicht vom Pi selbst, sondern von der Extension im Browser,
in dem ohnehin gespielt wird. Der Pi braucht dadurch keine Autodarts-Anmeldung.
Der Preis: Der Viewer zeigt nur etwas an, solange ein Tab mit play.autodarts.com
offen ist.

**Warum diese Trennung wichtig ist:**

- Die Anzeige ist nur eine URL. Ob der Beamer am Pi, am Laptop oder an einem
  Mini-PC hängt, ändert am Code nichts. Falls die Kamera-Erkennung auf dem Pi
  unter dem Browser leidet, wird das Gerät getauscht, nicht das Projekt.
- Mehrere Anzeigen gleichzeitig gehen ohne Zusatzaufwand — Beamer an der Wand,
  Handy in der Hand, beide aktuell.
- Autodarts hat keine offizielle API. Ändert sich ihr Datenformat, ist genau
  eine Datei betroffen (`server/src/viewer/game-state.ts`). Server und Anzeige
  merken nichts davon.

## Ohne Dartscheibe entwickeln

Jede Sitzung wird als Datei mitgeschrieben und lässt sich zurückspielen. Ein
einziges echtes Leg reicht, um danach die komplette Anzeige am Schreibtisch zu
bauen — Schriftgrößen, Farben, Anordnung — ohne für jede Änderung aufzustehen
und zu werfen.

Dabei landen auch die **Einschlagkoordinaten** jedes Darts im Protokoll. Die
werden noch nicht angezeigt, sind aber genau das Material, das die späteren
Stufen brauchen. Das Archiv füllt sich also, bevor es gebraucht wird.

## Stufen

**Grundlage Viewer** *(Spec `docs/superpowers/specs/2026-10-08-viewer-design.md`)*

Schwarzer Grund, eigene Scheibe (Nur Licht / Gezeichnet / Linien),
Spielerkarten und Aufnahme im Stil der Autodarts-Spielansicht, Layout je
Anzeige mit Live-Editor zum Ausrichten der Scheibe auf die echte Scheibe.
Nur X01.

**Danach, in dieser Reihenfolge**

1. Messung mit Beamer und Darts: stört Licht auf der Scheibe die Erkennung?
   Danach Licht-Verhalten festlegen, ggf. 4-Ecken-Entzerrung.
2. Bust- und Endanimation.
3. Kachel auf play.autodarts.com/boards (Pi-Werte, Anzeige einstellen) statt
   des Navigationseintrags.
4. Weitere Spielarten (Gotcha, Cricket …) – der Pi rechnet z. B. bei Gotcha
   aus, mit welchem Feld man wen zurücksetzt, der Viewer färbt es.

Verworfen (8. Oktober 2026): Board-Verwaltung (Kameras, Kalibrierung,
Einstellungen) in Raspdarts – das kann Autodarts' eigene Terminal-App `ad`.

## Das offene Risiko

Die Dart-Erkennung funktioniert über Bildunterschiede: Die Kameras vergleichen,
was sich auf der Scheibenoberfläche verändert hat. Ein Beamer, der Muster **auf
die Scheibe** wirft, verändert genau dieses Bild.

Ob das die Erkennung tatsächlich stört, weiß niemand, bevor es gemessen wurde.
Deshalb gilt für das Licht auf der Scheibe: **erst mit einem einfachen Testbild
messen, dann festlegen.** Mögliche Auswege, falls es klemmt — nur zwischen den Aufnahmen
projizieren, statische statt bewegter Flächen, Helligkeit reduzieren.

Bis dahin ist das Licht-Verhalten vorläufig (wie bei Autodarts: Darts als
Punkte, letztes Feld blinkt). Anzeigen neben der Scheibe (Wand, Fernseher)
berührt das Problem nicht.

## Was als Nächstes ansteht

Die Messung aus „Das offene Risiko“, sobald Beamer und Darts da sind.

## Grundsätze

- **Feature für Feature.** Jede Stufe einzeln fertig und erprobt.
- **Messen statt hoffen.** Bei der Kamera-Störung und bei der Rechenlast auf dem
  Pi wird geprüft, nicht vermutet.
- **Annahmen kennzeichnen.** Was aus Community-Quellen stammt und nicht am
  lebenden System geprüft wurde, steht in `docs/protocol.md` als solches markiert.
- **Spielregeln auf dem Pi, Darstellung im Viewer.** Rest, Bust, Checkout und
  Sieger entscheidet Autodarts, `game-state.ts` übersetzt. Der Viewer darf in
  der Darstellung beliebig schlau sein (Geometrie, Hervorhebungen,
  Animationen), rechnet aber keine Spielwerte.
