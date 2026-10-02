document.addEventListener('DOMContentLoaded', () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const tokenInput = document.getElementById('token');
  const sourceUrlInput = document.getElementById('sourceUrl');
  const contentInput = document.getElementById('content');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  chrome.storage.local.get(['token', 'selectedText', 'sourceUrl'], (items) => {
    if (items.token) tokenInput.value = items.token;
    if (items.selectedText) contentInput.value = items.selectedText;
    if (items.sourceUrl) sourceUrlInput.value = items.sourceUrl;
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      sourceUrlInput.value = tabs[0].url;
    }
  });

  saveBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const content = contentInput.value.trim();
    const sourceUrl = sourceUrlInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();

    if (!token || !content) {
      status.textContent = 'Le token et le contenu sont requis.';
      return;
    }

    chrome.storage.local.set({ token, selectedText: content, sourceUrl });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          source_url: sourceUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur API');
      }

      status.textContent = 'Snippet enregistré !';
    } catch (error) {
      status.textContent = error.message;
    }
  });
});