'use strict';

// Haengt den Eintrag "Raspdarts" in Autodarts' Hauptnavigation und zeigt bei
// Klick die Raspdarts-Seite im Inhaltsbereich. Siehe
// docs/superpowers/specs/2026-10-07-raspdarts-seite-design.md.

const { ACTIONS, buildView } = globalThis.raspdartsViewModel;
const { detectLanguage, getTexts } = globalThis.raspdartsTexts;

const STATUS_INTERVAL_MS = 10_000;
const BACKGROUND_INTERVAL_MS = 30_000;
const POWER_CLOSE_MS = 3_000;
const PAGE_ATTR = 'data-raspdarts-page';
// Klassen der Autodarts-Hauptnavigation, damit der Eintrag wie Start, Spielen usw. aussieht.
const AUTODARTS_NAV_ITEM_CLASSES = 'font-bold flex items-center relative hover:text-mono-white text-black-20';

// Solange unsere Seite offen ist: Autodarts' Inhalt ausblenden, den aktiven
// Autodarts-Eintrag grau und unseren weiss zeigen. Autodarts' Elemente
// behalten dabei ihre Klassen.
const DOCUMENT_STYLE = `
  html:not([${PAGE_ATTR}]) #raspdarts-page { display: none !important; }
  html[${PAGE_ATTR}] main > :not(#raspdarts-page) { display: none !important; }
  html[${PAGE_ATTR}] header nav > a[aria-current="page"] { color: var(--color-black-20, #cacfd9) !important; }
  html[${PAGE_ATTR}] #raspdarts-nav-btn { color: var(--color-mono-white, #fff) !important; }
`;

let status = null;      // letzte erfolgreiche Antwort von /api/status
let reachable = null;   // null = noch keine Antwort
let busy = false;       // eine Aktion laeuft
let texts = null;
let pagePromise = null;
let page = null;
let pageVisible = false;
let pollTimer = null;
let lastHref = location.href;
let underline = null;   // { bar, savedLeft, savedWidth, ourLeft }

