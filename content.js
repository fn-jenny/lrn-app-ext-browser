document.addEventListener('mouseup', () => {
  // Ne pas écraser le texte en attente quand on sélectionne le token à copier.
  if (window.location.pathname === '/extension/token') {
    return;
  }

  const selection = window.getSelection()?.toString().trim();

  if (!selection) {
    return;
  }

  chrome.storage.local.set({
    selectedText: selection,
    sourceUrl: window.location.href
  });
});