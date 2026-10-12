/*
 * Seitenleiste, Schritt "Inhalte": Profil, Vorlagen und die Liste der
 * Bausteine. Die Liste entsteht aus dem Katalog vom Pi - eine neue Option im
 * Katalog erscheint hier ohne Aenderung an dieser Datei.
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

export function createPanel(root, handlers) {
  let catalog = null;
  let profile = null;
  let profiles = [];
  let profilesKey = "";
  /* Offenes Formular oder offene Rueckfrage: { kind: "new" | "rename" | "confirm", ... }.
     Sie merkt sich das Profil, das sie nennt - wechselt inzwischen ein anderes
     Geraet das aktive Profil, darf "Ja" nicht das neue treffen. */
  let ask = null;
  const expanded = new Set(["scheibe"]);

  const select = node("select", { className: "settings-grow" });
  select.setAttribute("aria-label", "Aktives Profil");
  select.addEventListener("change", () => handlers.onSelect(select.value));

  const close = button("×", () => handlers.onClose(), { className: "settings-close", title: "Schließen" });
  close.setAttribute("aria-label", "Einstellungen schließen");

  const renameButton = button("Umbenennen", () => setAsk({ kind: "rename", id: profile.id }));
  const deleteButton = button("Löschen", () =>
    setAsk({ kind: "confirm", text: `Profil „${profile.name}“ löschen?`, yes: handlers.onDelete.bind(null, profile.id) }),
  );

  const askArea = node("div", { className: "settings-ask", hidden: true });
  const templates = node("div", { className: "settings-row" });
  const list = node("div", { className: "settings-list" });
  const status = node("p", { className: "settings-status" });
  status.setAttribute("role", "status");

  root.replaceChildren(
    node("div", { className: "settings-row" }, [node("h2", { textContent: "Profil" }), close]),
    node("div", { className: "settings-row" }, [select]),
    node("div", { className: "settings-row" }, [button("Neu", () => setAsk({ kind: "new" })), renameButton, deleteButton]),
    askArea,
    node("h2", { textContent: "Vorlage" }),
    templates,
    node("h2", { textContent: "Anpassen" }),
    list,
    status,
    button("Weiter: Layout →", () => handlers.onNext(), { className: "settings-next" }),
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
    const options = node(
      "div",
      { className: "part-options", hidden: !expanded.has(part.id) },
      part.options.map((option) => buildOption(part, option)),
    );
    if (part.options.length > 0) {
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
    return section;
  }

  function buildCatalog() {
    templates.replaceChildren(
      ...catalog.templates.map((template) =>
        button(template.label, () =>
          setAsk({
            kind: "confirm",
            text: `Inhalte von „${profile.name}“ auf „${template.label}“ zurücksetzen? Das Layout bleibt.`,
            yes: handlers.onTemplate.bind(null, profile.id, template.id),
          }),
        ),
      ),
    );
    list.replaceChildren(...catalog.parts.map(buildPart));
  }

  list.addEventListener("change", (event) => {
    const input = event.target;
    const { part, option } = input.dataset;
    if (!part || !profile) return;
    const content = structuredClone(profile.content);
    if (!option) content[part].on = input.checked;
    else content[part][option] = input.type === "radio" ? input.value : input.checked;
    handlers.onContent(content);
  });

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

    for (const input of list.querySelectorAll("input")) {
      const value = profile.content[input.dataset.part];
      if (!value) continue;
      const option = input.dataset.option;
      if (!option) input.checked = value.on;
      else if (input.type === "radio") input.checked = value[option] === input.value;
      else input.checked = value[option] === true;
    }
    for (const section of list.querySelectorAll(".part")) {
      const on = profile.content[section.dataset.part]?.on ?? true;
      section.classList.toggle("is-off", !on);
      for (const input of section.querySelectorAll(".part-options input")) input.disabled = !on;
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
    const fieldsList = [node("label", {}, ["Name ", name])];
    let template = null;
    if (kind === "new") {
      template = node(
        "select",
        {},
        catalog.templates.map((t) => node("option", { value: t.id, textContent: t.label })),
      );
      fieldsList.push(node("label", {}, ["Vorlage ", template]));
    }
    const form = node("form", {}, [
      ...fieldsList,
      node("div", { className: "settings-row" }, [
        node("button", { type: "submit", textContent: kind === "new" ? "Anlegen" : "Speichern" }),
        button("Abbrechen", () => setAsk(null)),
      ]),
    ]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      setAsk(null);
      if (kind === "new") handlers.onCreate(name.value, template.value);
      else handlers.onRename(id, name.value);
    });
    askArea.replaceChildren(form);
    name.focus();
  }

  return {
    render(nextCatalog, nextProfile, nextProfiles) {
      if (profile && nextProfile.id !== profile.id) setAsk(null); // gehoerte zum alten Profil
      const freshCatalog = nextCatalog !== catalog;
      catalog = nextCatalog;
      profile = nextProfile;
      profiles = nextProfiles;
      if (freshCatalog) buildCatalog();
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
