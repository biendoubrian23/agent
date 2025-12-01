/**
 * Service de statistiques pour les agents
 * Stocke et gère toutes les métriques des agents
 * Avec persistance Supabase
 */

const supabaseService = require('./supabase.service');

class StatsService {
  constructor() {
    // Statistiques globales par agent (cache mémoire)
    this.stats = {
      james: {
        emailsProcessed: 0,
        emailsToday: 0,
        urgentEmails: 0,
        requestsTotal: 0,
        requestsToday: 0,
        lastSync: null,
        lastSyncDate: null
      },
      magali: {
        transactionsProcessed: 0,
        transactionsToday: 0,
        alertsTriggered: 0,
        requestsTotal: 0,
        requestsToday: 0,
        lastSync: null
      },
      kiara: {
        tasksCreated: 0,
        meetingsScheduled: 0,
        decisionsLogged: 0,
        requestsTotal: 0,
        requestsToday: 0,
        lastSync: null
      }
    };

    // Historique des activités (max 50 par agent)
    this.activities = {
      james: [],
      magali: [],
      kiara: []
    };

    // État des connexions
    this.connections = {
      outlook: false,
      whatsapp: true,
      bank: false
    };

    // Compteur quotidien - reset à minuit
    this.dailyResetDate = new Date().toDateString();
    
    // Charger les stats depuis Supabase au démarrage
    this.loadFromSupabase();
  }

  /**
   * Charger les stats depuis Supabase
   */
  async loadFromSupabase() {
    if (!supabaseService.isAvailable()) {
      console.log('⚠️ Supabase non disponible - stats en mémoire uniquement');
      return;
    }

    try {
      const { data, error } = await supabaseService.client
        .from('agent_stats')
        .select('*');

      if (error) {
        console.error('Erreur chargement stats:', error);
        return;
      }

      if (data && data.length > 0) {
        data.forEach(row => {
          const agent = row.agent_name.toLowerCase();
          if (this.stats[agent]) {
            this.stats[agent] = {
              ...this.stats[agent],
              emailsProcessed: row.emails_processed || 0,
              emailsToday: row.emails_today || 0,
              urgentEmails: row.urgent_emails || 0,
              requestsTotal: row.requests_total || 0,
              requestsToday: row.requests_today || 0,
              transactionsProcessed: row.transactions_processed || 0,
              transactionsToday: row.transactions_today || 0,
              tasksCreated: row.tasks_created || 0,
              lastSync: row.last_sync ? new Date(row.last_sync) : null
            };
          }
        });
        console.log('✅ Stats chargées depuis Supabase');
      }
    } catch (error) {
      console.error('Erreur loadFromSupabase:', error);
    }
  }

  /**
   * Sauvegarder les stats dans Supabase
   */
  async saveToSupabase(agentName) {
    if (!supabaseService.isAvailable()) return;

    const agent = agentName.toLowerCase();
    const stats = this.stats[agent];
    if (!stats) return;

    try {
      const { error } = await supabaseService.client
        .from('agent_stats')
        .upsert({
          agent_name: agent,
          emails_processed: stats.emailsProcessed || 0,
          emails_today: stats.emailsToday || 0,
          urgent_emails: stats.urgentEmails || 0,
          requests_total: stats.requestsTotal || 0,
          requests_today: stats.requestsToday || 0,
          transactions_processed: stats.transactionsProcessed || 0,
          transactions_today: stats.transactionsToday || 0,
          tasks_created: stats.tasksCreated || 0,
          last_sync: stats.lastSync || new Date(),
          updated_at: new Date()
        }, {
          onConflict: 'agent_name'
        });

      if (error) {
        console.error('Erreur sauvegarde stats:', error);
      }
    } catch (error) {
      console.error('Erreur saveToSupabase:', error);
    }
  }

  /**
   * Réinitialiser les compteurs quotidiens si nouveau jour
   */
  checkDailyReset() {
    const today = new Date().toDateString();
    if (today !== this.dailyResetDate) {
      this.dailyResetDate = today;
      this.stats.james.emailsToday = 0;
      this.stats.james.urgentEmails = 0;
      this.stats.james.requestsToday = 0;
      this.stats.magali.transactionsToday = 0;
      this.stats.magali.requestsToday = 0;
      this.stats.kiara.tasksCreated = 0;
      this.stats.kiara.requestsToday = 0;
      console.log('📊 Compteurs quotidiens réinitialisés');
      
      // Sauvegarder le reset
      this.saveToSupabase('james');
      this.saveToSupabase('magali');
      this.saveToSupabase('kiara');
    }
  }

