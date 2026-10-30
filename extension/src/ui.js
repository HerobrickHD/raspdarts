'use strict';

// Gemeinsamer Unterbau der Extension: Texte, Nachrichten an den
// Background-Teil, Speicher, Zustand eines Knopfs und das Fenster ueber der
// Seite. Genutzt von viewer.js.
(function (root) {
  const { detectLanguage, getTexts } = root.raspdartsTexts;

  // Symbole aus Lucide (https://lucide.dev), ISC-Lizenz, Copyright (c) Lucide Contributors.
  const svg = (body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICONS = {
    monitor: svg('<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/>'
      + '<line x1="12" x2="12" y1="17" y2="21"/>'),
    monitorOff: svg('<path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.5 1-2 1-2"/><path d="M22 15V5a2 2 0 0 0-2-2H9"/>'
      + '<path d="M8 21h8"/><path d="M12 17v4"/><path d="m2 2 20 20"/>'),
  };

  // Farben ueber Autodarts' CSS-Variablen (sie wirken auch im Shadow DOM).
  const FRAME_STYLE = `
    .backdrop { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center;
      justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(0, 0, 0, 0.7); }
    .window { max-height: 100%; overflow: auto; box-sizing: border-box; padding: 20px;
      border-radius: 12px; background: var(--color-black-85, #1d1f24); color: var(--color-mono-white, #fff);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .head h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .close { width: 32px; height: 32px; flex-shrink: 0; border: 0; border-radius: 10px; cursor: pointer; font-size: 16px;
      background: var(--color-blue-60, #2563eb); color: var(--color-blue-05, #fff); }
    .close:hover { opacity: 0.9; }
    [hidden] { display: none !important; }
  `;

  let cachedTexts = null;

  function texts() {
    if (!cachedTexts) {
      cachedTexts = getTexts(detectLanguage(document.querySelector('header nav')?.getAttribute('aria-label')));
    }
    return cachedTexts;
  }

  // Nach einem Update der Extension ist der alte Kontext ungueltig und
  // sendMessage wirft; das gilt dann als "Pi nicht erreichbar".
  function sendToBackground(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (response) => resolve(response ?? { ok: false, status: 0, error: 'Unreachable' }));
      } catch {
        resolve({ ok: false, status: 0, error: 'Unreachable' });
      }
    });
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(key, (items) => resolve(items?.[key]));
      } catch {
        resolve(undefined);
      }
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  // Schreibt nur, was sich aendert: jede Aenderung am DOM weckt die
  // MutationObserver, die wiederum diese Funktion aufrufen.
  // mutedBackground: false fuer runde Leistenknoepfe ohne eigenen Hintergrund.
  function setButton(wrap, { icon, iconName, title, disabled = false, muted = false, mutedBackground = true }) {
    const btn = wrap.firstElementChild;
    if (btn.dataset.icon !== iconName) {
      btn.innerHTML = icon;
      btn.dataset.icon = iconName;
    }
    if (btn.disabled !== disabled) btn.disabled = disabled;
    if (wrap.title !== title) {
      wrap.title = title;
      btn.setAttribute('aria-label', title);
    }
    if (btn.dataset.muted !== String(muted)) {
      btn.dataset.muted = String(muted);
      // Farben wie Autodarts' deaktivierte Knoepfe, aber klickbar.
      btn.style.background = muted && mutedBackground ? 'var(--color-black-70, #2b2f36)' : '';
      btn.style.color = muted ? 'var(--color-black-30, #8b93a1)' : '';
    }
  }

  // canEscape: false, solange im Fenster etwas Eigenes Esc braucht (Rueckfrage).
  function openOverlay({ title, width = '1400px', css = '', html = '', closeLabel, onClose, canEscape = () => true }) {
    const host = document.createElement('div');
    host.dataset.raspdartsOverlay = '1';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${FRAME_STYLE}${css}</style>
      <div class="backdrop">
        <div class="window" role="dialog" aria-modal="true">
          <div class="head"><h2></h2><button type="button" class="close">✕</button></div>
          <div class="body">${html}</div>
        </div>
      </div>`;
    shadow.querySelector('.window').style.width = `min(${width}, 100%)`;
    shadow.querySelector('h2').textContent = title;
    const closeButton = shadow.querySelector('.close');
    closeButton.title = closeLabel;
    closeButton.setAttribute('aria-label', closeLabel);

    let open = true;
    function onKey(event) {
      if (event.key !== 'Escape' || !canEscape()) return;
      event.stopPropagation();
      close();
    }
    function close() {
      if (!open) return;
      open = false;
      host.remove();
      document.removeEventListener('keydown', onKey, true);
      onClose?.();
    }
    closeButton.addEventListener('click', close);
    shadow.querySelector('.backdrop').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) close();
    });
    document.body.append(host);
    document.addEventListener('keydown', onKey, true);
    return { shadow, body: shadow.querySelector('.body'), close };
  }

  root.raspdartsUi = { ICONS, openOverlay, sendToBackground, setButton, storageGet, storageSet, texts };
})(globalThis);
