document.addEventListener('mouseup', () => {
  const selection = window.getSelection()?.toString().trim();

  if (!selection) {
    return;
  }

  chrome.storage.local.set({
    selectedText: selection,
    sourceUrl: window.location.href
  });
});