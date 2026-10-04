#!/usr/bin/env bash
# Aktualisiert Raspdarts aus GitHub. Laeuft als root, gestartet per sudo aus dem
# Dienst. git und Build laufen als Dienst-Benutzer, damit im Installationsordner
# nichts root gehoert.
set -euo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
INSTALL_DIR="$TARGET_HOME/raspdarts"
as_user() { sudo -u "$TARGET_USER" -H "$@"; }

echo "=== Raspdarts aktualisieren ==="
echo "--- git pull ---"
as_user git -C "$INSTALL_DIR" pull --ff-only origin main

echo "--- Build ---"
as_user bash -c "cd '$INSTALL_DIR/server' && npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev"

bash "$INSTALL_DIR/server/scripts/setup-root.sh"

# Verzoegert neu starten, damit die Rueckmeldung an das Panel noch ankommt.
systemd-run --quiet --on-active=2 systemctl restart raspdarts
echo "Update fertig, der Dienst startet in 2 Sekunden neu."
