const openaiService = require('../services/openai.service');
const supabaseService = require('../services/supabase.service');
const outlookService = require('../services/outlook.service');
const whatsappService = require('../services/whatsapp.service');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

/**
 * Agent Kiara - SEO & Blog Manager
 * Gère la rédaction d'articles, les tendances, les stats, PDF et images
 */
class KiaraAgent {
  constructor() {
    this.name = 'Kiara';
    this.role = 'SEO & Blog Manager';
    
    // Parser RSS pour les tendances
    this.rssParser = new Parser({
      customFields: {
        item: ['media:content', 'media:thumbnail']
      }
    });
    
    // APIs d'images gratuites
    this.imageAPIs = {
      unsplash: {
        baseUrl: 'https://api.unsplash.com',
        accessKey: process.env.UNSPLASH_ACCESS_KEY
      },
      pexels: {
        baseUrl: 'https://api.pexels.com/v1',
        apiKey: process.env.PEXELS_API_KEY
      }
    };
    
    // Dossier pour les PDFs générés
    this.pdfFolder = path.join(__dirname, '../../temp/pdfs');
    if (!fs.existsSync(this.pdfFolder)) {
      fs.mkdirSync(this.pdfFolder, { recursive: true });
    }
    
    // Catégories disponibles pour les articles
    this.categories = [
      'Intelligence Artificielle',
      'Développement Web',
      'Data Science',
      'Cloud & DevOps',
      'Carrière Tech',
      'Tutoriels',
      'Cybersécurité',
      'Machine Learning',
      'Actualités Tech'
    ];

    // Sources RSS pour les tendances tech
    this.trendSources = [
      { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', lang: 'en' },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', lang: 'en' },
      { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', lang: 'en' },
      { name: 'Hacker News', url: 'https://hnrss.org/frontpage', lang: 'en' },
      { name: 'Dev.to', url: 'https://dev.to/feed', lang: 'en' },
      { name: 'Google News Tech', url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtWnlHZ0pHVWlnQVAB', lang: 'fr' }
    ];

    this.systemPrompt = `Tu es Kiara, une experte SEO et Content Manager chez BiendouCorp.

🎯 TON RÔLE:
- Rechercher les tendances tech actuelles (via Internet)
- Rédiger des articles de blog optimisés SEO
- Générer des PDFs professionnels des articles
- Trouver des images libres de droit
- Modifier les articles existants
- Gérer les publications et statistiques du blog

✍️ STYLE DE RÉDACTION:
- Articles professionnels mais accessibles
- Ton expert et pédagogique
- Optimisé pour le SEO (mots-clés, structure, meta)
- En français, avec des exemples concrets

📊 CATÉGORIES DISPONIBLES:
${this.categories.map(c => `- ${c}`).join('\n')}

🔧 TES CAPACITÉS:
1. Rechercher les tendances en temps réel (Google News, TechCrunch, etc.)
2. Générer des articles complets avec structure Markdown
3. Créer des PDFs professionnels des articles
4. Trouver des images libres de droit (Unsplash, Pexels)
5. Modifier des articles existants
6. Publier directement sur le blog
7. Donner les statistiques des articles
8. Programmer des publications futures

Réponds toujours de manière professionnelle et utile.`;
  }

  /**
   * Point d'entrée principal de Kiara
   */
  async handleMessage(message, context = {}) {
    const lowerMessage = message.toLowerCase();
    
    // Stocker le contexte pour les sous-fonctions
    this.currentContext = context;

    try {
      // Détection des intentions
      if (this.isStatsRequest(lowerMessage)) {
        return await this.handleStatsRequest(message, lowerMessage);
      }

      if (this.isTrendRequest(lowerMessage)) {
        return await this.handleTrendRequest(message);
      }

      if (this.isPdfRequest(lowerMessage)) {
        return await this.handlePdfRequest(message, context);
      }

      if (this.isImageRequest(lowerMessage)) {
        return await this.handleImageRequest(message);
      }

      if (this.isModifyRequest(lowerMessage)) {
        return await this.handleModifyRequest(message);
      }

      if (this.isArticleGeneration(lowerMessage)) {
        return await this.handleArticleGeneration(message, context);
      }

      if (this.isPublishRequest(lowerMessage)) {
        return await this.handlePublishRequest(message, context);
      }

      if (this.isScheduleRequest(lowerMessage)) {
        return await this.handleScheduleRequest(message, context);
      }

      if (this.isArticleList(lowerMessage)) {
        return await this.handleArticleList();
      }

      // Conversation générale avec Kiara
      return await this.chat(message);

    } catch (error) {
      console.error('❌ Erreur Kiara:', error);
      return `❌ Désolée, j'ai rencontré une erreur: ${error.message}`;
    }
  }

  // ============================================
  // DÉTECTION D'INTENTIONS
  // ============================================

  isStatsRequest(message) {
    const keywords = ['stats', 'statistiques', 'vues', 'performance', 'consultation', 'combien de vue', 'analytics'];
    return keywords.some(k => message.includes(k));
  }

  isTrendRequest(message) {
    const keywords = ['tendance', 'trending', 'actualité', 'news', 'quoi écrire', 'sujet populaire', 'tendances'];
    return keywords.some(k => message.includes(k));
  }

  isPdfRequest(message) {
    const keywords = ['pdf', 'document', 'télécharger', 'exporter', 'génère pdf', 'genere pdf', 'version pdf'];
    return keywords.some(k => message.includes(k));
  }

  isImageRequest(message) {
    const keywords = ['image', 'photo', 'illustration', 'visuel', 'unsplash', 'pexels', 'libre de droit'];
    return keywords.some(k => message.includes(k));
  }

  isModifyRequest(message) {
    const keywords = ['modifie', 'modifier', 'change', 'corrige', 'remplace', 'met à jour', 'édite', 'edit'];
    return keywords.some(k => message.includes(k));
  }

  isArticleGeneration(message) {
    const keywords = ['écris', 'rédige', 'génère', 'crée un article', 'article sur', 'écrit', 'rédiger'];
    return keywords.some(k => message.includes(k));
  }

  isPublishRequest(message) {
    const keywords = ['publie', 'publier', 'poster', 'mettre en ligne', 'publish'];
    return keywords.some(k => message.includes(k));
  }

  isScheduleRequest(message) {
    const keywords = ['programme', 'planifie', 'schedule', 'programmer', 'planifier', 'plus tard'];
    return keywords.some(k => message.includes(k));
  }

  isArticleList(message) {
    const keywords = ['liste des articles', 'mes articles', 'tous les articles', 'articles publiés'];
    return keywords.some(k => message.includes(k));
  }

  // ============================================
  // GESTION DES STATISTIQUES
  // ============================================

  async handleStatsRequest(message, lowerMessage) {
    // Stats d'aujourd'hui
    if (lowerMessage.includes('aujourd') || lowerMessage.includes('jour')) {
      return await this.getDailyStats();
    }

    // Stats d'un article spécifique
    if (lowerMessage.includes('article')) {
      // Extraire le titre ou slug de l'article
      const articleMatch = message.match(/article\s+["']?([^"']+)["']?/i) ||
                          message.match(/stats?\s+(?:de\s+)?["']?([^"']+)["']?/i);
      
      if (articleMatch) {
        return await this.getArticleStats(articleMatch[1].trim());
      }
    }

    // Stats globales par défaut
    return await this.getGlobalStats();
  }

  async getDailyStats() {
    const { data: posts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published');

    if (error) {
      return `❌ Erreur lors de la récupération des stats: ${error.message}`;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Articles publiés aujourd'hui
    const todayPosts = posts.filter(p => {
      const pubDate = new Date(p.published_at);
      pubDate.setHours(0, 0, 0, 0);
      return pubDate.getTime() === today.getTime();
    });

    // Total des vues
    const totalViews = posts.reduce((sum, p) => sum + (p.views_count || 0), 0);

    // Top 5 articles par vues
    const topPosts = [...posts]
      .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
      .slice(0, 5);

    // Stats par catégorie
    const categoryStats = {};
    posts.forEach(p => {
      if (p.category) {
        if (!categoryStats[p.category]) {
          categoryStats[p.category] = { count: 0, views: 0 };
        }
        categoryStats[p.category].count++;
        categoryStats[p.category].views += p.views_count || 0;
      }
    });

    let response = `📊 **Stats du Blog - ${today.toLocaleDateString('fr-FR')}**\n\n`;
    response += `📝 **Total articles publiés:** ${posts.length}\n`;
    response += `📅 **Publiés aujourd'hui:** ${todayPosts.length}\n`;
    response += `👁️ **Total des vues:** ${totalViews.toLocaleString()}\n\n`;

    response += `🏆 **Top 5 Articles:**\n`;
    topPosts.forEach((p, i) => {
      response += `${i + 1}. "${p.title}" - ${p.views_count || 0} vues\n`;
    });

    response += `\n📂 **Par catégorie:**\n`;
    Object.entries(categoryStats)
      .sort((a, b) => b[1].views - a[1].views)
      .forEach(([cat, stats]) => {
        response += `• ${cat}: ${stats.count} articles, ${stats.views} vues\n`;
      });

    return response;
  }

  async getArticleStats(searchTerm) {
    const { data: posts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published');

    if (error) {
      return `❌ Erreur: ${error.message}`;
    }

    // Rechercher l'article par titre ou slug
    const article = posts.find(p => 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!article) {
      return `❌ Article "${searchTerm}" non trouvé. Essaie avec un autre terme.`;
    }

    const pubDate = article.published_at 
      ? new Date(article.published_at).toLocaleDateString('fr-FR', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : 'Non publié';

    let response = `📊 **Stats de l'article**\n\n`;
    response += `📝 **Titre:** ${article.title}\n`;
    response += `🔗 **Slug:** ${article.slug}\n`;
    response += `📂 **Catégorie:** ${article.category || 'Non catégorisé'}\n`;
    response += `📅 **Publié le:** ${pubDate}\n`;
    response += `👁️ **Vues:** ${article.views_count || 0}\n`;
    response += `⏱️ **Temps de lecture:** ${article.reading_time_minutes || '?'} min\n`;
    
    if (article.tags && article.tags.length > 0) {
      response += `🏷️ **Tags:** ${article.tags.join(', ')}\n`;
    }

    // Position dans le classement
    const sortedPosts = [...posts].sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    const rank = sortedPosts.findIndex(p => p.id === article.id) + 1;
    response += `\n🏆 **Classement:** #${rank} sur ${posts.length} articles`;

    return response;
  }

  async getGlobalStats() {
    const { data: posts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published');

    if (error) {
      return `❌ Erreur: ${error.message}`;
    }

    const totalViews = posts.reduce((sum, p) => sum + (p.views_count || 0), 0);
    const avgViews = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;

    // Top article
    const topPost = [...posts].sort((a, b) => (b.views_count || 0) - (a.views_count || 0))[0];

    // Catégories uniques
    const categories = [...new Set(posts.map(p => p.category).filter(Boolean))];

    let response = `📊 **Statistiques Globales du Blog**\n\n`;
    response += `📝 **Articles publiés:** ${posts.length}\n`;
    response += `👁️ **Total des vues:** ${totalViews.toLocaleString()}\n`;
    response += `📈 **Moyenne par article:** ${avgViews} vues\n`;
    response += `📂 **Catégories:** ${categories.length}\n\n`;

    if (topPost) {
      response += `🏆 **Article le plus populaire:**\n`;
      response += `"${topPost.title}" avec ${topPost.views_count || 0} vues`;
    }

    return response;
  }

  // ============================================
  // RECHERCHE DE TENDANCES
  // ============================================

  async handleTrendRequest(message) {
    console.log('🔍 Kiara recherche les tendances en temps réel...');
    
    const trends = await this.fetchTrendsFromInternet();
    
    let response = `🔥 **Tendances Tech en temps réel** (${new Date().toLocaleDateString('fr-FR')})\n\n`;
    
    trends.forEach((trend, i) => {
      response += `${i + 1}. **${trend.title}**\n`;
      response += `   📰 Source: ${trend.source}\n`;
      if (trend.description) {
        response += `   ${trend.description.substring(0, 150)}...\n`;
      }
      response += `   📂 Catégorie suggérée: ${trend.category}\n`;
      response += `   🔗 ${trend.link}\n\n`;
    });

    response += `\n💡 Tu veux que je rédige un article sur l'un de ces sujets ? Dis-moi le numéro !`;
    
    return response;
  }

  /**
   * Récupère les vraies tendances depuis plusieurs sources RSS
   */
  async fetchTrendsFromInternet() {
    const allTrends = [];
    
    console.log('📡 Fetching trends from RSS feeds...');
    
    for (const source of this.trendSources) {
      try {
        const feed = await this.rssParser.parseURL(source.url);
        
        // Prendre les 3 premiers articles de chaque source
        const items = feed.items.slice(0, 3).map(item => ({
          title: item.title,
          description: item.contentSnippet || item.content || '',
          link: item.link,
          source: source.name,
          pubDate: item.pubDate,
          category: this.detectCategoryFromContent(item.title + ' ' + (item.contentSnippet || ''))
        }));
        
        allTrends.push(...items);
      } catch (error) {
        console.log(`⚠️ Erreur RSS ${source.name}:`, error.message);
      }
    }
    
    // Trier par date et limiter à 10
    const sortedTrends = allTrends
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 10);
    
    if (sortedTrends.length === 0) {
      // Fallback si pas de RSS disponible
      return await this.fetchTrendsFallback();
    }
    
    console.log(`✅ ${sortedTrends.length} tendances trouvées`);
    return sortedTrends;
  }

  /**
   * Fallback: utilise OpenAI pour générer des suggestions basées sur les connaissances actuelles
   */
  async fetchTrendsFallback() {
    const prompt = `En tant qu'expert tech, donne-moi 5 sujets tendance actuellement dans le monde de la tech et du développement.

Pour chaque sujet, fournis:
- Un titre accrocheur
- Une courte description (1-2 phrases)
- La catégorie parmi: ${this.categories.join(', ')}

Réponds en JSON avec ce format:
[
  {"title": "...", "description": "...", "category": "...", "source": "Analyse IA", "link": "#"},
  ...
]`;

    try {
      const response = await openaiService.chat(this.systemPrompt, prompt, { json: true });
      return JSON.parse(response);
    } catch (e) {
      return [
        { title: "L'IA Générative en 2025", description: "Les dernières avancées en génération de contenu", category: "Intelligence Artificielle", source: "Analyse IA", link: "#" },
        { title: "Next.js 15 et React Server Components", description: "Les nouvelles fonctionnalités révolutionnaires", category: "Développement Web", source: "Analyse IA", link: "#" },
        { title: "MLOps: Du modèle à la production", description: "Comment déployer efficacement vos modèles ML", category: "Machine Learning", source: "Analyse IA", link: "#" },
        { title: "La cybersécurité à l'ère de l'IA", description: "Nouvelles menaces et solutions", category: "Cybersécurité", source: "Analyse IA", link: "#" },
        { title: "Kubernetes en 2025", description: "Orchestration cloud native simplifiée", category: "Cloud & DevOps", source: "Analyse IA", link: "#" }
      ];
    }
  }

  /**
   * Détecte la catégorie à partir du contenu
   */
  detectCategoryFromContent(content) {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.match(/\b(ai|gpt|llm|openai|claude|gemini|chatgpt|artificial intelligence|machine learning)\b/)) {
      return 'Intelligence Artificielle';
    }
    if (lowerContent.match(/\b(react|next|vue|angular|javascript|typescript|frontend|web dev|css|html)\b/)) {
      return 'Développement Web';
    }
    if (lowerContent.match(/\b(python|data|analytics|pandas|sql|database|big data)\b/)) {
      return 'Data Science';
    }
    if (lowerContent.match(/\b(cloud|aws|azure|gcp|docker|kubernetes|devops|terraform)\b/)) {
      return 'Cloud & DevOps';
    }
    if (lowerContent.match(/\b(ml|model|training|neural|deep learning|pytorch|tensorflow)\b/)) {
      return 'Machine Learning';
    }
    if (lowerContent.match(/\b(security|cyber|hack|breach|vulnerability|ransomware)\b/)) {
      return 'Cybersécurité';
    }
    if (lowerContent.match(/\b(career|job|hiring|salary|remote|freelance)\b/)) {
      return 'Carrière Tech';
    }
    if (lowerContent.match(/\b(tutorial|guide|how to|learn|course)\b/)) {
      return 'Tutoriels';
    }
    
    return 'Actualités Tech';
  }

  // ============================================
  // GÉNÉRATION D'ARTICLES
  // ============================================

  async handleArticleGeneration(message) {
    // Extraire le sujet
    const subjectMatch = message.match(/(?:sur|about|concernant)\s+["']?(.+?)["']?$/i) ||
                        message.match(/article\s+["']?(.+?)["']?$/i);
    
    const subject = subjectMatch ? subjectMatch[1].trim() : message;

    console.log(`✍️ Kiara génère un article sur: ${subject}`);

    // Déterminer la catégorie
    const category = await this.detectCategory(subject);

    // Chercher une image pertinente
    console.log('🖼️ Recherche d\'une image pour l\'article...');
    const images = await this.searchFreeImages(subject, 1);
    const coverImage = images.length > 0 ? images[0] : null;

    // Chercher les tendances liées au sujet pour enrichir l'article
    console.log('🔍 Recherche de sources pour enrichir l\'article...');
    const relatedTrends = await this.fetchRelatedContent(subject);

    const articlePrompt = `Rédige un article de blog complet et professionnel sur le sujet suivant: "${subject}"

${relatedTrends.length > 0 ? `
📰 SOURCES ACTUELLES À INTÉGRER (mentionne-les dans l'article):
${relatedTrends.map(t => `- ${t.title} (${t.source}): ${t.description?.substring(0, 100)}`).join('\n')}
` : ''}

📋 STRUCTURE REQUISE:

1. **Titre accrocheur** (optimisé SEO, 60-70 caractères)
2. **Meta description** (150-160 caractères pour le SEO)
3. **Mots-clés** (5-8 mots-clés pertinents)
4. **Extrait** (2-3 phrases résumant l'article)
5. **Contenu principal** en Markdown avec:
   - Introduction engageante qui accroche le lecteur
   - 4-6 sections avec sous-titres (## et ###)
   - Exemples concrets et cas pratiques actuels
   - Statistiques ou chiffres quand pertinent
   - Listes à puces pour la lisibilité
   - Conclusion avec call-to-action
6. **Temps de lecture estimé** (en minutes)

L'article doit faire au moins 1000 mots et être très informatif.

Réponds en JSON avec ce format exact:
{
  "title": "...",
  "meta_description": "...",
  "keywords": ["...", "..."],
  "excerpt": "...",
  "content": "# Titre\\n\\n## Section 1\\n...",
  "category": "${category}",
  "reading_time_minutes": 5,
  "tags": ["...", "..."],
  "sources": ["..."]
}`;

    try {
      const response = await openaiService.chat(this.systemPrompt, articlePrompt, { 
        json: true,
        maxTokens: 4000 
      });
      
      const article = JSON.parse(response);
      
      // Ajouter l'image de couverture
      if (coverImage) {
        article.cover_image = coverImage.url;
        article.cover_image_author = coverImage.author;
        article.cover_image_source = coverImage.source;
      }

      // Sauvegarder en brouillon
      const savedArticle = await this.saveArticleDraft(article);

      // Stocker l'article en mémoire pour le PDF
      this.lastGeneratedArticle = { ...article, id: savedArticle?.id };

      let result = `✅ **Article généré avec succès !**\n\n`;
      result += `📝 **Titre:** ${article.title}\n`;
      result += `📂 **Catégorie:** ${article.category}\n`;
      result += `⏱️ **Temps de lecture:** ${article.reading_time_minutes} min\n`;
      result += `🏷️ **Tags:** ${article.tags?.join(', ') || 'Aucun'}\n`;
      if (coverImage) {
        result += `🖼️ **Image:** ${coverImage.source} (${coverImage.author})\n`;
      }
      result += `\n📄 **Extrait:**\n${article.excerpt}\n\n`;
      result += `💾 Article sauvegardé en brouillon (ID: ${savedArticle?.id || 'N/A'})\n\n`;
      result += `👉 **Actions possibles:**\n`;
      result += `• "PDF de l'article" - Recevoir le PDF\n`;
      result += `• "Modifie le titre par '...'" - Modifier\n`;
      result += `• "Publie l'article" - Publier sur le blog`;

      return result;

    } catch (error) {
      console.error('Erreur génération article:', error);
      return `❌ Erreur lors de la génération de l'article: ${error.message}`;
    }
  }

  /**
   * Cherche du contenu lié au sujet pour enrichir l'article
   */
  async fetchRelatedContent(subject) {
    const allContent = [];
    
    // Chercher dans les RSS avec le sujet comme filtre
    for (const source of this.trendSources.slice(0, 3)) {
      try {
        const feed = await this.rssParser.parseURL(source.url);
        
        const related = feed.items
          .filter(item => {
            const text = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
            const keywords = subject.toLowerCase().split(' ');
            return keywords.some(kw => kw.length > 3 && text.includes(kw));
          })
          .slice(0, 2)
          .map(item => ({
            title: item.title,
            description: item.contentSnippet || '',
            link: item.link,
            source: source.name
          }));
        
        allContent.push(...related);
      } catch (error) {
        // Ignorer les erreurs RSS
      }
    }
    
    return allContent.slice(0, 5);
  }

  async detectCategory(subject) {
    const lowerSubject = subject.toLowerCase();
    
    if (lowerSubject.includes('ia') || lowerSubject.includes('intelligence artificielle') || lowerSubject.includes('gpt') || lowerSubject.includes('llm')) {
      return 'Intelligence Artificielle';
    }
    if (lowerSubject.includes('react') || lowerSubject.includes('next') || lowerSubject.includes('web') || lowerSubject.includes('frontend') || lowerSubject.includes('javascript')) {
      return 'Développement Web';
    }
    if (lowerSubject.includes('data') || lowerSubject.includes('python') || lowerSubject.includes('analyse')) {
      return 'Data Science';
    }
    if (lowerSubject.includes('cloud') || lowerSubject.includes('docker') || lowerSubject.includes('kubernetes') || lowerSubject.includes('devops')) {
      return 'Cloud & DevOps';
    }
    if (lowerSubject.includes('ml') || lowerSubject.includes('machine learning') || lowerSubject.includes('modèle')) {
      return 'Machine Learning';
    }
    if (lowerSubject.includes('sécurité') || lowerSubject.includes('cyber') || lowerSubject.includes('hack')) {
      return 'Cybersécurité';
    }
    if (lowerSubject.includes('carrière') || lowerSubject.includes('emploi') || lowerSubject.includes('job') || lowerSubject.includes('freelance')) {
      return 'Carrière Tech';
    }
    if (lowerSubject.includes('tuto') || lowerSubject.includes('comment') || lowerSubject.includes('guide')) {
      return 'Tutoriels';
    }
    
    return 'Actualités Tech';
  }

  async saveArticleDraft(article) {
    const slug = this.generateSlug(article.title);
    
    const { data, error } = await supabaseService.supabase
      .from('blog_posts')
      .insert({
        title: article.title,
        slug: slug,
        excerpt: article.excerpt,
        content: article.content,
        meta_title: article.title,
        meta_description: article.meta_description,
        keywords: article.keywords,
        category: article.category,
        tags: article.tags,
        author_name: 'Brian Biendou',
        status: 'draft',
        reading_time_minutes: article.reading_time_minutes,
        views_count: 0,
        cover_image: article.cover_image || null
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur sauvegarde brouillon:', error);
      return null;
    }

    return data;
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
      .replace(/[^a-z0-9]+/g, '-')     // Remplacer caractères spéciaux
      .replace(/^-+|-+$/g, '')          // Supprimer tirets début/fin
      .substring(0, 80);                // Limiter longueur
  }

  // ============================================
  // PUBLICATION D'ARTICLES
  // ============================================

  async handlePublishRequest(message, context = {}) {
    // Chercher l'article par titre ou ID
    const titleMatch = message.match(/(?:publie|publier)\s+(?:l'article\s+)?["']?(.+?)["']?$/i);
    
    if (!titleMatch) {
      // Lister les brouillons
      return await this.listDrafts();
    }

    const searchTerm = titleMatch[1].trim();
    
    // Chercher le brouillon
    const { data: drafts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'draft');

    if (error || !drafts) {
      return `❌ Erreur lors de la recherche: ${error?.message || 'Aucun brouillon trouvé'}`;
    }

    const article = drafts.find(d => 
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.slug.includes(searchTerm.toLowerCase())
    );

    if (!article) {
      return `❌ Brouillon "${searchTerm}" non trouvé.\n\nBrouillons disponibles:\n${drafts.map(d => `• ${d.title}`).join('\n')}`;
    }

    // Publier l'article
    const { error: updateError } = await supabaseService.supabase
      .from('blog_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString()
      })
      .eq('id', article.id);

    if (updateError) {
      return `❌ Erreur lors de la publication: ${updateError.message}`;
    }

    return `✅ **Article publié avec succès !**\n\n📝 "${article.title}"\n🔗 Slug: ${article.slug}\n📂 Catégorie: ${article.category}\n\n🌐 L'article est maintenant visible sur le blog !`;
  }

  async listDrafts() {
    const { data: drafts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'draft')
      .order('created_at', { ascending: false });

    if (error) {
      return `❌ Erreur: ${error.message}`;
    }

    if (!drafts || drafts.length === 0) {
      return `📝 Aucun brouillon en attente.\n\nTu veux que je rédige un nouvel article ?`;
    }

    let response = `📝 **Brouillons en attente (${drafts.length})**\n\n`;
    drafts.forEach((d, i) => {
      response += `${i + 1}. **${d.title}**\n`;
      response += `   📂 ${d.category || 'Non catégorisé'} | ⏱️ ${d.reading_time_minutes || '?'} min\n\n`;
    });

    response += `\n💡 Pour publier, dis: "Publie l'article [titre]"`;

    return response;
  }

  // ============================================
  // LISTE DES ARTICLES
  // ============================================

  async handleArticleList() {
    const { data: posts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(10);

    if (error) {
      return `❌ Erreur: ${error.message}`;
    }

    if (!posts || posts.length === 0) {
      return `📝 Aucun article publié pour le moment.\n\nTu veux que je rédige le premier ?`;
    }

    let response = `📚 **Derniers articles publiés**\n\n`;
    posts.forEach((p, i) => {
      const date = new Date(p.published_at).toLocaleDateString('fr-FR');
      response += `${i + 1}. **${p.title}**\n`;
      response += `   📅 ${date} | 👁️ ${p.views_count || 0} vues | 📂 ${p.category || 'N/A'}\n\n`;
    });

    return response;
  }

  // ============================================
  // PROGRAMMATION D'ARTICLES
  // ============================================

  async handleScheduleRequest(message) {
    console.log('⏰ Kiara programme un article...');
    
    // Parser la date et l'heure
    const dateTimeInfo = this.parseDateTimeFromMessage(message);
    
    if (!dateTimeInfo.date) {
      return `⏰ **Programmation d'articles**\n\nJe n'ai pas compris la date. Exemples:\n• "Programme pour demain 9h"\n• "Programme pour le 15 décembre à 14h"\n• "Programme pour lundi prochain 10h"`;
    }

    // Chercher l'article à programmer (dernier généré ou spécifié)
    let article = this.lastGeneratedArticle;
    
    // Chercher si un titre est spécifié
    const titleMatch = message.match(/(?:article|l'article)\s+["']?([^"']+?)["']?\s+(?:pour|à|a)/i);
    if (titleMatch) {
      const searchTerm = titleMatch[1].trim();
      const { data: posts } = await supabaseService.supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'draft');
      
      if (posts) {
        const found = posts.find(p => 
          p.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (found) article = found;
      }
    }

    if (!article) {
      return `❌ Aucun article à programmer.\n\nD'abord, génère un article avec "Rédige un article sur [sujet]"`;
    }

    // Sauvegarder la programmation dans Supabase
    const scheduledDate = dateTimeInfo.date;
    
    const { data: scheduled, error } = await supabaseService.supabase
      .from('scheduled_posts')
      .insert({
        post_id: article.id,
        title: article.title,
        scheduled_at: scheduledDate.toISOString(),
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur programmation:', error);
      // Continuer quand même si la table n'existe pas
    }

    // Créer un événement dans Outlook Calendar
    let calendarEvent = null;
    try {
      if (outlookService.isConnected()) {
        calendarEvent = await outlookService.createEvent({
          subject: `📝 Publication Blog: ${article.title}`,
          body: {
            contentType: 'HTML',
            content: `<h2>Article programmé pour publication</h2>
              <p><strong>Titre:</strong> ${article.title}</p>
              <p><strong>Catégorie:</strong> ${article.category || 'Non catégorisé'}</p>
              <p><strong>Extrait:</strong> ${article.excerpt || ''}</p>
              <hr>
              <p>🤖 Programmé par Kiara - BiendouCorp Agent</p>`
          },
          start: {
            dateTime: scheduledDate.toISOString(),
            timeZone: 'Europe/Paris'
          },
          end: {
            dateTime: new Date(scheduledDate.getTime() + 30 * 60000).toISOString(), // +30 min
            timeZone: 'Europe/Paris'
          },
          reminderMinutesBefore: 60, // Rappel 1h avant
          isReminderOn: true
        });
        console.log('✅ Événement Outlook créé');
      }
    } catch (e) {
      console.log('⚠️ Impossible de créer l\'événement Outlook:', e.message);
    }

    // Formater la date pour l'affichage
    const formattedDate = scheduledDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let response = `✅ **Article programmé !**\n\n`;
    response += `📝 **Article:** ${article.title}\n`;
    response += `📅 **Publication:** ${formattedDate}\n`;
    response += `📂 **Catégorie:** ${article.category || 'Non catégorisé'}\n\n`;
    
    if (calendarEvent) {
      response += `📆 **Outlook Calendar:** ✅ Événement créé avec rappel 1h avant\n\n`;
    } else {
      response += `📆 **Outlook Calendar:** ⚠️ Non connecté (connecte Outlook pour sync)\n\n`;
    }

    response += `👉 **Actions:**\n`;
    response += `• "PDF de l'article" - Recevoir le PDF\n`;
    response += `• "Modifie..." - Modifier l'article\n`;
    response += `• "Publie maintenant" - Publier immédiatement\n`;
    response += `• "Annule la programmation" - Annuler`;

    return response;
  }

  /**
   * Parse une date/heure depuis un message en langage naturel
   */
  parseDateTimeFromMessage(message) {
    const lowerMessage = message.toLowerCase();
    const now = new Date();
    let targetDate = null;
    let targetHour = 9; // Heure par défaut
    let targetMinute = 0;

    // Extraire l'heure
    const hourMatch = message.match(/(\d{1,2})\s*[hH:]\s*(\d{0,2})/);
    if (hourMatch) {
      targetHour = parseInt(hourMatch[1]);
      targetMinute = hourMatch[2] ? parseInt(hourMatch[2]) : 0;
    }

    // Demain
    if (lowerMessage.includes('demain')) {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + 1);
    }
    // Après-demain
    else if (lowerMessage.includes('après-demain') || lowerMessage.includes('apres-demain')) {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + 2);
    }
    // Jours de la semaine
    else if (lowerMessage.includes('lundi')) {
      targetDate = this.getNextDayOfWeek(1);
    } else if (lowerMessage.includes('mardi')) {
      targetDate = this.getNextDayOfWeek(2);
    } else if (lowerMessage.includes('mercredi')) {
      targetDate = this.getNextDayOfWeek(3);
    } else if (lowerMessage.includes('jeudi')) {
      targetDate = this.getNextDayOfWeek(4);
    } else if (lowerMessage.includes('vendredi')) {
      targetDate = this.getNextDayOfWeek(5);
    } else if (lowerMessage.includes('samedi')) {
      targetDate = this.getNextDayOfWeek(6);
    } else if (lowerMessage.includes('dimanche')) {
      targetDate = this.getNextDayOfWeek(0);
    }
    // Date spécifique (ex: "15 décembre", "15/12")
    else {
      const dateMatch = message.match(/(\d{1,2})\s*(?:\/|-|\s)?\s*(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|\d{1,2})/i);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        let month = dateMatch[2];
        
        const monthMap = {
          'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3,
          'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'aout': 7,
          'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11
        };
        
        const monthNum = isNaN(month) ? monthMap[month.toLowerCase()] : parseInt(month) - 1;
        
        targetDate = new Date(now.getFullYear(), monthNum, day);
        
        // Si la date est passée, prendre l'année prochaine
        if (targetDate < now) {
          targetDate.setFullYear(targetDate.getFullYear() + 1);
        }
      }
    }

    // Appliquer l'heure
    if (targetDate) {
      targetDate.setHours(targetHour, targetMinute, 0, 0);
    }

    return { date: targetDate, hour: targetHour, minute: targetMinute };
  }

  /**
   * Obtenir le prochain jour de la semaine
   */
  getNextDayOfWeek(dayOfWeek) {
    const now = new Date();
    const currentDay = now.getDay();
    let daysUntil = dayOfWeek - currentDay;
    
    if (daysUntil <= 0) {
      daysUntil += 7; // Semaine prochaine
    }
    
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysUntil);
    return targetDate;
  }

  // ============================================
  // GÉNÉRATION DE PDF
  // ============================================

  async handlePdfRequest(message, context = {}) {
    console.log('📄 Kiara génère un PDF...');
    
    // Récupérer le numéro WhatsApp du contexte
    const whatsappNumber = context.from || this.currentContext?.from || process.env.MY_PHONE_NUMBER;
    
    // Vérifier si l'utilisateur veut l'envoyer sur WhatsApp
    const wantWhatsApp = message.toLowerCase().includes('whatsapp') || 
                         message.toLowerCase().includes('envoie') ||
                         message.toLowerCase().includes('envoi');
    
    // Extraire le titre de l'article demandé
    const titleMatch = message.match(/pdf\s+(?:de\s+)?(?:l'article\s+)?["']?(.+?)["']?$/i) ||
                       message.match(/(?:génère|genere|exporte)\s+(?:un\s+)?pdf\s+(?:de\s+)?["']?(.+?)["']?$/i);
    
    // Si pas de titre spécifié, utiliser le dernier article généré
    if (!titleMatch && this.lastGeneratedArticle) {
      const article = this.lastGeneratedArticle;
      try {
        const pdfResult = await this.generateAndUploadPdf(article, wantWhatsApp ? whatsappNumber : null);
        return pdfResult;
      } catch (error) {
        console.error('Erreur génération PDF:', error);
        return `❌ Erreur lors de la génération du PDF: ${error.message}`;
      }
    }

    if (!titleMatch) {
      return await this.listArticlesForPdf();
    }

    const searchTerm = titleMatch[1].trim();
    
    // Chercher l'article
    const { data: posts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('*');

    if (error) {
      return `❌ Erreur: ${error.message}`;
    }

    const article = posts.find(p => 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!article) {
      return `❌ Article "${searchTerm}" non trouvé.\n\nArticles disponibles:\n${posts.slice(0, 5).map(p => `• ${p.title}`).join('\n')}`;
    }

    // Générer et uploader le PDF (avec envoi WhatsApp si demandé)
    try {
      const pdfResult = await this.generateAndUploadPdf(article, wantWhatsApp ? whatsappNumber : null);
      return pdfResult;
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      return `❌ Erreur lors de la génération du PDF: ${error.message}`;
    }
  }

  /**
   * Génère le PDF et l'upload sur Supabase Storage
   */
  async generateAndUploadPdf(article, sendToWhatsApp = null) {
    // Générer le PDF localement
    const pdfPath = await this.generatePdf(article);
    
    // Lire le fichier PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const filename = path.basename(pdfPath);
    
    // Uploader sur Supabase Storage
    let publicUrl = null;
    try {
      const { data, error } = await supabaseService.supabase.storage
        .from('pdfs')
        .upload(`articles/${filename}`, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (!error) {
        // Obtenir l'URL publique
        const { data: urlData } = supabaseService.supabase.storage
          .from('pdfs')
          .getPublicUrl(`articles/${filename}`);
        
        publicUrl = urlData?.publicUrl;
      } else {
        console.log('⚠️ Upload Supabase Storage échoué:', error.message);
      }
    } catch (e) {
      console.log('⚠️ Supabase Storage non configuré:', e.message);
    }

    // Nettoyer le fichier local
    try {
      fs.unlinkSync(pdfPath);
    } catch (e) {}

    // Envoyer sur WhatsApp si URL disponible et numéro fourni
    let whatsappSent = false;
    if (publicUrl && sendToWhatsApp) {
      try {
        await whatsappService.sendDocument(
          sendToWhatsApp,
          publicUrl,
          `${article.slug || 'article'}.pdf`,
          `📄 ${article.title}\n📂 ${article.category || 'Blog'}\n\n🤖 Généré par Kiara`
        );
        whatsappSent = true;
        console.log('✅ PDF envoyé sur WhatsApp');
      } catch (e) {
        console.log('⚠️ Erreur envoi WhatsApp:', e.message);
      }
    }

    let response = `✅ **PDF généré avec succès !**\n\n`;
    response += `📄 **Article:** ${article.title}\n`;
    response += `📂 **Catégorie:** ${article.category || 'Non catégorisé'}\n`;
    response += `📁 **Fichier:** ${filename}\n\n`;

    if (publicUrl) {
      response += `🔗 **Lien de téléchargement:**\n${publicUrl}\n\n`;
      
      if (whatsappSent) {
        response += `📱 **WhatsApp:** ✅ PDF envoyé !\n`;
      } else if (sendToWhatsApp) {
        response += `📱 **WhatsApp:** ⚠️ Envoi échoué, utilise le lien ci-dessus\n`;
      }
    } else {
      response += `⚠️ Le PDF a été généré mais n'a pas pu être uploadé.\n`;
      response += `💡 Configure Supabase Storage (bucket "pdfs" public) pour le partage.\n`;
    }

    return response;
  }

  async listArticlesForPdf() {
    const { data: posts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('title, slug, category')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !posts?.length) {
      return `❌ Aucun article disponible pour la génération de PDF.`;
    }

    let response = `📄 **Articles disponibles pour PDF**\n\n`;
    posts.forEach((p, i) => {
      response += `${i + 1}. ${p.title}\n`;
      response += `   📂 ${p.category || 'Non catégorisé'}\n\n`;
    });

    response += `\n💡 Dis "PDF de [titre]" pour générer le PDF d'un article.`;
    return response;
  }

  /**
   * Génère un PDF professionnel à partir d'un article
   * Supporte les sources et images
   */
  async generatePdf(article) {
    return new Promise(async (resolve, reject) => {
      const filename = `${article.slug}-${Date.now()}.pdf`;
      const filepath = path.join(this.pdfFolder, filename);
      
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        info: {
          Title: article.title,
          Author: article.author_name || 'Brian Biendou',
          Subject: article.category,
          Keywords: article.keywords?.join(', ') || '',
          Creator: 'Kiara - BiendouCorp Agent SEO'
        }
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // === PAGE DE COUVERTURE ===
      // Fond dégradé simulé (rectangle bleu)
      doc.rect(0, 0, 595, 200)
         .fill('#3b82f6');
      
      // Logo / Branding
      doc.fontSize(14)
         .fillColor('#ffffff')
         .text('BIENDOU CORP', 60, 40, { continued: true })
         .fontSize(14)
         .fillColor('#93c5fd')
         .text(' BLOG', { continued: false });
      
      doc.fontSize(10)
         .fillColor('#93c5fd')
         .text(new Date().toLocaleDateString('fr-FR', { 
           day: 'numeric', 
           month: 'long', 
           year: 'numeric' 
         }), 60, 60);

      // Badge catégorie
      if (article.category) {
        const categoryWidth = doc.widthOfString(article.category.toUpperCase()) + 20;
        doc.roundedRect(60, 90, categoryWidth, 25, 5)
           .fill('#1d4ed8');
        doc.fontSize(10)
           .fillColor('#ffffff')
           .text(article.category.toUpperCase(), 70, 97);
      }

      // Titre principal (sur fond bleu)
      doc.fontSize(32)
         .fillColor('#ffffff')
         .text(article.title, 60, 130, { 
           width: 475,
           lineGap: 5
         });

      // Zone blanche
      const titleEndY = Math.max(doc.y + 20, 200);
      
      // Méta infos
      doc.fontSize(11)
         .fillColor('#64748b')
         .text(`✍️ Par ${article.author_name || 'Brian Biendou'}`, 60, titleEndY + 20);
      
      doc.fontSize(11)
         .text(`⏱️ ${article.reading_time_minutes || '5'} min de lecture`, 60, doc.y + 5);
      
      if (article.sources && article.sources.length > 0) {
        doc.fontSize(11)
           .text(`📚 ${article.sources.length} source(s) citée(s)`, 60, doc.y + 5);
      }

      // Extrait (encadré)
      if (article.excerpt) {
        doc.moveDown(1);
        const excerptY = doc.y;
        doc.rect(55, excerptY - 5, 485, 80)
           .fill('#f1f5f9');
        doc.fontSize(12)
           .fillColor('#475569')
           .text(article.excerpt, 70, excerptY + 10, {
             width: 455,
             lineGap: 6
           });
      }

      // Ligne de séparation
      doc.moveTo(60, doc.y + 25)
         .lineTo(535, doc.y + 25)
         .strokeColor('#e2e8f0')
         .lineWidth(2)
         .stroke();

      // Contenu principal
      doc.moveDown(3);
      
      // Parser le Markdown simplifié
      const content = this.parseMarkdownForPdf(article.content);
      
      content.forEach(block => {
        // Vérifier si on a besoin d'une nouvelle page
        if (doc.y > 700) {
          doc.addPage();
          doc.y = 60;
        }

        switch (block.type) {
          case 'h1':
            doc.moveDown(0.5);
            doc.fontSize(24)
               .fillColor('#0f172a')
               .text(block.text, { paragraphGap: 15 });
            break;
          case 'h2':
            doc.moveDown(0.5);
            // Petite barre bleue avant H2
            doc.rect(60, doc.y, 4, 18).fill('#3b82f6');
            doc.fontSize(18)
               .fillColor('#1e293b')
               .text(block.text, 70, doc.y - 2, { paragraphGap: 12 });
            break;
          case 'h3':
            doc.fontSize(14)
               .fillColor('#334155')
               .text(block.text, { paragraphGap: 10 });
            break;
          case 'paragraph':
            doc.fontSize(11)
               .fillColor('#374151')
               .text(block.text, { 
                 paragraphGap: 10,
                 lineGap: 5,
                 width: 475,
                 align: 'justify'
               });
            break;
          case 'list':
            doc.fontSize(11)
               .fillColor('#374151')
               .text(`  •  ${block.text}`, { 
                 paragraphGap: 5,
                 indent: 15,
                 width: 460
               });
            break;
          case 'code':
            doc.rect(60, doc.y, 475, 25).fill('#f8fafc');
            doc.fontSize(9)
               .fillColor('#1e293b')
               .font('Courier')
               .text(block.text, 70, doc.y + 5, { 
                 paragraphGap: 10,
                 lineGap: 2
               });
            doc.font('Helvetica');
            doc.moveDown(0.5);
            break;
        }
      });

      // === SECTION SOURCES ===
      if (article.sources && article.sources.length > 0) {
        // Nouvelle page si pas assez de place
        if (doc.y > 600) {
          doc.addPage();
          doc.y = 60;
        }

        doc.moveDown(2);
        
        // Titre section sources
        doc.rect(55, doc.y, 485, 35).fill('#f1f5f9');
        doc.fontSize(16)
           .fillColor('#1e40af')
           .text('📚 Sources & Références', 65, doc.y + 10);
        
        doc.moveDown(2);

        article.sources.forEach((source, index) => {
          if (doc.y > 720) {
            doc.addPage();
            doc.y = 60;
          }

          // Numéro de source
          doc.fontSize(10)
             .fillColor('#3b82f6')
             .text(`[${index + 1}]`, 60, doc.y, { continued: true });
          
          // Titre de la source
          doc.fontSize(10)
             .fillColor('#1e293b')
             .text(` ${source.title || 'Source'}`, { continued: false });
          
          // URL de la source
          if (source.url || source.link) {
            doc.fontSize(9)
               .fillColor('#64748b')
               .text(`    ${source.url || source.link}`, { link: source.url || source.link });
          }

          // Source (site)
          if (source.source) {
            doc.fontSize(9)
               .fillColor('#94a3b8')
               .text(`    Source: ${source.source}`);
          }

          doc.moveDown(0.5);
        });
      }

      // === SECTION IMAGES (crédits) ===
      if (article.images && article.images.length > 0) {
        if (doc.y > 650) {
          doc.addPage();
          doc.y = 60;
        }

        doc.moveDown(1);
        doc.fontSize(12)
           .fillColor('#64748b')
           .text('📷 Crédits photos:', 60, doc.y);
        
        article.images.forEach(img => {
          if (img.photographer) {
            doc.fontSize(9)
               .fillColor('#94a3b8')
               .text(`  • Photo par ${img.photographer}${img.source ? ` via ${img.source}` : ''}`, 70);
          }
        });
      }

      // === SIGNATURE / À PROPOS ===
      if (doc.y > 620) {
        doc.addPage();
        doc.y = 60;
      }

      doc.moveDown(2);
      
      // Encadré auteur
      doc.roundedRect(55, doc.y, 485, 80, 8)
         .fill('#f8fafc')
         .stroke('#e2e8f0');
      
      const authorBoxY = doc.y + 15;
      
      doc.fontSize(12)
         .fillColor('#1e293b')
         .text('À propos de l\'auteur', 75, authorBoxY);
      
      doc.fontSize(10)
         .fillColor('#475569')
         .text(`${article.author_name || 'Brian Biendou'} - Développeur & Entrepreneur Tech`, 75, authorBoxY + 18);
      
      doc.fontSize(9)
         .fillColor('#64748b')
         .text('Passionné par la technologie et l\'innovation. Suivez mon blog pour plus d\'articles sur le dev, l\'IA et l\'entrepreneuriat.', 75, authorBoxY + 35, { width: 435 });

      // === FOOTER ===
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        
        // Ligne de séparation footer
        doc.moveTo(60, 770)
           .lineTo(535, 770)
           .strokeColor('#e2e8f0')
           .lineWidth(1)
           .stroke();
        
        doc.fontSize(8)
           .fillColor('#94a3b8')
           .text(
             `Page ${i + 1} / ${pageCount}`,
             60,
             778
           );
        
        doc.fontSize(8)
           .fillColor('#64748b')
           .text(
             '🌐 www.brianbiendou.com',
             300,
             778,
             { align: 'center', width: 235 }
           );

        // Généré par Kiara
        if (i === pageCount - 1) {
          doc.fontSize(7)
             .fillColor('#94a3b8')
             .text(
               `📄 Généré par Kiara - Agent SEO BiendouCorp | ${new Date().toLocaleString('fr-FR')}`,
               60,
               790,
               { align: 'center', width: 475 }
             );
        }
      }

      doc.end();

      stream.on('finish', () => {
        console.log(`✅ PDF professionnel généré: ${filepath}`);
        resolve(filepath);
      });

      stream.on('error', reject);
    });
  }

  /**
   * Parse le Markdown pour le PDF
   */
  parseMarkdownForPdf(markdown) {
    if (!markdown) return [];
    
    const blocks = [];
    const lines = markdown.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;
      
      if (trimmedLine.startsWith('# ')) {
        blocks.push({ type: 'h1', text: trimmedLine.substring(2) });
      } else if (trimmedLine.startsWith('## ')) {
        blocks.push({ type: 'h2', text: trimmedLine.substring(3) });
      } else if (trimmedLine.startsWith('### ')) {
        blocks.push({ type: 'h3', text: trimmedLine.substring(4) });
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        blocks.push({ type: 'list', text: trimmedLine.substring(2) });
      } else if (trimmedLine.startsWith('```')) {
        // Skip code blocks delimiters
      } else if (trimmedLine.startsWith('    ') || trimmedLine.startsWith('\t')) {
        blocks.push({ type: 'code', text: trimmedLine.trim() });
      } else {
        // Nettoyer le markdown (gras, italique, liens)
        const cleanText = trimmedLine
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          .replace(/`(.*?)`/g, '$1');
        
        blocks.push({ type: 'paragraph', text: cleanText });
      }
    }
    
    return blocks;
  }

  // ============================================
  // RECHERCHE D'IMAGES LIBRES DE DROIT
  // ============================================

  async handleImageRequest(message) {
    console.log('🖼️ Kiara recherche des images...');
    
    // Extraire le terme de recherche
    const searchMatch = message.match(/(?:image|photo|illustration|visuel)s?\s+(?:de\s+|sur\s+|pour\s+)?["']?(.+?)["']?$/i);
    const searchTerm = searchMatch ? searchMatch[1].trim() : 'technology';
    
    const images = await this.searchFreeImages(searchTerm);
    
    if (images.length === 0) {
      return `❌ Aucune image trouvée pour "${searchTerm}".\n\nEssaie avec d'autres termes en anglais comme: "artificial intelligence", "coding", "technology"`;
    }

    let response = `🖼️ **Images libres de droit pour "${searchTerm}"**\n\n`;
    
    images.forEach((img, i) => {
      response += `${i + 1}. **${img.description || 'Image ' + (i + 1)}**\n`;
      response += `   📐 ${img.width}x${img.height}\n`;
      response += `   📸 Source: ${img.source}\n`;
      response += `   👤 Auteur: ${img.author}\n`;
      response += `   🔗 ${img.url}\n\n`;
    });

    response += `\n💡 Ces images sont libres de droit et peuvent être utilisées dans tes articles.`;
    
    return response;
  }

  /**
   * Recherche des images sur Unsplash et Pexels
   */
  async searchFreeImages(query, count = 5) {
    const images = [];
    
    // Essayer Unsplash d'abord
    if (this.imageAPIs.unsplash.accessKey) {
      try {
        const response = await axios.get(`${this.imageAPIs.unsplash.baseUrl}/search/photos`, {
          headers: { Authorization: `Client-ID ${this.imageAPIs.unsplash.accessKey}` },
          params: { query, per_page: count, orientation: 'landscape' }
        });
        
        response.data.results.forEach(img => {
          images.push({
            url: img.urls.regular,
            thumbnail: img.urls.thumb,
            description: img.alt_description || img.description,
            author: img.user.name,
            source: 'Unsplash',
            width: img.width,
            height: img.height,
            downloadUrl: img.urls.full
          });
        });
      } catch (error) {
        console.log('⚠️ Erreur Unsplash:', error.message);
      }
    }

    // Essayer Pexels ensuite
    if (this.imageAPIs.pexels.apiKey && images.length < count) {
      try {
        const response = await axios.get(`${this.imageAPIs.pexels.baseUrl}/search`, {
          headers: { Authorization: this.imageAPIs.pexels.apiKey },
          params: { query, per_page: count - images.length, orientation: 'landscape' }
        });
        
        response.data.photos.forEach(img => {
          images.push({
            url: img.src.large,
            thumbnail: img.src.tiny,
            description: img.alt || 'Image Pexels',
            author: img.photographer,
            source: 'Pexels',
            width: img.width,
            height: img.height,
            downloadUrl: img.src.original
          });
        });
      } catch (error) {
        console.log('⚠️ Erreur Pexels:', error.message);
      }
    }

    // Fallback: utiliser des images génériques
    if (images.length === 0) {
      console.log('ℹ️ Utilisation des images de fallback (pas de clés API configurées)');
      return [
        {
          url: `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`,
          description: `Image ${query}`,
          author: 'Unsplash Community',
          source: 'Unsplash (random)',
          width: 800,
          height: 600
        },
        {
          url: `https://source.unsplash.com/800x600/?${encodeURIComponent(query)},tech`,
          description: `Image ${query} tech`,
          author: 'Unsplash Community',
          source: 'Unsplash (random)',
          width: 800,
          height: 600
        },
        {
          url: `https://source.unsplash.com/800x600/?${encodeURIComponent(query)},modern`,
          description: `Image ${query} modern`,
          author: 'Unsplash Community',
          source: 'Unsplash (random)',
          width: 800,
          height: 600
        }
      ];
    }

    return images;
  }

  // ============================================
  // MODIFICATION D'ARTICLES
  // ============================================

  async handleModifyRequest(message) {
    console.log('✏️ Kiara modifie un article...');
    
    // Parser la demande de modification
    // Exemples: "modifie le titre de l'article X", "change le paragraphe 2 de l'article Y"
    
    const articleMatch = message.match(/(?:article|l'article)\s+["']?([^"']+?)["']?/i);
    
    if (!articleMatch) {
      return await this.listArticlesForModification();
    }

    const searchTerm = articleMatch[1].trim();
    
    // Chercher l'article
    const { data: posts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('*');

    if (error) {
      return `❌ Erreur: ${error.message}`;
    }

    const article = posts.find(p => 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!article) {
      return `❌ Article "${searchTerm}" non trouvé.`;
    }

    // Déterminer ce qu'il faut modifier
    const modifyTitleMatch = message.match(/titre\s+(?:par|en|avec)\s+["']?(.+?)["']?$/i);
    const modifyExcerptMatch = message.match(/(?:extrait|résumé)\s+(?:par|en|avec)\s+["']?(.+?)["']?$/i);
    const modifyCategoryMatch = message.match(/catégorie\s+(?:par|en|avec)\s+["']?(.+?)["']?$/i);
    const modifyContentMatch = message.match(/(?:contenu|texte|paragraphe)\s+["'](.+?)["']\s+(?:par|en|avec)\s+["'](.+?)["']/i);

    const updates = {};
    let modificationDone = false;

    if (modifyTitleMatch) {
      updates.title = modifyTitleMatch[1];
      updates.slug = this.generateSlug(modifyTitleMatch[1]);
      modificationDone = true;
    }

    if (modifyExcerptMatch) {
      updates.excerpt = modifyExcerptMatch[1];
      modificationDone = true;
    }

    if (modifyCategoryMatch) {
      updates.category = modifyCategoryMatch[1];
      modificationDone = true;
    }

    if (modifyContentMatch) {
      const oldText = modifyContentMatch[1];
      const newText = modifyContentMatch[2];
      updates.content = article.content.replace(oldText, newText);
      modificationDone = true;
    }

    if (!modificationDone) {
      // Demander plus de détails
      return `📝 **Article trouvé: ${article.title}**\n\nQue veux-tu modifier ?\n\n• **Titre:** "modifie le titre de l'article ${article.title} par 'Nouveau titre'"\n• **Extrait:** "modifie l'extrait de l'article ${article.title} par 'Nouveau résumé'"\n• **Catégorie:** "modifie la catégorie par 'Intelligence Artificielle'"\n• **Contenu:** "modifie le contenu 'ancien texte' par 'nouveau texte'"\n\n📄 **Extrait actuel:**\n${article.excerpt?.substring(0, 200)}...`;
    }

    // Appliquer les modifications
    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseService.supabase
      .from('blog_posts')
      .update(updates)
      .eq('id', article.id);

    if (updateError) {
      return `❌ Erreur lors de la modification: ${updateError.message}`;
    }

    let response = `✅ **Article modifié avec succès !**\n\n📝 **${article.title}**\n\n`;
    
    if (updates.title) response += `✏️ Nouveau titre: ${updates.title}\n`;
    if (updates.excerpt) response += `✏️ Nouvel extrait: ${updates.excerpt}\n`;
    if (updates.category) response += `✏️ Nouvelle catégorie: ${updates.category}\n`;
    if (updates.content) response += `✏️ Contenu modifié\n`;

    return response;
  }

  async listArticlesForModification() {
    const { data: posts, error } = await supabaseService.supabase
      .from('blog_posts')
      .select('title, slug, status, category')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error || !posts?.length) {
      return `❌ Aucun article disponible pour modification.`;
    }

    let response = `✏️ **Articles disponibles pour modification**\n\n`;
    posts.forEach((p, i) => {
      const status = p.status === 'published' ? '🟢' : '🟡';
      response += `${i + 1}. ${status} ${p.title}\n`;
      response += `   📂 ${p.category || 'Non catégorisé'}\n\n`;
    });

    response += `\n💡 **Exemples de modifications:**\n`;
    response += `• "Modifie le titre de l'article [titre] par 'Nouveau titre'"\n`;
    response += `• "Change la catégorie de [titre] par 'Intelligence Artificielle'"\n`;
    response += `• "Modifie le contenu 'ancien texte' par 'nouveau texte' dans l'article [titre]"`;

    return response;
  }

  // ============================================
  // WORKFLOW COMPLET (Recherche → Rédaction → PDF → Publication)
  // ============================================

  /**
   * Exécute un workflow complet en une seule commande
   * Ex: "recherche les 3 meilleurs articles sur les GPU, rédige un blog et publie-le"
   */
  async executeCompleteWorkflow(query, context = {}) {
    console.log('🚀 Kiara démarre le workflow complet...');
    
    const whatsappNumber = context.from || process.env.MY_PHONE_NUMBER;
    let progressMessages = [];
    
    try {
      // 1. ANALYSER LA DEMANDE
      progressMessages.push('🔍 **Étape 1/5:** Analyse de la demande...');
      
      const analysisPrompt = `Analyse cette demande et extrais les informations:
"${query}"

Réponds en JSON:
{
  "topic": "le sujet principal à rechercher",
  "articleCount": 3,
  "shouldPublish": true/false,
  "shouldSchedule": false,
  "scheduleDate": null,
  "language": "fr"
}`;

      let analysis;
      try {
        const analysisResponse = await openaiService.chat(this.systemPrompt, analysisPrompt, { json: true });
        analysis = JSON.parse(analysisResponse);
      } catch (e) {
        // Extraction manuelle du sujet
        const topicMatch = query.match(/(?:sur|about|concernant)\s+(?:les?\s+)?(?:\d+\s+)?(?:meilleurs?\s+)?(?:articles?\s+)?(?:sur\s+)?["']?(.+?)["']?(?:\s*,|\s+et\s+|\s+puis|\s*$)/i);
        analysis = {
          topic: topicMatch ? topicMatch[1].trim() : 'technologie',
          articleCount: 3,
          shouldPublish: query.toLowerCase().includes('publie') || query.toLowerCase().includes('poster'),
          shouldSchedule: query.toLowerCase().includes('programme'),
          scheduleDate: null
        };
      }

      console.log('📊 Analyse:', analysis);

      // 2. RECHERCHER LES SOURCES
      progressMessages.push(`🔍 **Étape 2/5:** Recherche des ${analysis.articleCount} meilleures sources sur "${analysis.topic}"...`);
      
      const sources = await this.searchSourcesForTopic(analysis.topic, analysis.articleCount);
      
      if (sources.length === 0) {
        return `❌ Je n'ai pas trouvé de sources sur "${analysis.topic}". Essaie avec un autre sujet.`;
      }

      progressMessages.push(`✅ ${sources.length} sources trouvées !`);

      // 3. GÉNÉRER L'ARTICLE FUSIONNÉ
      progressMessages.push('✍️ **Étape 3/5:** Rédaction de l\'article fusionné...');
      
      const article = await this.generateMergedArticle(analysis.topic, sources);
      
      if (!article) {
        return `❌ Erreur lors de la génération de l'article.`;
      }

      // Sauvegarder en brouillon
      const savedArticle = await this.saveArticleDraft(article);
      this.lastGeneratedArticle = { ...article, id: savedArticle?.id };

      progressMessages.push(`✅ Article "${article.title}" généré !`);

      // 4. GÉNÉRER LE PDF ET L'ENVOYER SUR WHATSAPP
      progressMessages.push('📄 **Étape 4/5:** Génération du PDF...');
      
      const pdfResult = await this.generateAndUploadPdf(
        { ...article, id: savedArticle?.id, sources },
        whatsappNumber
      );

      progressMessages.push('✅ PDF généré et envoyé sur WhatsApp !');

      // 5. PUBLIER (si demandé)
      let publishResult = '';
      if (analysis.shouldPublish) {
        progressMessages.push('📤 **Étape 5/5:** Publication sur le blog...');
        
        const { error: updateError } = await supabaseService.supabase
          .from('blog_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString()
          })
          .eq('id', savedArticle?.id);

        if (!updateError) {
          publishResult = '\n\n🌐 **Article publié sur le blog !**';
          progressMessages.push('✅ Article publié !');
        }
      } else {
        progressMessages.push('💾 Article sauvegardé en brouillon (non publié)');
      }

      // RÉSULTAT FINAL
      let finalResponse = `🎉 **Workflow terminé avec succès !**\n\n`;
      finalResponse += `📝 **Titre:** ${article.title}\n`;
      finalResponse += `📂 **Catégorie:** ${article.category}\n`;
      finalResponse += `⏱️ **Temps de lecture:** ${article.reading_time_minutes} min\n`;
      finalResponse += `🖼️ **Image:** ${article.cover_image ? 'Incluse' : 'Non'}\n\n`;
      
      finalResponse += `📰 **Sources utilisées (${sources.length}):**\n`;
      sources.forEach((s, i) => {
        finalResponse += `${i + 1}. ${s.title} (${s.source})\n`;
      });
      
      finalResponse += `\n📄 **PDF:** Envoyé sur WhatsApp ✅`;
      finalResponse += publishResult;
      
      finalResponse += `\n\n👉 **Actions:**\n`;
      finalResponse += `• "Modifie le titre par '...'" - Modifier\n`;
      if (!analysis.shouldPublish) {
        finalResponse += `• "Publie l'article" - Publier sur le blog`;
      }

      return finalResponse;

    } catch (error) {
      console.error('❌ Erreur workflow:', error);
      return `❌ Erreur lors du workflow: ${error.message}\n\nProgression:\n${progressMessages.join('\n')}`;
    }
  }

  /**
   * Recherche des sources sur un sujet spécifique
   */
  async searchSourcesForTopic(topic, count = 3) {
    const allSources = [];
    const searchKeywords = topic.toLowerCase().split(' ').filter(w => w.length > 3);
    
    console.log(`🔍 Recherche de sources sur: ${topic}`);

    // Chercher dans les flux RSS
    for (const source of this.trendSources) {
      try {
        const feed = await this.rssParser.parseURL(source.url);
        
        const matchingItems = feed.items.filter(item => {
          const text = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
          return searchKeywords.some(kw => text.includes(kw));
        });

        matchingItems.slice(0, 2).forEach(item => {
          allSources.push({
            title: item.title,
            description: item.contentSnippet || item.content || '',
            link: item.link,
            source: source.name,
            pubDate: item.pubDate
          });
        });
      } catch (error) {
        console.log(`⚠️ Erreur RSS ${source.name}`);
      }
    }

    // Si pas assez de sources, utiliser l'IA pour en générer
    if (allSources.length < count) {
      console.log('🤖 Génération de sources additionnelles via IA...');
      
      const aiSourcesPrompt = `Génère ${count - allSources.length} résumés d'articles fictifs mais réalistes sur le sujet "${topic}".

Réponds en JSON:
[
  {
    "title": "Titre accrocheur",
    "description": "Résumé de 2-3 phrases avec des faits et chiffres",
    "source": "TechCrunch/Verge/Wired",
    "link": "#"
  }
]`;

      try {
        const aiResponse = await openaiService.chat(this.systemPrompt, aiSourcesPrompt, { json: true });
        const aiSources = JSON.parse(aiResponse);
        allSources.push(...aiSources);
      } catch (e) {
        console.log('⚠️ Erreur génération sources IA');
      }
    }

    // Trier par date et limiter
    return allSources
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, count);
  }

  /**
   * Génère un article fusionné à partir de plusieurs sources
   */
  async generateMergedArticle(topic, sources) {
    const category = this.detectCategoryFromContent(topic);
    
    // Chercher une image
    const images = await this.searchFreeImages(topic, 1);
    const coverImage = images.length > 0 ? images[0] : null;

    const mergePrompt = `Tu es Kiara, experte SEO. Rédige un article de blog COMPLET et PROFESSIONNEL sur "${topic}".

📰 SOURCES À FUSIONNER ET CITER:
${sources.map((s, i) => `
Source ${i + 1}: ${s.title} (${s.source})
${s.description}
`).join('\n')}

📋 STRUCTURE REQUISE:

1. **Titre accrocheur** (optimisé SEO, mentionnant le sujet)
2. **Meta description** (150-160 caractères)
3. **Mots-clés** (5-8 mots-clés pertinents)
4. **Extrait** (2-3 phrases résumant l'article)
5. **Contenu principal** (1500+ mots) en Markdown avec:
   - Introduction captivante
   - 4-6 sections avec sous-titres (## et ###)
   - Synthèse des informations des sources
   - Exemples concrets et chiffres
   - Citations des sources (ex: "Selon TechCrunch...")
   - Listes à puces pour la lisibilité
   - Conclusion avec perspectives et call-to-action
6. **Section Sources** à la fin

IMPORTANT: 
- Fusionne intelligemment les informations des ${sources.length} sources
- Cite les sources dans le texte
- Ajoute ta propre analyse
- L'article doit être signé "Brian Biendou"

Réponds en JSON:
{
  "title": "...",
  "meta_description": "...",
  "keywords": ["..."],
  "excerpt": "...",
  "content": "# Titre\\n\\n## Introduction\\n...",
  "category": "${category}",
  "reading_time_minutes": 8,
  "tags": ["..."],
  "sources": ["Source 1", "Source 2"]
}`;

    try {
      const response = await openaiService.chat(this.systemPrompt, mergePrompt, { 
        json: true,
        maxTokens: 4000 
      });
      
      const article = JSON.parse(response);
      
      // Ajouter l'image et les sources
      if (coverImage) {
        article.cover_image = coverImage.url;
        article.cover_image_author = coverImage.author;
        article.cover_image_source = coverImage.source;
      }
      
      article.sources_used = sources.map(s => ({
        title: s.title,
        source: s.source,
        link: s.link
      }));

      return article;
    } catch (error) {
      console.error('Erreur génération article fusionné:', error);
      return null;
    }
  }

  // ============================================
  // CONVERSATION GÉNÉRALE
  // ============================================

  async chat(message) {
    const response = await openaiService.chat(this.systemPrompt, message);
    return response;
  }
}

module.exports = new KiaraAgent();
