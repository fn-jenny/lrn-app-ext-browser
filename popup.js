document.addEventListener('DOMContentLoaded', () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const nameInput = document.getElementById('name');
  const nameLabel = document.getElementById('nameLabel');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const tokenInput = document.getElementById('token');
  const sourceUrlInput = document.getElementById('sourceUrl');
  const contentInput = document.getElementById('content');
  const saveBtn = document.getElementById('saveBtn');
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
  const status = document.getElementById('status');

  let authMode = 'login';
  let sendSelectionAfterAuth = false;

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('error', isError);
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
    chrome.storage.local.set({ token, apiUrl: apiUrlInput.value.trim() });
    renderAuthState(token);
  };

  const clearToken = () => {
    tokenInput.value = '';
    chrome.storage.local.remove('token');
    renderAuthState('');
  };

  const renderAuthState = (token) => {
    const hasToken = Boolean(token && token.trim());
    tokenInput.value = token || '';
    authControls.hidden = hasToken;
    googleBlock.hidden = hasToken;
    logoutBtn.hidden = !hasToken;

    if (hasToken) {
      setStatus('Connecté. Tu peux maintenant envoyer ton texte vers Laravel.');
    } else {
      setStatus('Bienvenue. Connecte-toi pour enregistrer ton texte sélectionné.');
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

      storeToken(token);
      setStatus(authMode === 'login' ? 'Connexion réussie.' : 'Compte créé avec succès.');
      if (sendSelectionAfterAuth && contentInput.value.trim()) {
        sendSelectionAfterAuth = false;
        await chrome.storage.local.remove('sendSelectionAfterAuth');
        await sendSnippet(token, contentInput.value.trim(), sourceUrlInput.value.trim());
      }
    } catch (error) {
      setStatus(error.message || 'Erreur lors de l’authentification.', true);
    }
  };

  const sendSnippet = async (token, content, sourceUrl) => {
    if (!content) {
      setStatus('Aucun texte à envoyer.', true);
      return;
    }

    try {
      const response = await fetch(buildApiUrl('/snippets'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, source_url: sourceUrl })
      });

      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          clearToken();
        }
        throw new Error(data.message || 'Erreur lors de l’envoi.');
      }

      await chrome.storage.local.remove(['selectedText', 'sourceUrl']);
      contentInput.value = '';
      setStatus('Texte enregistré dans votre compte.');
    } catch (error) {
      setStatus(error.message || 'Impossible d’envoyer le texte.', true);
    }
  };

  chrome.storage.local.get(['token', 'apiUrl', 'selectedText', 'sourceUrl', 'authMessage', 'sendSelectionAfterAuth', 'sendStatus', 'googleFlowPending'], (items) => {
    if (items.apiUrl) apiUrlInput.value = items.apiUrl;
    if (items.token) tokenInput.value = items.token;
    if (items.selectedText) contentInput.value = items.selectedText;
    if (items.sourceUrl) sourceUrlInput.value = items.sourceUrl;
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

    // Pont automatique : le token a pu arriver via la page /extension/token
    // pendant que le popup était fermé. Si un texte est en attente, on l'envoie.
    if (items.token && sendSelectionAfterAuth && contentInput.value.trim()) {
      sendSelectionAfterAuth = false;
      chrome.storage.local.remove('sendSelectionAfterAuth');
      sendSnippet(items.token, contentInput.value.trim(), sourceUrlInput.value.trim());
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
    setStatus('Compte Google lié à l’extension.');
    if (sendSelectionAfterAuth && contentInput.value.trim()) {
      sendSelectionAfterAuth = false;
      await chrome.storage.local.remove('sendSelectionAfterAuth');
      await sendSnippet(token, contentInput.value.trim(), sourceUrlInput.value.trim());
    }
  });

  logoutBtn.addEventListener('click', () => {
    clearToken();
    setStatus('Déconnecté. Pour réenvoyer un texte, reconnectez-vous.', false);
  });

  saveBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    const content = contentInput.value.trim();
    const sourceUrl = sourceUrlInput.value.trim();

    if (!token) {
      setStatus('Connectez-vous pour envoyer le texte sélectionné.', true);
      return;
    }

    if (!content) {
      setStatus('Sélectionnez ou ajoutez un texte avant l’envoi.', true);
      return;
    }

    chrome.storage.local.set({
      token,
      apiUrl: apiUrlInput.value.trim(),
      selectedText: content,
      sourceUrl
    });

    await sendSnippet(token, content, sourceUrl);
  });

  apiUrlInput.addEventListener('change', () => {
    chrome.storage.local.set({ apiUrl: apiUrlInput.value.trim() });
  });

  setAuthMode('login');
});