  /**
   * Logger une requête/question à un agent
   */
  logRequest(agentName) {
    this.checkDailyReset();
    
    const agent = agentName.toLowerCase();
    if (this.stats[agent]) {
      this.stats[agent].requestsTotal = (this.stats[agent].requestsTotal || 0) + 1;
      this.stats[agent].requestsToday = (this.stats[agent].requestsToday || 0) + 1;
      this.saveToSupabase(agent);
    }
  }

  /**
   * Ajouter une activité pour un agent
   */
  addActivity(agentName, action, status = 'success') {
    this.checkDailyReset();
    
    const activity = {
      id: Date.now(),
      action,
      time: new Date(),
      status
    };

    const agent = agentName.toLowerCase();
    if (this.activities[agent]) {
      this.activities[agent].unshift(activity);
      // Garder max 50 activités
      if (this.activities[agent].length > 50) {
        this.activities[agent] = this.activities[agent].slice(0, 50);
      }
    }

    return activity;
  }

  /**
   * Incrémenter un compteur
   */
  increment(agentName, statName, amount = 1) {
    this.checkDailyReset();
    
    const agent = agentName.toLowerCase();
    if (this.stats[agent] && typeof this.stats[agent][statName] === 'number') {
      this.stats[agent][statName] += amount;
      // Sauvegarder dans Supabase
      this.saveToSupabase(agent);
    }
  }

  /**
   * Mettre à jour le timestamp de dernière sync
   */
  updateLastSync(agentName) {
    const agent = agentName.toLowerCase();
    if (this.stats[agent]) {
      this.stats[agent].lastSync = new Date();
      this.stats[agent].lastSyncDate = new Date();
      // Sauvegarder dans Supabase
      this.saveToSupabase(agent);
    }
  }

  /**
   * Mettre à jour l'état d'une connexion
   */
  setConnectionStatus(service, connected) {
    this.connections[service] = connected;
  }

  /**
   * Obtenir le temps écoulé depuis la dernière sync
   */
  getTimeSinceLastSync(agentName) {
    const agent = agentName.toLowerCase();
    if (!this.stats[agent] || !this.stats[agent].lastSync) {
      return 'Jamais';
    }

    const now = new Date();
    const lastSync = new Date(this.stats[agent].lastSync);
    const diffMs = now - lastSync;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}j`;
  }

  /**
   * Formater le temps relatif pour une activité
   */
  formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return `Il y a ${diffDays}j`;
  }

  /**
   * Obtenir les stats d'un agent avec temps formaté
   */
  getAgentStats(agentName) {
    this.checkDailyReset();
    
    const agent = agentName.toLowerCase();
    const stats = this.stats[agent];
    
    if (!stats) {
      return null;
    }

    return {
      ...stats,
      lastSync: this.getTimeSinceLastSync(agentName)
    };
  }

  /**
   * Obtenir les activités récentes d'un agent
   */
  getAgentActivities(agentName, limit = 10) {
    const agent = agentName.toLowerCase();
    const activities = this.activities[agent] || [];

    return activities.slice(0, limit).map(activity => ({
      ...activity,
      timeFormatted: this.formatRelativeTime(activity.time)
    }));
  }

  /**
   * Obtenir l'état de toutes les connexions
   */
  getConnections() {
    return { ...this.connections };
  }

  /**
   * Obtenir un résumé complet pour un agent
   */
  getAgentSummary(agentName) {
    return {
      stats: this.getAgentStats(agentName),
      activities: this.getAgentActivities(agentName, 5),
      connections: this.getConnections()
    };
  }

  /**
   * Logger un email traité
   */
  logEmailProcessed(isUrgent = false) {
    this.increment('james', 'emailsProcessed');
    this.increment('james', 'emailsToday');
    if (isUrgent) {
      this.increment('james', 'urgentEmails');
    }
    this.updateLastSync('james');
  }

  /**
   * Logger un résumé envoyé
   */
  logSummarySent() {
    this.addActivity('james', 'Résumé envoyé');
    this.updateLastSync('james');
  }

  /**
   * Logger une classification d'email
   */
  logEmailClassified(category) {
    this.addActivity('james', `Email classifié: ${category}`);
    this.increment('james', 'emailsProcessed');
  }

  /**
   * Logger une vérification de connexion
   */
  logConnectionCheck(service, success) {
    const status = success ? 'success' : 'error';
    const action = success 
      ? `Connexion ${service} vérifiée`
      : `Échec connexion ${service}`;
    
    this.setConnectionStatus(service, success);
    
    // Trouver l'agent concerné
    if (service === 'outlook') {
      this.addActivity('james', action, status);
    }
  }
}

// Singleton
const statsService = new StatsService();

module.exports = statsService;
