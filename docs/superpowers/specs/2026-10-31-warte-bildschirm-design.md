# Warte-Bildschirm einstellbar

Stand 31.10.2026. Nur Viewer/Pi (Server-Version 2.5.0), keine neue Extension.

## Warum

Ohne Spiel zeigt der Viewer heute nur schwarz und mittig „Warte auf ein
Spiel“ – alle Bausteine sind ausgeblendet (`style.css`:
`.viewer:not([data-phase="playing"]) .block { visibility: hidden }`).
Arnold will auch beim Warten die Scheibe an die Wand projizieren, wenn er das
im Profil so einstellt, und den Text an eine passende Stelle schieben und in
der Größe ändern.

## Was Arnold entschieden hat

- Die Einstellungen liegen **im selben Profil** wie die Spielansicht.
- Die Scheibe beim Warten ist **dieselbe Scheibe** wie im Spiel: gleiche
  Lage, Größe und Drehung (`layout.board`). Es gibt kein zweites
  Scheiben-Layout. Wer sie verschiebt, verschiebt sie für Spiel und Warten.
- Der Text „Warte auf ein Spiel“ ist **verschiebbar und skalierbar**. Der
  Wortlaut ist **fest**, man kann ihn nicht ändern.
- In der Leiste kommt oben ein Umschalter **„Vorschau: Spiel | Warten“** dazu.
  Damit sieht und bearbeitet man den Warte-Bildschirm.

## Meine Entscheidungen (von Arnold so abgenickt)

- **Scheibe beim Warten**: neue Option im Kasten *Scheibe*,
  `beimWarten` („Beim Warten zeigen“, Schalter, Vorgabe **aus**). Sichtbar
  beim Warten nur, wenn die Scheibe an ist *und* `beimWarten` an ist. Sie
  sieht aus wie im Spiel (Darstellung, Zahlenring, Zahlen-Ausrichtung und
  -Abstand), nur ohne Darts und Leuchten.
- **Text**: neuer Baustein `warten` („Warten“) im Katalog, Schalter an/aus,
  Vorgabe **an**, ohne weitere Optionen. Im Layout ein neuer Block
  `blocks.warten = { x, y, scale }`.
- Vorgaben für neue und zurückgesetzte Profile: Scheibe beim Warten aus, Text
  an, in der Mitte wie heute, gleiche Größe wie heute.
- **Kamera-Ansicht beim Warten**: Die Scheibe zeigt das letzte vorhandene
  Kamerabild. Es werden deshalb nicht mehr Bilder geholt als heute
  (Autodarts nie stören).
- **Alte Profile**: keine Umstellung, keine neue Profil-Version. Fehlendes
  (`scheibe.beimWarten`, `warten`, `blocks.warten`) bekommt beim Lesen die
  Vorgabe (wie bei jeder neuen Option, `sanitizeContent`/`sanitizeLayout`).
- Alles andere (Spielinfo, Aufnahme, Spielerbereiche) bleibt beim Warten
  unsichtbar wie bisher.
- Im Spiel ist der Text nie zu sehen (wie heute).

## Wie es sich verhält

### Anzeige ohne Leiste

| Phase | Scheibe | Text | Rest |
|---|---|---|---|
| Warten (`idle`) | wenn `scheibe.on` und `scheibe.beimWarten` | wenn `warten.on` | aus |
| Spiel (`playing`) | wie heute | aus | wie heute |

### Einstellen

- Der Umschalter „Vorschau: Spiel | Warten“ steht oben in der Leiste, über
  den Kästen und immer sichtbar (nicht in einem Kasten). Er gehört nicht zum
  Profil und ist kein Schritt für Zurück, genauso wie „Vorschau mit Spielern“.
  Beim Öffnen der Leiste steht er auf *Spiel* (wie bisher).
- „Vorschau mit Spielern“ bleibt auch bei *Warten* bedienbar (nichts
  springt), wirkt aber erst wieder bei *Spiel*.
