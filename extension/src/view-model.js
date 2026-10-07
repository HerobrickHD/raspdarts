'use strict';

// Berechnet aus der Antwort von /api/status, was die Raspdarts-Seite anzeigt.
// Reine Funktionen ohne DOM, damit sie sich ohne Browser testen lassen.
(function (root) {
  const EMPTY = '--';

  // Was jeder Knopf auf dem Pi ausloest. "stream" liefert ein Protokoll,
  // "power" nur eine kurze Bestaetigung (doneText ist ein Schluessel der Texttabelle).
  const ACTIONS = {
    updateRaspdarts: { kind: 'stream', url: '/api/system/update', danger: false },
    uninstallRaspdarts: { kind: 'stream', url: '/api/system/uninstall', danger: true },
    restart: { kind: 'power', url: '/api/system/reboot', danger: false, doneText: 'restarting' },
    shutdown: { kind: 'power', url: '/api/system/shutdown', danger: true, doneText: 'shuttingDown' },
  };

  const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  const isText = (value) => typeof value === 'string' && value.length > 0;
  const withUnit = (value, unit) => (isNumber(value) ? `${value}${unit}` : EMPTY);

  function formatUptime(seconds) {
    if (!isNumber(seconds)) return EMPTY;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function formatRam(usedMb, totalMb) {
    if (!isNumber(usedMb) || !isNumber(totalMb)) return EMPTY;
    const gb = (mb) => (mb / 1024).toFixed(1);
    return `${gb(usedMb)} / ${gb(totalMb)} GB`;
  }

  // background.js meldet Fehler als feste englische Kennungen; die bekannten
  // werden uebersetzt, alles andere (z. B. Meldungen der Pi-Skripte) bleibt.
  function errorMessage(error, t) {
    const known = { Unreachable: t.piUnreachable, 'Stream error': t.streamError };
    return t.errorPrefix + (known[error] ?? (isText(error) ? error : t.requestFailed));
  }

  // Version und Zustand der Scheibe. autodarts_board kommt vom Pi (GET /api/state
  // der Scheibe); fehlt es oder ist es null, antwortet die Scheibe nicht.
  // Antwortet die Scheibe, ist Autodarts installiert, auch wenn der Pi die
  // Version nicht lesen kann (z. B. fuer einen anderen Benutzer installiert).
  function autodartsView(online, installed, s, t) {
    if (!online) return { version: EMPTY, stateText: EMPTY, stateTone: 'off', showInstall: false };
    const board = s.autodarts_board;
    const answers = Boolean(board) && typeof board === 'object';
    if (!installed && !answers) return { version: EMPTY, stateText: t.notInstalled, stateTone: 'off', showInstall: true };
    const version = installed ? s.autodarts_version : EMPTY;
    let state;
    if (!answers) state = { text: t.boardNoAnswer, tone: 'off' };
    else if (!board.running) state = { text: t.boardStopped, tone: 'off' };
    else if (!board.connected) state = { text: t.boardDisconnected, tone: 'error' };
    else state = { text: t.boardRunning, tone: 'ok' };
    return { version, stateText: state.text, stateTone: state.tone, showInstall: false };
  }

  function pillFor(online, reachable, ip, t) {
    if (online) return { tone: 'ok', text: ip ? `${t.piOnline} · ${ip}` : t.piOnline };
    if (reachable === false) return { tone: 'error', text: t.piUnreachable };
    return { tone: 'pending', text: t.connecting };
  }

  // reachable: null = noch keine Antwort, true/false = letzte Abfrage.
  function buildView({ status, reachable, busy }, t) {
    const online = reachable === true && status != null;
    // Ohne Verbindung keine alten Werte anzeigen.
    const s = online ? status : {};
    const ip = isText(s.ip_address) ? s.ip_address : null;
    const installed = isText(s.autodarts_version) && s.autodarts_version !== 'unknown';
    const beamerConnected = Boolean(s.beamer?.ingest_connected);

    return {
      pill: pillFor(online, reachable, ip, t),
      stats: {
        cpu: withUnit(s.cpu_percent, '%'),
        ram: formatRam(s.ram_used_mb, s.ram_total_mb),
        temperature: withUnit(isNumber(s.temp_celsius) ? Math.round(s.temp_celsius) : null, '°C'),
        uptime: formatUptime(s.uptime_seconds),
      },
      showCards: reachable !== false,
      showHint: reachable === false,
      disabled: !online || Boolean(busy),
      autodarts: autodartsView(online, installed, s, t),
      pi: {
        raspdartsVersion: isText(s.raspdarts_version) ? `v${s.raspdarts_version}` : EMPTY,
        beamerText: online ? (beamerConnected ? t.beamerConnected : t.beamerDisconnected) : EMPTY,
        beamerTone: beamerConnected ? 'ok' : 'off',
      },
    };
  }

  root.raspdartsViewModel = { ACTIONS, EMPTY, buildView, errorMessage, formatRam, formatUptime };
})(globalThis);
