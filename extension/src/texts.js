'use strict';

// Texte der Raspdarts-Seite auf Deutsch und Englisch. Die Sprache richtet sich
// nach Autodarts selbst (siehe detectLanguage).
(function (root) {
  const de = {
    connecting: 'Verbinde …',
    piOnline: 'Pi online',
    piUnreachable: 'Pi nicht erreichbar',
    unreachableHint: 'Ist der Pi eingeschaltet und im selben Netzwerk? Erwartete Adresse: raspdarts.local',
    cpu: 'CPU',
    ram: 'RAM',
    temperature: 'Temperatur',
    uptime: 'Laufzeit',
    autodarts: 'Autodarts',
    raspberryPi: 'Raspberry Pi',
    version: 'Version',
    status: 'Status',
    installed: 'Installiert',
    notInstalled: 'Nicht installiert',
    raspdarts: 'Raspdarts',
    beamer: 'Beamer',
    beamerConnected: 'Verbunden',
    beamerDisconnected: 'Nicht verbunden',
    installAutodarts: 'Autodarts installieren',
    updateAutodarts: 'Autodarts aktualisieren',
    uninstallAutodarts: 'Deinstallieren',
    openMonitor: 'Monitor öffnen',
    updateRaspdarts: 'Raspdarts aktualisieren',
    uninstallRaspdarts: 'Raspdarts deinstallieren',
    restart: 'Neu starten',
    shutdown: 'Herunterfahren',
    cancel: 'Abbrechen',
    close: 'Schließen',
    running: 'Läuft …',
    success: 'Erfolgreich abgeschlossen',
    errorPrefix: 'Fehler: ',
    requestFailed: 'Anfrage fehlgeschlagen.',
    alreadyRunning: 'Läuft bereits – versuch es gleich noch einmal.',
    disconnected: 'Verbindung zum Pi unterbrochen.',
    restarting: 'Pi startet neu …',
    shuttingDown: 'Pi fährt herunter …',
    dialogs: {
      installAutodarts: {
        title: 'Autodarts installieren',
        text: 'Autodarts wird auf dem Raspberry Pi installiert. Das dauert ein paar Minuten.',
        yes: 'Installieren',
      },
      updateAutodarts: {
        title: 'Autodarts aktualisieren',
        text: 'Autodarts auf dem Raspberry Pi wird aktualisiert. Die Scheibe erkennt währenddessen keine Darts.',
        yes: 'Aktualisieren',
      },
      uninstallAutodarts: {
        title: 'Autodarts deinstallieren',
        text: 'Autodarts wird vom Raspberry Pi entfernt. Die Scheibe erkennt danach keine Darts mehr.',
        yes: 'Deinstallieren',
      },
      updateRaspdarts: {
        title: 'Raspdarts aktualisieren',
        text: 'Raspdarts auf dem Raspberry Pi wird aktualisiert und neu gestartet. Der Beamer ist dabei kurz weg.',
        yes: 'Aktualisieren',
      },
      uninstallRaspdarts: {
        title: 'Raspdarts deinstallieren',
        text: 'Raspdarts wird vom Raspberry Pi entfernt. Diese Seite und der Beamer funktionieren danach nicht mehr.',
        yes: 'Deinstallieren',
      },
      restart: {
        title: 'Neu starten',
        text: 'Der Raspberry Pi startet neu. Beamer und Scheibe sind etwa eine Minute nicht verfügbar.',
        yes: 'Neu starten',
      },
      shutdown: {
        title: 'Herunterfahren',
        text: 'Der Raspberry Pi fährt herunter. Zum Einschalten musst du ihn kurz vom Strom trennen.',
        yes: 'Herunterfahren',
      },
    },
  };

  const en = {
    connecting: 'Connecting …',
    piOnline: 'Pi online',
    piUnreachable: 'Pi unreachable',
    unreachableHint: 'Is the Pi switched on and on the same network? Expected address: raspdarts.local',
    cpu: 'CPU',
    ram: 'RAM',
    temperature: 'Temperature',
    uptime: 'Uptime',
    autodarts: 'Autodarts',
    raspberryPi: 'Raspberry Pi',
    version: 'Version',
    status: 'Status',
    installed: 'Installed',
    notInstalled: 'Not installed',
    raspdarts: 'Raspdarts',
    beamer: 'Beamer',
    beamerConnected: 'Connected',
    beamerDisconnected: 'Not connected',
    installAutodarts: 'Install Autodarts',
    updateAutodarts: 'Update Autodarts',
    uninstallAutodarts: 'Uninstall',
    openMonitor: 'Open monitor',
    updateRaspdarts: 'Update Raspdarts',
    uninstallRaspdarts: 'Uninstall Raspdarts',
    restart: 'Restart',
    shutdown: 'Shut down',
    cancel: 'Cancel',
    close: 'Close',
    running: 'Running …',
    success: 'Completed successfully',
    errorPrefix: 'Error: ',
    requestFailed: 'Request failed.',
    alreadyRunning: 'Already running – try again shortly.',
    disconnected: 'Connection to the Pi was lost.',
    restarting: 'Pi is restarting …',
    shuttingDown: 'Pi is shutting down …',
    dialogs: {
      installAutodarts: {
        title: 'Install Autodarts',
        text: 'Autodarts will be installed on the Raspberry Pi. This takes a few minutes.',
        yes: 'Install',
      },
      updateAutodarts: {
        title: 'Update Autodarts',
        text: 'Autodarts on the Raspberry Pi will be updated. The board will not detect darts in the meantime.',
        yes: 'Update',
      },
      uninstallAutodarts: {
        title: 'Uninstall Autodarts',
        text: 'Autodarts will be removed from the Raspberry Pi. The board will no longer detect darts.',
        yes: 'Uninstall',
      },
      updateRaspdarts: {
        title: 'Update Raspdarts',
        text: 'Raspdarts on the Raspberry Pi will be updated and restarted. The beamer display will be gone briefly.',
        yes: 'Update',
      },
      uninstallRaspdarts: {
        title: 'Uninstall Raspdarts',
        text: 'Raspdarts will be removed from the Raspberry Pi. This page and the beamer display will stop working.',
        yes: 'Uninstall',
      },
      restart: {
        title: 'Restart',
        text: 'The Raspberry Pi will restart. Beamer display and board will be unavailable for about a minute.',
        yes: 'Restart',
      },
      shutdown: {
        title: 'Shut down',
        text: 'The Raspberry Pi will shut down. To switch it back on, briefly disconnect it from power.',
        yes: 'Shut down',
      },
    },
  };

  const TABLES = { de, en };

  // <html lang> taugt nicht: Autodarts setzt dort "en", auch wenn die
  // Oberflaeche deutsch ist. Die Beschriftung der Hauptnavigation folgt dagegen
  // der eingestellten Sprache.
  function detectLanguage(navLabel) {
    return navLabel === 'Hauptnavigation' ? 'de' : 'en';
  }

  function getTexts(language) {
    return TABLES[language] ?? en;
  }

  root.raspdartsTexts = { detectLanguage, getTexts };
})(globalThis);
