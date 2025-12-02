require('dotenv').config();

const express = require('express');
const cors = require('cors');

const whatsappService = require('./services/whatsapp.service');
const outlookService = require('./services/outlook.service');
const statsService = require('./services/stats.service');
const supabaseService = require('./services/supabase.service');
const reminderService = require('./services/reminder.service');
const principalAgent = require('./agents/principal.agent');
const mailAgent = require('./agents/mail.agent');
const kiaraAgent = require('./agents/kiara.agent');
const emailScheduler = require('./scheduler/email.scheduler');
const articleScheduler = require('./scheduler/article.scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ==================== HEALTH CHECK ====================

/**
 * Endpoint de santé pour les healthchecks (Railway, etc.)
 */
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      outlook: outlookService.isConnected(),
      whatsapp: !!process.env.WHATSAPP_ACCESS_TOKEN,
      supabase: !!process.env.SUPABASE_URL,
      openai: !!process.env.OPENAI_API_KEY
    }
  };
  res.json(health);
});

// ==================== ROUTES ====================

/**
 * Page d'accueil
 */
app.get('/', (req, res) => {
  const outlookConnected = outlookService.isConnected();
  
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BiendouCorp Agent Backend</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #6366f1; }
        .status { padding: 10px; border-radius: 8px; margin: 10px 0; }
        .connected { background: #d1fae5; color: #065f46; }
        .disconnected { background: #fee2e2; color: #991b1b; }
        a { color: #6366f1; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>🤖 BiendouCorp Agent Backend</h1>
      
      <h2>État des connexions</h2>
      <div class="status connected">✅ WhatsApp: Configuré</div>
      <div class="status ${outlookConnected ? 'connected' : 'disconnected'}">
        ${outlookConnected ? '✅' : '❌'} Outlook: ${outlookConnected ? 'Connecté' : 'Non connecté'}
      </div>
      
      ${!outlookConnected ? `
        <h2>🔗 Connecter Outlook</h2>
        <p><a href="/auth/outlook">Cliquez ici pour vous connecter à Outlook</a></p>
      ` : `
        <h2>✅ Outlook connecté</h2>
        <p>Vous pouvez maintenant utiliser les commandes email via WhatsApp.</p>
      `}
      
      <h2>📱 Commandes WhatsApp</h2>
      <ul>
        <li><code>Résume mes emails</code> - Obtenir un résumé des 50 derniers emails</li>
        <li><code>Emails non lus</code> - Voir les emails non lus</li>
        <li><code>Classe mes emails</code> - 📂 Classifier les 50 derniers emails dans les dossiers</li>
        <li><code>Mémoire classification</code> - Voir l'historique de classification</li>
        <li><code>Status</code> - Vérifier les connexions</li>
        <li><code>Aide</code> - Afficher l'aide</li>
      </ul>
      
      <h2>📁 Dossiers de classification</h2>
      <p>🚨 Urgent | 💼 Professionnel | 🛒 Shopping | 📰 Newsletter | 💰 Finance | 👥 Social | 🎓 ISCOD</p>
      
      <h2>🔧 Endpoints API</h2>
      <ul>
        <li><code>GET /auth/outlook</code> - Démarrer l'authentification Outlook</li>
        <li><code>GET /auth/callback</code> - Callback OAuth</li>
        <li><code>POST /webhook/whatsapp</code> - Webhook WhatsApp</li>
        <li><code>GET /api/emails</code> - Récupérer les emails (debug)</li>
      </ul>
    </body>
    </html>
  `);
});

// ==================== AUTH OUTLOOK ====================

/**
 * Démarrer l'authentification Outlook
 */
app.get('/auth/outlook', async (req, res) => {
  try {
    const authUrl = await outlookService.getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    res.status(500).send(`Erreur: ${error.message}`);
  }
});

/**
 * Callback OAuth Outlook
 */
app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Erreur d'authentification: ${error}`);
  }

  if (!code) {
    return res.status(400).send('Code manquant');
  }

  try {
    await outlookService.handleCallback(code);
    
    // Scheduler d'emails désactivé - l'utilisateur préfère vérifier manuellement
    // emailScheduler.start();
    
    // Démarrer le scheduler d'articles si pas déjà actif
    if (!articleScheduler.isRunning) {
      articleScheduler.start();
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Connexion réussie</title>
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; }
          .success { color: #065f46; font-size: 24px; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ Connexion Outlook réussie !</h1>
        <p>Vous pouvez maintenant utiliser les commandes email via WhatsApp.</p>
        <p>Envoyez <strong>"Résume mes emails"</strong> sur WhatsApp pour tester.</p>
        <p><a href="/">Retour à l'accueil</a></p>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`Erreur: ${error.message}`);
  }
});

// ==================== WEBHOOK WHATSAPP ====================

/**
 * Vérification du webhook WhatsApp (GET)
 */
app.get('/webhook/whatsapp', (req, res) => {
  const challenge = whatsappService.verifyWebhook(req.query);
  
  if (challenge) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

/**
 * Réception des messages WhatsApp (POST)
 */
app.post('/webhook/whatsapp', async (req, res) => {
  // Répondre immédiatement à Meta (ils attendent une réponse rapide)
  res.status(200).send('EVENT_RECEIVED');

  try {
    const message = whatsappService.parseIncomingMessage(req.body);
    
    if (message && message.text) {
      // Traiter le message de manière asynchrone
      await principalAgent.handleWhatsAppMessage(message);
    }
  } catch (error) {
    console.error('❌ Erreur traitement webhook:', error);
  }
});

// ==================== API DEBUG ====================

/**
 * Récupérer les emails (pour debug)
 */
app.get('/api/emails', async (req, res) => {
  try {
    if (!outlookService.isConnected()) {
      return res.status(401).json({ error: 'Non connecté à Outlook' });
    }

    const count = parseInt(req.query.count) || 10;
    const emails = await outlookService.getEmails(count);
    
    res.json({ count: emails.length, emails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Classifier les emails dans les dossiers Outlook
 */
app.post('/api/emails/classify', async (req, res) => {
  try {
    if (!outlookService.isConnected()) {
      return res.status(401).json({ error: 'Non connecté à Outlook' });
    }

    const count = parseInt(req.body.count) || 50;
    console.log(`📂 Classification de ${count} emails demandée via API...`);
    
    const result = await mailAgent.classifyAndOrganizeEmails(count);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Erreur classification API:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Obtenir le résumé de la dernière classification
 */
app.get('/api/emails/classification/summary', (req, res) => {
  try {
    const summary = outlookService.getClassificationSummary();
    const memory = outlookService.getClassificationMemory();
    
    res.json({
      totalClassified: memory.length,
      byFolder: summary,
      recentClassifications: memory.slice(-10).reverse()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Obtenir la mémoire complète de classification
 */
app.get('/api/emails/classification/memory', (req, res) => {
  try {
    const memory = outlookService.getClassificationMemory();
    const limit = parseInt(req.query.limit) || 100;
    
    res.json({
      total: memory.length,
      classifications: memory.slice(-limit).reverse()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Envoyer un message WhatsApp (pour debug)
 */
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'to et message requis' });
    }

    await whatsappService.sendMessage(to, message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test des connexions
 */
app.get('/api/status', async (req, res) => {
  const outlookConnected = outlookService.isConnected();
  statsService.setConnectionStatus('outlook', outlookConnected);
  
  res.json({
    whatsapp: 'configured',
    outlook: outlookConnected ? 'connected' : 'disconnected',
    emailScheduler: emailScheduler.intervalId ? 'running' : 'stopped',
    articleScheduler: articleScheduler.getStatus()
  });
});

/**
 * Voir les articles programmés en attente
 */
app.get('/api/scheduled-posts', async (req, res) => {
  try {
    const pending = await articleScheduler.getPendingScheduled();
    res.json({
      count: pending.length,
      posts: pending.map(p => ({
        id: p.id,
        title: p.title,
        scheduledAt: p.scheduled_at,
        status: p.status,
        createdAt: p.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== API AGENTS ====================

/**
 * Obtenir les statistiques du blog pour Kiara
 * IMPORTANT: Cette route spécifique DOIT être AVANT la route générique :agentName
 */
app.get('/api/agents/kiara/blog-stats', async (req, res) => {
  try {
    // Récupérer tous les articles du blog depuis Supabase
    const { data: articles, error } = await supabaseService.client
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erreur récupération articles:', error);
      return res.status(500).json({ error: error.message });
    }
    
    // Calculer les stats
    const publishedArticles = articles.filter(a => a.status === 'published');
    const drafts = articles.filter(a => a.status === 'draft');
    const scheduled = articles.filter(a => a.status === 'scheduled');
    
    // Compter par catégorie
    const categories = {};
    articles.forEach(article => {
      const cat = article.category || 'Non catégorisé';
      categories[cat] = (categories[cat] || 0) + 1;
    });
    
    // Total des vues
    const totalViews = articles.reduce((sum, a) => sum + (a.views_count || 0), 0);
    
    // Top articles par vues
    const topArticles = [...publishedArticles]
      .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        title: a.title,
        views: a.views_count || 0,
        category: a.category
      }));
    
    const stats = {
      totalArticles: articles.length,
      publishedArticles: publishedArticles.length,
      draftsCount: drafts.length,
      scheduledCount: scheduled.length,
      totalViews,
      categories,
      topArticles
    };
    
    res.json({
      stats,
      articles: articles.map(a => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        category: a.category,
        views_count: a.views_count || 0,
        status: a.status,
        published_at: a.published_at,
        created_at: a.created_at,
        excerpt: a.excerpt || (a.content ? a.content.substring(0, 150) + '...' : '')
      }))
    });
  } catch (error) {
    console.error('❌ Erreur stats blog Kiara:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Obtenir les statistiques d'un agent (route générique)
 */
app.get('/api/agents/:agentName/stats', (req, res) => {
  const { agentName } = req.params;
  
  // Mettre à jour le status de connexion Outlook
  statsService.setConnectionStatus('outlook', outlookService.isConnected());
  
  const summary = statsService.getAgentSummary(agentName);
  
  if (!summary.stats) {
    return res.status(404).json({ error: 'Agent non trouvé' });
  }

  res.json(summary);
});

/**
 * Obtenir les activités d'un agent
 */
app.get('/api/agents/:agentName/activities', (req, res) => {
  const { agentName } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  
  const activities = statsService.getAgentActivities(agentName, limit);
  res.json({ activities });
});

/**
 * Obtenir l'état de toutes les connexions
 */
app.get('/api/connections', (req, res) => {
  statsService.setConnectionStatus('outlook', outlookService.isConnected());
  res.json(statsService.getConnections());
});

/**
 * Obtenir les permissions d'un agent (depuis Supabase ou par défaut)
 */
app.get('/api/agents/:agentName/permissions', async (req, res) => {
  const { agentName } = req.params;
  
  try {
    const permissions = await supabaseService.getAgentPermissions(agentName);
    
    if (!permissions || permissions.length === 0) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }

    res.json({ permissions });
  } catch (error) {
    console.error('Erreur récup permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mettre à jour les permissions d'un agent (sauvegarde dans Supabase)
 */
app.put('/api/agents/:agentName/permissions', async (req, res) => {
  const { agentName } = req.params;
  const { permissions } = req.body;
  
  try {
    // Sauvegarder dans Supabase
    const saved = await supabaseService.saveAgentPermissions(agentName, permissions);
    
    if (saved) {
      console.log(`💾 Permissions de ${agentName} sauvegardées dans Supabase`);
      res.json({ success: true, message: 'Permissions sauvegardées dans Supabase' });
    } else {
      console.log(`📝 Permissions de ${agentName} mises à jour (non persistées)`);
      res.json({ success: true, message: 'Permissions mises à jour' });
    }
  } catch (error) {
    console.error('Erreur sauvegarde permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mettre à jour le prompt système d'un agent
 */
app.put('/api/agents/:agentName/prompt', (req, res) => {
  const { agentName } = req.params;
  const { systemPrompt } = req.body;
  
  // TODO: Sauvegarder en base de données et mettre à jour l'agent
  console.log(`📝 Mise à jour prompt pour ${agentName}:`, systemPrompt.substring(0, 50) + '...');
  
  res.json({ success: true, message: 'Prompt système mis à jour' });
});

/**
 * Forcer une resynchronisation
 */
app.post('/api/agents/:agentName/sync', async (req, res) => {
  const { agentName } = req.params;
  
  try {
    if (agentName.toLowerCase() === 'james') {
      if (!outlookService.isConnected()) {
        return res.status(400).json({ error: 'Outlook non connecté' });
      }
      
      // Forcer une sync des emails
      const emails = await outlookService.getEmails(10);
      statsService.logSummarySent();
      statsService.addActivity('james', `Synchronisation manuelle (${emails.length} emails)`);
      
      res.json({ success: true, emailsCount: emails.length });
    } else {
      res.json({ success: true, message: 'Sync non implémentée pour cet agent' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DÉMARRAGE ====================

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ================================');
  console.log('🤖 BiendouCorp Agent Backend');
  console.log('🚀 ================================');
  console.log(`📍 Serveur: http://localhost:${PORT}`);
  console.log(`📱 Webhook WhatsApp: http://localhost:${PORT}/webhook/whatsapp`);
  console.log('');
  console.log('⏳ En attente de connexion Outlook...');
  console.log(`🔗 Connectez-vous: http://localhost:${PORT}/auth/outlook`);
  console.log('');
  
  // Démarrer le scheduler de rappels
  reminderService.init(whatsappService);
  
  // Démarrer le scheduler de publication d'articles
  articleScheduler.start();
  console.log('📰 Article Scheduler démarré');
});
