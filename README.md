# Lexikeep — Extension Chrome

Extension Manifest V3 pour capturer un mot pendant la lecture et l’envoyer vers **Lexikeep**, l’application d’apprentissage de vocabulaire.

## À quoi ça sert

1. Tu sélectionnes un mot (ou une courte expression) sur une page web.
2. Clic droit → **Envoyer le mot vers Lexikeep**.
3. L’extension authentifie l’appel (token Sanctum) et appelle `POST /api/snippets`.
4. L’app Laravel enregistre le mot, génère une fiche IA (définition, contexte, synonyme, antonyme, 3 phrases), puis propose des quiz à trous.

Companion app : [`lrn-app`](https://github.com/fn-jenny/lrn-app) (ou ton clone local Herd / `php artisan serve`).

## Installation (développement)

1. Ouvre Chrome → `chrome://extensions`
2. Active le **Mode développeur**
3. **Charger l’extension non empaquetée** → sélectionne ce dossier
4. Clique sur l’icône Lexikeep, crée un compte ou connecte-toi
5. Vérifie l’URL API (Options avancées), par défaut :
   `http://127.0.0.1:8001/api`

L’app Laravel doit tourner et le worker de queue doit être actif pour l’enrichissement IA.

## Utilisation

| Action | Résultat |
|--------|----------|
| Sélection + clic droit → **Envoyer le mot vers Lexikeep** | Envoi immédiat si connecté |
| Popup → **Envoyer le mot** | Envoi manuel / édition du mot |
| Connexion / inscription | Token stocké dans `chrome.storage.local` |

Sans token, l’extension ouvre le popup ; après connexion, le mot sélectionné peut être renvoyé automatiquement.

## Fichiers

```
manifest.json   # MV3, permissions, hosts, icônes
background.js   # Menu contextuel + envoi API
content.js      # Mémorise la sélection pour le popup
popup.html/js   # Auth + envoi manuel
icons/          # Icônes et logo Lexikeep
```

## Payload API

```http
POST {apiBase}/snippets
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "serendipity",
  "source_url": "https://example.com/article"
}
```

Auth :

- `POST {apiBase}/auth/login` → `{ email, password }`
- `POST {apiBase}/auth/register` → `{ name, email, password, password_confirmation }`

## Permissions

- `storage` — token, URL API, sélection
- `contextMenus` — entrée « Envoyer le mot »
- `activeTab` / `tabs` — URL source
- Hosts locaux (`localhost` / `127.0.0.1` ports 8000–8001) et `*.test` (Herd)

## Développement

Pas de build step : édite les fichiers JS/HTML, puis recharge l’extension dans `chrome://extensions`.

Si l’app tourne sur un autre hôte (Herd, staging), ajoute-le dans `host_permissions` du `manifest.json` et dans l’URL API du popup.

## Licence

MIT
