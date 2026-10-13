/*
 * Seitenleiste, Schritt "Inhalte": Profil, gemeinsame Bausteine (gelten fuer
 * alle Spielarten), Spielart mit Vorschau und die Liste ihrer Bausteine. Die
 * Listen entstehen aus dem Katalog vom Pi - eine neue Option im Katalog
 * erscheint hier ohne Aenderung an dieser Datei.
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

const availableIn = (item, mode) => !item.modes || item.modes.includes(mode);

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
  /* Offenes Formular oder offene Rueckfrage: { kind: "new" | "rename" | "confirm", ... }.
     Sie merkt sich das Profil, das sie nennt - wechselt inzwischen ein anderes
     Geraet das aktive Profil, darf "Ja" nicht das neue treffen. */
  let ask = null;
  const expanded = new Set(["scheibe", "spieler"]);

  const select = node("select", { className: "settings-grow" });
  select.setAttribute("aria-label", "Aktives Profil");
  select.addEventListener("change", () => handlers.onSelect(select.value));

  const close = button("×", () => handlers.onClose(), { className: "settings-close", title: "Schließen" });
  close.setAttribute("aria-label", "Einstellungen schließen");

  const renameButton = button("Umbenennen", () => setAsk({ kind: "rename", id: profile.id }));
  const deleteButton = button("Löschen", () =>
    setAsk({ kind: "confirm", text: `Profil „${profile.name}“ löschen?`, yes: handlers.onDelete.bind(null, profile.id) }),
  );

  const formatSelect = node("select", { className: "settings-grow" });
  formatSelect.setAttribute("aria-label", "Format");
  formatSelect.addEventListener("change", () => handlers.onFormat(formatSelect.value));

  const modeSelect = node("select", { className: "settings-grow" });
  modeSelect.setAttribute("aria-label", "Spielart");
  modeSelect.addEventListener("change", () => handlers.onMode(modeSelect.value));

  const modeState = node("span", { className: "settings-mode-state" });
  const resetButton = button("Auf Standard zurücksetzen", () => {
    const label = catalog.modes.find((m) => m.id === mode)?.label ?? mode;
    setAsk({
      kind: "confirm",
      text: `${label} in „${profile.name}“ auf den Standard zurücksetzen? Inhalte und Layout dieser Spielart gehen verloren, die Scheibe bleibt.`,
      yes: handlers.onReset.bind(null, profile.id, mode),
    });
  });

  const playerButtons = [1, 2, 3, 4, 5, 6].map((n) =>
    button(String(n), () => handlers.onPlayers(n), { className: "settings-player" }),
  );

  const askArea = node("div", { className: "settings-ask", hidden: true });
  const sharedList = node("div", { className: "settings-list" });
  const modeList = node("div", { className: "settings-list" });
  const status = node("p", { className: "settings-status" });
  status.setAttribute("role", "status");

  root.replaceChildren(
    node("div", { className: "settings-row" }, [node("h2", { textContent: "Profil" }), close]),
    node("div", { className: "settings-row" }, [select]),
    node("div", { className: "settings-row" }, [button("Neu", () => setAsk({ kind: "new" })), renameButton, deleteButton]),
    askArea,
    node("div", { className: "settings-row" }, [
      node("span", { textContent: "Format:", title: "Seitenverhältnis des Bildschirms" }),
      formatSelect,
    ]),
    node("h2", { textContent: "Gemeinsam – gilt für alle Spielarten" }),
    sharedList,
    node("h2", { textContent: "Spielart" }),
    node("div", { className: "settings-row" }, [modeSelect]),
    node("div", { className: "settings-row" }, [modeState, resetButton]),
    node("div", { className: "settings-row settings-players" }, [
      node("span", { textContent: "Vorschau:", title: "Spieler in der Vorschau" }),
      ...playerButtons,
    ]),
    modeList,
    status,
    node("p", {
      className: "settings-hint",
      textContent:
        "Auf der Bühne: anklicken und ziehen = verschieben · Ecke = Größe · Kreis = Scheibe drehen (rastet bei 0°/90° ein, Alt: frei) · " +
        "Mausrad = Scheibengröße · Pfeile, +/−, Q/E = fein (Umschalt: grob) · Strg+Pfeil = Bereich größer/kleiner · Esc = schließen",
    }),
  );

  function buildOption(part, option) {
    if (option.type === "toggle") {
      const input = node("input", { type: "checkbox" });
      Object.assign(input.dataset, { part: part.id, option: option.id });
      return node("label", { className: "part-option" }, [input, ` ${option.label}`]);
    }
    const choices = option.choices.map((choice) => {
      const input = node("input", { type: "radio", name: `${part.id}-${option.id}`, value: choice.id });
      Object.assign(input.dataset, { part: part.id, option: option.id });
      return node("label", {}, [input, ` ${choice.label}`]);
    });
    return node("fieldset", { className: "part-option" }, [node("legend", { textContent: option.label }), ...choices]);
  }

  function buildPart(part) {
    const toggle = node("input", { type: "checkbox" });
    toggle.dataset.part = part.id;
    const head = node("div", { className: "part-head" }, [node("label", {}, [toggle, ` ${part.label}`])]);
    const shown = part.options.filter((option) => part.scope === "gemeinsam" || availableIn(option, mode));
    const options = node(
      "div",
      { className: "part-options", hidden: !expanded.has(part.id) },
      shown.map((option) => buildOption(part, option)),
    );
    if (shown.length > 0) {
      const expand = button(options.hidden ? "▸" : "▾", () => {
        if (expanded.has(part.id)) expanded.delete(part.id);
        else expanded.add(part.id);
        options.hidden = !expanded.has(part.id);
        expand.textContent = options.hidden ? "▸" : "▾";
        expand.setAttribute("aria-expanded", String(!options.hidden));
      }, { className: "part-expand" });
      expand.setAttribute("aria-expanded", String(!options.hidden));
      expand.setAttribute("aria-label", `${part.label}: Einzelteile`);
      head.append(expand);
    }
    const section = node("section", { className: "part" }, [head, options]);
    section.dataset.part = part.id;
    section.dataset.scope = part.scope;
    return section;
  }

  function buildFormats() {
    formatSelect.replaceChildren(...catalog.formats.map((f) => node("option", { value: f.id, textContent: f.label })));
  }

  function buildShared() {
    sharedList.replaceChildren(...catalog.parts.filter((p) => p.scope === "gemeinsam").map(buildPart));
  }

  function buildModeList() {
    modeList.replaceChildren(
      ...catalog.parts.filter((p) => p.scope === "spielart" && availableIn(p, mode)).map(buildPart),
    );
  }

  /* Gruppiert nach Spiele/Training/Party, jede mit "angepasst" oder "Standard". */
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

  function onListChange(event) {
    const input = event.target;
    const { part, option } = input.dataset;
    if (!part || !resolved) return;
    const content = structuredClone(resolved.content);
    if (!option) content[part].on = input.checked;
    else content[part][option] = input.type === "radio" ? input.value : input.checked;
    if (input.closest(".part")?.dataset.scope === "gemeinsam") handlers.onShared(content);
    else handlers.onModeContent(content);
  }
  sharedList.addEventListener("change", onListChange);
  modeList.addEventListener("change", onListChange);

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

    for (const input of root.querySelectorAll(".settings-list input")) {
      const value = resolved.content[input.dataset.part];
      if (!value) continue;
      const option = input.dataset.option;
      if (!option) input.checked = value.on;
      else if (input.type === "radio") input.checked = value[option] === input.value;
      else input.checked = value[option] === true;
    }
    for (const section of root.querySelectorAll(".settings-list .part")) {
      const on = resolved.content[section.dataset.part]?.on ?? true;
      section.classList.toggle("is-off", !on);
      for (const input of section.querySelectorAll(".part-options input")) input.disabled = !on;
    }

    formatSelect.value = profile.gemeinsam.format;
    modeSelect.value = mode;
    modeState.textContent = resolved.angepasst ? "angepasst" : "Standard";
    resetButton.hidden = !resolved.angepasst;
    for (const [index, b] of playerButtons.entries()) {
      b.setAttribute("aria-pressed", String(index + 1 === players));
    }
  }

  function setAsk(next) {
    ask = next;
    renderAsk();
  }

  function renderAsk() {
    askArea.hidden = ask === null;
    if (!ask) {
      askArea.replaceChildren();
      return;
    }
    if (ask.kind === "confirm") {
      const yes = ask.yes;
      askArea.replaceChildren(
        node("p", { textContent: ask.text }),
        node("div", { className: "settings-row" }, [
          button("Ja", () => {
            setAsk(null);
            yes();
          }),
          button("Abbrechen", () => setAsk(null)),
        ]),
      );
      return;
    }
    const { kind, id } = ask;
    const name = node("input", {
      type: "text",
      maxLength: 40,
      required: true,
      value: kind === "rename" ? profile.name : "",
      placeholder: "Name",
    });
    const form = node("form", {}, [
      node("label", {}, ["Name ", name]),
      node("div", { className: "settings-row" }, [
        node("button", { type: "submit", textContent: kind === "new" ? "Anlegen" : "Speichern" }),
        button("Abbrechen", () => setAsk(null)),
      ]),
    ]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      setAsk(null);
      if (kind === "new") handlers.onCreate(name.value);
      else handlers.onRename(id, name.value);
    });
    askArea.replaceChildren(form);
    name.focus();
  }

  return {
    render(next) {
      if (profile && next.profile.id !== profile.id) setAsk(null); // gehoerte zum alten Profil
      const freshCatalog = next.catalog !== catalog;
      const freshMode = next.mode !== mode;
      catalog = next.catalog;
      profile = next.profile;
      profiles = next.profiles;
      mode = next.mode;
      players = next.players;
      resolved = next.resolved;
      if (freshCatalog) {
        buildFormats();
        buildShared();
      }
      if (freshCatalog || freshMode) buildModeList();
      const key = JSON.stringify(Object.keys(profile.spielarten).sort());
      if (freshCatalog || key !== modesKey) {
        modesKey = key;
        buildModeSelect();
      }
      update();
    },
    /** Schliesst ein offenes Formular oder eine Rueckfrage; true, wenn eins offen war. */
    cancelAsk() {
      if (!ask) return false;
      setAsk(null);
      return true;
    },
    setStatus(text) {
      status.textContent = text;
    },
  };
}
