const { createClient } = require('@supabase/supabase-js');

/**
 * Service Supabase pour le backend
 * Gère la persistance des données (règles, prompts, etc.)
 */
class SupabaseService {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    // Utiliser la clé service_role si disponible (bypass RLS), sinon anon_key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Variables Supabase non configurées - persistance désactivée');
      this.client = null;
    } else {
      this.client = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase connecté' + (process.env.SUPABASE_SERVICE_ROLE_KEY ? ' (service_role)' : ' (anon)'));
    }

    // ID utilisateur par défaut pour le développement
    // Utilise un UUID fixe si pas d'auth Supabase
    this.defaultUserId = process.env.SUPABASE_DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';
    console.log('👤 User ID par défaut:', this.defaultUserId);
  }

  /**
   * Vérifier si Supabase est disponible
   */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * Définir l'ID utilisateur actuel
   */
  setUserId(userId) {
    this.defaultUserId = userId;
  }

  /**
   * Récupérer ou créer un utilisateur par défaut pour le dev
   */
  async getOrCreateDefaultUser() {
    if (!this.isAvailable()) return null;

    try {
      // Chercher un utilisateur existant
      const { data: users, error } = await this.client
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) {
        console.error('Erreur récup user:', error);
        return null;
      }

      if (users && users.length > 0) {
        this.defaultUserId = users[0].id;
        return this.defaultUserId;
      }

      return null;
    } catch (error) {
      console.error('Erreur getOrCreateDefaultUser:', error);
      return null;
    }
  }

  // ==================== RÈGLES DE CLASSIFICATION ====================

  /**
   * Récupérer toutes les règles de classification
   */
  async getClassificationRules(userId = null) {
    if (!this.isAvailable()) return [];

    const uid = userId || this.defaultUserId;
    if (!uid) {
      console.log('⚠️ Pas d\'utilisateur défini pour récupérer les règles');
      return [];
    }

    try {
      const { data, error } = await this.client
        .from('classification_rules')
        .select('*')
        .eq('user_id', uid)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erreur récup règles:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erreur getClassificationRules:', error);
      return [];
    }
  }

  /**
   * Ajouter une règle de classification
   */
  async addClassificationRule(rule, userId = null) {
    if (!this.isAvailable()) {
      console.log('⚠️ Supabase non disponible - règle non sauvegardée');
      return null;
    }

    const uid = userId || this.defaultUserId;
    if (!uid) {
      console.log('⚠️ Pas d\'utilisateur défini pour ajouter la règle');
      return null;
    }

    try {
      const { data, error } = await this.client
        .from('classification_rules')
        .insert({
          user_id: uid,
          pattern: rule.pattern,
          folder: rule.folder,
          rule_type: rule.type || 'sender'
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur ajout règle:', error);
        return null;
      }

      console.log(`✅ Règle sauvegardée dans Supabase: ${rule.pattern} → ${rule.folder}`);
      return data;
    } catch (error) {
      console.error('Erreur addClassificationRule:', error);
      return null;
    }
  }

  /**
   * Supprimer une règle par son pattern
   */
  async removeClassificationRule(pattern, userId = null) {
    if (!this.isAvailable()) return false;

    const uid = userId || this.defaultUserId;
    if (!uid) return false;

    try {
      const { error } = await this.client
        .from('classification_rules')
        .delete()
        .eq('user_id', uid)
        .ilike('pattern', pattern);

      if (error) {
        console.error('Erreur suppression règle:', error);
        return false;
      }

      console.log(`🗑️ Règle supprimée: ${pattern}`);
      return true;
    } catch (error) {
      console.error('Erreur removeClassificationRule:', error);
      return false;
    }
  }

  /**
   * Supprimer toutes les règles
   */
  async clearAllRules(userId = null) {
    if (!this.isAvailable()) return false;

    const uid = userId || this.defaultUserId;
    if (!uid) return false;

    try {
      const { error } = await this.client
        .from('classification_rules')
        .delete()
        .eq('user_id', uid);

      if (error) {
        console.error('Erreur suppression règles:', error);
        return false;
      }

      console.log('🗑️ Toutes les règles supprimées');
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==================== PROMPTS DES AGENTS ====================

  /**
   * Récupérer le prompt d'un agent
   */
  async getAgentPrompt(agentName, userId = null) {
    if (!this.isAvailable()) return null;

    const uid = userId || this.defaultUserId;
    if (!uid) return null;

    try {
      const { data, error } = await this.client
        .from('agent_prompts')
        .select('*')
        .eq('user_id', uid)
        .eq('agent_name', agentName.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Erreur récup prompt:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erreur getAgentPrompt:', error);
      return null;
    }
  }

  /**
   * Créer ou mettre à jour le prompt de base d'un agent
   */
  async setAgentBasePrompt(agentName, basePrompt, userId = null) {
    if (!this.isAvailable()) return null;

    const uid = userId || this.defaultUserId;
    if (!uid) return null;

    try {
      const { data, error } = await this.client
        .from('agent_prompts')
        .upsert({
          user_id: uid,
          agent_name: agentName.toLowerCase(),
          base_prompt: basePrompt
        }, {
          onConflict: 'user_id,agent_name'
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur set base prompt:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erreur setAgentBasePrompt:', error);
      return null;
    }
  }

  /**
   * Ajouter une instruction au prompt sans modifier le reste
   */
  async addCustomInstruction(agentName, instruction, userId = null) {
    if (!this.isAvailable()) {
      console.log('⚠️ Supabase non disponible');
      return null;
    }

    const uid = userId || this.defaultUserId;
    if (!uid) {
      console.log('⚠️ Pas d\'utilisateur défini');
      return null;
    }

    try {
      // Récupérer le prompt actuel
      let prompt = await this.getAgentPrompt(agentName, uid);
      
      // Si pas de prompt, en créer un avec un base_prompt par défaut
      if (!prompt) {
        const defaultBasePrompt = this.getDefaultBasePrompt(agentName);
        await this.setAgentBasePrompt(agentName, defaultBasePrompt, uid);
        prompt = await this.getAgentPrompt(agentName, uid);
      }

      // Ajouter l'instruction aux custom_instructions (sans toucher au base_prompt)
      let customInstructions = prompt.custom_instructions || '';
      
      // Ajouter avec un saut de ligne si déjà du contenu
      if (customInstructions.trim()) {
        customInstructions += '\n- ' + instruction;
      } else {
        customInstructions = '- ' + instruction;
      }

      // Mettre à jour UNIQUEMENT custom_instructions
      const { data, error } = await this.client
        .from('agent_prompts')
        .update({ custom_instructions: customInstructions })
        .eq('id', prompt.id)
        .select()
        .single();

      if (error) {
        console.error('Erreur ajout instruction:', error);
        return null;
      }

      console.log(`✅ Instruction ajoutée pour ${agentName}: "${instruction}"`);
      return data;
    } catch (error) {
      console.error('Erreur addCustomInstruction:', error);
      return null;
    }
  }

  /**
   * Récupérer les instructions personnalisées uniquement
   */
  async getCustomInstructions(agentName, userId = null) {
    const prompt = await this.getAgentPrompt(agentName, userId);
    return prompt?.custom_instructions || '';
  }

  /**
   * Réinitialiser les instructions personnalisées (sans toucher au base_prompt)
   */
  async resetCustomInstructions(agentName, userId = null) {
    if (!this.isAvailable()) return false;

    const uid = userId || this.defaultUserId;
    if (!uid) return false;

    try {
      const { error } = await this.client
        .from('agent_prompts')
        .update({ custom_instructions: '' })
        .eq('user_id', uid)
        .eq('agent_name', agentName.toLowerCase());

      if (error) {
        console.error('Erreur reset instructions:', error);
        return false;
      }

      console.log(`🔄 Instructions de ${agentName} réinitialisées`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Prompt par défaut pour chaque agent
   */
  getDefaultBasePrompt(agentName) {
    const prompts = {
      james: `Tu es James, l'assistant email expert de BiendouCorp.

Ton rôle:
- Classifier les emails dans les bons dossiers (Urgent, Professionnel, Shopping, Newsletter, Finance, Social, ISCOD)
- Résumer les emails de manière concise
- Alerter sur les emails urgents
- Aider à rédiger des réponses

Tu es professionnel, efficace et toujours prêt à aider.`,

      magali: `Tu es Magali, l'assistante bancaire de BiendouCorp.

Ton rôle:
- Analyser les transactions bancaires
- Alerter sur les dépenses inhabituelles  
- Suivre le budget mensuel
- Fournir des insights financiers

Tu es précise, discrète et soucieuse de la sécurité financière.`,

      kiara: `Tu es Kiara, l'assistante CEO de BiendouCorp.

Ton rôle:
- Gérer le calendrier et les rendez-vous
- Rédiger des articles et contenus
- Prendre des notes de réunion
- Gérer les tâches prioritaires

Tu es organisée, créative et proactive.`
    };

    return prompts[agentName.toLowerCase()] || 'Assistant IA de BiendouCorp.';
  }

  /**
   * Récupérer le prompt complet (base + custom)
   */
  async getFullPrompt(agentName, userId = null) {
    const prompt = await this.getAgentPrompt(agentName, userId);
    
    if (!prompt) {
      return this.getDefaultBasePrompt(agentName);
    }

    let fullPrompt = prompt.base_prompt || this.getDefaultBasePrompt(agentName);
    
    if (prompt.custom_instructions && prompt.custom_instructions.trim()) {
      fullPrompt += '\n\n📝 INSTRUCTIONS PERSONNALISÉES:\n' + prompt.custom_instructions;
    }

    return fullPrompt;
  }

  // ==================== PERMISSIONS DES AGENTS ====================

  /**
   * Permissions par défaut pour chaque agent
   */
  getDefaultPermissions(agentName) {
    const defaults = {
      james: [
        { id: 'read_emails', label: 'Lire les emails', description: 'Accéder à votre boîte de réception', enabled: true },
        { id: 'send_emails', label: 'Envoyer des emails', description: 'Envoyer des emails en votre nom', enabled: true },
        { id: 'delete_emails', label: 'Supprimer des emails', description: 'Supprimer des emails de votre boîte', enabled: true },
        { id: 'auto_classify', label: 'Classification automatique', description: 'Classifier automatiquement les nouveaux emails', enabled: true },
        { id: 'daily_summary', label: 'Résumé quotidien', description: 'Envoyer un résumé chaque matin via WhatsApp', enabled: true },
        { id: 'urgent_alerts', label: 'Alertes urgentes', description: 'Notifier immédiatement pour les emails urgents', enabled: true },
      ],
      magali: [
        { id: 'read_transactions', label: 'Lire les transactions', description: 'Accéder à vos transactions bancaires', enabled: true },
        { id: 'send_alerts', label: 'Envoyer des alertes', description: 'Vous alerter en cas de dépense inhabituelle', enabled: true },
        { id: 'budget_tracking', label: 'Suivi budget', description: 'Suivre votre budget mensuel', enabled: true },
      ],
      kiara: [
        { id: 'manage_calendar', label: 'Gérer le calendrier', description: 'Créer et modifier des événements', enabled: true },
        { id: 'send_reminders', label: 'Envoyer des rappels', description: 'Rappeler les réunions importantes', enabled: true },
        { id: 'take_notes', label: 'Prendre des notes', description: 'Enregistrer des notes de réunion', enabled: true },
      ]
    };

    return defaults[agentName.toLowerCase()] || [];
  }

  /**
   * Récupérer les permissions d'un agent (depuis Supabase ou par défaut)
   */
  async getAgentPermissions(agentName, userId = null) {
    if (!this.isAvailable()) {
      return this.getDefaultPermissions(agentName);
    }

    const uid = userId || this.defaultUserId;
    if (!uid) {
      return this.getDefaultPermissions(agentName);
    }

    try {
      const { data, error } = await this.client
        .from('agent_permissions')
        .select('*')
        .eq('user_id', uid)
        .eq('agent_name', agentName.toLowerCase());

      if (error) {
        console.error('Erreur récup permissions:', error);
        return this.getDefaultPermissions(agentName);
      }

      // Si aucune permission en base, retourner les défauts
      if (!data || data.length === 0) {
        return this.getDefaultPermissions(agentName);
      }

      // Mapper les données de la base vers le format attendu
      return data.map(p => ({
        id: p.permission_id,
        label: p.permission_label,
        description: p.permission_description,
        enabled: p.enabled
      }));
    } catch (error) {
      console.error('Erreur getAgentPermissions:', error);
      return this.getDefaultPermissions(agentName);
    }
  }

  /**
   * Sauvegarder les permissions d'un agent
   */
  async saveAgentPermissions(agentName, permissions, userId = null) {
    if (!this.isAvailable()) {
      console.log('⚠️ Supabase non disponible - permissions non sauvegardées');
      return false;
    }

    const uid = userId || this.defaultUserId;
    if (!uid) {
      console.log('⚠️ Pas d\'utilisateur défini - permissions non sauvegardées');
      return false;
    }

    try {
      // Utiliser upsert pour chaque permission
      for (const perm of permissions) {
        const { error } = await this.client
          .from('agent_permissions')
          .upsert({
            user_id: uid,
            agent_name: agentName.toLowerCase(),
            permission_id: perm.id,
            permission_label: perm.label,
            permission_description: perm.description,
            enabled: perm.enabled
          }, {
            onConflict: 'user_id,agent_name,permission_id'
          });

        if (error) {
          console.error(`Erreur sauvegarde permission ${perm.id}:`, error);
        }
      }

      console.log(`✅ Permissions de ${agentName} sauvegardées dans Supabase`);
      return true;
    } catch (error) {
      console.error('Erreur saveAgentPermissions:', error);
      return false;
    }
  }

  /**
   * Mettre à jour une permission spécifique
   */
  async updatePermission(agentName, permissionId, enabled, userId = null) {
    if (!this.isAvailable()) return false;

    const uid = userId || this.defaultUserId;
    if (!uid) return false;

    try {
      // D'abord, obtenir les permissions par défaut pour avoir les infos complètes
      const defaults = this.getDefaultPermissions(agentName);
      const defaultPerm = defaults.find(p => p.id === permissionId);

      if (!defaultPerm) {
        console.error(`Permission ${permissionId} non trouvée pour ${agentName}`);
        return false;
      }

      const { error } = await this.client
        .from('agent_permissions')
        .upsert({
          user_id: uid,
          agent_name: agentName.toLowerCase(),
          permission_id: permissionId,
          permission_label: defaultPerm.label,
          permission_description: defaultPerm.description,
          enabled: enabled
        }, {
          onConflict: 'user_id,agent_name,permission_id'
        });

      if (error) {
        console.error('Erreur update permission:', error);
        return false;
      }

      console.log(`✅ Permission ${permissionId} de ${agentName} mise à jour: ${enabled}`);
      return true;
    } catch (error) {
      console.error('Erreur updatePermission:', error);
      return false;
    }
  }
}

module.exports = new SupabaseService();
