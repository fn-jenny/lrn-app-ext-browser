document.addEventListener('DOMContentLoaded', () => {
  // Garde-fou : popup.html ouvert directement comme fichier (file://) au lieu du
  // bouton d'extension -> les APIs chrome.storage n'existent pas, on l'explique
  // au lieu de planter sur "Cannot read properties of undefined (reading 'local')".
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    document.getElementById('status').textContent =
      "Ouvrez cette fenêtre via le bouton Lexikeep de Chrome (pas comme un fichier).";
    return;
  }
  const apiUrlInput = document.getElementById('apiUrl');
  const nameInput = document.getElementById('name');
  const nameLabel = document.getElementById('nameLabel');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const tokenInput = document.getElementById('token');
  const sourceUrlInput = document.getElementById('sourceUrl');
  const wordLibelleInput = document.getElementById('wordLibelle');
  const saveWordBtn = document.getElementById('saveWordBtn');
  const resultCard = document.getElementById('resultCard');
  const resLibelle = document.getElementById('resLibelle');
  const resStatut = document.getElementById('resStatut');
  const resDefinition = document.getElementById('resDefinition');
  const resAntonyme = document.getElementById('resAntonyme');
  const resExemplesWrap = document.getElementById('resExemplesWrap');
  const resExemples = document.getElementById('resExemples');
  const resFicheId = document.getElementById('resFicheId');
  const refreshResultBtn = document.getElementById('refreshResultBtn');
  const newExplainBtn = document.getElementById('newExplainBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const submitAuthBtn = document.getElementById('submitAuthBtn');
  const loginModeBtn = document.getElementById('loginModeBtn');
  const registerModeBtn = document.getElementById('registerModeBtn');
  const authControls = document.getElementById('authControls');
  const googleBlock = document.getElementById('googleBlock');
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const googleTokenWrap = document.getElementById('googleTokenWrap');
  const googleTokenInput = document.getElementById('googleToken');
  const saveGoogleTokenBtn = document.getElementById('saveGoogleTokenBtn');
  const accountBar = document.getElementById('accountBar');
  const accountName = document.getElementById('accountName');
  const accountEmail = document.getElementById('accountEmail');
  const status = document.getElementById('status');

  let authMode = 'login';
  let sendSelectionAfterAuth = false;
  let currentUser = { name: '', email: '' };

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('error', isError);
  };

  /**
   * Affiche la fiche expliquée (définition + exemples + antonyme)
   * à la place du formulaire, et la mémorise pour la prochaine ouverture.
   */
  const afficherResultat = (fiche) => {
    if (!fiche) return;
    resLibelle.textContent = fiche.libelle || '';
    resFicheId.value = fiche.id || '';

    const validee = fiche.statut === 'validee';
    resStatut.textContent = validee ? '✓ Validée' : '⏳ En cours...';

    resDefinition.textContent = fiche.definition
      ? `« ${fiche.definition} »`
      : 'Explication en cours de génération... revenez Actualiser dans un instant.';

    if (fiche.antonyme) {
      resAntonyme.hidden = false;
      resAntonyme.innerHTML = '';
      resAntonyme.append('Contraire : ');
      const fort = document.createElement('strong');
      fort.textContent = fiche.antonyme;
      resAntonyme.append(fort);
    } else {
      resAntonyme.hidden = true;
    }

    resExemples.innerHTML = '';
    const exemples = Array.isArray(fiche.exemples) ? fiche.exemples : [];
    resExemplesWrap.hidden = exemples.length === 0;
    exemples.forEach((ex) => {
      const li = document.createElement('li');
      li.textContent = ex.phrase || '';
      resExemples.append(li);
    });

    refreshResultBtn.hidden = validee;
    resultCard.hidden = false;
    chrome.storage.local.set({ lastFiche: fiche });
    setStatus(validee ? 'Fiche validée : relisez-la pour la mémoriser.' : 'Explication en cours... cliquez Actualiser.', false);
  };

  const montrerFormulaire = () => {
    resultCard.hidden = true;
    chrome.storage.local.remove('lastFiche');
  };

  const setAuthMode = (mode) => {
    authMode = mode;
    const isLogin = mode === 'login';
    loginModeBtn.classList.toggle('active', isLogin);
    registerModeBtn.classList.toggle('active', !isLogin);
    submitAuthBtn.textContent = isLogin ? 'Se connecter' : 'Créer mon compte';

    nameInput.hidden = isLogin;
    nameLabel.hidden = isLogin;
  };

  const buildApiUrl = (endpoint) => {
    const base = apiUrlInput.value.trim().replace(/\/+$/, '');
    return `${base}${endpoint}`;
  };

  const buildWebBase = () => {
    const apiBase = (apiUrlInput.value.trim() || 'http://127.0.0.1:8000/api').replace(/\/+$/, '');
    const webBase = apiBase.replace(/\/api$/, '') || 'http://127.0.0.1:8000';
    // Le flux web doit passer par localhost:8000 (même hôte que APP_URL et
    // GOOGLE_REDIRECT_URI), sinon le cookie de session est perdu entre
    // 127.0.0.1 et localhost et le callback retombe sur le dashboard.
    return webBase.replace('://127.0.0.1:', '://localhost:');
  };

  const storeToken = (token) => {
    tokenInput.value = token;
    chrome.storage.local.set({
      token,
      apiUrl: apiUrlInput.value.trim(),
      userName: currentUser.name || '',
      userEmail: currentUser.email || ''
    });
    renderAuthState(token);
  };

  const clearToken = () => {
    tokenInput.value = '';
    currentUser = { name: '', email: '' };
    chrome.storage.local.remove(['token', 'userName', 'userEmail']);
    renderAuthState('');
  };

  const renderAuthState = (token) => {
    const hasToken = Boolean(token && token.trim());
    tokenInput.value = token || '';
    authControls.hidden = hasToken;
    googleBlock.hidden = hasToken;
    logoutBtn.hidden = !hasToken;
    accountBar.hidden = !hasToken || !currentUser.name;

    if (hasToken) {
      accountName.textContent = currentUser.name || '';
      accountEmail.textContent = currentUser.email ? `(${currentUser.email})` : '';
      setStatus(currentUser.name
        ? `Connecté : ${currentUser.name}${currentUser.email ? ` (${currentUser.email})` : ''} — sélectionne un mot ou une phrase à expliquer.`
        : 'Connecté. Sélectionne un mot ou une phrase à expliquer.');
    } else {
      setStatus('Bienvenue. Connecte-toi pour expliquer tes sélections.');
    }
  };

  const envoyerApresConnexion = async (token) => {
    if (sendSelectionAfterAuth && wordLibelleInput.value.trim()) {
      sendSelectionAfterAuth = false;
      await chrome.storage.local.remove('sendSelectionAfterAuth');
      await sendFicheMot(token, wordLibelleInput.value.trim(), sourceUrlInput.value.trim());
    }
  };

  const handleAuth = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      setStatus('Email et mot de passe requis.', true);
      return;
    }

    if (authMode === 'register' && !nameInput.value.trim()) {
      setStatus('Indiquez votre nom pour créer le compte.', true);
      return;
    }

    if (authMode === 'register' && password.length < 8) {
      setStatus('Le mot de passe doit contenir au moins 8 caractères.', true);
      return;
    }

    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const payload = authMode === 'login'
      ? { email, password }
      : {
          name: nameInput.value.trim(),
          email,
          password,
          password_confirmation: password
        };

    try {
      const response = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && authMode === 'login') {
          setStatus('Connexion impossible. Vérifiez vos identifiants ou créez un compte.', true);
          return;
        }

        throw new Error(data.message || 'Authentification impossible.');
      }

      const token = data.token;
      if (!token) {
        throw new Error('Le serveur n’a pas renvoyé de token.');
      }

      currentUser = { name: data.user?.name || '', email: data.user?.email || '' };
      storeToken(token);
      setStatus(authMode === 'login' ? 'Connexion réussie.' : 'Compte créé avec succès.');
      await envoyerApresConnexion(token);
    } catch (error) {
      setStatus(error.message || 'Erreur lors de l’authentification.', true);
    }
  };

  /**
   * Une seule action : expliquer la sélection.
   * 1) Le passage est gardé comme contexte (snippet),
   * 2) la fiche est créée et liée à ce contexte,
   * 3) le job l'enrichit : signification + 3 exemples + antonyme.
   */
  const sendFicheMot = async (token, libelle, sourceUrl) => {
    if (!libelle) {
      setStatus('Sélectionne un mot ou une phrase à expliquer.', true);
      return;
    }

    // Une fiche = un mot ou une phrase simple (colonne limitée à 255 caractères).
    if (libelle.length > 255) {
      setStatus('Sélection trop longue : choisis un mot ou une phrase simple à comprendre.', true);
      return;
    }

    setStatus('Explication en cours...', false);
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    try {
      // 1) Contexte de lecture (optionnel : la fiche reste utile sans lui).
      let snippetId = null;
      try {
        const resSnippet = await fetch(buildApiUrl('/snippets'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ content: libelle, source_url: sourceUrl })
        });
        if (resSnippet.status === 401) {
          clearToken();
          throw new Error('Session expirée. Reconnectez-vous.');
        }
        if (resSnippet.ok) {
          snippetId = (await resSnippet.json()).snippet?.id ?? null;
        }
      } catch (error) {
        if (/Session expirée/.test(error.message || '')) throw error;
        console.warn('Contexte non enregistré, fiche créée sans lui :', error);
      }

      // 2) La fiche à comprendre (type auto : 1 mot -> mot, sinon expression).
      const type = libelle.split(/\s+/).length > 1 ? 'expression' : 'mot';
      const response = await fetch(buildApiUrl('/fiches-mots'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          libelle,
          type,
          snippet_id: snippetId,
          selections: [{ texte: libelle }]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          clearToken();
        }
        throw new Error(data.message || 'Erreur lors de la création de la fiche.');
      }

      await chrome.storage.local.remove(['selectedText', 'sourceUrl']);
      wordLibelleInput.value = '';

      afficherResultat(data.fiche);
    } catch (error) {
      setStatus(error.message || 'Impossible d’expliquer la sélection.', true);
    }
  };

  chrome.storage.local.get(['token', 'apiUrl', 'userName', 'userEmail', 'selectedText', 'sourceUrl', 'authMessage', 'sendSelectionAfterAuth', 'sendStatus', 'googleFlowPending', 'lastFiche'], (items) => {
    if (items.apiUrl) apiUrlInput.value = items.apiUrl;
    if (items.token) tokenInput.value = items.token;
    if (items.sourceUrl) sourceUrlInput.value = items.sourceUrl;

    if (items.selectedText) {
      // Nouvelle sélection prioritaire : on montre le formulaire pré-rempli.
      montrerFormulaire();
      wordLibelleInput.value = items.selectedText.trim();
    } else if (items.lastFiche) {
      // Sinon on remontre la dernière explication (définition, pas un champ vide).
      afficherResultat(items.lastFiche);
    }

    currentUser = { name: items.userName || '', email: items.userEmail || '' };
    if (items.googleFlowPending && !items.token) googleTokenWrap.hidden = false;
    sendSelectionAfterAuth = Boolean(items.sendSelectionAfterAuth);
    renderAuthState(items.token || '');

    if (items.authMessage) {
      setStatus(items.authMessage);
      chrome.storage.local.remove('authMessage');
    } else if (items.sendStatus) {
      setStatus(items.sendStatus.message, items.sendStatus.isError);
      chrome.storage.local.remove('sendStatus');
      chrome.action.setBadgeText({ text: '' });
    }

    // Pont automatique : si authentifié et qu'une explication était en attente.
    if (items.token && sendSelectionAfterAuth) {
      envoyerApresConnexion(items.token);
    }
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      sourceUrlInput.value = tabs[0].url;
    }
  });

  loginModeBtn.addEventListener('click', () => setAuthMode('login'));
  registerModeBtn.addEventListener('click', () => setAuthMode('register'));
  submitAuthBtn.addEventListener('click', handleAuth);

  googleLoginBtn.addEventListener('click', () => {
    const url = `${buildWebBase()}/auth/google/redirect?from=extension`;
    chrome.storage.local.set({ apiUrl: apiUrlInput.value.trim(), googleFlowPending: true });
    chrome.tabs.create({ url });
    googleTokenWrap.hidden = false;
    setStatus('Terminez la connexion Google dans l’onglet ouvert, puis collez ici le token affiché.');
  });

  saveGoogleTokenBtn.addEventListener('click', async () => {
    const token = googleTokenInput.value.trim();

    if (!token) {
      setStatus('Collez le token affiché sur le site après la connexion Google.', true);
      return;
    }

    storeToken(token);
    googleTokenInput.value = '';
    await chrome.storage.local.remove('googleFlowPending');

    // Le token manuel ne dit pas qui tu es : on demande au serveur.
    try {
      const me = await fetch(buildApiUrl('/user'), {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (me.ok) {
        const u = await me.json();
        currentUser = { name: u.name || '', email: u.email || '' };
        chrome.storage.local.set({ userName: currentUser.name, userEmail: currentUser.email });
        renderAuthState(token);
      }
    } catch {
      // Pas grave : on reste connecté sans le nom.
    }
    setStatus(currentUser.name ? `Compte Google lié : ${currentUser.name}.` : 'Compte Google lié à l’extension.');
    await envoyerApresConnexion(token);
  });

  logoutBtn.addEventListener('click', () => {
    clearToken();
    setStatus('Déconnecté. Pour expliquer un texte, reconnectez-vous.', false);
  });

  refreshResultBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const id = resFicheId.value.trim();
    if (!token || !id) return;
    setStatus('Actualisation...', false);
    try {
      const response = await fetch(buildApiUrl(`/fiches-mots/${id}`), {
        headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Actualisation impossible.');
      afficherResultat(data.fiche);
    } catch (error) {
      setStatus(error.message || 'Actualisation impossible.', true);
    }
  });

  newExplainBtn.addEventListener('click', () => {
    montrerFormulaire();
    wordLibelleInput.value = '';
    wordLibelleInput.focus();
    setStatus('Sélectionne un mot ou une phrase à expliquer.', false);
  });

  saveWordBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const libelle = wordLibelleInput.value.trim();
    const sourceUrl = sourceUrlInput.value.trim();

    if (!token) {
      setStatus('Connectez-vous pour expliquer votre sélection.', true);
      return;
    }

    if (!libelle) {
      setStatus('Sélectionne un mot ou une phrase à expliquer.', true);
      return;
    }

    chrome.storage.local.set({
      token,
      apiUrl: apiUrlInput.value.trim(),
      selectedText: libelle,
      sourceUrl
    });

    await sendFicheMot(token, libelle, sourceUrl);
  });

  apiUrlInput.addEventListener('change', () => {
    chrome.storage.local.set({ apiUrl: apiUrlInput.value.trim() });
  });

  setAuthMode('login');
});
