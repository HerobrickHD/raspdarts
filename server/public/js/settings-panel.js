/*
 * Seitenleiste im Stil von Autodarts: Profil und Format, Spielart mit
 * Vorschau, Zuruecksetzen und Uebernehmen, darunter die Bausteine als Kaesten
 * mit Schaltern. Die Liste entsteht aus dem Katalog vom Pi - eine neue Option
 * im Katalog erscheint hier ohne Aenderung an dieser Datei.
 *
 * Nichts darf springen: Rueckfragen, Formulare und die Tastenkuerzel kommen
 * als Dialog ueber das Fenster, Knoepfe stehen immer an derselben Stelle
 * (gesperrt statt versteckt). Nur das Aufklappen eines Kastens schiebt, weil
 * man es selbst ausloest.
 *
 * Kennt den Pi nicht: alles, was der Nutzer tut, geht an die handlers.
 */

function node(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  el.append(...children);
  return el;
}

function button(text, onClick, props = {}) {
  const el = node("button", { type: "button", textContent: text, ...props });
  el.addEventListener("click", onClick);
  return el;
}

/** Schalter wie bei Autodarts: eine Checkbox mit role=switch, per CSS als Pille. */
function switchInput(dataset, label) {
  const input = node("input", { type: "checkbox", className: "switch" });
  input.setAttribute("role", "switch");
  input.setAttribute("aria-label", label);
  Object.assign(input.dataset, dataset);
  return input;
}

const availableIn = (item, mode) => !item.modes || item.modes.includes(mode);

/* Alle Kuerzel - hinter dem i-Knopf, damit die Leiste kurz bleibt. */
const SHORTCUTS = [
  [
    "Maus",
    [
      ["Anklicken und ziehen", "verschieben"],
      ["Griff an der Ecke", "Größe (Bereiche: Breite und Höhe)"],
      ["Kreis über der Scheibe", "drehen – rastet bei 0°, 90°, 180° ein"],
      ["Alt beim Drehen", "frei drehen"],
      ["Mausrad auf der Scheibe", "Größe der Scheibe (Umschalt: fein)"],
    ],
  ],
  [
    "Tastatur (nach Anklicken)",
    [
      ["Pfeile", "verschieben (Umschalt: grob)"],
      ["+ / −", "Größe (Umschalt: grob)"],
      ["Q / E", "Scheibe drehen"],
      ["Strg + Pfeil", "Bereich breiter/schmaler, höher/niedriger"],
      ["Esc", "schließen"],
    ],
  ],
];

