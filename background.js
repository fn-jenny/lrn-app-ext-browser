chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "save-selected-text",
      title: "Rechercher",
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-selected-text" || !info.selectionText) {
    return;
  }
  await chrome.storage.local.set({
  selectedText: info.selectionText.trim(),
  sourceUrl: tab?.url ?? ""
});

  const { token } = await chrome.storage.local.get("token");

  if (!token) {
    console.error("Ouvre le popup et enregistre d'abord ton token Sanctum.");
    return;
  }

  try {
    const response = await fetch("http://127.0.0.1:8000/api/snippets", {
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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Erreur lors de l'enregistrement.");
    }

    console.log("Snippet enregistré :", data);
  } catch (error) {
    console.error("Impossible d'enregistrer le snippet :", error);
  }
});
