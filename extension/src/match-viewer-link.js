'use strict';

// Links zum Viewer im Autodarts-Fenster "Board control" (Zahnrad unten im
// Spiel): ein eigener Abschnitt unter "Cameras", die Links im Stil der Knoepfe
// Stop/Reset/Calibrate. Fehlt etwas vom erwarteten Aufbau, bleibt das Fenster
// unveraendert.
(function () {
  const { viewerLinks } = globalThis.raspdartsViewerView;
  const SECTION_ID = 'raspdarts-viewer-links';

  // Aufbau des Fensters (Stand 16.10.2026), erkannt am Knopf "Refresh camera images":
  //   Fenster > ... > Stapel > Statuszeile (Status | Stop, Reset, Calibrate)
  //                          | Kameras > Kopf ("Cameras", Refresh) | Bilder
  function locate() {
    const refresh = document.querySelector('[role="dialog"] button[aria-label="Refresh camera images"]');
    const head = refresh?.parentElement;
    const cameras = head?.parentElement;
    const stack = cameras?.parentElement;
    const heading = head?.firstElementChild;
    const model = stack?.firstElementChild?.querySelector('button');
    if (!stack || !model || !heading || heading === refresh || stack.firstElementChild === cameras) return null;
    return { cameras, heading, model };
  }

  function build({ cameras, heading, model }) {
    const section = document.createElement('div');
    section.id = SECTION_ID;
    section.className = cameras.className;
    const title = document.createElement('span');
    title.className = heading.className;
    title.textContent = 'Raspdarts Viewer';
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';
    for (const { href, label } of viewerLinks()) {
      const link = document.createElement('a');
      Object.assign(link, { href, target: '_blank', rel: 'noopener', className: model.className, textContent: label });
      row.append(link);
    }
    section.append(title, row);
    return section;
  }

  // Autodarts baut das Fenster bei jedem Oeffnen neu auf.
  function check() {
    if (document.getElementById(SECTION_ID)) return;
    const parts = locate();
    if (parts) parts.cameras.after(build(parts));
  }

  check();
  new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
})();
