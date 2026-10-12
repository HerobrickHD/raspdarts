'use strict';

// Kamera-Knopf auf der Karte des Raspdarts-Boards (play.autodarts.com/boards)
// und das Fenster mit den Kamerabildern. Die Logik steckt in cams-view.js,
// die Bremse fuer Autodarts im Pi (server/src/system/cams.ts).
// Siehe docs/superpowers/specs/2026-10-12-kameras-design.md.
(function () {
  const { ROUND_PAUSE_MS, buttonState, emptyTiles, isBoardsPage, windowView } = globalThis.raspdartsCamsView;
  const { detectLanguage, getTexts } = globalThis.raspdartsTexts;

  const BUTTON_ID = 'raspdarts-cams-btn';
  const HOST_ID = 'raspdarts-cams';
  const CAMERA_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>'
    + '<circle cx="12" cy="13" r="3"/></svg>';

  // Farben ueber Autodarts' CSS-Variablen (sie wirken auch im Shadow DOM).
  const STYLE = `
    .backdrop { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center;
      justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(0, 0, 0, 0.7); }
    .window { width: min(1400px, 100%); max-height: 100%; overflow: auto; box-sizing: border-box; padding: 20px;
      border-radius: 12px; background: var(--color-black-85, #1d1f24); color: var(--color-mono-white, #fff);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .close { width: 32px; height: 32px; border: 0; border-radius: 10px; cursor: pointer; font-size: 16px;
      background: var(--color-blue-60, #2563eb); color: var(--color-blue-05, #fff); }
    .close:hover { opacity: 0.9; }
    .message { margin: 24px 0; text-align: center; font-size: 16px; color: var(--color-black-20, #cacfd9); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
    .tile { margin: 0; }
    .frame { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background: #000; }
    img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .stale img { opacity: 0.35; }
    .note { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 700;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9); }
    .label { margin-top: 6px; font-size: 13px; color: var(--color-black-20, #cacfd9); }
    [hidden] { display: none !important; }
  `;

  let texts = null;
  let info = null;           // { board_id, cams } vom Pi
  let infoRequested = false; // je Besuch von /boards einmal
  let session = null;        // { open, tiles, message } solange das Fenster offen ist
  let host = null;

  function t() {
    if (!texts) texts = getTexts(detectLanguage(document.querySelector('header nav')?.getAttribute('aria-label')));
    return texts;
  }

  function sendToBackground(msg) {
    return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
  }

  async function loadInfo() {
    const result = await sendToBackground({ type: 'fetch', url: '/api/cams' });
    const data = result?.ok ? result.data : null;
    if (typeof data?.board_id === 'string' && Number.isInteger(data.cams)) {
      info = { board_id: data.board_id, cams: data.cams };
    }
  }

  // --- Knopf auf der Karte ------------------------------------------------------

  // Aufbau der Karte (Stand 12.10.2026):
  //   Karte > Kopfzeile (Name, Einstellungen, Zustands-Abzeichen) … Knopfzeile
  //   Knopfzeile > linke Gruppe (Starten/Stoppen, Kalibrieren, Board Manager)
  //              | rechte Gruppe (ID kopieren, "Board folgen"-Link, …)
  function locateCard(boardId) {
    const follow = document.querySelector(`a[href="/boards/${CSS.escape(boardId)}/follow"]`);
    const row = follow?.parentElement?.parentElement;
    const card = row?.parentElement;
    const leftGroup = row?.firstElementChild;
    const head = card?.firstElementChild;
    if (!card || !leftGroup || !head || leftGroup === follow.parentElement) return null;
    return {
      leftGroup,
      badge: head.querySelector('.rounded-full'),
      name: head.querySelector('span')?.textContent.trim() || 'Board',
    };
  }

  // Der Knopf steckt in einem <span>, das den Hinweis traegt: Autodarts'
  // Klassen schalten bei deaktivierten Knoepfen die Maus ab, dann zeigte der
  // Knopf selbst keinen Hinweis.
  function ensureButton(parts) {
    let wrap = document.getElementById(BUTTON_ID);
    if (wrap && parts.leftGroup.contains(wrap)) return wrap;
    wrap?.remove();

    // Kalibrieren ist der zweite Knopf der Gruppe; erkannt an der Position, nicht am Text.
    const calibrate = parts.leftGroup.children[1];
    wrap = document.createElement('span');
    wrap.id = BUTTON_ID;
    wrap.style.display = 'inline-flex';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = (calibrate ?? parts.leftGroup.lastElementChild)?.className ?? '';
    btn.innerHTML = CAMERA_ICON;
    btn.addEventListener('click', openWindow);
    wrap.append(btn);
    if (calibrate) calibrate.after(wrap);
    else parts.leftGroup.append(wrap);
    return wrap;
  }

  function updateButton(wrap, badgeText) {
    const state = buttonState(badgeText, t());
    const btn = wrap.firstElementChild;
    if (btn.disabled !== !state.enabled) btn.disabled = !state.enabled;
    if (wrap.title !== state.title) {
      wrap.title = state.title;
      btn.setAttribute('aria-label', state.title);
    }
  }

  function refreshButton() {
    if (!info || !isBoardsPage(location.pathname)) return;
    const parts = locateCard(info.board_id);
    if (!parts) return;
    updateButton(ensureButton(parts), parts.badge?.textContent);
  }

  // --- Fenster -------------------------------------------------------------------

  function buildWindow(name) {
    const el = document.createElement('div');
    el.id = HOST_ID;
    const shadow = el.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${STYLE}</style>
      <div class="backdrop">
        <div class="window" role="dialog" aria-modal="true">
          <div class="head"><h2></h2><button type="button" class="close">✕</button></div>
          <p class="message" hidden></p>
          <div class="grid"></div>
        </div>
      </div>`;
    shadow.querySelector('h2').textContent = `${t().camsTitle} – ${name}`;
    const close = shadow.querySelector('.close');
    close.title = t().close;
    close.setAttribute('aria-label', t().close);
    close.addEventListener('click', closeWindow);
    shadow.querySelector('.backdrop').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeWindow();
    });
    return el;
  }

  function tileElement() {
    const figure = document.createElement('figure');
    figure.className = 'tile';
    figure.innerHTML = '<div class="frame"><img alt=""><span class="note" hidden></span></div>'
      + '<figcaption class="label"></figcaption>';
    return figure;
  }

  function render() {
    if (!host || !session) return;
    const shadow = host.shadowRoot;
    const message = session.message ?? (session.tiles.length === 0 ? t().camsNoImage : null);
    const paragraph = shadow.querySelector('.message');
    paragraph.hidden = !message;
    paragraph.textContent = message ?? '';

    const grid = shadow.querySelector('.grid');
    grid.hidden = Boolean(session.message);
    // Kacheln nur bei geaenderter Anzahl neu anlegen, sonst flackert es.
    while (grid.children.length > session.tiles.length) grid.lastElementChild.remove();
    while (grid.children.length < session.tiles.length) grid.append(tileElement());
    session.tiles.forEach((tile, i) => {
      const el = grid.children[i];
      el.querySelector('.label').textContent = tile.label;
      el.classList.toggle('stale', tile.stale);
      const img = el.querySelector('img');
      img.hidden = !tile.src;
      if (tile.src && img.getAttribute('src') !== tile.src) img.src = tile.src;
      const note = el.querySelector('.note');
      note.hidden = !tile.note;
      note.textContent = tile.note ?? '';
    });
  }

  function onKey(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    closeWindow();
  }

  function openWindow() {
    if (session || !info) return;
    const current = { open: true, tiles: emptyTiles(info.cams, t()), message: null };
    session = current;
    host = buildWindow(locateCard(info.board_id)?.name ?? 'Board');
    document.body.append(host);
    document.addEventListener('keydown', onKey, true);
    render();
    // Kameraanzahl auffrischen (Kamera ab- oder angesteckt), dann Runden starten.
    loadInfo().finally(() => {
      if (!current.open) return;
      if (info.cams !== current.tiles.length) current.tiles = emptyTiles(info.cams, t());
      render();
      runRounds(current);
    });
  }

  function closeWindow() {
    if (!session) return;
    session.open = false;
    session = null;
    host?.remove();
    host = null;
    document.removeEventListener('keydown', onKey, true);
  }

  // Eine Runde holt alle Kameras nacheinander; die naechste beginnt erst eine
  // Sekunde nach dem Ende der vorigen. So stauen sich bei langsamem WLAN keine
  // Anfragen. Im versteckten Tab wird nichts geholt.
  async function runRounds(current) {
    while (current.open) {
      if (!document.hidden) {
        const results = [];
        for (let cam = 0; cam < current.tiles.length; cam += 1) {
          const result = await sendToBackground({ type: 'image', cam });
          if (!current.open) return;
          results.push(result);
          if (result?.status === 409) break; // Board steht: die anderen gar nicht erst fragen
        }
        const view = windowView(results, current.tiles, t());
        current.tiles = view.tiles;
        current.message = view.message;
        render();
      }
      await new Promise((resolve) => setTimeout(resolve, ROUND_PAUSE_MS));
    }
  }

  // --- Seitenwechsel -------------------------------------------------------------

  function onDomChange() {
    if (!isBoardsPage(location.pathname)) {
      infoRequested = false;
      closeWindow();
      return;
    }
    if (!infoRequested) {
      infoRequested = true;
      loadInfo().then(refreshButton);
      return;
    }
    refreshButton();
  }

  onDomChange();
  // Autodarts wechselt Seiten ohne Neuladen und baut Karten neu auf; das
  // Abzeichen aendert dabei seinen Text.
  new MutationObserver(onDomChange).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
