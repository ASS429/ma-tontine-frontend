/* =========================================================
   ui.js — Utilitaires UI : toast, confirm, prompt, spinner
   ========================================================= */

// ─── Toast Notifications ───
function showNotification(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => toast.remove(), 4200);
}

// ─── Custom Confirm ───
function customConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.innerHTML = `
      <div class="custom-confirm-box">
        <p>${message}</p>
        <div class="custom-confirm-actions">
          <button class="custom-confirm-btn custom-confirm-no">Annuler</button>
          <button class="custom-confirm-btn custom-confirm-yes">Confirmer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.custom-confirm-yes').onclick = () => { resolve(true);  overlay.remove(); };
    overlay.querySelector('.custom-confirm-no').onclick  = () => { resolve(false); overlay.remove(); };
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') { resolve(false); overlay.remove(); } });
  });
}

// ─── Custom Prompt ───
function customPrompt(message, defaultValue = '') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.innerHTML = `
      <div class="custom-confirm-box">
        <p>${message}</p>
        <input class="custom-prompt-input" type="text" value="${defaultValue}" placeholder="Saisir ici...">
        <div class="custom-confirm-actions">
          <button class="custom-confirm-btn custom-confirm-no">Annuler</button>
          <button class="custom-confirm-btn custom-confirm-yes">Valider</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.custom-prompt-input');
    input.focus();

    overlay.querySelector('.custom-confirm-yes').onclick = () => { resolve(input.value); overlay.remove(); };
    overlay.querySelector('.custom-confirm-no').onclick  = () => { resolve(null); overlay.remove(); };
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { resolve(input.value); overlay.remove(); }
      if (e.key === 'Escape') { resolve(null); overlay.remove(); }
    });
  });
}

// Override native dialogs
window.confirm = customConfirm;
window.prompt  = customPrompt;

// ─── Flash visuel alerte haute urgence ───
function flashVisuel() {
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position:'fixed', inset:'0', background:'rgba(239,68,68,.3)',
    zIndex:'9999', pointerEvents:'none',
    animation:'flashAnim .5s ease-in-out'
  });
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}

// Inject flash keyframe once
const _flashStyle = document.createElement('style');
_flashStyle.textContent = `@keyframes flashAnim { 0%{opacity:0} 50%{opacity:1} 100%{opacity:0} }`;
document.head.appendChild(_flashStyle);

// ─── Modal helpers ───
function showModalById(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hideModalById(id) { document.getElementById(id)?.classList.add('hidden'); }

// ─── Réseau bannière ───
function setReseau(mode) {
  const b = document.getElementById('banniereReseau');
  if (!b) return;
  if (mode === 'offline') {
    b.className = 'visible offline';
    b.textContent = '📡 Mode hors ligne — données locales';
    b.style.display = 'block';
  } else if (mode === 'syncing') {
    b.className = 'visible syncing';
    b.textContent = '🔄 Synchronisation en cours…';
    b.style.display = 'block';
  } else if (mode === 'synced') {
    b.className = 'visible synced';
    b.textContent = '✅ Données synchronisées';
    b.style.display = 'block';
    setTimeout(() => { b.style.display = 'none'; }, 2500);
  } else {
    b.style.display = 'none';
  }
}

// ─── Erreur inline dans un formulaire ───
function afficherErreur(msg, containerId) {
  const parent = containerId
    ? document.getElementById(containerId)
    : document.querySelector('.page.active .card-premium');
  if (!parent) return;

  let err = parent.querySelector('.inline-error');
  if (err) err.remove();

  err = document.createElement('div');
  err.className = 'inline-error';
  err.style.cssText = 'background:#FEE2E2;color:#991B1B;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:.9rem;font-weight:500;';
  err.textContent = '⚠️ ' + msg;
  parent.insertBefore(err, parent.firstChild);
  setTimeout(() => err.remove(), 3500);
}
