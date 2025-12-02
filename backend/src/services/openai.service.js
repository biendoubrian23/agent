const OpenAI = require('openai');
const supabaseService = require('./supabase.service');

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Cache local des règles (synchronisé avec Supabase)
    this.customClassificationRules = [];
    
    // Cache local des instructions (synchronisé avec Supabase)
    this.jamesCustomInstructions = '';
    
    // Initialiser depuis Supabase au démarrage
    this.initFromSupabase();
  }

  /**
   * Appel générique à l'API ChatGPT
   * Supporte deux formats:
   * - chat(messages[], options) - Tableau de messages
   * - chat(systemPrompt, userMessage, options) - Format simple
   */
  async chat(messagesOrSystem, userMessageOrOptions = '', maybeOptions = {}) {
    let messages;
    let options;

    console.log('🔍 chat() appelé avec:', typeof messagesOrSystem, Array.isArray(messagesOrSystem));

    // Déterminer le format d'appel
    if (Array.isArray(messagesOrSystem)) {
      // Format: chat([{role, content}, ...], options)
      messages = messagesOrSystem;
      options = (typeof userMessageOrOptions === 'object' && !Array.isArray(userMessageOrOptions)) 
        ? userMessageOrOptions 
        : {};
    } else if (typeof messagesOrSystem === 'string' && typeof userMessageOrOptions === 'string') {
      // Format: chat(systemPrompt, userMessage, options)
      messages = [
        { role: 'system', content: messagesOrSystem },
        { role: 'user', content: userMessageOrOptions }
      ];
      options = maybeOptions || {};
    } else {
      // Fallback: traiter comme system prompt seul
      messages = [
        { role: 'system', content: String(messagesOrSystem || '') },
        { role: 'user', content: String(userMessageOrOptions || 'Réponds.') }
      ];
      options = maybeOptions || {};
    }

    // S'assurer que options est un objet
    if (typeof options !== 'object' || options === null) {
      options = {};
    }

    // Nettoyer et valider les messages - s'assurer que content est une STRING
    const cleanedMessages = [];
    for (const m of messages) {
      if (m && m.role && m.content !== undefined && m.content !== null) {
        cleanedMessages.push({
          role: String(m.role),
          content: String(m.content) // Force en string
        });
      }
    }
    
    if (cleanedMessages.length === 0) {
      throw new Error('Aucun message valide fourni à chat()');
    }

    console.log('🔍 Messages préparés:', cleanedMessages.length, 'messages');

    try {
      const requestBody = {
        model: options.model || 'gpt-4o-mini',
        messages: cleanedMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens || 1000
      };
      
      console.log('🔍 Envoi à OpenAI...');
      
      const response = await this.client.chat.completions.create(requestBody);

      console.log('✅ Réponse OpenAI reçue');
      return response.choices[0].message.content;
    } catch (error) {
      console.error('❌ Erreur OpenAI:', error.message);
      console.error('📋 Premier message:', JSON.stringify(cleanedMessages[0]).substring(0, 200));
      throw error;
    }
  }

  /**
   * Initialiser les données depuis Supabase
   */
  async initFromSupabase() {
    try {
      // Attendre que Supabase soit prêt
      await supabaseService.getOrCreateDefaultUser();
      
      // Charger les règles
      const rules = await supabaseService.getClassificationRules();
      this.customClassificationRules = rules.map(r => ({
        pattern: r.pattern,
        folder: r.folder,
        type: r.rule_type,
        id: r.id
      }));
      
      // Charger les instructions de James
      this.jamesCustomInstructions = await supabaseService.getCustomInstructions('james');
      
      console.log(`📂 Chargé depuis Supabase: ${this.customClassificationRules.length} règles, ${this.jamesCustomInstructions ? 'instructions perso' : 'pas d\'instructions'}`);
    } catch (error) {
      console.log('⚠️ Impossible de charger depuis Supabase:', error.message);
    }
  }

  // ==================== GESTION DES RÈGLES PERSONNALISÉES ====================

  /**
   * Ajouter une règle de classification personnalisée
   */
  async addCustomRule(rule) {
    // Sauvegarder dans Supabase
    const saved = await supabaseService.addClassificationRule(rule);
    
    // Ajouter au cache local
    this.customClassificationRules.push({
      ...rule,
      id: saved?.id,
      addedAt: new Date().toISOString()
    });
    
    console.log(`📝 Nouvelle règle ajoutée: ${rule.pattern} → ${rule.folder}`);
    return this.customClassificationRules;
  }

  /**
   * Supprimer une règle par son pattern
   */
  async removeCustomRule(pattern) {
    // Supprimer de Supabase
    await supabaseService.removeClassificationRule(pattern);
    
    // Supprimer du cache local
    const before = this.customClassificationRules.length;
    this.customClassificationRules = this.customClassificationRules.filter(
      r => r.pattern.toLowerCase() !== pattern.toLowerCase()
    );
    const removed = before - this.customClassificationRules.length;
    console.log(`🗑️ ${removed} règle(s) supprimée(s) pour: ${pattern}`);
    return removed > 0;
  }

  /**
   * Supprimer une règle par son index (numéro)
   * @param {number} index - Numéro de la règle (1-indexed)
   */
  async removeCustomRuleByIndex(index) {
    const rules = this.customClassificationRules;
    
    if (index < 1 || index > rules.length) {
      return { success: false, message: `Règle n°${index} introuvable. Il y a ${rules.length} règle(s).` };
    }
    
    const rule = rules[index - 1]; // Convertir en 0-indexed
    const pattern = rule.pattern;
    
    // Supprimer de Supabase
    await supabaseService.removeClassificationRule(pattern);
    
    // Supprimer du cache local
    this.customClassificationRules.splice(index - 1, 1);
    
    console.log(`🗑️ Règle n°${index} supprimée: ${pattern} → ${rule.folder}`);
    
    return { 
      success: true, 
      message: `Règle n°${index} supprimée: "${pattern}" → ${rule.folder}`,
      removedRule: rule
    };
  }

  /**
   * Obtenir toutes les règles personnalisées
   */
  getCustomRules() {
    return this.customClassificationRules;
  }

  /**
   * Recharger les règles depuis Supabase
   */
  async refreshRules() {
    const rules = await supabaseService.getClassificationRules();
    this.customClassificationRules = rules.map(r => ({
      pattern: r.pattern,
      folder: r.folder,
      type: r.rule_type,
      id: r.id
    }));
    return this.customClassificationRules;
  }

  /**
   * Ajouter des instructions personnalisées au prompt de James
   * SANS MODIFIER le prompt de base
   */
  async addJamesInstruction(instruction) {
    // Sauvegarder dans Supabase (ajoute sans modifier le reste)
    await supabaseService.addCustomInstruction('james', instruction);
    
    // Mettre à jour le cache local
    if (this.jamesCustomInstructions) {
      this.jamesCustomInstructions += '\n- ' + instruction;
    } else {
      this.jamesCustomInstructions = '- ' + instruction;
    }
    
    console.log(`📝 Instruction ajoutée pour James: ${instruction}`);
    return this.jamesCustomInstructions;
  }

  /**
   * Réinitialiser les instructions personnalisées de James
   */
  async resetJamesInstructions() {
    await supabaseService.resetCustomInstructions('james');
    this.jamesCustomInstructions = '';
    console.log('🔄 Instructions de James réinitialisées');
  }

  /**
   * Obtenir les instructions personnalisées de James
   */
  getJamesInstructions() {
    return this.jamesCustomInstructions;
  }

  /**
   * Obtenir le prompt complet de James (base + custom)
   */
  async getJamesFullPrompt() {
    return await supabaseService.getFullPrompt('james');
  }

  /**
   * Analyser une commande de configuration via WhatsApp
   */
  async parseConfigCommand(text) {
    // Récupérer dynamiquement les dossiers disponibles
    let availableFolders = 'Urgent, Professionnel, Shopping, Newsletter, Finance, Social, ISCOD';
    
    try {
      const outlookService = require('./outlook.service');
      if (outlookService.isConnected()) {
        const folders = await outlookService.getFolders();
        if (folders && folders.length > 0) {
          availableFolders = folders.map(f => f.name).join(', ');
        }
      }
    } catch (error) {
      console.log('⚠️ Impossible de récupérer les dossiers Outlook pour le parsing');
    }

    const systemPrompt = `Tu es un assistant qui comprend les commandes de configuration.
L'utilisateur veut configurer des règles de classification d'emails.

Analyse le texte et retourne un JSON avec:
{
  "action": "add_rule" | "remove_rule" | "list_rules" | "add_instruction" | "reset_instructions" | "unknown",
  "rules": [
    {
      "pattern": "mot clé ou expéditeur",
      "folder": "nom du dossier cible (EXACTEMENT comme dans la liste)",
      "type": "sender" (si c'est un expéditeur/société) | "subject" (si c'est dans le sujet) | "contains" (si c'est dans le contenu)
    }
  ],
  "instruction": "instruction libre à ajouter au prompt" (si add_instruction),
  "message": "message de confirmation à afficher à l'utilisateur"
}

DOSSIERS DISPONIBLES: ${availableFolders}

IMPORTANT: 
- Utilise EXACTEMENT le nom du dossier tel qu'il apparaît dans la liste
- Si l'utilisateur dit "Publicite" ou "Publicité" ou "Publicites", cherche le dossier correspondant dans la liste
- LinkedIn, Amazon, etc. sont des expéditeurs → type: "sender"

Exemples:
- "mets les mails de linkedin dans Newsletter" → pattern: "linkedin", folder: "📰 Newsletter", type: "sender"
- "classe les mails linkedin dans Publicites" → pattern: "linkedin", folder: "Publicites", type: "sender"
- "classe les mails edocperso dans ISCOD" → pattern: "edocperso", folder: "ISCOD", type: "sender"

Réponds UNIQUEMENT avec le JSON.`;

    try {
      const response = await this.chat(systemPrompt, text);
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Erreur parsing config:', error);
      return { action: 'unknown', message: "Je n'ai pas compris la configuration demandée." };
    }
  }

  /**
   * Classifier un email
   */
  async classifyEmail(email) {
    const systemPrompt = `Tu es un assistant expert en classification d'emails. 
Analyse l'email fourni et retourne un JSON avec:
- category: "urgent", "important", "normal", "spam", "newsletter", "social"
- priority: 1 (très urgent) à 5 (peut attendre)
- summary: résumé en 1-2 phrases
- actionRequired: true/false
- suggestedAction: action suggérée si nécessaire

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

    const userMessage = `
De: ${email.fromName} <${email.from}>
Sujet: ${email.subject}
Date: ${email.receivedAt}
Aperçu: ${email.preview}
`;

    try {
      const response = await this.chat(systemPrompt, userMessage);
      return JSON.parse(response);
    } catch (error) {
      console.error('Erreur classification:', error);
      return {
        category: 'normal',
        priority: 3,
        summary: email.preview?.substring(0, 100) || 'Impossible de classifier',
        actionRequired: false,
        suggestedAction: null
      };
    }
  }

  /**
   * Classifier un email pour le déplacer dans le bon dossier Outlook
   */
  async classifyEmailForFolder(email) {
    // D'abord, vérifier les règles personnalisées
    const customMatch = this.checkCustomRules(email);
    if (customMatch) {
      console.log(`📌 Règle personnalisée appliquée: ${email.from} → ${customMatch.folder}`);
      return {
        category: customMatch.folder.toLowerCase(),
        confidence: 1.0,
        reason: `Règle personnalisée: ${customMatch.pattern}`
      };
    }

    // Construire le prompt avec les instructions personnalisées
    let customRulesText = '';
    if (this.customClassificationRules.length > 0) {
      customRulesText = '\n\nRÈGLES PERSONNALISÉES (prioritaires):\n';
      this.customClassificationRules.forEach(rule => {
        customRulesText += `- Si l'email contient "${rule.pattern}" (${rule.type}), le classer dans "${rule.folder}"\n`;
      });
    }

    let customInstructionsText = '';
    if (this.jamesCustomInstructions) {
      customInstructionsText = '\n\nINSTRUCTIONS SUPPLÉMENTAIRES:\n' + this.jamesCustomInstructions;
    }

    const systemPrompt = `Tu es un assistant expert en classification d'emails.
Tu dois analyser l'email et décider dans quel dossier il doit être rangé.

Catégories disponibles:
- "urgent": Emails critiques nécessitant une action immédiate (deadlines, problèmes urgents, alertes)
- "professionnel": Emails liés au travail, candidatures, relations professionnelles
- "shopping": Confirmations de commande, livraisons, e-commerce
- "newsletter": Newsletters, emails marketing, promotions, LinkedIn, réseaux sociaux professionnels
- "finance": Banques, paiements, factures, transactions
- "social": Réseaux sociaux, invitations, notifications sociales
- "iscod": Emails de l'école ISCOD, eDocPerso, ou liés à la formation
${customRulesText}${customInstructionsText}

Analyse l'expéditeur et le sujet pour décider.

Réponds UNIQUEMENT avec un JSON: {"category": "...", "confidence": 0.0-1.0, "reason": "..."}`;

    const userMessage = `
De: ${email.fromName || email.from} <${email.from}>
Sujet: ${email.subject}
Aperçu: ${email.preview || ''}
`;

    try {
      const response = await this.chat(systemPrompt, userMessage);
      // Nettoyer la réponse si elle contient des backticks markdown
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Erreur classification pour dossier:', error);
      // Par défaut, mettre en newsletter si on ne peut pas classifier
      return {
        category: 'newsletter',
        confidence: 0.3,
        reason: 'Classification par défaut (erreur)'
      };
    }
  }

  /**
   * Vérifier si un email correspond à une règle personnalisée
   */
  checkCustomRules(email) {
    const fromLower = (email.from || '').toLowerCase();
    const fromNameLower = (email.fromName || '').toLowerCase();
    const subjectLower = (email.subject || '').toLowerCase();
    const previewLower = (email.preview || '').toLowerCase();

    // Log pour debug
    if (this.customClassificationRules.length > 0) {
      console.log(`🔍 Vérification de ${this.customClassificationRules.length} règles pour: ${email.from} - "${email.subject?.substring(0, 50)}"`);
    }

    for (const rule of this.customClassificationRules) {
      const pattern = rule.pattern.toLowerCase();
      let matched = false;
      
      switch (rule.type) {
        case 'sender':
          matched = fromLower.includes(pattern) || fromNameLower.includes(pattern);
          if (matched) {
            console.log(`  ✅ Règle SENDER "${rule.pattern}" → ${rule.folder} (match: ${email.from})`);
            return rule;
          }
          break;
        case 'subject':
          matched = subjectLower.includes(pattern);
          if (matched) {
            console.log(`  ✅ Règle SUBJECT "${rule.pattern}" → ${rule.folder} (match: ${email.subject})`);
            return rule;
          }
          break;
        case 'contains':
        default:
          matched = fromLower.includes(pattern) || 
                   fromNameLower.includes(pattern) || 
                   subjectLower.includes(pattern) || 
                   previewLower.includes(pattern);
          if (matched) {
            console.log(`  ✅ Règle CONTAINS "${rule.pattern}" → ${rule.folder}`);
            return rule;
          }
          break;
      }
    }
    
    // Aucune règle ne correspond
    if (this.customClassificationRules.length > 0) {
      console.log(`  ❌ Aucune règle ne correspond pour: ${email.from}`);
    }
    return null;
  }

  /**
   * Classifier plusieurs emails et créer un résumé
   * @param {Array} emails - Liste des emails
   * @param {Object} options - Options (focus, instruction)
   */
  async summarizeEmails(emails, options = {}) {
    let systemPrompt = `Tu es James, l'assistant mail IA de l'utilisateur.
Tu dois analyser la liste d'emails et créer un résumé clair et actionnable.

Format de réponse souhaité:
📬 **Résumé de vos emails**

🔴 **Urgents** (X emails)
- [Expéditeur]: Sujet - Résumé court

🟠 **Importants** (X emails)  
- [Expéditeur]: Sujet - Résumé court

📋 **Autres** (X emails)
- Résumé général

💡 **Actions suggérées**
- Action 1
- Action 2

Sois concis mais informatif. Utilise des emojis pour la clarté.`;

    // Ajouter des instructions spécifiques si fournies
    if (options.instruction) {
      systemPrompt += `\n\n⚠️ INSTRUCTION SPÉCIALE: ${options.instruction}`;
    }

    // Adapter le format pour un seul email
    if (emails.length === 1) {
      systemPrompt = `Tu es James, l'assistant mail IA de l'utilisateur.
Tu dois analyser cet email et donner un résumé détaillé.

Format de réponse:
📧 **Email de [Expéditeur]**
📌 **Sujet:** ...
📅 **Reçu le:** ...

📝 **Résumé:**
[Résumé détaillé du contenu]

💡 **Action(s) suggérée(s):**
- ...

Sois informatif et mets en avant les points importants.`;
    }

    const emailList = emails.map(e => {
      const date = e.receivedDateTime ? new Date(e.receivedDateTime).toLocaleString('fr-FR') : '';
      return `De: ${e.fromName || e.from?.emailAddress?.name} <${e.from?.emailAddress?.address || e.from}>\nSujet: ${e.subject}\nDate: ${date}\nImportance: ${e.importance || 'normal'}\nAperçu: ${e.bodyPreview || e.preview}\n---`;
    }).join('\n');

    const countText = emails.length === 1 ? 'cet email' : `ces ${emails.length} emails`;
    return this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Voici ${countText}:\n\n${emailList}` }
    ]);
  }

  /**
   * Répondre à une question générale
   */
  async answerQuestion(question, context = '') {
    const systemPrompt = `Tu es Brian, l'assistant personnel IA principal de l'utilisateur.
Tu es connecté à plusieurs services (WhatsApp, Outlook) et tu peux aider l'utilisateur.
Tu es amical, professionnel et concis.
Tu réponds toujours en français.
${context ? `Contexte additionnel: ${context}` : ''}`;

    return this.chat(systemPrompt, question);
  }

  /**
   * Générer un brouillon de réponse à un email
   */
  async draftEmailReply(originalEmail, instructions) {
    const systemPrompt = `Tu es un assistant qui aide à rédiger des emails professionnels.
Génère une réponse appropriée à l'email ci-dessous selon les instructions données.
La réponse doit être en français, professionnelle et bien structurée.
Retourne UNIQUEMENT le contenu de l'email (pas de "Objet:" ni de salutations génériques comme "Bonjour,").`;

    const userMessage = `
Email original:
De: ${originalEmail.fromName} <${originalEmail.from}>
Sujet: ${originalEmail.subject}
Contenu: ${originalEmail.body || originalEmail.preview}

Instructions pour la réponse: ${instructions}
`;

    return this.chat(systemPrompt, userMessage);
  }

  /**
   * Rédiger un nouvel email à partir d'une demande en langage naturel
   * @param {Object} request - La demande de l'utilisateur
   * @param {string} request.to - Destinataire
   * @param {string} request.intent - Ce que l'utilisateur veut dire
   * @param {string} request.context - Contexte supplémentaire (optionnel)
   * @param {string} request.tone - Ton souhaité (optionnel: formel, amical, professionnel)
   */
  async composeEmail(request) {
    const systemPrompt = `Tu es James, un assistant expert en rédaction d'emails.
Tu dois rédiger un email basé sur les instructions de l'utilisateur.

RÈGLES:
1. Rédige un email complet et professionnel
2. Adapte le ton selon le contexte (formel pour travail, amical pour connaissances)
3. Structure bien le mail (salutation, corps, formule de politesse, signature)
4. Sois concis mais complet
5. Génère aussi un sujet approprié
6. LA SIGNATURE À LA FIN DOIT TOUJOURS ÊTRE: "Brian BIENDOU" (jamais [Votre Nom] ou autre)

RETOURNE UN JSON:
{
  "subject": "Sujet de l'email",
  "body": "Corps complet de l'email avec salutations et signature (terminant par Brian BIENDOU)",
  "tone": "formel|amical|professionnel"
}

Réponds UNIQUEMENT avec le JSON, sans backticks ni markdown.`;

    const userMessage = `
Destinataire: ${request.to}
Ce que l'utilisateur veut communiquer: ${request.intent}
${request.context ? `Contexte supplémentaire: ${request.context}` : ''}
${request.tone ? `Ton souhaité: ${request.tone}` : ''}
`;

    try {
      const response = await this.chat(systemPrompt, userMessage);
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Erreur composition email:', error);
      // Fallback: retourner un format basique
      return {
        subject: 'Message',
        body: request.intent,
        tone: 'professionnel'
      };
    }
  }

  /**
   * Réviser un brouillon d'email selon les instructions
   * @param {Object} draft - Le brouillon actuel
   * @param {string} instructions - Les modifications demandées
   */
  async reviseDraft(draft, instructions) {
    const systemPrompt = `Tu es James, un assistant expert en rédaction d'emails.
Tu dois modifier un email existant selon les instructions de l'utilisateur.

RÈGLES:
1. Applique UNIQUEMENT les modifications demandées
2. Garde le reste du contenu intact
3. Maintiens la cohérence du mail
4. Si on te demande de changer le ton, adapte tout le mail
5. LA SIGNATURE À LA FIN DOIT TOUJOURS RESTER: "Brian BIENDOU"

RETOURNE UN JSON:
{
  "subject": "Sujet (modifié ou original)",
  "body": "Corps complet modifié (signature: Brian BIENDOU)",
  "changes": "Résumé des modifications apportées"
}

Réponds UNIQUEMENT avec le JSON, sans backticks ni markdown.`;

    const userMessage = `
EMAIL ACTUEL:
À: ${draft.to}
Sujet: ${draft.subject}
Corps: ${draft.body}

MODIFICATIONS DEMANDÉES: ${instructions}
`;

    try {
      const response = await this.chat(systemPrompt, userMessage);
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Erreur révision draft:', error);
      return {
        subject: draft.subject,
        body: draft.body,
        changes: 'Erreur lors de la révision'
      };
    }
  }

  /**
   * Parser une demande d'envoi d'email en langage naturel
   * @param {string} text - Le message de l'utilisateur
   */
  async parseEmailRequest(text) {
    const systemPrompt = `Tu es un assistant qui analyse les demandes d'envoi d'email.
Extrait les informations de la demande de l'utilisateur.

RETOURNE UN JSON:
{
  "action": "compose" (rédiger un mail) | "reply" (répondre) | "unclear" (pas clair),
  "to": "adresse email du destinataire (null si non spécifié)",
  "intent": "ce que l'utilisateur veut communiquer (le message/l'intention)",
  "context": "contexte supplémentaire extrait",
  "tone": "formel|amical|professionnel|null",
  "subject_hint": "indication de sujet si mentionné (sinon null)"
}

Exemples:
- "Envoie un mail à jean@test.com pour lui dire bonjour" 
  → to: "jean@test.com", intent: "dire bonjour, prendre des nouvelles", tone: "amical"

- "Écris à client@entreprise.com concernant notre projet et demande où il en est"
  → to: "client@entreprise.com", intent: "demander l'avancement du projet commun", tone: "professionnel"

- "Mail à marie@outlook.fr pour la remercier de son aide hier"
  → to: "marie@outlook.fr", intent: "remercier pour l'aide d'hier", tone: "amical"

Réponds UNIQUEMENT avec le JSON.`;

    try {
      const response = await this.chat(systemPrompt, text);
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Erreur parsing email request:', error);
      return {
        action: 'unclear',
        to: null,
        intent: text,
        context: null,
        tone: null,
        subject_hint: null
      };
    }
  }
}

module.exports = new OpenAIService();