- **Spiel**: wie heute (Beispieldaten X01).
- **Warten**: Die Bühne zeigt den Warte-Bildschirm nach der Tabelle oben
  (Phase `idle`, keine Beispieldaten). Scheibe (falls sichtbar) und Text
  lassen sich direkt auf der Bühne bearbeiten:
  - Text: Ziehen verschiebt ihn, der Eckgriff ändert die Größe; Pfeile und
    +/− wie bei Spielinfo/Aufnahme.
  - Scheibe: alles wie bisher (Verschieben, Größe, Drehen, Mausrad, Tasten).
    Die Änderung gilt auch fürs Spiel, weil es dieselbe Scheibe ist.
- Ist ein Block ausgewählt, der in der gewählten Vorschau nicht zu sehen ist
  (z. B. Spielinfo, nachdem man auf *Warten* umgestellt hat), springt die
  Auswahl auf einen sichtbaren Block (`selectVisible`).
- Der Wechsel geht wie die Spielerzahl über `editing` an den Pi. Die anderen
  Geräte (Beamer) zeigen dann ebenfalls den Warte-Bildschirm: `editing`
  bekommt `vorschau: "spiel" | "warten"`. `parseEditing` nimmt nur diese
  beiden Werte an, sonst gilt `"spiel"`.

## Wo es hingehört (Hinweise für den Bau)

- `catalog.ts`: Option `beimWarten` bei *Scheibe*, neuer Baustein `warten`
  (Reihenfolge in der Leiste: nach *Scheibe*).
- `layout.ts`: `LayoutBlocks.warten: BlockLayout`, Standard in
  `DEFAULT_LAYOUT`, `sanitizeLayout` prüft ihn wie spielinfo/aufnahme.
  Bezugspunkt des Textes ist seine **Mitte** (Standard `x: 50, y: 50`), sonst
  wäre die Mitte vom Textbreite-Pixelwert abhängig. Vergrößern/Verkleinern
  bleibt dann um die Mitte. `layout-view.js` und der Eckgriff im `editor.js`
  müssen das beachten (Anker = Mitte wie bei der Scheibe).
- `index.html`: `#message` wird ein Block `<section class="block"
  data-block="warten">` mit Griff. Die Grundschriftgröße bleibt `2.4cqh` (scale 1
  = heute).
- `style.css`: Die Regel „ohne Spiel alles unsichtbar“ bekommt Ausnahmen für
  die Scheibe (`data-scheibe="on"` + `data-scheibe-beimwarten="on"`) und den
  Text (`data-warten="on"`). Im Spiel ist der Text-Block unsichtbar.
- `display-hub.ts`: `Editing.vorschau`, `parseEditing`.
- `settings.js` / `settings-panel.js`: Umschalter, `preview.vorschau`, geht
  mit `editing()` hinaus.
- `sample-state.js` `previewState`: bei `editing.vorschau === "warten"`
  → `{ phase: "idle" }`.
- `app.js`: Der Text kommt fest ins HTML, nicht mehr aus `render()`.
  `board.render` funktioniert mit `idle` schon (keine Darts).
- Version 2.5.0 (Server, `package.json`).

## Tests

- Katalog/Profil: neue Option und neuer Baustein mit Vorgaben; altes Profil
  ohne sie wird mit Vorgaben gelesen.
- Layout: `blocks.warten` wird begrenzt, fehlt er, kommt der Standard.
- `parseEditing`: `vorschau` gültig/ungültig/fehlt.
- `previewState`: Warten → idle, Spiel → Beispieldaten.
- `keyAction`/Editor: Pfeile und +/− auf `warten`.
- Browser-Prüfung: Warten mit und ohne Scheibe, Text ziehen/skalieren,
  Umschalter, zweites Fenster folgt, nach „Fertig“ und im Spiel.

## Nicht dabei

- Eigener Text, mehrere Texte, Uhr, Logo oder Animation beim Warten.
- Eigene Lage der Scheibe nur für das Warten.
- Darts oder das letzte Spiel auf der Warte-Scheibe.
