'use strict';

// Ob die Extension Spieldaten an den Pi weitergibt. Der Schalter liegt je
// Browser in chrome.storage.local; ohne gespeicherten Wert gilt "an"
// (Verhalten vor dem Schalter). Genutzt von bridge.js und viewer.js.
// Siehe docs/superpowers/specs/2026-10-12-viewer-fenster-design.md.
(function (root) {
  const FORWARD_KEY = 'forwardGameData';

  function isForwardingOn(value) {
    return value !== false;
  }

  root.raspdartsForwarding = { FORWARD_KEY, isForwardingOn };
})(globalThis);