function sendToBackground(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function findMainNav() {
  return document.querySelector('nav[aria-label="Hauptnavigation"]')
    || document.querySelector('header nav');
}

// Der Unterstrich-Balken ist das einzige div in der Navigation.
function underlineBar(nav) {
  return [...nav.children].find((el) => el.tagName === 'DIV');
}

// --- Navigationseintrag -------------------------------------------------------

// Punkt hinter dem Text: gruen = Spieldaten-Verbindung zum Pi steht, grau = nicht.
function updateNavDot() {
  const dot = document.getElementById('raspdarts-beamer-dot');
  if (!dot) return;
  const connected = reachable === true && Boolean(status?.beamer?.ingest_connected);
  dot.style.background = connected ? 'var(--color-green-50, #12cf81)' : 'rgba(255,255,255,0.25)';
}

function tryInjectNavButton() {
  if (document.getElementById('raspdarts-nav-btn')) return;
  const nav = findMainNav();
  if (!nav) return;

  const btn = document.createElement('button');
  btn.id = 'raspdarts-nav-btn';
  btn.type = 'button';
  btn.className = AUTODARTS_NAV_ITEM_CLASSES;
  btn.style.gap = '6px';
  btn.append('Raspdarts');

  const dot = document.createElement('span');
  dot.id = 'raspdarts-beamer-dot';
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex-shrink:0;';
  btn.appendChild(dot);
  btn.addEventListener('click', showPage);

  // Vor dem Unterstrich-Balken einfuegen, der als letztes Kind in der Navigation steckt.
  const lastItem = [...nav.children].filter((el) => el.matches('a, button')).pop();
  if (lastItem) lastItem.after(btn);
  else nav.appendChild(btn);
  updateNavDot();
}

// --- Status -------------------------------------------------------------------

async function fetchStatus() {
  const result = await sendToBackground({ type: 'fetch', url: '/api/status' });
  if (result?.ok) {
    status = result.data;
    reachable = true;
  } else {
    reachable = false;
  }
  updateNavDot();
  renderPage();
}

function renderPage() {
  if (page) page.render(buildView({ status, reachable, busy }, texts));
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => { if (!busy) fetchStatus(); }, STATUS_INTERVAL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

// --- Seite zeigen und verstecken ----------------------------------------------

function ensureDocumentStyle() {
  if (document.getElementById('raspdarts-document-style')) return;
  const style = document.createElement('style');
  style.id = 'raspdarts-document-style';
  style.textContent = DOCUMENT_STYLE;
  document.head.appendChild(style);
}

function getPage() {
  if (!pagePromise) {
    texts = getTexts(detectLanguage(findMainNav()?.getAttribute('aria-label')));
    pagePromise = globalThis.raspdartsPage
      .create({ t: texts, onAction: runAction, onActivityClosed: fetchStatus })
      .then((created) => { page = created; return created; })
      .catch((error) => { pagePromise = null; throw error; });
  }
  return pagePromise;
}

async function showPage() {
  if (pageVisible) return;
  const created = await getPage();
  const main = document.querySelector('main');
  if (pageVisible || !main) return;

  ensureDocumentStyle();
  // Autodarts baut <main> bei Seitenwechseln neu auf; dann wieder einhaengen.
  if (created.host.parentElement !== main) main.appendChild(created.host);
  document.documentElement.setAttribute(PAGE_ATTR, '');
  pageVisible = true;
  lastHref = location.href;
  moveUnderline();
  renderPage();
  fetchStatus();
  startPolling();
}

// Die Seite wird nur versteckt: Eine laufende Aktion samt Protokoll laeuft weiter.
function hidePage() {
  if (!pageVisible) return;
  pageVisible = false;
  document.documentElement.removeAttribute(PAGE_ATTR);
  page?.closeDialog();
  restoreUnderline();
  stopPolling();
}

function moveUnderline() {
  const nav = findMainNav();
  const btn = document.getElementById('raspdarts-nav-btn');
  const bar = nav && underlineBar(nav);
  if (!bar || !btn) return;
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const savedLeft = bar.style.left;
  const savedWidth = bar.style.width;
  bar.style.left = `${btnRect.left - navRect.left}px`;
  bar.style.width = `${btnRect.width}px`;
  // So merken, wie der Browser den Wert zurueckgibt (er rundet beim Lesen).
  underline = { bar, savedLeft, savedWidth, ourLeft: bar.style.left };
}

// Nur zuruecksetzen, wenn Autodarts den Balken inzwischen nicht selbst
// verschoben hat (das tut es bei einem echten Seitenwechsel).
function restoreUnderline() {
  if (!underline) return;
  const { bar, savedLeft, savedWidth, ourLeft } = underline;
  if (bar.style.left === ourLeft) {
    bar.style.left = savedLeft;
    bar.style.width = savedWidth;
  }
  underline = null;
}

function onDomChange() {
  tryInjectNavButton();
  if (location.href !== lastHref) {
    lastHref = location.href;
    hidePage();
  }
}

// --- Aktionen -----------------------------------------------------------------

async function runAction(key) {
  const action = ACTIONS[key];
  if (busy || !action || !page) return;
  const confirmed = await page.confirm(key, action.danger);
  if (!confirmed || busy) return;

  busy = true;
  renderPage();
  page.startActivity(texts.dialogs[key].title);
  if (action.kind === 'stream') runStream(action);
  else runPower(action);
}

function finishAction(success, message) {
  busy = false;
  page.finishActivity(success, message);
  renderPage();
}

function errorText(error) {
  return texts.errorPrefix + (error || texts.requestFailed);
}

function runStream(action) {
  globalThis.raspdartsStream.runStream({
    connect: () => chrome.runtime.connect({ name: 'raspdarts-stream' }),
    url: action.url,
    onLog: (line) => page.appendLog(line),
    onEnd: (result) => {
      if (result.kind === 'conflict') finishAction(false, texts.alreadyRunning);
      else if (result.kind === 'disconnected') finishAction(false, texts.disconnected);
      else finishAction(result.success, result.success ? texts.success : errorText(result.error));
    },
  });
}

async function runPower(action) {
  const result = await sendToBackground({ type: 'fetch', url: action.url, method: 'POST' });
  if (result?.ok) {
    finishAction(true, texts[action.doneText]);
    // Nicht schliessen, falls inzwischen schon die naechste Aktion laeuft.
    setTimeout(() => { if (!busy) page.closeActivity(); fetchStatus(); }, POWER_CLOSE_MS);
  } else if (result?.status === 409) {
    finishAction(false, texts.alreadyRunning);
  } else {
    finishAction(false, errorText(result?.data?.error || result?.error));
  }
}

// --- Start --------------------------------------------------------------------

tryInjectNavButton();
// Weiter beobachten: Autodarts baut die Kopfleiste beim Seitenwechsel teils neu
// auf, und ein Adresswechsel heisst, dass jemand unsere Seite verlassen hat.
new MutationObserver(onDomChange).observe(document.body, { childList: true, subtree: true });
window.addEventListener('popstate', hidePage);
// Klick auf einen Link der Kopfleiste verlaesst die Seite, auch ohne
// Adresswechsel (z. B. "Start", wenn man schon auf / ist).
document.addEventListener('click', (event) => {
  if (pageVisible && event.target.closest?.('header a')) hidePage();
}, true);

fetchStatus();
setInterval(() => { if (!pageVisible) fetchStatus(); }, BACKGROUND_INTERVAL_MS);