export function createPanel(root, handlers) {
  let catalog = null;
  let profile = null;
  let profiles = [];
  let profilesKey = "";
  let mode = "x01";
  let players = 2;
  /* Inhalte des Profils fuer die gewaehlte Spielart (resolve-profile.js). */
  let resolved = null;
  let modesKey = "";
  /* Offener Dialog - er merkt sich das Profil, das er nennt: Wechselt
     inzwischen ein anderes Geraet das aktive Profil, darf "Ja" nicht das neue
     treffen. */
  let dialogOpen = false;
  const expanded = new Set(["scheibe", "spieler"]);

  const modeLabel = (id) => catalog.modes.find((m) => m.id === id)?.label ?? id;

  /* --- Dialog ueber dem Fenster ------------------------------------------- */

  const dialogBox = node("div", { className: "dialog" });
  dialogBox.setAttribute("role", "dialog");
  dialogBox.setAttribute("aria-modal", "true");
  const scrim = node("div", { className: "dialog-scrim", hidden: true }, [dialogBox]);
  scrim.addEventListener("click", (event) => {
    if (event.target === scrim) closeDialog();
  });

  /** body: Inhalt; actions: [{ text, primary?, danger?, run }] - run gibt false zurueck, wenn der Dialog offen bleiben soll. */
  function openDialog(title, body, actions = []) {
    const buttons = actions.map(({ text, primary, danger, run }) =>
      button(text, () => {
        if (run() !== false) closeDialog();
      }, { className: primary ? "btn btn-primary" : danger ? "btn btn-danger" : "btn" }),
    );
    dialogBox.replaceChildren(
      node("div", { className: "dialog-head" }, [
        node("h2", { textContent: title }),
        button("×", closeDialog, { className: "btn-icon", title: "Schließen", ariaLabel: "Schließen" }),
      ]),
      ...body,
      node("div", { className: "dialog-actions" }, [button("Abbrechen", closeDialog, { className: "btn" }), ...buttons]),
    );
    scrim.hidden = false;
    dialogOpen = true;
    (dialogBox.querySelector("input, select") ?? buttons.at(-1))?.focus();
  }

  function closeDialog() {
    scrim.hidden = true;
    dialogOpen = false;
    dialogBox.replaceChildren();
  }

  function confirm(title, text, actionText, run, { danger = false } = {}) {
    openDialog(title, [node("p", { className: "dialog-text", textContent: text })], [
      { text: actionText, primary: !danger, danger, run },
    ]);
  }

  function nameDialog(title, value, actionText, run) {
    const name = node("input", { type: "text", maxLength: 40, value, placeholder: "Name" });
    const form = node("form", { className: "dialog-field" }, [node("label", { textContent: "Name" }), name]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      run(name.value);
      closeDialog();
    });
    openDialog(title, [form], [{ text: actionText, primary: true, run: () => run(name.value) }]);
  }

  function shortcutsDialog() {
    openDialog(
      "Tastenkürzel",
      SHORTCUTS.map(([title, rows]) =>
        node("section", { className: "shortcuts" }, [
          node("h3", { textContent: title }),
          node(
            "table",
            {},
            rows.map(([key, what]) => node("tr", {}, [node("th", { textContent: key }), node("td", { textContent: what })])),
          ),
        ]),
      ),
    );
  }

  /* --- Profil ------------------------------------------------------------- */

  const select = node("select");
  select.setAttribute("aria-label", "Aktives Profil");
  select.addEventListener("change", () => handlers.onSelect(select.value));

  const formatSelect = node("select");
  formatSelect.setAttribute("aria-label", "Format");
  formatSelect.addEventListener("change", () => handlers.onFormat(formatSelect.value));

  const newButton = button("Neu", () => nameDialog("Neues Profil", "", "Anlegen", (name) => handlers.onCreate(name)), {
    className: "btn",
  });
  const renameButton = button("Umbenennen", () => {
    const id = profile.id;
    nameDialog("Profil umbenennen", profile.name, "Speichern", (name) => handlers.onRename(id, name));
  }, { className: "btn" });
  const deleteButton = button("Löschen", () => {
    const { id, name } = profile;
    confirm("Profil löschen", `Profil „${name}“ löschen?`, "Löschen", () => handlers.onDelete(id), { danger: true });
  }, { className: "btn btn-danger-text" });

  /* --- Spielart ----------------------------------------------------------- */

  const modeSelect = node("select");
  modeSelect.setAttribute("aria-label", "Spielart");
  modeSelect.addEventListener("change", () => handlers.onMode(modeSelect.value));

  const modeState = node("span", { className: "chip" });
  const resetButton = button("Zurücksetzen", () => {
    const { id, name } = profile;
    const target = mode;
    confirm(
      "Auf Standard zurücksetzen",
      `${modeLabel(target)} in „${name}“ auf den Standard zurücksetzen? Inhalte und Layout dieser Spielart gehen verloren, auch die Lage der Scheibe.`,
      "Zurücksetzen",
      () => handlers.onReset(id, target),
      { danger: true },
    );
  }, { className: "btn" });
  const copyButton = button("Übernehmen von …", () => {
    const { id } = profile;
    const target = mode;
    const others = catalog.modes.filter((m) => m.id !== target);
    const customized = (m) => Object.hasOwn(profile.spielarten, m.id);
    const source = node(
      "select",
      {},
      [...others.filter(customized), ...others.filter((m) => !customized(m))].map((m) =>
        node("option", { value: m.id, textContent: `${m.label}${customized(m) ? " · angepasst" : ""}` }),
      ),
    );
    openDialog(
      `Übernehmen nach ${modeLabel(target)}`,
      [
        node("div", { className: "dialog-field" }, [node("label", { textContent: "Von Spielart" }), source]),
        node("p", {
          className: "dialog-text",
          textContent: `Inhalte und Layout werden kopiert; die bisherigen Einstellungen von ${modeLabel(target)} gehen verloren.`,
        }),
      ],
      [{ text: "Übernehmen", primary: true, run: () => handlers.onCopy(id, source.value, target) }],
    );
  }, { className: "btn" });

  const playerButtons = [1, 2, 3, 4, 5, 6].map((n) =>
    button(String(n), () => handlers.onPlayers(n), { className: "segment" }),
  );

  /* --- Bausteine ---------------------------------------------------------- */

  const partList = node("div", { className: "parts" });

  function buildOption(part, option) {
    if (option.type === "toggle") {
      return node("label", { className: "option-row" }, [
        node("span", { textContent: option.label }),
        switchInput({ part: part.id, option: option.id }, option.label),
      ]);
    }
    const segments = option.choices.map((choice) => {
      const input = node("input", { type: "radio", name: `${part.id}-${option.id}`, value: choice.id });
      Object.assign(input.dataset, { part: part.id, option: option.id });
      return node("label", { className: "segment" }, [input, node("span", { textContent: choice.label })]);
    });
    return node("div", { className: "option-choice" }, [
      node("span", { className: "option-label", textContent: option.label }),
      node("div", { className: "segments" }, segments),
    ]);
  }

  function buildPart(part) {
    const shown = part.options.filter((option) => availableIn(option, mode));
    const options = node(
      "div",
      { className: "part-options", hidden: !part.fixed && !expanded.has(part.id) },
      shown.map((option) => buildOption(part, option)),
    );
    const head = node("div", { className: "part-head" }, [node("span", { className: "part-title", textContent: part.label })]);
    // Feste Bausteine (Hintergrund) sind immer offen und haben keinen eigenen Schalter.
    if (!part.fixed && shown.length > 0) {
      const expand = button("", () => {
        if (expanded.has(part.id)) expanded.delete(part.id);
        else expanded.add(part.id);
        options.hidden = !expanded.has(part.id);
        expand.setAttribute("aria-expanded", String(!options.hidden));
      }, { className: "btn-icon chevron" });
      expand.setAttribute("aria-expanded", String(!options.hidden));
      expand.setAttribute("aria-label", `${part.label}: Einzelteile`);
      head.append(expand);
    }
    if (!part.fixed) head.append(switchInput({ part: part.id }, part.label));
    const section = node("section", { className: "panel-card part" }, [head, options]);
    section.dataset.part = part.id;
    return section;
  }

  function buildParts() {
    partList.replaceChildren(...catalog.parts.filter((p) => availableIn(p, mode)).map(buildPart));
  }

  partList.addEventListener("change", (event) => {
    const input = event.target;
    const { part, option } = input.dataset;
    if (!part || !resolved) return;
    const content = structuredClone(resolved.content);
    if (!option) content[part].on = input.checked;
    else content[part][option] = input.type === "radio" ? input.value : input.checked;
    handlers.onContent(content);
  });

  /* --- Aufbau ------------------------------------------------------------- */

  const status = node("p", { className: "toast" });
  status.setAttribute("role", "status");

  const field = (labelText, control) => node("label", { className: "field" }, [node("span", { textContent: labelText }), control]);

  root.replaceChildren(
    node("header", { className: "panel-head" }, [
      node("h1", { textContent: "Einstellungen" }),
      button("×", () => handlers.onClose(), { className: "btn-icon", title: "Schließen", ariaLabel: "Einstellungen schließen" }),
    ]),
    node("div", { className: "panel-body" }, [
      node("section", { className: "panel-card" }, [
        node("h2", { textContent: "Profil" }),
        field("Aktives Profil", select),
        node("div", { className: "btn-row" }, [newButton, renameButton, deleteButton]),
        field("Format", formatSelect),
      ]),
      node("section", { className: "panel-card" }, [
        node("div", { className: "card-head" }, [node("h2", { textContent: "Spielart" }), modeState]),
        modeSelect,
        node("div", { className: "btn-row" }, [resetButton, copyButton]),
        node("div", { className: "field" }, [
          node("span", { textContent: "Vorschau mit Spielern" }),
          node("div", { className: "segments" }, playerButtons),
        ]),
      ]),
      partList,
    ]),
    node("footer", { className: "panel-foot" }, [
      node("span", { textContent: "Auf der Bühne anklicken und ziehen." }),
      button("i", shortcutsDialog, { className: "btn-icon info", title: "Tastenkürzel", ariaLabel: "Tastenkürzel anzeigen" }),
    ]),
    status,
    scrim,
  );

  function buildFormats() {
    formatSelect.replaceChildren(...catalog.formats.map((f) => node("option", { value: f.id, textContent: f.label })));
  }

  function buildModeSelect() {
    modeSelect.replaceChildren(
      ...Object.entries(catalog.groups).map(([groupId, groupLabel]) =>
        node(
          "optgroup",
          { label: groupLabel },
          catalog.modes
            .filter((m) => m.group === groupId)
            .map((m) =>
              node("option", {
                value: m.id,
                textContent: `${m.label} · ${Object.hasOwn(profile.spielarten, m.id) ? "angepasst" : "Standard"}`,
              }),
            ),
        ),
      ),
    );
  }

  function update() {
    // Die Auswahl nur neu bauen, wenn sich die Liste aendert - sonst klappt
    // eine gerade geoeffnete Auswahl bei jeder Nachricht vom Pi zu.
    const key = JSON.stringify(profiles);
    if (key !== profilesKey) {
      profilesKey = key;
      select.replaceChildren(...profiles.map((p) => node("option", { value: p.id, textContent: p.name })));
    }
    select.value = profile.id;
    deleteButton.disabled = profiles.length <= 1;
    deleteButton.title = deleteButton.disabled ? "Das letzte Profil bleibt" : "";
    formatSelect.value = profile.format;

    for (const input of partList.querySelectorAll("input")) {
      const value = resolved.content[input.dataset.part];
      if (!value) continue;
      const option = input.dataset.option;
      if (!option) input.checked = value.on;
      else if (input.type === "radio") input.checked = value[option] === input.value;
      else input.checked = value[option] === true;
    }
    for (const section of partList.querySelectorAll(".part")) {
      const on = resolved.content[section.dataset.part]?.on ?? true;
      section.classList.toggle("is-off", !on);
      for (const input of section.querySelectorAll(".part-options input")) input.disabled = !on;
    }

    modeSelect.value = mode;
    modeState.textContent = resolved.angepasst ? "Angepasst" : "Standard";
    modeState.classList.toggle("is-custom", resolved.angepasst);
    // Gesperrt statt versteckt - sonst verschiebt sich die Leiste.
    resetButton.disabled = !resolved.angepasst;
    resetButton.title = resetButton.disabled ? "Steht schon auf Standard" : "";
    for (const [index, b] of playerButtons.entries()) b.setAttribute("aria-pressed", String(index + 1 === players));
  }

  return {
    render(next) {
      if (profile && next.profile.id !== profile.id) closeDialog(); // gehoerte zum alten Profil
      const freshCatalog = next.catalog !== catalog;
      const freshMode = next.mode !== mode;
      catalog = next.catalog;
      profile = next.profile;
      profiles = next.profiles;
      mode = next.mode;
      players = next.players;
      resolved = next.resolved;
      if (freshCatalog) buildFormats();
      if (freshCatalog || freshMode) buildParts();
      const key = JSON.stringify(Object.keys(profile.spielarten).sort());
      if (freshCatalog || key !== modesKey) {
        modesKey = key;
        buildModeSelect();
      }
      update();
    },
    /** Schliesst einen offenen Dialog; true, wenn einer offen war (Esc schliesst erst ihn). */
    cancelAsk() {
      if (!dialogOpen) return false;
      closeDialog();
      return true;
    },
    setStatus(text) {
      status.textContent = text;
    },
  };
}
