'use strict';

let modalRoot = null;
let pollInterval = null;
let streamActive = false;
let activePort = null; // reference to open stream port for cancellation
let piReachable = true;
let consecutiveFailures = 0;
let bgPollInterval = null;
let autodartsInstalled = true;
let piIP = null;

// Helpers 

function sendToBackground(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function updateButtonReachability(reachable) {
  piReachable = reachable;
  const btn = document.getElementById('raspdarts-nav-btn');
  if (!btn) return;
  if (reachable) {
    btn.style.background = '#22c55e';
    btn.style.cursor = 'pointer';
    btn.title = '';
  } else {
    btn.style.background = '#6b7280';
    btn.style.cursor = 'not-allowed';
    btn.title = 'Raspberry Pi unreachable';
  }
}

// Nav button injection

function injectNavButton() {
  const tryInject = () => {
    const nav = document.querySelector('nav') || document.querySelector('[class*="nav"]') || document.querySelector('header');
    if (!nav) return;
    if (document.getElementById('raspdarts-nav-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'raspdarts-nav-btn';
    btn.style.cssText = `
      margin-left: 8px; padding: 6px 12px; background: #22c55e;
      color: #fff; border: none; border-radius: 6px; cursor: pointer;
      font-size: 13px; font-weight: 500; font-family: inherit;
      display: inline-flex; align-items: center; gap: 6px; align-self: center;
      max-width: 100%; overflow: hidden; flex-shrink: 0;
    `;

    const iconImg = document.createElement('img');
    iconImg.src = chrome.runtime.getURL('icons/button.png');
    iconImg.width = 16;
    iconImg.height = 16;
    iconImg.style.flexShrink = '0';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'raspdarts-btn-label';
    labelSpan.textContent = 'Raspdarts';

    btn.appendChild(iconImg);
    btn.appendChild(labelSpan);
    btn.addEventListener('click', openModal);
    nav.appendChild(btn);

    // Collapsed sidebar detection: observe nav directly
    const updateCollapsed = () => {
      const collapsed = nav.getBoundingClientRect().width < 120;
      labelSpan.style.display = collapsed ? 'none' : '';
      btn.style.padding = collapsed ? '6px' : '6px 12px';
    };
    const resizeObserver = new ResizeObserver(updateCollapsed);
    resizeObserver.observe(nav);
    updateCollapsed();
  };

  tryInject();
  const observer = new MutationObserver(() => {
    tryInject();
    if (document.getElementById('raspdarts-nav-btn')) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial connectivity check + background polling (only when modal is closed)
  fetchStatus();
  bgPollInterval = setInterval(() => {
    if (!modalRoot) fetchStatus();
  }, 30_000);
}

// Modal open / close

async function openModal() {
  if (modalRoot) return;
  if (!piReachable) return;

  // CSS laden (einmalig)
  if (!document.getElementById('raspdarts-styles')) {
    const link = document.createElement('link');
    link.id = 'raspdarts-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('modal.css');
    document.head.appendChild(link);
  }

  // Fetch and inject modal HTML
  const html = await fetch(chrome.runtime.getURL('modal.html')).then(r => r.text());
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  modalRoot = wrapper;

  // Extension-Ressourcen-URLs setzen (relative Pfade funktionieren nach Injektion nicht)
  const logoImg = wrapper.querySelector('#raspdarts-title img');
  if (logoImg) logoImg.src = chrome.runtime.getURL('icons/button.png');

  // Event-Handler binden
  document.getElementById('raspdarts-close').addEventListener('click', closeModal);
  document.getElementById('raspdarts-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'raspdarts-overlay') closeModal();
  });
  document.getElementById('btn-autodarts-update').addEventListener('click', () => {
    openDialog({
      title: autodartsInstalled ? 'Update Autodarts' : 'Install Autodarts',
      confirmText: autodartsInstalled
        ? 'Really update Autodarts on the Raspberry Pi?'
        : 'Really install Autodarts on the Raspberry Pi?',
      confirmBtnClass: 'raspdarts-btn-primary',
      action: { type: 'stream', url: '/autodarts/update' },
    });
  });
  document.getElementById('btn-autodarts-monitor').addEventListener('click', () => {
    if (piIP) window.open(`http://${piIP}:3180/monitor`, '_blank');
  });
  document.getElementById('btn-autodarts-uninstall').addEventListener('click', () => {
    openDialog({
      title: 'Uninstall Autodarts',
      confirmText: 'Really uninstall Autodarts from the Raspberry Pi?',
      confirmBtnClass: 'raspdarts-btn-danger',
      action: { type: 'stream', url: '/autodarts/uninstall' },
    });
  });
  document.getElementById('btn-system-update').addEventListener('click', () => {
    openDialog({
      title: 'Update Raspdarts',
      confirmText: 'Really update Raspdarts on the Raspberry Pi?',
      confirmBtnClass: 'raspdarts-btn-primary',
      action: { type: 'stream', url: '/system/update' },
    });
  });
  document.getElementById('btn-system-uninstall').addEventListener('click', () => {
    openDialog({
      title: 'Uninstall Raspdarts',
      confirmText: 'Really uninstall Raspdarts from the Raspberry Pi?',
      confirmBtnClass: 'raspdarts-btn-danger',
      action: { type: 'stream', url: '/system/uninstall' },
    });
  });
  document.getElementById('btn-reboot').addEventListener('click', () => {
    openDialog({
      title: 'Restart',
      confirmText: 'Really restart the Raspberry Pi?',
      confirmBtnClass: 'raspdarts-btn-warning',
      action: { type: 'fetch', url: '/reboot', doneText: 'Restarting Pi\u2026', autoClose: 3000 },
    });
  });
  document.getElementById('btn-shutdown').addEventListener('click', () => {
    openDialog({
      title: 'Shut Down',
      confirmText: 'Really shut down the Raspberry Pi?',
      confirmBtnClass: 'raspdarts-btn-danger',
      action: { type: 'fetch', url: '/shutdown', doneText: 'Shutting down Pi\u2026', autoClose: 3000 },
    });
  });

  // Initial status fetch + start polling
  await fetchStatus();
  pollInterval = setInterval(() => {
    if (!streamActive) fetchStatus();
  }, 10_000);
}

function closeModal() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  // Stream-cancel senden wenn ein Stream läuft
  if (activePort) {
    try { activePort.postMessage({ type: 'stream-cancel' }); } catch {}
    activePort = null;
  }
  document.getElementById('raspdarts-dialog-overlay')?.remove();
  if (modalRoot) { modalRoot.remove(); modalRoot = null; }
  streamActive = false;
}

// Status polling

async function fetchStatus() {
  const result = await sendToBackground({ type: 'fetch', url: '/status' });

  if (!result || !result.ok) {
    consecutiveFailures++;
    updateButtonReachability(false);
    if (modalRoot) {
      document.getElementById('raspdarts-error')?.classList.remove('raspdarts-hidden');
      document.getElementById('raspdarts-content')?.classList.add('raspdarts-hidden');
      if (consecutiveFailures >= 2) {
        setTimeout(() => closeModal(), 2000);
      }
    }
    return;
  }

  consecutiveFailures = 0;
  updateButtonReachability(true);

  document.getElementById('raspdarts-error')?.classList.add('raspdarts-hidden');
  document.getElementById('raspdarts-content')?.classList.remove('raspdarts-hidden');

  const d = result.data;
  const setValue = (id, val) => {
    const el = document.querySelector(`#${id} .raspdarts-card-value`);
    if (el) { el.textContent = val; el.classList.remove('raspdarts-skeleton'); }
  };
  setValue('card-cpu',    `${d.cpu_percent}%`);
  setValue('card-ram',    `${Math.round(d.ram_used_mb / 1024 * 10) / 10} / ${Math.round(d.ram_total_mb / 1024 * 10) / 10} GB`);
  setValue('card-temp',   `${d.temp_celsius}°C`);
  setValue('card-uptime', formatUptime(d.uptime_seconds));
  const versionEl = document.getElementById('raspdarts-version');
  if (versionEl) versionEl.textContent = d.autodarts_version;
  const managerVersionEl = document.getElementById('raspdarts-manager-version');
  if (managerVersionEl) managerVersionEl.textContent = d.raspdarts_version ? `v${d.raspdarts_version}` : '--';

  autodartsInstalled = d.autodarts_version !== 'unknown';
  piIP = d.ip_address || null;
  if (!streamActive) {
    const autodartsBtn = document.getElementById('btn-autodarts-update');
    if (autodartsBtn) {
      autodartsBtn.querySelector('.raspdarts-btn-text').textContent = autodartsInstalled
        ? 'Update Autodarts'
        : 'Install Autodarts';
      autodartsBtn.disabled = false;
    }
    const monitorBtn = document.getElementById('btn-autodarts-monitor');
    if (monitorBtn) {
      if (autodartsInstalled && piIP) {
        monitorBtn.classList.remove('raspdarts-hidden');
      } else {
        monitorBtn.classList.add('raspdarts-hidden');
      }
    }
    const uninstallAutoBtn = document.getElementById('btn-autodarts-uninstall');
    if (uninstallAutoBtn) uninstallAutoBtn.disabled = !autodartsInstalled;

    const uninstallSysBtn = document.getElementById('btn-system-uninstall');
    if (uninstallSysBtn) uninstallSysBtn.disabled = false;

    const systemBtn = document.getElementById('btn-system-update');
    if (systemBtn) {
      systemBtn.querySelector('.raspdarts-btn-text').textContent = 'Update Raspdarts';
      systemBtn.disabled = false;
    }
    document.getElementById('btn-reboot')?.removeAttribute('disabled');
    document.getElementById('btn-shutdown')?.removeAttribute('disabled');
  }
}

// Universal confirm dialog

function openDialog({ title, confirmText, confirmBtnClass, action }) {
  document.getElementById('raspdarts-dialog-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'raspdarts-dialog-overlay';

  const titleEl = document.createElement('div');
  titleEl.className = 'raspdarts-dialog-title';
  titleEl.textContent = title;

  const textEl = document.createElement('p');
  textEl.className = 'raspdarts-dialog-text';
  textEl.textContent = confirmText;

  const yesBtn = document.createElement('button');
  yesBtn.id = 'btn-dialog-yes';
  yesBtn.className = `raspdarts-btn ${confirmBtnClass}`;
  yesBtn.textContent = 'Yes, continue';

  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'btn-dialog-cancel';
  cancelBtn.className = 'raspdarts-btn raspdarts-btn-secondary';
  cancelBtn.textContent = 'Cancel';

  const confirmButtons = document.createElement('div');
  confirmButtons.className = 'raspdarts-confirm-buttons';
  confirmButtons.appendChild(yesBtn);
  confirmButtons.appendChild(cancelBtn);

  const confirmSection = document.createElement('div');
  confirmSection.id = 'raspdarts-dialog-confirm';
  confirmSection.appendChild(textEl);
  confirmSection.appendChild(confirmButtons);

  const logContent = document.createElement('div');
  logContent.id = 'raspdarts-dialog-log-content';

  const logEl = document.createElement('div');
  logEl.className = 'raspdarts-log raspdarts-hidden';
  logEl.id = 'raspdarts-dialog-log';
  logEl.appendChild(logContent);

  const spinner = document.createElement('span');
  spinner.className = 'raspdarts-spinner';

  const spinnerLabel = document.createElement('span');
  spinnerLabel.textContent = 'Running\u2026';

  const runningFooter = document.createElement('div');
  runningFooter.id = 'raspdarts-dialog-running';
  runningFooter.className = 'raspdarts-dialog-spinner-row raspdarts-hidden';
  runningFooter.appendChild(spinner);
  runningFooter.appendChild(spinnerLabel);

  const statusEl = document.createElement('div');
  statusEl.id = 'raspdarts-dialog-status';

  const closeBtn = document.createElement('button');
  closeBtn.id = 'btn-dialog-close';
  closeBtn.className = 'raspdarts-btn raspdarts-btn-secondary';
  closeBtn.textContent = 'Close';

  const doneFooter = document.createElement('div');
  doneFooter.id = 'raspdarts-dialog-done';
  doneFooter.className = 'raspdarts-hidden';
  doneFooter.appendChild(statusEl);
  doneFooter.appendChild(closeBtn);

  const dialog = document.createElement('div');
  dialog.id = 'raspdarts-dialog';
  dialog.appendChild(titleEl);
  dialog.appendChild(confirmSection);
  dialog.appendChild(logEl);
  dialog.appendChild(runningFooter);
  dialog.appendChild(doneFooter);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const closeDialog = () => {
    overlay.remove();
    fetchStatus();
  };

  cancelBtn.addEventListener('click', closeDialog);
  closeBtn.addEventListener('click', closeDialog);

  yesBtn.addEventListener('click', () => {
    confirmSection.classList.add('raspdarts-hidden');
    runningFooter.classList.remove('raspdarts-hidden');

    if (action.type === 'stream') {
      _dialogRunStream(overlay, action.url);
    } else {
      _dialogRunFetch(overlay, action, closeDialog);
    }
  });
}

function _dialogTransitionToDone(overlay, success, message) {
  streamActive = false;
  activePort = null;
  overlay.querySelector('#raspdarts-dialog-running').classList.add('raspdarts-hidden');
  const doneEl = overlay.querySelector('#raspdarts-dialog-done');
  doneEl.classList.remove('raspdarts-hidden');
  const statusEl = overlay.querySelector('#raspdarts-dialog-status');
  statusEl.textContent = message;
  statusEl.className = success ? 'success' : 'error';
}

function _dialogRunStream(overlay, url) {
  const logEl = overlay.querySelector('#raspdarts-dialog-log');
  const logContent = overlay.querySelector('#raspdarts-dialog-log-content');

  const port = chrome.runtime.connect({ name: 'raspdarts-stream' });
  activePort = port;
  streamActive = true;

  port.onMessage.addListener((msg) => {
    if (msg.type === 'log') {
      logEl.classList.remove('raspdarts-hidden');
      logContent.textContent += msg.line + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    } else if (msg.type === 'conflict') {
      _dialogTransitionToDone(overlay, false, 'Already running \u2014 try again shortly.');
      port.disconnect();
    } else if (msg.type === 'done') {
      _dialogTransitionToDone(overlay, msg.success, msg.success ? 'Completed successfully!' : `Error: ${msg.error}`);
    }
  });

  port.onDisconnect.addListener(() => {
    if (streamActive) _dialogTransitionToDone(overlay, false, 'Stream disconnected.');
  });

  port.postMessage({ type: 'stream-start', url });
}

async function _dialogRunFetch(overlay, action, closeDialog) {
  const result = await sendToBackground({ type: 'fetch', url: action.url, method: 'POST' });
  if (result && result.ok) {
    _dialogTransitionToDone(overlay, true, action.doneText);
    if (action.autoClose) setTimeout(closeDialog, action.autoClose);
  } else {
    const errMsg = (result && result.error) ? `Error: ${result.error}` : 'Error: request failed.';
    _dialogTransitionToDone(overlay, false, errMsg);
  }
}

// Start

injectNavButton();
