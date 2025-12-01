const outlookService = require('../services/outlook.service');
const principalAgent = require('../agents/principal.agent');

class EmailScheduler {
  constructor() {
    this.lastCheckTime = new Date();
    this.intervalId = null;
    this.checkIntervalMinutes = parseInt(process.env.MAIL_CHECK_INTERVAL) || 5;
  }

  /**
   * Démarrer la vérification périodique des emails
   */
  start() {
    console.log(`📧 Scheduler démarré - Vérification toutes les ${this.checkIntervalMinutes} minutes`);
    
    // Vérifier immédiatement au démarrage (après 30 secondes pour laisser le temps de se connecter)
    setTimeout(() => this.checkNewEmails(), 30000);

    // Puis vérifier périodiquement
    this.intervalId = setInterval(
      () => this.checkNewEmails(),
      this.checkIntervalMinutes * 60 * 1000
    );
  }

  /**
   * Arrêter le scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('📧 Scheduler arrêté');
    }
  }

  /**
   * Vérifier les nouveaux emails
   */
  async checkNewEmails() {
    try {
      if (!outlookService.isConnected()) {
        console.log('⏳ En attente de connexion Outlook...');
        return;
      }

      console.log('🔍 Vérification des nouveaux emails...');

      const emails = await outlookService.getUnreadEmails(10);
      
      // Filtrer les emails reçus après la dernière vérification
      const newEmails = emails.filter(email => {
        const emailDate = new Date(email.receivedAt);
        return emailDate > this.lastCheckTime;
      });

      if (newEmails.length > 0) {
        console.log(`📬 ${newEmails.length} nouveaux emails détectés !`);
        await principalAgent.notifyNewEmails(newEmails);
      } else {
        console.log('✅ Aucun nouvel email');
      }

      this.lastCheckTime = new Date();
    } catch (error) {
      console.error('❌ Erreur vérification emails:', error.message);
    }
  }
}

module.exports = new EmailScheduler();
