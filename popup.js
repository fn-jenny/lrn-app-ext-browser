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

  chrome.storage.local.get(['token', 'apiUrl', 'selectedText', 'sourceUrl', 'authMessage', 'sendSelectionAfterAuth', 'sendStatus'], (items) => {
    if (items.apiUrl) apiUrlInput.value = items.apiUrl;
    if (items.token) tokenInput.value = items.token;
    if (items.selectedText) contentInput.value = items.selectedText;
    if (items.sourceUrl) sourceUrlInput.value = items.sourceUrl;
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
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      sourceUrlInput.value = tabs[0].url;
    }
  });

  loginModeBtn.addEventListener('click', () => setAuthMode('login'));
  registerModeBtn.addEventListener('click', () => setAuthMode('register'));
  submitAuthBtn.addEventListener('click', handleAuth);

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