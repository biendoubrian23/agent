const openaiService = require('../services/openai.service');
const whatsappService = require('../services/whatsapp.service');
const mailAgent = require('./mail.agent');
const outlookService = require('../services/outlook.service');

/**
 * Agent Principal (Brian) - Orchestre les autres agents
 * Brian est le manager qui comprend les intentions et délègue aux bons agents
 */
class PrincipalAgent {
  constructor() {
    this.name = 'Brian';
    this.role = 'Assistant Principal & Manager';
    this.myPhoneNumber = process.env.MY_PHONE_NUMBER;
    
    // Prompt de personnalité de Brian
    this.systemPrompt = `Tu es Brian, l'assistant principal et manager d'une équipe d'agents IA chez BiendouCorp.

🎯 TON RÔLE:
- Tu es le point d'entrée de toutes les conversations
- Tu analyses les messages pour comprendre l'intention de l'utilisateur
- Tu délègues aux bons agents selon le sujet

👥 TON ÉQUIPE (pour l'instant):
- **James** (Mail Assistant): Gère TOUT ce qui concerne les emails (Outlook)
  - Classification, résumés, envoi, règles de tri
  - Mots-clés: mail, email, message, boîte de réception, outlook, dossier, classe, trie
  
- **Magali** (Conseillère Bancaire): Analyse financière (pas encore actif)
  - Relevés bancaires, budgets, analyses PDF financiers
  - Mots-clés: banque, compte, argent, budget, relevé, PDF bancaire

🧠 COMMENT ANALYSER UN MESSAGE:

1. **Salutations simples** (bonjour, salut, hello, hey, coucou):
   → Réponds amicalement, ne crée AUCUNE règle

2. **Questions générales** (comment ça va, qui es-tu, aide):
   → Réponds toi-même sans impliquer d'agent

3. **Sujet EMAIL/MAIL** (contient: mail, email, outlook, message, boîte, classe, trie, dossier, james):
   → Délègue à James
   → Détermine si c'est: résumé, classification, création de règle, action immédiate
   
   📊 **EXTRACTION DES NOMBRES:**
   - "mes 2 derniers mails" → count: 2
   - "les 10 derniers emails" → count: 10
   - "le dernier mail" → count: 1
   - "mes mails" (sans nombre) → count: 50 (défaut)
   
   📅 **FILTRES TEMPORELS:**
   - "mails d'aujourd'hui" → filter: "today"
   - "mails de cette semaine" → filter: "week"  
   - "mails d'hier" → filter: "yesterday"
   
   ⭐ **FILTRES D'IMPORTANCE:**
   - "mails importants" → filter: "important"
   - "mails urgents" → filter: "urgent"

4. **Double intention** (ex: "classe les mails eDocPerso dans ISCOD"):
   → L'utilisateur veut SOUVENT les deux: créer une règle ET appliquer maintenant
   → Tu dois proposer les deux options

5. **Gestion des DOSSIERS:**
   - "créer un dossier X" → action: "create_folder", folder: "X"
   - "crée le dossier Publicité" → action: "create_folder", folder: "Publicité"
   - "supprime le dossier X" → action: "delete_folder", folder: "X"
   - "liste mes dossiers" → action: "list_folders"

6. **RE-CLASSIFICATION (emails déjà classés):**
   - "reclasse mes mails" → action: "email_reclassify"
   - "reclasse" → action: "email_reclassify"
   - "reclasse mes 10 derniers mails" → action: "email_reclassify", count: 10
   - "reclasse mes 20 derniers mails" → action: "email_reclassify", count: 20
   - "reclasse les mails du dossier Finance" → action: "email_reclassify", sourceFolder: "🏦 Finance"
   - "reclasse le dossier Social" → action: "email_reclassify", sourceFolder: "🤝 Social"
   - "refais une analyse" → action: "email_reclassify"
   - "refais l'analyse des mails" → action: "email_reclassify"
   - "réanalyse mes mails" → action: "email_reclassify"
   - "ré-analyse" → action: "email_reclassify"
   - "re-classe" → action: "email_reclassify"
   - "applique les nouvelles règles" → action: "email_reclassify"
   - "relance la classification" → action: "email_reclassify"
   
   **Mapping des dossiers:**
   - "finance" → "🏦 Finance"
   - "social" → "🤝 Social"
   - "urgent" → "🔴 Urgent"
   - "professionnel" → "💼 Professionnel"
   - "shopping" → "🛒 Shopping"
   - "newsletter" → "📰 Newsletter"
   - "publicites" ou "pub" → "Publicites" (dossier personnalisé)

7. **Description des agents:**
   - "que peut faire James" → action: "describe_james"
   - "les capacités de James" → action: "describe_james"
   - "quels sont les rôles de James" → action: "describe_james"
   - "les tâches de James" → action: "describe_james"

8. **Sujet BANCAIRE** (contient: banque, compte, argent, magali, budget):
   → Délègue à Magali (pas encore implémenté)

9. **ENVOI D'EMAIL:**
   - "envoie un mail à X@email.com" → action: "send_email"
   - "écris un email à X pour lui dire..." → action: "send_email"
   - "mail à X concernant..." → action: "send_email"
   - "envoie à X avec le sujet..." → action: "send_email"
   - L'email nécessite: destinataire + intention/message
   - C'est différent de "résumer mes mails" ou "classer mes mails"

10. **RECHERCHE D'EMAILS:**
   - "trouve le mail de Jean" → action: "email_search", params: { from: "Jean" }
   - "cherche les mails concernant le devis" → action: "email_search", params: { query: "devis" }
   - "emails de la semaine dernière de Amazon" → action: "email_search"

11. **RÉPONSE RAPIDE:**
   - "réponds au dernier mail de Pierre" → action: "email_reply", params: { from: "Pierre" }
   - "réponds à l'email de Marie pour confirmer" → action: "email_reply"

12. **RAPPELS:**
   - "rappelle-moi demain à 9h de..." → action: "create_reminder"
   - "rappelle-moi dans 2 heures" → action: "create_reminder"
   - "mes rappels" ou "liste mes rappels" → action: "list_reminders"

13. **NETTOYAGE/SUPPRESSION:**
   - "supprime les newsletters de plus de 30 jours" → action: "email_cleanup"
   - "nettoie le dossier Newsletter" → action: "email_cleanup"
   - "supprime les mails de LinkedIn" → action: "email_cleanup"

14. **RÉSUMÉ QUOTIDIEN:**
   - "résumé de ma journée mail" → action: "daily_summary"
   - "résumé quotidien" → action: "daily_summary"
   - "comment va ma boîte mail" → action: "daily_summary"

RÉPONDS UNIQUEMENT EN JSON avec ce format:
{
  "target_agent": "brian" | "james" | "magali",
  "action": "greeting" | "help" | "general_question" | "email_summary" | "email_unread" | "email_classify" | "email_reclassify" | "email_classify_with_rule" | "email_important" | "create_rule_only" | "list_rules" | "reset_config" | "send_email" | "check_status" | "create_folder" | "delete_folder" | "list_folders" | "describe_james" | "delete_rule" | "email_search" | "email_reply" | "create_reminder" | "list_reminders" | "email_cleanup" | "daily_summary" | "unknown",
  "params": {
    "count": number (OBLIGATOIRE pour les emails - extrait du message, défaut 50),
    "filter": "today" | "yesterday" | "week" | "important" | "urgent" | null,
    "pattern": string (optionnel, pour les règles),
    "folder": string (optionnel, pour les règles OU pour créer/supprimer un dossier),
    "sourceFolder": string (optionnel, dossier source pour re-classification, avec emojis si applicable),
    "apply_now": boolean (optionnel, appliquer immédiatement aux mails existants),
    "ruleNumber": number (optionnel, numéro de règle à supprimer),
    "text": string (le message original - TOUJOURS inclure pour send_email, create_reminder),
    "from": string (optionnel, expéditeur pour recherche/réponse),
    "query": string (optionnel, terme de recherche),
    "olderThanDays": number (optionnel, pour nettoyage)
  },
  "confidence": number (0-100),
  "reasoning": "explication courte de ton analyse"
}

EXEMPLES:
- "résume mes 3 derniers mails" → action: "email_summary", count: 3
- "classe mes 5 derniers mails" → action: "email_classify", count: 5
- "le dernier mail" → action: "email_summary", count: 1
- "mails importants d'aujourd'hui" → action: "email_important", filter: "today"
- "envoie un mail à jean@test.com pour lui dire bonjour" → action: "send_email", text: "..."
- "rappelle moi mes mails" → action: "email_summary", count: 10`;
  }

