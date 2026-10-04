#!/usr/bin/env bash
# Entfernt Autodarts. Laeuft als root, gestartet per sudo aus dem Raspdarts-Dienst.
# Jeder Schritt ist "best effort": was nicht da ist, muss nicht weg.
set -uo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

echo "=== Autodarts deinstallieren ==="
systemctl stop autodarts 2>/dev/null || true
systemctl disable autodarts 2>/dev/null || true
rm -f /usr/local/bin/autodarts
find /root/.local "$TARGET_HOME/.local" "$TARGET_HOME/.autodarts" -maxdepth 6 -name autodarts -type f -delete 2>/dev/null || true
echo "Autodarts entfernt."
