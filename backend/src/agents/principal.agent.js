const openaiService = require('../services/openai.service');
const whatsappService = require('../services/whatsapp.service');
const mailAgent = require('./mail.agent');
const kiaraAgent = require('./kiara.agent');
const outlookService = require('../services/outlook.service');
const statsService = require('../services/stats.service');

/**
 * Agent Principal (Brian) - Orchestre les autres agents
 * Brian est le manager qui comprend les intentions et délègue aux bons agents
 */
class PrincipalAgent {
  constructor() {
    this.name = 'Brian';
    this.role = 'Assistant Principal & Manager';
    this.myPhoneNumber = process.env.MY_PHONE_NUMBER;
    
    // Tracking de l'agent actif par utilisateur (pour garder le contexte)
    // Format: { phoneNumber: { agent: 'kiara'|'james'|null, lastActivity: Date, lastArticleId: ... } }
    this.userContexts = new Map();
    
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
  
- **Kiara** (SEO & Blog Manager): Gère TOUT ce qui concerne le blog et le contenu SEO
  - Tendances, articles, statistiques, publications
  - Mots-clés: blog, article, tendance, seo, stats, vues, publier, kiara, rédiger
  
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
   
   📊 **EXTRACTION DES NOMBRES (TRÈS IMPORTANT - respecter EXACTEMENT le nombre demandé):**
   - "mes 2 derniers mails" → count: 2
   - "mes 3 derniers mails" → count: 3
   - "les 10 derniers emails" → count: 10
   - "le dernier mail" → count: 1
   - "mes mails" (sans nombre) → count: 10 (défaut raisonnable)
   
   📅 **FILTRES TEMPORELS (IMPORTANT):**
   - "mails d'aujourd'hui" → filter: "today"
   - "mails de cette semaine" → filter: "week"  
   - "mails d'hier" → filter: "yesterday"
   - "mails du mois" ou "ce mois" → filter: "month"
   - "mails des 7 derniers jours" → filter: "7days"
   - "mails des 14 derniers jours" → filter: "14days"
   - "mails des 30 derniers jours" → filter: "30days"
   
   👤 **FILTRE PAR EXPÉDITEUR (NOUVEAU - TRÈS IMPORTANT):**
   - "résume les mails de LinkedIn" → from: "LinkedIn", action: "email_summary"
   - "mails de ISCOD d'hier" → from: "ISCOD", filter: "yesterday"
   - "mails de Amazon cette semaine" → from: "Amazon", filter: "week"
   - "les emails de Google du mois" → from: "Google", filter: "month"
   - "résume le mail de Brian" → from: "Brian", count: 1
   
   ⭐ **FILTRES D'IMPORTANCE:**
   - "mails importants" → filter: "important"
   - "mails urgents" → filter: "urgent"

4. **Double intention** (ex: "classe les mails eDocPerso dans ISCOD"):
   → L'utilisateur veut SOUVENT les deux: créer une règle ET appliquer maintenant
   → Tu dois proposer les deux options

5. **CLASSIFICATION vs RE-CLASSIFICATION (DISTINCTION CRITIQUE):**

   📥 **CLASSIFICATION (email_classify)** = Trier les mails de la BOÎTE DE RÉCEPTION:
   - "classe mes mails" → action: "email_classify"
   - "classe mes 6 derniers mails" → action: "email_classify", count: 6
   - "classement mes 10 derniers mails" → action: "email_classify", count: 10
   - "trie mes emails" → action: "email_classify"
   - "organise ma boîte de réception" → action: "email_classify"
   - C'est TOUJOURS depuis l'Inbox vers les dossiers de classification
   - RESPECTE LE NOMBRE EXACT demandé !

   🔄 **RE-CLASSIFICATION (email_reclassify)** = Re-trier des mails DÉJÀ CLASSÉS:
   - "reclasse mes mails" → action: "email_reclassify"
   - "reclasse le dossier Newsletter" → action: "email_reclassify", sourceFolder: "📰 Newsletter"
   - "reclasse les mails du dossier Finance" → action: "email_reclassify", sourceFolder: "🏦 Finance"
   - "refais l'analyse" → action: "email_reclassify"
   - "applique les nouvelles règles" → action: "email_reclassify"
   - C'est pour CORRIGER des mails mal classés avec les règles actuelles
   - Quand un DOSSIER est mentionné, c'est RE-classification !

6. **Gestion des DOSSIERS:**
   - "créer un dossier X" → action: "create_folder", folder: "X"
   - "crée le dossier Publicité" → action: "create_folder", folder: "Publicité"
   - "supprime le dossier X" → action: "delete_folder", folder: "X"
   - "liste mes dossiers" → action: "list_folders"

7. **MAPPING DES DOSSIERS (pour sourceFolder):**
   - "finance" → "🏦 Finance"
   - "social" → "🤝 Social"
   - "urgent" → "🔴 Urgent"
   - "professionnel" → "💼 Professionnel"
   - "shopping" → "🛒 Shopping"
   - "newsletter" → "📰 Newsletter"
   - "publicites" ou "pub" → "Publicites"
   - "iscod" → "ISCOD"

7. **Description des agents:**
   - "que peut faire James" → action: "describe_james"
   - "les capacités de James" → action: "describe_james"
   - "quels sont les rôles de James" → action: "describe_james"
   - "les tâches de James" → action: "describe_james"
   - "que peut faire Kiara" → action: "describe_kiara"
   - "les capacités de Kiara" → action: "describe_kiara"
   - "fonctionnalités de Kiara" → action: "describe_kiara"
   - "comment utiliser Kiara" → action: "describe_kiara"

8. **Sujet BANCAIRE** (contient: banque, compte, argent, magali, budget):
   → Délègue à Magali (pas encore implémenté)

9. **ENVOI D'EMAIL:**
   - "envoie un mail à X@email.com" → action: "send_email"
   - "écris un email à X pour lui dire..." → action: "send_email"
   - "mail à X concernant..." → action: "send_email"
   - "envoie à X avec le sujet..." → action: "send_email"
   - L'email nécessite: destinataire + intention/message
   - C'est différent de "résumer mes mails" ou "classer mes mails"

10. **RECHERCHE D'EMAILS (contenu):**
   - "cherche les mails concernant le devis" → action: "email_search", params: { query: "devis" }
   - "trouve les emails qui parlent de facture" → action: "email_search", params: { query: "facture" }
   - "emails de la semaine dernière de Amazon" → action: "email_search"
   - "montre moi les mails de LinkedIn" → action: "email_search", params: { from: "LinkedIn" }

11. **RECHERCHE DE CONTACT (adresse email d'une personne/entreprise):**
   - IMPORTANT: Quand l'utilisateur veut l'ADRESSE EMAIL de quelqu'un, c'est contact_search !
   - "quel est le mail de Brian" → action: "contact_search", params: { name: "Brian" }
   - "trouve l'adresse email de Pierre" → action: "contact_search", params: { name: "Pierre" }
   - "retrouve moi le mail de ISCOD" → action: "contact_search", params: { name: "ISCOD" }
   - "retrouve moi l'email de Jean" → action: "contact_search", params: { name: "Jean" }
   - "cherche le contact Jean-Marc" → action: "contact_search", params: { name: "Jean-Marc" }
   - "comment contacter Dupont" → action: "contact_search", params: { name: "Dupont" }
   - "donne moi le mail de Amazon" → action: "contact_search", params: { name: "Amazon" }

12. **RÉPONSE RAPIDE:**
   - "réponds au dernier mail de Pierre" → action: "email_reply", params: { from: "Pierre" }
   - "réponds à l'email de Marie pour confirmer" → action: "email_reply"

13. **RAPPELS:**
   - "rappelle-moi demain à 9h de..." → action: "create_reminder"
   - "rappelle-moi dans 2 heures" → action: "create_reminder"
   - "mes rappels" ou "liste mes rappels" → action: "list_reminders"

14. **NETTOYAGE/SUPPRESSION:**
   - "supprime les newsletters de plus de 30 jours" → action: "email_cleanup"
   - "nettoie le dossier Newsletter" → action: "email_cleanup"
   - "supprime les mails de LinkedIn" → action: "email_cleanup"

15. **RÉSUMÉ QUOTIDIEN:**
   - "résumé de ma journée mail" → action: "daily_summary"
   - "résumé quotidien" → action: "daily_summary"
   - "comment va ma boîte mail" → action: "daily_summary"

16. **KIARA - BLOG & SEO** (PRIORITÉ HAUTE si contient: article, blog, tendance, GPU, IA, tech, rédige, génère, publie, programme, PDF article):
   ⚠️ IMPORTANT: Si le message parle d'articles WEB, tendances TECH, blogs, PDF d'articles → C'est Kiara, PAS James !
   - "recherche les articles sur les GPU" → action: "kiara_complete_workflow", target_agent: "kiara"
   - "recherche X articles sur [sujet] et génère un blog" → action: "kiara_complete_workflow"
   - "trouve les tendances sur [sujet]" → action: "kiara_complete_workflow"
   - "rédige un article sur [sujet]" → action: "kiara_generate_article"
   - "génère un article avec PDF" → action: "kiara_complete_workflow"
   - "quelles sont les tendances tech" → action: "kiara_trends"
   - "tendances actuelles" → action: "kiara_trends"
   - "publie l'article" → action: "kiara_publish"
   - "programme l'article pour demain" → action: "kiara_schedule"
   - "stats du blog" → action: "kiara_global_stats"
   - "modifie le titre par..." → action: "kiara_modify"
   
   🔑 MOTS-CLÉS KIARA: article, blog, tendance, trend, GPU, IA, tech, rédige, génère, publie, programme, PDF (dans contexte blog), SEO, vues, statistiques blog

RÉPONDS UNIQUEMENT EN JSON avec ce format:
{
  "target_agent": "brian" | "james" | "kiara" | "magali",
  "action": "greeting" | "help" | "general_question" | "email_summary" | "email_unread" | "email_classify" | "email_reclassify" | "email_classify_with_rule" | "email_important" | "create_rule_only" | "list_rules" | "reset_config" | "send_email" | "check_status" | "create_folder" | "delete_folder" | "list_folders" | "describe_james" | "describe_kiara" | "delete_rule" | "email_search" | "contact_search" | "email_reply" | "create_reminder" | "list_reminders" | "email_cleanup" | "daily_summary" | "kiara_complete_workflow" | "kiara_generate_article" | "kiara_trends" | "kiara_publish" | "kiara_schedule" | "kiara_global_stats" | "kiara_modify" | "kiara_delete_article" | "kiara_list_articles" | "kiara_list_published" | "kiara_list_drafts" | "kiara_count_articles" | "unknown",
  "params": {
    "count": number (OBLIGATOIRE - extrait EXACTEMENT le nombre demandé. Ex: "3 derniers mails" → count: 3),
    "filter": "today" | "yesterday" | "week" | "month" | "7days" | "14days" | "30days" | "important" | "urgent" | null,
    "from": string (TRÈS IMPORTANT - expéditeur/source. Ex: "mails de LinkedIn" → from: "LinkedIn"),
    "pattern": string (optionnel, pour les règles),
    "folder": string (optionnel, pour les règles OU pour créer/supprimer un dossier),
    "sourceFolder": string (optionnel, dossier source pour re-classification, avec emojis si applicable),
    "apply_now": boolean (optionnel, appliquer immédiatement aux mails existants),
    "ruleNumber": number (optionnel, numéro de règle à supprimer),
    "text": string (le message original - TOUJOURS inclure pour send_email, create_reminder),
    "query": string (optionnel, terme de recherche OU sujet pour Kiara),
    "topic": string (optionnel, sujet pour Kiara),
    "title": string (optionnel, titre d'article pour Kiara - suppression/modification),
    "articleCount": number (optionnel, nombre d'articles à rechercher pour Kiara),
    "status": "published" | "draft" | null (optionnel, filtrer par statut d'article),
    "period": "week" | "month" | "today" | null (optionnel, filtrer par période),
    "countOnly": boolean (optionnel, true pour compter au lieu de lister),
    "name": string (optionnel, nom du contact à chercher),
    "olderThanDays": number (optionnel, pour nettoyage)
  },
  "confidence": number (0-100),
  "reasoning": "explication courte de ton analyse"
}

EXEMPLES IMPORTANTS:
- "résume mes 3 derniers mails" → action: "email_summary", count: 3
- "résume les mails de LinkedIn d'hier" → action: "email_summary", from: "LinkedIn", filter: "yesterday"
- "mails de ISCOD cette semaine" → action: "email_summary", from: "ISCOD", filter: "week"
- "les mails de Google du mois" → action: "email_summary", from: "Google", filter: "month"
- "mails de Amazon des 7 derniers jours" → action: "email_summary", from: "Amazon", filter: "7days"
- "le dernier mail de Brian" → action: "email_summary", from: "Brian", count: 1
- "retrouve le mail de Adrian" → action: "email_summary", from: "Adrian" (FILTRER par expéditeur)
- "trouve moi les mails ou il y'a Google" → action: "email_summary", from: "Google" (FILTRER)
- "le mail avec Amazon" → action: "email_summary", from: "Amazon" (FILTRER)
- "montre les mails d'Adrian" → action: "email_summary", from: "Adrian" (FILTRER)
- "cherche les mails de Adrian" → action: "email_summary", from: "Adrian" (FILTRER par expéditeur, PAS email_search!)
- "trouve les mails de LinkedIn" → action: "email_summary", from: "LinkedIn" (FILTRER)
- "classe mes 5 derniers mails" → action: "email_classify", count: 5 (IMPORTANT: respecter le nombre!)
- "classement mes 6 derniers mails" → action: "email_classify", count: 6
- "classe 10 mails" → action: "email_classify", count: 10
- "trie mes 3 emails" → action: "email_classify", count: 3
- "reclasse les mails du dossier Newsletter" → action: "email_reclassify", sourceFolder: "Newsletter"
- "reclasse 20 mails de Newsletter" → action: "email_reclassify", count: 20, sourceFolder: "Newsletter"
- "mails importants d'aujourd'hui" → action: "email_important", filter: "today"
- "envoie un mail à jean@test.com pour lui dire bonjour" → action: "send_email", text: "..."
- "quel est le mail de Brian" → action: "contact_search", params: { name: "Brian" } (ADRESSE email)
- "quelle est l'adresse de Brian" → action: "contact_search", params: { name: "Brian" } (ADRESSE)
- "cherche moi l'email de Brian" → action: "contact_search", params: { name: "Brian" } (ADRESSE - singulier "l'email")
- "cherche les mails concernant le projet" → action: "email_search", params: { query: "projet" } (CONTENU, pas expéditeur)
- "trouve les mails qui parlent de facture" → action: "email_search", params: { query: "facture" } (CONTENU)
- "Recherche les 2 articles sur les GPU et génère un blog" → action: "kiara_complete_workflow", target_agent: "kiara", topic: "GPU", articleCount: 2
- "tendances tech actuelles" → action: "kiara_trends", target_agent: "kiara"
- "rédige un article sur l'IA" → action: "kiara_generate_article", target_agent: "kiara", topic: "IA"
- "publie l'article" → action: "kiara_publish", target_agent: "kiara"
- "supprime le brouillon 1" → action: "kiara_delete_article", title: "1", status: "draft"
- "supprime brouillon 2" → action: "kiara_delete_article", title: "2", status: "draft"
- "supprime l'article publié 1" → action: "kiara_delete_article", title: "1", status: "published"
- "supprime publié 2" → action: "kiara_delete_article", title: "2", status: "published"
- "supprime l'article sur les GPU" → action: "kiara_delete_article", title: "GPU"
- "supprime article" → action: "kiara_delete_article" (affiche la liste)
- "liste mes articles" → action: "kiara_list_articles" (TOUS les articles)
- "mes articles" → action: "kiara_list_articles" (TOUS les articles)
- "liste complète" → action: "kiara_list_articles" (TOUS les articles)
- "articles publiés" → action: "kiara_list_published" (seulement publiés)
- "mes articles publiés" → action: "kiara_list_published"
- "affiche mes brouillons" → action: "kiara_list_drafts" (seulement brouillons)
- "liste les brouillons" → action: "kiara_list_drafts"
- "articles publiés cette semaine" → action: "kiara_list_published", period: "week"
- "articles du mois" → action: "kiara_list_articles", period: "month"
- "combien d'articles publiés" → action: "kiara_count_articles", status: "published"
- "combien de brouillons" → action: "kiara_count_articles", status: "draft"
- "combien d'articles cette semaine" → action: "kiara_count_articles", period: "week"
- "stats du blog" → action: "kiara_global_stats"
- "fonctionnalités de Kiara" → action: "describe_kiara"
- "que peut faire Kiara" → action: "describe_kiara"

DISTINCTION TRÈS IMPORTANTE:
- "cherche/trouve/montre LES MAILS de X" → email_summary avec from: "X" (FILTRER les mails de cet expéditeur)
- "cherche L'EMAIL de X" (singulier) ou "adresse de X" → contact_search (trouver l'ADRESSE email de ce contact)
- "cherche les mails CONCERNANT/CONTENANT/QUI PARLENT DE X" → email_search (chercher dans le CONTENU)`;
  }

  /**
   * Traiter un message WhatsApp entrant
   */
  async handleWhatsAppMessage(message) {
    const { from, text, name } = message;
    
    console.log(`📱 Message de ${name} (${from}): ${text}`);

    // Récupérer le contexte de l'utilisateur (agent actif)
    const userContext = this.getUserContext(from);
    const lowerText = text.toLowerCase().trim();
    
    // ============================================================
    // MODE AGENT STRICT - Gestion des sessions exclusives
    // ============================================================
    
    // Patterns pour terminer une session avec un agent
    const endKiaraPatterns = [
      'fini avec kiara', 'fin avec kiara', 'terminer avec kiara', 'quitter kiara',
      'j\'ai fini avec kiara', 'j\'ai terminé avec kiara', 'au revoir kiara',
      'merci kiara', 'c\'est bon kiara', 'ok kiara merci', 'bye kiara',
      'sortir de kiara', 'retour', 'brian', 'revenir'
    ];
    
    const endJamesPatterns = [
      'fini avec james', 'fin avec james', 'terminer avec james', 'quitter james',
      'j\'ai fini avec james', 'j\'ai terminé avec james', 'au revoir james',
      'merci james', 'c\'est bon james', 'ok james merci', 'bye james',
      'sortir de james', 'retour', 'brian', 'revenir'
    ];
    
    const startKiaraPatterns = [
      'kiara', 'parler à kiara', 'passe à kiara', 'je veux kiara',
      'appelle kiara', 'with kiara', 'blog', 'article'
    ];
    
    const startJamesPatterns = [
      'james', 'parler à james', 'passe à james', 'je veux james',
      'appelle james', 'with james', 'emails', 'mails', 'mail'
    ];
    
    // SI ON EST EN MODE KIARA
    if (userContext?.agent === 'kiara') {
      // Vérifier si l'utilisateur veut quitter Kiara
      if (endKiaraPatterns.some(p => lowerText.includes(p))) {
        const response = this.handleEndAgentSession(from);
        await whatsappService.sendLongMessage(from, response);
        return response;
      }
      
      // Vérifier si l'utilisateur demande quelque chose lié à James/emails
      const isJamesRequest = this.isJamesRelatedRequest(lowerText);
      if (isJamesRequest) {
        const response = `⚠️ **Tu es actuellement avec Kiara (Blog/SEO)**\n\n` +
          `Pour gérer tes emails, tu dois d'abord terminer avec Kiara.\n\n` +
          `💡 Dis **"fini avec Kiara"** ou **"merci Kiara"** pour revenir à Brian, puis tu pourras parler à James.`;
        await whatsappService.sendLongMessage(from, response);
        return response;
      }
      
      // Sinon, traiter la demande avec Kiara
      const response = await this.handleKiaraRequest(from, text, lowerText);
      await whatsappService.sendLongMessage(from, response);
      return response;
    }
    
    // SI ON EST EN MODE JAMES
    if (userContext?.agent === 'james') {
      // Vérifier si l'utilisateur veut quitter James
      if (endJamesPatterns.some(p => lowerText.includes(p))) {
        const response = this.handleEndAgentSession(from);
        await whatsappService.sendLongMessage(from, response);
        return response;
      }
      
      // Vérifier si l'utilisateur demande quelque chose lié à Kiara/blog
      const isKiaraRequest = this.isKiaraRelatedRequest(lowerText);
      if (isKiaraRequest) {
        const response = `⚠️ **Tu es actuellement avec James (Emails)**\n\n` +
          `Pour gérer ton blog/SEO, tu dois d'abord terminer avec James.\n\n` +
          `💡 Dis **"fini avec James"** ou **"merci James"** pour revenir à Brian, puis tu pourras parler à Kiara.`;
        await whatsappService.sendLongMessage(from, response);
        return response;
      }
      
      // Vérifier si l'utilisateur a un brouillon en attente
      if (mailAgent.hasPendingDraft(from)) {
        const draftResponse = await this.handleDraftInteraction(from, text);
        if (draftResponse) {
          await whatsappService.sendLongMessage(from, draftResponse);
          return draftResponse;
        }
      }
      
      // Vérifier si l'utilisateur a une sélection de destinataire en attente
      if (mailAgent.hasPendingRecipientSearch(from)) {
        const selectionResult = await mailAgent.handleRecipientSelection(from, text);
        await whatsappService.sendLongMessage(from, selectionResult.message);
        return selectionResult.message;
      }
      
      // Sinon, traiter la demande avec James
      const response = await this.handleJamesRequest(from, text, lowerText);
      await whatsappService.sendLongMessage(from, response);
      return response;
    }
    
    // ============================================================
    // MODE BRIAN (défaut) - Peut switcher vers Kiara ou James
    // ============================================================
    
    // Vérifier si l'utilisateur veut parler à Kiara
    if (startKiaraPatterns.some(p => lowerText.includes(p) || lowerText === p)) {
      const response = this.handleSwitchToKiara(from);
      await whatsappService.sendLongMessage(from, response);
      return response;
    }
    
    // Vérifier si l'utilisateur veut parler à James
    if (startJamesPatterns.some(p => lowerText.includes(p) || lowerText === p)) {
      const response = this.handleSwitchToJames(from);
      await whatsappService.sendLongMessage(from, response);
      return response;
    }

    // PRIORITÉ: Vérifier si l'utilisateur a un brouillon en attente (même sans agent actif)
    if (mailAgent.hasPendingDraft(from)) {
      const draftResponse = await this.handleDraftInteraction(from, text);
      if (draftResponse) {
        await whatsappService.sendLongMessage(from, draftResponse);
        return draftResponse;
      }
    }

    // Analyser l'intention et répondre (mode Brian général)
    const intent = await this.analyzeIntent(text, from, null);
    
    // Logger la requête pour les stats
    statsService.logRequest('brian');
    
    let response;

    switch (intent.action) {
      case 'greeting':
        response = await this.handleGreeting(intent.params);
        break;
      
      case 'help':
        response = this.getHelpMessage();
        break;
      
      case 'check_connection':
        response = await this.checkConnections();
        break;
      
      case 'describe_james':
        response = this.getJamesCapabilities();
        break;

      case 'describe_kiara':
        response = this.getKiaraCapabilities();
        break;

      default:
        // Si c'est une demande liée à un agent, suggérer de l'appeler
        if (this.isJamesRelatedRequest(lowerText)) {
          response = `📧 Cette demande concerne les emails.\n\n💡 Dis **"James"** ou **"je veux parler à James"** pour accéder à l'assistant email.`;
        } else if (this.isKiaraRelatedRequest(lowerText)) {
          response = `✍️ Cette demande concerne le blog/SEO.\n\n💡 Dis **"Kiara"** ou **"je veux parler à Kiara"** pour accéder à l'assistant blog.`;
        } else {
          response = await this.handleGeneralQuestion(text);
        }
    }

    // Envoyer la réponse via WhatsApp
    await whatsappService.sendLongMessage(from, response);
    
    return response;
  }

  /**
   * Vérifie si la demande est liée à James (emails)
   */
  isJamesRelatedRequest(text) {
    const jamesKeywords = [
      'mail', 'email', 'e-mail', 'courrier', 'message', 'inbox', 'boîte',
      'envoie', 'envoyer', 'résume mes', 'classe mes', 'trie', 'dossier',
      'non lu', 'outlook', 'règle', 'newsletter', 'urgent', 'professionnel'
    ];
    return jamesKeywords.some(k => text.includes(k));
  }

  /**
   * Vérifie si la demande est liée à Kiara (blog/SEO)
   */
  isKiaraRelatedRequest(text) {
    const kiaraKeywords = [
      'article', 'blog', 'seo', 'tendance', 'rédige', 'écris', 'publie',
      'brouillon', 'stats', 'vues', 'pdf', 'programme', 'gpu', 'ia',
      'tech', 'génère'
    ];
    return kiaraKeywords.some(k => text.includes(k));
  }

  /**
   * Traiter une demande en mode Kiara (avec contexte de conversation)
   */
  async handleKiaraRequest(from, text, lowerText) {
    console.log(`✍️ Mode Kiara - Traitement: ${text}`);
    statsService.logRequest('kiara');
    
    // Ajouter le message utilisateur à l'historique
    this.addToConversationHistory(from, 'kiara', 'user', text);
    
    let response;
    
    // Analyser l'intention dans le contexte Kiara
    const intent = this.analyzeKiaraIntent(lowerText, text);
    
    // Récupérer l'historique pour le contexte
    const conversationHistory = this.getConversationHistory(from, 'kiara');
    
    switch (intent.action) {
      case 'kiara_trends':
        response = await this.handleKiaraTrends(intent.params);
        break;
      case 'kiara_generate_article':
        response = await this.handleKiaraGenerateArticle(intent.params, conversationHistory);
        break;
      case 'kiara_publish':
        response = await this.handleKiaraPublish(from, intent.params);
        break;
      case 'kiara_schedule':
        response = await this.handleKiaraSchedule(from, intent.params);
        break;
      case 'kiara_modify':
        response = await this.handleKiaraModify(from, intent.params);
        break;
      case 'kiara_global_stats':
        response = await this.handleKiaraGlobalStats();
        break;
      case 'kiara_article_stats':
        response = await this.handleKiaraArticleStats(intent.params);
        break;
      case 'kiara_complete_workflow':
        response = await this.handleKiaraCompleteWorkflow(from, intent.params);
        break;
      case 'kiara_pdf':
        response = await this.handleKiaraPDF(from, intent.params);
        break;
      case 'kiara_delete_article':
        response = await this.handleKiaraDeleteArticle(intent.params);
        break;
      case 'kiara_list_articles':
        response = await this.handleKiaraListArticles(intent.params);
        break;
      case 'kiara_list_published':
        response = await this.handleKiaraListPublished(intent.params);
        break;
      case 'kiara_list_drafts':
        response = await this.handleKiaraListDrafts(intent.params);
        break;
      case 'kiara_count_articles':
        response = await this.handleKiaraCountArticles(intent.params);
        break;
      case 'describe_kiara':
        response = this.getKiaraCapabilities();
        break;
      default:
        // Demande générale à Kiara avec contexte de conversation
        response = await this.handleKiaraGeneral(from, { text, conversationHistory });
    }
    
    // Ajouter la réponse à l'historique
    this.addToConversationHistory(from, 'kiara', 'assistant', response);
    
    // Ajouter le rappel pour quitter
    response += `\n\n━━━━━━━━━━━━━━━━━━\n💡 *Dis "fini avec Kiara" pour revenir à Brian*`;
    
    return response;
  }

  /**
   * Traiter une demande en mode James
   */
  async handleJamesRequest(from, text, lowerText) {
    console.log(`📧 Mode James - Traitement: ${text}`);
    statsService.logRequest('james');
    
    let response;
    
    // Analyser l'intention dans le contexte James
    const intent = await this.analyzeJamesIntent(lowerText, text);
    
    switch (intent.action) {
      case 'email_summary':
        response = await this.handleEmailSummary(intent.params);
        break;
      case 'email_unread':
        response = await this.handleUnreadEmails(intent.params);
        break;
      case 'email_classify':
        response = await this.handleEmailClassification(intent.params);
        break;
      case 'email_reclassify':
        response = await this.handleReclassifyEmails(intent.params);
        break;
      case 'email_important':
        response = await this.handleImportantEmails(intent.params);
        break;
      case 'email_classify_with_rule':
        response = await this.handleClassifyWithRule(intent.params);
        break;
      case 'send_email':
        response = await this.handleSendEmail(from, intent.params);
        break;
      case 'email_search':
        response = await this.handleEmailSearch(intent.params);
        break;
      case 'contact_search':
        response = await this.handleContactSearch(intent.params);
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
      case 'create_folder':
        response = await this.handleCreateFolder(intent.params);
        break;
      case 'delete_folder':
        response = await this.handleDeleteFolder(intent.params);
        break;
      case 'list_folders':
        response = await this.handleListFolders();
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
      case 'describe_james':
        response = this.getJamesCapabilities();
        break;
      default:
        // Demande générale à James
        response = await this.handleGeneralQuestion(text);
    }
    
    // Ajouter le rappel pour quitter
    response += `\n\n━━━━━━━━━━━━━━━━━━\n💡 *Dis "fini avec James" pour revenir à Brian*`;
    
    return response;
  }

  /**
   * Extraire la période temporelle d'un message
   */
  extractTimePeriod(text) {
    const lowerText = text.toLowerCase();
    
    // Aujourd'hui
    if (lowerText.includes("aujourd'hui") || lowerText.includes('today') || lowerText.includes('ce jour')) {
      return 'today';
    }
    
    // Hier
    if (lowerText.includes('hier') || lowerText.includes('yesterday')) {
      return 'yesterday';
    }
    
    // Avant-hier / il y a 2 jours
    if (lowerText.includes('avant-hier') || lowerText.includes('avant hier') || 
        lowerText.match(/il y'?a?\s*(2|deux)\s*jours?/i)) {
      return '2days';
    }
    
    // Il y a X jours
    const daysMatch = lowerText.match(/il y'?a?\s*(\d+)\s*jours?/i);
    if (daysMatch) {
      return `${daysMatch[1]}days`;
    }
    
    // Cette semaine
    if (lowerText.includes('cette semaine') || lowerText.includes('this week')) {
      return 'week';
    }
    
    // Semaine dernière
    if (lowerText.includes('semaine dernière') || lowerText.includes('semaine passée') || lowerText.includes('last week')) {
      return 'lastweek';
    }
    
    // Ce mois
    if (lowerText.includes('ce mois') || lowerText.includes('this month')) {
      return 'month';
    }
    
    // Mois dernier
    if (lowerText.includes('mois dernier') || lowerText.includes('mois passé') || lowerText.includes('last month')) {
      return 'lastmonth';
    }
    
    return null; // Pas de période spécifique = aujourd'hui par défaut
  }

  /**
   * Analyser l'intention spécifique à Kiara (sans appeler OpenAI)
   */
  analyzeKiaraIntent(lowerText, originalText) {
    
    // ==========================================
    // PRIORITÉ HAUTE: Tendances (avant liste car "montre tendances" != "montre articles")
    // ==========================================
    if (lowerText.includes('tendance') || lowerText.includes('trend') || 
        lowerText.includes('actualité') || lowerText.includes('actu tech') ||
        lowerText.includes('quoi de neuf') || lowerText.includes('news')) {
      
      // Extraire la période temporelle
      const period = this.extractTimePeriod(originalText);
      
      // Extraire le sujet/topic si mentionné
      let topic = null;
      const topicPatterns = [
        /tendances?\s+(?:sur|de|du|en|tech|ia|gpu|nvidia|amd|intel|apple|google|microsoft|amazon)/i,
        /actualités?\s+(?:sur|de|du|en|tech|ia|gpu)/i
      ];
      
      for (const pattern of topicPatterns) {
        const match = originalText.match(pattern);
        if (match) {
          topic = match[0].replace(/tendances?\s+(?:sur|de|du|en)?/i, '').trim();
          break;
        }
      }
      
      return { 
        action: 'kiara_trends', 
        params: { 
          topic: topic || 'tech', 
          period: period,
          text: originalText 
        } 
      };
    }
    
    // ==========================================
    // Suppression d'articles
    // ==========================================
    if (lowerText.includes('supprime') || lowerText.includes('efface') || lowerText.includes('delete')) {
      let status = null;
      let title = null;
      
      if (lowerText.includes('brouillon') || lowerText.includes('draft')) {
        status = 'draft';
      } else if (lowerText.includes('publié') || lowerText.includes('publish')) {
        status = 'published';
      }
      
      const numMatch = originalText.match(/(\d+)/);
      if (numMatch) {
        title = numMatch[1];
      }
      
      return { action: 'kiara_delete_article', params: { title, status } };
    }
    
    // ==========================================
    // Liste d'articles (APRÈS tendances)
    // ==========================================
    // Détection des mots clés pour "publiés" (avec ou sans accent)
    const isPublishedRequest = lowerText.includes('publié') || lowerText.includes('publies') || 
                               lowerText.includes('publie') || lowerText.includes('publish');
    const isDraftRequest = lowerText.includes('brouillon') || lowerText.includes('draft');
    
    if (lowerText.includes('liste') || lowerText.includes('affiche') || lowerText.includes('montre') || lowerText.includes('mes articles')) {
      // Ne pas matcher si c'est une demande de tendances
      if (lowerText.includes('tendance') || lowerText.includes('actu')) {
        return { action: 'kiara_trends', params: { topic: 'tech', text: originalText } };
      }
      
      // Articles publiés (priorité sur brouillons)
      if (isPublishedRequest && !isDraftRequest) {
        const period = lowerText.includes('semaine') ? 'week' : lowerText.includes('mois') ? 'month' : null;
        return { action: 'kiara_list_published', params: { period } };
      }
      // Brouillons
      if (isDraftRequest) {
        return { action: 'kiara_list_drafts', params: {} };
      }
      // Liste complète par défaut
      return { action: 'kiara_list_articles', params: {} };
    }
    
    // Comptage
    if (lowerText.includes('combien')) {
      const status = isPublishedRequest ? 'published' : isDraftRequest ? 'draft' : null;
      const period = lowerText.includes('semaine') ? 'week' : lowerText.includes('mois') ? 'month' : null;
      return { action: 'kiara_count_articles', params: { status, period } };
    }
    
    // PDF
    if (lowerText.includes('pdf')) {
      return { action: 'kiara_pdf', params: { text: originalText } };
    }
    
    // Publication d'un article (action de publier, pas liste des publiés)
    // Seulement si ce n'est pas une demande de liste
    if ((lowerText.includes('publie') || lowerText.includes('publier')) && 
        !lowerText.includes('affiche') && !lowerText.includes('liste') && !lowerText.includes('montre') && !lowerText.includes('mes')) {
      return { action: 'kiara_publish', params: { text: originalText } };
    }
    
    // Programmation
    if (lowerText.includes('programme') || lowerText.includes('planifie')) {
      return { action: 'kiara_schedule', params: { text: originalText } };
    }
    
    // Modification
    if (lowerText.includes('modifi') || lowerText.includes('change') || lowerText.includes('corrige')) {
      return { action: 'kiara_modify', params: { text: originalText } };
    }
    
    // Stats
    if (lowerText.includes('stats') || lowerText.includes('statistiques') || lowerText.includes('vues')) {
      return { action: 'kiara_global_stats', params: {} };
    }
    
    // Génération d'article
    if (lowerText.includes('rédige') || lowerText.includes('écris') || lowerText.includes('génère') || lowerText.includes('article sur')) {
      return { action: 'kiara_generate_article', params: { topic: originalText, text: originalText } };
    }
    
    // Workflow complet
    if (lowerText.includes('recherche') && lowerText.includes('article')) {
      const countMatch = originalText.match(/(\d+)\s*article/i);
      return { 
        action: 'kiara_complete_workflow', 
        params: { 
          topic: originalText, 
          articleCount: countMatch ? parseInt(countMatch[1]) : 2 
        } 
      };
    }
    
    // Capacités
    if (lowerText.includes('que peut') || lowerText.includes('capacité') || lowerText.includes('fonctionnalité')) {
      return { action: 'describe_kiara', params: {} };
    }
    
    // Par défaut, discussion générale
    return { action: 'kiara_general', params: { text: originalText } };
  }

  /**
   * Analyser l'intention spécifique à James (sans appeler OpenAI pour les cas simples)
   */
  async analyzeJamesIntent(lowerText, originalText) {
    // Résumé de mails
    if (lowerText.includes('résume') || lowerText.includes('résumé') || lowerText.includes('summary')) {
      const countMatch = originalText.match(/(\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 10;
      
      // Filtre temporel
      let filter = null;
      if (lowerText.includes("aujourd'hui") || lowerText.includes('today')) filter = 'today';
      else if (lowerText.includes('hier')) filter = 'yesterday';
      else if (lowerText.includes('semaine')) filter = 'week';
      else if (lowerText.includes('mois')) filter = 'month';
      
      // Expéditeur
      let from = null;
      const fromMatch = originalText.match(/(?:de|from|d')\s+(\w+)/i);
      if (fromMatch) from = fromMatch[1];
      
      return { action: 'email_summary', params: { count, filter, from } };
    }
    
    // Mails non lus
    if (lowerText.includes('non lu') || lowerText.includes('unread')) {
      return { action: 'email_unread', params: { count: 20 } };
    }
    
    // Classification
    if ((lowerText.includes('class') || lowerText.includes('trie')) && !lowerText.includes('reclass')) {
      const countMatch = originalText.match(/(\d+)/);
      return { action: 'email_classify', params: { count: countMatch ? parseInt(countMatch[1]) : 50 } };
    }
    
    // Reclassification
    if (lowerText.includes('reclass') || lowerText.includes('re-class')) {
      const countMatch = originalText.match(/(\d+)/);
      return { action: 'email_reclassify', params: { count: countMatch ? parseInt(countMatch[1]) : 30 } };
    }
    
    // Envoi d'email
    if (lowerText.includes('envoie') || lowerText.includes('écris un mail') || lowerText.includes('mail à')) {
      return { action: 'send_email', params: { text: originalText } };
    }
    
    // Recherche d'emails
    if ((lowerText.includes('cherche') || lowerText.includes('trouve') || lowerText.includes('recherche')) && 
        (lowerText.includes('mail') || lowerText.includes('email'))) {
      return { action: 'email_search', params: { query: originalText } };
    }
    
    // Recherche de contact
    if (lowerText.includes('contact') || (lowerText.includes('adresse') && lowerText.includes('mail'))) {
      const nameMatch = originalText.match(/(?:de|d')\s+(\w+)/i);
      return { action: 'contact_search', params: { name: nameMatch ? nameMatch[1] : originalText } };
    }
    
    // Nettoyage
    if (lowerText.includes('supprime') || lowerText.includes('nettoie') || lowerText.includes('vide')) {
      return { action: 'email_cleanup', params: { text: originalText } };
    }
    
    // Dossiers
    if (lowerText.includes('dossier') || lowerText.includes('folder')) {
      if (lowerText.includes('crée') || lowerText.includes('créer')) {
        return { action: 'create_folder', params: { folder: this.extractFolderName(originalText) } };
      }
      if (lowerText.includes('supprime') || lowerText.includes('delete')) {
        return { action: 'delete_folder', params: { folder: this.extractFolderName(originalText) } };
      }
      if (lowerText.includes('liste') || lowerText.includes('affiche')) {
        return { action: 'list_folders', params: {} };
      }
    }
    
    // Rappels
    if (lowerText.includes('rappel') || lowerText.includes('remind')) {
      if (lowerText.includes('liste') || lowerText.includes('mes rappels')) {
        return { action: 'list_reminders', params: {} };
      }
      return { action: 'create_reminder', params: { message: originalText } };
    }
    
    // Règles
    if (lowerText.includes('règle') || lowerText.includes('regle')) {
      if (lowerText.includes('liste') || lowerText.includes('affiche')) {
        return { action: 'config_list_rules', params: {} };
      }
      if (lowerText.includes('supprime')) {
        const numMatch = originalText.match(/(\d+)/);
        return { action: 'delete_rule', params: { ruleNumber: numMatch ? parseInt(numMatch[1]) : null } };
      }
      return { action: 'config_james', params: { text: originalText } };
    }
    
    // Mails importants
    if (lowerText.includes('important') || lowerText.includes('urgent')) {
      return { action: 'email_important', params: { filter: 'important' } };
    }
    
    // Résumé quotidien
    if (lowerText.includes('résumé quotidien') || lowerText.includes('journée mail')) {
      return { action: 'daily_summary', params: {} };
    }
    
    // Capacités
    if (lowerText.includes('que peut') || lowerText.includes('capacité') || lowerText.includes('fonctionnalité')) {
      return { action: 'describe_james', params: {} };
    }
    
    // Par défaut, résumé des emails récents
    return { action: 'email_summary', params: { count: 10 } };
  }

  /**
   * Analyser l'intention du message avec l'IA (mode Brian uniquement)
   * Cette méthode n'est appelée que quand aucun agent n'est actif
   */
  async analyzeIntent(text, from = null, userContext = null) {
    console.log('🧠 Brian analyse le message:', text);
    
    try {
      // Utiliser GPT pour analyser l'intention (mode Brian général)
      const response = await openaiService.chat([
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Analyse ce message et détermine l'intention:\n\n"${text}"` }
      ], { temperature: 0.1 });

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
            count: params.count || 10,
            filter: params.filter || null,
            from: params.from || null  // Expéditeur pour filtrer
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
      
      case 'describe_kiara':
        return { action: 'describe_kiara', params };
      
      case 'delete_rule':
        return { action: 'delete_rule', params: { ruleNumber: params.ruleNumber } };
      
      case 'email_search':
        return { action: 'email_search', params: { query: params.query, filter: params.filter } };
      
      case 'contact_search':
        return { action: 'contact_search', params: { name: params.name || params.query, text: params.text } };
      
      case 'set_reminder':
      case 'create_reminder':
        return { action: 'create_reminder', params: { message: params.message || params.text, delay: params.delay, time: params.time, text: params.text } };
      
      case 'list_reminders':
        return { action: 'list_reminders', params };
      
      case 'quick_reply':
      case 'email_reply':
        return { action: 'email_reply', params: { searchQuery: params.searchQuery, replyInstructions: params.replyInstructions, text: params.text } };
      
      case 'clean_emails':
      case 'email_cleanup':
        return { action: 'email_cleanup', params: { folder: params.folder, daysOld: params.daysOld, text: params.text } };
      
      case 'daily_summary':
        return { action: 'daily_summary', params };
      
      // ========== KIARA ACTIONS (depuis mapIntentToAction) ==========
      case 'kiara_complete_workflow':
        return { 
          action: 'kiara_complete_workflow', 
          params: { 
            query: originalText,
            topic: params.topic,
            articleCount: params.articleCount || params.count || 3
          } 
        };
      
      case 'kiara_generate_article':
        return { 
          action: 'kiara_generate_article', 
          params: { 
            query: originalText,
            topic: params.topic 
          } 
        };
      
      case 'kiara_trends':
        return { 
          action: 'kiara_trends', 
          params: { 
            topic: params.topic 
          } 
        };
      
      case 'kiara_publish':
        return { 
          action: 'kiara_publish', 
          params: { 
            title: params.title,
            text: originalText 
          } 
        };
      
      case 'kiara_schedule':
        return { 
          action: 'kiara_schedule', 
          params: { 
            text: originalText 
          } 
        };
      
      case 'kiara_global_stats':
        return { action: 'kiara_global_stats', params: {} };
      
      case 'kiara_modify':
        return { 
          action: 'kiara_modify', 
          params: { 
            text: originalText 
          } 
        };
      
      case 'kiara_pdf':
        return { 
          action: 'kiara_pdf', 
          params: { 
            text: originalText 
          } 
        };
      
      case 'kiara_delete_article':
        // Extraire le numéro/titre ET le statut (brouillon/publié)
        let deleteTarget = params.title || params.query;
        let deleteStatus = params.status || null;
        
        if (originalText) {
          const lowerOrig = originalText.toLowerCase();
          
          // Détecter le statut demandé
          if (lowerOrig.includes('brouillon') || lowerOrig.includes('draft')) {
            deleteStatus = 'draft';
          } else if (lowerOrig.includes('publié') || lowerOrig.includes('publier') || 
                     lowerOrig.includes('publish') || lowerOrig.includes('publie')) {
            deleteStatus = 'published';
          }
          
          // Extraire numéro: "supprime le brouillon 2", "supprime publié 1"
          const numMatch = originalText.match(/(?:supprime|delete|efface)\s+(?:l[ea]?\s+)?(?:article\s+)?(?:brouillon|draft|publié|publier|publish)?\s*(\d+)/i);
          if (numMatch) {
            deleteTarget = numMatch[1];
          } else if (!deleteTarget) {
            // Extraire titre: "supprime l'article GPU" -> "GPU"
            const titleMatch = originalText.match(/(?:supprime|delete|efface)\s+(?:l[ea]?\s+)?(?:article\s+)?(?:sur\s+)?["']?([^"'\d][^"']*?)["']?$/i);
            if (titleMatch && !titleMatch[1].match(/^(brouillon|draft|publi|publish)/i)) {
              deleteTarget = titleMatch[1].trim();
            }
          }
        }
        
        return { 
          action: 'kiara_delete_article', 
          params: { 
            title: deleteTarget,
            status: deleteStatus
          } 
        };
      
      case 'kiara_list_articles':
        return { 
          action: 'kiara_list_articles', 
          params: { 
            period: params.period || null 
          } 
        };
      
      case 'kiara_list_published':
        return { 
          action: 'kiara_list_published', 
          params: { 
            period: params.period || null 
          } 
        };
      
      case 'kiara_list_drafts':
        return { 
          action: 'kiara_list_drafts', 
          params: { 
            period: params.period || null 
          } 
        };
      
      case 'kiara_count_articles':
        return { 
          action: 'kiara_count_articles', 
          params: { 
            status: params.status || null,
            period: params.period || null 
          } 
        };
      
      case 'switch_to_james':
        return { action: 'switch_to_james', params: {} };
      
      case 'switch_to_kiara':
        return { action: 'switch_to_kiara', params: {} };
      
      case 'end_agent_session':
        return { action: 'end_agent_session', params: {} };
      
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

    // ========== KIARA - SEO & Blog ==========
    
    // Détection des demandes Kiara
    const isKiaraRequest = (
      lowerText.includes('kiara') ||
      lowerText.includes('blog') ||
      lowerText.includes('article') ||
      lowerText.includes('seo') ||
      lowerText.includes('tendance') ||
      lowerText.includes('trend') ||
      (lowerText.includes('stats') && !lowerText.includes('mail')) ||
      (lowerText.includes('statistique') && !lowerText.includes('mail')) ||
      lowerText.includes('vues') ||
      lowerText.includes('rédige') ||
      lowerText.includes('redige') ||
      lowerText.includes('écris un article') ||
      lowerText.includes('publie') ||
      lowerText.includes('publish') ||
      lowerText.includes('pdf') ||
      lowerText.includes('poster sur') ||
      lowerText.includes('site internet') ||
      lowerText.includes('portfolio') ||
      (lowerText.includes('meilleur') && !lowerText.includes('mail')) ||
      (lowerText.includes('recherche') && (lowerText.includes('article') || lowerText.includes('sujet') || lowerText.includes('tech'))) ||
      lowerText.includes('programme pour') ||
      lowerText.includes('carte graphique') ||
      lowerText.includes('gpu') ||
      lowerText.includes('actualité tech')
    );

    if (isKiaraRequest) {
      // Workflow complet: recherche + rédaction + PDF + publication
      const isCompleteWorkflow = (
        (lowerText.includes('recherche') || lowerText.includes('meilleur')) &&
        (lowerText.includes('rédige') || lowerText.includes('redige') || lowerText.includes('écris') || lowerText.includes('article')) &&
        (lowerText.includes('publie') || lowerText.includes('poster') || lowerText.includes('site'))
      );
      
      if (isCompleteWorkflow) {
        return { action: 'kiara_complete_workflow', params: { query: text } };
      }

      // Stats du blog
      if (lowerText.includes('stats') || lowerText.includes('statistique') || 
          lowerText.includes('vues') || lowerText.includes('views') || lowerText.includes('performance')) {
        
        // Stats d'un article spécifique
        if (lowerText.includes('article') || lowerText.includes('slug')) {
          const articleMatch = lowerText.match(/article\s+["']?([^"'\s]+)["']?|slug\s+["']?([^"'\s]+)["']?/i);
          const articleSlug = articleMatch ? (articleMatch[1] || articleMatch[2]) : null;
          return { action: 'kiara_article_stats', params: { slug: articleSlug, query: text } };
        }
        
        // Stats globales ou du jour
        if (lowerText.includes('aujourd') || lowerText.includes('jour') || lowerText.includes('daily') || lowerText.includes('today')) {
          return { action: 'kiara_daily_stats', params: {} };
        }
        
        return { action: 'kiara_global_stats', params: {} };
      }

      // Tendances
      if (lowerText.includes('tendance') || lowerText.includes('trend') || lowerText.includes('actualité')) {
        const topicMatch = lowerText.match(/tendance[s]?\s+(?:sur|de|du|en)?\s*["']?([^"'\n]+?)["']?(?:\s|$|!|\?)/i) ||
                          lowerText.match(/trend[s]?\s+(?:on|about|in)?\s*["']?([^"'\n]+?)["']?(?:\s|$|!|\?)/i);
        const topic = topicMatch ? topicMatch[1].trim() : 'tech';
        return { action: 'kiara_trends', params: { topic } };
      }

      // Génération d'article
      if (lowerText.includes('rédige') || lowerText.includes('redige') || lowerText.includes('génère') || 
          lowerText.includes('genere') || lowerText.includes('écris') || lowerText.includes('ecris') ||
          lowerText.includes('créer un article') || lowerText.includes('creer un article') ||
          (lowerText.includes('article') && (lowerText.includes('sur') || lowerText.includes('à propos')))) {
        return { action: 'kiara_generate_article', params: { query: text } };
      }

      // Publication
      if (lowerText.includes('publie') || lowerText.includes('publish')) {
        return { action: 'kiara_publish', params: { query: text } };
      }

      // Demande générique à Kiara
      return { action: 'kiara_general', params: { message: text } };
    }

    return { action: 'general', params: { text } };
  }

  /**
   * Gérer les salutations simples
   */
  async handleGreeting(params) {
    const greetings = [
      `👋 Salut ! Je suis Brian, ton assistant principal.\n\nJe manage une équipe d'agents IA:\n• 📧 **James** - Gestion des emails\n• ✍️ **Kiara** - SEO & Blog\n• 💰 **Magali** - Conseils bancaires (bientôt)\n\nQue puis-je faire pour toi ?`,
      `Hey ! 👋 Brian à ton service !\n\nDis-moi ce dont tu as besoin:\n• Emails ? Je passe le relais à James\n• Blog/SEO ? Kiara s'en occupe\n• Questions ? Je réponds directement\n\nTape "aide" pour voir toutes mes capacités !`,
      `Bonjour ! 🙌 Je suis Brian.\n\nJe suis là pour t'aider avec:\n• 📧 Tes emails (via James)\n• ✍️ Ton blog (via Kiara)\n• 💰 Tes finances (via Magali - bientôt)\n\nQu'est-ce que je peux faire pour toi ?`
    ];
    
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Gérer la demande de résumé d'emails
   * Supporte: count, filter (temporel), from (expéditeur)
   */
  async handleEmailSummary(params) {
    const count = params.count || 10; // Par défaut 10, pas 50
    const filter = params.filter || null;
    const from = params.from || null;
    
    let logMessage = `📧 James analyse`;
    if (from) logMessage += ` les emails de ${from}`;
    else logMessage += ` les ${count} derniers emails`;
    if (filter) logMessage += ` (${filter})`;
    console.log(logMessage + '...');
    
    // Utiliser la nouvelle méthode avec filtres avancés
    const result = await mailAgent.getFilteredEmailSummary({ count, filter, from });
    
    if (!result.success) {
      if (result.message.includes('pas connecté')) {
        return `${result.message}\n\n🔗 Connectez-vous ici: ${process.env.AZURE_REDIRECT_URI?.replace('/callback', '')}`;
      }
      return result.message;
    }

    // Construire le message de retour
    let header = `🤖 **James** a analysé `;
    if (from) {
      header += `les emails de **${from}**`;
      if (filter) header += ` (${filter})`;
    } else {
      header += count === 1 ? 'votre dernier email' : `vos ${result.emailCount || count} derniers emails`;
    }
    header += ':\n\n';
    
    return header + result.message;
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
    return `🤖 **Tous les services de James - Assistant Email**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 **LECTURE & RÉSUMÉ D'EMAILS**
• "Résume mes 10 derniers mails reçus aujourd'hui"
• "Donne-moi un résumé de mes 5 derniers emails"
• "Quels sont mes emails non lus ?"
• "Montre-moi les mails importants de la semaine"
• "Résumé de ma journée email"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 **CLASSIFICATION AUTOMATIQUE**
• "Classe mes 20 derniers emails dans les bons dossiers"
• "Reclasse les mails du dossier Newsletter"
• "Analyse et trie mes emails de la semaine"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 **RECHERCHE INTELLIGENTE**
• "Cherche tous les mails d'Amazon des 7 derniers jours"
• "Trouve les emails qui parlent de facture"
• "Recherche les mails de Jean Dupont"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📇 **RECHERCHE DE CONTACT**
• "Quel est le mail de Brian ?"
• "Trouve l'adresse email de Pierre"
• "Cherche le contact Jean-Marc"
• "Comment contacter Dupont ?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 **ENVOI D'EMAILS**
• "Envoie un mail à pierre@email.com pour lui dire que je serai en retard demain"
• "Écris un email professionnel à mon chef pour demander un jour de congé"
• "Envoie un mail à Brian" _(si plusieurs contacts, James propose une liste)_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✉️ **RÉPONSE RAPIDE**
• "Réponds au dernier mail de Marie pour accepter sa proposition"
• "Envoie une réponse au mail de LinkedIn pour décliner poliment"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ **RAPPELS & NOTIFICATIONS**
• "Rappelle-moi dans 2 heures de répondre au mail de mon client"
• "Préviens-moi demain à 9h de vérifier mes emails"
• "Quels sont mes rappels en attente ?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗑️ **SUPPRESSION PAR EXPÉDITEUR**
• "Supprime tous les mails LinkedIn reçus aujourd'hui"
• "Supprime les emails venant d'Amazon de cette semaine"
• "Nettoie les mails de Facebook d'hier"

🗑️ **SUPPRESSION PAR DOSSIER**
• "Vide le dossier Courrier indésirable"
• "Supprime les mails du dossier Newsletter de plus de 30 jours"
• "Nettoie la corbeille"

🗑️ **SUPPRESSION COMBINÉE**
• "Supprime les mails LinkedIn du dossier Newsletter"
• "Supprime les emails Google du dossier Spam d'aujourd'hui"
• "Nettoie les mails Amazon du dossier Shopping de la semaine"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ **RÈGLES DE CLASSIFICATION**
• "Mets automatiquement les mails LinkedIn dans le dossier Newsletter"
• "Crée une règle : les mails de mon chef vont dans Urgent"
• "Affiche toutes mes règles de classification"
• "Supprime la règle numéro 3"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 **GESTION DES DOSSIERS**
• "Crée un nouveau dossier appelé Projets Client"
• "Supprime le dossier Publicités"
• "Liste tous mes dossiers emails"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **STATUS & CONNEXION**
• "Quel est le status de ma connexion Outlook ?"
• "Reconnecte mon compte email"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✍️ **KIARA - SEO & BLOG MANAGER**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 **RECHERCHE DE TENDANCES**
• "Kiara, quelles sont les tendances IA ?"
• "Tendances tech du moment"
• "Actualités sur le développement web"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✍️ **GÉNÉRATION D'ARTICLES**
• "Kiara, rédige un article sur l'IA générative"
• "Écris un article SEO sur le machine learning"
• "Génère un article à propos des tendances tech 2025"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 **STATISTIQUES DU BLOG**
• "Stats du blog aujourd'hui"
• "Stats globales du blog"
• "Stats de l'article intelligence-artificielle"
• "Quelles sont les performances du blog ?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 **PUBLICATION**
• "Publie l'article sur le blog"
• "Programme cet article pour demain 9h"`;
  }

  /**
   * Décrire toutes les capacités de James
   */
  getJamesCapabilities() {
    return `🤖 **James - Assistant Email Intelligent**

━━━━━ 📧 EMAILS ━━━━━
• "Résume mes 10 derniers mails reçus"
• "Quels sont mes emails non lus ?"
• "Montre les mails importants d'aujourd'hui"

━━━━━ 📂 CLASSIFICATION ━━━━━
• "Classe mes 20 derniers emails"
• "Reclasse le dossier Newsletter"
• "Analyse et trie mes emails"

━━━━━ 🔍 RECHERCHE EMAILS ━━━━━
• "Cherche les mails d'Amazon"
• "Trouve les emails de facture"
• "Recherche les mails de Jean"

━━━━━ 📇 RECHERCHE CONTACT ━━━━━
• "Quel est le mail de Brian ?"
• "Trouve l'adresse email de Pierre"
• "Cherche le contact Jean-Marc"

━━━━━ 📤 ENVOI ━━━━━
• "Envoie un mail à pierre@email.com pour dire..."
• "Écris un email à mon chef pour demander..."
• "Envoie un mail à Brian" _(recherche auto)_

━━━━━ ✉️ RÉPONSE ━━━━━
• "Réponds au mail de Marie pour accepter"
• "Envoie une réponse à LinkedIn pour décliner"

━━━━━ ⏰ RAPPELS ━━━━━
• "Rappelle-moi dans 2h de répondre au client"
• "Préviens-moi demain à 9h"
• "Quels sont mes rappels ?"

━━━━━ 🗑️ SUPPRESSION ━━━━━

*Par expéditeur:*
• "Supprime les mails LinkedIn d'aujourd'hui"
• "Supprime les emails Amazon de la semaine"
• "Nettoie les mails Facebook d'hier"

*Par dossier:*
• "Vide le dossier Spam"
• "Supprime les mails Newsletter +30 jours"
• "Nettoie la corbeille"

*Combinée:*
• "Supprime les mails LinkedIn du dossier Newsletter"
• "Supprime les Google du Spam d'aujourd'hui"

━━━━━ ⚙️ RÈGLES ━━━━━
• "Mets les mails LinkedIn dans Newsletter"
• "Affiche mes règles"
• "Supprime la règle 3"

━━━━━ 📁 DOSSIERS ━━━━━
• "Crée le dossier Projets"
• "Supprime le dossier Pub"
• "Liste mes dossiers"

📂 **Dossiers par défaut:** 🔴Urgent 💼Pro 🛒Shopping 📰Newsletter 🏦Finance 🤝Social`;
  }

  /**
   * Retourne les capacités de Kiara (description agent SEO/Blog)
   */
  getKiaraCapabilities() {
    return `✍️ **Kiara - Assistant SEO & Blog Intelligent**

━━━━━ 🔥 TENDANCES ━━━━━
• "Quelles sont les tendances tech ?"
• "Tendances actuelles en IA"
• "C'est quoi le buzz en ce moment ?"

━━━━━ 📝 GÉNÉRATION D'ARTICLES ━━━━━
• "Rédige un article sur les GPU"
• "Écris un blog sur l'intelligence artificielle"
• "Génère un article sur le cloud computing"

━━━━━ 🚀 WORKFLOW COMPLET ━━━━━
_(Recherche → Rédaction → PDF → Brouillon)_
• "Recherche 3 articles sur les GPU et génère un blog"
• "Fais moi un article complet sur l'IA générative"
• "Crée un article tech sur React avec 2 sources"

━━━━━ 📊 STATISTIQUES ━━━━━
• "Stats du blog"
• "Combien de vues sur mes articles ?"
• "Quels sont les articles les plus lus ?"

━━━━━ 📄 PDF ━━━━━
• "Envoie-moi le PDF"
• "Génère le PDF de l'article"
• "Je veux le PDF"

━━━━━ ✏️ MODIFICATION ━━━━━
• "Change le titre par..."
• "Modifie l'introduction"
• "Corrige le paragraphe sur..."

━━━━━ 📅 PUBLICATION ━━━━━
• "Publie l'article"
• "Programme l'article pour demain 10h"
• "Planifie la publication pour lundi"

━━━━━ 📋 GESTION ARTICLES ━━━━━
• "Mes articles" - Voir tous (publiés + brouillons)
• "Mes brouillons" - Articles en attente
• "Supprime l'article [titre]"
• "Supprime le brouillon"

━━━━━ 🗑️ SUPPRESSION ━━━━━
• "Supprime l'article sur les GPU"
• "Supprime le numéro 2"
• "Supprime article" (voir la liste)

💡 **Conseil:** Commence par "Recherche X articles sur [sujet] et génère un blog" pour un workflow complet !

🔍 **SEO:** Articles optimisés avec meta, keywords, FAQ et structure H2/H3

🌐 **Blog:** www.brianbiendou.com/blog`;
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
   * Rechercher un contact par nom
   */
  async handleContactSearch(params) {
    const name = params.name || params.query || params.text;
    
    if (!name) {
      return `🔍 **Recherche de contact**\n\nQuel contact cherchez-vous ?\n\nExemples:\n• "Quel est le mail de Brian"\n• "Trouve l'adresse email de Pierre"\n• "Cherche le contact Jean-Marc"`;
    }

    if (!outlookService.isConnected()) {
      return `❌ Outlook n'est pas connecté.\n\n🔗 Connectez-vous ici:\n${process.env.FRONTEND_URL || 'https://agent-nine-psi.vercel.app'}/auth/outlook`;
    }

    console.log(`🔍 James recherche le contact: "${name}"...`);
    
    try {
      const contacts = await outlookService.searchContactsByName(name);
      
      if (contacts.length === 0) {
        return `🤖 **James** rapporte:\n\n❌ Aucun contact trouvé pour **"${name}"**.\n\n💡 **Conseils:**\n• Vérifiez l'orthographe\n• Essayez un autre nom/prénom\n• Cette personne vous a-t-elle déjà envoyé un email ?`;
      }

      let message = `🤖 **James** rapporte:\n\n📇 **${contacts.length} contact(s) trouvé(s)** pour "${name}":\n\n`;
      
      contacts.forEach((contact, index) => {
        const lastContactStr = contact.lastContact 
          ? new Date(contact.lastContact).toLocaleDateString('fr-FR')
          : 'N/A';
        const direction = contact.fromMe ? '📤 Envoyé' : '📥 Reçu';
        
        message += `**${index + 1}. ${contact.name}**\n`;
        message += `   📧 ${contact.email}\n`;
        message += `   📅 Dernier échange: ${lastContactStr} (${direction})\n\n`;
      });

      if (contacts.length === 1) {
        message += `💡 Vous pouvez maintenant dire: "Envoie un mail à ${contacts[0].email}"`;
      } else {
        message += `💡 Copiez l'adresse email souhaitée pour envoyer un message.`;
      }

      return message;
    } catch (error) {
      console.error('❌ Erreur recherche contact:', error);
      return `❌ Erreur lors de la recherche: ${error.message}`;
    }
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
    
    const result = await mailAgent.createReminder(from, message);
    
    return result.message;
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
   * Nettoyage intelligent des emails avec filtres avancés
   * Supporte: expéditeur, dossier, période (aujourd'hui, semaine, X jours)
   */
  async handleCleanEmails(params) {
    const text = params.text || '';
    const lowerText = text.toLowerCase();
    
    // Construire les critères de suppression
    const criteria = {
      limit: 100
    };
    
    // 1. Détecter l'expéditeur (LinkedIn, Amazon, etc.)
    const senderPatterns = [
      { pattern: /linkedin/i, name: 'linkedin' },
      { pattern: /amazon/i, name: 'amazon' },
      { pattern: /facebook/i, name: 'facebook' },
      { pattern: /twitter|x\.com/i, name: 'twitter' },
      { pattern: /instagram/i, name: 'instagram' },
      { pattern: /google/i, name: 'google' },
      { pattern: /microsoft/i, name: 'microsoft' },
      { pattern: /apple/i, name: 'apple' },
      { pattern: /netflix/i, name: 'netflix' },
      { pattern: /spotify/i, name: 'spotify' },
      { pattern: /uber/i, name: 'uber' },
      { pattern: /airbnb/i, name: 'airbnb' },
    ];
    
    for (const { pattern, name } of senderPatterns) {
      if (pattern.test(text)) {
        criteria.from = name;
        break;
      }
    }
    
    // Ou extraction générique "mails de X" ou "emails X"
    if (!criteria.from) {
      const fromMatch = text.match(/(?:mails?|emails?)\s+(?:de\s+)?(\w+)/i);
      if (fromMatch && fromMatch[1].length > 2) {
        // Vérifier que ce n'est pas un mot-clé de dossier ou de temps
        const excluded = ['dossier', 'folder', 'aujourd', 'today', 'hier', 'yesterday', 'semaine', 'week', 'mois', 'month', 'vieux', 'old', 'derniers', 'last'];
        if (!excluded.includes(fromMatch[1].toLowerCase())) {
          criteria.from = fromMatch[1];
        }
      }
    }
    
    // 2. Détecter le dossier cible
    const folderPatterns = [
      { pattern: /newsletter/i, folder: '📰 Newsletter' },
      { pattern: /spam|ind[eé]sirable|junk/i, folder: 'Junk Email' },
      { pattern: /corbeille|trash|deleted|supprim/i, folder: 'Deleted Items' },
      { pattern: /envoy[eé]|sent/i, folder: 'Sent Items' },
      { pattern: /urgent/i, folder: '🔴 Urgent' },
      { pattern: /professionnel/i, folder: '💼 Professionnel' },
      { pattern: /shopping/i, folder: '🛒 Shopping' },
      { pattern: /social/i, folder: '🤝 Social' },
      { pattern: /finance/i, folder: '🏦 Finance' },
      { pattern: /iscod/i, folder: 'ISCOD' },
      { pattern: /inbox|bo[îi]te\s*de\s*r[eé]ception/i, folder: 'Inbox' },
    ];
    
    // Chercher "du dossier X" ou "dans le dossier X"
    const folderNameMatch = text.match(/(?:du|dans\s+le?|from)\s+(?:dossier|folder)?\s*["']?(\w+)["']?/i);
    if (folderNameMatch) {
      criteria.folder = folderNameMatch[1];
    } else {
      for (const { pattern, folder } of folderPatterns) {
        if (pattern.test(text)) {
          criteria.folder = folder;
          break;
        }
      }
    }
    
    // 3. Détecter la période
    if (lowerText.includes("aujourd'hui") || lowerText.includes('today') || lowerText.includes('du jour') || lowerText.includes('de la journ')) {
      // Emails d'aujourd'hui = moins de 1 jour
      criteria.period = 'today';
      criteria.olderThanDays = 0; // On utilisera un filtre différent
    } else if (lowerText.includes('hier') || lowerText.includes('yesterday')) {
      criteria.period = 'yesterday';
    } else if (lowerText.includes('semaine') || lowerText.includes('week')) {
      const weeksMatch = text.match(/(\d+)\s*semaine/i);
      criteria.olderThanDays = weeksMatch ? parseInt(weeksMatch[1]) * 7 : 7;
    } else if (lowerText.includes('mois') || lowerText.includes('month')) {
      const monthsMatch = text.match(/(\d+)\s*mois/i);
      criteria.olderThanDays = monthsMatch ? parseInt(monthsMatch[1]) * 30 : 30;
    } else {
      const daysMatch = text.match(/(\d+)\s*jour/i);
      if (daysMatch) {
        criteria.olderThanDays = parseInt(daysMatch[1]);
      }
    }
    
    // 4. Si on a des critères de période spéciale (aujourd'hui, hier), les traiter différemment
    if (criteria.period === 'today' || criteria.period === 'yesterday') {
      // Utiliser une méthode de suppression par date exacte
      const result = await mailAgent.cleanEmailsByDate(criteria);
      return `🤖 **James** rapporte:\n\n${result.message}`;
    }

    console.log(`🗑️ James nettoie avec critères:`, criteria);
    
    // 5. Exécuter la suppression
    const result = await mailAgent.cleanupEmails(criteria);
    
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

  // ========================================
  // ========== KIARA HANDLERS =============
  // ========================================

  /**
   * Recherche de tendances avec période temporelle et domaine
   */
  async handleKiaraTrends(params) {
    const text = params.text || params.topic || 'tech';
    const period = params.period || null;
    
    console.log(`🔍 Kiara recherche les tendances, période: ${period || 'aujourd\'hui'}...`);
    
    try {
      // Appeler la méthode handleTrendRequest de Kiara avec le texte complet (pour résoudre le domaine)
      const result = await kiaraAgent.handleTrendRequest(text, period);
      return result;
    } catch (error) {
      console.error('Erreur Kiara trends:', error);
      return `❌ Erreur lors de la recherche de tendances: ${error.message}`;
    }
  }

  /**
   * Génération d'article
   */
  async handleKiaraGenerateArticle(params) {
    console.log(`✍️ Kiara génère un article...`);
    
    try {
      const result = await kiaraAgent.handleMessage(params.query, 'user');
      return result;
    } catch (error) {
      console.error('Erreur Kiara article:', error);
      return `❌ Erreur lors de la génération de l'article: ${error.message}`;
    }
  }

  /**
   * Publication d'article
   */
  async handleKiaraPublish(from, params) {
    console.log(`📤 Kiara prépare la publication...`);
    
    try {
      const result = await kiaraAgent.handlePublishRequest(params.text || 'publie l\'article', { from });
      return result;
    } catch (error) {
      console.error('Erreur Kiara publish:', error);
      return `❌ Erreur lors de la publication: ${error.message}`;
    }
  }

  /**
   * Programmation d'article
   */
  async handleKiaraSchedule(from, params) {
    console.log(`📅 Kiara programme un article...`);
    
    try {
      const result = await kiaraAgent.handleScheduleRequest(params.text, { from });
      return result;
    } catch (error) {
      console.error('Erreur Kiara schedule:', error);
      return `❌ Erreur lors de la programmation: ${error.message}`;
    }
  }

  /**
   * Modification d'article
   */
  async handleKiaraModify(from, params) {
    console.log(`✏️ Kiara modifie un article...`);
    
    try {
      const result = await kiaraAgent.handleModifyRequest(params.text, { from });
      return result;
    } catch (error) {
      console.error('Erreur Kiara modify:', error);
      return `❌ Erreur lors de la modification: ${error.message}`;
    }
  }

  /**
   * Stats du jour
   */
  async handleKiaraDailyStats() {
    console.log(`📊 Kiara récupère les stats du jour...`);
    
    try {
      const result = await kiaraAgent.getDailyStats();
      
      if (result.success) {
        return `📊 **Kiara** - Stats du jour:\n\n${result.message}`;
      } else {
        return `❌ Kiara n'a pas pu récupérer les stats: ${result.message}`;
      }
    } catch (error) {
      console.error('Erreur Kiara daily stats:', error);
      return `❌ Erreur lors de la récupération des stats: ${error.message}`;
    }
  }

  /**
   * Stats globales du blog
   */
  async handleKiaraGlobalStats() {
    console.log(`📈 Kiara récupère les stats globales...`);
    
    try {
      const result = await kiaraAgent.getGlobalStats();
      
      if (result.success) {
        return `📈 **Kiara** - Stats globales du blog:\n\n${result.message}`;
      } else {
        return `❌ Kiara n'a pas pu récupérer les stats: ${result.message}`;
      }
    } catch (error) {
      console.error('Erreur Kiara global stats:', error);
      return `❌ Erreur lors de la récupération des stats: ${error.message}`;
    }
  }

  /**
   * Stats d'un article spécifique
   */
  async handleKiaraArticleStats(params) {
    console.log(`📊 Kiara récupère les stats de l'article...`);
    
    try {
      // Si on a un slug, on l'utilise, sinon on passe la query
      const identifier = params.slug || params.query;
      const result = await kiaraAgent.getArticleStats(identifier);
      
      if (result.success) {
        return `📊 **Kiara** - Stats de l'article:\n\n${result.message}`;
      } else {
        return `❌ Kiara n'a pas pu trouver l'article: ${result.message}`;
      }
    } catch (error) {
      console.error('Erreur Kiara article stats:', error);
      return `❌ Erreur lors de la récupération des stats: ${error.message}`;
    }
  }

  /**
   * Demande générale à Kiara (avec contexte de conversation)
   */
  async handleKiaraGeneral(from, params) {
    console.log(`🤖 Kiara traite une demande générale avec contexte...`);
    
    try {
      // Passer l'historique de conversation à Kiara
      const conversationHistory = params.conversationHistory || [];
      const result = await kiaraAgent.handleMessageWithContext(params.text || params.message, { from }, conversationHistory);
      return result;
    } catch (error) {
      console.error('Erreur Kiara general:', error);
      return `❌ Kiara a rencontré une erreur: ${error.message}`;
    }
  }

  /**
   * Workflow complet Kiara: Recherche → Rédaction → PDF → Publication
   */
  async handleKiaraCompleteWorkflow(from, params) {
    console.log(`🚀 Kiara exécute le workflow complet...`);
    
    try {
      const result = await kiaraAgent.executeCompleteWorkflow(params.query, { from });
      return result;
    } catch (error) {
      console.error('Erreur Kiara workflow:', error);
      return `❌ Kiara a rencontré une erreur lors du workflow: ${error.message}`;
    }
  }

  /**
   * Génération et envoi du PDF de l'article
   */
  async handleKiaraPDF(from, params) {
    console.log(`📄 Kiara génère le PDF...`);
    
    try {
      // Mettre à jour le contexte - on est avec Kiara
      this.setUserContext(from, 'kiara');
      
      const result = await kiaraAgent.handlePdfRequest(params.text, { from });
      return result;
    } catch (error) {
      console.error('Erreur Kiara PDF:', error);
      return `❌ Kiara n'a pas pu générer le PDF: ${error.message}`;
    }
  }

  /**
   * Lister les brouillons de Kiara (avec filtres)
   */
  async handleKiaraListDrafts(params = {}) {
    console.log(`📝 Kiara liste les brouillons...`);
    
    try {
      const result = await kiaraAgent.listArticlesFiltered({ 
        status: 'draft', 
        period: params.period || null 
      });
      return `✍️ **Kiara** rapporte:\n\n${result}`;
    } catch (error) {
      console.error('Erreur Kiara list drafts:', error);
      return `❌ Kiara n'a pas pu lister les brouillons: ${error.message}`;
    }
  }

  /**
   * Lister les articles publiés (avec filtres)
   */
  async handleKiaraListPublished(params = {}) {
    console.log(`📢 Kiara liste les articles publiés...`);
    
    try {
      const result = await kiaraAgent.listArticlesFiltered({ 
        status: 'published', 
        period: params.period || null 
      });
      return `✍️ **Kiara** rapporte:\n\n${result}`;
    } catch (error) {
      console.error('Erreur Kiara list published:', error);
      return `❌ Kiara n'a pas pu lister les articles publiés: ${error.message}`;
    }
  }

  /**
   * Compter les articles (avec filtres)
   */
  async handleKiaraCountArticles(params = {}) {
    console.log(`📊 Kiara compte les articles...`);
    
    try {
      const result = await kiaraAgent.listArticlesFiltered({ 
        status: params.status || null, 
        period: params.period || null,
        countOnly: true 
      });
      return `✍️ **Kiara** rapporte:\n\n${result}`;
    } catch (error) {
      console.error('Erreur Kiara count articles:', error);
      return `❌ Kiara n'a pas pu compter les articles: ${error.message}`;
    }
  }

  /**
   * Supprimer un article via Kiara
   */
  async handleKiaraDeleteArticle(params) {
    console.log(`🗑️ Kiara supprime un article...`, params);
    
    try {
      const searchTerm = params.title || params.query || null;
      const status = params.status || null; // 'published', 'draft', ou null
      const result = await kiaraAgent.deleteArticle(searchTerm, status);
      return `✍️ **Kiara** rapporte:\n\n${result}`;
    } catch (error) {
      console.error('Erreur Kiara delete article:', error);
      return `❌ Kiara n'a pas pu supprimer l'article: ${error.message}`;
    }
  }

  /**
   * Lister tous les articles via Kiara (avec filtres optionnels)
   */
  async handleKiaraListArticles(params = {}) {
    console.log(`📚 Kiara liste les articles...`);
    
    try {
      const result = await kiaraAgent.listArticlesFiltered({ 
        period: params.period || null 
      });
      return `✍️ **Kiara** rapporte:\n\n${result}`;
    } catch (error) {
      console.error('Erreur Kiara list articles:', error);
      return `❌ Kiara n'a pas pu lister les articles: ${error.message}`;
    }
  }

  /**
   * Gestion du contexte utilisateur avec historique de conversation
   */
  setUserContext(from, agent, extraData = {}) {
    const existingContext = this.userContexts.get(from) || {};
    
    // Initialiser l'historique si nécessaire
    if (!existingContext.conversationHistory) {
      existingContext.conversationHistory = {
        kiara: [],
        james: []
      };
    }
    
    this.userContexts.set(from, {
      ...existingContext,
      agent,
      lastActivity: new Date(),
      ...extraData
    });
    console.log(`📍 Contexte mis à jour pour ${from}: agent actif = ${agent}`);
  }

  getUserContext(from) {
    return this.userContexts.get(from) || null;
  }

  /**
   * Ajouter un message à l'historique de conversation
   */
  addToConversationHistory(from, agent, role, content) {
    let context = this.userContexts.get(from);
    if (!context) {
      context = {
        agent: null,
        conversationHistory: { kiara: [], james: [] }
      };
    }
    
    if (!context.conversationHistory) {
      context.conversationHistory = { kiara: [], james: [] };
    }
    
    // Limiter l'historique à 20 messages par agent (10 échanges)
    if (context.conversationHistory[agent].length >= 20) {
      context.conversationHistory[agent] = context.conversationHistory[agent].slice(-18);
    }
    
    context.conversationHistory[agent].push({
      role,
      content,
      timestamp: new Date()
    });
    
    this.userContexts.set(from, context);
  }

  /**
   * Récupérer l'historique de conversation pour un agent
   */
  getConversationHistory(from, agent) {
    const context = this.userContexts.get(from);
    if (!context || !context.conversationHistory) return [];
    return context.conversationHistory[agent] || [];
  }

  /**
   * Effacer l'historique d'un agent spécifique
   */
  clearAgentHistory(from, agent) {
    const context = this.userContexts.get(from);
    if (context && context.conversationHistory && context.conversationHistory[agent]) {
      context.conversationHistory[agent] = [];
      this.userContexts.set(from, context);
    }
  }

  clearUserContext(from) {
    this.userContexts.delete(from);
    console.log(`🧹 Contexte effacé pour ${from}`);
  }

  /**
   * Passer à James (emails) - MODE EXCLUSIF
   */
  handleSwitchToJames(from) {
    this.setUserContext(from, 'james');
    return `📧 **Mode James activé**\n\n` +
           `Tu es maintenant avec **James** (Mail Assistant)\n` +
           `━━━━━━━━━━━━━━━━━━\n\n` +
           `📌 **Ce que je peux faire:**\n` +
           `• "Résume mes mails" - Résumé de tes emails récents\n` +
           `• "Mails non lus" - Liste des emails non lus\n` +
           `• "Classe mes emails" - Trier dans les dossiers\n` +
           `• "Envoie un mail à..." - Rédiger et envoyer\n` +
           `• "Mes dossiers" - Gérer tes dossiers Outlook\n` +
           `• "Mes rappels" - Voir tes rappels\n\n` +
           `⚠️ *Les demandes blog/SEO seront bloquées tant que tu es avec James.*\n\n` +
           `💡 **Pour quitter James:** dis "fini avec James" ou "merci James"`;
  }

  /**
   * Passer à Kiara (blog) - MODE EXCLUSIF
   */
  handleSwitchToKiara(from) {
    this.setUserContext(from, 'kiara');
    return `✍️ **Mode Kiara activé**\n\n` +
           `Tu es maintenant avec **Kiara** (SEO & Blog Manager)\n` +
           `━━━━━━━━━━━━━━━━━━\n\n` +
           `📌 **Ce que je peux faire:**\n` +
           `• "Rédige un article sur..." - Créer du contenu SEO\n` +
           `• "Tendances du moment" - Sujets populaires\n` +
           `• "Mes articles" - Liste complète\n` +
           `• "Mes brouillons" / "Mes publiés" - Filtrer\n` +
           `• "PDF de l'article" - Exporter en PDF\n` +
           `• "Publie l'article" - Mettre en ligne\n` +
           `• "Supprime le brouillon X" - Supprimer\n\n` +
           `⚠️ *Les demandes email seront bloquées tant que tu es avec Kiara.*\n\n` +
           `💡 **Pour quitter Kiara:** dis "fini avec Kiara" ou "merci Kiara"`;
  }

  /**
   * Terminer la session avec un agent
   */
  handleEndAgentSession(from) {
    const context = this.getUserContext(from);
    this.clearUserContext(from);
    
    const previousAgent = context?.agent;
    const agentName = previousAgent === 'kiara' ? 'Kiara' : previousAgent === 'james' ? 'James' : null;
    
    return `✅ **Session ${agentName ? `avec ${agentName}` : ''} terminée**\n\n` +
           `Je suis **Brian**, ton assistant principal.\n` +
           `━━━━━━━━━━━━━━━━━━\n\n` +
           `👥 **Mon équipe:**\n` +
           `• **"Kiara"** → Blog & SEO\n` +
           `• **"James"** → Emails & Outlook\n\n` +
           `💡 Dis simplement le nom de l'agent pour commencer une session.`;
  }
}

module.exports = new PrincipalAgent();