  /**
   * Traiter un message WhatsApp entrant
   */
  async handleWhatsAppMessage(message) {
    const { from, text, name } = message;
    
    console.log(`📱 Message de ${name} (${from}): ${text}`);

    // PRIORITÉ 1: Vérifier si l'utilisateur a un brouillon en attente
    if (mailAgent.hasPendingDraft(from)) {
      const draftResponse = await this.handleDraftInteraction(from, text);
      if (draftResponse) {
        await whatsappService.sendLongMessage(from, draftResponse);
        return draftResponse;
      }
    }

    // Analyser l'intention du message
    const intent = await this.analyzeIntent(text);
    
    let response;

    switch (intent.action) {
      case 'greeting':
        response = await this.handleGreeting(intent.params);
        break;

      case 'email_summary':
        response = await this.handleEmailSummary(intent.params);
        break;
      
      case 'email_unread':
        response = await this.handleUnreadEmails(intent.params);
        break;
      
      case 'email_classify':
        response = await this.handleEmailClassification(intent.params);
        break;

      case 'email_important':
        response = await this.handleImportantEmails(intent.params);
        break;

      case 'email_classify_with_rule':
        response = await this.handleClassifyWithRule(intent.params);
        break;

      case 'email_classify_memory':
        response = await this.handleClassificationMemory();
        break;

      case 'email_reclassify':
        response = await this.handleReclassifyEmails(intent.params);
        break;
      
      case 'config_james':
        response = await this.handleConfigJames(intent.params);
        break;

      case 'config_list_rules':
        response = this.handleListRules();
        break;

      case 'delete_rule':
        response = await this.handleDeleteRule(intent.params);
        break;

      case 'config_reset':
        response = this.handleResetConfig();
        break;
      
      case 'send_email':
        response = await this.handleSendEmail(from, intent.params);
        break;

      case 'confirm_send':
        response = await this.handleConfirmSend(from);
        break;

      case 'cancel_draft':
        response = await this.handleCancelDraft(from);
        break;

      case 'revise_draft':
        response = await this.handleReviseDraft(from, intent.params);
        break;

      case 'check_connection':
        response = await this.checkConnections();
        break;

      case 'create_folder':
        response = await this.handleCreateFolder(intent.params);
        break;

      case 'delete_folder':
        response = await this.handleDeleteFolder(intent.params);
        break;

      case 'list_folders':
        response = await this.handleListFolders();
        break;

      case 'email_search':
        response = await this.handleEmailSearch(intent.params);
        break;

      case 'email_reply':
        response = await this.handleQuickReply(from, intent.params);
        break;

      case 'create_reminder':
        response = await this.handleSetReminder(from, intent.params);
        break;

      case 'list_reminders':
        response = await this.handleListReminders(from);
        break;

      case 'email_cleanup':
        response = await this.handleCleanEmails(intent.params);
        break;

      case 'daily_summary':
        response = await this.handleDailySummary();
        break;

      case 'help':
        response = this.getHelpMessage();
        break;

      case 'describe_james':
        response = this.getJamesCapabilities();
        break;

      default:
        response = await this.handleGeneralQuestion(text);
    }

    // Envoyer la réponse via WhatsApp
    await whatsappService.sendLongMessage(from, response);
    
    return response;
  }

  /**
   * Analyser l'intention du message avec l'IA
   */
  async analyzeIntent(text) {
    console.log('🧠 Brian analyse le message:', text);
    
    try {
      // Utiliser GPT pour analyser l'intention
      const response = await openaiService.chat([
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Analyse ce message et détermine l'intention:\n\n"${text}"` }
      ], { temperature: 0.1 }); // Basse température pour plus de consistance

      // Parser la réponse JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('🎯 Intention détectée:', parsed.action, '| Agent:', parsed.target_agent, '| Confiance:', parsed.confidence + '%');
        console.log('💭 Raisonnement:', parsed.reasoning);
        
        // Mapper vers le format attendu par handleWhatsAppMessage
        return this.mapIntentToAction(parsed, text);
      }
    } catch (error) {
      console.error('❌ Erreur analyse IA:', error.message);
    }

