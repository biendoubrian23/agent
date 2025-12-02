/**
 * Service de gestion des rappels
 * Stocke les rappels et les déclenche via WhatsApp
 */

const supabaseService = require('./supabase.service');

class ReminderService {
  constructor() {
    // Map des rappels actifs (en mémoire pour check rapide)
    this.reminders = new Map();
    
    // Intervalle de vérification (toutes les minutes)
    this.checkInterval = null;
    
    // Référence au service WhatsApp (injecté plus tard)
    this.whatsappService = null;
  }

  /**
   * Initialiser le service avec le service WhatsApp
   * @param {Object} whatsappService 
   */
  init(whatsappService) {
    this.whatsappService = whatsappService;
    this.startChecker();
    this.loadRemindersFromDb();
    console.log('⏰ Service de rappels initialisé');
  }

  /**
   * Charger les rappels depuis la base de données
   */
  async loadRemindersFromDb() {
    try {
      const reminders = await supabaseService.getActiveReminders();
      
      for (const reminder of reminders) {
        this.reminders.set(reminder.id, {
          id: reminder.id,
          phoneNumber: reminder.phone_number,
          message: reminder.message,
          context: reminder.context,
          triggerAt: new Date(reminder.trigger_at),
          createdAt: new Date(reminder.created_at)
        });
      }
      
      console.log(`⏰ ${this.reminders.size} rappel(s) chargé(s) depuis la base`);
    } catch (error) {
      console.error('❌ Erreur chargement rappels:', error.message);
    }
  }

  /**
   * Créer un nouveau rappel
   * @param {Object} reminder 
   * @param {string} reminder.phoneNumber - Numéro de téléphone
   * @param {string} reminder.message - Message du rappel
   * @param {Date} reminder.triggerAt - Date/heure du rappel
   * @param {string} reminder.context - Contexte (optionnel)
   */
  async createReminder(reminder) {
    try {
      // Valider la date
      const triggerAt = new Date(reminder.triggerAt);
      if (triggerAt <= new Date()) {
        return { 
          success: false, 
          message: "❌ La date du rappel doit être dans le futur" 
        };
      }
      
      // Sauvegarder en base
      const saved = await supabaseService.createReminder({
        phone_number: reminder.phoneNumber,
        message: reminder.message,
        context: reminder.context || null,
        trigger_at: triggerAt.toISOString()
      });
      
      if (!saved) {
        throw new Error('Erreur sauvegarde en base');
      }
      
      // Ajouter en mémoire
      const reminderData = {
        id: saved.id,
        phoneNumber: reminder.phoneNumber,
        message: reminder.message,
        context: reminder.context,
        triggerAt: triggerAt,
        createdAt: new Date()
      };
      
      this.reminders.set(saved.id, reminderData);
      
      console.log(`⏰ Rappel créé pour ${reminder.phoneNumber} à ${triggerAt.toLocaleString('fr-FR')}`);
      
      return {
        success: true,
        reminder: reminderData,
        message: this.formatConfirmation(reminderData)
      };
      
    } catch (error) {
      console.error('❌ Erreur création rappel:', error);
      return { success: false, message: `❌ Erreur: ${error.message}` };
    }
  }

  /**
   * Formater le message de confirmation
   */
  formatConfirmation(reminder) {
    const dateStr = reminder.triggerAt.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    const timeStr = reminder.triggerAt.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `⏰ **Rappel programmé !**\n\n📅 **Quand:** ${dateStr} à ${timeStr}\n📝 **Message:** ${reminder.message}\n\n_Je vous enverrai un message à ce moment-là._`;
  }

  /**
   * Démarrer le vérificateur de rappels
   */
  startChecker() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Vérifier toutes les 30 secondes
    this.checkInterval = setInterval(() => {
      this.checkAndTriggerReminders();
    }, 30 * 1000);
    
