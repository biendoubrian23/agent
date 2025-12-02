const openaiService = require('../services/openai.service');
const outlookService = require('../services/outlook.service');
const statsService = require('../services/stats.service');
const draftService = require('../services/draft.service');
const reminderService = require('../services/reminder.service');

// URL de connexion Outlook (Railway production)
const OUTLOOK_AUTH_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/auth/outlook`
  : 'https://agent-production-c8ea.up.railway.app/auth/outlook';

/**
 * Agent Mail (James) - Gère les emails Outlook
 */
class MailAgent {
  constructor() {
    this.name = 'James';
    this.role = 'Mail Assistant';
    
    // Cache du dernier email trouvé (pour "réponds au dernier mail de X")
    this.lastSearchResults = new Map(); // phoneNumber -> emails[]
    
    // Cache pour les recherches de destinataires en attente (pour "envoie un mail à Brian")
    this.pendingRecipientSearch = new Map(); // phoneNumber -> { name, matches, originalRequest, timestamp }
  }

  /**
   * Message d'erreur quand Outlook n'est pas connecté
   */
  getNotConnectedMessage() {
    return `❌ Outlook n'est pas connecté.\n\n🔗 Connectez-vous ici:\n${OUTLOOK_AUTH_URL}`;
  }

  /**
   * Filtrer les emails selon un critère temporel ou d'importance
   * Supporte: today, yesterday, week, month, Xdays (ex: "7days", "30days")
   */
  filterEmails(emails, filter, fromFilter = null) {
    let filteredEmails = emails;
    
    // Filtrer par expéditeur si spécifié
    if (fromFilter) {
      const fromLower = fromFilter.toLowerCase().trim();
      filteredEmails = filteredEmails.filter(e => {
        // Vérifier tous les champs possibles de l'expéditeur
        const emailFrom = (e.from || '').toLowerCase();
        const emailFromName = (e.fromName || '').toLowerCase();
        const emailFromAddress = (e.fromAddress || '').toLowerCase();
        const emailSubject = (e.subject || '').toLowerCase();
        
        // Chercher le pattern dans n'importe quel champ
        // Supporte les noms composés comme "Adrian | JS Mastery"
        const allFields = `${emailFrom} ${emailFromName} ${emailFromAddress}`;
        
        // Match si le pattern est trouvé dans l'expéditeur (from/fromName/fromAddress)
        const matchesFrom = allFields.includes(fromLower);
        
        // OU si c'est mentionné dans le sujet (pour les newsletters nommées)
        const matchesSubject = emailSubject.includes(fromLower);
        
        return matchesFrom || matchesSubject;
      });
      
      console.log(`📧 Filtre expéditeur "${fromFilter}": ${filteredEmails.length}/${emails.length} emails matchés`);
    }

    if (!filter) return filteredEmails;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Supporter les filtres "Xdays" (ex: "7days", "30days", "14days")
    const daysMatch = filter.match(/^(\d+)days?$/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      const daysAgo = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
      return filteredEmails.filter(e => new Date(e.receivedDateTime || e.receivedAt) >= daysAgo);
    }

    switch (filter) {
      case 'today':
        return filteredEmails.filter(e => new Date(e.receivedDateTime || e.receivedAt) >= today);
      
      case 'yesterday':
        return filteredEmails.filter(e => {
          const date = new Date(e.receivedDateTime || e.receivedAt);
          return date >= yesterday && date < today;
        });
      
      case 'week':
        return filteredEmails.filter(e => new Date(e.receivedDateTime || e.receivedAt) >= weekAgo);
      
      case 'month':
        return filteredEmails.filter(e => new Date(e.receivedDateTime || e.receivedAt) >= monthAgo);
      
      case 'important':
      case 'urgent':
        return filteredEmails.filter(e => 
          e.importance === 'high' || 
          e.subject?.toLowerCase().includes('urgent') ||
          e.subject?.toLowerCase().includes('important') ||
          e.flag?.flagStatus === 'flagged'
        );
      
      default:
        return filteredEmails;
    }
  }

  /**
   * Récupérer et résumer les emails avec filtres avancés
   * @param {Object} options - Options de filtrage
   * @param {number} options.count - Nombre d'emails à récupérer (exact)
   * @param {string} options.filter - Filtre temporel (today, yesterday, week, month, Xdays)
   * @param {string} options.from - Filtrer par expéditeur (nom ou email)
   * @param {boolean} options.allFolders - Récupérer depuis tous les dossiers
   */
  async getFilteredEmailSummary(options = {}) {
    const { count = 10, filter = null, from = null, allFolders = true } = options;
    
    try {
      if (!outlookService.isConnected()) {
        statsService.logConnectionCheck('outlook', false);
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      statsService.logConnectionCheck('outlook', true);
      
      // Récupérer plus d'emails pour pouvoir filtrer ensuite
      const fetchCount = (filter || from) ? Math.max(count * 5, 200) : count;
      
      // Récupérer depuis TOUS les dossiers par défaut
      let emails;
      let foldersScanned = [];
      
      if (allFolders) {
        const result = await outlookService.getAllRecentEmails(fetchCount);
        emails = Array.isArray(result) ? result : (result.emails || result);
        foldersScanned = result.foldersScanned || ['Tous les dossiers'];
      } else {
        emails = await outlookService.getEmails(fetchCount);
        foldersScanned = ['📥 Inbox'];
      }
      
      // Appliquer les filtres (expéditeur + temporel)
      emails = this.filterEmails(emails, filter, from);
      
      // Limiter au nombre EXACT demandé
      emails = emails.slice(0, count);
      
      if (emails.length === 0) {
        let noResultMsg = `📭 Aucun email trouvé`;
        if (from) noResultMsg += ` de "${from}"`;
        if (filter) noResultMsg += ` (période: ${filter})`;
        return {
          success: true,
          message: noResultMsg
        };
      }

      // Compter les emails par dossier pour le résumé
      const folderCounts = {};
      emails.forEach(email => {
        const folder = email.folder || 'Inbox';
        folderCounts[folder] = (folderCounts[folder] || 0) + 1;
      });

      // Résumer avec l'IA
      let summaryInstruction = '';
      if (from) summaryInstruction += `Résume les emails de ${from}. `;
      if (filter) summaryInstruction += `Période: ${filter}. `;
      
      const summary = await openaiService.summarizeEmails(emails, {
        instruction: summaryInstruction || undefined
      });
      
      // Créer le header avec les infos
      const folderList = Object.entries(folderCounts)
        .map(([folder, cnt]) => `${folder}: ${cnt}`)
        .join(' | ');
      
      let sourceInfo = `📂 **Sources:** ${folderList}\n`;
      if (from) sourceInfo += `👤 **Expéditeur:** ${from}\n`;
      if (filter) sourceInfo += `📅 **Période:** ${filter}\n`;
      sourceInfo += '\n';
      
      // Logger l'activité
      statsService.logSummarySent();
      let logMsg = `Résumé de ${emails.length} emails`;
      if (from) logMsg += ` de ${from}`;
      if (filter) logMsg += ` (${filter})`;
      statsService.addActivity('james', logMsg);
      
      return {
        success: true,
        message: sourceInfo + summary,
        emailCount: emails.length,
        folders: folderCounts
      };
    } catch (error) {
      console.error('❌ Erreur MailAgent.getFilteredEmailSummary:', error);
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Récupérer et résumer les derniers emails
   * @param {number} count - Nombre d'emails à récupérer
   * @param {string} filter - Filtre optionnel (today, yesterday, week, important)
   * @param {boolean} allFolders - Si true, récupère depuis tous les dossiers (pas juste Inbox)
   */
  async getEmailSummary(count = 50, filter = null, allFolders = true) {
    // Utiliser la nouvelle méthode avec options
    return this.getFilteredEmailSummary({ count, filter, allFolders });
  }

  /**
   * Récupérer les emails importants/urgents
   * @param {number} count - Nombre max d'emails à retourner
   * @param {string} filter - 'important', 'urgent', ou filtre temporel combiné
   */
  async getImportantEmails(count = 50, filter = 'important') {
    try {
      if (!outlookService.isConnected()) {
        statsService.logConnectionCheck('outlook', false);
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      statsService.logConnectionCheck('outlook', true);
      
      // Récupérer plus d'emails pour pouvoir filtrer
      let emails = await outlookService.getEmails(200);
      
      // Appliquer le filtre d'importance
      emails = this.filterEmails(emails, filter);
      
      // Limiter au nombre demandé
      emails = emails.slice(0, count);
      
      if (emails.length === 0) {
        return {
          success: true,
          message: `📭 Aucun email ${filter} trouvé.`
        };
      }

      // Créer un résumé spécifique pour les emails importants
      const summary = await openaiService.summarizeEmails(emails, {
        focus: 'importance',
        instruction: `Ces emails sont marqués comme ${filter}. Mets en avant les points critiques et les actions requises.`
      });
      
      statsService.addActivity('james', `${emails.length} emails ${filter} résumés`);
      
      return {
        success: true,
        message: `⭐ **${emails.length} email(s) ${filter}(s) trouvé(s):**\n\n${summary}`,
        emailCount: emails.length
      };
    } catch (error) {
      console.error('❌ Erreur MailAgent.getImportantEmails:', error);
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Récupérer les emails non lus
   */
  async getUnreadSummary(count = 20) {
    try {
      if (!outlookService.isConnected()) {
        statsService.logConnectionCheck('outlook', false);
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      statsService.logConnectionCheck('outlook', true);
      const emails = await outlookService.getUnreadEmails(count);
      
      if (emails.length === 0) {
        statsService.addActivity('james', 'Vérification emails non lus: 0 trouvé');
        return {
          success: true,
          message: "✅ Aucun email non lu ! Votre boîte est à jour."
        };
      }

      // Compter les emails traités
      let urgentCount = 0;
      emails.forEach(email => {
        const isUrgent = email.importance === 'high' || 
                         email.subject?.toLowerCase().includes('urgent');
        if (isUrgent) urgentCount++;
        statsService.logEmailProcessed(isUrgent);
      });

      const summary = await openaiService.summarizeEmails(emails);
      
      // Logger l'activité
      if (urgentCount > 0) {
        statsService.addActivity('james', `${urgentCount} email(s) urgent(s) détecté(s)`, 'warning');
      }
      statsService.addActivity('james', `${emails.length} emails non lus résumés`);
      
      return {
        success: true,
        message: `📬 **${emails.length} emails non lus**\n\n${summary}`,
        emailCount: emails.length
      };
    } catch (error) {
      statsService.addActivity('james', `Erreur emails non lus: ${error.message}`, 'error');
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Classifier un email spécifique
   */
  async classifyEmail(emailId) {
    try {
      const email = await outlookService.getEmailContent(emailId);
      const classification = await openaiService.classifyEmail(email);
      
      // Logger la classification
      statsService.logEmailClassified(classification.category || 'Autre');
      
      return {
        success: true,
        email: email,
        classification: classification
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Erreur classification: ${error.message}`
      };
    }
  }

  /**
   * Classifier et déplacer les emails dans les dossiers Outlook
   * Cette fonction crée les dossiers si nécessaire et classe les X derniers emails
   */
  async classifyAndOrganizeEmails(count = 50) {
    try {
      if (!outlookService.isConnected()) {
        statsService.logConnectionCheck('outlook', false);
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      statsService.logConnectionCheck('outlook', true);
      statsService.addActivity('james', `Début classification de ${count} emails...`, 'info');
      
      // Lancer la classification
      const result = await outlookService.classifyEmails(count);
      
      if (!result.success) {
        statsService.addActivity('james', `Erreur classification: ${result.error}`, 'error');
        return {
          success: false,
          message: `❌ Erreur lors de la classification: ${result.error}`
        };
      }

      // Logger chaque classification
      result.results.forEach(item => {
        if (item.success) {
          statsService.logEmailClassified(item.folder);
        }
      });

      // Créer le message de résumé
      const summary = this.formatClassificationSummary(result);
      
      statsService.addActivity('james', `${result.summary.total} emails classifiés avec succès`, 'success');
      statsService.logSummarySent();
      
      return {
        success: true,
        message: summary,
        details: result
      };
    } catch (error) {
      console.error('❌ Erreur MailAgent.classifyAndOrganizeEmails:', error);
      statsService.addActivity('james', `Erreur classification: ${error.message}`, 'error');
      return {
        success: false,
        message: `❌ Erreur lors de la classification: ${error.message}`
      };
    }
  }

  /**
   * Formater le résumé de classification pour WhatsApp
   */
  formatClassificationSummary(result) {
    const { summary, results } = result;
    
    let message = `📬 **Classification terminée !**\n\n`;
    message += `📊 **Résumé:**\n`;
    message += `• Total traité: ${summary.total} emails\n`;
    message += `• ✅ Classés: ${summary.success}\n`;
    
    if (summary.failed > 0) {
      message += `• ❌ Échoués: ${summary.failed}\n`;
    }
    
    message += `\n📁 **Par dossier:**\n`;
    
    // Trier par nombre décroissant
    const folderEntries = Object.entries(summary.byFolder)
      .sort((a, b) => b[1] - a[1]);
    
    const folderEmojis = {
      'Urgent': '🚨',
      'Professionnel': '💼',
      'Shopping': '🛒',
      'Newsletter': '📰',
      'Finance': '💰',
      'Social': '👥',
      'ISCOD': '🎓'
    };
    
    folderEntries.forEach(([folder, count]) => {
      const emoji = folderEmojis[folder] || '📁';
      message += `${emoji} ${folder}: ${count}\n`;
    });
    
    // Ajouter quelques exemples
    message += `\n📝 **Exemples de classification:**\n`;
    const examples = results.filter(r => r.success).slice(0, 5);
    examples.forEach(item => {
      const subject = item.subject.length > 40 
        ? item.subject.substring(0, 40) + '...' 
        : item.subject;
      message += `• "${subject}" → ${item.folder}\n`;
    });
    
    return message;
  }

  /**
   * Obtenir le résumé de la dernière classification (depuis la mémoire)
   */
  getLastClassificationSummary() {
    const memory = outlookService.getClassificationMemory();
    
    if (memory.length === 0) {
      return {
        success: true,
        message: "📭 Aucune classification récente en mémoire. Utilisez 'classe mes emails' pour lancer une classification."
      };
    }
    
    const summary = outlookService.getClassificationSummary();
    
    let message = `📊 **Mémoire de classification (${memory.length} emails)**\n\n`;
    message += `📁 **Répartition:**\n`;
    
    const folderEmojis = {
      'Urgent': '🚨',
      'Professionnel': '💼',
      'Shopping': '🛒',
      'Newsletter': '📰',
      'Finance': '💰',
      'Social': '👥',
      'ISCOD': '🎓'
    };
    
    Object.entries(summary)
      .sort((a, b) => b[1] - a[1])
      .forEach(([folder, count]) => {
        const emoji = folderEmojis[folder] || '📁';
        message += `${emoji} ${folder}: ${count}\n`;
      });
    
    // Dernières classifications
    message += `\n📝 **Dernières classifications:**\n`;
    memory.slice(-5).reverse().forEach(item => {
      const subject = item.subject.length > 35 
        ? item.subject.substring(0, 35) + '...' 
        : item.subject;
      const time = new Date(item.classifiedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      message += `• [${time}] "${subject}" → ${item.folder}\n`;
    });
    
    return {
      success: true,
      message,
      memory
    };
  }

  /**
   * Envoyer un email
   */
  async sendEmail(to, subject, body) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      await outlookService.sendEmail(to, subject, body);
      
      // Logger l'envoi
      statsService.addActivity('james', `Email envoyé à ${to}`);
      
      return {
        success: true,
        message: `✅ Email envoyé à ${to}`
      };
    } catch (error) {
      statsService.addActivity('james', `Échec envoi email: ${error.message}`, 'error');
      return {
        success: false,
        message: `❌ Erreur envoi: ${error.message}`
      };
    }
  }

  /**
   * Générer un brouillon de réponse
   */
  async draftReply(emailId, instructions) {
    try {
      const email = await outlookService.getEmailContent(emailId);
      const draft = await openaiService.draftEmailReply(email, instructions);
      
      statsService.addActivity('james', 'Brouillon de réponse généré');
      
      return {
        success: true,
        originalEmail: email,
        draft: draft
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Rechercher et déplacer les emails qui correspondent à un pattern
   * @param {string} pattern - Le pattern à rechercher (dans sujet, expéditeur, corps)
   * @param {string} folder - Le dossier de destination
   */
  async searchAndMoveEmails(pattern, folder) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage(),
          found: 0,
          moved: 0
        };
      }

      console.log(`🔍 Recherche des emails contenant "${pattern}" pour les déplacer vers ${folder}...`);
      
      // Récupérer plus d'emails pour la recherche
      const emails = await outlookService.getEmails(200);
      
      // Filtrer les emails qui correspondent au pattern
      const patternLower = pattern.toLowerCase();
      const matchingEmails = emails.filter(email => {
        const subject = (email.subject || '').toLowerCase();
        const from = (email.from?.emailAddress?.address || '').toLowerCase();
        const fromName = (email.from?.emailAddress?.name || '').toLowerCase();
        const body = (email.bodyPreview || '').toLowerCase();
        
        return subject.includes(patternLower) || 
               from.includes(patternLower) || 
               fromName.includes(patternLower) ||
               body.includes(patternLower);
      });

      console.log(`📧 ${matchingEmails.length} emails trouvés correspondant à "${pattern}"`);

      if (matchingEmails.length === 0) {
        return {
          success: true,
          message: `Aucun email trouvé contenant "${pattern}"`,
          found: 0,
          moved: 0
        };
      }

      // S'assurer que le dossier existe (createFolder vérifie et crée si nécessaire)
      try {
        await outlookService.createFolder(folder);
      } catch (folderError) {
        // Le dossier existe probablement déjà, on continue
        console.log(`📁 Dossier "${folder}" prêt`);
      }

      // Déplacer chaque email
      let movedCount = 0;
      for (const email of matchingEmails) {
        try {
          await outlookService.moveEmailToFolder(email.id, folder);
          movedCount++;
          console.log(`  ✅ Déplacé: "${email.subject?.substring(0, 50)}..." → ${folder}`);
          
          // Logger la classification
          statsService.logEmailClassified(folder);
        } catch (error) {
          console.error(`  ❌ Erreur déplacement: ${error.message}`);
        }
      }

      statsService.addActivity('james', `${movedCount} emails "${pattern}" déplacés vers ${folder}`, 'success');

      return {
        success: true,
        message: `${movedCount}/${matchingEmails.length} emails déplacés vers ${folder}`,
        found: matchingEmails.length,
        moved: movedCount
      };
    } catch (error) {
      console.error('❌ Erreur searchAndMoveEmails:', error);
      return {
        success: false,
        message: `Erreur: ${error.message}`,
        found: 0,
        moved: 0
      };
    }
  }

  /**
   * Créer un dossier personnalisé dans Outlook
   * @param {string} folderName - Nom du dossier à créer
   */
  async createFolder(folderName) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      const result = await outlookService.createCustomFolder(folderName);
      
      if (result.success) {
        statsService.addActivity('james', `Dossier "${folderName}" créé`, 'success');
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Supprimer un dossier Outlook (emails déplacés vers Inbox)
   * @param {string} folderName - Nom du dossier à supprimer
   */
  async deleteFolder(folderName) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      const result = await outlookService.deleteFolder(folderName);
      
      if (result.success) {
        statsService.addActivity('james', `Dossier "${folderName}" supprimé`, 'success');
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Lister les dossiers personnalisés
   */
  async listFolders() {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      const result = await outlookService.listCustomFolders();
      
      if (!result.success || result.folders.length === 0) {
        return {
          success: true,
          message: "📁 Aucun dossier personnalisé trouvé."
        };
      }

      const folderList = result.folders.map(f => `  • ${f.name}`).join('\n');
      return {
        success: true,
        message: `📁 **Dossiers Outlook**\n\n${folderList}`,
        folders: result.folders
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Re-classifier les emails déjà classés selon les nouvelles règles
   * Analyse tous les dossiers (ou un dossier spécifique) et re-déplace les emails si nécessaire
   * @param {number} count - Nombre total d'emails à analyser
   * @param {string} sourceFolder - Nom du dossier source (optionnel, si non spécifié = tous les dossiers)
   */
  async reclassifyEmails(count = 30, sourceFolder = null) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      // Recharger les règles depuis Supabase pour avoir la dernière version
      await openaiService.initFromSupabase();
      console.log(`📋 Règles rechargées: ${openaiService.customClassificationRules?.length || 0} règles actives`);

      let allEmails;
      
      if (sourceFolder) {
        // Récupérer les emails d'un dossier spécifique
        console.log(`🔄 Re-classification des ${count} derniers emails du dossier "${sourceFolder}"...`);
        allEmails = await outlookService.getEmailsFromFolder(sourceFolder, count);
      } else {
        // Récupérer de tous les dossiers
        console.log(`🔄 Re-classification des emails (${count} par dossier)...`);
        allEmails = await outlookService.getEmailsFromAllFolders(count);
      }
      
      if (allEmails.length === 0) {
        return {
          success: true,
          message: sourceFolder 
            ? `📭 Aucun email trouvé dans le dossier "${sourceFolder}".`
            : "📭 Aucun email à re-classifier."
        };
      }

      // Statistiques
      const stats = {
        analyzed: 0,
        moved: 0,
        unchanged: 0,
        errors: 0,
        movements: [] // Pour le rapport détaillé
      };

      // Analyser chaque email avec les règles actuelles
      for (const email of allEmails) {
        try {
          stats.analyzed++;
          
          // Demander à l'IA de classifier avec les règles actuelles
          const classification = await openaiService.classifyEmailForFolder({
            from: email.from?.emailAddress?.address || '',
            fromName: email.from?.emailAddress?.name || '',
            subject: email.subject || '',
            preview: email.bodyPreview || ''
          });
          
          // Déterminer le dossier cible (nom)
          const targetFolderName = this.mapCategoryToFolder(classification.category);
          
          // Comparer avec le dossier actuel (normaliser pour comparaison)
          const currentFolderNormalized = email.currentFolder?.toLowerCase().replace(/[🔴💼🛒📰🏦🤝\s]/g, '');
          const targetFolderNormalized = targetFolderName?.toLowerCase().replace(/[🔴💼🛒📰🏦🤝\s]/g, '');
          
          if (currentFolderNormalized !== targetFolderNormalized && targetFolderName) {
            // Convertir le nom du dossier cible en ID
            const targetFolderId = await outlookService.getFolderIdByName(targetFolderName);
            
            if (!targetFolderId) {
              console.log(`  ⚠️ Dossier cible "${targetFolderName}" non trouvé, email ignoré`);
              stats.errors++;
              continue;
            }
            
            // Déplacer vers le nouveau dossier (avec sourceFolderId pour les sous-dossiers)
            try {
              await outlookService.moveEmailToFolder(email.id, targetFolderId, email.currentFolderId);
              stats.moved++;
              stats.movements.push({
                subject: email.subject?.substring(0, 40) || 'Sans sujet',
                from: email.currentFolder,
                to: targetFolderName,
                reason: classification.reason || 'Règle mise à jour'
              });
              console.log(`  ↪️ "${email.subject?.substring(0, 30)}..." : ${email.currentFolder} → ${targetFolderName}`);
            } catch (moveError) {
              stats.errors++;
              console.error(`  ❌ Erreur déplacement:`, moveError.message);
            }
          } else {
            stats.unchanged++;
          }
        } catch (emailError) {
          stats.errors++;
          console.error(`  ⚠️ Erreur analyse email:`, emailError.message);
        }
      }

      // Générer le rapport
      let message = `🔄 **Re-classification terminée**\n\n`;
      if (sourceFolder) {
        message += `📁 Dossier analysé: ${sourceFolder}\n\n`;
      }
      message += `📊 **Statistiques:**\n`;
      message += `• ${stats.analyzed} emails analysés\n`;
      message += `• ${stats.moved} emails déplacés\n`;
      message += `• ${stats.unchanged} emails inchangés\n`;
      if (stats.errors > 0) {
        message += `• ${stats.errors} erreurs\n`;
      }
      
      if (stats.movements.length > 0) {
        message += `\n📦 **Déplacements:**\n`;
        for (const mv of stats.movements.slice(0, 10)) { // Max 10 pour lisibilité
          message += `• "${mv.subject}..."\n  ${mv.from} → ${mv.to}\n`;
        }
        if (stats.movements.length > 10) {
          message += `\n... et ${stats.movements.length - 10} autres déplacements`;
        }
      }

      statsService.addActivity('james', `Re-classification: ${stats.moved}/${stats.analyzed} emails déplacés`, 'success');

      return {
        success: true,
        message,
        stats
      };
    } catch (error) {
      console.error('❌ Erreur reclassifyEmails:', error);
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Mapper une catégorie vers un nom de dossier
   */
  mapCategoryToFolder(category) {
    const mapping = {
      'urgent': '🔴 Urgent',
      'professionnel': '💼 Professionnel',
      'shopping': '🛒 Shopping',
      'newsletter': '📰 Newsletter',
      'finance': '🏦 Finance',
      'social': '🤝 Social',
      'iscod': 'ISCOD'
    };
    
    const lowerCategory = (category || '').toLowerCase();
    
    // Vérifier le mapping direct
    if (mapping[lowerCategory]) {
      return mapping[lowerCategory];
    }
    
    // Sinon retourner la catégorie telle quelle (pour les dossiers personnalisés)
    return category;
  }

  // ==================== GESTION DES BROUILLONS D'EMAILS ====================

  /**
   * Créer un brouillon d'email à partir d'une demande en langage naturel
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @param {string} request - La demande de l'utilisateur
   */
  async composeDraft(phoneNumber, request) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      // Parser la demande
      const parsed = await openaiService.parseEmailRequest(request);
      
      if (parsed.action === 'unclear' || !parsed.to) {
        return {
          success: false,
          message: `❓ Je n'ai pas compris la demande d'email.\n\nPrécisez le destinataire et le message.\n\n**Exemple:**\n"Envoie un mail à jean@example.com pour lui dire bonjour et demander des nouvelles du projet"`
        };
      }

      // Valider l'adresse email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(parsed.to)) {
        // Ce n'est pas une adresse email valide, c'est peut-être un nom
        // Chercher dans les contacts
        console.log(`🔍 "${parsed.to}" n'est pas un email, recherche de contacts...`);
        
        const contacts = await outlookService.searchContactsByName(parsed.to);
        
        if (contacts.length === 0) {
          return {
            success: false,
            message: `❌ Je n'ai pas trouvé de contact correspondant à **"${parsed.to}"** dans vos emails.\n\n💡 **Essayez de:**\n• Préciser l'adresse email complète\n• Vérifier l'orthographe du nom\n• Utiliser un autre nom pour cette personne`
          };
        }
        
        if (contacts.length === 1) {
          // Un seul contact trouvé, on l'utilise directement
          parsed.to = contacts[0].email;
          console.log(`✅ Contact unique trouvé: ${contacts[0].name} <${contacts[0].email}>`);
        } else {
          // Plusieurs contacts trouvés, demander à l'utilisateur de choisir
          this.pendingRecipientSearch.set(phoneNumber, {
            name: parsed.to,
            matches: contacts,
            originalRequest: request,
            parsedRequest: parsed,
            timestamp: new Date()
          });
          
          let message = `🔍 J'ai trouvé **${contacts.length} contacts** pour "${parsed.to}":\n\n`;
          
          contacts.forEach((contact, index) => {
            const lastContactStr = contact.lastContact 
              ? ` _(dernier échange: ${new Date(contact.lastContact).toLocaleDateString('fr-FR')})_`
              : '';
            const direction = contact.fromMe ? '📤' : '📥';
            message += `**${index + 1}.** ${direction} ${contact.name}\n   📧 ${contact.email}${lastContactStr}\n\n`;
          });
          
          message += `📝 **Répondez avec le numéro** (1-${contacts.length}) ou l'adresse email pour continuer.`;
          
          return {
            success: true,
            needsRecipientSelection: true,
            message
          };
        }
      }

      // Générer le brouillon avec l'IA
      const composed = await openaiService.composeEmail({
        to: parsed.to,
        intent: parsed.intent,
        context: parsed.context,
        tone: parsed.tone
      });

      // Sauvegarder le brouillon
      const draftEntry = draftService.createDraft(phoneNumber, {
        to: parsed.to,
        subject: parsed.subject_hint || composed.subject,
        body: composed.body,
        context: request
      });

      statsService.addActivity('james', `Brouillon créé pour ${parsed.to}`);

      return {
        success: true,
        hasDraft: true,
        message: draftService.formatForDisplay(draftEntry)
      };
    } catch (error) {
      console.error('❌ Erreur composeDraft:', error);
      return {
        success: false,
        message: `❌ Erreur lors de la rédaction: ${error.message}`
      };
    }
  }

  /**
   * Vérifier si l'utilisateur a une recherche de destinataire en attente
   * @param {string} phoneNumber 
   */
  hasPendingRecipientSearch(phoneNumber) {
    const pending = this.pendingRecipientSearch.get(phoneNumber);
    if (!pending) return false;
    
    // Expiration après 5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - pending.timestamp.getTime() > fiveMinutes) {
      this.pendingRecipientSearch.delete(phoneNumber);
      return false;
    }
    
    return true;
  }

  /**
   * Gérer la sélection d'un destinataire parmi les résultats de recherche
   * @param {string} phoneNumber 
   * @param {string} selection - Numéro (1-N) ou adresse email
   */
  async handleRecipientSelection(phoneNumber, selection) {
    const pending = this.pendingRecipientSearch.get(phoneNumber);
    
    if (!pending) {
      return {
        success: false,
        message: "❌ Aucune recherche de contact en cours. Reformulez votre demande d'email."
      };
    }

    let selectedEmail = null;
    let selectedName = null;
    const selectionTrimmed = selection.trim();

    // Vérifier si c'est un numéro
    const numericSelection = parseInt(selectionTrimmed, 10);
    if (!isNaN(numericSelection) && numericSelection >= 1 && numericSelection <= pending.matches.length) {
      const contact = pending.matches[numericSelection - 1];
      selectedEmail = contact.email;
      selectedName = contact.name;
    }
    // Vérifier si c'est une adresse email directe
    else if (selectionTrimmed.includes('@')) {
      selectedEmail = selectionTrimmed;
      const match = pending.matches.find(c => c.email.toLowerCase() === selectionTrimmed.toLowerCase());
      selectedName = match ? match.name : selectionTrimmed;
    }
    // Vérifier si c'est un nom partiel
    else {
      const lowerSelection = selectionTrimmed.toLowerCase();
      const match = pending.matches.find(c => 
        c.name.toLowerCase().includes(lowerSelection) || 
        c.email.toLowerCase().includes(lowerSelection)
      );
      if (match) {
        selectedEmail = match.email;
        selectedName = match.name;
      }
    }

    if (!selectedEmail) {
      return {
        success: false,
        message: `❌ Sélection invalide.\n\n📝 Répondez avec:\n• Un numéro entre 1 et ${pending.matches.length}\n• Ou l'adresse email exacte`
      };
    }

    // Nettoyer le cache
    this.pendingRecipientSearch.delete(phoneNumber);

    // Mettre à jour la requête parsée avec le bon destinataire
    const parsed = pending.parsedRequest;
    parsed.to = selectedEmail;

    console.log(`✅ Destinataire sélectionné: ${selectedName} <${selectedEmail}>`);

    // Générer le brouillon avec l'IA
    const composed = await openaiService.composeEmail({
      to: parsed.to,
      intent: parsed.intent,
      context: parsed.context,
      tone: parsed.tone
    });

    // Sauvegarder le brouillon
    const draftEntry = draftService.createDraft(phoneNumber, {
      to: selectedEmail,
      subject: parsed.subject_hint || composed.subject,
      body: composed.body,
      context: pending.originalRequest
    });

    statsService.addActivity('james', `Brouillon créé pour ${selectedName} (${selectedEmail})`);

    return {
      success: true,
      hasDraft: true,
      message: `✅ **Contact sélectionné:** ${selectedName}\n\n${draftService.formatForDisplay(draftEntry)}`
    };
  }

  /**
   * Vérifier si l'utilisateur a un brouillon en attente
   * @param {string} phoneNumber 
   */
  hasPendingDraft(phoneNumber) {
    return draftService.hasPendingDraft(phoneNumber);
  }

  /**
   * Récupérer le brouillon en attente
   * @param {string} phoneNumber 
   */
  getPendingDraft(phoneNumber) {
    return draftService.getDraft(phoneNumber);
  }

  /**
   * Réviser un brouillon existant
   * @param {string} phoneNumber 
   * @param {string} instructions - Les modifications demandées
   */
  async reviseDraft(phoneNumber, instructions) {
    try {
      const draftEntry = draftService.getDraft(phoneNumber);
      
      if (!draftEntry) {
        return {
          success: false,
          message: "📭 Aucun brouillon en cours. Commencez par demander un nouvel email."
        };
      }

      // Réviser avec l'IA
      const revised = await openaiService.reviseDraft(draftEntry.draft, instructions);

      // Mettre à jour le brouillon
      const updated = draftService.updateDraft(phoneNumber, {
        subject: revised.subject,
        body: revised.body
      });

      return {
        success: true,
        hasDraft: true,
        changes: revised.changes,
        message: draftService.formatForDisplay(updated)
      };
    } catch (error) {
      console.error('❌ Erreur reviseDraft:', error);
      return {
        success: false,
        message: `❌ Erreur lors de la révision: ${error.message}`
      };
    }
  }

  /**
   * Envoyer le brouillon en attente
   * @param {string} phoneNumber 
   */
  async sendDraft(phoneNumber) {
    try {
      const draftEntry = draftService.getDraft(phoneNumber);
      
      if (!draftEntry) {
        return {
          success: false,
          message: "📭 Aucun brouillon à envoyer. Rédigez d'abord un email."
        };
      }

      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      const { to, subject, body } = draftEntry.draft;

      // Envoyer l'email
      await outlookService.sendEmail(to, subject, body);

      // Marquer comme envoyé
      draftService.markAsSent(phoneNumber);

      statsService.addActivity('james', `Email envoyé à ${to}`);

      return {
        success: true,
        message: `✅ **Email envoyé avec succès !**\n\n📧 **À:** ${to}\n📌 **Sujet:** ${subject}\n\n_L'email a été envoyé depuis votre compte Outlook._`
      };
    } catch (error) {
      console.error('❌ Erreur sendDraft:', error);
      return {
        success: false,
        message: `❌ Erreur lors de l'envoi: ${error.message}`
      };
    }
  }

  /**
   * Annuler le brouillon en cours
   * @param {string} phoneNumber 
   */
  cancelDraft(phoneNumber) {
    const existed = draftService.deleteDraft(phoneNumber);
    
    if (existed) {
      return {
        success: true,
        message: "🗑️ Brouillon annulé. L'email ne sera pas envoyé."
      };
    }
    
    return {
      success: true,
      message: "📭 Aucun brouillon en cours."
    };
  }

  // ==================== RECHERCHE INTELLIGENTE ====================

  /**
   * Rechercher des emails avec des critères en langage naturel
   * @param {string} phoneNumber - Pour garder en cache
   * @param {Object} criteria - Critères de recherche
   */
  async searchEmails(phoneNumber, criteria) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      console.log('🔍 James recherche des emails:', criteria);
      
      const emails = await outlookService.searchEmails(criteria);
      
      // Sauvegarder en cache pour "réponds au dernier"
      this.lastSearchResults.set(phoneNumber, emails);
      
      if (emails.length === 0) {
        return {
          success: true,
          message: `📭 Aucun email trouvé pour cette recherche.`,
          count: 0
        };
      }

      // Formater les résultats avec info dossier
      let formattedResults = `🔍 **${emails.length} email(s) trouvé(s)**\n\n`;
      
      for (const email of emails.slice(0, 10)) { // Limiter à 10 pour l'affichage
        const date = new Date(email.receivedAt).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        formattedResults += `━━━━━━━━━━━━━━━━━━━━\n`;
        formattedResults += `📧 **${email.subject || '(Sans sujet)'}**\n`;
        formattedResults += `👤 De: ${email.fromName || email.from}\n`;
        formattedResults += `📁 Dossier: ${email.folder || 'Inconnu'}\n`;
        formattedResults += `📅 ${date}\n`;
        if (email.preview) {
          formattedResults += `💬 "${email.preview.substring(0, 100)}${email.preview.length > 100 ? '...' : ''}"\n`;
        }
        formattedResults += `\n`;
      }
      
      if (emails.length > 10) {
        formattedResults += `\n... et ${emails.length - 10} autre(s) email(s)`;
      }

      statsService.addActivity('james', `Recherche: ${emails.length} emails trouvés`);

      return {
        success: true,
        message: formattedResults,
        count: emails.length,
        emails: emails
      };
    } catch (error) {
      console.error('❌ Erreur searchEmails:', error);
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  // ==================== RÉPONSE RAPIDE ====================

  /**
   * Répondre au dernier email d'un expéditeur
   * @param {string} phoneNumber 
   * @param {string} from - Expéditeur (nom ou email)
   * @param {string} instructions - Instructions pour la réponse
   */
  async replyToEmail(phoneNumber, from, instructions) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      // Chercher le dernier email de cet expéditeur
      const emails = await outlookService.searchEmails({
        from: from,
        limit: 1
      });

      if (emails.length === 0) {
        return {
          success: false,
          message: `📭 Aucun email trouvé de "${from}".`
        };
      }

      const originalEmail = emails[0];
      
      // Récupérer le contenu complet
      const fullEmail = await outlookService.getEmailById(originalEmail.id);
      
      // Générer la réponse avec l'IA
      const replyContent = await openaiService.draftEmailReply(fullEmail, instructions);
      
      // Créer un brouillon pour validation
      const replySubject = fullEmail.subject.startsWith('Re:') 
        ? fullEmail.subject 
        : `Re: ${fullEmail.subject}`;
      
      draftService.createDraft(phoneNumber, {
        to: fullEmail.from,
        subject: replySubject,
        body: replyContent,
        context: `Réponse à l'email de ${fullEmail.fromName || fullEmail.from}`
      });

      const draftEntry = draftService.getDraft(phoneNumber);

      statsService.addActivity('james', `Réponse préparée pour ${fullEmail.from}`);

      return {
        success: true,
        hasDraft: true,
        originalEmail: {
          from: fullEmail.fromName || fullEmail.from,
          subject: fullEmail.subject,
          preview: fullEmail.preview?.substring(0, 100)
        },
        message: `📩 **Réponse à l'email de ${fullEmail.fromName || fullEmail.from}**\n\n📌 **Sujet original:** ${fullEmail.subject}\n\n${draftService.formatForDisplay(draftEntry)}`
      };
    } catch (error) {
      console.error('❌ Erreur replyToEmail:', error);
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  // ==================== NETTOYAGE INTELLIGENT ====================

  /**
   * Supprimer des emails en masse
   * @param {Object} criteria - Critères de suppression
   */
  async cleanupEmails(criteria) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      console.log('🗑️ James nettoie les emails:', criteria);

      const result = await outlookService.deleteEmails(criteria);

      if (!result.success) {
        return result;
      }

      statsService.addActivity('james', `Nettoyage: ${result.deleted} emails supprimés`);

      let message = `🗑️ **Nettoyage terminé**\n\n`;
      message += `📊 **Résultat:**\n`;
      message += `• ${result.deleted} email(s) supprimé(s)\n`;
      
      if (criteria.folder) {
        message += `• Dossier: ${criteria.folder}\n`;
      }
      if (criteria.from) {
        message += `• Expéditeur: ${criteria.from}\n`;
      }
      if (criteria.olderThanDays) {
        message += `• Plus vieux que ${criteria.olderThanDays} jours\n`;
      }

      return {
        success: true,
        message,
        deleted: result.deleted
      };
    } catch (error) {
      console.error('❌ Erreur cleanupEmails:', error);
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Supprimer des emails par date précise (aujourd'hui, hier)
   * @param {Object} criteria - Critères incluant period, from, folder
   */
  async cleanEmailsByDate(criteria) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      console.log('🗑️ James nettoie les emails par date:', criteria);

      // Déterminer la plage de dates
      const now = new Date();
      let startDate, endDate;
      
      if (criteria.period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else if (criteria.period === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
        endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
      }

      // Récupérer les emails de la période
      let emails = await outlookService.getAllRecentEmails(200);
      
      // Filtrer par date
      emails = emails.filter(e => {
        const emailDate = new Date(e.receivedAt);
        return emailDate >= startDate && emailDate <= endDate;
      });
      
      // Filtrer par expéditeur si spécifié
      if (criteria.from) {
        const fromLower = criteria.from.toLowerCase();
        emails = emails.filter(e => {
          const from = (e.from || '').toLowerCase();
          const fromName = (e.fromName || '').toLowerCase();
          return from.includes(fromLower) || fromName.includes(fromLower);
        });
      }
      
      // Filtrer par dossier si spécifié
      if (criteria.folder) {
        const folderLower = criteria.folder.toLowerCase();
        emails = emails.filter(e => {
          const folder = (e.folder || '').toLowerCase();
          return folder.includes(folderLower);
        });
      }

      if (emails.length === 0) {
        let msg = `📭 Aucun email trouvé`;
        if (criteria.from) msg += ` de "${criteria.from}"`;
        if (criteria.period === 'today') msg += ` aujourd'hui`;
        if (criteria.period === 'yesterday') msg += ` hier`;
        if (criteria.folder) msg += ` dans "${criteria.folder}"`;
        return { success: true, message: msg, deleted: 0 };
      }

      // Demander confirmation avant suppression
      const emailList = emails.slice(0, 5).map(e => 
        `• ${e.fromName || e.from}: "${(e.subject || 'Sans sujet').substring(0, 40)}..." [${e.folder}]`
      ).join('\n');
      
      // Supprimer les emails
      let deletedCount = 0;
      for (const email of emails) {
        try {
          await outlookService.deleteEmail(email.id);
          deletedCount++;
        } catch (err) {
          console.error(`Erreur suppression ${email.id}:`, err.message);
        }
      }

      statsService.addActivity('james', `Nettoyage: ${deletedCount} emails supprimés (${criteria.period})`);

      let message = `🗑️ **Nettoyage terminé**\n\n`;
      message += `📊 **Résultat:** ${deletedCount} email(s) supprimé(s)\n\n`;
      
      if (criteria.from) message += `📤 **Expéditeur:** ${criteria.from}\n`;
      if (criteria.period === 'today') message += `📅 **Période:** Aujourd'hui\n`;
      if (criteria.period === 'yesterday') message += `📅 **Période:** Hier\n`;
      if (criteria.folder) message += `📁 **Dossier:** ${criteria.folder}\n`;
      
      if (deletedCount > 0) {
        message += `\n**Exemples supprimés:**\n${emailList}`;
        if (emails.length > 5) {
          message += `\n... et ${emails.length - 5} autres`;
        }
      }

      return {
        success: true,
        message,
        deleted: deletedCount
      };
    } catch (error) {
      console.error('❌ Erreur cleanEmailsByDate:', error);
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  // ==================== RAPPELS ====================

  /**
   * Créer un rappel
   * @param {string} phoneNumber 
   * @param {string} text - Demande en langage naturel
   */
  async createReminder(phoneNumber, text) {
    try {
      // Parser la demande
      const parsed = reminderService.parseReminderRequest(text);
      
      if (!parsed.isValid) {
        return {
          success: false,
          message: `❓ Je n'ai pas compris quand vous rappeler.\n\n**Exemples:**\n• "Rappelle-moi demain à 9h d'envoyer le rapport"\n• "Rappelle-moi dans 2 heures de répondre à Pierre"\n• "Rappelle-moi lundi à 14h de la réunion"`
        };
      }

      const result = await reminderService.createReminder({
        phoneNumber,
        message: parsed.message,
        triggerAt: parsed.triggerAt,
        context: text
      });

      return result;
    } catch (error) {
      console.error('❌ Erreur createReminder:', error);
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  /**
   * Lister les rappels d'un utilisateur
   * @param {string} phoneNumber 
   */
  async listReminders(phoneNumber) {
    try {
      const reminders = await reminderService.listReminders(phoneNumber);
      
      if (reminders.length === 0) {
        return {
          success: true,
          message: "📭 Aucun rappel programmé."
        };
      }

      let message = `⏰ **Vos rappels (${reminders.length})**\n\n`;
      
      reminders.forEach((r, i) => {
        const dateStr = r.triggerAt.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        });
        const timeStr = r.triggerAt.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        message += `${i + 1}. 📅 ${dateStr} à ${timeStr}\n   📝 ${r.message}\n\n`;
      });

      return {
        success: true,
        message,
        reminders
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }

  // ==================== RÉSUMÉ QUOTIDIEN ====================

  /**
   * Générer un résumé de la journée mail
   * @param {number} count - Nombre d'emails à analyser
   */
  async getDailySummary(count = 50) {
    try {
      if (!outlookService.isConnected()) {
        return {
          success: false,
          message: this.getNotConnectedMessage()
        };
      }

      // Récupérer les emails d'aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let emails = await outlookService.getEmails(count);
      const todayEmails = emails.filter(e => new Date(e.receivedAt) >= today);
      
      // Compter les non lus
      const unreadEmails = await outlookService.getUnreadEmails(50);
      
      // Emails importants/urgents
      const importantEmails = emails.filter(e => 
        e.importance === 'high' || 
        e.subject?.toLowerCase().includes('urgent')
      );
      
      // Emails flaggés (à suivre)
      const flaggedEmails = emails.filter(e => e.isFlagged);

      // Générer le résumé avec l'IA
      let message = `📊 **Résumé de votre journée mail**\n\n`;
      message += `📬 **Aujourd'hui:** ${todayEmails.length} email(s) reçu(s)\n`;
      message += `📭 **Non lus:** ${unreadEmails.length} email(s)\n`;
      message += `⚠️ **Urgents/Importants:** ${importantEmails.length} email(s)\n`;
      message += `🚩 **À suivre:** ${flaggedEmails.length} email(s)\n\n`;

      if (importantEmails.length > 0) {
        message += `🔴 **Emails prioritaires:**\n`;
        for (const email of importantEmails.slice(0, 5)) {
          message += `• ${email.fromName || email.from}: "${email.subject?.substring(0, 40)}..."\n`;
        }
        message += '\n';
      }

      if (unreadEmails.length > 0) {
        // Résumer les non lus
        const unreadSummary = await openaiService.summarizeEmails(unreadEmails.slice(0, 10), {
          instruction: 'Résume très brièvement les emails non lus en mettant en avant les actions requises.'
        });
        message += `📝 **Résumé des non lus:**\n${unreadSummary}\n\n`;
      }

      if (flaggedEmails.length > 0) {
        message += `🚩 **Emails à suivre:**\n`;
        for (const email of flaggedEmails.slice(0, 3)) {
          message += `• ${email.fromName || email.from}: "${email.subject?.substring(0, 40)}..."\n`;
        }
      }

      statsService.addActivity('james', 'Résumé quotidien généré');

      return {
        success: true,
        message,
        stats: {
          today: todayEmails.length,
          unread: unreadEmails.length,
          important: importantEmails.length,
          flagged: flaggedEmails.length
        }
      };
    } catch (error) {
      console.error('❌ Erreur getDailySummary:', error);
      return {
        success: false,
        message: `❌ Erreur: ${error.message}`
      };
    }
  }
}

module.exports = new MailAgent();
