/**
 * Service de gestion des brouillons d'emails
 * Stocke temporairement les brouillons en attente de validation
 */

class DraftService {
  constructor() {
    // Map des brouillons par numéro de téléphone
    // Structure: { phoneNumber: { draft, createdAt, status } }
    this.drafts = new Map();
    
    // Durée de vie d'un brouillon (30 minutes)
    this.DRAFT_TTL = 30 * 60 * 1000;
  }

  /**
   * Créer un nouveau brouillon
   * @param {string} phoneNumber - Numéro de téléphone de l'utilisateur
   * @param {Object} draft - Le brouillon d'email
   * @param {string} draft.to - Destinataire
   * @param {string} draft.subject - Sujet
   * @param {string} draft.body - Corps du mail
   * @param {string} draft.context - Contexte de la demande originale
   */
  createDraft(phoneNumber, draft) {
    this.drafts.set(phoneNumber, {
      draft: {
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        context: draft.context || ''
      },
      createdAt: Date.now(),
      status: 'pending_approval', // pending_approval, approved, sent, cancelled
      revisions: 0
    });
    
    console.log(`📝 Brouillon créé pour ${phoneNumber}: "${draft.subject}" → ${draft.to}`);
    
    // Nettoyer les vieux brouillons
    this.cleanupExpiredDrafts();
    
    return this.getDraft(phoneNumber);
  }

  /**
   * Récupérer le brouillon d'un utilisateur
   * @param {string} phoneNumber 
   */
  getDraft(phoneNumber) {
    const entry = this.drafts.get(phoneNumber);
    
    if (!entry) {
      return null;
    }
    
    // Vérifier si le brouillon a expiré
    if (Date.now() - entry.createdAt > this.DRAFT_TTL) {
      this.deleteDraft(phoneNumber);
      return null;
    }
    
    return entry;
  }

  /**
   * Vérifier si un utilisateur a un brouillon en attente
   * @param {string} phoneNumber 
   */
  hasPendingDraft(phoneNumber) {
    const draft = this.getDraft(phoneNumber);
    return draft && draft.status === 'pending_approval';
  }

  /**
   * Mettre à jour le brouillon (après révision)
   * @param {string} phoneNumber 
   * @param {Object} updates - Les modifications à apporter
   */
  updateDraft(phoneNumber, updates) {
    const entry = this.getDraft(phoneNumber);
    
    if (!entry) {
      return null;
    }
    
    // Appliquer les mises à jour
    if (updates.subject) entry.draft.subject = updates.subject;
    if (updates.body) entry.draft.body = updates.body;
    if (updates.to) entry.draft.to = updates.to;
    
    entry.revisions++;
    entry.status = 'pending_approval';
    
    this.drafts.set(phoneNumber, entry);
    
    console.log(`📝 Brouillon mis à jour pour ${phoneNumber} (révision ${entry.revisions})`);
    
    return entry;
  }

  /**
   * Marquer le brouillon comme approuvé (prêt à envoyer)
   * @param {string} phoneNumber 
   */
  approveDraft(phoneNumber) {
    const entry = this.getDraft(phoneNumber);
    
    if (!entry) {
      return null;
    }
    
    entry.status = 'approved';
    this.drafts.set(phoneNumber, entry);
    
    return entry;
  }

  /**
   * Marquer le brouillon comme envoyé
   * @param {string} phoneNumber 
   */
  markAsSent(phoneNumber) {
    const entry = this.getDraft(phoneNumber);
    
    if (entry) {
      entry.status = 'sent';
      // On garde l'entrée quelques minutes pour référence
      setTimeout(() => this.deleteDraft(phoneNumber), 5 * 60 * 1000);
    }
    
    return entry;
  }

  /**
   * Annuler/supprimer un brouillon
   * @param {string} phoneNumber 
   */
  deleteDraft(phoneNumber) {
    const existed = this.drafts.has(phoneNumber);
    this.drafts.delete(phoneNumber);
    
    if (existed) {
      console.log(`🗑️ Brouillon supprimé pour ${phoneNumber}`);
    }
    
    return existed;
  }

  /**
   * Nettoyer les brouillons expirés
   */
  cleanupExpiredDrafts() {
    const now = Date.now();
    
    for (const [phoneNumber, entry] of this.drafts.entries()) {
      if (now - entry.createdAt > this.DRAFT_TTL) {
        this.drafts.delete(phoneNumber);
        console.log(`🧹 Brouillon expiré supprimé pour ${phoneNumber}`);
      }
    }
  }

  /**
   * Obtenir le nombre de brouillons actifs
   */
  getActiveCount() {
    this.cleanupExpiredDrafts();
    return this.drafts.size;
  }

  /**
   * Formater un brouillon pour l'affichage WhatsApp
   * @param {Object} draftEntry 
   */
  formatForDisplay(draftEntry) {
    if (!draftEntry || !draftEntry.draft) {
      return null;
    }
    
    const { draft, revisions } = draftEntry;
    
    let message = `📧 **Brouillon d'email**\n\n`;
    message += `👤 **À:** ${draft.to}\n`;
    message += `📌 **Sujet:** ${draft.subject}\n\n`;
    message += `📝 **Message:**\n${draft.body}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (revisions > 0) {
      message += `🔄 _Révision n°${revisions}_\n\n`;
    }
    
    message += `**Que souhaitez-vous faire ?**\n`;
    message += `• "Envoie" ou "OK" → Envoyer le mail\n`;
    message += `• "Modifie le sujet en..." → Changer le sujet\n`;
    message += `• "Rends le plus formel" → Réviser le ton\n`;
    message += `• "Ajoute..." → Ajouter du contenu\n`;
    message += `• "Annule" → Annuler l'envoi`;
    
    return message;
  }
}

module.exports = new DraftService();
