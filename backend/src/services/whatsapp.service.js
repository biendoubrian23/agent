const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.apiUrl = `https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`;
  }

  /**
   * Envoyer un message texte via WhatsApp
   */
  async sendMessage(to, message) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: {
            preview_url: false,
            body: message
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Message WhatsApp envoyé:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur envoi WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Envoyer un message long (divisé si nécessaire)
   */
  async sendLongMessage(to, message) {
    const maxLength = 4000; // Limite WhatsApp
    
    if (message.length <= maxLength) {
      return this.sendMessage(to, message);
    }

    // Diviser le message
    const parts = [];
    for (let i = 0; i < message.length; i += maxLength) {
      parts.push(message.substring(i, i + maxLength));
    }

    for (let i = 0; i < parts.length; i++) {
      const partMessage = `(${i + 1}/${parts.length})\n\n${parts[i]}`;
      await this.sendMessage(to, partMessage);
      // Attendre un peu entre chaque message
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Parser les messages entrants du webhook
   */
  parseIncomingMessage(body) {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      if (!value?.messages) {
        return null;
      }

      const message = value.messages[0];
      const contact = value.contacts?.[0];

      return {
        from: message.from,
        name: contact?.profile?.name || 'Inconnu',
        type: message.type,
        text: message.text?.body || '',
        timestamp: message.timestamp,
        messageId: message.id
      };
    } catch (error) {
      console.error('Erreur parsing message:', error);
      return null;
    }
  }

  /**
   * Vérifier le webhook (challenge Meta)
   */
  verifyWebhook(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('✅ Webhook vérifié');
      return challenge;
    }
    
    return null;
  }
}

module.exports = new WhatsAppService();
