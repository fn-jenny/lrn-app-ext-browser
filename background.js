chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-selected-text",
      title: "Envoyer sur lrn-app",
      contexts: ["selection"]
    });
  });
});

const showSendStatus = async (message, isError = false) => {
  await chrome.storage.local.set({
    sendStatus: { message, isError }
  });
  await chrome.action.setBadgeBackgroundColor({
    color: isError ? "#b3261e" : "#1f5f3c"
  });
  await chrome.action.setBadgeText({ text: isError ? "!" : "OK" });
};

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-selected-text" || !info.selectionText) {
    return;
  }

  await chrome.storage.local.set({
    selectedText: info.selectionText.trim(),
    sourceUrl: tab?.url ?? ""
  });

  const { token, apiUrl } = await chrome.storage.local.get(["token", "apiUrl"]);
  const apiBase = (apiUrl || "http://127.0.0.1:8001/api").replace(/\/+$/, "");

  if (!token) {
    await chrome.storage.local.set({
      authMessage: "Vous n'êtes pas connecté. Connectez-vous pour envoyer le texte sélectionné."
    });
    chrome.action.openPopup();
    return;
  }

  try {
    const response = await fetch(`${apiBase}/snippets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        content: info.selectionText.trim(),
        source_url: tab?.url ?? ""
      })
    });

    if (response.status === 401) {
      await chrome.storage.local.remove("token");
      await chrome.storage.local.set({
        authMessage: "Votre session a expiré. Connectez-vous de nouveau pour envoyer ce texte."
      });
      chrome.action.openPopup();
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Erreur lors de l'enregistrement.");
    }

    await showSendStatus(data.message || "Snippet enregistré !");
    console.log("Snippet enregistré :", data);
  } catch (error) {
    console.error("Impossible d'enregistrer le snippet :", error);
    await showSendStatus(error.message || "Erreur lors de l'envoi.", true);
    chrome.action.openPopup();
  }
});