    // Fallback: analyse simple si l'IA échoue
    console.log('⚠️ Fallback vers analyse simple');
    return this.analyzeIntentSimple(text);
  }

  /**
   * Extraire le nom du dossier d'un message
   */
  extractFolderName(text) {
    // Patterns pour extraire le nom du dossier
    const patterns = [
      /(?:dossier|folder)\s+["']?([^"'\n]+?)["']?(?:\s|$)/i,
      /(?:crée?|créer|supprimer?|supprime)\s+(?:le\s+)?(?:dossier\s+)?["']?([^"'\n]+?)["']?(?:\s|$)/i,
      /["']([^"']+)["']/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        // Nettoyer le nom du dossier
        let folderName = match[1].trim();
        // Enlever les mots-clés parasites
        folderName = folderName.replace(/^(le|la|un|une)\s+/i, '');
        if (folderName.length > 1 && folderName.length < 50) {
          return folderName;
        }
      }
    }
    return null;
  }

  /**
   * Mapper l'intention IA vers une action
   */
  mapIntentToAction(parsed, originalText) {
    const { action, params = {} } = parsed;
    
    // Toujours garder le texte original
    params.text = originalText;

    switch (action) {
      case 'greeting':
        return { action: 'greeting', params };
      
      case 'help':
        return { action: 'help', params };
      
      case 'general_question':
        return { action: 'general', params };
      
      case 'email_summary':
        return { 
          action: 'email_summary', 
          params: { 
            count: params.count || 50,
            filter: params.filter || null
          } 
        };
      
      case 'email_unread':
        return { action: 'email_unread', params: { count: params.count || 20 } };
      
      case 'email_classify':
        return { action: 'email_classify', params: { count: params.count || 50 } };
      
      case 'email_reclassify':
        return { action: 'email_reclassify', params: { count: params.count || 30, sourceFolder: params.sourceFolder || null } };
      
      case 'email_important':
        return { 
          action: 'email_important', 
          params: { 
            count: params.count || 50,
            filter: params.filter || 'important'
          } 
        };
      
      case 'email_classify_with_rule':
        // L'utilisateur veut créer une règle ET l'appliquer maintenant
        return { 
          action: 'email_classify_with_rule', 
          params: { 
            ...params, 
            apply_now: true,
            text: originalText
          } 
        };
      
      case 'create_rule_only':
        return { action: 'config_james', params: { text: originalText } };
      
      case 'list_rules':
        return { action: 'config_list_rules', params };
      
      case 'reset_config':
        return { action: 'config_reset', params };
      
      case 'send_email':
        return { action: 'send_email', params };
      
      case 'check_status':
        return { action: 'check_connection', params };
      
      case 'create_folder':
        return { action: 'create_folder', params: { folder: params.folder } };
      
      case 'delete_folder':
        return { action: 'delete_folder', params: { folder: params.folder } };
      
      case 'list_folders':
        return { action: 'list_folders', params };
      
      case 'describe_james':
        return { action: 'describe_james', params };
      
      case 'delete_rule':
        return { action: 'delete_rule', params: { ruleNumber: params.ruleNumber } };
      
      case 'email_search':
        return { action: 'email_search', params: { query: params.query, filter: params.filter } };
      
      case 'set_reminder':
        return { action: 'set_reminder', params: { message: params.message, delay: params.delay, time: params.time } };
      
      case 'quick_reply':
        return { action: 'quick_reply', params: { searchQuery: params.searchQuery, replyInstructions: params.replyInstructions } };
      
      case 'clean_emails':
        return { action: 'clean_emails', params: { folder: params.folder, daysOld: params.daysOld } };
      
      case 'daily_summary':
        return { action: 'daily_summary', params };
      
      default:
        return { action: 'general', params };
    }
  }

  /**
   * Analyse simple en fallback (si l'IA échoue)
   */
  analyzeIntentSimple(text) {
    const lowerText = text.toLowerCase();

    // Salutations simples
    if (/^(salut|bonjour|hello|hey|coucou|hi|yo|wesh)(\s|!|$)/i.test(lowerText) || 
        lowerText.length < 15 && (lowerText.includes('salut') || lowerText.includes('coucou') || lowerText.includes('bonjour'))) {
      return { action: 'greeting', params: {} };
    }

    // Gestion des dossiers (avant les emails)
    if ((lowerText.includes('créer') || lowerText.includes('crée') || lowerText.includes('créé') || lowerText.includes('cree')) && 
        (lowerText.includes('dossier') || lowerText.includes('folder'))) {
      const folderName = this.extractFolderName(text);
      return { action: 'create_folder', params: { folder: folderName } };
    }

    if ((lowerText.includes('supprimer') || lowerText.includes('supprime') || lowerText.includes('delete') || lowerText.includes('efface')) && 
        (lowerText.includes('dossier') || lowerText.includes('folder'))) {
      const folderName = this.extractFolderName(text);
      return { action: 'delete_folder', params: { folder: folderName } };
    }

    if ((lowerText.includes('liste') || lowerText.includes('voir') || lowerText.includes('affiche') || lowerText.includes('montre')) && 
        (lowerText.includes('dossier') || lowerText.includes('folders'))) {
      return { action: 'list_folders', params: {} };
    }

    // Détection des commandes de configuration de James avec ACTION IMMÉDIATE
    // Ex: "regarde les mails eDocPerso et classe dans ISCOD"
    if ((lowerText.includes('mail') || lowerText.includes('email')) && 
        (lowerText.includes('class') || lowerText.includes('mets') || lowerText.includes('range') || lowerText.includes('déplace')) &&
        (lowerText.includes('dans') || lowerText.includes('dossier'))) {
      
      // C'est une demande de règle + action immédiate
      return { action: 'email_classify_with_rule', params: { text, apply_now: true } };
    }

    // Détection des commandes de configuration de James (règles seulement)
    if (lowerText.includes('règle') || lowerText.includes('regle') || 
        lowerText.includes('config') || 
        lowerText.includes('prompt de james') || lowerText.includes('instruction')) {
      
      // Suppression d'une règle par numéro
      const deleteRuleMatch = lowerText.match(/(?:supprime|supprimer|delete|enleve|enlève|retire)\s*(?:la\s*)?r[eè]gle\s*(?:n[o°]?)?\s*(\d+)/i);
      if (deleteRuleMatch) {
        return { action: 'delete_rule', params: { ruleNumber: parseInt(deleteRuleMatch[1]) } };
      }
      
      // Si c'est une demande de voir les règles
      if (lowerText.includes('voir') || lowerText.includes('liste') || lowerText.includes('affiche') || lowerText.includes('quelles') || lowerText.includes('rappelle')) {
        return { action: 'config_list_rules', params: {} };
      }
      
      // Si c'est une demande de reset
      if (lowerText.includes('réinitialise') || lowerText.includes('reset') || lowerText.includes('supprime tout')) {
        return { action: 'config_reset', params: {} };
      }
      
      // Sinon c'est une configuration à parser
      return { action: 'config_james', params: { text } };
    }

    // Suppression de règle par numéro (format direct sans "règle")
    const directDeleteMatch = lowerText.match(/(?:supprime|supprimer|delete|enleve|enlève|retire)\s*(?:la\s*)?(?:r[eè]gle\s*)?(?:n[o°]?)?\s*(\d+)/i);
    if (directDeleteMatch && !lowerText.includes('dossier') && !lowerText.includes('mail')) {
      return { action: 'delete_rule', params: { ruleNumber: parseInt(directDeleteMatch[1]) } };
    }

    // Détection de reclassification (même sans le mot "mail" explicite)
    const isReclassify = (
      lowerText.includes('reclasse') || lowerText.includes('re-classe') || lowerText.includes('ré-classe') ||
      lowerText.includes('reclass') || lowerText.includes('re-class') || lowerText.includes('ré-class') ||
      lowerText.includes('réanalyse') || lowerText.includes('re-analyse') || lowerText.includes('ré-analyse') ||
      lowerText.includes('reanalyse') || lowerText.includes('re-analy') || lowerText.includes('réanaly') ||
      (lowerText.includes('refais') && (lowerText.includes('analyse') || lowerText.includes('classement') || lowerText.includes('classification') || lowerText.includes('tri'))) ||
      (lowerText.includes('refait') && (lowerText.includes('analyse') || lowerText.includes('classement') || lowerText.includes('classification') || lowerText.includes('tri'))) ||
      (lowerText.includes('relance') && (lowerText.includes('class') || lowerText.includes('tri') || lowerText.includes('analyse'))) ||
      (lowerText.includes('applique') && lowerText.includes('règle') && (lowerText.includes('nouveau') || lowerText.includes('nouvelle'))) ||
      (lowerText.includes('déjà class') || lowerText.includes('deja class')) ||
      (lowerText.includes('repass') && (lowerText.includes('class') || lowerText.includes('analyse') || lowerText.includes('mail')))
    );
    
    if (isReclassify) {
      const countMatch = lowerText.match(/(\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 30;
      
      // Détecter le dossier source
      let sourceFolder = null;
      
      // Mapping des noms de dossiers
      const folderMapping = {
        'finance': '🏦 Finance',
        'social': '🤝 Social',
        'urgent': '🔴 Urgent',
        'professionnel': '💼 Professionnel',
        'pro': '💼 Professionnel',
        'shopping': '🛒 Shopping',
        'newsletter': '📰 Newsletter',
        'news': '📰 Newsletter',
        'publicites': 'Publicites',
        'publicité': 'Publicites',
        'pub': 'Publicites',
        'iscod': 'ISCOD'
      };
      
      // Chercher un dossier mentionné
      const folderMatch = lowerText.match(/(?:dossier|du dossier|le dossier|dans)\s+(\w+)/i);
      if (folderMatch) {
        const folderKey = folderMatch[1].toLowerCase();
        sourceFolder = folderMapping[folderKey] || folderMatch[1]; // Utiliser le mapping ou le nom brut
      } else {
        // Vérifier si un nom de dossier est mentionné directement
        for (const [key, value] of Object.entries(folderMapping)) {
          if (lowerText.includes(key)) {
            sourceFolder = value;
            break;
          }
        }
      }
      
      return { action: 'email_reclassify', params: { count, sourceFolder } };
    }

    // Détection simple des intentions email
    if (lowerText.includes('mail') || lowerText.includes('email') || lowerText.includes('e-mail')) {
      
      // Classification des emails (sans pattern spécifique)
      if ((lowerText.includes('class') || lowerText.includes('trie') || lowerText.includes('organise') || lowerText.includes('range')) &&
          !lowerText.includes('dans')) {
        const countMatch = lowerText.match(/(\d+)/);
        const count = countMatch ? parseInt(countMatch[1]) : 50;
        return { action: 'email_classify', params: { count } };
      }
      if (lowerText.includes('non lu') || lowerText.includes('unread') || lowerText.includes('nouveau')) {
        return { action: 'email_unread', params: {} };
      }
      if (lowerText.includes('résumé') || lowerText.includes('recap') || lowerText.includes('résumer') || 
          lowerText.includes('dernier') || lowerText.includes('rappelle')) {
        const countMatch = lowerText.match(/(\d+)/);
        const count = countMatch ? parseInt(countMatch[1]) : 10;
        return { action: 'email_summary', params: { count } };
      }
      if (lowerText.includes('important') || lowerText.includes('urgent')) {
        return { action: 'email_important', params: { filter: 'important' } };
      }
      // Envoi d'email (doit contenir une adresse ou mention d'envoi)
      if ((lowerText.includes('envoyer') || lowerText.includes('envoie') || lowerText.includes('écris')) &&
          (lowerText.includes('@') || lowerText.includes('mail à') || lowerText.includes('email à'))) {
        return { action: 'send_email', params: { text } };
      }
    }

    // Détection d'envoi d'email même sans le mot "mail/email" explicite
    // Ex: "envoie à jean@test.com pour lui dire..."
    if ((lowerText.includes('envoie') || lowerText.includes('envoyer') || lowerText.includes('écris')) && 
        lowerText.includes('@')) {
      return { action: 'send_email', params: { text } };
    }

    // Classification sans mentionner "email"
    if (lowerText.includes('class') && (lowerText.includes('mes') || lowerText.includes('la') || lowerText.includes('boite'))) {
      const countMatch = lowerText.match(/(\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 50;
      return { action: 'email_classify', params: { count } };
    }

    // Mémoire de classification
    if (lowerText.includes('mémoire') || lowerText.includes('historique class') || lowerText.includes('dernière class')) {
      return { action: 'email_classify_memory', params: {} };
    }

    if (lowerText.includes('connexion') || lowerText.includes('status') || lowerText.includes('connecté')) {
      return { action: 'check_connection', params: {} };
    }

    if (lowerText.includes('aide') || lowerText.includes('help') || lowerText === 'commandes') {
      return { action: 'help', params: {} };
    }

    // Description des capacités de James
    if ((lowerText.includes('james') || lowerText.includes('mail agent')) && 
        (lowerText.includes('capable') || lowerText.includes('peut faire') || lowerText.includes('sait faire') || 
         lowerText.includes('rôle') || lowerText.includes('role') || lowerText.includes('tâche') || lowerText.includes('tache') ||
         lowerText.includes('fonction') || lowerText.includes('quoi') || lowerText.includes('capacit'))) {
      return { action: 'describe_james', params: {} };
    }

    // Recherche d'emails
    if ((lowerText.includes('cherche') || lowerText.includes('trouve') || lowerText.includes('recherche') || 
         lowerText.includes('search') || lowerText.includes('retrouve')) && 
        (lowerText.includes('mail') || lowerText.includes('email') || lowerText.includes('message'))) {
      return { action: 'email_search', params: { query: text } };
    }

    // Rappels / Reminders
    if (lowerText.includes('rappel') || lowerText.includes('remind') || lowerText.includes('rappelle') ||
        lowerText.includes('n\'oublie pas') || lowerText.includes('noublie pas') ||
        (lowerText.includes('préviens') && lowerText.includes('dans'))) {
      return { action: 'set_reminder', params: { message: text } };
    }

    // Réponse rapide à un email
    if ((lowerText.includes('répond') || lowerText.includes('reply') || lowerText.includes('répondre')) && 
        (lowerText.includes('mail') || lowerText.includes('email') || lowerText.includes('message'))) {
      return { action: 'quick_reply', params: { searchQuery: text, replyInstructions: text } };
    }

    // Nettoyage d'emails
    if ((lowerText.includes('nettoie') || lowerText.includes('nettoyer') || lowerText.includes('supprime') || 
         lowerText.includes('vide') || lowerText.includes('efface') || lowerText.includes('clean')) && 
        (lowerText.includes('vieux') || lowerText.includes('ancien') || lowerText.includes('old') ||
         lowerText.includes('jours') || lowerText.includes('semaine') || lowerText.includes('mois'))) {
      return { action: 'clean_emails', params: { text } };
    }

    // Résumé quotidien
    if ((lowerText.includes('résumé') || lowerText.includes('bilan') || lowerText.includes('recap')) && 
        (lowerText.includes('journée') || lowerText.includes('jour') || lowerText.includes('quotidien') || 
         lowerText.includes('daily') || lowerText.includes('aujourd'))) {
      return { action: 'daily_summary', params: {} };
    }

    return { action: 'general', params: { text } };
  }

  /**
   * Gérer les salutations simples
   */
  async handleGreeting(params) {
    const greetings = [
      `👋 Salut ! Je suis Brian, ton assistant principal.\n\nJe manage une équipe d'agents IA:\n• 📧 **James** - Gestion des emails\n• 💰 **Magali** - Conseils bancaires (bientôt)\n\nQue puis-je faire pour toi ?`,
      `Hey ! 👋 Brian à ton service !\n\nDis-moi ce dont tu as besoin:\n• Emails ? Je passe le relais à James\n• Questions ? Je réponds directement\n\nTape "aide" pour voir toutes mes capacités !`,
      `Bonjour ! 🙌 Je suis Brian.\n\nJe suis là pour t'aider avec tes emails (via James) et bientôt tes finances (via Magali).\n\nQu'est-ce que je peux faire pour toi ?`
    ];
    
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Gérer la demande de résumé d'emails
   */
  async handleEmailSummary(params) {
    const count = params.count || 50;
    const filter = params.filter || null;
    
    let logMessage = `📧 James analyse les ${count} derniers emails`;
    if (filter) logMessage += ` (filtre: ${filter})`;
    console.log(logMessage + '...');
    
    const result = await mailAgent.getEmailSummary(count, filter);
    
    if (!result.success) {
      if (result.message.includes('pas connecté')) {
        return `${result.message}\n\n🔗 Connectez-vous ici: ${process.env.AZURE_REDIRECT_URI?.replace('/callback', '')}`;
      }
      return result.message;
    }

    const countInfo = count === 1 ? 'votre dernier email' : `vos ${count} derniers emails`;
    return `🤖 **James** a analysé ${countInfo}:\n\n${result.message}`;
  }

  /**
   * Gérer les emails non lus
   */
  async handleUnreadEmails(params = {}) {
    const count = params.count || 20;
    console.log(`📧 James vérifie les ${count} emails non lus...`);
    
    const result = await mailAgent.getUnreadSummary(count);
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Gérer les emails importants/urgents
   */
  async handleImportantEmails(params) {
    const count = params.count || 50;
    const filter = params.filter || 'important';
    
    console.log(`⭐ James cherche les emails ${filter}...`);
    
    const result = await mailAgent.getImportantEmails(count, filter);
    
    if (!result.success) {
      if (result.message.includes('pas connecté')) {
        return `${result.message}\n\n🔗 Connectez-vous ici: ${process.env.AZURE_REDIRECT_URI?.replace('/callback', '')}`;
      }
      return result.message;
    }

    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Gérer la classification des emails dans les dossiers Outlook
   */
  async handleEmailClassification(params) {
    const count = params.count || 50;
    
    console.log(`📂 James classifie les ${count} derniers emails dans les dossiers Outlook...`);
    
    const result = await mailAgent.classifyAndOrganizeEmails(count);
    
    if (!result.success) {
      if (result.message.includes('pas connecté')) {
        return `${result.message}\n\n🔗 Connectez-vous ici: ${process.env.AZURE_REDIRECT_URI?.replace('/callback', '')}`;
      }
      return result.message;
    }

    return `🤖 **James** a organisé vos emails:\n\n${result.message}`;
  }

  /**
   * Re-classifier les emails déjà classés avec les nouvelles règles
   */
  async handleReclassifyEmails(params) {
    const count = params.count || 30;
    const sourceFolder = params.sourceFolder || null;
    
    if (sourceFolder) {
      console.log(`🔄 James re-classifie les ${count} derniers emails du dossier "${sourceFolder}"...`);
    } else {
      console.log(`🔄 James re-classifie les emails déjà classés (${count} par dossier)...`);
    }
    
    const result = await mailAgent.reclassifyEmails(count, sourceFolder);
    
    if (!result.success) {
      if (result.message.includes('pas connecté')) {
        return `${result.message}\n\n🔗 Connectez-vous ici: ${process.env.AZURE_REDIRECT_URI?.replace('/callback', '')}`;
      }
      return result.message;
    }

    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Créer une règle ET l'appliquer immédiatement aux emails existants
   */
  async handleClassifyWithRule(params) {
    console.log('📂⚙️ James: Création de règle + Application immédiate...');
    
    const messages = [];
    
    try {
      // 1. D'abord, parser et créer la règle
      const parsed = await openaiService.parseConfigCommand(params.text);
      
      if (parsed.action === 'add_rule' && parsed.rules && parsed.rules.length > 0) {
        for (const rule of parsed.rules) {
          await openaiService.addCustomRule(rule);
          messages.push(`✅ Règle créée: "${rule.pattern}" → ${rule.folder}`);
        }
        
        // 2. Ensuite, appliquer aux emails existants
        messages.push(`\n⏳ Application aux emails existants...`);
        
        // Chercher les emails qui correspondent au pattern
        const pattern = parsed.rules[0].pattern;
        const folder = parsed.rules[0].folder;
        
        const searchResult = await mailAgent.searchAndMoveEmails(pattern, folder);
        
        if (searchResult.success) {
          messages.push(`\n📬 **Résultat:**`);
          messages.push(`• ${searchResult.found} emails trouvés contenant "${pattern}"`);
          messages.push(`• ${searchResult.moved} emails déplacés vers ${folder}`);
          
          if (searchResult.found === 0) {
            messages.push(`\n💡 Aucun email existant ne correspond, mais les prochains seront classés automatiquement !`);
          }
        } else {
          messages.push(`\n⚠️ ${searchResult.message}`);
        }
        
        messages.push(`\n💾 Règle sauvegardée dans Supabase`);
        
      } else {
        messages.push(`❓ Je n'ai pas compris la règle à créer.`);
        messages.push(`\nExemple: "Classe les mails eDocPerso dans ISCOD"`);
      }
      
    } catch (error) {
      console.error('Erreur handleClassifyWithRule:', error);
      messages.push(`❌ Erreur: ${error.message}`);
    }
    
    return `🤖 **James** rapporte:\n\n${messages.join('\n')}`;
  }

  /**
   * Obtenir la mémoire de classification
   */
  async handleClassificationMemory() {
    console.log('📊 James consulte la mémoire de classification...');
    
    const result = mailAgent.getLastClassificationSummary();
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Supprimer une règle par son numéro
   */
  async handleDeleteRule(params) {
    const ruleNumber = params.ruleNumber;
    
    if (!ruleNumber) {
      return `❓ Quel numéro de règle voulez-vous supprimer ?\n\nTapez "voir mes règles" pour voir la liste numérotée.`;
    }

    console.log(`🗑️ Suppression de la règle n°${ruleNumber}...`);
    
    const result = await openaiService.removeCustomRuleByIndex(ruleNumber);
    
    if (result.success) {
      return `🗑️ **Règle supprimée !**\n\n${result.message}\n\n💾 Supprimé de Supabase`;
    }
    
    return `❌ ${result.message}`;
  }

  /**
   * Créer un dossier personnalisé via WhatsApp
   */
  async handleCreateFolder(params) {
    const folderName = params.folder;
    
    if (!folderName) {
      return `❓ Quel nom voulez-vous donner au dossier ?\n\nExemple: "Crée le dossier Publicité"`;
    }

    console.log(`📁 James crée le dossier "${folderName}"...`);
    
    const result = await mailAgent.createFolder(folderName);
    
    if (result.success) {
      return `🤖 **James** rapporte:\n\n${result.message}\n\n💡 Vous pouvez maintenant créer des règles pour ce dossier:\n"Classe les mails X dans ${folderName}"`;
    }
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Supprimer un dossier via WhatsApp (emails déplacés vers Inbox)
   */
  async handleDeleteFolder(params) {
    const folderName = params.folder;
    
    if (!folderName) {
      return `❓ Quel dossier voulez-vous supprimer ?\n\nExemple: "Supprime le dossier Publicité"\n\n⚠️ Les emails du dossier seront déplacés vers la boîte de réception.`;
    }

    console.log(`🗑️ James supprime le dossier "${folderName}"...`);
    
    const result = await mailAgent.deleteFolder(folderName);
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Lister tous les dossiers personnalisés
   */
  async handleListFolders() {
    console.log(`📁 James liste les dossiers...`);
    
    const result = await mailAgent.listFolders();
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Configurer James via commande naturelle
   */
  async handleConfigJames(params) {
    console.log('⚙️ Configuration de James demandée...');
    
    try {
      const parsed = await openaiService.parseConfigCommand(params.text);
      
      if (parsed.action === 'unknown') {
        return `❓ ${parsed.message}\n\nExemples de commandes:\n• "Mets les mails de LinkedIn dans Newsletter"\n• "Classe les mails eDocPerso dans ISCOD"\n• "Voir mes règles"`;
      }

      if (parsed.action === 'add_rule' && parsed.rules && parsed.rules.length > 0) {
        const addedRules = [];
        for (const rule of parsed.rules) {
          await openaiService.addCustomRule(rule);
          addedRules.push(`📌 ${rule.pattern} → ${rule.folder}`);
        }
        
        return `✅ **Règle(s) ajoutée(s) pour James !**\n\n${addedRules.join('\n')}\n\n💾 Sauvegardé dans Supabase\n${parsed.message || 'La prochaine classification utilisera ces règles.'}`;
      }

      if (parsed.action === 'add_instruction' && parsed.instruction) {
        await openaiService.addJamesInstruction(parsed.instruction);
        return `✅ **Instruction ajoutée au prompt de James !**\n\n📝 "${parsed.instruction}"\n\n💾 Sauvegardé dans Supabase\nVous pouvez voir le prompt complet dans le frontend.`;
      }

      if (parsed.action === 'list_rules') {
        return this.handleListRules();
      }

      if (parsed.action === 'remove_rule' && parsed.rules && parsed.rules.length > 0) {
        const removed = [];
        for (const rule of parsed.rules) {
          if (await openaiService.removeCustomRule(rule.pattern)) {
            removed.push(rule.pattern);
          }
        }
        if (removed.length > 0) {
          return `🗑️ **Règle(s) supprimée(s):** ${removed.join(', ')}\n\n💾 Supprimé de Supabase`;
        }
        return `❌ Aucune règle trouvée à supprimer.`;
      }

      return parsed.message || "Configuration effectuée !";
    } catch (error) {
      console.error('Erreur config James:', error);
      return `❌ Erreur lors de la configuration: ${error.message}`;
    }
  }

  /**
   * Lister les règles de configuration
   */
  handleListRules() {
    const rules = openaiService.getCustomRules();
    const instructions = openaiService.getJamesInstructions();
    
    let message = `⚙️ **Configuration de James**\n\n`;
    
    if (rules.length === 0 && !instructions) {
      message += `📭 Aucune règle personnalisée configurée.\n\n`;
      message += `💡 **Exemples de commandes:**\n`;
      message += `• "Mets les mails de LinkedIn dans Newsletter"\n`;
      message += `• "Classe les mails eDocPerso dans ISCOD"\n`;
      message += `• "Ajoute une règle: les mails Amazon vont dans Shopping"`;
    } else {
      if (rules.length > 0) {
        message += `📌 **Règles de classification (${rules.length}):**\n`;
        rules.forEach((rule, i) => {
          message += `${i + 1}. "${rule.pattern}" → ${rule.folder} (${rule.type})\n`;
        });
        message += '\n';
      }
      
      if (instructions) {
        message += `📝 **Instructions personnalisées:**\n${instructions}\n`;
      }
      
      message += `\n💾 _Données sauvegardées dans Supabase_`;
    }
    
    return message;
  }

  /**
   * Réinitialiser la configuration de James
   */
  async handleResetConfig() {
    await openaiService.resetJamesInstructions();
    // Vider les règles dans Supabase
    const supabaseService = require('../services/supabase.service');
    await supabaseService.clearAllRules();
    
    // Vider le cache local
    openaiService.getCustomRules().length = 0;
    
    return `🔄 **Configuration de James réinitialisée !**\n\nToutes les règles et instructions personnalisées ont été supprimées de Supabase.`;
  }

  /**
   * Gérer l'envoi d'email - Crée un brouillon pour validation
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @param {Object} params - Paramètres de la demande
   */
  async handleSendEmail(phoneNumber, params) {
    console.log('📧 James: Création d\'un brouillon d\'email...');
    
    const result = await mailAgent.composeDraft(phoneNumber, params.text);
    
    if (result.success) {
      return `🤖 **James** a préparé votre email:\n\n${result.message}`;
    }
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Gérer les interactions avec un brouillon en attente
   * @param {string} phoneNumber 
   * @param {string} text - Message de l'utilisateur
   */
  async handleDraftInteraction(phoneNumber, text) {
    const lowerText = text.toLowerCase().trim();
    
    // Confirmation d'envoi
    const sendKeywords = ['envoie', 'envoyer', 'envoi', 'ok', 'oui', 'yes', 'send', 'go', 'parfait', 'c\'est bon', 'valide', 'confirme', 'tu peux envoyer', 'envoie-le', 'envoie le'];
    if (sendKeywords.some(kw => lowerText.includes(kw)) || lowerText === 'ok' || lowerText === 'oui') {
      return await this.handleConfirmSend(phoneNumber);
    }
    
    // Annulation
    const cancelKeywords = ['annule', 'annuler', 'cancel', 'non', 'stop', 'laisse tomber', 'oublie', 'pas la peine'];
    if (cancelKeywords.some(kw => lowerText.includes(kw))) {
      return await this.handleCancelDraft(phoneNumber);
    }
    
    // Modification demandée - tout autre message est une demande de révision
    // (sauf si c'est clairement autre chose)
    const isNewRequest = lowerText.includes('nouveau mail') || 
                         lowerText.includes('autre mail') || 
                         lowerText.includes('nouvel email') ||
                         (lowerText.includes('envoie un mail') && lowerText.includes('@'));
    
    if (isNewRequest) {
      // Annuler l'ancien brouillon et créer un nouveau
      mailAgent.cancelDraft(phoneNumber);
      return null; // Retourner null pour continuer le flow normal
    }
    
    // C'est une demande de révision
    return await this.handleReviseDraft(phoneNumber, { instructions: text });
  }

  /**
   * Confirmer et envoyer le brouillon
   * @param {string} phoneNumber 
   */
  async handleConfirmSend(phoneNumber) {
    console.log('📤 James: Envoi du brouillon confirmé...');
    
    const result = await mailAgent.sendDraft(phoneNumber);
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Annuler le brouillon en cours
   * @param {string} phoneNumber 
   */
  async handleCancelDraft(phoneNumber) {
    console.log('🗑️ James: Annulation du brouillon...');
    
    const result = mailAgent.cancelDraft(phoneNumber);
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Réviser le brouillon selon les instructions
   * @param {string} phoneNumber 
   * @param {Object} params 
   */
  async handleReviseDraft(phoneNumber, params) {
    console.log('✏️ James: Révision du brouillon...');
    
    const result = await mailAgent.reviseDraft(phoneNumber, params.instructions || params.text);
    
    if (result.success) {
      let response = `🤖 **James** a modifié le brouillon:\n\n`;
      if (result.changes) {
        response += `✏️ _${result.changes}_\n\n`;
      }
      response += result.message;
      return response;
    }
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Vérifier l'état des connexions
   */
  async checkConnections() {
    const connections = [];
    
    // WhatsApp
    connections.push('✅ WhatsApp: Connecté');

    // Outlook
    if (outlookService.isConnected()) {
      try {
        const user = await outlookService.getUserInfo();
        connections.push(`✅ Outlook: Connecté (${user.email})`);
      } catch {
        connections.push('⚠️ Outlook: Token expiré');
      }
    } else {
      connections.push('❌ Outlook: Non connecté');
    }

    return `📊 **État des connexions**\n\n${connections.join('\n')}`;
  }

  /**
   * Message d'aide
   */
  getHelpMessage() {
    return `🤖 **Services de James**

📧 *Emails*
→ "Résume mes 10 derniers mails"
→ "Emails non lus"

📂 *Classification*
→ "Classe mes emails"
→ "Reclasse le dossier Newsletter"

🔍 *Recherche*
→ "Cherche les mails d'Amazon"

📤 *Envoi*
→ "Envoie un mail à x@email.com pour..."

✉️ *Réponse rapide*
→ "Réponds au mail de Jean pour accepter"

⏰ *Rappels*
→ "Rappelle-moi dans 1h de..."
→ "Mes rappels" (voir la liste)

🗑️ *Nettoyage*
→ "Nettoie les mails +30j dans Newsletter"

⚙️ *Règles*
→ "Mets les mails LinkedIn dans Newsletter"
→ "Voir mes règles"
→ "Supprime la règle 2"

📁 *Dossiers*
→ "Crée le dossier Projets"
→ "Supprime le dossier Pub"
→ "Liste mes dossiers"

📊 *Résumé quotidien*
→ "Résumé de ma journée"

🔧 *Status*
→ "Status" ou "Connexion"`;
  }

  /**
   * Décrire toutes les capacités de James
   */
  getJamesCapabilities() {
    return `🤖 **James - Assistant Mail**

📧 *Lecture* → "Résume mes 10 mails"
📂 *Classification* → "Classe mes emails"
🔄 *Reclassement* → "Reclasse Newsletter"
🔍 *Recherche* → "Cherche mails d'Amazon"
📤 *Envoi* → "Envoie mail à x@email.com"
✉️ *Réponse* → "Réponds au mail de Jean"
⏰ *Rappels* → "Rappelle-moi dans 1h"
📋 *Mes rappels* → "Mes rappels"
🗑️ *Nettoyage* → "Nettoie +30j dans Spam"
⚙️ *Règles* → "Mets LinkedIn dans Newsletter"
🗑️ *Suppr règle* → "Supprime la règle 2"
📁 *Créer dossier* → "Crée dossier Projets"
🗑️ *Suppr dossier* → "Supprime dossier Pub"
📋 *Liste dossiers* → "Mes dossiers"
📊 *Résumé* → "Résumé de ma journée"
🔧 *Status* → "Status"

📂 Dossiers: 🔴Urgent 💼Pro 🛒Shopping 📰Newsletter 🏦Finance 🤝Social`;
  }

  /**
   * Recherche d'emails par mots-clés
   */
  async handleEmailSearch(params) {
    const query = params.query || params.text;
    
    if (!query) {
      return `🔍 **Recherche d'emails**\n\nQue cherchez-vous ?\n\nExemples:\n• "Cherche les mails de LinkedIn"\n• "Trouve les emails contenant facture"\n• "Recherche les mails d'Amazon du mois dernier"`;
    }

    console.log(`🔍 James recherche: "${query}"...`);
    
    const result = await mailAgent.searchEmails(query);
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Définir un rappel avec notification WhatsApp
   */
  async handleSetReminder(from, params) {
    const message = params.message || params.text;
    
    if (!message) {
      return `⏰ **Créer un rappel**\n\nExemples:\n• "Rappelle-moi de répondre à Jean dans 2 heures"\n• "N'oublie pas de vérifier les emails demain matin"\n• "Préviens-moi dans 30 minutes de faire le suivi"`;
    }

    console.log(`⏰ Création d'un rappel pour ${from}...`);
    
    const result = await mailAgent.setReminder(from, message);
    
    return `⏰ **Rappel créé !**\n\n${result.message}`;
  }

  /**
   * Lister les rappels en attente d'un utilisateur
   */
  async handleListReminders(from) {
    console.log(`⏰ Liste des rappels pour ${from}...`);
    
    const reminders = await supabaseService.getUserReminders(from);
    
    if (!reminders || reminders.length === 0) {
      return `⏰ **Vos rappels**\n\nAucun rappel en attente.`;
    }
    
    let message = `⏰ **Vos rappels** (${reminders.length})\n\n`;
    reminders.forEach((r, i) => {
      const date = new Date(r.trigger_at).toLocaleString('fr-FR');
      message += `${i + 1}. ${r.message}\n   📅 ${date}\n\n`;
    });
    
    return message;
  }

  /**
   * Réponse rapide à un email reçu
   */
  async handleQuickReply(from, params) {
    const text = params.searchQuery || params.text;
    
    if (!text) {
      return `✉️ **Réponse rapide**\n\nExemples:\n• "Réponds au mail de Pierre pour confirmer la réunion"\n• "Reply au dernier mail d'Amazon pour demander un remboursement"\n• "Réponds au mail concernant le projet pour dire que c'est ok"`;
    }

    console.log(`✉️ James prépare une réponse rapide...`);
    
    const result = await mailAgent.quickReply(from, text, text);
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Nettoyage intelligent des vieux emails
   */
  async handleCleanEmails(params) {
    const text = params.text || '';
    
    // Extraire le dossier et le nombre de jours
    let folder = 'Deleted Items';
    let daysOld = 30;
    
    const lowerText = text.toLowerCase();
    
    // Détecter le dossier
    if (lowerText.includes('newsletter')) folder = '📰 Newsletter';
    else if (lowerText.includes('pub') || lowerText.includes('spam')) folder = 'Junk Email';
    else if (lowerText.includes('corbeille') || lowerText.includes('trash') || lowerText.includes('deleted')) folder = 'Deleted Items';
    else if (lowerText.includes('sent') || lowerText.includes('envoyé')) folder = 'Sent Items';
    
    // Détecter la durée
    const daysMatch = text.match(/(\d+)\s*(jour|day)/i);
    const weeksMatch = text.match(/(\d+)\s*(semaine|week)/i);
    const monthsMatch = text.match(/(\d+)\s*(mois|month)/i);
    
    if (daysMatch) daysOld = parseInt(daysMatch[1]);
    else if (weeksMatch) daysOld = parseInt(weeksMatch[1]) * 7;
    else if (monthsMatch) daysOld = parseInt(monthsMatch[1]) * 30;

    console.log(`🗑️ James nettoie ${folder} (> ${daysOld} jours)...`);
    
    const result = await mailAgent.cleanEmails(folder, daysOld);
    
    return `🤖 **James** rapporte:\n\n${result.message}`;
  }

  /**
   * Résumé quotidien des emails
   */
  async handleDailySummary() {
    console.log(`📊 James prépare le résumé quotidien...`);
    
    const result = await mailAgent.getDailySummary();
    
    return `🤖 **James** - Résumé du jour:\n\n${result.message}`;
  }

  /**
   * Répondre à une question générale
   */
  async handleGeneralQuestion(question) {
    const context = `
Agents disponibles:
- James (Mail Assistant): Gère les emails Outlook
- Magali (Assistant Bancaire): Analyse les relevés bancaires (pas encore implémenté)
- Kiara (CEO Assistant): Rédige des articles (pas encore implémenté)

État Outlook: ${outlookService.isConnected() ? 'Connecté' : 'Non connecté'}
`;

    const response = await openaiService.answerQuestion(question, context);
    return response;
  }

  /**
   * Notification de nouveaux emails (appelé par le scheduler)
   */
  async notifyNewEmails(emails) {
    if (emails.length === 0) return;

    const summary = await openaiService.summarizeEmails(emails);
    const message = `📬 **Nouveaux emails détectés !**\n\n${summary}`;

    await whatsappService.sendLongMessage(this.myPhoneNumber, message);
  }
}

module.exports = new PrincipalAgent();
