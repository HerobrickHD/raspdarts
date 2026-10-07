'use strict';

// Baut die Raspdarts-Seite im Shadow DOM und zeigt an, was view-model.js
// berechnet. Entscheidet nichts selbst: Aktionen meldet sie an content.js.
(function (root) {
  async function loadAsset(path) {
    const response = await fetch(chrome.runtime.getURL(path));
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.text();
  }

  async function create({ t, onAction, onActivityClosed }) {
    const [html, css] = await Promise.all([loadAsset('page.html'), loadAsset('page.css')]);

    const host = document.createElement('div');
    host.id = 'raspdarts-page';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${css}</style>${html}`;
    shadow.querySelectorAll('[data-text]').forEach((el) => { el.textContent = t[el.dataset.text]; });
    shadow.querySelectorAll('[data-asset]').forEach((el) => { el.src = chrome.runtime.getURL(el.dataset.asset); });

    const field = (name) => shadow.querySelector(`[data-field="${name}"]`);
    let monitorUrl = null;
    let resolveDialog = null;

    function render(view) {
      field('pill').dataset.tone = view.pill.tone;
      field('pillText').textContent = view.pill.text;
      for (const key of ['cpu', 'ram', 'temperature', 'uptime']) field(key).textContent = view.stats[key];
      field('hint').hidden = !view.showHint;
      field('cards').hidden = !view.showCards;

      const autodarts = view.autodarts;
      field('autodartsVersion').textContent = autodarts.version;
      field('autodartsStatus').textContent = autodarts.statusText;
      field('autodartsDot').dataset.tone = autodarts.statusTone;
      const mainButton = field('autodartsMain');
      mainButton.dataset.action = autodarts.mainAction;
      mainButton.textContent = autodarts.mainLabel;
      field('monitor').hidden = !autodarts.showMonitor;
      monitorUrl = autodarts.monitorUrl;

      field('raspdartsVersion').textContent = view.pi.raspdartsVersion;
      field('beamerStatus').textContent = view.pi.beamerText;
      field('beamerDot').dataset.tone = view.pi.beamerTone;

      shadow.querySelectorAll('[data-action]').forEach((button) => { button.disabled = view.disabled; });
      field('uninstallAutodarts').disabled = view.disabled || !autodarts.canUninstall;
    }

    function confirm(actionKey, danger) {
      answerDialog(false);
      const texts = t.dialogs[actionKey];
      field('dialogTitle').textContent = texts.title;
      field('dialogText').textContent = texts.text;
      const yes = field('dialogConfirm');
      yes.textContent = texts.yes;
      yes.className = danger ? 'danger' : 'primary';
      field('dialog').hidden = false;
      yes.focus();
      return new Promise((resolve) => { resolveDialog = resolve; });
    }

    function answerDialog(answer) {
      field('dialog').hidden = true;
      const resolve = resolveDialog;
      resolveDialog = null;
      resolve?.(answer);
    }

    function startActivity(title) {
      field('activity').hidden = false;
      field('activityTitle').textContent = title;
      field('activityRunning').hidden = false;
      const log = field('log');
      log.textContent = '';
      log.hidden = true;
      field('activityResult').hidden = true;
    }

    function appendLog(line) {
      const log = field('log');
      log.hidden = false;
      log.textContent += `${line}\n`;
      log.scrollTop = log.scrollHeight;
    }

    function finishActivity(success, message) {
      field('activityRunning').hidden = true;
      field('activityResult').hidden = false;
      const messageEl = field('activityMessage');
      messageEl.textContent = message;
      messageEl.dataset.tone = success ? 'ok' : 'error';
    }

    function closeActivity() {
      field('activity').hidden = true;
    }

    shadow.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      if (button.dataset.action) onAction(button.dataset.action);
      else if (button === field('monitor') && monitorUrl) window.open(monitorUrl, '_blank', 'noopener');
      else if (button === field('activityClose')) { closeActivity(); onActivityClosed(); }
      else if (button === field('dialogCancel')) answerDialog(false);
      else if (button === field('dialogConfirm')) answerDialog(true);
    });
    // Klick neben den Dialog oder Escape bricht ab.
    field('dialog').addEventListener('click', (event) => {
      if (event.target === field('dialog')) answerDialog(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && resolveDialog) answerDialog(false);
    });

    return {
      host,
      render,
      confirm,
      closeDialog: () => answerDialog(false),
      startActivity,
      appendLog,
      finishActivity,
      closeActivity,
    };
  }

  root.raspdartsPage = { create };
})(globalThis);
