/*
 * Inhalte des aktiven Profils als Merkmale an #viewer: data-<baustein> und
 * data-<baustein>-<option>. Ein- und Ausblenden erledigt damit style.css -
 * eine neue Option im Katalog braucht meist nur eine CSS-Regel.
 *
 * Was es in der angezeigten Spielart nicht gibt, gilt als aus (mode null =
 * unbekannte Spielart: nur, was es ueberall gibt).
 *
 * Namen werden klein geschrieben: HTML macht das bei Attributen ohnehin, so
 * stimmen JS und CSS sicher ueberein (letzterDart → data-scheibe-letzterdart).
 */

const availableIn = (item, mode) => !item.modes || (mode !== null && item.modes.includes(mode));

export function contentAttributes(catalog, content, mode) {
  const attrs = {};
  for (const part of catalog.parts) {
    const value = content[part.id] ?? {};
    const partOn = availableIn(part, mode) && (value.on ?? part.default);
    attrs[`data-${part.id}`.toLowerCase()] = partOn ? "on" : "off";
    for (const option of part.options) {
      const raw = value[option.id] ?? option.default;
      const name = `data-${part.id}-${option.id}`.toLowerCase();
      if (option.type === "toggle") attrs[name] = availableIn(option, mode) && raw ? "on" : "off";
      else attrs[name] = String(raw);
    }
  }
  return attrs;
}

export function applyContent(el, catalog, content, mode) {
  for (const [name, value] of Object.entries(contentAttributes(catalog, content, mode))) {
    el.setAttribute(name, value);
  }
}
