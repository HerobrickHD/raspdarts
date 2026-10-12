/*
 * Inhalte des aktiven Profils als Merkmale an #viewer: data-<baustein> und
 * data-<baustein>-<option>. Ein- und Ausblenden erledigt damit style.css -
 * eine neue Option im Katalog braucht meist nur eine CSS-Regel.
 *
 * Namen werden klein geschrieben: HTML macht das bei Attributen ohnehin, so
 * stimmen JS und CSS sicher ueberein (letzterDart → data-scheibe-letzterdart).
 */

export function contentAttributes(catalog, content) {
  const attrs = {};
  for (const part of catalog.parts) {
    const value = content[part.id] ?? {};
    attrs[`data-${part.id}`.toLowerCase()] = (value.on ?? part.default) ? "on" : "off";
    for (const option of part.options) {
      const raw = value[option.id] ?? option.default;
      attrs[`data-${part.id}-${option.id}`.toLowerCase()] =
        option.type === "toggle" ? (raw ? "on" : "off") : String(raw);
    }
  }
  return attrs;
}

export function applyContent(el, catalog, content) {
  for (const [name, value] of Object.entries(contentAttributes(catalog, content))) {
    el.setAttribute(name, value);
  }
}
