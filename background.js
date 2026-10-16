chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "expliquer",
      title: "Expliquer avec Lexikeep",
      contexts: ["selection"]
    });
  });
});

const showSendStatus = async (message, isError = false) => {
  await chrome.storage.local.set({
    sendStatus: { message, isError }
  });
  await chrome.action.setBadgeBackgroundColor({
    color: isError ? "#DC2626" : "#16A34A"
  });
  await chrome.action.setBadgeText({ text: isError ? "!" : "OK" });
};

const openPopupQuietly = () => {
  try {
    chrome.action.openPopup();
  } catch {}
};

/**
 * Une seule action : expliquer la sélection.
 * 1) On garde le passage comme contexte (snippet),
 * 2) on crée la fiche (mot ou phrase simple) liée à ce contexte,
 * 3) le job l'enrichit : définition (= signification) + 3 exemples + antonyme.
 */
const expliquerSelection = async (token, apiBase, text, sourceUrl) => {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`
  };

  // 1) Contexte de lecture (le passage exact, avec sa page d'origine).
  //    Si ça échoue, on continue quand même : la fiche reste utile sans contexte.
  let snippetId = null;
  try {
    const resSnippet = await fetch(`${apiBase}/snippets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: text, source_url: sourceUrl })
    });
    if (resSnippet.status === 401) {
      await chrome.storage.local.remove("token");
      await chrome.storage.local.set({
        authMessage: "Votre session a expiré. Reconnectez-vous pour expliquer votre sélection.",
        sendSelectionAfterAuth: true
      });
      openPopupQuietly();
      return;
    }
    if (resSnippet.ok) {
      const dataSnippet = await resSnippet.json();
      snippetId = dataSnippet.snippet?.id ?? null;
    }
  } catch (error) {
    console.warn("Contexte non enregistré, la fiche sera créée sans lui :", error);
  }

  // 2) La fiche à comprendre (type auto : 1 mot -> mot, sinon expression).
  const type = text.split(/\s+/).length > 1 ? "expression" : "mot";
  try {
    const response = await fetch(`${apiBase}/fiches-mots`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        libelle: text,
        type,
        snippet_id: snippetId,
        selections: [{ texte: text }]
      })
    });

    if (response.status === 401) {
      await chrome.storage.local.remove("token");
      await chrome.storage.local.set({
        authMessage: "Votre session a expiré. Reconnectez-vous pour expliquer votre sélection.",
        sendSelectionAfterAuth: true
      });
      openPopupQuietly();
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Erreur lors de la création de la fiche.");
    }

    const infoStatut = data.fiche?.statut === "validee"
      ? "✓ Validée avec 3 exemples"
      : "⏳ Enrichissement en cours";

    await showSendStatus(`« ${text.slice(0, 60)}${text.length > 60 ? "…" : ""} » expliqué ! (${infoStatut})`);
    // Mémorisée : en rouvrant la popup, la définition s'affiche (pas un champ vide).
    await chrome.storage.local.set({ lastFiche: data.fiche || null });
    console.log("Fiche expliquée :", data);
  } catch (error) {
    console.error("Impossible d'expliquer la sélection :", error);
    await showSendStatus(error.message || "Erreur lors de l'explication.", true);
    openPopupQuietly();
  }
};

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "expliquer" || !info.selectionText) {
    return;
  }

  const text = info.selectionText.trim();
  if (!text) {
    return;
  }

  await chrome.storage.local.set({
    selectedText: text,
    sourceUrl: tab?.url ?? ""
  });

  // Une fiche = un mot ou une phrase simple : l'utilisateur raccourcit dans la popup.
  if (text.length > 255) {
    await chrome.storage.local.set({
      authMessage: "Sélection trop longue : choisis un mot ou une phrase simple à comprendre, puis clique « Expliquer »."
    });
    openPopupQuietly();
    return;
  }

  const { token, apiUrl } = await chrome.storage.local.get(["token", "apiUrl"]);
  const apiBase = (apiUrl || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

  if (!token) {
    await chrome.storage.local.set({
      authMessage: "Connectez-vous ou créez un compte : votre sélection sera expliquée ensuite.",
      sendSelectionAfterAuth: true
    });
    openPopupQuietly();
    return;
  }

  await expliquerSelection(token, apiBase, text, tab?.url ?? "");
});
