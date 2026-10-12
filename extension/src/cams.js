'use strict';

// Kamera-Knopf auf der Karte des Raspdarts-Boards (play.autodarts.com/boards)
// und das Fenster mit den Kamerabildern. Logik in cams-view.js, Karte und
// Fenster in board-card.js, die Bremse fuer Autodarts im Pi
// (server/src/system/cams.ts). Siehe docs/superpowers/specs/2026-10-12-kameras-design.md.
(function () {
  const { ROUND_PAUSE_MS, buttonState, emptyTiles, windowView } = globalThis.raspdartsCamsView;
  const card = globalThis.raspdartsBoardCard;

  const BUTTON_ID = 'raspdarts-cams-btn';
  const STYLE = `
    .message { margin: 24px 0; text-align: center; font-size: 16px; color: var(--color-black-20, #cacfd9); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
    .tile { margin: 0; }
    .frame { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background: #000; }
    img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .stale img { opacity: 0.35; }
    .note { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 700;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9); }
    .label { margin-top: 6px; font-size: 13px; color: var(--color-black-20, #cacfd9); }
  `;

  let board = null;   // { boardId, cams } aus board-card.js
  let session = null; // { open, tiles, message, overlay } solange das Fenster offen ist

  function refreshButton() {
    if (!board) return;
    const parts = card.locateCard(board.boardId);
    if (!parts) return;
    // Hinter Kalibrieren, dem zweiten Autodarts-Knopf der Gruppe.
    const wrap = card.ensureButton(parts, { id: BUTTON_ID, after: parts.autodartsButtons[1], onClick: openWindow });
    const state = buttonState(parts.badge?.textContent, card.texts());
    card.setButton(wrap, { icon: card.ICONS.camera, iconName: 'camera', title: state.title, disabled: !state.enabled });
  }

  function tileElement() {
    const figure = document.createElement('figure');
    figure.className = 'tile';
    figure.innerHTML = '<div class="frame"><img alt=""><span class="note" hidden></span></div>'
      + '<figcaption class="label"></figcaption>';
    return figure;
  }

  function render(current) {
    const shadow = current.overlay.shadow;
    const message = current.message ?? (current.tiles.length === 0 ? card.texts().camsNoImage : null);
    const paragraph = shadow.querySelector('.message');
    paragraph.hidden = !message;
    paragraph.textContent = message ?? '';

    const grid = shadow.querySelector('.grid');
    grid.hidden = Boolean(current.message);
    // Kacheln nur bei geaenderter Anzahl neu anlegen, sonst flackert es.
    while (grid.children.length > current.tiles.length) grid.lastElementChild.remove();
    while (grid.children.length < current.tiles.length) grid.append(tileElement());
    current.tiles.forEach((tile, i) => {
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

  function openWindow() {
    if (session || !board) return;
    const t = card.texts();
    const name = card.locateCard(board.boardId)?.name ?? 'Board';
    const current = { open: true, tiles: emptyTiles(board.cams ?? 0, t), message: null, overlay: null };
    session = current;
    current.overlay = card.openOverlay({
      title: `${t.camsTitle} – ${name}`,
      css: STYLE,
      html: '<p class="message" hidden></p><div class="grid"></div>',
      closeLabel: t.close,
      onClose: () => {
        current.open = false;
        if (session === current) session = null;
      },
    });
    render(current);
    // Kameraanzahl auffrischen (Kamera ab- oder angesteckt), dann Runden starten.
    card.loadBoard().then((fresh) => {
      if (!current.open) return;
      if (fresh) board = fresh;
      const count = board.cams ?? 0;
      if (count !== current.tiles.length) current.tiles = emptyTiles(count, t);
      render(current);
      runRounds(current);
    });
  }

  // Eine Runde holt alle Kameras nacheinander; die naechste beginnt erst eine
  // Sekunde nach dem Ende der vorigen. So stauen sich bei langsamem WLAN keine
  // Anfragen. Im versteckten Tab wird nichts geholt.
  async function runRounds(current) {
    while (current.open) {
      if (!document.hidden) {
        const results = [];
        for (let cam = 0; cam < current.tiles.length; cam += 1) {
          const result = await card.sendToBackground({ type: 'image', cam });
          if (!current.open) return;
          results.push(result);
          if (result?.status === 409) break; // Board steht: die anderen gar nicht erst fragen
        }
        const view = windowView(results, current.tiles, card.texts());
        current.tiles = view.tiles;
        current.message = view.message;
        render(current);
      }
      await new Promise((resolve) => setTimeout(resolve, ROUND_PAUSE_MS));
    }
  }

  card.watchBoardsPage({
    onEnter: () => card.boardForVisit().then((found) => { board = found; refreshButton(); }),
    onChange: refreshButton,
    onLeave: () => {
      board = null;
      session?.overlay.close();
    },
  });
})();
