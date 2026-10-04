set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR"
DIST="$SCRIPT_DIR/dist"

FILES=(background.js content.js modal.html modal.css icons)

for BROWSER in chrome firefox; do
  TARGET="$DIST/$BROWSER"
  rm -rf "$TARGET" && mkdir -p "$TARGET/icons"
  for f in "${FILES[@]}"; do
    cp -r "$SRC/$f" "$TARGET/"
  done
  cp "$SRC/manifest.$BROWSER.json" "$TARGET/manifest.json"
  echo "Gebaut: $TARGET"
done

echo "Fertig! Lade dist/chrome/ in Chrome, dist/firefox/manifest.json in Firefox."
