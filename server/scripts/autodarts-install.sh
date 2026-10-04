#!/usr/bin/env bash
# Installiert oder aktualisiert Autodarts. Laeuft als root, gestartet per sudo
# aus dem Raspdarts-Dienst.
set -euo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
export DEBIAN_FRONTEND=noninteractive

echo "=== Autodarts installieren ==="
curl -fsSL https://get.autodarts.io | bash

# Programm nach /usr/local/bin kopieren, damit der Dienst die Version lesen kann.
bin="$(find /root/.local "$TARGET_HOME/.local" -maxdepth 6 -name autodarts -type f 2>/dev/null | head -1 || true)"
if [[ -n "$bin" ]]; then
  install -m 755 "$bin" /usr/local/bin/autodarts
fi
echo "Autodarts ist installiert."
