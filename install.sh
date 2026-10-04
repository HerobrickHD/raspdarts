#!/usr/bin/env bash
# Raspdarts - Installer fuer den Raspberry Pi
#   Installieren/Aktualisieren: curl -fsSL https://raw.githubusercontent.com/HerobrickHD/raspdarts/main/install.sh | bash
#   Deinstallieren:             curl -fsSL https://raw.githubusercontent.com/HerobrickHD/raspdarts/main/install.sh | bash -s -- --uninstall

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[raspdarts]${NC} $*"; }
warn() { echo -e "${YELLOW}[raspdarts]${NC} $*"; }
err()  { echo -e "${RED}[raspdarts] FEHLER:${NC} $*" >&2; exit 1; }

main() {
  set -euo pipefail

  REPO_URL="https://github.com/HerobrickHD/raspdarts.git"
  INSTALL_DIR="$HOME/raspdarts"
  LIB_DIR=/usr/local/lib/raspdarts

  [[ $EUID -ne 0 ]] || err "Nicht als root starten, sondern als normaler Benutzer."

  # --- Deinstallation ----------------------------------------------------------
  if [[ "${1:-}" == "--uninstall" ]]; then
    [[ -x "$LIB_DIR/raspdarts-uninstall.sh" ]] || err "Raspdarts ist nicht installiert."
    sudo "$LIB_DIR/raspdarts-uninstall.sh"
    exit 0
  fi

  # --- Voraussetzungen ---------------------------------------------------------
  if ! command -v git &>/dev/null || ! command -v curl &>/dev/null; then
    info "Installiere git und curl ..."
    sudo apt-get update -qq
    sudo apt-get install -y git curl
  fi
  if [[ ! -x /usr/bin/node ]] || ! /usr/bin/node -e 'process.exit(+process.versions.node.split(".")[0] >= 20 ? 0 : 1)'; then
    info "Installiere Node.js 20 ..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt-get install -y nodejs
  fi

  # --- Umstieg vom alten Raspdarts-Backend --------------------------------------
  if [[ -d "$INSTALL_DIR/.git" ]] && git -C "$INSTALL_DIR" remote get-url origin | grep -qi 'Raspdarts-backend'; then
    warn "Altes Raspdarts-Backend gefunden - wird durch die neue Version ersetzt."
    sudo systemctl disable --now raspdarts 2>/dev/null || true
    sudo rm -f /etc/sudoers.d/raspdarts /etc/systemd/system/raspdarts.service
    sudo systemctl daemon-reload
    rm -rf "$INSTALL_DIR"
  fi

  # --- Update ------------------------------------------------------------------
  if [[ -d "$INSTALL_DIR/.git" && -x "$LIB_DIR/raspdarts-update.sh" ]]; then
    info "Raspdarts ist bereits installiert - aktualisiere ..."
    sudo "$LIB_DIR/raspdarts-update.sh"
    exit 0
  fi

  # --- Neuinstallation ---------------------------------------------------------
  if [[ ! -d "$INSTALL_DIR/.git" ]]; then
    info "Neuinstallation nach $INSTALL_DIR ..."
    git clone "$REPO_URL" "$INSTALL_DIR"
  else
    info "Unvollstaendige Installation gefunden - setze sie fort ..."
  fi
  (cd "$INSTALL_DIR/server" && npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev)
  sudo bash "$INSTALL_DIR/server/scripts/setup-root.sh" --hostname
  sudo systemctl restart raspdarts

  echo ""
  info "Fertig! Raspdarts laeuft auf http://raspdarts.local:8743/"
  info "Test: curl -H 'X-Raspdarts: 1' http://raspdarts.local:8743/api/status"
}

main "$@"
