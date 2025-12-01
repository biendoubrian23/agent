const openaiService = require('../services/openai.service');
const outlookService = require('../services/outlook.service');
const statsService = require('../services/stats.service');
const draftService = require('../services/draft.service');
const reminderService = require('../services/reminder.service');

/**
 * Agent Mail (James) - Gère les emails Outlook
 */
class MailAgent {
  constructor() {
    this.name = 'James';
    this.role = 'Mail Assistant';
    
    // Cache du dernier email trouvé (pour "réponds au dernier mail de X")
    this.lastSearchResults = new Map(); // phoneNumber -> emails[]
  }

  /**
   * Filtrer les emails selon un critère temporel ou d'importance
   */
  filterEmails(emails, filter) {
    if (!filter) return emails;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case 'today':
        return emails.filter(e => new Date(e.receivedDateTime) >= today);
      
      case 'yesterday':
        return emails.filter(e => {
          const date = new Date(e.receivedDateTime);
          return date >= yesterday && date < today;
        });
      
      case 'week':
        return emails.filter(e => new Date(e.receivedDateTime) >= weekAgo);
      
      case 'important':
      case 'urgent':
        return emails.filter(e => 
          e.importance === 'high' || 
          e.subject?.toLowerCase().includes('urgent') ||
          e.subject?.toLowerCase().includes('important') ||
          e.flag?.flagStatus === 'flagged'
        );
      
      default:
        return emails;
    }
  }

  /**
   * Récupérer et résumer les derniers emails
   * @param {number} count - Nombre d'emails à récupérer
   * @param {string} filter - Filtre optionnel (today, yesterday, week, important)
   */
  async getEmailSummary(count = 50, filter = null) {
    try {
      if (!outlookService.isConnected()) {
        statsService.logConnectionCheck('outlook', false);
        return {
          success: false,
          message: "❌ Outlook n'est pas connecté. Demandez à l'utilisateur de se connecter via le lien d'authentification."
        };
      }

      statsService.logConnectionCheck('outlook', true);
      
      // Si on a un filtre temporel, on récupère plus d'emails pour filtrer ensuite
      const fetchCount = filter ? Math.max(count * 3, 100) : count;
      let emails = await outlookService.getEmails(fetchCount);
      
      // Appliquer le filtre
      if (filter) {
        emails = this.filterEmails(emails, filter);
      }
      
      // Limiter au nombre demandé
      emails = emails.slice(0, count);
      
      if (emails.length === 0) {
        const filterMsg = filter ? ` correspondant au filtre "${filter}"` : '';
        return {
          success: true,
          message: `📭 Aucun email${filterMsg} trouvé.`
        };
      }

      // Compter les emails traités
      emails.forEach(email => {
        const isUrgent = email.importance === 'high' || 
                         email.subject?.toLowerCase().includes('urgent');
        statsService.logEmailProcessed(isUrgent);
      });

      const summary = await openaiService.summarizeEmails(emails);
      
      // Logger l'activité
      statsService.logSummarySent();
      const filterInfo = filter ? ` (filtre: ${filter})` : '';
      statsService.addActivity('james', `Résumé de ${emails.length} emails envoyé${filterInfo}`);
      
      return {
        success: true,
        message: summary,
        emailCount: emails.length
      };
    } catch (error) {
      console.error('❌ Erreur MailAgent.getEmailSummary:', error);
      statsService.addActivity('james', `Erreur résumé: ${error.message}`, 'error');
      return {
        success: false,
        message: `❌ Erreur lors de la récupération des emails: ${error.message}`
      };
    }
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté. Connectez-vous d'abord via le lien d'authentification."
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté.",
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté. Connectez-vous d'abord pour envoyer des emails."
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
        return {
          success: false,
          message: `❌ L'adresse email "${parsed.to}" ne semble pas valide.\n\nVérifiez l'adresse et réessayez.`
        };
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté."
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

      // Résumer les résultats avec l'IA
      const summary = await openaiService.summarizeEmails(emails, {
        instruction: 'Résume les résultats de recherche de manière concise, en mettant en avant les emails les plus pertinents.'
      });

      statsService.addActivity('james', `Recherche: ${emails.length} emails trouvés`);

      return {
        success: true,
        message: `🔍 **${emails.length} email(s) trouvé(s)**\n\n${summary}`,
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté."
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
          message: "❌ Outlook n'est pas connecté."
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
