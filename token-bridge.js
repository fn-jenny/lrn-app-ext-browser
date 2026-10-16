// Pont automatique : exécuté uniquement sur la page /extension/token.
// Lit le token affiché et le stocke pour le popup (plus de copier-coller).
(() => {
  const tokenInput = document.getElementById('token');
  if (!tokenInput || !tokenInput.value.trim()) {
    return;
  }

  // Contenu web sans l'extension (ou APIs indisponibles) : repli manuel, sans planter.
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    const hint = document.getElementById('bridge-ok');
    if (hint) {
      hint.textContent = 'Liaison auto indisponible : copiez le token ci-dessous dans la popup.';
      hint.hidden = false;
    }
    return;
  }

  const extra = {};
  const nameEl = document.getElementById('userName');
  const mailEl = document.getElementById('userEmail');
  if (nameEl && nameEl.value.trim()) extra.userName = nameEl.value.trim();
  if (mailEl && mailEl.value.trim()) extra.userEmail = mailEl.value.trim();

  chrome.storage.local.set({ token: tokenInput.value.trim(), ...extra }, () => {
    chrome.storage.local.remove('googleFlowPending');

    const ok = document.getElementById('bridge-ok');
    if (ok) {
      ok.hidden = false;
      return;
    }

    const note = document.createElement('p');
    note.textContent = 'Extension Lexikeep liée automatiquement. Tu peux fermer cet onglet et rouvrir le popup.';
    note.style.cssText = 'color:#4338CA;font-weight:700;';
    const row = tokenInput.closest('.token-row');
    if (row) {
      row.after(note);
    }
  });
})();
