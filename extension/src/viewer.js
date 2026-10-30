'use strict';

// Raspdarts-Knopf (Monitor) in der Navigationsleiste von Autodarts, links
// neben dem Profilbild, auf allen Seiten; und das Fenster dazu: Schalter fuer
// die Weitergabe der Spieldaten und die bisherige Raspdarts-Seite (page.js).
// Siehe docs/superpowers/specs/2026-10-30-zurueck-und-navigation-design.md.
(function () {
  const { ACTIONS, buildView, errorMessage } = globalThis.raspdartsViewModel;
  const { viewerBlock, viewerButtonState } = globalThis.raspdartsViewerView;
  const { FORWARD_KEY, isForwardingOn } = globalThis.raspdartsForwarding;
  const ui = globalThis.raspdartsUi;

  const BUTTON_ID = 'raspdarts-viewer-btn';
  const STATUS_INTERVAL_MS = 10_000;
  const POWER_CLOSE_MS = 3_000;
  // Letzte Spieldaten, die noch unterwegs sind, sollen den Reset nicht ueberholen.
  const RESET_DELAY_MS = 500;

  let forwardOn = true;   // bis der gespeicherte Wert gelesen ist
  let status = null;      // letzte erfolgreiche Antwort von /api/status
  let reachable = null;   // null = noch keine Antwort
  let busy = false;       // eine Aktion laeuft
  let pagePromise = null;
  let page = null;
  let overlay = null;
  let pollTimer = null;
  let wrap = null;        // unser Knopf in der Leiste

  // --- Knopf ---------------------------------------------------------------------

  // Wie Autodarts' Symbol-Knoepfe in der jeweiligen Leiste.
  const NAV_STYLE = {
    className: 'relative size-8 flex items-center justify-center rounded-full text-mono-white hover:text-blue-30 transition-all',
    css: 'width: 32px; height: 32px; padding: 6px;',
  };
  const MATCH_STYLE = {
    className: 'relative text-secondary-on hover:text-blue-40 transition-colors',
    css: 'width: 28px; height: 28px; padding: 4px;',
  };

  // Aufbau der Leisten (Stand 31.10.2026), unabhaengig von der Sprache:
  //   ueberall: header > ... > Gruppe rechts mit dem Profilbild-Knopf (darin
  //             [data-slot="avatar"]) - unser Knopf links davor;
  //   im Spiel (/matches/…): kein Profilbild, header > Gruppe rechts
  //             (Zuschauer, Statistik, Zahnrad) - unser Knopf vor dem ersten Knopf.
  // Sonst (z. B. abgemeldet) kein Knopf.
  function findPlace() {
    const avatar = document.querySelector('header button:has([data-slot="avatar"])');
    if (avatar) return { before: avatar, style: NAV_STYLE };
    if (!location.pathname.startsWith('/matches/')) return null;
    const first = document.querySelector('header > :last-child > button');
    return first ? { before: first, style: MATCH_STYLE } : null;
  }

  function refreshButton() {
    const place = findPlace();
    if (!place) return;
    // Nur den eigenen Knopf nehmen: Ein gleichnamiger stammt von einer
    // frueheren Fassung der Extension (Firefox spielt sie nach einem Update
    // neu ein) - sein Klick ginge ins Leere.
    if (!wrap?.isConnected) {
      document.getElementById(BUTTON_ID)?.remove();
      // Der Knopf steckt in einem <span>, das den Hinweis traegt.
      wrap = document.createElement('span');
      wrap.id = BUTTON_ID;
      wrap.dataset.raspdarts = '1';
      wrap.style.display = 'inline-flex';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.addEventListener('click', openWindow);
      wrap.append(btn);
    }
    // Nur Aenderungen schreiben - jede weckt den MutationObserver.
    const btn = wrap.firstElementChild;
    if (btn.className !== place.style.className) {
      btn.className = place.style.className;
      btn.style.cssText = place.style.css;
    }
    // Autodarts baut die Leiste beim Seitenwechsel neu - dann wieder davor.
    if (place.before.previousElementSibling !== wrap) place.before.before(wrap);
    const state = viewerButtonState(forwardOn, ui.texts());
    ui.setButton(wrap, {
      icon: ui.ICONS[state.icon],
      iconName: state.icon,
      title: state.title,
      muted: !state.on,
      mutedBackground: false,
    });
  }

  // --- Fenster -------------------------------------------------------------------

  function getPage() {
    if (!pagePromise) {
      pagePromise = globalThis.raspdartsPage
        .create({ t: ui.texts(), onAction: runAction, onActivityClosed: fetchStatus, onToggle: toggleForwarding })
        .then((created) => { page = created; return created; })
        .catch((error) => { pagePromise = null; throw error; });
    }
    return pagePromise;
  }

  function render() {
    if (!page) return;
    const t = ui.texts();
    page.render(buildView({ status, reachable, busy }, t), viewerBlock({ forwardOn, status, reachable, now: Date.now() }, t));
  }

  async function openWindow() {
    if (overlay) return;
    let created;
    try {
      created = await getPage();
    } catch (error) {
      // getPage setzt sich zurueck, der naechste Klick versucht es erneut.
      console.error('Raspdarts: Fenster konnte nicht geladen werden', error);
      return;
    }
    if (overlay) return;
    const t = ui.texts();
    overlay = ui.openOverlay({
      title: t.windowTitle,
      width: '1100px',
      closeLabel: t.close,
      canEscape: () => !created.isDialogOpen(),
      // Die Seite wird nur ausgehaengt: Eine laufende Aktion samt Protokoll laeuft weiter.
      onClose: () => {
        overlay = null;
        created.closeDialog();
        stopPolling();
      },
    });
    overlay.body.append(created.host);
    created.revealLog();
    render();
    fetchStatus();
    startPolling();
  }

  // --- Status --------------------------------------------------------------------

  async function fetchStatus() {
    const result = await ui.sendToBackground({ type: 'fetch', url: '/api/status' });
    if (result?.ok) {
      status = result.data;
      reachable = true;
    } else {
      reachable = false;
    }
    render();
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => { if (!busy) fetchStatus(); }, STATUS_INTERVAL_MS);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  // --- Weitergabe an/aus ---------------------------------------------------------

  async function toggleForwarding() {
    const next = !forwardOn;
    await ui.storageSet(FORWARD_KEY, next); // onChanged aktualisiert Knopf und Fenster
    if (!next) {
      // Wieder eingeschaltet (Doppelklick)? Dann kein Reset, sonst stuende der
      // Viewer mitten im Spiel leer bis zum naechsten Wurf.
      setTimeout(() => {
        if (!forwardOn) ui.sendToBackground({ type: 'fetch', url: '/api/ingest/reset', method: 'POST' });
      }, RESET_DELAY_MS);
    }
  }

  function applyForwarding(value) {
    forwardOn = isForwardingOn(value);
    refreshButton();
    render();
  }

  // --- Aktionen ------------------------------------------------------------------

  async function runAction(key) {
    const action = ACTIONS[key];
    if (busy || !action || !page) return;
    const confirmed = await page.confirm(key, action.danger);
    if (!confirmed || busy) return;

    busy = true;
    render();
    page.startActivity(ui.texts().dialogs[key].title);
    if (action.kind === 'stream') runStream(action);
    else runPower(action);
  }

  function finishAction(success, message) {
    busy = false;
    page.finishActivity(success, message);
    render();
  }

  function runStream(action) {
    const t = ui.texts();
    globalThis.raspdartsStream.runStream({
      connect: () => chrome.runtime.connect({ name: 'raspdarts-stream' }),
      url: action.url,
      onLog: (line) => page.appendLog(line),
      onEnd: (result) => {
        if (result.kind === 'conflict') finishAction(false, t.alreadyRunning);
        else if (result.kind === 'disconnected') finishAction(false, t.disconnected);
        else finishAction(result.success, result.success ? t.success : errorMessage(result.error, t));
      },
    });
  }

  async function runPower(action) {
    const t = ui.texts();
    const result = await ui.sendToBackground({ type: 'fetch', url: action.url, method: 'POST' });
    if (result?.ok) {
      finishAction(true, t[action.doneText]);
      // Nicht schliessen, falls inzwischen schon die naechste Aktion laeuft.
      setTimeout(() => { if (!busy) page.closeActivity(); fetchStatus(); }, POWER_CLOSE_MS);
    } else if (result?.status === 409) {
      finishAction(false, t.alreadyRunning);
    } else {
      finishAction(false, errorMessage(result?.data?.error || result?.error, t));
    }
  }

  // --- Start ---------------------------------------------------------------------

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && FORWARD_KEY in changes) applyForwarding(changes[FORWARD_KEY].newValue);
  });
  ui.storageGet(FORWARD_KEY).then(applyForwarding);

  refreshButton();
  new MutationObserver(refreshButton).observe(document.body, { childList: true, subtree: true });
})();
