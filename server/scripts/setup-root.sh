#!/usr/bin/env bash
# Richtet alles ein, was root gehoert: Root-Skripte, sudoers, systemd-Dienst.
# Aufruf: sudo bash setup-root.sh [--hostname]
#   --hostname  setzt zusaetzlich den Hostnamen auf "raspdarts" (nur bei Erstinstallation)
set -euo pipefail

TARGET_USER="${SUDO_USER:?Dieses Skript muss per sudo gestartet werden}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LIB_DIR=/usr/local/lib/raspdarts
SUDO_SCRIPTS=(autodarts-install.sh autodarts-uninstall.sh raspdarts-update.sh raspdarts-uninstall.sh reboot.sh shutdown.sh)

echo "--- Root-Skripte nach $LIB_DIR ---"
install -d -m 755 -o root -g root "$LIB_DIR"
for name in "${SUDO_SCRIPTS[@]}"; do
  # Erst kopieren, dann umbenennen: ein gerade laufendes Skript (das Update
  # selbst) liest so ungestoert seine alte Fassung zu Ende.
  tmp="$(mktemp "$LIB_DIR/.tmp.XXXXXX")"
  cp "$REPO_DIR/server/scripts/$name" "$tmp"
  chmod 755 "$tmp"
  mv -f "$tmp" "$LIB_DIR/$name"
done

echo "--- sudo-Rechte ---"
rules=""
for name in "${SUDO_SCRIPTS[@]}"; do
  # "" am Ende: das Skript darf nur ohne Argumente aufgerufen werden.
  rules+="${rules:+, }$LIB_DIR/$name \"\""
done
tmp="$(mktemp)"
echo "$TARGET_USER ALL=(root) NOPASSWD: $rules" > "$tmp"
visudo -cf "$tmp" >/dev/null
install -m 440 -o root -g root "$tmp" /etc/sudoers.d/raspdarts
rm -f "$tmp"

echo "--- systemd-Dienst ---"
sed "s|__USER__|$TARGET_USER|g; s|__HOME__|$TARGET_HOME|g" "$REPO_DIR/deploy/raspdarts.service" \
  > /etc/systemd/system/raspdarts.service
systemctl daemon-reload
systemctl enable raspdarts >/dev/null

if [[ "${1:-}" == "--hostname" ]]; then
  echo "--- Hostname raspdarts ---"
  hostnamectl set-hostname raspdarts
  sed -i 's/127\.0\.1\.1.*/127.0.1.1\traspdarts/' /etc/hosts
  systemctl restart avahi-daemon || true
  sleep 2
  actual="$(avahi-resolve --name raspdarts.local 2>/dev/null | awk '{print $1}' || true)"
  if [[ "$actual" != "raspdarts.local" ]]; then
    echo "WARNUNG: raspdarts.local ist im Netz nicht eindeutig erreichbar (mDNS-Kollision?)."
    echo "         Die Extension findet den Pi dann eventuell nicht."
  fi
fi
