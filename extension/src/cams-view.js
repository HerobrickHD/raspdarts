'use strict';

// Reine Logik fuer den Kamera-Knopf auf play.autodarts.com/boards und das
// Kamerafenster. Ohne DOM, damit sie sich ohne Browser testen laesst.
// Siehe docs/superpowers/specs/2026-10-12-kameras-design.md.
(function (root) {
  // Pause zwischen zwei Abrufrunden; der Pi bremst zusaetzlich selbst.
  const ROUND_PAUSE_MS = 1000;

  function isBoardsPage(pathname) {
    return pathname === '/boards' || pathname === '/boards/';
  }

  // Autodarts schreibt den Zustand auch bei deutscher Oberflaeche englisch.
  function buttonState(badgeText, t) {
    const enabled = (badgeText ?? '').trim() === 'Running';
    return { enabled, title: enabled ? t.camsButton : t.camsButtonStopped };
  }

  const label = (index, t) => `${t.camsCamera} ${index + 1}`;

  function emptyTiles(count, t) {
    return Array.from({ length: count }, (_, i) => ({ label: label(i, t), src: null, stale: false, note: null }));
  }

  // results: Antworten des Background-Teils je Kamera ({ ok, status, dataUrl }).
  // previous: Kacheln der vorigen Runde; fehlt ein Bild, bleibt das letzte
  // abgedunkelt stehen.
  function windowView(results, previous, t) {
    if (results.some((result) => result?.status === 409)) {
      return { message: t.camsBoardStopped, tiles: previous };
    }
    const tiles = results.map((result, i) => {
      if (result?.ok && typeof result.dataUrl === 'string') {
        return { label: label(i, t), src: result.dataUrl, stale: false, note: null };
      }
      return { label: label(i, t), src: previous[i]?.src ?? null, stale: true, note: t.camsNoImage };
    });
    return { message: null, tiles };
  }

  root.raspdartsCamsView = { ROUND_PAUSE_MS, buttonState, emptyTiles, isBoardsPage, windowView };
})(globalThis);
