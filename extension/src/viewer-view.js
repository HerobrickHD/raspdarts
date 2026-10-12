'use strict';

// Reine Logik fuer den Viewer-Knopf auf der Board-Karte und den Viewer-Block
// im Fenster. Ohne DOM, damit sie sich ohne Browser testen laesst.
// Siehe docs/superpowers/specs/2026-10-12-viewer-fenster-design.md.
(function (root) {
  function viewerButtonState(on, t) {
    return on
      ? { on: true, icon: 'monitor', title: t.viewerButtonOn }
      : { on: false, icon: 'monitorOff', title: t.viewerButtonOff };
  }

  // status: letzte Antwort von /api/status; reachable: null = noch keine
  // Antwort, true/false = letzte Abfrage.
  function viewerBlock({ forwardOn, status, reachable, now }, t) {
    const base = { on: forwardOn, switchText: forwardOn ? t.viewerOn : t.viewerOff };
    if (!forwardOn) return { ...base, stateText: t.viewerForwardingOff, stateTone: 'off' };
    if (reachable === false) return { ...base, stateText: t.piUnreachable, stateTone: 'error' };
    if (reachable !== true || !status) return { ...base, stateText: t.connecting, stateTone: 'pending' };
    const ingest = status.beamer ?? {};
    if (!ingest.ingest_connected) return { ...base, stateText: t.viewerDisconnected, stateTone: 'off' };
    const last = Date.parse(ingest.last_message_at ?? '');
    if (Number.isNaN(last)) return { ...base, stateText: t.viewerConnectedNoMessage, stateTone: 'ok' };
    const seconds = Math.max(0, Math.round((now - last) / 1000));
    return { ...base, stateText: t.viewerConnectedAgo.replace('{s}', String(seconds)), stateTone: 'ok' };
  }

  // apiResult: Antwort des Background-Teils auf GET /api/cams.
  function pickBoardId(apiResult, storedId) {
    const fromPi = apiResult?.ok ? apiResult.data?.board_id : null;
    if (typeof fromPi === 'string' && fromPi.length > 0) return fromPi;
    return typeof storedId === 'string' && storedId.length > 0 ? storedId : null;
  }

  root.raspdartsViewerView = { pickBoardId, viewerBlock, viewerButtonState };
})(globalThis);
