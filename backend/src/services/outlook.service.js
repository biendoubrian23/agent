const { ConfidentialClientApplication } = require('@azure/msal-node');
const axios = require('axios');

// Définition des catégories de classification
const CLASSIFICATION_FOLDERS = {
  'urgent': '🔴 Urgent',
  'professionnel': '💼 Professionnel',
  'shopping': '🛒 Shopping',
  'newsletter': '📰 Newsletter',
  'finance': '🏦 Finance',
  'social': '🤝 Social'
};

class OutlookService {
  constructor() {
    this.msalConfig = {
      auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`
      },
      cache: {
        cachePlugin: null
      }
    };
    
    this.msalClient = new ConfidentialClientApplication(this.msalConfig);
    this.tokens = null;
    this.account = null;
    this.graphBaseUrl = 'https://graph.microsoft.com/v1.0';
    
    // Cache des dossiers (pour éviter de les rechercher à chaque fois)
    this.foldersCache = null;
    
    // Mémoire des classifications récentes
    this.classificationMemory = [];
  }

  /**
   * Générer l'URL d'authentification
   */
  getAuthUrl() {
    const authCodeUrlParameters = {
      scopes: ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite', 'MailboxSettings.ReadWrite', 'User.Read', 'offline_access'],
      redirectUri: process.env.AZURE_REDIRECT_URI
    };

    return this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }

  /**
   * Échanger le code d'autorisation contre des tokens
   */
  async handleCallback(code) {
    try {
      const tokenRequest = {
        code: code,
        scopes: ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite', 'MailboxSettings.ReadWrite', 'User.Read', 'offline_access'],
        redirectUri: process.env.AZURE_REDIRECT_URI
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);
      this.tokens = {
        accessToken: response.accessToken,
        expiresOn: response.expiresOn
      };
      this.account = response.account;

      console.log('✅ Authentification Outlook réussie');
      
      // Initialiser les dossiers après connexion
      await this.initializeClassificationFolders();
      
      return this.tokens;
    } catch (error) {
      console.error('❌ Erreur authentification Outlook:', error);
      throw error;
    }
  }

  /**
   * Rafraîchir le token si nécessaire (utilise le cache MSAL)
   */
  async ensureValidToken() {
    if (!this.tokens || !this.account) {
      throw new Error('Non authentifié. Veuillez vous connecter via /auth/outlook');
    }

    // Vérifier si le token expire bientôt (dans les 5 minutes)
    const now = new Date();
    const expiresOn = new Date(this.tokens.expiresOn);
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresOn.getTime() - now.getTime() < fiveMinutes) {
      try {
        console.log('🔄 Rafraîchissement du token Outlook...');
        
        const silentRequest = {
          account: this.account,
          scopes: ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite', 'MailboxSettings.ReadWrite', 'User.Read', 'offline_access'],
          forceRefresh: true
        };

        const response = await this.msalClient.acquireTokenSilent(silentRequest);
        this.tokens.accessToken = response.accessToken;
        this.tokens.expiresOn = response.expiresOn;
        this.account = response.account;
        
        console.log('✅ Token Outlook rafraîchi');
      } catch (error) {
        console.error('❌ Erreur rafraîchissement token:', error.message);
        this.tokens = null;
        this.account = null;
        const baseUrl = process.env.AZURE_REDIRECT_URI?.replace('/auth/callback', '') || 'http://localhost:3001';
        throw new Error(`Session expirée. Veuillez vous reconnecter via ${baseUrl}/auth/outlook`);
      }
    }

    return this.tokens.accessToken;
  }

  // ==================== GESTION DES DOSSIERS ====================

  /**
   * Récupérer tous les dossiers de la boîte mail
   */
  async getFolders() {
    const accessToken = await this.ensureValidToken();

    try {
      // Récupérer les dossiers racine
      const rootResponse = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders?$top=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      let allFolders = rootResponse.data.value.map(folder => ({
        id: folder.id,
        name: folder.displayName,
        totalCount: folder.totalItemCount,
        unreadCount: folder.unreadItemCount,
        parentId: null
      }));

      // Récupérer aussi les sous-dossiers de Inbox (là où sont nos dossiers de classification)
      const inbox = allFolders.find(f => f.name.toLowerCase() === 'inbox' || f.name.toLowerCase() === 'boîte de réception');
      if (inbox) {
        try {
          const subResponse = await axios.get(
            `${this.graphBaseUrl}/me/mailFolders/${inbox.id}/childFolders?$top=50`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          const subFolders = subResponse.data.value.map(folder => ({
            id: folder.id,
            name: folder.displayName,
            totalCount: folder.totalItemCount,
            unreadCount: folder.unreadItemCount,
            parentId: inbox.id
          }));
          
          allFolders = [...allFolders, ...subFolders];
        } catch (e) {
          // Ignorer si pas de sous-dossiers
        }
      }

      this.foldersCache = allFolders;
      return this.foldersCache;
    } catch (error) {
      console.error('❌ Erreur récupération dossiers:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Créer un dossier dans Inbox
   */
  async createFolder(folderName) {
    const accessToken = await this.ensureValidToken();

    try {
      // D'abord vérifier si le dossier existe déjà
      const folders = await this.getFolders();
      const existing = folders.find(f => f.name === folderName);
      
      if (existing) {
        console.log(`📁 Dossier "${folderName}" existe déjà`);
        return existing;
      }

      // Récupérer l'ID du dossier Inbox
      const inboxResponse = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/inbox`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      const inboxId = inboxResponse.data.id;

      // Créer le dossier comme sous-dossier de Inbox
      const response = await axios.post(
        `${this.graphBaseUrl}/me/mailFolders/${inboxId}/childFolders`,
        { displayName: folderName },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Dossier "${folderName}" créé`);
      
      // Mettre à jour le cache
      this.foldersCache = null;
      
      return {
        id: response.data.id,
        name: response.data.displayName
      };
    } catch (error) {
      console.error(`❌ Erreur création dossier "${folderName}":`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Créer un dossier personnalisé via WhatsApp
   * @param {string} folderName - Nom du dossier à créer
   */
  async createCustomFolder(folderName) {
    try {
      const accessToken = await this.ensureValidToken();
      if (!accessToken) {
        return { success: false, message: "❌ Non connecté à Outlook" };
      }

      // Vérifier si le dossier existe déjà
      const folders = await this.getFolders();
      const existing = folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
      
      if (existing) {
        return {
          success: false,
          message: `📁 Le dossier "${folderName}" existe déjà`
        };
      }

      // Récupérer l'ID du dossier Inbox
      const inboxResponse = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/inbox`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const inboxId = inboxResponse.data.id;

      // Créer le dossier comme sous-dossier de Inbox
      const response = await axios.post(
        `${this.graphBaseUrl}/me/mailFolders/${inboxId}/childFolders`,
        { displayName: folderName },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Dossier personnalisé "${folderName}" créé`);
      
      // Invalider le cache
      this.foldersCache = null;
      
      return {
        success: true,
        message: `✅ Dossier "${folderName}" créé avec succès dans Outlook`,
        folder: {
          id: response.data.id,
          name: response.data.displayName
        }
      };
    } catch (error) {
      console.error(`❌ Erreur création dossier:`, error.response?.data || error.message);
      return {
        success: false,
        message: `❌ Erreur: ${error.response?.data?.error?.message || error.message}`
      };
    }
  }

  /**
   * Supprimer un dossier (les emails sont déplacés vers Inbox d'abord)
   * @param {string} folderName - Nom du dossier à supprimer
   */
  async deleteFolder(folderName) {
    try {
      const accessToken = await this.ensureValidToken();
      if (!accessToken) {
        return { success: false, message: "❌ Non connecté à Outlook" };
      }

      // Trouver le dossier
      const folders = await this.getFolders();
      const folder = folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
      
      if (!folder) {
        return {
          success: false,
          message: `📁 Le dossier "${folderName}" n'existe pas`
        };
      }

      // Vérifier que ce n'est pas un dossier système
      const systemFolders = ['inbox', 'sent items', 'drafts', 'deleted items', 'junk email', 'archive', 'boîte de réception', 'éléments envoyés', 'brouillons', 'éléments supprimés', 'courrier indésirable'];
      if (systemFolders.includes(folderName.toLowerCase())) {
        return {
          success: false,
          message: `⚠️ Impossible de supprimer le dossier système "${folderName}"`
        };
      }

      // Récupérer l'ID de Inbox pour déplacer les emails
      const inboxResponse = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/inbox`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const inboxId = inboxResponse.data.id;

      // Récupérer tous les emails du dossier
      let emailsMoved = 0;
      try {
        const emailsResponse = await axios.get(
          `${this.graphBaseUrl}/me/mailFolders/${folder.id}/messages`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: { '$top': 500, '$select': 'id,subject' }
          }
        );

        const emails = emailsResponse.data.value || [];
        
        // Déplacer chaque email vers Inbox
        for (const email of emails) {
          try {
            await axios.post(
              `${this.graphBaseUrl}/me/messages/${email.id}/move`,
              { destinationId: inboxId },
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            emailsMoved++;
          } catch (moveError) {
            console.error(`Erreur déplacement email:`, moveError.message);
          }
        }
      } catch (fetchError) {
        console.log(`Pas d'emails dans le dossier ou erreur: ${fetchError.message}`);
      }

      // Supprimer le dossier
      await axios.delete(
        `${this.graphBaseUrl}/me/mailFolders/${folder.id}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      console.log(`🗑️ Dossier "${folderName}" supprimé, ${emailsMoved} emails déplacés vers Inbox`);
      
      // Invalider le cache
      this.foldersCache = null;
      
      const emailsMsg = emailsMoved > 0 
        ? `\n📧 ${emailsMoved} email(s) déplacé(s) vers la boîte de réception`
        : '';
      
      return {
        success: true,
        message: `🗑️ Dossier "${folderName}" supprimé${emailsMsg}`,
        emailsMoved
      };
    } catch (error) {
      console.error(`❌ Erreur suppression dossier:`, error.response?.data || error.message);
      return {
        success: false,
        message: `❌ Erreur: ${error.response?.data?.error?.message || error.message}`
      };
    }
  }

  /**
   * Lister tous les dossiers personnalisés (exclut les dossiers système)
   */
  async listCustomFolders() {
    try {
      const folders = await this.getFolders();
      const systemFolders = ['inbox', 'sent items', 'drafts', 'deleted items', 'junk email', 'archive', 'outbox', 'conversation history', 'boîte de réception', 'éléments envoyés', 'brouillons', 'éléments supprimés', 'courrier indésirable'];
      
      const customFolders = folders.filter(f => 
        !systemFolders.includes(f.name.toLowerCase())
      );
      
      return {
        success: true,
        folders: customFolders
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`,
        folders: []
      };
    }
  }

  /**
   * Initialiser tous les dossiers de classification
   */
  async initializeClassificationFolders() {
    console.log('📁 Initialisation des dossiers de classification...');
    
    const results = [];
    for (const [key, folderName] of Object.entries(CLASSIFICATION_FOLDERS)) {
      try {
        const folder = await this.createFolder(folderName);
        results.push({ key, name: folderName, id: folder.id, status: 'ok' });
      } catch (error) {
        results.push({ key, name: folderName, status: 'error', error: error.message });
      }
    }
    
    console.log('✅ Dossiers initialisés:', results.filter(r => r.status === 'ok').length, '/', results.length);
    return results;
  }

  /**
   * Récupérer l'ID d'un dossier par son nom
   */
  async getFolderIdByName(folderName) {
    if (!this.foldersCache) {
      await this.getFolders();
    }
    
    // Chercher dans les dossiers racine
    let folder = this.foldersCache.find(f => f.name.toLowerCase() === folderName.toLowerCase());
    
    if (folder) return folder.id;
    
    // Chercher dans les sous-dossiers de Inbox
    const accessToken = await this.ensureValidToken();
    try {
      const response = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/inbox/childFolders`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      
      folder = response.data.value.find(f => 
        f.displayName.toLowerCase() === folderName.toLowerCase()
      );
      
      return folder ? folder.id : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Déplacer un email vers un dossier
   * @param {string} emailId - ID de l'email
   * @param {string} destinationFolderId - ID du dossier destination
   * @param {string} sourceFolderId - ID du dossier source (optionnel, pour emails dans sous-dossiers)
   */
  async moveEmailToFolder(emailId, destinationFolderId, sourceFolderId = null) {
    const accessToken = await this.ensureValidToken();

    try {
      // Si l'email est dans un sous-dossier, utiliser l'endpoint spécifique
      let endpoint;
      if (sourceFolderId) {
        endpoint = `${this.graphBaseUrl}/me/mailFolders/${sourceFolderId}/messages/${emailId}/move`;
      } else {
        endpoint = `${this.graphBaseUrl}/me/messages/${emailId}/move`;
      }
      
      const response = await axios.post(
        endpoint,
        { destinationId: destinationFolderId },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Erreur déplacement email:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Classifier un email et le déplacer
   */
  async classifyAndMoveEmail(email, category) {
    // Mapper la catégorie au nom du dossier
    let folderName;
    
    // Vérifier les catégories prédéfinies
    if (CLASSIFICATION_FOLDERS[category.toLowerCase()]) {
      folderName = CLASSIFICATION_FOLDERS[category.toLowerCase()];
    } else if (category.toLowerCase() === 'iscod' || category.toLowerCase() === 'école' || category.toLowerCase() === 'ecole') {
      folderName = 'ISCOD';
    } else {
      // Catégorie par défaut
      folderName = CLASSIFICATION_FOLDERS['newsletter'];
    }

    const folderId = await this.getFolderIdByName(folderName);
    
    if (!folderId) {
      console.log(`⚠️ Dossier "${folderName}" non trouvé, email non déplacé`);
      return { moved: false, reason: 'Dossier non trouvé' };
    }

    await this.moveEmailToFolder(email.id, folderId);
    
    // Sauvegarder en mémoire
    const classificationRecord = {
      emailId: email.id,
      subject: email.subject,
      from: email.from,
      category: category,
      folder: folderName,
      classifiedAt: new Date().toISOString()
    };
    
    this.classificationMemory.unshift(classificationRecord);
    
    // Garder max 100 classifications en mémoire
    if (this.classificationMemory.length > 100) {
      this.classificationMemory = this.classificationMemory.slice(0, 100);
    }

    return { moved: true, folder: folderName, record: classificationRecord };
  }

  /**
   * Récupérer la mémoire des classifications
   */
  getClassificationMemory(limit = 50) {
    return this.classificationMemory.slice(0, limit);
  }

  /**
   * Générer un résumé des classifications récentes
   */
  getClassificationSummary() {
    if (this.classificationMemory.length === 0) {
      return "Aucune classification récente.";
    }

    // Grouper par dossier
    const byFolder = {};
    for (const record of this.classificationMemory) {
      if (!byFolder[record.folder]) {
        byFolder[record.folder] = [];
      }
      byFolder[record.folder].push(record);
    }

    let summary = `📊 **Résumé des ${this.classificationMemory.length} dernières classifications:**\n\n`;
    
    for (const [folder, emails] of Object.entries(byFolder)) {
      summary += `📁 **${folder}** (${emails.length} emails)\n`;
      // Montrer les 3 derniers de chaque catégorie
      for (const email of emails.slice(0, 3)) {
        summary += `   • ${email.subject.substring(0, 40)}... (de ${email.from})\n`;
      }
      summary += '\n';
    }

    return summary;
  }

  /**
   * Récupérer les emails d'un dossier spécifique par son nom
   * @param {string} folderName - Nom du dossier
   * @param {number} count - Nombre d'emails max
   */
  async getEmailsFromFolder(folderName, count = 50) {
    const accessToken = await this.ensureValidToken();
    
    try {
      const folderId = await this.getFolderIdByName(folderName);
      
      if (!folderId) {
        console.log(`⚠️ Dossier "${folderName}" non trouvé`);
        return [];
      }
      
      const response = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/${folderId}/messages`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          params: {
            '$top': count,
            '$select': 'id,subject,bodyPreview,from,receivedDateTime,importance,isRead',
            '$orderby': 'receivedDateTime desc'
          }
        }
      );
      
      const emails = (response.data.value || []).map(email => ({
        ...email,
        currentFolder: folderName,
        currentFolderId: folderId
      }));
      
      console.log(`📧 ${emails.length} emails récupérés du dossier "${folderName}"`);
      return emails;
      
    } catch (error) {
      console.error(`❌ Erreur getEmailsFromFolder(${folderName}):`, error.message);
      return [];
    }
  }

  /**
   * Récupérer les emails de TOUS les dossiers de classification (pour re-analyse)
   * @param {number} countPerFolder - Nombre d'emails max par dossier
   */
  async getEmailsFromAllFolders(countPerFolder = 50) {
    const accessToken = await this.ensureValidToken();
    const allEmails = [];
    
    try {
      // Récupérer les sous-dossiers de Inbox
      const childFoldersResponse = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/inbox/childFolders`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          params: { '$top': 50 }
        }
      );
      
      const classificationFolders = childFoldersResponse.data.value || [];
      
      console.log(`📁 ${classificationFolders.length} dossiers de classification trouvés`);
      
      // Pour chaque dossier, récupérer les emails
      for (const folder of classificationFolders) {
        try {
          const emailsResponse = await axios.get(
            `${this.graphBaseUrl}/me/mailFolders/${folder.id}/messages`,
            {
              headers: { 'Authorization': `Bearer ${accessToken}` },
              params: {
                '$top': countPerFolder,
                '$select': 'id,subject,bodyPreview,from,receivedDateTime,importance,isRead',
                '$orderby': 'receivedDateTime desc'
              }
            }
          );
          
          const folderEmails = (emailsResponse.data.value || []).map(email => ({
            ...email,
            currentFolder: folder.displayName,
            currentFolderId: folder.id
          }));
          
          allEmails.push(...folderEmails);
          console.log(`  📧 ${folderEmails.length} emails dans "${folder.displayName}"`);
        } catch (folderError) {
          console.error(`  ⚠️ Erreur lecture dossier "${folder.displayName}":`, folderError.message);
        }
      }
      
      // Aussi récupérer les emails de Inbox (non classés)
      try {
        const inboxEmails = await this.getEmails(countPerFolder);
        const inboxWithFolder = inboxEmails.map(email => ({
          ...email,
          currentFolder: 'Inbox',
          currentFolderId: null
        }));
        allEmails.push(...inboxWithFolder);
        console.log(`  📧 ${inboxEmails.length} emails dans "Inbox"`);
      } catch (inboxError) {
        console.error('  ⚠️ Erreur lecture Inbox:', inboxError.message);
      }
      
      console.log(`📬 Total: ${allEmails.length} emails récupérés de tous les dossiers`);
      return allEmails;
      
    } catch (error) {
      console.error('❌ Erreur getEmailsFromAllFolders:', error.message);
      throw error;
    }
  }

  /**
   * Classifier plusieurs emails avec l'IA
   */
  async classifyEmails(count = 50) {
    const openaiService = require('./openai.service');
    
    console.log(`📂 Classification de ${count} emails...`);
    
    // Recharger les règles depuis Supabase pour avoir la dernière version
    await openaiService.initFromSupabase();
    console.log(`📋 Règles rechargées: ${openaiService.customClassificationRules?.length || 0} règles actives`);
    
    // Récupérer les emails
    const emails = await this.getEmails(count);
    
    if (emails.length === 0) {
      return {
        success: true,
        message: "Aucun email à classifier",
        results: [],
        summary: { total: 0, success: 0, failed: 0, byFolder: {} }
      };
    }

    const results = [];
    const byFolder = {};

    for (const email of emails) {
      try {
        // Demander à l'IA de classifier l'email
        const classification = await openaiService.classifyEmailForFolder(email);
        
        // Déplacer l'email
        const moveResult = await this.classifyAndMoveEmail(email, classification.category);
        
        if (moveResult.moved) {
          // Comptabiliser par dossier
          if (!byFolder[moveResult.folder]) {
            byFolder[moveResult.folder] = 0;
          }
          byFolder[moveResult.folder]++;
          
          results.push({
            success: true,
            emailId: email.id,
            subject: email.subject,
            from: email.from,
            folder: moveResult.folder,
            category: classification.category
          });
        } else {
          results.push({
            success: false,
            emailId: email.id,
            subject: email.subject,
            reason: moveResult.reason
          });
        }
      } catch (error) {
        console.error(`❌ Erreur classification email "${email.subject}":`, error.message);
        results.push({
          success: false,
          emailId: email.id,
          subject: email.subject,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`✅ Classification terminée: ${successCount} succès, ${failedCount} échecs`);

    return {
      success: true,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failedCount,
        byFolder
      }
    };
  }

  // ==================== EMAILS ====================

  /**
   * Récupérer les emails les plus récents de TOUS les dossiers
   * Inclut: Inbox, sous-dossiers, Courrier indésirable, et dossiers racine personnalisés
   * Triés par date de réception (du plus récent au plus ancien)
   * @param {number} count - Nombre total d'emails à retourner
   */
  async getAllRecentEmails(count = 50) {
    const accessToken = await this.ensureValidToken();
    const allEmails = [];
    const foldersScanned = [];
    
    try {
      // 1. Récupérer les emails de l'Inbox principal
      const inboxResponse = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/inbox/messages`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          params: {
            '$top': count,
            '$select': 'id,subject,from,receivedDateTime,bodyPreview,isRead,importance',
            '$orderby': 'receivedDateTime desc'
          }
        }
      );
      
      const inboxEmails = (inboxResponse.data.value || []).map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from?.emailAddress?.address || 'Inconnu',
        fromName: email.from?.emailAddress?.name || 'Inconnu',
        receivedAt: email.receivedDateTime,
        preview: email.bodyPreview,
        isRead: email.isRead,
        importance: email.importance,
        folder: '📥 Inbox'
      }));
      allEmails.push(...inboxEmails);
      if (inboxEmails.length > 0) foldersScanned.push('📥 Inbox');
      
      // 2. Récupérer les sous-dossiers de Inbox (dossiers de classification)
      const childFoldersResponse = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/inbox/childFolders`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          params: { '$top': 50 }
        }
      );
      
      const classificationFolders = childFoldersResponse.data.value || [];
      
      // 3. Pour chaque sous-dossier de Inbox, récupérer les emails récents
      for (const folder of classificationFolders) {
        try {
          const folderResponse = await axios.get(
            `${this.graphBaseUrl}/me/mailFolders/${folder.id}/messages`,
            {
              headers: { 'Authorization': `Bearer ${accessToken}` },
              params: {
                '$top': Math.ceil(count / 3),
                '$select': 'id,subject,from,receivedDateTime,bodyPreview,isRead,importance',
                '$orderby': 'receivedDateTime desc'
              }
            }
          );
          
          const folderEmails = (folderResponse.data.value || []).map(email => ({
            id: email.id,
            subject: email.subject,
            from: email.from?.emailAddress?.address || 'Inconnu',
            fromName: email.from?.emailAddress?.name || 'Inconnu',
            receivedAt: email.receivedDateTime,
            preview: email.bodyPreview,
            isRead: email.isRead,
            importance: email.importance,
            folder: folder.displayName
          }));
          allEmails.push(...folderEmails);
          if (folderEmails.length > 0) foldersScanned.push(folder.displayName);
        } catch (folderError) {
          // Ignorer les erreurs de dossiers individuels
        }
      }
      
      // 4. Récupérer le Courrier indésirable (Junk Email)
      try {
        const junkResponse = await axios.get(
          `${this.graphBaseUrl}/me/mailFolders/junkemail/messages`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: {
              '$top': Math.ceil(count / 4),
              '$select': 'id,subject,from,receivedDateTime,bodyPreview,isRead,importance',
              '$orderby': 'receivedDateTime desc'
            }
          }
        );
        
        const junkEmails = (junkResponse.data.value || []).map(email => ({
          id: email.id,
          subject: email.subject,
          from: email.from?.emailAddress?.address || 'Inconnu',
          fromName: email.from?.emailAddress?.name || 'Inconnu',
          receivedAt: email.receivedDateTime,
          preview: email.bodyPreview,
          isRead: email.isRead,
          importance: email.importance,
          folder: '🚫 Courrier indésirable'
        }));
        allEmails.push(...junkEmails);
        if (junkEmails.length > 0) foldersScanned.push('🚫 Courrier indésirable');
      } catch (junkError) {
        console.log('⚠️ Impossible de lire le courrier indésirable');
      }
      
      // 5. Récupérer les dossiers racine personnalisés (comme ISCOD)
      try {
        const rootFoldersResponse = await axios.get(
          `${this.graphBaseUrl}/me/mailFolders`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: { '$top': 50 }
          }
        );
        
        const rootFolders = rootFoldersResponse.data.value || [];
        // Exclure les dossiers système standard
        const systemFolders = ['inbox', 'drafts', 'sentitems', 'deleteditems', 'junkemail', 'outbox', 'archive', 'conversationhistory', 'scheduled'];
        
        for (const folder of rootFolders) {
          // Ignorer les dossiers système (vérifier par wellKnownName ou displayName)
          const isSystem = systemFolders.some(sf => 
            folder.displayName?.toLowerCase() === sf ||
            folder.displayName?.toLowerCase() === 'boîte de réception' ||
            folder.displayName?.toLowerCase() === 'éléments envoyés' ||
            folder.displayName?.toLowerCase() === 'éléments supprimés' ||
            folder.displayName?.toLowerCase() === 'brouillons' ||
            folder.displayName?.toLowerCase() === 'courrier indésirable'
          );
          
          if (!isSystem) {
            try {
              const customFolderResponse = await axios.get(
                `${this.graphBaseUrl}/me/mailFolders/${folder.id}/messages`,
                {
                  headers: { 'Authorization': `Bearer ${accessToken}` },
                  params: {
                    '$top': Math.ceil(count / 3),
                    '$select': 'id,subject,from,receivedDateTime,bodyPreview,isRead,importance',
                    '$orderby': 'receivedDateTime desc'
                  }
                }
              );
              
              const customEmails = (customFolderResponse.data.value || []).map(email => ({
                id: email.id,
                subject: email.subject,
                from: email.from?.emailAddress?.address || 'Inconnu',
                fromName: email.from?.emailAddress?.name || 'Inconnu',
                receivedAt: email.receivedDateTime,
                preview: email.bodyPreview,
                isRead: email.isRead,
                importance: email.importance,
                folder: `📁 ${folder.displayName}`
              }));
              allEmails.push(...customEmails);
              if (customEmails.length > 0) foldersScanned.push(`📁 ${folder.displayName}`);
            } catch (customError) {
              // Ignorer les erreurs
            }
          }
        }
      } catch (rootError) {
        console.log('⚠️ Impossible de lire les dossiers racine');
      }
      
      // 6. Trier TOUS les emails par date (du plus récent au plus ancien)
      allEmails.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
      
      // 7. Retourner seulement le nombre demandé
      const result = allEmails.slice(0, count);
      console.log(`📬 getAllRecentEmails: ${result.length} emails de ${foldersScanned.length} dossiers: ${foldersScanned.join(', ')}`);
      
      // Ajouter les infos de dossiers scannés au résultat
      result.foldersScanned = foldersScanned;
      
      return result;
      
    } catch (error) {
      console.error('❌ Erreur getAllRecentEmails:', error.response?.data || error.message);
      // Fallback: retourner juste l'Inbox
      return this.getEmails(count);
    }
  }

  /**
   * Récupérer les derniers emails (INBOX uniquement - ancienne méthode)
   */
  async getEmails(count = 50) {
    const accessToken = await this.ensureValidToken();

    try {
      const response = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/inbox/messages?$top=${count}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,importance`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.value.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from?.emailAddress?.address || 'Inconnu',
        fromName: email.from?.emailAddress?.name || 'Inconnu',
        receivedAt: email.receivedDateTime,
        preview: email.bodyPreview,
        isRead: email.isRead,
        importance: email.importance
      }));
    } catch (error) {
      console.error('❌ Erreur récupération emails:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Récupérer les emails non lus
   */
  async getUnreadEmails(count = 20) {
    const accessToken = await this.ensureValidToken();

    try {
      const response = await axios.get(
        `${this.graphBaseUrl}/me/mailFolders/inbox/messages?$filter=isRead eq false&$top=${count}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,importance`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.value.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from?.emailAddress?.address || 'Inconnu',
        fromName: email.from?.emailAddress?.name || 'Inconnu',
        receivedAt: email.receivedDateTime,
        preview: email.bodyPreview,
        importance: email.importance
      }));
    } catch (error) {
      console.error('❌ Erreur récupération emails non lus:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Récupérer le contenu complet d'un email
   */
  async getEmailContent(emailId) {
    const accessToken = await this.ensureValidToken();

    try {
      const response = await axios.get(
        `${this.graphBaseUrl}/me/messages/${emailId}?$select=id,subject,from,receivedDateTime,body,importance`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: response.data.id,
        subject: response.data.subject,
        from: response.data.from?.emailAddress?.address,
        fromName: response.data.from?.emailAddress?.name,
        receivedAt: response.data.receivedDateTime,
        body: response.data.body?.content,
        importance: response.data.importance
      };
    } catch (error) {
      console.error('❌ Erreur récupération contenu email:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Envoyer un email
   */
  async sendEmail(to, subject, body) {
    const accessToken = await this.ensureValidToken();

    try {
      // Convertir le texte brut en HTML propre
      const htmlBody = this.formatBodyAsHtml(body);
      
      await axios.post(
        `${this.graphBaseUrl}/me/sendMail`,
        {
          message: {
            subject: subject,
            body: {
              contentType: 'HTML',
              content: htmlBody
            },
            toRecipients: [
              {
                emailAddress: {
                  address: to
                }
              }
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Email envoyé à:', to);
      return true;
    } catch (error) {
      console.error('❌ Erreur envoi email:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Convertir le texte brut en HTML formaté
   * @param {string} text - Texte brut avec retours à la ligne
   * @returns {string} - HTML formaté
   */
  formatBodyAsHtml(text) {
    if (!text) return '';
    
    // Échapper les caractères HTML spéciaux
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Convertir les doubles retours à la ligne en paragraphes
    // et les simples retours en <br>
    const paragraphs = html.split(/\n\n+/);
    
    html = paragraphs
      .map(p => {
        // Remplacer les retours simples par <br>
        const lines = p.split('\n').join('<br>\n');
        return `<p style="margin: 0 0 10px 0;">${lines}</p>`;
      })
      .join('\n');
    
    // Envelopper dans un conteneur avec style
    return `
      <div style="font-family: Calibri, Arial, sans-serif; font-size: 14px; color: #333;">
        ${html}
      </div>
    `;
  }

  /**
   * Vérifier si connecté
   */
  isConnected() {
    return this.tokens !== null;
  }

  /**
   * Obtenir les infos utilisateur
   */
  async getUserInfo() {
    const accessToken = await this.ensureValidToken();

    try {
      const response = await axios.get(
        `${this.graphBaseUrl}/me`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return {
        name: response.data.displayName,
        email: response.data.mail || response.data.userPrincipalName
      };
    } catch (error) {
      console.error('❌ Erreur récupération infos utilisateur:', error);
      throw error;
    }
  }

  // ==================== RECHERCHE INTELLIGENTE ====================

  /**
   * Rechercher des emails avec des critères
   * @param {Object} criteria - Critères de recherche
   * @param {string} criteria.query - Texte à rechercher (sujet, corps, expéditeur)
   * @param {string} criteria.from - Filtrer par expéditeur
   * @param {string} criteria.subject - Filtrer par sujet
   * @param {Date} criteria.after - Emails après cette date
   * @param {Date} criteria.before - Emails avant cette date
   * @param {number} criteria.limit - Nombre max de résultats (défaut: 20)
   */
  async searchEmails(criteria = {}) {
    const accessToken = await this.ensureValidToken();
    
    try {
      let filterParts = [];
      let searchQuery = '';
      
      // Construire le filtre OData
      if (criteria.from) {
        filterParts.push(`from/emailAddress/address eq '${criteria.from}' or contains(from/emailAddress/name, '${criteria.from}')`);
      }
      
      if (criteria.after) {
        const afterDate = new Date(criteria.after).toISOString();
        filterParts.push(`receivedDateTime ge ${afterDate}`);
      }
      
      if (criteria.before) {
        const beforeDate = new Date(criteria.before).toISOString();
        filterParts.push(`receivedDateTime le ${beforeDate}`);
      }
      
      // Construire l'URL avec $search pour la recherche full-text
      let url = `${this.graphBaseUrl}/me/messages?$top=${criteria.limit || 20}&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,importance,flag`;
      
      // Utiliser $search pour la recherche dans le contenu
      if (criteria.query) {
        // Microsoft Graph utilise KQL pour la recherche
        searchQuery = `"${criteria.query}"`;
        url += `&$search="${encodeURIComponent(criteria.query)}"`;
      }
      
      // Ajouter le filtre si présent
      if (filterParts.length > 0 && !criteria.query) {
        url += `&$filter=${encodeURIComponent(filterParts.join(' and '))}`;
      }
      
      console.log('🔍 Recherche emails:', criteria);
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'ConsistencyLevel': 'eventual' // Requis pour $search
        }
      });
      
      let emails = response.data.value || [];
      
      // Filtrage supplémentaire côté client si nécessaire
      if (criteria.from && criteria.query) {
        const fromLower = criteria.from.toLowerCase();
        emails = emails.filter(e => 
          (e.from?.emailAddress?.address || '').toLowerCase().includes(fromLower) ||
          (e.from?.emailAddress?.name || '').toLowerCase().includes(fromLower)
        );
      }
      
      if (criteria.subject) {
        const subjectLower = criteria.subject.toLowerCase();
        emails = emails.filter(e => 
          (e.subject || '').toLowerCase().includes(subjectLower)
        );
      }
      
      return emails.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from?.emailAddress?.address || 'Inconnu',
        fromName: email.from?.emailAddress?.name || 'Inconnu',
        receivedAt: email.receivedDateTime,
        preview: email.bodyPreview,
        isRead: email.isRead,
        importance: email.importance,
        isFlagged: email.flag?.flagStatus === 'flagged'
      }));
      
    } catch (error) {
      console.error('❌ Erreur recherche emails:', error.response?.data || error.message);
      throw error;
    }
  }

  // ==================== RECHERCHE DE CONTACTS ====================

  /**
   * Rechercher des contacts/expéditeurs par nom
   * Cherche dans TOUS les dossiers (200 derniers emails) pour trouver les adresses correspondant à un nom
   * @param {string} name - Nom à rechercher
   */
  async searchContactsByName(name) {
    const accessToken = await this.ensureValidToken();
    
    try {
      const nameLower = name.toLowerCase();
      const contactsMap = new Map(); // email -> {name, email, count, lastSeen}
      
      // Fonction pour vérifier si c'est une vraie adresse email
      const isValidEmail = (email) => {
        if (!email) return false;
        // Filtrer les adresses Exchange internes et autres formats invalides
        if (email.startsWith('/o=') || email.startsWith('/ou=')) return false;
        if (!email.includes('@')) return false;
        if (email.includes('/cn=')) return false;
        return true;
      };

      // Fonction pour ajouter un contact à la map
      const addContact = (emailAddr, contactName, date, source = 'received') => {
        if (!isValidEmail(emailAddr)) return;
        const emailLower = emailAddr.toLowerCase();
        const nameLowerContact = contactName.toLowerCase();
        
        // Vérifier si le nom correspond
        if (nameLowerContact.includes(nameLower) || emailLower.includes(nameLower)) {
          if (!contactsMap.has(emailLower)) {
            contactsMap.set(emailLower, {
              name: contactName,
              email: emailLower,
              count: 1,
              lastSeen: date,
              source
            });
          } else {
            contactsMap.get(emailLower).count++;
            // Mettre à jour si plus récent
            if (date && new Date(date) > new Date(contactsMap.get(emailLower).lastSeen)) {
              contactsMap.get(emailLower).lastSeen = date;
            }
          }
        }
      };
      
      // 1. Chercher dans TOUS les emails (tous dossiers) - 200 derniers
      console.log(`🔍 Recherche contacts "${name}" dans tous les dossiers...`);
      
      const allEmailsResponse = await axios.get(
        `${this.graphBaseUrl}/me/messages?$top=200&$select=from,toRecipients,ccRecipients,receivedDateTime&$orderby=receivedDateTime desc`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      const allEmails = allEmailsResponse.data.value || [];
      console.log(`   📧 ${allEmails.length} emails analysés (tous dossiers)`);
      
      for (const email of allEmails) {
        // Expéditeur
        if (email.from?.emailAddress) {
          addContact(
            email.from.emailAddress.address || '',
            email.from.emailAddress.name || '',
            email.receivedDateTime,
            'received'
          );
        }
        
        // Destinataires (pour les emails que j'ai envoyés)
        const allRecipients = [...(email.toRecipients || []), ...(email.ccRecipients || [])];
        for (const recipient of allRecipients) {
          if (recipient.emailAddress) {
            addContact(
              recipient.emailAddress.address || '',
              recipient.emailAddress.name || '',
              email.receivedDateTime,
              'sent'
            );
          }
        }
      }
      
      // 2. Chercher aussi spécifiquement dans les emails envoyés (200 derniers)
      try {
        const sentResponse = await axios.get(
          `${this.graphBaseUrl}/me/mailFolders/sentitems/messages?$top=200&$select=toRecipients,ccRecipients,receivedDateTime&$orderby=receivedDateTime desc`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        const sentEmails = sentResponse.data.value || [];
        console.log(`   📤 ${sentEmails.length} emails envoyés analysés`);
        
        for (const email of sentEmails) {
          const allRecipients = [...(email.toRecipients || []), ...(email.ccRecipients || [])];
          for (const recipient of allRecipients) {
            if (recipient.emailAddress) {
              addContact(
                recipient.emailAddress.address || '',
                recipient.emailAddress.name || '',
                email.receivedDateTime,
                'sent'
              );
            }
          }
        }
      } catch (sentError) {
        console.log('   ⚠️ Impossible de lire les emails envoyés');
      }
      
      // 3. Convertir en array et trier par fréquence
      const contacts = Array.from(contactsMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Max 10 contacts
      
      console.log(`✅ Recherche contacts "${name}": ${contacts.length} trouvés sur ${allEmails.length}+ emails`);
      
      return contacts;
      
    } catch (error) {
      console.error('❌ Erreur searchContactsByName:', error.response?.data || error.message);
      return [];
    }
  }

  // ==================== SUPPRESSION EN MASSE ====================

  /**
   * Supprimer des emails selon des critères
   * @param {Object} criteria - Critères de sélection
   * @param {string} criteria.folder - Nom du dossier à vider
   * @param {string} criteria.from - Supprimer les emails de cet expéditeur
   * @param {number} criteria.olderThanDays - Supprimer les emails plus vieux que X jours
   * @param {number} criteria.limit - Nombre max d'emails à supprimer
   */
  async deleteEmails(criteria = {}) {
    const accessToken = await this.ensureValidToken();
    
    try {
      let emailsToDelete = [];
      
      // Si un dossier est spécifié
      if (criteria.folder) {
        const folderId = await this.getFolderIdByName(criteria.folder);
        if (!folderId) {
          return { success: false, message: `Dossier "${criteria.folder}" non trouvé`, deleted: 0 };
        }
        
        const response = await axios.get(
          `${this.graphBaseUrl}/me/mailFolders/${folderId}/messages?$top=${criteria.limit || 100}&$select=id,subject,from,receivedDateTime`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        emailsToDelete = response.data.value || [];
      } else {
        // Recherche dans tous les emails
        emailsToDelete = await this.searchEmails({
          query: criteria.from || criteria.query,
          limit: criteria.limit || 100
        });
      }
      
      // Filtrer par âge si spécifié
      if (criteria.olderThanDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - criteria.olderThanDays);
        
        emailsToDelete = emailsToDelete.filter(e => {
          const emailDate = new Date(e.receivedAt || e.receivedDateTime);
          return emailDate < cutoffDate;
        });
      }
      
      // Filtrer par expéditeur si spécifié (en plus du dossier)
      if (criteria.from && criteria.folder) {
        const fromLower = criteria.from.toLowerCase();
        emailsToDelete = emailsToDelete.filter(e => {
          const emailFrom = (e.from?.emailAddress?.address || e.from || '').toLowerCase();
          const emailFromName = (e.from?.emailAddress?.name || e.fromName || '').toLowerCase();
          return emailFrom.includes(fromLower) || emailFromName.includes(fromLower);
        });
      }
      
      if (emailsToDelete.length === 0) {
        return { success: true, message: 'Aucun email correspondant aux critères', deleted: 0 };
      }
      
      // Supprimer les emails (déplacer vers Deleted Items)
      let deletedCount = 0;
      for (const email of emailsToDelete) {
        try {
          await axios.delete(
            `${this.graphBaseUrl}/me/messages/${email.id}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          deletedCount++;
        } catch (err) {
          console.error(`Erreur suppression email ${email.id}:`, err.message);
        }
      }
      
      console.log(`🗑️ ${deletedCount} emails supprimés`);
      
      return {
        success: true,
        deleted: deletedCount,
        total: emailsToDelete.length,
        message: `${deletedCount} email(s) supprimé(s)`
      };
      
    } catch (error) {
      console.error('❌ Erreur suppression emails:', error.response?.data || error.message);
      return { success: false, message: error.message, deleted: 0 };
    }
  }

  // ==================== FLAG / MARQUER POUR SUIVI ====================

  /**
   * Supprimer un email unique
   * @param {string} emailId - ID de l'email à supprimer
   */
  async deleteEmail(emailId) {
    const accessToken = await this.ensureValidToken();
    
    try {
      await axios.delete(
        `${this.graphBaseUrl}/me/messages/${emailId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      return true;
    } catch (error) {
      console.error(`❌ Erreur suppression email ${emailId}:`, error.message);
      throw error;
    }
  }

  /**
   * Marquer un email pour suivi (flag)
   * @param {string} emailId - ID de l'email
   * @param {boolean} flagged - true pour flag, false pour unflag
   */
  async flagEmail(emailId, flagged = true) {
    const accessToken = await this.ensureValidToken();
    
    try {
      await axios.patch(
        `${this.graphBaseUrl}/me/messages/${emailId}`,
        {
          flag: {
            flagStatus: flagged ? 'flagged' : 'notFlagged'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`🚩 Email ${flagged ? 'flaggé' : 'unflaggé'}`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erreur flag email:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Marquer un email comme lu ou non lu
   * @param {string} emailId - ID de l'email
   * @param {boolean} isRead - true pour lu, false pour non lu
   */
  async markAsRead(emailId, isRead = true) {
    const accessToken = await this.ensureValidToken();
    
    try {
      await axios.patch(
        `${this.graphBaseUrl}/me/messages/${emailId}`,
        { isRead: isRead },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`📧 Email marqué comme ${isRead ? 'lu' : 'non lu'}`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Erreur mark as read:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Récupérer le contenu complet d'un email par son ID
   * @param {string} emailId 
   */
  async getEmailById(emailId) {
    const accessToken = await this.ensureValidToken();
    
    try {
      const response = await axios.get(
        `${this.graphBaseUrl}/me/messages/${emailId}?$select=id,subject,from,toRecipients,receivedDateTime,body,bodyPreview,importance,isRead,flag`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );
      
      const email = response.data;
      
      return {
        id: email.id,
        subject: email.subject,
        from: email.from?.emailAddress?.address,
        fromName: email.from?.emailAddress?.name,
        to: email.toRecipients?.map(r => r.emailAddress?.address).join(', '),
        receivedAt: email.receivedDateTime,
        body: email.body?.content,
        bodyType: email.body?.contentType,
        preview: email.bodyPreview,
        importance: email.importance,
        isRead: email.isRead,
        isFlagged: email.flag?.flagStatus === 'flagged'
      };
      
    } catch (error) {
      console.error('❌ Erreur get email by ID:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new OutlookService();
