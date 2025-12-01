# ✅ CHECKLIST DE DÉPLOIEMENT - BiendouCorp Agent

Coche chaque étape une fois terminée :

## 📦 Préparation Git

- [ ] **1.1** Ouvrir PowerShell dans `x:\MesApplis\BiendouCorp\Agent`
- [ ] **1.2** Exécuter: `git init` (si pas déjà fait)
- [ ] **1.3** Exécuter: `git add .`
- [ ] **1.4** Exécuter: `git commit -m "Prepare for deployment"`
- [ ] **1.5** Créer un repo sur GitHub: https://github.com/new
- [ ] **1.6** Exécuter: `git remote add origin https://github.com/TON_USER/biendoucorp-agent.git`
- [ ] **1.7** Exécuter: `git push -u origin master`

## 🚂 Déploiement Backend sur Railway

- [ ] **2.1** Aller sur https://railway.app
- [ ] **2.2** Se connecter avec GitHub
- [ ] **2.3** Cliquer sur "New Project" → "Deploy from GitHub repo"
- [ ] **2.4** Sélectionner le repo `biendoucorp-agent`
- [ ] **2.5** Configurer Root Directory: `backend`
- [ ] **2.6** Ajouter TOUTES les variables d'environnement (voir RAILWAY_ENV_VARS.txt)
- [ ] **2.7** Noter l'URL Railway: `https://_____________.railway.app`
- [ ] **2.8** Mettre à jour `AZURE_REDIRECT_URI` avec l'URL Railway

## 🔵 Configuration Azure

- [ ] **3.1** Aller sur https://portal.azure.com
- [ ] **3.2** Naviguer: Azure Active Directory → App registrations → BiendouCorp
- [ ] **3.3** Aller dans: Authentication → Redirect URIs
- [ ] **3.4** Ajouter: `https://TON_APP.railway.app/auth/callback`
- [ ] **3.5** Sauvegarder

## 📱 Configuration WhatsApp (Meta)

- [ ] **4.1** Aller sur https://developers.facebook.com
- [ ] **4.2** Sélectionner ton app WhatsApp
- [ ] **4.3** Aller dans: Configuration → Webhook
- [ ] **4.4** Modifier Callback URL: `https://TON_APP.railway.app/webhook/whatsapp`
- [ ] **4.5** Verify Token: `biendoucorp_webhook_secret_2024`
- [ ] **4.6** Cliquer "Verify and Save"
- [ ] **4.7** S'assurer que "messages" est abonné

## 🔗 Connexion Outlook

- [ ] **5.1** Ouvrir: `https://TON_APP.railway.app/auth/outlook`
- [ ] **5.2** Se connecter avec ton compte Outlook
- [ ] **5.3** Autoriser l'application
- [ ] **5.4** Vérifier le message "Connexion réussie"

## 🎨 Déploiement Frontend sur Vercel

- [ ] **6.1** Aller sur https://vercel.com
- [ ] **6.2** Se connecter avec GitHub
- [ ] **6.3** Cliquer "Add New..." → "Project"
- [ ] **6.4** Importer le repo `biendoucorp-agent`
- [ ] **6.5** **IMPORTANT:** Ne PAS configurer de Root Directory (laisser vide = racine)
- [ ] **6.6** Ajouter les variables d'environnement:
  ```
  VITE_SUPABASE_URL=https://izhfgbgxmqdcfgxrpqmv.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  VITE_API_URL=https://TON_APP.railway.app
  ```
- [ ] **6.7** Cliquer "Deploy"
- [ ] **6.8** Noter l'URL Vercel: `https://_____________.vercel.app`

## 🧪 Tests

- [ ] **7.1** Tester: `https://TON_APP.railway.app/health` → doit retourner JSON avec status "ok"
- [ ] **7.2** Tester le Dashboard: `https://TON_APP.vercel.app` → doit afficher la page
- [ ] **7.3** Envoyer "bonjour" sur WhatsApp → doit recevoir une réponse
- [ ] **7.4** Envoyer "résume mes mails" → doit fonctionner
- [ ] **7.5** Envoyer "classe mes 5 derniers mails" → doit fonctionner

## 🎉 C'est terminé!

- Backend: `https://_____________.railway.app`
- Frontend: `https://_____________.vercel.app`

---

## 🆘 Dépannage

### Le webhook WhatsApp ne fonctionne pas
1. Vérifier les logs Railway (Deployments → View Logs)
2. Vérifier que l'URL webhook est exacte dans Meta
3. Vérifier que le Verify Token correspond

### Outlook ne se connecte pas
1. Vérifier que l'URI de redirection Azure est EXACTEMENT la même
2. Pas d'espace, pas de / à la fin
3. Vérifier les logs Railway

### Erreur 500 sur Railway
1. Regarder les logs
2. Vérifier que toutes les variables d'environnement sont définies
3. Vérifier que `backend` est bien le Root Directory
