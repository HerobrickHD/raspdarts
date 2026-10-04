#!/usr/bin/env bash
# Baut dist/chrome/ und dist/firefox/ aus src/, den gemeinsamen Dateien und dem
# jeweiligen Manifest.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/dist"

for BROWSER in chrome firefox; do
  TARGET="$DIST/$BROWSER"
  rm -rf "$TARGET" && mkdir -p "$TARGET"
  cp "$SCRIPT_DIR"/src/*.js "$TARGET/"
  cp -r "$SCRIPT_DIR/modal.html" "$SCRIPT_DIR/modal.css" "$SCRIPT_DIR/icons" "$TARGET/"
  cp "$SCRIPT_DIR/manifest.$BROWSER.json" "$TARGET/manifest.json"
  echo "Gebaut: $TARGET"
done

echo "Fertig! Chrome: dist/chrome/ entpackt laden. Firefox: dist/firefox/manifest.json als temporaeres Add-on laden."
