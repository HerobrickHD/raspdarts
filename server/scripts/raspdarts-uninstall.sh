#!/usr/bin/env bash
# Entfernt Raspdarts vollstaendig. Laeuft als root, gestartet per sudo aus dem
# Dienst. Der Dienst selbst wird zuletzt und verzoegert gestoppt, damit die
# Rueckmeldung an das Panel noch ankommt.
set -uo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

echo "=== Raspdarts deinstallieren ==="
rm -f /etc/sudoers.d/raspdarts
rm -rf "$TARGET_HOME/raspdarts"
echo "Dateien entfernt. Der Hostname bleibt 'raspdarts'; zuruecksetzen mit:"
echo "  sudo hostnamectl set-hostname raspberrypi"

systemd-run --quiet --on-active=2 /bin/sh -c \
  'systemctl disable --now raspdarts; rm -f /etc/systemd/system/raspdarts.service; systemctl daemon-reload; rm -rf /usr/local/lib/raspdarts'
echo "Der Dienst wird in 2 Sekunden beendet."
