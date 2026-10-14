/*
 * Seitenleiste im Stil von Autodarts: Profil und Format, Spielart mit
 * Vorschau, Zuruecksetzen und Uebernehmen, darunter die Bausteine als Kaesten
 * mit Schaltern. Die Liste entsteht aus dem Katalog vom Pi - eine neue Option
 * im Katalog erscheint hier ohne Aenderung an dieser Datei.
 *
 * Nichts darf springen: Rueckfragen, Formulare und die Tastenkuerzel kommen
 * als Dialog ueber das Fenster, Knoepfe stehen immer an derselben Stelle
 * (gesperrt statt versteckt). Nur das Auf- und Zuklappen der Kaesten schiebt,
 * weil man es selbst ausloest - offen ist immer hoechstens einer, und der
 * angeklickte Kopf bleibt dabei stehen, soweit die Leiste rollen kann.
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
  /* Objekt-URL des letzten Bilds einer Kamera (camera-feed.js) - fuer die Vorschaubilder. */
  let cameraUrl = () => null;
  /* Offener Dialog - er merkt sich das Profil, das er nennt: Wechselt
     inzwischen ein anderes Geraet das aktive Profil, darf "Ja" nicht das neue
     treffen. */
  let dialogOpen = false;
  /* Der eine offene Kasten (data-card) oder null; beim ersten Oeffnen Profil. */
  let openCard = "profil";

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

  /* --- Kaesten ------------------------------------------------------------ */

  const panelBody = node("div", { className: "panel-body" });

  function showOpen(section) {
    const open = section.dataset.card === openCard;
    section.classList.toggle("is-open", open);
    section.querySelector(":scope > .part-options").hidden = !open;
    section.querySelector(":scope > .part-head .chevron")?.setAttribute("aria-expanded", String(open));
  }

  function toggleCard(id, head) {
    const before = head.getBoundingClientRect().top;
    openCard = openCard === id ? null : id;
    for (const section of root.querySelectorAll("[data-card]")) showOpen(section);
    // Geht darueber ein Kasten zu, rollt die Leiste mit - der Kopf bleibt unter der Maus.
    panelBody.scrollTop += head.getBoundingClientRect().top - before;
  }

  /**
   * Kasten mit Kopf zum Auf- und Zuklappen (ein Klick auf den Kopf, nicht auf
   * den Schalter darin). summary steht nur im zugeklappten Kopf, extra immer.
   */
  function card(id, title, children, { summary = null, extra = [], className = "" } = {}) {
    const head = node("div", { className: "part-head" }, [node("span", { className: "part-title", textContent: title })]);
    if (summary) head.append(summary);
    head.append(...extra);
    const body = node("div", { className: "part-options" }, children);
    const section = node("section", { className: `panel-card ${className}`.trim() }, [head, body]);
    section.dataset.card = id;
    if (children.length > 0) {
      const expand = node("button", { type: "button", className: "btn-icon chevron" });
      expand.setAttribute("aria-label", `${title}: auf- oder zuklappen`);
      head.append(expand);
      head.classList.add("is-toggle");
      head.addEventListener("click", (event) => {
        if (!event.target.closest("input")) toggleCard(id, head);
      });
    }
    showOpen(section);
    return section;
  }

  /* --- Profil ------------------------------------------------------------- */

  const profileSummary = node("span", { className: "card-summary" });

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
  const modeSummary = node("span", { className: "card-summary" });
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

  /* Kamera-Wahl: drei Vorschaubilder zum Anklicken statt Segmente. */
  function buildCameraPicks(part, option) {
    const picks = option.choices.map((choice) => {
      const input = node("input", { type: "radio", name: `${part.id}-${option.id}`, value: choice.id });
      Object.assign(input.dataset, { part: part.id, option: option.id });
      const img = node("img", { alt: "" });
      img.dataset.cam = choice.id;
      return node("label", { className: "camera-pick" }, [input, img, node("span", { textContent: choice.label })]);
    });
    return node("div", { className: "camera-picks" }, picks);
  }

  function buildOption(part, option) {
    const element = buildOptionElement(part, option);
    // Nur sichtbar, wenn eine andere Option den passenden Wert hat (z. B. Kamera-Wahl bei Darstellung Kamera).
    if (option.showIf) Object.assign(element.dataset, { showIfPart: part.id, showIfOption: option.showIf.option, showIfValue: option.showIf.value });
    return element;
  }

  function buildOptionElement(part, option) {
    if (part.id === "scheibe" && option.id === "kamera") return buildCameraPicks(part, option);
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
    // Feste Bausteine (Hintergrund) haben keinen eigenen Schalter.
    const section = card(part.id, part.label, shown.map((option) => buildOption(part, option)), {
      extra: part.fixed ? [] : [switchInput({ part: part.id }, part.label)],
      className: "part",
    });
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
    panelBody,
    node("footer", { className: "panel-foot" }, [
      node("span", { textContent: "Auf der Bühne anklicken und ziehen." }),
      button("i", shortcutsDialog, { className: "btn-icon info", title: "Tastenkürzel", ariaLabel: "Tastenkürzel anzeigen" }),
    ]),
    status,
    scrim,
  );
  panelBody.append(
    card(
      "profil",
      "Profil",
      [
        field("Aktives Profil", select),
        node("div", { className: "btn-row" }, [newButton, renameButton, deleteButton]),
        field("Format", formatSelect),
      ],
      { summary: profileSummary },
    ),
    card(
      "spielart",
      "Spielart",
      [
        modeSelect,
        node("div", { className: "btn-row" }, [resetButton, copyButton]),
        node("div", { className: "field" }, [
          node("span", { textContent: "Vorschau mit Spielern" }),
          node("div", { className: "segments" }, playerButtons),
        ]),
      ],
      { summary: modeSummary, extra: [modeState] },
    ),
    partList,
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
    profileSummary.textContent = profile.name;
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

    for (const element of partList.querySelectorAll("[data-show-if-option]")) {
      const { showIfPart, showIfOption, showIfValue } = element.dataset;
      element.hidden = resolved.content[showIfPart]?.[showIfOption] !== showIfValue;
    }
    for (const img of partList.querySelectorAll(".camera-pick img")) {
      const url = cameraUrl(Number(img.dataset.cam));
      if (url && img.getAttribute("src") !== url) img.src = url;
      img.classList.toggle("is-empty", !url);
    }

    modeSelect.value = mode;
    modeSummary.textContent = modeLabel(mode);
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
      cameraUrl = next.cameraUrl ?? cameraUrl;
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
