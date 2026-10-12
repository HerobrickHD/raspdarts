'use strict';

// Viewer-Knopf auf der Karte des Raspdarts-Boards anstelle von Autodarts'
// Board Manager (unter v2 ohne Funktion) und das Fenster dazu: Schalter fuer
// die Weitergabe der Spieldaten und die bisherige Raspdarts-Seite (page.js).
// Siehe docs/superpowers/specs/2026-10-12-viewer-fenster-design.md.
(function () {
  const { ACTIONS, buildView, errorMessage } = globalThis.raspdartsViewModel;
  const { viewerBlock, viewerButtonState } = globalThis.raspdartsViewerView;
  const { FORWARD_KEY, isForwardingOn } = globalThis.raspdartsForwarding;
  const card = globalThis.raspdartsBoardCard;

  const BUTTON_ID = 'raspdarts-viewer-btn';
  const STATUS_INTERVAL_MS = 10_000;
  const POWER_CLOSE_MS = 3_000;
  // Letzte Spieldaten, die noch unterwegs sind, sollen den Reset nicht ueberholen.
  const RESET_DELAY_MS = 500;

  let board = null;       // { boardId, cams } aus board-card.js
  let forwardOn = true;   // bis der gespeicherte Wert gelesen ist
  let status = null;      // letzte erfolgreiche Antwort von /api/status
  let reachable = null;   // null = noch keine Antwort
  let busy = false;       // eine Aktion laeuft
  let pagePromise = null;
  let page = null;
  let overlay = null;
  let pollTimer = null;

  // --- Knopf ---------------------------------------------------------------------

  function refreshButton() {
    if (!board) return;
    const parts = card.locateCard(board.boardId);
    if (!parts) return;
    // Board Manager ist der letzte Autodarts-Knopf der Gruppe; nur verstecken,
    // nicht entfernen, damit Autodarts' eigene Darstellung heil bleibt. Mit
    // weniger als drei Knoepfen stimmt der Aufbau nicht - dann nichts verstecken.
    const buttons = parts.autodartsButtons;
    const manager = buttons.length >= 3 ? buttons[buttons.length - 1] : null;
    if (manager && manager.style.display !== 'none') manager.style.setProperty('display', 'none', 'important');
    const wrap = card.ensureButton(parts, { id: BUTTON_ID, after: manager, onClick: openWindow });
    const state = viewerButtonState(forwardOn, card.texts());
    card.setButton(wrap, { icon: card.ICONS[state.icon], iconName: state.icon, title: state.title, muted: !state.on });
  }

  // --- Fenster -------------------------------------------------------------------

  function getPage() {
    if (!pagePromise) {
      pagePromise = globalThis.raspdartsPage
        .create({ t: card.texts(), onAction: runAction, onActivityClosed: fetchStatus, onToggle: toggleForwarding })
        .then((created) => { page = created; return created; })
        .catch((error) => { pagePromise = null; throw error; });
    }
    return pagePromise;
  }

  function render() {
    if (!page) return;
    const t = card.texts();
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
    const t = card.texts();
    const name = (board && card.locateCard(board.boardId)?.name) || 'Board';
    overlay = card.openOverlay({
      title: `${t.windowTitle} – ${name}`,
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
    render();
    fetchStatus();
    startPolling();
  }

  // --- Status --------------------------------------------------------------------

  async function fetchStatus() {
    const result = await card.sendToBackground({ type: 'fetch', url: '/api/status' });
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
    await card.storageSet(FORWARD_KEY, next); // onChanged aktualisiert Knopf und Fenster
    if (!next) {
      // Wieder eingeschaltet (Doppelklick)? Dann kein Reset, sonst stuende der
      // Viewer mitten im Spiel leer bis zum naechsten Wurf.
      setTimeout(() => {
        if (!forwardOn) card.sendToBackground({ type: 'fetch', url: '/api/ingest/reset', method: 'POST' });
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
    page.startActivity(card.texts().dialogs[key].title);
    if (action.kind === 'stream') runStream(action);
    else runPower(action);
  }

  function finishAction(success, message) {
    busy = false;
    page.finishActivity(success, message);
    render();
  }

  function runStream(action) {
    const t = card.texts();
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
    const t = card.texts();
    const result = await card.sendToBackground({ type: 'fetch', url: action.url, method: 'POST' });
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
  card.storageGet(FORWARD_KEY).then(applyForwarding);

  card.watchBoardsPage({
    onEnter: () => card.boardForVisit().then((found) => { board = found; refreshButton(); }),
    onChange: refreshButton,
    onLeave: () => {
      board = null;
      overlay?.close();
    },
  });
})();
