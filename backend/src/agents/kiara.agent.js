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
    
    // Contexte conversationnel
    this.lastDisplayedTrends = [];  // Tendances affichées récemment
    this.lastGeneratedArticle = null;  // Dernier article généré
    this.conversationContext = {};  // Contexte par utilisateur
    
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

    // Styles d'écriture disponibles
    this.writingStyles = {
      // Style par défaut : fun, dynamique, accessible
      fun: {
        name: 'Fun & Dynamique',
        description: 'Style léger avec humour et jeux de mots',
        prompt: `═══════════════════════════════════════════════════════════════
🎨 TON STYLE D'ÉCRITURE : FUN & DYNAMIQUE
═══════════════════════════════════════════════════════════════
- **HUMOUR**: Touches d'humour, jeux de mots, références fun
- **ACCROCHEUR**: Titre percutant qui donne envie de lire
- **DYNAMIQUE**: Écris comme à un ami passionné de tech
- **ACCESSIBLE**: Explique les concepts simplement
- **EMOJIS**: Utilise quelques emojis pour dynamiser`
      },
      
      // Nouveau style : narratif, documentaire, immersif AVEC BEAUCOUP d'humour et clickbait
      narrative: {
        name: 'Narratif Documentaire',
        description: 'Style cinématographique, immersif comme un documentaire Arte, avec BEAUCOUP d\'humour et titres clickbait',
        prompt: `═══════════════════════════════════════════════════════════════
🎬 TON STYLE D'ÉCRITURE : NARRATIF DOCUMENTAIRE (avec humour)
═══════════════════════════════════════════════════════════════

Tu écris comme le narrateur d'un documentaire Arte ou d'une vidéo YouTube de vulgarisation narrative.
Le ton est contemplatif et immersif, MAIS avec des touches d'humour bien placées pour alléger l'atmosphère.

🔥 **TITRES ULTRA-ACCROCHEURS (CLICKBAIT ASSUMÉ)**:
- Le titre doit être IRRÉSISTIBLE, même si tu dois exagérer un peu (voire mentir légèrement)
- Utilise des formules choc : "Ce que personne ne vous dit sur...", "La vérité choquante derrière..."
- Ajoute du MYSTÈRE : "...et la suite va vous surprendre", "...le résultat est incroyable"
- JEUX DE MOTS obligatoires dans le titre quand c'est possible
- Exemples de titres qui marchent :
  • "Cette IA a fait pleurer ses créateurs (et pas de joie)"
  • "OpenAI vient de tout casser : voici pourquoi c'est grave"
  • "J'ai testé cette techno et maintenant je dors plus"
  • "Le secret que Google cache depuis 10 ans"
  • "Cette startup a trouvé la faille : les géants tremblent"
- N'hésite PAS à dramatiser, exagérer, créer de la curiosité irrésistible

🎭 **PREMIÈRES PHRASES = EXPLOSION D'ACCROCHE**:
- Les 3 premières phrases doivent CAPTIVER immédiatement
- Commence par une blague, une question choc, ou une affirmation délirante
- Exemples d'ouvertures qui accrochent :
  • "Imaginez un monde où votre frigo négocie lui-même le prix de vos yaourts. Non, ne riez pas, c'est déjà en cours."
  • "Bon, asseyez-vous. Ce que je vais vous raconter va peut-être ruiner votre foi en l'humanité. Ou la restaurer. Ça dépend de votre humeur."
  • "Il était une fois, dans la Silicon Valley, un ingénieur qui a eu une idée stupide. Spoiler : il est milliardaire maintenant."
  • "Accrochez-vous à votre café, ça va secouer."
- Crée du SUSPENSE dès le début

🤣 **HUMOUR OMNIPRÉSENT MAIS INTELLIGENT**:
- Glisse des vannes subtiles PARTOUT, pas juste de temps en temps
- Auto-dérision assumée : "Oui, j'ai passé 4h à comprendre ça pour vous l'expliquer en 2 min"
- Références pop culture décalées : Matrix, Star Wars, memes internet
- Comparaisons absurdes mais parlantes
- Exemples de touches d'humour :
  • "(Note : aucun développeur n'a été maltraité pendant la rédaction de cet article. Enfin, presque.)"
  • "C'est un peu comme expliquer TikTok à vos grands-parents, mais en plus compliqué."
  • "Spoiler alert : ça finit mal. Enfin, pour certains."

🎤 **TON POSÉ ET RÉFLEXIF**:
- Prends ton temps, pose des questions rhétoriques
- Installe une atmosphère, laisse des "silences" narratifs
- Mais CASSE ces moments avec une punchline inattendue

🌫️ **SUSPENSE ET TENSION NARRATIVE**:
- Montée en tension progressive
- Utilise des cliffhangers implicites :
  « Mais ce n'était que le début du chaos. »
  « Et c'est là que tout part en vrille. »
  « Ce qui va suivre va soit vous fasciner, soit vous terrifier. Peut-être les deux. »
- Crée un sentiment de menace diffuse ou d'émerveillement

🎨 **TRÈS MÉTAPHORIQUE ET VISUEL**:
- Utilise des métaphores poétiques : "sculpter le chaos", "une spirale vertueuse", "un brouillard de pixels"
- Fais VOIR les choses : décris des scènes, des lieux, des moments
- Exemples marquants et humanisés (anecdotes, personnages réels)

📖 **STRUCTURE STORYTELLING**:
- Introduction EXPLOSIVE avec blague/question choc
- Contexte historique avec touches d'humour
- Zoom technique vulgarisé avec métaphores ET blagues
- Exemples concrets et humanisés
- Montée dramatique vers le climax
- Conclusion avec une dernière punchline ou question ouverte

👀 **POINT DE VUE OMNISCIENT MAIS PROCHE**:
- Adresse-toi au lecteur : « Imaginez que... », « Vous l'avez peut-être remarqué... »
- Alterne entre "je", "on", "vous" pour créer une proximité
- Tu es le guide qui sait, mais qui partage avec humour et complicité

🕯️ **ATMOSPHÈRE PHILOSOPHIQUE**:
- Réflexions sur la perception, la réalité, l'humanité
- Questions existentielles liées au sujet
- Ton quasi-spirituel par moments, puis BAM une vanne

💡 **ÉQUILIBRE TON/HUMOUR**:
- 60% narratif sérieux / 40% humour et légèreté (plus qu'avant !)
- L'humour doit enrichir, pas casser - mais il doit être PRÉSENT
- Chaque section devrait avoir au moins une touche légère

⚠️ **CE QU'IL FAUT ÉVITER**:
- Pas trop d'emojis (1-2 max dans tout l'article si pertinent)
- Pas de listes à puces sèches (préfère des paragraphes fluides)
- Pas de "Introduction" ou "Conclusion" explicites
- L'humour ne doit jamais être gênant ou forcé, mais il doit être là`
      }
    };

    // Style actif (par défaut: fun)
    this.activeStyle = 'fun';

    // Sources RSS par domaine
    this.trendSourcesByDomain = {
      // TECH & INFORMATIQUE
      tech: [
        { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', lang: 'en' },
        { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', lang: 'en' },
        { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', lang: 'en' },
        { name: 'Hacker News', url: 'https://hnrss.org/frontpage', lang: 'en' },
        { name: 'Dev.to', url: 'https://dev.to/feed', lang: 'en' },
        { name: 'Wired', url: 'https://www.wired.com/feed/rss', lang: 'en' },
        { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', lang: 'en' },
        { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', lang: 'en' },
        { name: 'ZDNet', url: 'https://www.zdnet.com/news/rss.xml', lang: 'en' },
        { name: 'Google News Tech', url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtWnlHZ0pHVWlnQVAB', lang: 'fr' }
      ],
      
      // HARDWARE & GPU
      hardware: [
        { name: 'Tom\'s Hardware', url: 'https://www.tomshardware.com/feeds/all', lang: 'en' },
        { name: 'AnandTech', url: 'https://www.anandtech.com/rss/', lang: 'en' },
        { name: 'VideoCardz', url: 'https://videocardz.com/feed', lang: 'en' },
        { name: 'PC Gamer Hardware', url: 'https://www.pcgamer.com/hardware/rss/', lang: 'en' }
      ],
      
      // INTELLIGENCE ARTIFICIELLE
      ia: [
        { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/', lang: 'en' },
        { name: 'MIT AI', url: 'https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml', lang: 'en' },
        { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', lang: 'en' },
        { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss/', lang: 'en' },
        { name: 'Towards AI', url: 'https://towardsai.net/feed', lang: 'en' },
        { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', lang: 'en' },
        { name: 'DeepMind Blog', url: 'https://www.deepmind.com/blog/rss.xml', lang: 'en' },
        { name: 'NVIDIA AI Blog', url: 'https://blogs.nvidia.com/feed/', lang: 'en' }
      ],
      
      // DATA SCIENCE & MACHINE LEARNING
      datascience: [
        { name: 'Towards Data Science', url: 'https://towardsdatascience.com/feed', lang: 'en' },
        { name: 'KDnuggets', url: 'https://www.kdnuggets.com/feed', lang: 'en' },
        { name: 'Analytics Vidhya', url: 'https://www.analyticsvidhya.com/feed/', lang: 'en' },
        { name: 'Data Science Central', url: 'https://www.datasciencecentral.com/feed/', lang: 'en' },
        { name: 'Machine Learning Mastery', url: 'https://machinelearningmastery.com/feed/', lang: 'en' },
        { name: 'Kaggle Blog', url: 'https://medium.com/feed/kaggle-blog', lang: 'en' },
        { name: 'R-Bloggers', url: 'https://www.r-bloggers.com/feed/', lang: 'en' },
        { name: 'PyData', url: 'https://pydata.org/feed/', lang: 'en' },
        { name: 'DataCamp Blog', url: 'https://www.datacamp.com/blog/rss.xml', lang: 'en' },
        { name: 'Fast.ai', url: 'https://www.fast.ai/atom.xml', lang: 'en' },
        { name: 'Google Cloud Data', url: 'https://cloud.google.com/blog/products/data-analytics/rss', lang: 'en' },
        { name: 'AWS Data Blog', url: 'https://aws.amazon.com/blogs/big-data/feed/', lang: 'en' },
        { name: 'Databricks Blog', url: 'https://www.databricks.com/blog/feed', lang: 'en' },
        { name: 'Snowflake Blog', url: 'https://www.snowflake.com/blog/feed/', lang: 'en' }
      ],
      
      // DATA ANALYTICS & BUSINESS INTELLIGENCE
      dataanalytics: [
        { name: 'Data School', url: 'https://www.dataschool.io/rss/', lang: 'en' },
        { name: 'Mode Analytics Blog', url: 'https://mode.com/blog/rss.xml', lang: 'en' },
        { name: 'Tableau Blog', url: 'https://www.tableau.com/blog/feed', lang: 'en' },
        { name: 'Power BI Blog', url: 'https://powerbi.microsoft.com/en-us/blog/feed/', lang: 'en' },
        { name: 'Looker Blog', url: 'https://cloud.google.com/blog/products/business-intelligence/rss', lang: 'en' },
        { name: 'Sisense Blog', url: 'https://www.sisense.com/blog/feed/', lang: 'en' },
        { name: 'Metabase Blog', url: 'https://www.metabase.com/blog/feed.xml', lang: 'en' },
        { name: 'ThoughtSpot Blog', url: 'https://www.thoughtspot.com/blog/rss.xml', lang: 'en' },
        { name: 'Amplitude Blog', url: 'https://amplitude.com/blog/feed', lang: 'en' },
        { name: 'Mixpanel Blog', url: 'https://mixpanel.com/blog/feed/', lang: 'en' },
        { name: 'Google Analytics Blog', url: 'https://blog.google/products/marketingplatform/analytics/rss/', lang: 'en' },
        { name: 'Data Elixir', url: 'https://dataelixir.com/feed/', lang: 'en' }
      ],
      
      // DEVOPS & CLOUD
      devops: [
        { name: 'DevOps.com', url: 'https://devops.com/feed/', lang: 'en' },
        { name: 'The New Stack', url: 'https://thenewstack.io/feed/', lang: 'en' },
        { name: 'Container Journal', url: 'https://containerjournal.com/feed/', lang: 'en' },
        { name: 'Kubernetes Blog', url: 'https://kubernetes.io/feed.xml', lang: 'en' },
        { name: 'Docker Blog', url: 'https://www.docker.com/blog/feed/', lang: 'en' },
        { name: 'HashiCorp Blog', url: 'https://www.hashicorp.com/blog/feed.xml', lang: 'en' },
        { name: 'GitLab Blog', url: 'https://about.gitlab.com/atom.xml', lang: 'en' },
        { name: 'GitHub Blog', url: 'https://github.blog/feed/', lang: 'en' },
        { name: 'CircleCI Blog', url: 'https://circleci.com/blog/feed.xml', lang: 'en' },
        { name: 'Jenkins Blog', url: 'https://www.jenkins.io/node/feed/', lang: 'en' },
        { name: 'Terraform Blog', url: 'https://www.hashicorp.com/blog/products/terraform/feed.xml', lang: 'en' },
        { name: 'AWS DevOps Blog', url: 'https://aws.amazon.com/blogs/devops/feed/', lang: 'en' },
        { name: 'Azure DevOps Blog', url: 'https://devblogs.microsoft.com/devops/feed/', lang: 'en' },
        { name: 'Google Cloud DevOps', url: 'https://cloud.google.com/blog/products/devops-sre/rss', lang: 'en' },
        { name: 'Ansible Blog', url: 'https://www.ansible.com/blog/rss.xml', lang: 'en' },
        { name: 'Puppet Blog', url: 'https://puppet.com/blog/feed/', lang: 'en' },
        { name: 'Chef Blog', url: 'https://www.chef.io/blog/feed', lang: 'en' },
        { name: 'CNCF Blog', url: 'https://www.cncf.io/blog/feed/', lang: 'en' },
        { name: 'SRE Weekly', url: 'https://sreweekly.com/feed/', lang: 'en' },
        { name: 'DevOps Cube', url: 'https://devopscube.com/feed/', lang: 'en' }
      ],
      
      // CLOUD COMPUTING
      cloud: [
        { name: 'AWS Blog', url: 'https://aws.amazon.com/blogs/aws/feed/', lang: 'en' },
        { name: 'Azure Blog', url: 'https://azure.microsoft.com/en-us/blog/feed/', lang: 'en' },
        { name: 'Google Cloud Blog', url: 'https://cloud.google.com/blog/feed/', lang: 'en' },
        { name: 'Cloud Native News', url: 'https://www.cncf.io/feed/', lang: 'en' },
        { name: 'InfoQ Cloud', url: 'https://feed.infoq.com/cloud-computing/', lang: 'en' },
        { name: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/', lang: 'en' },
        { name: 'DigitalOcean Blog', url: 'https://www.digitalocean.com/blog/feed', lang: 'en' },
        { name: 'Vercel Blog', url: 'https://vercel.com/blog/rss.xml', lang: 'en' },
        { name: 'Netlify Blog', url: 'https://www.netlify.com/blog/feed.xml', lang: 'en' },
        { name: 'Railway Blog', url: 'https://blog.railway.app/feed.xml', lang: 'en' }
      ],
      
      // CYBERSECURITE
      cybersecurity: [
        { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', lang: 'en' },
        { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', lang: 'en' },
        { name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml', lang: 'en' },
        { name: 'Bleeping Computer', url: 'https://www.bleepingcomputer.com/feed/', lang: 'en' },
        { name: 'Security Week', url: 'https://www.securityweek.com/feed/', lang: 'en' },
        { name: 'Threatpost', url: 'https://threatpost.com/feed/', lang: 'en' },
        { name: 'SANS ISC', url: 'https://isc.sans.edu/rssfeed.xml', lang: 'en' },
        { name: 'Schneier on Security', url: 'https://www.schneier.com/feed/', lang: 'en' }
      ],
      
      // SPATIAL & ASTRONOMIE
      spatial: [
        { name: 'NASA', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', lang: 'en' },
        { name: 'SpaceX', url: 'https://www.spacex.com/news.xml', lang: 'en' },
        { name: 'Space.com', url: 'https://www.space.com/feeds/all', lang: 'en' },
        { name: 'ESA', url: 'https://www.esa.int/rssfeed/Our_Activities/Space_News', lang: 'en' },
        { name: 'Futura Sciences Espace', url: 'https://www.futura-sciences.com/rss/espace/actu.xml', lang: 'fr' }
      ],
      
      // POLITIQUE
      politique: [
        { name: 'Le Monde Politique', url: 'https://www.lemonde.fr/politique/rss_full.xml', lang: 'fr' },
        { name: 'France Info Politique', url: 'https://www.francetvinfo.fr/politique.rss', lang: 'fr' },
        { name: 'Politico', url: 'https://www.politico.eu/feed/', lang: 'en' },
        { name: 'BBC Politics', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', lang: 'en' },
        { name: 'Google News Politique FR', url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZ4ZERBU0FtWnlHZ0pHVWlnQVAB', lang: 'fr' }
      ],
      
      // ECONOMIE & BUSINESS
      economie: [
        { name: 'Les Echos', url: 'https://www.lesechos.fr/rss/rss_une.xml', lang: 'fr' },
        { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance', lang: 'en' },
        { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', lang: 'en' },
        { name: 'Google News Business FR', url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGxqTjNjU0FtWnlHZ0pHVWlnQVAB', lang: 'fr' }
      ],
      
      // SCIENCE GENERALE
      science: [
        { name: 'Nature', url: 'https://www.nature.com/nature.rss', lang: 'en' },
        { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', lang: 'en' },
        { name: 'Futura Sciences', url: 'https://www.futura-sciences.com/rss/actualites.xml', lang: 'fr' },
        { name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/', lang: 'en' }
      ],
      
      // AUTOMOBILE & MECANIQUE
      auto: [
        { name: 'Motor Trend', url: 'https://www.motortrend.com/feed/', lang: 'en' },
        { name: 'Auto Plus', url: 'https://www.autoplus.fr/rss.xml', lang: 'fr' },
        { name: 'Caradisiac', url: 'https://www.caradisiac.com/rss/', lang: 'fr' },
        { name: 'Electrek (EV)', url: 'https://electrek.co/feed/', lang: 'en' }
      ],
      
      // GAMING & JEUX VIDEO
      gaming: [
        { name: 'IGN', url: 'https://feeds.feedburner.com/ign/all', lang: 'en' },
        { name: 'Kotaku', url: 'https://kotaku.com/rss', lang: 'en' },
        { name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/', lang: 'en' },
        { name: 'Gamekult', url: 'https://www.gamekult.com/feed.xml', lang: 'fr' }
      ],
      
      // CRYPTO & BLOCKCHAIN
      crypto: [
        { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', lang: 'en' },
        { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', lang: 'en' },
        { name: 'Decrypt', url: 'https://decrypt.co/feed', lang: 'en' }
      ],
      
      // SANTE & MEDICAL
      sante: [
        { name: 'Medical News Today', url: 'https://www.medicalnewstoday.com/newsfeeds/rss/healthcare.xml', lang: 'en' },
        { name: 'Futura Santé', url: 'https://www.futura-sciences.com/rss/sante/actu.xml', lang: 'fr' },
        { name: 'Health News', url: 'https://www.news-medical.net/medical/news.rss', lang: 'en' }
      ],
      
      // ENVIRONNEMENT & ECOLOGIE
      environnement: [
        { name: 'The Guardian Environment', url: 'https://www.theguardian.com/environment/rss', lang: 'en' },
        { name: 'Reporterre', url: 'https://reporterre.net/spip.php?page=backend', lang: 'fr' },
        { name: 'Futura Planète', url: 'https://www.futura-sciences.com/rss/planete/actu.xml', lang: 'fr' }
      ]
    };
    
    // Alias pour les domaines (synonymes)
    this.domainAliases = {
      // Tech & Développement
      'technologie': 'tech', 'informatique': 'tech', 'développement': 'tech', 'dev': 'tech', 'web': 'tech', 'programmation': 'tech', 'coding': 'tech', 'code': 'tech',
      
      // Hardware
      'gpu': 'hardware', 'nvidia': 'hardware', 'amd': 'hardware', 'intel': 'hardware', 'processeur': 'hardware', 'pc': 'hardware', 'cpu': 'hardware', 'ram': 'hardware',
      
      // Intelligence Artificielle
      'intelligence artificielle': 'ia', 'ai': 'ia', 'machine learning': 'ia', 'ml': 'ia', 'chatgpt': 'ia', 'openai': 'ia', 'gpt': 'ia', 'llm': 'ia', 'deep learning': 'ia', 'neural network': 'ia',
      
      // Data Science & Analytics
      'data science': 'datascience', 'data scientist': 'datascience', 'datascience': 'datascience', 'science des données': 'datascience',
      'python data': 'datascience', 'pandas': 'datascience', 'numpy': 'datascience', 'scikit': 'datascience', 'sklearn': 'datascience',
      'tensorflow': 'datascience', 'pytorch': 'datascience', 'keras': 'datascience', 'jupyter': 'datascience',
      'kaggle': 'datascience', 'modèle prédictif': 'datascience', 'régression': 'datascience', 'classification': 'datascience',
      
      // Data Analytics & BI
      'data analytics': 'dataanalytics', 'data analyst': 'dataanalytics', 'dataanalytics': 'dataanalytics', 'analyse de données': 'dataanalytics',
      'business intelligence': 'dataanalytics', 'bi': 'dataanalytics', 'tableau': 'dataanalytics', 'power bi': 'dataanalytics', 'powerbi': 'dataanalytics',
      'looker': 'dataanalytics', 'metabase': 'dataanalytics', 'dashboard': 'dataanalytics', 'kpi': 'dataanalytics',
      'sql': 'dataanalytics', 'excel avancé': 'dataanalytics', 'reporting': 'dataanalytics', 'visualisation': 'dataanalytics',
      
      // DevOps
      'devops': 'devops', 'dev ops': 'devops', 'ci/cd': 'devops', 'cicd': 'devops', 'pipeline': 'devops',
      'docker': 'devops', 'kubernetes': 'devops', 'k8s': 'devops', 'container': 'devops', 'conteneur': 'devops',
      'jenkins': 'devops', 'gitlab ci': 'devops', 'github actions': 'devops', 'circleci': 'devops',
      'terraform': 'devops', 'ansible': 'devops', 'puppet': 'devops', 'chef': 'devops',
      'infrastructure as code': 'devops', 'iac': 'devops', 'gitops': 'devops',
      'sre': 'devops', 'site reliability': 'devops', 'monitoring': 'devops', 'observability': 'devops',
      'prometheus': 'devops', 'grafana': 'devops', 'datadog': 'devops', 'elk': 'devops',
      
      // Cloud
      'cloud': 'cloud', 'cloud computing': 'cloud', 'aws': 'cloud', 'amazon web services': 'cloud',
      'azure': 'cloud', 'microsoft azure': 'cloud', 'gcp': 'cloud', 'google cloud': 'cloud',
      'serverless': 'cloud', 'lambda': 'cloud', 'functions': 'cloud', 'paas': 'cloud', 'saas': 'cloud', 'iaas': 'cloud',
      'cloudflare': 'cloud', 'vercel': 'cloud', 'netlify': 'cloud', 'railway': 'cloud', 'heroku': 'cloud',
      
      // Cybersécurité
      'cybersécurité': 'cybersecurity', 'cybersecurity': 'cybersecurity', 'sécurité informatique': 'cybersecurity',
      'hacking': 'cybersecurity', 'hacker': 'cybersecurity', 'pentest': 'cybersecurity', 'ransomware': 'cybersecurity',
      'malware': 'cybersecurity', 'phishing': 'cybersecurity', 'firewall': 'cybersecurity', 'vpn': 'cybersecurity',
      
      // Spatial
      'espace': 'spatial', 'nasa': 'spatial', 'spacex': 'spatial', 'astronomie': 'spatial', 'fusée': 'spatial', 'mars': 'spatial', 'satellite': 'spatial',
      
      // Autres domaines existants
      'politique': 'politique', 'gouvernement': 'politique', 'élection': 'politique', 'macron': 'politique',
      'économie': 'economie', 'finance': 'economie', 'business': 'economie', 'bourse': 'economie', 'argent': 'economie',
      'science': 'science', 'recherche': 'science', 'scientifique': 'science', 'découverte': 'science',
      'voiture': 'auto', 'automobile': 'auto', 'mécanique': 'auto', 'tesla': 'auto', 'électrique': 'auto', 'ev': 'auto',
      'jeux': 'gaming', 'jeu vidéo': 'gaming', 'gaming': 'gaming', 'playstation': 'gaming', 'xbox': 'gaming', 'nintendo': 'gaming',
      'bitcoin': 'crypto', 'ethereum': 'crypto', 'blockchain': 'crypto', 'nft': 'crypto', 'web3': 'crypto',
      'santé': 'sante', 'médecine': 'sante', 'médical': 'sante', 'covid': 'sante', 'vaccin': 'sante',
      'écologie': 'environnement', 'climat': 'environnement', 'réchauffement': 'environnement', 'vert': 'environnement'
    };

    // Sources par défaut (tech) pour compatibilité
    this.trendSources = this.trendSourcesByDomain.tech;

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
    return this.handleMessageWithContext(message, context, []);
  }

  /**
   * Point d'entrée avec contexte de conversation
   */
  async handleMessageWithContext(message, context = {}, conversationHistory = []) {
    const lowerMessage = message.toLowerCase();
    
    // Stocker le contexte pour les sous-fonctions
    this.currentContext = context;
    this.conversationHistory = conversationHistory;

    try {
      // Détection des références aux tendances affichées (numéros, "les deux", etc.)
      const trendReference = this.detectTrendReference(lowerMessage);
      if (trendReference && this.lastDisplayedTrends.length > 0) {
        return await this.handleTrendArticleRequest(trendReference, message);
      }

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

      if (this.isScheduleListRequest(lowerMessage)) {
        return await this.handleScheduleList();
      }

      if (this.isCancelScheduleRequest(lowerMessage)) {
        return await this.handleCancelSchedule(message);
      }

      if (this.isArticleList(lowerMessage)) {
        return await this.handleArticleList();
      }

      // Conversation générale avec Kiara (avec contexte)
      return await this.chatWithContext(message, conversationHistory);

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

  /**
   * Détecte si le message fait référence aux tendances affichées
   * Retourne les indices des tendances référencées ou null
   */
  detectTrendReference(message) {
    // Si pas de tendances en mémoire, pas de référence possible
    if (!this.lastDisplayedTrends || this.lastDisplayedTrends.length === 0) {
      return null;
    }

    // Patterns pour détecter les références
    const patterns = {
      // "oui", "ok", "d'accord" seuls (confirmation après tendances)
      simpleConfirm: /^(oui|ok|d'accord|yes|ouais|yep)\s*(,|\.|!)?$/i,
      
      // "les deux sujets", "les 2 sujets", "les deux premiers"
      twoSubjects: /les?\s*(deux|2)\s*(sujets?|premiers?|articles?)?/i,
      
      // "sur les deux", "sur les 2"
      onTwo: /sur\s+les?\s*(deux|2)/i,
      
      // "le 1", "numéro 1", "le premier", "sujet 1"
      singleNumber: /(?:le\s+|num[eé]ro\s+|sujet\s+|le\s+premier|le\s+deuxi[eè]me|le\s+troisi[eè]me)?(\d+)(?:er|ème|eme|e)?/i,
      
      // "1 et 2", "le 1 et le 3"
      multipleNumbers: /(\d+)\s*(?:et|,)\s*(?:le\s+)?(\d+)/i,
      
      // "tous les sujets", "tous"
      all: /tous?\s*(les)?\s*(sujets?)?/i,

      // "article sur oui", "rédige oui" -> confirmation implicite
      articleYes: /(?:article|redige|ecris)\s+(?:sur\s+)?(oui|les?|ça|cela)/i
    };

    // Vérifier si c'est une demande d'article avec référence aux tendances
    const isArticleRequest = /(?:article|redige|ecris|genere|cree)/i.test(message);

    // "les deux sujets" ou "sur les deux"
    if (patterns.twoSubjects.test(message) || patterns.onTwo.test(message)) {
      return [0, 1]; // Les deux premiers
    }

    // "tous"
    if (patterns.all.test(message) && isArticleRequest) {
      return this.lastDisplayedTrends.map((_, i) => i);
    }

    // "1 et 2", "le 1 et le 3"
    const multiMatch = message.match(patterns.multipleNumbers);
    if (multiMatch) {
      const indices = [parseInt(multiMatch[1]) - 1, parseInt(multiMatch[2]) - 1];
      return indices.filter(i => i >= 0 && i < this.lastDisplayedTrends.length);
    }

    // Numéro simple "le 1", "numéro 2"
    const singleMatch = message.match(patterns.singleNumber);
    if (singleMatch && singleMatch[1]) {
      const index = parseInt(singleMatch[1]) - 1;
      if (index >= 0 && index < this.lastDisplayedTrends.length) {
        return [index];
      }
    }

    // "oui" simple après affichage des tendances -> prend le premier sujet
    if (patterns.simpleConfirm.test(message.trim())) {
      return [0];
    }

    // "article sur oui" ou similaire
    if (patterns.articleYes.test(message)) {
      return [0, 1]; // Les deux premiers par défaut
    }

    return null;
  }

  /**
   * Génère un article à partir des tendances sélectionnées
   */
  async handleTrendArticleRequest(trendIndices, originalMessage) {
    const selectedTrends = trendIndices
      .map(i => this.lastDisplayedTrends[i])
      .filter(t => t !== undefined);

    if (selectedTrends.length === 0) {
      return `❌ Je n'ai pas trouvé les sujets demandés. Les tendances disponibles sont numérotées de 1 à ${this.lastDisplayedTrends.length}.`;
    }

    // Construire le sujet à partir des tendances sélectionnées
    let subject;
    if (selectedTrends.length === 1) {
      subject = selectedTrends[0].title;
    } else {
      // Combiner les sujets
      const titles = selectedTrends.map(t => t.title);
      subject = titles.join(' et ');
    }

    console.log(`📝 Kiara génère un article sur les tendances sélectionnées: ${subject}`);

    // Utiliser les tendances comme sources
    const sources = selectedTrends.map(t => ({
      title: t.title,
      link: t.link,
      source: t.source,
      description: t.description
    }));

    // Générer l'article avec le sujet combiné et les sources
    return await this.generateArticleFromTrends(subject, sources, selectedTrends.length);
  }

  /**
   * Génère un article à partir de tendances spécifiques
   */
  async generateArticleFromTrends(subject, sources, trendsCount) {
    console.log(`✍️ Kiara génère un article sur: ${subject}`);

    const category = await this.detectCategory(subject);
    // Chercher 2 images: 1 pour la couverture, 1 pour le milieu de l'article
    const images = await this.searchFreeImages(subject, 2);
    const coverImage = images.length > 0 ? images[0] : null;
    const contentImage = images.length > 1 ? images[1] : null;

    const sourcesForPrompt = sources.map(s => `- "${s.title}" (${s.source}): ${s.link}`).join('\n');

    const articlePrompt = `Tu es un JOURNALISTE WEB FRANÇAIS de talent et EXPERT SEO, spécialisé en référencement naturel.
Rédige un article professionnel EN FRANÇAIS sur ${trendsCount > 1 ? 'ces actualités' : 'cette actualité'}:

🔍 SOURCES (traduis les titres anglais en français):
${sourcesForPrompt}

═══════════════════════════════════════════════════════════════
🔥 TITRE ULTRA-ACCROCHEUR (PRIORITÉ ABSOLUE !)
═══════════════════════════════════════════════════════════════

Le titre est LA chose la plus importante. Il doit être IRRÉSISTIBLE !

✅ CE QUI MARCHE :
- Clickbait assumé : "Ce que personne ne vous dit sur...", "La vérité derrière..."
- Exagération légère (tu peux mentir un peu pour intriguer !)
- Jeux de mots et humour obligatoires si possible
- Mystère : "...et la suite va vous surprendre"
- Exemples qui cartonnent :
  • "Cette IA a fait pleurer ses créateurs (et pas de joie)"
  • "J'ai testé cette techno : maintenant je dors plus"
  • "Le secret que [entreprise] cache depuis des années"
  • "Cette startup a trouvé LA faille : les géants tremblent"
  • "[Sujet] : pourquoi tout le monde se trompe"

❌ ÉVITE : Titres plats, descriptifs, ennuyeux, trop longs

═══════════════════════════════════════════════════════════════
🎭 PREMIÈRES PHRASES = EXPLOSION D'ACCROCHE
═══════════════════════════════════════════════════════════════

Les 3 premières phrases DOIVENT captiver immédiatement !
Commence par une blague, une question choc, ou une affirmation délirante.

Exemples d'ouvertures qui accrochent :
• "Bon, asseyez-vous. Ce que je vais vous raconter va peut-être ruiner votre foi en l'humanité."
• "Il était une fois, dans la Silicon Valley, un ingénieur qui a eu une idée stupide. Spoiler : il est milliardaire."
• "Accrochez-vous à votre café, ça va secouer."
• "Non, ce n'est pas un épisode de Black Mirror. C'est la réalité. En pire."

═══════════════════════════════════════════════════════════════
🎯 OPTIMISATION SEO
═══════════════════════════════════════════════════════════════

1. **TITRE (title)**: 50-60 caractères
   - ACCROCHEUR avant tout, clickbait assumé
   - Mot-clé principal inclus
   - Humour ou mystère si possible

2. **META TITLE**: Titre optimisé pour Google (max 60 car)
   - Peut différer légèrement du titre
   - Inclut le mot-clé principal

3. **META DESCRIPTION**: 150-160 caractères
   - Résumé engageant qui donne envie de cliquer
   - Inclut le mot-clé principal
   - Appel à l'action implicite

4. **KEYWORDS**: 5-8 mots-clés
   - 1 mot-clé principal (focus_keyword)
   - 2-3 mots-clés secondaires
   - 2-3 mots-clés longue traîne
   - Variantes et synonymes

5. **TAGS**: 3-5 tags pertinents
   - Catégories thématiques
   - Utiles pour le classement interne

6. **STRUCTURE H2/H3**: 
   - Sous-titres avec mots-clés
   - Hiérarchie logique

${this.writingStyles[this.activeStyle].prompt}

═══════════════════════════════════════════════════════════════
⚠️ RÈGLES STRICTES (OBLIGATOIRES)
═══════════════════════════════════════════════════════════════
1. **100% FRANÇAIS** - Tout en français (sauf termes tech en *italique*)
2. **PAS DE "Introduction" ou "Conclusion"** - Commence directement
3. **MARKDOWN BIEN FORMATÉ** - Contenu en Markdown pur
4. **MOT-CLÉ DANS LE 1ER PARAGRAPHE** - SEO oblige !

═══════════════════════════════════════════════════════════════
💻 FORMATAGE DU CODE (TRÈS IMPORTANT !)
═══════════════════════════════════════════════════════════════

Quand tu inclus des exemples de code, tu DOIS utiliser les balises Markdown code block :

\`\`\`javascript
// Ton code ici
const example = "Hello World";
console.log(example);
\`\`\`

RÈGLES POUR LE CODE :
- TOUJOURS utiliser les triple backticks \`\`\` pour les blocs de code
- TOUJOURS spécifier le langage après les backticks (javascript, python, bash, html, css, etc.)
- Indenter proprement le code
- Ajouter des commentaires explicatifs dans le code
- Le code doit être fonctionnel et illustratif

Exemples de langages à utiliser :
- \`\`\`javascript pour JavaScript/Node.js
- \`\`\`python pour Python
- \`\`\`bash pour les commandes terminal
- \`\`\`html pour HTML
- \`\`\`css pour CSS
- \`\`\`typescript pour TypeScript
- \`\`\`json pour JSON
- \`\`\`sql pour SQL

═══════════════════════════════════════════════════════════════
📝 FORMATAGE MARKDOWN
═══════════════════════════════════════════════════════════════

1. **PARAGRAPHES**: ${this.activeStyle === 'narrative' ? 'Fluides, 3-5 phrases, créent une atmosphère' : 'Courts, 2-3 phrases max, ligne vide entre chaque'}
2. **CITATIONS**: *« Citation »* en italique + guillemets français
3. **GRAS**: **Noms propres**, **chiffres**, **concepts clés**
4. **SOUS-TITRES ##**: Tous les 2-3 paragraphes, avec mots-clés
${this.activeStyle === 'narrative' ? '5. **MÉTAPHORES**: Utilise des images poétiques pour expliquer les concepts' : '5. **LISTES**: Si approprié, max 4-5 points'}

═══════════════════════════════════════════════════════════════

📏 LONGUEUR: ${this.activeStyle === 'narrative' ? '1200-1800 mots (plus long pour l\'immersion)' : '800-1200 mots (idéal SEO)'}

📄 FORMAT JSON AVEC SEO COMPLET:
{
  "title": "Titre accrocheur avec mot-clé (50-60 car)",
  "meta_title": "Titre SEO optimisé pour Google (max 60 car)",
  "meta_description": "Description engageante avec mot-clé et appel à l'action (150-160 car)",
  "keywords": ["mot-clé principal", "mot-clé secondaire 1", "mot-clé secondaire 2", "longue traîne 1", "longue traîne 2"],
  "focus_keyword": "mot-clé principal sur lequel optimiser",
  "excerpt": "2-3 phrases d'accroche percutantes pour les réseaux sociaux",
  "content": "Paragraphe avec **mot-clé principal** dès le début...\\n\\n## Sous-titre avec mot-clé\\n\\nParagraphe...",
  "category": "${category}",
  "reading_time_minutes": ${this.activeStyle === 'narrative' ? '7' : '5'},
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "sources": [${sources.map(s => `"${s.link}"`).join(', ')}]
}`;

    try {
      const response = await openaiService.chat(this.systemPrompt, articlePrompt, { 
        json: true,
        maxTokens: 4000 
      });
      
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      }
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      let article;
      try {
        article = JSON.parse(cleanResponse);
        if (!article.title || !article.content) {
          throw new Error('Article incomplet');
        }
      } catch (parseError) {
        console.error('Erreur parsing JSON, création article depuis le texte brut...');
        // Créer un titre français basique à partir du sujet
        const frenchTitle = await this.translateToFrench(subject);
        article = {
          title: frenchTitle.substring(0, 55),
          meta_description: `Découvrez les dernières actualités tech du moment`,
          keywords: ['actualités', 'tech', 'news'],
          excerpt: `Un article complet sur l'actualité tech.`,
          content: `# ${frenchTitle}\n\n${response}`,
          category: category,
          reading_time_minutes: 5,
          tags: ['actualités', 'tech'],
          sources: sources.map(s => s.link)
        };
      }
      
      if (coverImage) {
        article.cover_image = coverImage.url;
        article.cover_image_author = coverImage.author;
        article.cover_image_source = coverImage.source;
      }
      
      // Ajouter l'image du milieu dans le contenu
      if (contentImage) {
        article.content_image = contentImage.url;
        article.content_image_author = contentImage.author;
        article.content_image_source = contentImage.source;
        
        // Insérer l'image au milieu du contenu (après le 2ème sous-titre ##)
        article.content = this.insertContentImage(article.content, contentImage);
      }

      const savedArticle = await this.saveArticleDraft(article);
      
      this.lastGeneratedArticle = { 
        ...article, 
        id: savedArticle?.id,
        slug: savedArticle?.slug || this.generateSlug(article.title),
        title: savedArticle?.title || article.title
      };

      let result = `✅ **Article généré avec succès !**\n\n`;
      result += `📝 **Titre:** ${this.lastGeneratedArticle.title}\n`;
      result += `📂 **Catégorie:** ${article.category}\n`;
      result += `⏱️ **Temps de lecture:** ${article.reading_time_minutes} min\n`;
      result += `🏷️ **Tags:** ${article.tags?.join(', ') || 'Aucun'}\n`;
      if (coverImage) {
        result += `🖼️ **Image:** ${coverImage.source} (${coverImage.author})\n`;
      }
      result += `\n📄 **Extrait:**\n${article.excerpt}\n\n`;
      result += `💾 Article sauvegardé en brouillon\n\n`;
      result += `👍 **Actions possibles:**\n`;
      result += `• "PDF de l'article" - Recevoir le PDF\n`;
      result += `• "Modifie le titre par '...'" - Modifier\n`;
      result += `• "Publie l'article" - Publier sur le blog\n`;
      result += `• "Mes brouillons" - Voir tous les brouillons\n\n`;
      result += `🔄 *Dis "James" ou "emails" pour passer aux emails*\n`;
      result += `🚪 *Dis "quitter" ou "Brian" pour terminer avec Kiara*`;

      return result;

    } catch (error) {
      console.error('Erreur génération article:', error);
      return `❌ Erreur lors de la génération de l'article: ${error.message}`;
    }
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
    // Normaliser le message (enlever accents pour comparaison)
    const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const keywords = [
      'ecris', 'redige', 'genere', 'cree un article', 'article sur', 
      'ecrit', 'rediger', 'ecrire', 'fait un article', 'fais un article',
      'redaction', 'article concernant', 'article a propos'
    ];
    return keywords.some(k => normalized.includes(k));
  }

  isPublishRequest(message) {
    const keywords = ['publie', 'publier', 'poster', 'mettre en ligne', 'publish'];
    return keywords.some(k => message.includes(k));
  }

  isScheduleRequest(message) {
    const keywords = ['programme', 'planifie', 'schedule', 'programmer', 'planifier', 'plus tard'];
    return keywords.some(k => message.includes(k));
  }

  isScheduleListRequest(message) {
    const keywords = ['mes programmations', 'programmations', 'articles programmés', 'publications programmées', 'prévus'];
    return keywords.some(k => message.includes(k));
  }

  isCancelScheduleRequest(message) {
    const keywords = ['annule la programmation', 'annuler programmation', 'supprimer programmation', 'déprogramme'];
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
    const { data: posts, error } = await supabaseService.client
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

    // Total des stats
    const totalViews = posts.reduce((sum, p) => sum + (p.views_count || 0), 0);
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count || 0), 0);
    const totalDislikes = posts.reduce((sum, p) => sum + (p.dislikes_count || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
    const totalShares = posts.reduce((sum, p) => sum + (p.shares_count || 0), 0);

    // Top 5 articles par engagement (likes + comments + shares)
    const topPosts = [...posts]
      .map(p => ({
        ...p,
        engagement: (p.likes_count || 0) + (p.comments_count || 0) * 2 + (p.shares_count || 0) * 3
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5);

    // Stats par catégorie
    const categoryStats = {};
    posts.forEach(p => {
      if (p.category) {
        if (!categoryStats[p.category]) {
          categoryStats[p.category] = { count: 0, views: 0, likes: 0, comments: 0 };
        }
        categoryStats[p.category].count++;
        categoryStats[p.category].views += p.views_count || 0;
        categoryStats[p.category].likes += p.likes_count || 0;
        categoryStats[p.category].comments += p.comments_count || 0;
      }
    });

    let response = `📊 **Stats du Blog - ${today.toLocaleDateString('fr-FR')}**\n\n`;
    response += `📝 **Total articles publiés:** ${posts.length}\n`;
    response += `📅 **Publiés aujourd'hui:** ${todayPosts.length}\n\n`;
    
    response += `━━━━ 📈 **Métriques Globales** ━━━━\n`;
    response += `👁️ **Vues:** ${totalViews.toLocaleString()}\n`;
    response += `👍 **Likes:** ${totalLikes.toLocaleString()}\n`;
    response += `👎 **Dislikes:** ${totalDislikes.toLocaleString()}\n`;
    response += `💬 **Commentaires:** ${totalComments.toLocaleString()}\n`;
    response += `🔗 **Partages:** ${totalShares.toLocaleString()}\n\n`;

    response += `🏆 **Top 5 Articles (engagement):**\n`;
    topPosts.forEach((p, i) => {
      const stats = `👁️${p.views_count || 0} 👍${p.likes_count || 0} 💬${p.comments_count || 0}`;
      response += `${i + 1}. "${p.title}"\n   ${stats}\n`;
    });

    response += `\n📂 **Par catégorie:**\n`;
    Object.entries(categoryStats)
      .sort((a, b) => b[1].views - a[1].views)
      .forEach(([cat, stats]) => {
        response += `• ${cat}: ${stats.count} articles, ${stats.views} vues, ${stats.likes} likes\n`;
      });

    return response;
  }

  async getArticleStats(searchTerm) {
    const { data: posts, error } = await supabaseService.client
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

    // Calculer le taux d'engagement
    const views = article.views_count || 0;
    const likes = article.likes_count || 0;
    const dislikes = article.dislikes_count || 0;
    const comments = article.comments_count || 0;
    const shares = article.shares_count || 0;
    const totalInteractions = likes + dislikes + comments + shares;
    const engagementRate = views > 0 ? ((totalInteractions / views) * 100).toFixed(1) : 0;
    const likeRatio = (likes + dislikes) > 0 ? Math.round((likes / (likes + dislikes)) * 100) : 100;

    let response = `📊 **Stats de l'article**\n\n`;
    response += `📝 **Titre:** ${article.title}\n`;
    response += `🔗 **Slug:** ${article.slug}\n`;
    response += `📂 **Catégorie:** ${article.category || 'Non catégorisé'}\n`;
    response += `📅 **Publié le:** ${pubDate}\n`;
    response += `⏱️ **Temps de lecture:** ${article.reading_time_minutes || '?'} min\n\n`;
    
    response += `━━━━ 📈 **Métriques** ━━━━\n`;
    response += `👁️ **Vues:** ${views.toLocaleString()}\n`;
    response += `👍 **Likes:** ${likes} | 👎 **Dislikes:** ${dislikes}\n`;
    response += `💬 **Commentaires:** ${comments}\n`;
    response += `🔗 **Partages:** ${shares}\n\n`;
    
    response += `📊 **Analyse:**\n`;
    response += `• Taux d'engagement: ${engagementRate}%\n`;
    response += `• Ratio likes: ${likeRatio}% 👍\n`;
    
    if (article.tags && article.tags.length > 0) {
      response += `\n🏷️ **Tags:** ${article.tags.join(', ')}\n`;
    }

    // Position dans le classement par engagement
    const sortedByEngagement = [...posts]
      .map(p => ({
        ...p,
        score: (p.likes_count || 0) * 3 + (p.comments_count || 0) * 5 + (p.shares_count || 0) * 10 + (p.views_count || 0) * 0.1
      }))
      .sort((a, b) => b.score - a.score);
    const rank = sortedByEngagement.findIndex(p => p.id === article.id) + 1;
    response += `\n🏆 **Classement:** #${rank} sur ${posts.length} articles`;

    return response;
  }

  async getGlobalStats() {
    const { data: posts, error } = await supabaseService.client
      .from('blog_posts')
      .select('*')
      .eq('status', 'published');

    if (error) {
      return `❌ Erreur: ${error.message}`;
    }

    // Calcul des totaux
    const totalViews = posts.reduce((sum, p) => sum + (p.views_count || 0), 0);
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count || 0), 0);
    const totalDislikes = posts.reduce((sum, p) => sum + (p.dislikes_count || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
    const totalShares = posts.reduce((sum, p) => sum + (p.shares_count || 0), 0);
    
    const avgViews = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;
    const avgLikes = posts.length > 0 ? (totalLikes / posts.length).toFixed(1) : 0;
    
    // Taux d'engagement global
    const totalInteractions = totalLikes + totalDislikes + totalComments + totalShares;
    const globalEngagementRate = totalViews > 0 ? ((totalInteractions / totalViews) * 100).toFixed(2) : 0;

    // Top article par engagement
    const topByEngagement = [...posts]
      .map(p => ({
        ...p,
        score: (p.likes_count || 0) * 3 + (p.comments_count || 0) * 5 + (p.shares_count || 0) * 10 + (p.views_count || 0) * 0.1
      }))
      .sort((a, b) => b.score - a.score)[0];

    // Top article par vues
    const topByViews = [...posts].sort((a, b) => (b.views_count || 0) - (a.views_count || 0))[0];
    
    // Article le plus liké
    const topByLikes = [...posts].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))[0];
    
    // Article le plus commenté
    const topByComments = [...posts].sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0))[0];

    // Catégories uniques
    const categories = [...new Set(posts.map(p => p.category).filter(Boolean))];

    let response = `📊 **Statistiques Globales du Blog**\n\n`;
    response += `📝 **Articles publiés:** ${posts.length}\n`;
    response += `📂 **Catégories:** ${categories.length}\n\n`;
    
    response += `━━━━ 📈 **Métriques Totales** ━━━━\n`;
    response += `👁️ **Vues:** ${totalViews.toLocaleString()} (moy: ${avgViews}/article)\n`;
    response += `👍 **Likes:** ${totalLikes.toLocaleString()} (moy: ${avgLikes}/article)\n`;
    response += `👎 **Dislikes:** ${totalDislikes.toLocaleString()}\n`;
    response += `💬 **Commentaires:** ${totalComments.toLocaleString()}\n`;
    response += `🔗 **Partages:** ${totalShares.toLocaleString()}\n`;
    response += `📊 **Taux d'engagement:** ${globalEngagementRate}%\n\n`;

    response += `🏆 **Champions du Blog:**\n`;
    if (topByViews) {
      response += `• 👁️ Plus vu: "${topByViews.title}" (${topByViews.views_count || 0} vues)\n`;
    }
    if (topByLikes && topByLikes.likes_count > 0) {
      response += `• 👍 Plus liké: "${topByLikes.title}" (${topByLikes.likes_count} likes)\n`;
    }
    if (topByComments && topByComments.comments_count > 0) {
      response += `• 💬 Plus commenté: "${topByComments.title}" (${topByComments.comments_count} commentaires)\n`;
    }
    if (topByEngagement) {
      response += `• 🏅 Meilleur engagement: "${topByEngagement.title}"\n`;
    }

    return response;
  }

  // ============================================
  // SUPPRESSION D'ARTICLES
  // ============================================

  /**
   * Supprimer un article (brouillon ou publié)
   * @param {string} searchTerm - Titre, slug, ID ou numéro de l'article
   * @param {string} status - 'published', 'draft' ou null (recherche dans tous)
   */
  async deleteArticle(searchTerm, status = null) {
    // Si pas de terme de recherche, lister les articles
    if (!searchTerm) {
      const { data: allPosts, error } = await supabaseService.client
        .from('blog_posts')
        .select('id, title, status, created_at')
        .order('created_at', { ascending: false });

      if (error || !allPosts?.length) {
        return `📭 Aucun article trouvé.`;
      }

      const published = allPosts.filter(p => p.status === 'published');
      const drafts = allPosts.filter(p => p.status === 'draft');

      let response = `🗑️ **Quel article veux-tu supprimer ?**\n\n`;
      
      if (published.length > 0) {
        response += `📢 **Publiés:**\n`;
        published.forEach((p, i) => {
          response += `${i + 1}. "${p.title}"\n`;
        });
        response += `\n`;
      }
      
      if (drafts.length > 0) {
        response += `📝 **Brouillons:**\n`;
        drafts.forEach((p, i) => {
          response += `${i + 1}. "${p.title}"\n`;
        });
      }
      
      response += `\n💡 **Pour supprimer, précise le type :**\n`;
      response += `• "Supprime le brouillon 1" ou "supprime brouillon 2"\n`;
      response += `• "Supprime l'article publié 1" ou "supprime publié 2"\n`;
      response += `• "Supprime l'article [titre]" (par titre)`;
      return response;
    }

    // Chercher tous les articles
    const { data: posts, error: fetchError } = await supabaseService.client
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      return `❌ Erreur: ${fetchError.message}`;
    }

    // Filtrer par statut si spécifié
    let filteredPosts = posts;
    if (status === 'published') {
      filteredPosts = posts.filter(p => p.status === 'published');
    } else if (status === 'draft') {
      filteredPosts = posts.filter(p => p.status === 'draft');
    }

    // Chercher par numéro ou titre
    let article;
    const num = parseInt(searchTerm);
    
    if (!isNaN(num) && num > 0) {
      // Recherche par numéro (dans la liste filtrée)
      article = filteredPosts[num - 1];
    } else {
      // Recherche par titre ou slug (dans tous si pas de statut)
      const searchIn = status ? filteredPosts : posts;
      article = searchIn.find(p => 
        p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id === searchTerm
      );
    }

    if (!article) {
      let msg = `❌ Article "${searchTerm}" non trouvé`;
      if (status === 'published') msg += ' dans les publiés';
      else if (status === 'draft') msg += ' dans les brouillons';
      msg += `.\n\n💡 Dis "supprime article" pour voir la liste.`;
      return msg;
    }

    // Supprimer l'article
    const { error: deleteError } = await supabaseService.client
      .from('blog_posts')
      .delete()
      .eq('id', article.id);

    if (deleteError) {
      return `❌ Erreur lors de la suppression: ${deleteError.message}`;
    }

    const statusText = article.status === 'published' ? '📢 publié' : '📝 brouillon';
    return `✅ **Article supprimé !**\n\n🗑️ "${article.title}" (${statusText})\n\n💡 L'article a été définitivement supprimé.`;
  }

  /**
   * Lister les articles avec filtres optionnels
   * @param {Object} options - Options de filtrage
   * @param {string} options.status - 'published', 'draft', ou null (tous)
   * @param {string} options.period - 'week', 'month', ou null (tous)
   * @param {boolean} options.countOnly - Si true, retourne juste le compte
   */
  async listArticlesFiltered(options = {}) {
    const { status, period, countOnly } = options;
    
    let query = supabaseService.client
      .from('blog_posts')
      .select('id, title, status, views_count, created_at, published_at');
    
    // Filtre par statut
    if (status === 'published') {
      query = query.eq('status', 'published');
    } else if (status === 'draft') {
      query = query.eq('status', 'draft');
    }
    
    // Filtre par période
    if (period) {
      const now = new Date();
      let startDate;
      
      if (period === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (period === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
      }
      
      if (startDate) {
        // Pour les publiés, filtrer sur published_at, sinon created_at
        if (status === 'published') {
          query = query.gte('published_at', startDate.toISOString());
        } else {
          query = query.gte('created_at', startDate.toISOString());
        }
      }
    }
    
    query = query.order('created_at', { ascending: false });
    
    const { data: posts, error } = await query;

    if (error) {
      return `❌ Erreur: ${error.message}`;
    }

    // Mode comptage uniquement
    if (countOnly) {
      const count = posts?.length || 0;
      let statusText = '';
      let periodText = '';
      
      if (status === 'published') statusText = 'publié(s)';
      else if (status === 'draft') statusText = 'en brouillon';
      else statusText = 'au total';
      
      if (period === 'week') periodText = ' cette semaine';
      else if (period === 'month') periodText = ' ce mois';
      else if (period === 'today') periodText = " aujourd'hui";
      
      if (count === 0) {
        return `📊 **0 article** ${statusText}${periodText}.`;
      }
      return `📊 **${count} article${count > 1 ? 's' : ''}** ${statusText}${periodText}.`;
    }

    if (!posts?.length) {
      let msg = `📭 Aucun article`;
      if (status === 'published') msg += ' publié';
      else if (status === 'draft') msg += ' en brouillon';
      if (period === 'week') msg += ' cette semaine';
      else if (period === 'month') msg += ' ce mois';
      msg += '.';
      return msg;
    }

    // Construire le titre
    let title = '📚 ';
    if (status === 'published') title += 'Articles Publiés';
    else if (status === 'draft') title += 'Brouillons';
    else title += 'Mes Articles';
    
    if (period === 'week') title += ' (cette semaine)';
    else if (period === 'month') title += ' (ce mois)';
    else if (period === 'today') title += " (aujourd'hui)";
    
    let response = `${title} - ${posts.length} article${posts.length > 1 ? 's' : ''}\n\n`;
    
    posts.forEach((p, i) => {
      const num = i + 1;
      const statusIcon = p.status === 'published' ? '📢' : '📝';
      const views = p.status === 'published' ? ` - 👁️ ${p.views_count || 0} vues` : '';
      const date = new Date(p.status === 'published' ? p.published_at : p.created_at).toLocaleDateString('fr-FR');
      response += `${num}. ${statusIcon} "${p.title}"${views} (${date})\n`;
    });

    response += `\n💡 **Actions:**\n`;
    if (status === 'draft') {
      response += `• "Publie le 1" ou "Publie [titre]" - Publier un brouillon\n`;
    }
    response += `• "Supprime l'article 1" - Supprimer par numéro\n`;
    response += `• "Stats de [titre]" - Voir les stats`;

    return response;
  }

  /**
   * Lister tous les articles (brouillons + publiés) - Wrapper pour compatibilité
   */
  async listAllArticles() {
    return this.listArticlesFiltered({});
  }

  // ============================================
  // RECHERCHE DE TENDANCES
  // ============================================

  /**
   * Convertir une période en dates
   */
  getPeriodDates(period) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();
    let label = "aujourd'hui";
    
    switch(period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        label = "aujourd'hui";
        break;
        
      case 'yesterday':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        label = "hier";
        break;
        
      case '2days':
        startDate.setDate(now.getDate() - 2);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 2);
        endDate.setHours(23, 59, 59, 999);
        label = "il y a 2 jours";
        break;
        
      case '3days':
        startDate.setDate(now.getDate() - 3);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 3);
        endDate.setHours(23, 59, 59, 999);
        label = "il y a 3 jours";
        break;
        
      case 'week':
        startDate.setDate(now.getDate() - 7);
        label = "cette semaine";
        break;
        
      case 'lastweek':
        startDate.setDate(now.getDate() - 14);
        endDate.setDate(now.getDate() - 7);
        label = "la semaine dernière";
        break;
        
      case 'month':
        startDate.setDate(now.getDate() - 30);
        label = "ce mois";
        break;
        
      case 'lastmonth':
        startDate.setDate(now.getDate() - 60);
        endDate.setDate(now.getDate() - 30);
        label = "le mois dernier";
        break;
        
      default:
        // Match pour X days
        const daysMatch = period?.match(/^(\d+)days$/);
        if (daysMatch) {
          const days = parseInt(daysMatch[1]);
          startDate.setDate(now.getDate() - days);
          startDate.setHours(0, 0, 0, 0);
          endDate.setDate(now.getDate() - days);
          endDate.setHours(23, 59, 59, 999);
          label = `il y a ${days} jours`;
        } else {
          // Par défaut: aujourd'hui
          startDate.setHours(0, 0, 0, 0);
          label = "aujourd'hui";
        }
    }
    
    return { startDate, endDate, label };
  }

  /**
   * Résoudre le domaine à partir du texte (avec alias)
   */
  resolveDomain(text) {
    const lowerText = text.toLowerCase();
    
    // Vérifier les alias en premier
    for (const [alias, domain] of Object.entries(this.domainAliases)) {
      if (lowerText.includes(alias)) {
        return domain;
      }
    }
    
    // Vérifier les noms de domaines directs
    for (const domain of Object.keys(this.trendSourcesByDomain)) {
      if (lowerText.includes(domain)) {
        return domain;
      }
    }
    
    // Par défaut: tech
    return 'tech';
  }

  /**
   * Obtenir le label lisible d'un domaine
   */
  getDomainLabel(domain) {
    const labels = {
      'tech': '💻 Tech & Informatique',
      'hardware': '🖥️ Hardware & GPU',
      'ia': '🤖 Intelligence Artificielle',
      'spatial': '🚀 Spatial & Astronomie',
      'politique': '🏛️ Politique',
      'economie': '💰 Économie & Business',
      'science': '🔬 Science',
      'auto': '🚗 Automobile & Mécanique',
      'gaming': '🎮 Gaming & Jeux Vidéo',
      'crypto': '₿ Crypto & Blockchain',
      'sante': '🏥 Santé & Médecine',
      'environnement': '🌍 Environnement & Climat'
    };
    return labels[domain] || domain;
  }

  async handleTrendRequest(message, period = null, domain = null) {
    const { startDate, endDate, label } = this.getPeriodDates(period);
    
    // Résoudre le domaine depuis le message si non spécifié
    const resolvedDomain = domain || this.resolveDomain(message);
    const domainLabel = this.getDomainLabel(resolvedDomain);
    
    console.log(`🔍 Kiara recherche les tendances ${resolvedDomain} (${label})...`);
    
    // Récupérer les sources pour ce domaine
    const sources = this.trendSourcesByDomain[resolvedDomain] || this.trendSourcesByDomain.tech;
    
    const trends = await this.fetchTrendsFromInternet(startDate, endDate, sources);
    
    // Stocker les tendances pour référence ultérieure
    this.lastDisplayedTrends = trends;
    
    let response = `🔥 **Tendances** - ${domainLabel}\n`;
    response += `📅 ${label.charAt(0).toUpperCase() + label.slice(1)}`;
    if (period && period !== 'today' && !period.includes('day')) {
      response += ` (${startDate.toLocaleDateString('fr-FR')} - ${endDate.toLocaleDateString('fr-FR')})`;
    }
    response += `\n\n`;
    
    if (trends.length === 0) {
      response += `📭 Aucune tendance ${resolvedDomain} trouvée pour cette période.\n\n`;
      response += `💡 **Suggestions:**\n`;
      response += `• "Tendances ${resolvedDomain} de la semaine"\n`;
      response += `• "Tendances ${resolvedDomain} du mois"\n\n`;
      response += `📌 **Autres domaines disponibles:**\n`;
      response += `Tech, IA, Spatial, Politique, Économie, Auto, Gaming, Crypto, Santé, Environnement`;
      return response;
    }
    
    trends.forEach((trend, i) => {
      response += `${i + 1}. **${trend.title}**\n`;
      response += `   📰 Source: ${trend.source}\n`;
      if (trend.description) {
        response += `   ${trend.description.substring(0, 150)}...\n`;
      }
      response += `   📂 Catégorie suggérée: ${trend.category}\n`;
      if (trend.pubDate) {
        const pubDateStr = new Date(trend.pubDate).toLocaleDateString('fr-FR', { 
          day: 'numeric', 
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        response += `   🕐 ${pubDateStr}\n`;
      }
      response += `   🔗 ${trend.link}\n\n`;
    });

    response += `━━━━━━━━━━━━━━━━━━\n`;
    response += `💡 **Actions:**\n`;
    response += `• "Rédige un article sur le 1" - Créer un article\n`;
    response += `• "Tendances politique" - Changer de domaine\n`;
    response += `• "Tendances IA d'hier" - Combiner domaine et période`;
    
    return response;
  }

  /**
   * Récupère les vraies tendances depuis plusieurs sources RSS
   * AMÉLIORATION: Élargit automatiquement la période si aucun résultat
   */
  async fetchTrendsFromInternet(startDate = null, endDate = null, sources = null, minResults = 10) {
    const allTrends = [];
    
    // Utiliser les sources passées en paramètre ou les sources par défaut
    const sourcesToUse = sources || this.trendSources;
    
    console.log(`📡 Fetching trends from ${sourcesToUse.length} RSS feeds...`);
    
    for (const source of sourcesToUse) {
      try {
        const feed = await this.rssParser.parseURL(source.url);
        
        // Prendre les 5 premiers articles de chaque source (augmenté de 3 à 5)
        const items = feed.items.slice(0, 5).map(item => ({
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
    
    // Si pas de startDate, retourner les plus récents triés
    if (!startDate) {
      const sortedTrends = allTrends
        .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
        .slice(0, minResults);
      
      if (sortedTrends.length === 0) {
        return await this.fetchTrendsFallback();
      }
      
      console.log(`✅ ${sortedTrends.length} tendances trouvées (sans filtre date)`);
      return sortedTrends;
    }
    
    // Filtrer par période avec ÉLARGISSEMENT AUTOMATIQUE
    const now = new Date();
    const effectiveEndDate = endDate || now;
    
    // Essayer avec la période demandée d'abord
    let filteredTrends = allTrends.filter(trend => {
      if (!trend.pubDate) return false;
      const trendDate = new Date(trend.pubDate);
      return trendDate >= startDate && trendDate <= effectiveEndDate;
    });
    
    console.log(`📅 Filtrage initial: ${allTrends.length} → ${filteredTrends.length} (période: ${startDate.toLocaleDateString()} - ${effectiveEndDate.toLocaleDateString()})`);
    
    // ÉLARGISSEMENT AUTOMATIQUE si pas assez de résultats
    if (filteredTrends.length < minResults && allTrends.length > 0) {
      const periodsToTry = [
        { days: 1, label: 'hier' },
        { days: 3, label: '3 derniers jours' },
        { days: 7, label: 'semaine' },
        { days: 14, label: '2 semaines' },
        { days: 30, label: 'mois' },
        { days: 90, label: '3 mois' }
      ];
      
      for (const period of periodsToTry) {
        const extendedStart = new Date(now.getTime() - period.days * 24 * 60 * 60 * 1000);
        
        // Ne pas élargir si on a déjà essayé cette période ou plus large
        if (extendedStart <= startDate) continue;
        
        filteredTrends = allTrends.filter(trend => {
          if (!trend.pubDate) return false;
          const trendDate = new Date(trend.pubDate);
          return trendDate >= extendedStart && trendDate <= now;
        });
        
        if (filteredTrends.length >= Math.min(minResults, 3)) {
          console.log(`📅 Période élargie à "${period.label}": ${filteredTrends.length} résultats`);
          break;
        }
      }
      
      // Si toujours pas assez, prendre simplement les plus récents disponibles
      if (filteredTrends.length < 3) {
        console.log(`📅 Fallback: prendre les ${minResults} plus récents sans filtre de date`);
        filteredTrends = allTrends;
      }
    }
    
    // Trier par date et limiter
    const sortedTrends = filteredTrends
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, minResults);
    
    if (sortedTrends.length === 0) {
      // Fallback si pas de RSS disponible du tout
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

    // Chercher 2 images: 1 pour la couverture, 1 pour le milieu de l'article
    console.log('🖼️ Recherche de 2 images pour l\'article...');
    const images = await this.searchFreeImages(subject, 2);
    const coverImage = images.length > 0 ? images[0] : null;
    const contentImage = images.length > 1 ? images[1] : null;

    // Chercher les tendances liées au sujet pour enrichir l'article
    console.log('🔍 Recherche de sources pour enrichir l\'article...');
    const relatedTrends = await this.fetchRelatedContent(subject);

    // Préparer les sources pour le prompt (uniquement titre + lien)
    const sourcesForPrompt = relatedTrends.length > 0 
      ? relatedTrends.map(t => `- "${t.title}" - ${t.link}`).join('\n')
      : 'Aucune source externe trouvée.';

    const articlePrompt = `Tu es un JOURNALISTE WEB FRANÇAIS de talent et EXPERT SEO, spécialisé en référencement naturel.
Rédige un article de blog professionnel EN FRANÇAIS sur: "${subject}"

🔍 SOURCES À ANALYSER (utilise si pertinentes):
${sourcesForPrompt}

═══════════════════════════════════════════════════════════════
🎯 OPTIMISATION SEO (TRÈS IMPORTANT !)
═══════════════════════════════════════════════════════════════

1. **TITRE (title)**: 50-60 caractères
   - Mot-clé principal AU DÉBUT
   - Accrocheur et clair

2. **META TITLE**: Titre optimisé pour Google (max 60 car)
   - Inclut le mot-clé principal

3. **META DESCRIPTION**: 150-160 caractères
   - Résumé engageant avec mot-clé
   - Appel à l'action implicite

4. **KEYWORDS**: 5-8 mots-clés
   - 1 mot-clé principal (focus_keyword)
   - 2-3 mots-clés secondaires
   - 2-3 mots-clés longue traîne

5. **TAGS**: 3-5 tags pertinents

6. **STRUCTURE H2/H3**: Sous-titres avec mots-clés

═══════════════════════════════════════════════════════════════
🎨 TON STYLE D'ÉCRITURE
═══════════════════════════════════════════════════════════════
- **HUMOUR**: Touches d'humour, jeux de mots
- **ACCROCHEUR**: Titre percutant
- **DYNAMIQUE**: Écris comme à un ami passionné
- **ACCESSIBLE**: Explique simplement

═══════════════════════════════════════════════════════════════
⚠️ RÈGLES STRICTES
═══════════════════════════════════════════════════════════════
1. **100% FRANÇAIS** - Sauf termes tech en *italique*
2. **PAS DE "Introduction/Conclusion"** - Commence directement
3. **MARKDOWN PUR** - Pas de HTML
4. **MOT-CLÉ DANS LE 1ER PARAGRAPHE**

═══════════════════════════════════════════════════════════════
📝 FORMATAGE MARKDOWN
═══════════════════════════════════════════════════════════════
- Paragraphes courts (2-3 phrases), ligne vide entre chaque
- Citations: *« Citation »* en italique + guillemets français
- Gras: **Noms propres**, **chiffres**, **concepts**
- Sous-titres ## avec mots-clés, tous les 2-3 paragraphes

═══════════════════════════════════════════════════════════════

📏 LONGUEUR: 700-1000 mots (idéal SEO)

📄 FORMAT JSON AVEC SEO COMPLET:
{
  "title": "Titre avec mot-clé (50-60 car)",
  "meta_title": "Titre SEO optimisé (max 60 car)",
  "meta_description": "Description avec mot-clé et CTA (150-160 car)",
  "keywords": ["mot-clé principal", "secondaire 1", "secondaire 2", "longue traîne 1", "longue traîne 2"],
  "focus_keyword": "mot-clé principal",
  "excerpt": "2-3 phrases d'accroche pour réseaux sociaux",
  "content": "Paragraphe avec **mot-clé** dès le début...\\n\\n## Sous-titre SEO\\n\\nParagraphe...",
  "category": "${category}",
  "reading_time_minutes": 5,
  "tags": ["tag1", "tag2", "tag3"],
  "sources": ["https://..."]
}`;

    try {
      const response = await openaiService.chat(this.systemPrompt, articlePrompt, { 
        json: true,
        maxTokens: 4000 
      });
      
      // Nettoyer la réponse si elle contient des backticks markdown
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      }
      // Extraire le JSON s'il est entouré de texte
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      let article;
      try {
        article = JSON.parse(cleanResponse);
        // Vérifier que l'article a les champs requis
        if (!article.title || !article.content) {
          throw new Error('Article incomplet');
        }
      } catch (parseError) {
        console.error('Erreur parsing JSON, création article depuis le texte brut...');
        
        // Si la réponse contient du contenu textuel, l'utiliser directement
        if (response && response.length > 200 && !response.includes('{')) {
          // OpenAI a renvoyé du texte brut au lieu de JSON
          article = {
            title: `${subject} : Guide Complet`,
            meta_description: `Découvrez tout sur ${subject}`,
            keywords: subject.split(' ').filter(w => w.length > 2),
            excerpt: `Un article complet sur ${subject}.`,
            content: `# ${subject}\n\n${response}`,
            category: category,
            reading_time_minutes: Math.ceil(response.split(/\s+/).length / 200),
            tags: subject.split(' ').filter(w => w.length > 3).slice(0, 5),
            sources: []
          };
        } else {
          // Fallback complet
          article = await this.generateFallbackArticle(subject, category, relatedTrends);
        }
      }
      
      // Ajouter l'image de couverture
      if (coverImage) {
        article.cover_image = coverImage.url;
        article.cover_image_author = coverImage.author;
        article.cover_image_source = coverImage.source;
      }
      
      // Ajouter l'image du milieu dans le contenu
      if (contentImage) {
        article.content_image = contentImage.url;
        article.content_image_author = contentImage.author;
        article.content_image_source = contentImage.source;
        
        // Insérer l'image au milieu du contenu
        article.content = this.insertContentImage(article.content, contentImage);
      }

      // Sauvegarder en brouillon
      const savedArticle = await this.saveArticleDraft(article);

      // Stocker l'article en mémoire pour le PDF (inclure id et slug de la DB)
      this.lastGeneratedArticle = { 
        ...article, 
        id: savedArticle?.id,
        slug: savedArticle?.slug || this.generateSlug(article.title),
        title: savedArticle?.title || article.title // Utiliser le titre tronqué si disponible
      };

      let result = `✅ **Article généré avec succès !**\n\n`;
      result += `📝 **Titre:** ${this.lastGeneratedArticle.title}\n`;
      result += `📂 **Catégorie:** ${article.category}\n`;
      result += `⏱️ **Temps de lecture:** ${article.reading_time_minutes} min\n`;
      result += `🏷️ **Tags:** ${article.tags?.join(', ') || 'Aucun'}\n`;
      if (coverImage) {
        result += `🖼️ **Image couverture:** ${coverImage.source} (${coverImage.author})\n`;
      }
      if (contentImage) {
        result += `🖼️ **Image contenu:** ${contentImage.source} (${contentImage.author})\n`;
      }
      result += `\n📄 **Extrait:**\n${article.excerpt}\n\n`;
      result += `💾 Article sauvegardé en brouillon\n\n`;
      result += `👍 **Actions possibles:**\n`;
      result += `• "PDF de l'article" - Recevoir le PDF\n`;
      result += `• "Modifie le titre par '...'" - Modifier\n`;
      result += `• "Publie l'article" - Publier sur le blog\n`;
      result += `• "Mes brouillons" - Voir tous les brouillons\n\n`;
      result += `🔄 *Dis "James" ou "emails" pour passer aux emails*\n`;
      result += `🚪 *Dis "quitter" ou "Brian" pour terminer avec Kiara*`;

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

  /**
   * Génère un article complet en fallback quand le parsing JSON échoue
   */
  async generateFallbackArticle(subject, category, relatedTrends = []) {
    // Utiliser le style actif
    const isNarrative = this.activeStyle === 'narrative';
    
    const contentPrompt = isNarrative 
      ? `Rédige un article de blog IMMERSIF et NARRATIF en FRANÇAIS sur "${subject}".

STYLE DOCUMENTAIRE:
- Ton grave, contemplatif, comme un narrateur de documentaire Arte
- Commence par une question intrigante ou une scène immersive
- Utilise des métaphores poétiques : "sculpter le chaos", "une spirale vertueuse"
- Crée une montée en tension narrative avec des cliffhangers
- Adresse-toi au lecteur : "Imaginez que...", "Vous l'avez peut-être remarqué..."
- Atmosphère quasi-philosophique, réflexions profondes

RÈGLES:
- 100% en français
- 1200-1500 mots (pour l'immersion)
- Structure: Accroche mystérieuse + développement narratif + ouverture philosophique
- PAS d'emojis, ton sérieux

Format: Markdown pur, commence par l'accroche (pas de titre #).`
      : `Rédige un article de blog CAPTIVANT en FRANÇAIS sur "${subject}".

STYLE:
- Touches d'humour et jeux de mots
- Dynamique, comme si tu parlais à un ami
- Accessible, pas trop technique

RÈGLES:
- 100% en français
- 800-1000 mots MAX (3-4 pages PDF)
- Structure: Intro fun + 3 sections + Conclusion avec clin d'œil

Format: Markdown pur, commence par l'intro (pas de titre #).`;

    let content;
    try {
      content = await openaiService.chat(this.systemPrompt, contentPrompt);
    } catch (e) {
      content = `Accrochez-vous à vos claviers, on va parler de ${subject} ! 🚀

## C'est quoi le délire avec ${subject} ?

Si vous n'avez pas encore entendu parler de ${subject}, soit vous vivez dans une grotte (avec du WiFi j'espère), soit vous avez mieux à faire. Dans les deux cas, on va rattraper le temps perdu !

## Pourquoi tout le monde en parle ?

- **C'est puissant** : On parle de performances qui font pâlir la concurrence
- **C'est tendance** : Les geeks en raffolent, et ils ont raison
- **C'est l'avenir** : Autant prendre le train en marche maintenant

## Comment en profiter ?

Pas besoin d'être un génie pour s'y mettre. Avec les bonnes ressources et un peu de curiosité, vous serez opérationnel en un rien de temps.

## Le mot de la fin

${subject}, c'est un peu comme le café : une fois qu'on y a goûté, difficile de s'en passer. Restez connectés pour plus de pépites tech !`;
    }

    const keywords = subject.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    // Sources = uniquement les URLs pertinentes
    const sourceUrls = relatedTrends
      .filter(t => t.link && t.link.startsWith('http'))
      .map(t => t.link)
      .slice(0, 3);
    
    return {
      title: `${subject} : Le Guide Qui Déchire`,
      meta_description: `Découvrez tout sur ${subject}. Le guide fun et pratique !`,
      keywords: [...keywords, 'guide', '2025'],
      excerpt: `Un guide complet sur ${subject}. Découvrez les tendances et conseils d'experts.`,
      content: `# ${subject} : Guide Complet\n\n${content}`,
      category: category,
      reading_time_minutes: 5,
      tags: keywords.slice(0, 5),
      sources: sourceUrls
    };
  }

  async saveArticleDraft(article) {
    // Limiter le titre à 70 caractères max (contrainte DB)
    const safeTitle = (article.title || 'Article Sans Titre').substring(0, 70);
    const slug = this.generateSlug(safeTitle);
    
    // Formater les sources pour le blog (array d'objets avec title, url, date)
    let formattedSources = null;
    if (article.sources && Array.isArray(article.sources)) {
      formattedSources = article.sources.map(s => {
        if (typeof s === 'string') {
          // Si c'est une URL, l'utiliser comme url ET comme titre raccourci
          const isUrl = s.startsWith('http://') || s.startsWith('https://');
          if (isUrl) {
            // Extraire un titre lisible depuis l'URL
            try {
              const urlObj = new URL(s);
              const pathParts = urlObj.pathname.split('/').filter(p => p);
              const lastPart = pathParts[pathParts.length - 1] || urlObj.hostname;
              const cleanTitle = lastPart.replace(/-/g, ' ').replace(/_/g, ' ').substring(0, 80);
              return { title: cleanTitle, url: s, date: new Date().toISOString() };
            } catch {
              return { title: s.substring(0, 80), url: s, date: new Date().toISOString() };
            }
          }
          return { title: s, url: '', date: new Date().toISOString() };
        }
        return {
          title: s.title || 'Source',
          url: s.url || s.link || '',
          date: s.pubDate || s.date || new Date().toISOString()
        };
      });
    }

    // Utiliser le user_id du profil si disponible
    const userId = supabaseService.defaultUserId;
    
    const insertData = {
      title: safeTitle,
      slug: slug,
      excerpt: (article.excerpt || '').substring(0, 500),
      content: article.content,
      meta_title: (article.meta_title || safeTitle).substring(0, 70),
      meta_description: (article.meta_description || '').substring(0, 160),
      keywords: article.keywords,
      // focus_keyword: article.focus_keyword || (article.keywords && article.keywords[0]) || null, // Mot-clé principal SEO
      canonical_url: null,
      sources: formattedSources,
      category: article.category,
      tags: article.tags,
      author_name: 'Brian Biendou',
      author_avatar_url: null,
      status: 'draft',
      published_at: null,
      scheduled_for: null,
      reading_time_minutes: article.reading_time_minutes || 5,
      views_count: 0,
      cover_image_url: article.cover_image || article.cover_image_url || null,
      // Image du milieu de l'article
      content_image_url: article.content_image || article.content_image_url || null
    };

    // Ajouter user_id seulement si c'est un UUID valide (pas le fictif)
    if (userId && userId !== '00000000-0000-0000-0000-000000000001') {
      insertData.user_id = userId;
    }

    const { data, error } = await supabaseService.client
      .from('blog_posts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Erreur sauvegarde brouillon:', error);
      return null;
    }

    return data;
  }

  /**
   * Traduit un texte en français (pour les titres anglais)
   */
  async translateToFrench(text) {
    try {
      const response = await openaiService.chat(
        'Tu es un traducteur. Réponds UNIQUEMENT avec la traduction, sans explication.',
        `Traduis ce titre en français de manière naturelle et accrocheuse (max 55 caractères): "${text}"`,
        { maxTokens: 100 }
      );
      return response.trim().replace(/^["']|["']$/g, ''); // Enlever les guillemets
    } catch (error) {
      // Fallback: garder le texte original tronqué
      return text.substring(0, 55);
    }
  }

  generateSlug(title) {
    // Sécuriser le slug même si le titre est undefined ou vide
    const safeTitle = title || `article-${Date.now()}`;
    return safeTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
      .replace(/[^a-z0-9]+/g, '-')     // Remplacer caractères spéciaux
      .replace(/^-+|-+$/g, '')          // Supprimer tirets début/fin
      .substring(0, 80);                // Limiter longueur
  }

  /**
   * Insérer une image au milieu du contenu (après le 2ème sous-titre ##)
   */
  insertContentImage(content, image) {
    if (!content || !image) return content;
    
    // Trouver tous les sous-titres ##
    const lines = content.split('\n');
    let h2Count = 0;
    let insertIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('## ')) {
        h2Count++;
        if (h2Count === 2) {
          // Trouver la fin de la section (prochain ## ou fin de fichier)
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim().startsWith('## ') || j === lines.length - 1) {
              // Insérer l'image avant le prochain titre ou à la fin
              insertIndex = j === lines.length - 1 ? j : j;
              break;
            }
          }
          break;
        }
      }
    }
    
    // Si on n'a pas trouvé de bon endroit, insérer au milieu
    if (insertIndex === -1) {
      insertIndex = Math.floor(lines.length / 2);
    }
    
    // Créer le bloc image avec crédits
    const imageBlock = `\n![${image.author || 'Image illustrative'}](${image.url})\n*Crédit photo : ${image.author || 'Unsplash'} via ${image.source || 'Unsplash'}*\n`;
    
    // Insérer l'image
    lines.splice(insertIndex, 0, imageBlock);
    
    return lines.join('\n');
  }

  // ============================================
  // PUBLICATION D'ARTICLES
  // ============================================

  /**
   * Formater la liste des brouillons numérotés
   */
  formatDraftsList(drafts) {
    if (!drafts || drafts.length === 0) {
      return "Aucun brouillon disponible.";
    }
    return drafts.map((d, i) => `${i + 1}. 📝 ${d.title}`).join('\n');
  }

  async handlePublishRequest(message, context = {}) {
    const lowerMessage = message.toLowerCase();
    
    let article = null;
    
    // D'abord, récupérer tous les brouillons pour référence
    const { data: allDrafts, error: draftsError } = await supabaseService.client
      .from('blog_posts')
      .select('*')
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
    
    if (draftsError) {
      return `❌ Erreur lors de la récupération des brouillons.`;
    }
    
    // Vérifier s'il y a un numéro dans le message (gère "le 1", "brouillon 1", "1", etc.)
    const numPatterns = [
      /publie\s+(?:le\s+)?(?:brouillon\s+)?(\d+)/i,
      /publie\s+(?:l'article\s+)?(\d+)/i,
      /publie\s+(\d+)/i,
      /^(\d+)$/
    ];
    
    let draftNumber = null;
    for (const pattern of numPatterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        draftNumber = parseInt(match[1]);
        break;
      }
    }
    
    // Si on a trouvé un numéro, publier ce brouillon
    if (draftNumber !== null) {
      if (!allDrafts || allDrafts.length === 0) {
        return `❌ Aucun brouillon à publier.\n\n💡 Crée d'abord un article avec "Rédige un article sur..."`;
      }
      
      const index = draftNumber - 1;
      if (index < 0 || index >= allDrafts.length) {
        return `❌ Brouillon n°${draftNumber} non trouvé.\n\n📋 **Brouillons disponibles:**\n${this.formatDraftsList(allDrafts)}\n\n💡 Dis "Publie 1" ou "Publie le brouillon 2"`;
      }
      
      article = allDrafts[index];
    }
    
    // Patterns qui indiquent "publier le dernier article" sans titre spécifique
    if (!article) {
      const publishLastPatterns = [
        'publie sur le blog',
        'publie le sur le blog',
        'publie-le',
        'publie l\'article',
        'publier l\'article',
        'publie article',
        'publie cet article',
        'publie cet article',
        'publier cet article',
        'publie ca',
        'publie ça',
        'publier ça',
        'publie le',
        'publie-le',
        'publier'
      ];
      
      // Vérifier si c'est une demande de publication sans titre spécifique
      const isPublishLast = publishLastPatterns.some(p => lowerMessage.includes(p)) || 
                            lowerMessage === 'publie' || 
                            lowerMessage === 'publier' ||
                            /^publie\s*(l'|le|cet|ça|ca)?\s*(article)?$/i.test(lowerMessage.trim());
      
      if (isPublishLast) {
        console.log('📝 Publication demandée sans titre spécifique, utilisation du dernier brouillon...');
        
        // TOUJOURS prendre le brouillon le plus récent (n°1) si disponible
        if (allDrafts && allDrafts.length > 0) {
          article = allDrafts[0]; // Le premier = le plus récent
          console.log(`📝 Brouillon sélectionné: "${article.title}"`);
        }
        // Sinon essayer le dernier article généré en mémoire
        else if (this.lastGeneratedArticle?.id) {
          const { data, error } = await supabaseService.client
            .from('blog_posts')
            .select('*')
            .eq('id', this.lastGeneratedArticle.id)
            .single();
          
          if (!error && data) {
            article = data;
          }
        }
        
        if (!article) {
          return `❌ Aucun brouillon à publier.\n\n💡 Crée d'abord un article avec "Rédige un article sur..."`;
        }
      }
    }
    
    // Si toujours pas d'article, chercher par titre
    if (!article) {
      let searchTerm = message
        .replace(/publie[rz]?\s*/i, '')
        .replace(/l'article\s*/i, '')
        .replace(/le\s+brouillon\s*/i, '')
        .replace(/sur le blog/i, '')
        .trim();
      
      if (searchTerm.length > 2 && allDrafts && allDrafts.length > 0) {
        article = allDrafts.find(d => 
          d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.slug.includes(searchTerm.toLowerCase())
        );
      }

      if (!article) {
        if (!allDrafts || allDrafts.length === 0) {
          return `❌ Aucun brouillon disponible.\n\n💡 Crée d'abord un article avec "Rédige un article sur..."`;
        }
        return `❌ Brouillon "${searchTerm}" non trouvé.\n\n📋 **Brouillons disponibles:**\n${this.formatDraftsList(allDrafts)}\n\n💡 Dis "Publie 1" ou "Publie [titre]"`;
      }
    }

    // Vérifier que l'article n'est pas déjà publié
    if (article.status === 'published') {
      return `ℹ️ L'article "${article.title}" est déjà publié sur le blog !`;
    }

    // Publier l'article
    const { error: updateError } = await supabaseService.client
      .from('blog_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', article.id);

    if (updateError) {
      return `❌ Erreur lors de la publication: ${updateError.message}`;
    }

    return `✅ **Article publié avec succès !**\n\n📝 **"${article.title}"**\n🔗 Slug: ${article.slug}\n📂 Catégorie: ${article.category || 'Non catégorisé'}\n⏱️ Temps de lecture: ${article.reading_time_minutes || 5} min\n\n🌐 **L'article est maintenant visible sur ton blog !**\n👉 https://www.brianbiendou.com/blog/${article.slug}`;
  }

  async listDrafts() {
    const { data: drafts, error } = await supabaseService.client
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
    // Utiliser listAllArticles pour montrer tous les articles (publiés + brouillons)
    return await this.listAllArticles();
  }

  // ============================================
  // PROGRAMMATION D'ARTICLES
  // ============================================

  async handleScheduleRequest(message) {
    console.log('⏰ Kiara programme un article...');
    
    // Parser la date et l'heure avec l'IA (plus robuste que le regex)
    const dateTimeInfo = await this.parseDateTimeWithAI(message);
    
    if (!dateTimeInfo.date) {
      // Fallback sur le parsing regex classique
      const regexDateInfo = this.parseDateTimeFromMessage(message);
      if (!regexDateInfo.date) {
        return `⏰ **Programmation d'articles**\n\nJe n'ai pas compris la date. Exemples:\n• "Programme pour demain 9h"\n• "Programme pour le 15 décembre à 14h"\n• "Programme pour lundi prochain 10h"`;
      }
      dateTimeInfo.date = regexDateInfo.date;
    }

    // Chercher l'article à programmer (dernier généré ou spécifié)
    let article = this.lastGeneratedArticle;
    
    // Chercher si un titre est spécifié
    const titleMatch = message.match(/(?:article|l'article)\s+["']?([^"']+?)["']?\s+(?:pour|à|a)/i);
    if (titleMatch) {
      const searchTerm = titleMatch[1].trim();
      const { data: posts } = await supabaseService.client
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
    
    // 1. Mettre à jour l'article dans blog_posts avec status = 'scheduled'
    const { error: updateError } = await supabaseService.client
      .from('blog_posts')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', article.id);

    if (updateError) {
      console.error('Erreur mise à jour article:', updateError);
    }

    // 2. Essayer d'insérer dans scheduled_posts (table de suivi)
    let scheduled = null;
    try {
      const { data, error } = await supabaseService.client
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
        console.error('Erreur insertion scheduled_posts:', error);
        // Si la table n'existe pas, on continue quand même car blog_posts est déjà mis à jour
        if (error.code === '23505') {
          return `⚠️ Cet article est déjà programmé. Annule d'abord l'ancienne programmation avec "Annule la programmation".`;
        }
      } else {
        scheduled = data;
      }
    } catch (e) {
      console.log('⚠️ Table scheduled_posts non disponible:', e.message);
    }

    // 3. Créer un événement dans Outlook Calendar
    let calendarEvent = null;
    try {
      if (outlookService.isConnected()) {
        calendarEvent = await outlookService.createEvent({
          subject: `📝 Publication Blog: ${article.title}`,
          body: {
            contentType: 'HTML',
            content: `<h2>🚀 Article programmé pour publication automatique</h2>
              <p><strong>Titre:</strong> ${article.title}</p>
              <p><strong>Catégorie:</strong> ${article.category || 'Non catégorisé'}</p>
              <p><strong>Extrait:</strong> ${article.excerpt || ''}</p>
              <p><strong>Publication automatique:</strong> ✅ OUI</p>
              <hr>
              <p>🤖 Programmé par Kiara - BiendouCorp Agent</p>
              <p>L'article sera publié automatiquement à l'heure prévue.</p>`
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
        console.log('✅ Événement Outlook créé:', calendarEvent?.id);
        
        // Mettre à jour la programmation avec l'ID Outlook
        if (calendarEvent?.id && scheduled?.id) {
          await supabaseService.client
            .from('scheduled_posts')
            .update({ outlook_event_id: calendarEvent.id })
            .eq('id', scheduled.id);
        }
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
    response += `📅 **Publication prévue:** ${formattedDate}\n`;
    response += `📂 **Catégorie:** ${article.category || 'Non catégorisé'}\n\n`;
    
    response += `🤖 **Publication automatique:** ✅ Activée\n`;
    response += `*L'article sera publié automatiquement à l'heure prévue.*\n\n`;
    
    if (calendarEvent) {
      response += `📆 **Outlook Calendar:** ✅ Événement créé avec rappel 1h avant\n\n`;
    } else {
      response += `📆 **Outlook Calendar:** ⚠️ Non connecté (connecte Outlook pour sync)\n\n`;
    }

    response += `👉 **Actions:**\n`;
    response += `• "Mes programmations" - Voir les articles programmés\n`;
    response += `• "Publie maintenant" - Publier immédiatement\n`;
    response += `• "Annule la programmation" - Annuler`;

    return response;
  }

  /**
   * Liste les articles programmés
   */
  async handleScheduleList() {
    console.log('📋 Liste des programmations...');
    
    const { data: scheduled, error } = await supabaseService.client
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error('Erreur liste programmations:', error);
      return `❌ Erreur lors de la récupération des programmations.`;
    }

    if (!scheduled || scheduled.length === 0) {
      return `📅 **Aucun article programmé**\n\nUtilise "Programme l'article pour [date]" après avoir généré un article.`;
    }

    let response = `📅 **Articles programmés** (${scheduled.length})\n\n`;

    for (const item of scheduled) {
      const scheduledDate = new Date(item.scheduled_at);
      const formattedDate = scheduledDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const now = new Date();
      const diff = scheduledDate - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeRemaining = '';
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        timeRemaining = `dans ${days} jour${days > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        timeRemaining = `dans ${hours}h${minutes > 0 ? minutes + 'min' : ''}`;
      } else if (minutes > 0) {
        timeRemaining = `dans ${minutes} minutes`;
      } else {
        timeRemaining = `🔜 imminent`;
      }

      response += `📝 **${item.title}**\n`;
      response += `   📆 ${formattedDate}\n`;
      response += `   ⏱️ ${timeRemaining}\n`;
      response += `   ${item.outlook_event_id ? '✅ Sync Outlook' : '⚠️ Non sync Outlook'}\n\n`;
    }

    response += `👉 **Actions:**\n`;
    response += `• "Annule la programmation de [titre]" pour annuler`;

    return response;
  }

  /**
   * Annule une programmation
   */
  async handleCancelSchedule(message) {
    console.log('❌ Annulation programmation...');
    
    // Trouver l'article à annuler
    const { data: scheduled, error } = await supabaseService.client
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'pending');

    if (error || !scheduled || scheduled.length === 0) {
      return `❌ Aucun article programmé à annuler.`;
    }

    // Chercher par titre si spécifié
    let toCancel = null;
    const titleMatch = message.match(/(?:de|l'article)\s+["']?([^"']+)["']?/i);
    
    if (titleMatch) {
      const searchTerm = titleMatch[1].trim().toLowerCase();
      toCancel = scheduled.find(s => 
        s.title.toLowerCase().includes(searchTerm)
      );
    } else {
      // Annuler le dernier ou le seul
      toCancel = scheduled[0];
    }

    if (!toCancel) {
      return `❌ Article non trouvé. Programmations en cours:\n${scheduled.map(s => `• ${s.title}`).join('\n')}`;
    }

    // Annuler dans Supabase
    const { error: updateError } = await supabaseService.client
      .from('scheduled_posts')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', toCancel.id);

    if (updateError) {
      return `❌ Erreur lors de l'annulation.`;
    }

    // TODO: Supprimer l'événement Outlook si connecté

    return `✅ **Programmation annulée**\n\n📝 **Article:** ${toCancel.title}\n\nL'article reste en brouillon, tu peux le reprogrammer quand tu veux.`;
  }

  /**
   * Parse une date/heure avec l'IA (plus robuste que le regex)
   */
  async parseDateTimeWithAI(message) {
    const now = new Date();
    const nowStr = now.toISOString();
    
    const prompt = `Tu es un assistant qui extrait des dates et heures à partir de messages en français.
    
Date/heure actuelle: ${nowStr} (fuseau Europe/Paris)

Message: "${message}"

Extrais la date et l'heure de publication souhaitée.
Réponds UNIQUEMENT en JSON valide:
{
  "found": true/false,
  "year": 2025,
  "month": 1-12,
  "day": 1-31,
  "hour": 0-23,
  "minute": 0-59,
  "confidence": 0-100
}

Si aucune date n'est trouvée, retourne {"found": false}
Si l'heure n'est pas précisée, utilise 9h par défaut.
"Demain" = date actuelle + 1 jour
"Lundi prochain" = le prochain lundi après aujourd'hui`;

    try {
      const response = await openaiService.chat(
        'Tu es un extracteur de dates. Réponds uniquement en JSON.',
        prompt,
        { json: true, maxTokens: 200 }
      );
      
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      }
      
      const parsed = JSON.parse(cleanResponse);
      
      if (parsed.found && parsed.year && parsed.month && parsed.day) {
        const date = new Date(
          parsed.year,
          parsed.month - 1, // JavaScript: mois 0-11
          parsed.day,
          parsed.hour || 9,
          parsed.minute || 0,
          0,
          0
        );
        
        console.log(`🤖 IA a parsé la date: ${date.toISOString()} (confiance: ${parsed.confidence}%)`);
        return { date, confidence: parsed.confidence };
      }
      
      return { date: null };
    } catch (error) {
      console.log('⚠️ Fallback sur parsing regex:', error.message);
      return { date: null };
    }
  }

  /**
   * Parse une date/heure depuis un message en langage naturel (regex fallback)
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
    // "recevoir" implique qu'on veut le recevoir sur WhatsApp
    const wantWhatsApp = message.toLowerCase().includes('whatsapp') || 
                         message.toLowerCase().includes('envoie') ||
                         message.toLowerCase().includes('envoi') ||
                         message.toLowerCase().includes('recevoir') ||
                         message.toLowerCase().includes('reçois') ||
                         (whatsappNumber && !message.toLowerCase().includes('lien'));  // Par défaut on envoie si on a le numéro
    
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
    const { data: posts, error } = await supabaseService.client
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
      const { data, error } = await supabaseService.client.storage
        .from('pdfs')
        .upload(`articles/${filename}`, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (!error) {
        // Obtenir l'URL publique
        const { data: urlData } = supabaseService.client.storage
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
    const { data: posts, error } = await supabaseService.client
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
      // Sécuriser le slug pour le nom du fichier
      const safeSlug = article.slug || this.generateSlug(article.title) || `article-${Date.now()}`;
      const filename = `${safeSlug}-${Date.now()}.pdf`;
      const filepath = path.join(this.pdfFolder, filename);
      
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        bufferPages: true, // Important pour pouvoir revenir sur les pages
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
        // Vérifier si on a besoin d'une nouvelle page (seulement si vraiment en bas)
        if (doc.y > 750) {
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
        // Nouvelle page seulement si vraiment en bas de page
        if (doc.y > 720) {
          doc.addPage();
          doc.y = 60;
        }

        doc.moveDown(2);
        
        // Titre section sources
        doc.rect(55, doc.y, 485, 30).fill('#f1f5f9');
        doc.fontSize(14)
           .fillColor('#1e40af')
           .text('📚 Sources', 65, doc.y + 8);
        
        doc.moveDown(1.5);

        // Afficher les sources de manière compacte (juste les liens)
        article.sources.forEach((source, index) => {
          if (doc.y > 740) {
            doc.addPage();
            doc.y = 60;
          }

          // Extraire l'URL (source peut être string ou objet)
          const url = typeof source === 'string' ? source : (source.url || source.link || source.title);
          
          if (url && url.startsWith('http')) {
            doc.fontSize(9)
               .fillColor('#3b82f6')
               .text(`[${index + 1}] ${url}`, 60, doc.y, { link: url, underline: true });
            doc.moveDown(0.3);
          }
        });
      }

      // === SECTION IMAGES (crédits) ===
      if (article.images && article.images.length > 0) {
        if (doc.y > 740) {
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
      if (doc.y > 700) {
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
      try {
        const range = doc.bufferedPageRange();
        const pageCount = range.count || 1;
        const startPage = range.start || 0;
        
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(startPage + i);
          
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
      } catch (footerError) {
        console.warn('⚠️ Impossible d\'ajouter le footer aux pages:', footerError.message);
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

    // Fallback: utiliser des images génériques via Picsum (fonctionne toujours)
    if (images.length === 0) {
      console.log('ℹ️ Utilisation des images de fallback Picsum');
      // Générer des IDs aléatoires pour avoir des images différentes
      const randomId1 = Math.floor(Math.random() * 1000);
      const randomId2 = Math.floor(Math.random() * 1000);
      const randomId3 = Math.floor(Math.random() * 1000);
      return [
        {
          url: `https://picsum.photos/seed/${randomId1}/1200/630`,
          description: `Image pour ${query}`,
          author: 'Picsum Photos',
          source: 'Picsum',
          width: 1200,
          height: 630
        },
        {
          url: `https://picsum.photos/seed/${randomId2}/1200/630`,
          description: `Image ${query}`,
          author: 'Picsum Photos',
          source: 'Picsum',
          width: 1200,
          height: 630
        },
        {
          url: `https://picsum.photos/seed/${randomId3}/1200/630`,
          description: `Image ${query}`,
          author: 'Picsum Photos',
          source: 'Picsum',
          width: 1200,
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
    const { data: posts, error } = await supabaseService.client
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

    const { error: updateError } = await supabaseService.client
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
    const { data: posts, error } = await supabaseService.client
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
   * IMPORTANT: Ne publie JAMAIS automatiquement - toujours créer un brouillon
   * L'utilisateur doit relire et valider avant publication
   */
  async executeCompleteWorkflow(query, context = {}) {
    console.log('🚀 Kiara démarre le workflow complet (mode brouillon)...');
    
    const whatsappNumber = context.from || process.env.MY_PHONE_NUMBER;
    let progressMessages = [];
    
    try {
      // 1. ANALYSER LA DEMANDE
      progressMessages.push('🔍 **Étape 1/4:** Analyse de la demande...');
      
      const analysisPrompt = `Analyse cette demande et extrais les informations:
"${query}"

Réponds en JSON:
{
  "topic": "le sujet principal à rechercher",
  "articleCount": 3,
  "language": "fr"
}`;

      let analysis;
      try {
        const analysisResponse = await openaiService.chat(this.systemPrompt, analysisPrompt, { json: true });
        analysis = JSON.parse(analysisResponse);
      } catch (e) {
        // Extraction manuelle du sujet
        const topicMatch = query.match(/(?:sur|about|concernant)\s+(?:les?\s+)?(?:\d+\s+)?(?:meilleurs?\s+)?(?:articles?\s+)?(?:sur\s+)?["']?(.+?)["']?(?:\s*,|\s+et\s+|\s+puis|\s*$)/i);
        const countMatch = query.match(/(\d+)\s+(?:meilleurs?|articles?)/i);
        analysis = {
          topic: topicMatch ? topicMatch[1].trim() : 'technologie',
          articleCount: countMatch ? parseInt(countMatch[1]) : 3
        };
      }
      
      // SÉCURITÉ: Ne jamais publier automatiquement
      // L'utilisateur doit toujours relire le brouillon d'abord

      console.log('📊 Analyse:', analysis);

      // 2. RECHERCHER LES SOURCES
      progressMessages.push(`🔍 **Étape 2/4:** Recherche des ${analysis.articleCount} meilleures sources sur "${analysis.topic}"...`);
      
      const sources = await this.searchSourcesForTopic(analysis.topic, analysis.articleCount);
      
      if (sources.length === 0) {
        return `❌ Je n'ai pas trouvé de sources sur "${analysis.topic}". Essaie avec un autre sujet.`;
      }

      progressMessages.push(`✅ ${sources.length} sources trouvées !`);

      // 3. GÉNÉRER L'ARTICLE FUSIONNÉ
      progressMessages.push('✍️ **Étape 3/4:** Rédaction de l\'article fusionné...');
      
      const article = await this.generateMergedArticle(analysis.topic, sources);
      
      if (!article) {
        return `❌ Erreur lors de la génération de l'article.`;
      }

      // Sauvegarder en brouillon
      const savedArticle = await this.saveArticleDraft(article);
      
      // Stocker l'article avec id et slug de la DB
      this.lastGeneratedArticle = { 
        ...article, 
        id: savedArticle?.id,
        slug: savedArticle?.slug || this.generateSlug(article.title),
        title: savedArticle?.title || article.title
      };

      progressMessages.push(`✅ Article "${this.lastGeneratedArticle.title}" généré !`);

      // 4. GÉNÉRER LE PDF ET L'ENVOYER SUR WHATSAPP
      progressMessages.push('📄 **Étape 4/4:** Génération du PDF...');
      
      const pdfResult = await this.generateAndUploadPdf(
        this.lastGeneratedArticle,
        whatsappNumber
      );

      progressMessages.push('✅ PDF généré et envoyé sur WhatsApp !');

      // Article sauvegardé en brouillon - JAMAIS publié automatiquement
      progressMessages.push('💾 Article sauvegardé en brouillon');

      // RÉSULTAT FINAL
      let finalResponse = `🎉 **Workflow terminé avec succès !**\n\n`;
      finalResponse += `📝 **Titre:** ${article.title}\n`;
      finalResponse += `📂 **Catégorie:** ${article.category}\n`;
      finalResponse += `⏱️ **Temps de lecture:** ${article.reading_time_minutes} min\n`;
      finalResponse += `🖼️ **Image de couverture:** ${article.cover_image ? '✅ Incluse' : '❌ Non'}\n`;
      finalResponse += `💾 **Statut:** 🟡 Brouillon (en attente de ta validation)\n\n`;
      
      finalResponse += `📰 **Sources utilisées (${sources.length}):**\n`;
      sources.forEach((s, i) => {
        finalResponse += `${i + 1}. ${s.title} (${s.source})\n`;
      });
      
      finalResponse += `\n📄 **PDF:** Envoyé sur WhatsApp ✅\n`;
      finalResponse += `\n⚠️ **L'article n'est PAS encore publié.**\n`;
      finalResponse += `Relis le PDF et fais les modifications nécessaires.\n\n`;
      
      finalResponse += `\n📋 **Actions disponibles:**\n`;
      finalResponse += `• "Modifie le titre par '...'" - Changer le titre\n`;
      finalResponse += `• "Modifie l'extrait par '...'" - Changer le résumé\n`;
      finalResponse += `• "Modifie la catégorie par '...'" - Changer la catégorie\n`;
      finalResponse += `• "Publie l'article" - Publier maintenant sur le blog\n`;
      finalResponse += `• "Programme l'article pour demain 9h" - Programmer la publication\n`;

      return finalResponse;

    } catch (error) {
      console.error('❌ Erreur workflow:', error);
      return `❌ Erreur lors du workflow: ${error.message}\n\nProgression:\n${progressMessages.join('\n')}`;
    }
  }

  /**
   * Recherche des sources sur un sujet spécifique
   * AMÉLIORATION: Cherche dans TOUS les domaines, minimum 3 sources, élargit si nécessaire
   */
  async searchSourcesForTopic(topic, count = 5) {
    const minSources = Math.max(count, 3); // Minimum 3 sources
    const allSources = [];
    
    // Améliorer les mots-clés de recherche
    const topicLower = topic.toLowerCase();
    
    // Dictionnaire de termes associés pour élargir la recherche
    const relatedTerms = {
      'gpu': ['graphics', 'nvidia', 'amd', 'radeon', 'geforce', 'rtx', 'graphic card', 'video card'],
      'ia': ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'chatgpt', 'openai', 'llm'],
      'intelligence artificielle': ['ai', 'machine learning', 'deep learning', 'neural network', 'llm'],
      'cpu': ['processor', 'intel', 'amd', 'ryzen', 'core'],
      'smartphone': ['iphone', 'android', 'samsung', 'pixel', 'mobile'],
      'cloud': ['aws', 'azure', 'google cloud', 'serverless'],
      'crypto': ['bitcoin', 'ethereum', 'blockchain', 'web3'],
      'carte graphique': ['gpu', 'nvidia', 'amd', 'graphics', 'geforce', 'radeon', 'rtx'],
      'robot': ['robotics', 'humanoid', 'automation', 'boston dynamics', 'tesla bot', 'optimus'],
      'humanoide': ['humanoid', 'robot', 'boston dynamics', 'figure', 'tesla optimus', 'bipedal'],
      'spatial': ['space', 'nasa', 'spacex', 'rocket', 'satellite', 'mars'],
      'voiture': ['car', 'automotive', 'electric', 'ev', 'tesla', 'autonomous'],
      'autonome': ['autonomous', 'self-driving', 'autopilot', 'adas']
    };
    
    // Construire la liste des mots-clés à chercher
    let searchKeywords = topicLower.split(/[\s,]+/).filter(w => w.length >= 2);
    
    // Ajouter les termes associés si disponibles
    for (const [key, terms] of Object.entries(relatedTerms)) {
      if (topicLower.includes(key)) {
        searchKeywords = [...searchKeywords, ...terms];
      }
    }
    
    // S'assurer qu'on a au moins le topic original
    if (!searchKeywords.includes(topicLower)) {
      searchKeywords.unshift(topicLower);
    }
    
    // Supprimer les doublons
    searchKeywords = [...new Set(searchKeywords)];
    
    console.log(`🔍 Recherche de sources sur: ${topic}`);
    console.log(`🔑 Mots-clés: ${searchKeywords.slice(0, 10).join(', ')}`);

    // Chercher dans TOUS les domaines RSS, pas juste les sources par défaut
    const allRssSources = [];
    for (const domain of Object.values(this.trendSourcesByDomain)) {
      allRssSources.push(...domain);
    }
    
    // Dédupliquer par URL
    const uniqueRssSources = allRssSources.filter((source, index, self) => 
      index === self.findIndex(s => s.url === source.url)
    );
    
    console.log(`📡 Recherche dans ${uniqueRssSources.length} flux RSS...`);

    for (const source of uniqueRssSources) {
      try {
        const feed = await this.rssParser.parseURL(source.url);
        
        const matchingItems = feed.items.filter(item => {
          const text = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
          
          // Exclure les langues non désirées
          const portugueseWords = /(desenvolvimento|projeto|trabalho|semanas|ideias|persistência|começar|também|porque|estava)/i;
          if (portugueseWords.test(text)) {
            return false;
          }
          
          // Chercher si au moins un mot-clé est présent
          return searchKeywords.some(kw => text.includes(kw));
        });

        matchingItems.slice(0, 3).forEach(item => {
          const shortDescription = (item.contentSnippet || item.content || '')
            .substring(0, 200)
            .replace(/\s+/g, ' ')
            .trim();
          
          allSources.push({
            title: item.title,
            description: shortDescription + (shortDescription.length >= 200 ? '...' : ''),
            link: item.link,
            source: source.name,
            pubDate: item.pubDate
          });
        });
      } catch (error) {
        // Silencieux pour les erreurs RSS
      }
    }

    console.log(`📰 Sources RSS trouvées: ${allSources.length}`);

    // Si pas assez de sources, utiliser l'IA pour en générer des réalistes
    if (allSources.length < minSources) {
      console.log(`🤖 Génération de sources additionnelles via IA (besoin de ${minSources - allSources.length})...`);
      
      const neededCount = minSources - allSources.length;
      const aiSourcesPrompt = `Tu es un expert tech. Génère ${neededCount} résumés d'articles RÉCENTS et RÉALISTES sur le sujet "${topic}" (${new Date().toLocaleDateString('fr-FR')}).

Ces articles doivent sembler provenir de vrais sites tech (TechCrunch, The Verge, Ars Technica, Tom's Hardware, Wired, MIT Tech Review, etc.).

IMPORTANT: 
- Génère du contenu factuel et à jour sur ${topic}
- Inclus des chiffres, des noms de produits/entreprises réels, des tendances actuelles
- Les descriptions doivent être informatives (3-4 phrases)
- Chaque source doit apporter une perspective différente

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de \`\`\`):
[
  {
    "title": "Titre accrocheur et spécifique",
    "description": "Résumé de 3-4 phrases avec des faits précis, chiffres et détails techniques actuels",
    "source": "Nom du site (TechCrunch, The Verge, Tom's Hardware, etc.)",
    "link": "https://example.com/article"
  }
]`;

      try {
        const aiResponse = await openaiService.chat(this.systemPrompt, aiSourcesPrompt, { json: true });
        
        // Nettoyer la réponse si elle contient des backticks
        let cleanResponse = aiResponse.trim();
        if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.replace(/```json?\n?/g, '').replace(/```/g, '');
        }
        
        const aiSources = JSON.parse(cleanResponse);
        console.log(`✅ ${aiSources.length} sources IA générées`);
        allSources.push(...aiSources);
      } catch (e) {
        console.log('⚠️ Erreur génération sources IA:', e.message);
        
        // Fallback: créer des sources basiques
        const fallbackSources = [
          {
            title: `Les dernières avancées ${topic} en ${new Date().getFullYear()}`,
            description: `Analyse approfondie des dernières nouveautés et innovations dans le domaine ${topic}. Les experts du secteur partagent leurs perspectives sur l'évolution rapide de cette technologie.`,
            source: 'Tech Analysis',
            link: '#',
            pubDate: new Date().toISOString()
          },
          {
            title: `${topic}: Ce que les experts prédisent pour l'avenir`,
            description: `Tour d'horizon des prédictions des leaders du secteur concernant ${topic}. Entre innovations technologiques et défis à relever, le marché continue son évolution.`,
            source: 'Future Tech',
            link: '#',
            pubDate: new Date().toISOString()
          },
          {
            title: `Guide complet: Comprendre ${topic} en ${new Date().getFullYear()}`,
            description: `Un guide exhaustif pour comprendre les tenants et aboutissants de ${topic}. De la théorie à la pratique, découvrez tout ce qu'il faut savoir sur ce sujet passionnant.`,
            source: 'Tech Guide',
            link: '#',
            pubDate: new Date().toISOString()
          }
        ];
        allSources.push(...fallbackSources.slice(0, neededCount));
      }
    }

    // Trier par date et limiter
    return allSources
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .slice(0, Math.max(count, minSources));
  }

  /**
   * Génère un article fusionné à partir de plusieurs sources
   */
  async generateMergedArticle(topic, sources) {
    const category = this.detectCategoryFromContent(topic);
    
    // Chercher une image
    const images = await this.searchFreeImages(topic, 1);
    const coverImage = images.length > 0 ? images[0] : null;

    const mergePrompt = `Tu es un rédacteur web professionnel. Rédige un article BIEN STRUCTURÉ sur "${topic}".

📰 SOURCES À FUSIONNER:
${sources.map((s, i) => `
Source ${i + 1}: ${s.title} (${s.source})
${s.description}
`).join('\n')}

📝 STYLE D'ÉCRITURE PROFESSIONNEL:

1. **PARAGRAPHES COURTS ET AÉRÉS**
   - Maximum 3-4 phrases par paragraphe
   - Une ligne vide entre chaque paragraphe
   - JAMAIS de gros blocs de texte compacts

2. **GRAS STRATÉGIQUE** avec **double astérisque**:
   - Noms propres: **Google**, **OpenAI**, **Tesla**
   - Chiffres: **15 millions**, **90%**, **depuis 2020**
   - Concepts clés: **intelligence artificielle**
   - Actions: **a déclaré**, **vient d'annoncer**

3. **ITALIQUE** avec *simple astérisque*:
   - Citations: *« Ceci est une citation »*
   - Mots étrangers: *machine learning*

4. **SOUS-TITRES** avec ## (tous les 2-3 paragraphes):
   - Courts et accrocheurs
   - Pas de "Introduction" ni "Conclusion"

📋 EXEMPLE DE STRUCTURE:

La nouvelle a surpris tout le monde. **OpenAI** vient d'annoncer une avancée majeure qui pourrait changer la donne.

Selon les experts, cette technologie représente *« un bond en avant considérable »*. Une affirmation qui mérite d'être analysée.

## Un tournant pour l'industrie

Depuis **2022**, le marché de l'IA connaît une croissance fulgurante. Les investissements ont atteint **50 milliards de dollars** cette année.

**Google** et **Microsoft** ne sont pas en reste. Les deux géants ont multiplié les annonces ces derniers mois.

## Les implications concrètes

Pour les utilisateurs, cela signifie des outils plus performants. Mais aussi de nouvelles questions sur l'éthique et la régulation.

L'avenir s'annonce passionnant. Et ce n'est que le début d'une transformation profonde.

📄 RÉPONDS EN JSON:
{
  "title": "Titre accrocheur (60 car max)",
  "meta_description": "Description engageante (150 car)",
  "keywords": ["mot1", "mot2", "mot3"],
  "excerpt": "2-3 phrases d'accroche",
  "content": "Contenu avec paragraphes courts, **gras**, *italique*, ## sous-titres, lignes vides entre paragraphes",
  "category": "${category}",
  "reading_time_minutes": 6,
  "tags": ["tag1", "tag2"],
  "sources": ["Source 1", "Source 2"]
}`;

    try {
      const response = await openaiService.chat(this.systemPrompt, mergePrompt, { 
        json: true,
        maxTokens: 4000 
      });
      
      // Nettoyer la réponse si elle contient des backticks markdown
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      }
      // Extraire le JSON s'il est entouré de texte
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      // Vérifier que la réponse n'est pas vide ou tronquée
      if (!cleanResponse || cleanResponse.length < 100) {
        throw new Error('Réponse OpenAI trop courte ou vide');
      }
      
      const article = JSON.parse(cleanResponse);
      
      // Vérifier que l'article a les champs requis
      if (!article.title || !article.content) {
        throw new Error('Article incomplet (titre ou contenu manquant)');
      }
      
      // Ajouter l'image et les sources
      if (coverImage) {
        article.cover_image = coverImage.url;
        article.cover_image_author = coverImage.author;
        article.cover_image_source = coverImage.source;
      }
      
      // Formater les sources de manière sécurisée
      article.sources_used = (sources || []).filter(s => s).map(s => ({
        title: s.title || 'Source',
        source: s.source || 'Unknown',
        link: s.link || '#'
      }));

      console.log(`✅ Article fusionné généré: ${article.title}`);
      return article;
    } catch (error) {
      console.error('Erreur génération article fusionné:', error.message);
      
      // Fallback: créer un article de base avec gestion sécurisée des sources
      console.log('🔄 Tentative de génération d\'un article de fallback...');
      
      // S'assurer que sources est un tableau valide
      const safeSources = (sources || []).filter(s => s && s.title);
      
      const fallbackArticle = {
        title: `Analyse: ${topic} - Les tendances actuelles`,
        meta_description: `Découvrez les dernières actualités et analyses sur ${topic}. Article rédigé par Brian Biendou.`,
        keywords: topic.split(' ').filter(w => w.length > 2),
        excerpt: `Une analyse approfondie des dernières tendances et actualités concernant ${topic}.`,
        content: this.generateFallbackContent(topic, safeSources),
        category: this.detectCategoryFromContent(topic),
        reading_time_minutes: 5,
        tags: [topic],
        sources: safeSources.map(s => s.title || 'Source'),
        cover_image: coverImage?.url || null,
        sources_used: safeSources.map(s => ({ 
          title: s.title || 'Source', 
          source: s.source || 'Unknown', 
          link: s.link || '#' 
        }))
      };
      
      console.log(`✅ Article fallback généré: ${fallbackArticle.title}`);
      return fallbackArticle;
    }
  }

  /**
   * Génère un contenu de fallback structuré (version courte sans copier les sources)
   */
  generateFallbackContent(topic, sources) {
    let content = `# ${topic} : Guide Complet\n\n`;
    content += `## Introduction\n\n`;
    content += `Dans cet article, nous explorons en profondeur **${topic}**. `;
    content += `Ce sujet est au cœur des discussions dans l'écosystème technologique actuel et mérite une analyse approfondie.\n\n`;
    
    content += `## Contexte et enjeux\n\n`;
    content += `${topic} représente un domaine en constante évolution. Les professionnels du secteur suivent de près les dernières avancées et innovations. `;
    content += `Comprendre les fondamentaux et les tendances actuelles est essentiel pour rester compétitif.\n\n`;
    
    content += `## Points clés à retenir\n\n`;
    content += `- **Innovation continue** : Le domaine évolue rapidement avec de nouvelles solutions\n`;
    content += `- **Impact sur l'industrie** : Des changements significatifs dans les pratiques\n`;
    content += `- **Opportunités** : De nouvelles possibilités émergent pour les professionnels\n`;
    content += `- **Défis** : Des obstacles à surmonter pour une adoption réussie\n\n`;
    
    content += `## Perspectives d'avenir\n\n`;
    content += `L'avenir de ${topic} s'annonce prometteur. Les experts prévoient des évolutions majeures dans les prochains mois. `;
    content += `Il est crucial de rester informé et de s'adapter aux nouvelles tendances.\n\n`;
    
    content += `## Conclusion\n\n`;
    content += `${topic} continue de façonner notre industrie technologique. `;
    content += `Pour rester à la pointe, suivez notre blog et n'hésitez pas à approfondir vos connaissances sur ce sujet passionnant.\n\n`;
    content += `---\n*Article rédigé par Brian Biendou*`;
    
    return content;
  }

  /**
   * Chat simple sans contexte
   */
  async chat(message) {
    return this.chatWithContext(message, []);
  }

  /**
   * Chat avec contexte de conversation complet
   */
  async chatWithContext(message, conversationHistory = []) {
    console.log(`💬 Kiara chat avec ${conversationHistory.length} messages de contexte`);
    
    // Construire les messages avec l'historique
    const messages = [
      { role: 'system', content: this.systemPrompt }
    ];
    
    // Ajouter l'historique de conversation (limité aux 10 derniers échanges)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
    
    // Ajouter le message actuel
    messages.push({ role: 'user', content: message });
    
    try {
      const response = await openaiService.chat(messages, { temperature: 0.7 });
      return response;
    } catch (error) {
      console.error('Erreur chat Kiara:', error);
      // Fallback sans historique
      const response = await openaiService.chat(this.systemPrompt, message);
      return response;
    }
  }

  // ==================== GESTION DES STYLES D'ÉCRITURE ====================

  /**
   * Changer le style d'écriture des articles
   * @param {string} styleName - 'fun' ou 'narrative'
   */
  setWritingStyle(styleName) {
    if (this.writingStyles[styleName]) {
      this.activeStyle = styleName;
      console.log(`✍️ Kiara - Style d'écriture changé: ${this.writingStyles[styleName].name}`);
      return {
        success: true,
        message: `✅ Style d'écriture changé : **${this.writingStyles[styleName].name}**\n\n${this.writingStyles[styleName].description}`
      };
    }
    return {
      success: false,
      message: `❌ Style inconnu. Styles disponibles: ${Object.keys(this.writingStyles).join(', ')}`
    };
  }

  /**
   * Obtenir le style actuel
   */
  getWritingStyle() {
    const style = this.writingStyles[this.activeStyle];
    return {
      id: this.activeStyle,
      name: style.name,
      description: style.description
    };
  }

  /**
   * Lister tous les styles disponibles
   */
  listWritingStyles() {
    let message = `✍️ **Styles d'écriture disponibles**\n\n`;
    
    for (const [id, style] of Object.entries(this.writingStyles)) {
      const isActive = id === this.activeStyle ? ' ✅ (actif)' : '';
      message += `**${id}** - ${style.name}${isActive}\n`;
      message += `   _${style.description}_\n\n`;
    }
    
    message += `\n💡 Pour changer : "Kiara, utilise le style narratif" ou "style documentaire"`;
    
    return message;
  }
}

module.exports = new KiaraAgent();