    console.log('⏰ Vérificateur de rappels démarré');
  }

  /**
   * Arrêter le vérificateur
   */
  stopChecker() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Vérifier et déclencher les rappels
   */
  async checkAndTriggerReminders() {
    const now = new Date();
    
    for (const [id, reminder] of this.reminders.entries()) {
      if (reminder.triggerAt <= now) {
        await this.triggerReminder(reminder);
        this.reminders.delete(id);
        
        // Marquer comme envoyé en base
        await supabaseService.markReminderSent(id);
      }
    }
  }

  /**
   * Déclencher un rappel (envoyer le message WhatsApp)
   */
  async triggerReminder(reminder) {
    if (!this.whatsappService) {
      console.error('❌ WhatsApp service non initialisé');
      return;
    }
    
    try {
      const message = `⏰ **RAPPEL**\n\n📝 ${reminder.message}\n\n_Ce rappel a été programmé ${this.formatTimeAgo(reminder.createdAt)}_`;
      
      await this.whatsappService.sendMessage(reminder.phoneNumber, message);
      
      console.log(`⏰ Rappel envoyé à ${reminder.phoneNumber}: ${reminder.message}`);
      
    } catch (error) {
      console.error('❌ Erreur envoi rappel:', error);
    }
  }

  /**
   * Formater "il y a X temps"
   */
  formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `il y a ${diffMins} minute(s)`;
    } else if (diffHours < 24) {
      return `il y a ${diffHours} heure(s)`;
    } else {
      return `il y a ${diffDays} jour(s)`;
    }
  }

  /**
   * Lister les rappels d'un utilisateur
   * @param {string} phoneNumber 
   */
  async listReminders(phoneNumber) {
    const userReminders = [];
    
    for (const reminder of this.reminders.values()) {
      if (reminder.phoneNumber === phoneNumber) {
        userReminders.push(reminder);
      }
    }
    
    // Trier par date
    userReminders.sort((a, b) => a.triggerAt - b.triggerAt);
    
    return userReminders;
  }

  /**
   * Supprimer un rappel
   * @param {string} reminderId 
   */
  async deleteReminder(reminderId) {
    const deleted = this.reminders.delete(reminderId);
    
    if (deleted) {
      await supabaseService.deleteReminder(reminderId);
    }
    
    return deleted;
  }

  /**
   * Parser une demande de rappel en langage naturel
   * @param {string} text 
   */
  parseReminderRequest(text) {
    const now = new Date();
    let triggerAt = null;
    let message = text;
    
    const lowerText = text.toLowerCase();
    
    // Patterns de temps
    // "demain à 9h"
    const demainMatch = lowerText.match(/demain\s*(?:à|a)?\s*(\d{1,2})h?(\d{2})?/i);
    if (demainMatch) {
      triggerAt = new Date(now);
      triggerAt.setDate(triggerAt.getDate() + 1);
      triggerAt.setHours(parseInt(demainMatch[1]), parseInt(demainMatch[2] || '0'), 0, 0);
    }
    
    // "dans X heures/minutes/secondes" - AMÉLIORÉ
    const dansMatch = lowerText.match(/dans\s+(\d+)\s*(seconde|secondes|sec|s|minute|minutes|min|m|heure|heures|h|jour|jours|j)/i);
    if (dansMatch) {
      triggerAt = new Date(now);
      const amount = parseInt(dansMatch[1]);
      const unit = dansMatch[2].toLowerCase();
      
      if (unit.startsWith('h')) {
        triggerAt.setHours(triggerAt.getHours() + amount);
      } else if (unit.startsWith('min') || unit === 'm') {
        triggerAt.setMinutes(triggerAt.getMinutes() + amount);
      } else if (unit.startsWith('sec') || unit === 's') {
        triggerAt.setSeconds(triggerAt.getSeconds() + amount);
      } else if (unit.startsWith('jour') || unit === 'j') {
        triggerAt.setDate(triggerAt.getDate() + amount);
      }
    }
    
    // "à 14h30" (aujourd'hui ou demain si passé)
    const heureMatch = lowerText.match(/(?:à|a)\s*(\d{1,2})h(\d{2})?/i);
    if (heureMatch && !demainMatch && !dansMatch) {
      triggerAt = new Date(now);
      triggerAt.setHours(parseInt(heureMatch[1]), parseInt(heureMatch[2] || '0'), 0, 0);
      
      // Si l'heure est passée, mettre demain
      if (triggerAt <= now) {
        triggerAt.setDate(triggerAt.getDate() + 1);
      }
    }
    
    // "lundi/mardi/etc à Xh"
    const jourMatch = lowerText.match(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*(?:à|a)?\s*(\d{1,2})h?(\d{2})?/i);
    if (jourMatch) {
      const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const targetDay = jours.indexOf(jourMatch[1].toLowerCase());
      
      triggerAt = new Date(now);
      const currentDay = triggerAt.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      
      triggerAt.setDate(triggerAt.getDate() + daysToAdd);
      triggerAt.setHours(parseInt(jourMatch[2] || '9'), parseInt(jourMatch[3] || '0'), 0, 0);
    }
    
    // Extraire le message (tout sauf les indications de temps) - AMÉLIORÉ
    message = text
      .replace(/rappelle[- ]?moi\s*/i, '')
      .replace(/programme[- ]?moi\s*(un\s*)?rappel\s*/i, '')
      .replace(/demain\s*(?:à|a)?\s*\d{1,2}h?\d{0,2}/i, '')
      .replace(/dans\s+\d+\s*(seconde|secondes|sec|s|minute|minutes|min|m|heure|heures|h|jour|jours|j)s?/i, '')
      .replace(/(?:à|a)\s*\d{1,2}h\d{0,2}/i, '')
      .replace(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*(?:à|a)?\s*\d{0,2}h?\d{0,2}/i, '')
      .replace(/^(de|d'|que|pour)\s*/i, '')
      .trim();
    
    // Si le message est vide, utiliser le texte original
    if (!message || message.length < 3) {
      message = text.replace(/rappelle[- ]?moi\s*/i, '').trim();
    }
    
    return {
      triggerAt,
      message,
      isValid: triggerAt !== null
    };
  }
}

module.exports = new ReminderService();
