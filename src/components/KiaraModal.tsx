import { useState, useEffect, useCallback } from 'react'
import { X, Send, Settings, History, BarChart3, Globe, Mic, Paperclip, RefreshCw, AlertCircle, Zap, TrendingUp, FileText, ThumbsUp, MessageCircle, Share2, Eye, PenTool, Calendar, Search, Image, FileDown } from 'lucide-react'
import './KiaraModal.css'

interface Article {
  id: string
  title: string
  slug: string
  category: string
  views_count: number
  likes_count: number
  dislikes_count: number
  comments_count: number
  shares_count: number
  published_at: string
  status: string
}

interface KiaraStats {
  totalArticles: number
  publishedArticles: number
  draftsCount: number
  totalViews: number
  totalLikes: number
  totalComments: number
  totalShares: number
  avgEngagement: number
}

interface KiaraModalProps {
  isOpen: boolean
  onClose: () => void
  agent: {
    name: string
    role: string
    image: string
    gradient: string
  }
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const SUPABASE_URL = 'https://cagfwdtoebzotbhpkvvr.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZ2Z3ZHRvZWJ6b3RiaHBrdnZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczMjY3MDYsImV4cCI6MjA2MjkwMjcwNn0.gy6z-x5BVaP1vj8lLlzpHTjOe5pNXC9bNY17Y8Ag_9I'

const KiaraModal = ({ isOpen, onClose, agent }: KiaraModalProps) => {
  const [message, setMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'articles' | 'trending'>('dashboard')
  
  const [stats, setStats] = useState<KiaraStats>({
    totalArticles: 0,
    publishedArticles: 0,
    draftsCount: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    avgEngagement: 0
  })
  
  const [articles, setArticles] = useState<Article[]>([])
  const [topArticles, setTopArticles] = useState<Article[]>([])

  // Récupérer les données depuis Supabase
  const fetchKiaraData = useCallback(async () => {
    if (!isOpen) return
    
    try {
      setError(null)
      
      // Récupérer les articles depuis Supabase
      const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?select=*&order=published_at.desc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      })

      if (res.ok) {
        const data: Article[] = await res.json()
        setArticles(data)
        
        // Calculer les stats
        const published = data.filter(a => a.status === 'published')
        const drafts = data.filter(a => a.status === 'draft')
        
        const totalViews = published.reduce((sum, a) => sum + (a.views_count || 0), 0)
        const totalLikes = published.reduce((sum, a) => sum + (a.likes_count || 0), 0)
        const totalComments = published.reduce((sum, a) => sum + (a.comments_count || 0), 0)
        const totalShares = published.reduce((sum, a) => sum + (a.shares_count || 0), 0)
        
        const avgEngagement = published.length > 0 
          ? ((totalLikes + totalComments + totalShares) / totalViews * 100) || 0 
          : 0

        setStats({
          totalArticles: data.length,
          publishedArticles: published.length,
          draftsCount: drafts.length,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          avgEngagement: Math.round(avgEngagement * 100) / 100
        })

        // Top articles par engagement
        const sorted = [...published].sort((a, b) => {
          const scoreA = (a.likes_count || 0) * 3 + (a.comments_count || 0) * 5 + (a.shares_count || 0) * 10 + (a.views_count || 0) * 0.1
          const scoreB = (b.likes_count || 0) * 3 + (b.comments_count || 0) * 5 + (b.shares_count || 0) * 10 + (b.views_count || 0) * 0.1
          return scoreB - scoreA
        })
        setTopArticles(sorted.slice(0, 5))
      }

    } catch (err) {
      console.error('Erreur fetch Kiara data:', err)
      setError('Impossible de charger les données')
    } finally {
      setLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    fetchKiaraData()
    const interval = setInterval(fetchKiaraData, 60000) // Refresh toutes les minutes
    return () => clearInterval(interval)
  }, [fetchKiaraData])

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log('Message envoyé à Kiara:', message)
      setMessage('')
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
    return num.toString()
  }

  if (!isOpen) return null

  return (
    <div className="kiara-modal-overlay" onClick={onClose}>
      <div className="kiara-modal-container" onClick={e => e.stopPropagation()}>
        {/* Header avec gradient rose/violet */}
        <div className="kiara-modal-header">
          <div className="kiara-header-content">
            <div className="kiara-avatar-wrapper">
              <img src={agent.image} alt={agent.name} className="kiara-avatar" />
              <span className="kiara-status-dot"></span>
            </div>
            <div className="kiara-header-info">
              <h2>{agent.name}</h2>
              <span className="kiara-role">{agent.role}</span>
            </div>
          </div>
          <button className="kiara-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="kiara-tabs">
          <button 
            className={`kiara-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 size={18} />
            Dashboard
          </button>
          <button 
            className={`kiara-tab ${activeTab === 'articles' ? 'active' : ''}`}
            onClick={() => setActiveTab('articles')}
          >
            <FileText size={18} />
            Articles
          </button>
          <button 
            className={`kiara-tab ${activeTab === 'trending' ? 'active' : ''}`}
            onClick={() => setActiveTab('trending')}
          >
            <TrendingUp size={18} />
            Top Performers
          </button>
        </div>

        {/* Main Content */}
        <div className="kiara-modal-content">
          {error && (
            <div className="kiara-error-banner">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="kiara-dashboard">
              {/* Stats Cards */}
              <div className="kiara-stats-grid">
                <div className="kiara-stat-card purple">
                  <div className="stat-icon"><FileText size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.publishedArticles}</span>
                    <span className="stat-label">Articles publiés</span>
                  </div>
                </div>
                <div className="kiara-stat-card blue">
                  <div className="stat-icon"><Eye size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{formatNumber(stats.totalViews)}</span>
                    <span className="stat-label">Vues totales</span>
                  </div>
                </div>
                <div className="kiara-stat-card green">
                  <div className="stat-icon"><ThumbsUp size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{formatNumber(stats.totalLikes)}</span>
                    <span className="stat-label">Likes</span>
                  </div>
                </div>
                <div className="kiara-stat-card orange">
                  <div className="stat-icon"><MessageCircle size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{formatNumber(stats.totalComments)}</span>
                    <span className="stat-label">Commentaires</span>
                  </div>
                </div>
                <div className="kiara-stat-card pink">
                  <div className="stat-icon"><Share2 size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{formatNumber(stats.totalShares)}</span>
                    <span className="stat-label">Partages</span>
                  </div>
                </div>
                <div className="kiara-stat-card cyan">
                  <div className="stat-icon"><TrendingUp size={24} /></div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.avgEngagement}%</span>
                    <span className="stat-label">Engagement</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="kiara-section">
                <h3><Zap size={20} /> Commandes rapides</h3>
                <div className="kiara-quick-actions">
                  <div className="quick-action-card">
                    <span className="action-icon">📝</span>
                    <div className="action-info">
                      <strong>Générer un article</strong>
                      <code>"Rédige un article sur [sujet]"</code>
                    </div>
                  </div>
                  <div className="quick-action-card">
                    <span className="action-icon">🔥</span>
                    <div className="action-info">
                      <strong>Tendances</strong>
                      <code>"Quelles sont les tendances tech ?"</code>
                    </div>
                  </div>
                  <div className="quick-action-card">
                    <span className="action-icon">📊</span>
                    <div className="action-info">
                      <strong>Statistiques</strong>
                      <code>"Stats de mon blog"</code>
                    </div>
                  </div>
                  <div className="quick-action-card">
                    <span className="action-icon">🚀</span>
                    <div className="action-info">
                      <strong>Publier</strong>
                      <code>"Publie l'article"</code>
                    </div>
                  </div>
                  <div className="quick-action-card">
                    <span className="action-icon">📅</span>
                    <div className="action-info">
                      <strong>Programmer</strong>
                      <code>"Programme pour demain 10h"</code>
                    </div>
                  </div>
                  <div className="quick-action-card">
                    <span className="action-icon">📄</span>
                    <div className="action-info">
                      <strong>PDF</strong>
                      <code>"PDF de l'article"</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* Brouillons en attente */}
              {stats.draftsCount > 0 && (
                <div className="kiara-section drafts-section">
                  <h3><PenTool size={20} /> Brouillons en attente ({stats.draftsCount})</h3>
                  <div className="drafts-list">
                    {articles.filter(a => a.status === 'draft').slice(0, 3).map(draft => (
                      <div key={draft.id} className="draft-item">
                        <span className="draft-title">{draft.title}</span>
                        <span className="draft-category">{draft.category || 'Non catégorisé'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WhatsApp Info */}
              <div className="kiara-whatsapp-info">
                <span>💬</span>
                <p>Communiquez avec <strong>Kiara</strong> via WhatsApp. Envoyez vos commandes à Brian qui transmettra à Kiara.</p>
              </div>
            </div>
          )}

          {activeTab === 'articles' && (
            <div className="kiara-articles">
              <div className="articles-header">
                <h3>Tous les articles ({articles.length})</h3>
                <button className="refresh-btn" onClick={fetchKiaraData}>
                  <RefreshCw size={16} />
                </button>
              </div>
              
              <div className="articles-table-wrapper">
                <table className="articles-table">
                  <thead>
                    <tr>
                      <th>Titre</th>
                      <th>Catégorie</th>
                      <th>Status</th>
                      <th><Eye size={14} /></th>
                      <th><ThumbsUp size={14} /></th>
                      <th><MessageCircle size={14} /></th>
                      <th><Share2 size={14} /></th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="loading-cell">Chargement...</td></tr>
                    ) : articles.length === 0 ? (
                      <tr><td colSpan={8} className="empty-cell">Aucun article</td></tr>
                    ) : (
                      articles.map(article => (
                        <tr key={article.id} className={article.status === 'draft' ? 'draft-row' : ''}>
                          <td className="title-cell">
                            <a href={`https://brian-biendou.com/blog/${article.slug}`} target="_blank" rel="noopener noreferrer">
                              {article.title.length > 40 ? article.title.substring(0, 40) + '...' : article.title}
                            </a>
                          </td>
                          <td><span className="category-badge">{article.category || '-'}</span></td>
                          <td>
                            <span className={`status-badge ${article.status}`}>
                              {article.status === 'published' ? '✅' : '📝'} {article.status}
                            </span>
                          </td>
                          <td>{formatNumber(article.views_count || 0)}</td>
                          <td>{formatNumber(article.likes_count || 0)}</td>
                          <td>{formatNumber(article.comments_count || 0)}</td>
                          <td>{formatNumber(article.shares_count || 0)}</td>
                          <td>{formatDate(article.published_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'trending' && (
            <div className="kiara-trending">
              <h3>🏆 Top 5 Articles par Engagement</h3>
              <p className="trending-subtitle">Classement basé sur: likes × 3 + commentaires × 5 + partages × 10 + vues × 0.1</p>
              
              <div className="top-articles-list">
                {loading ? (
                  <p className="loading-text">Chargement...</p>
                ) : topArticles.length === 0 ? (
                  <p className="empty-text">Aucun article publié</p>
                ) : (
                  topArticles.map((article, index) => (
                    <div key={article.id} className={`top-article-card rank-${index + 1}`}>
                      <div className="rank-badge">#{index + 1}</div>
                      <div className="article-content">
                        <h4>{article.title}</h4>
                        <span className="article-category">{article.category}</span>
                        <div className="article-stats">
                          <span><Eye size={14} /> {formatNumber(article.views_count || 0)}</span>
                          <span><ThumbsUp size={14} /> {formatNumber(article.likes_count || 0)}</span>
                          <span><MessageCircle size={14} /> {formatNumber(article.comments_count || 0)}</span>
                          <span><Share2 size={14} /> {formatNumber(article.shares_count || 0)}</span>
                        </div>
                      </div>
                      <a 
                        href={`https://brian-biendou.com/blog/${article.slug}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="view-article-btn"
                      >
                        Voir →
                      </a>
                    </div>
                  ))
                )}
              </div>

              {/* Capacités de Kiara */}
              <div className="kiara-capabilities">
                <h3><Zap size={20} /> Toutes les capacités de Kiara</h3>
                <div className="capabilities-grid">
                  <div className="capability-item">
                    <Search size={18} />
                    <span>Recherche de tendances</span>
                  </div>
                  <div className="capability-item">
                    <PenTool size={18} />
                    <span>Rédaction SEO</span>
                  </div>
                  <div className="capability-item">
                    <Image size={18} />
                    <span>Images libres de droit</span>
                  </div>
                  <div className="capability-item">
                    <FileDown size={18} />
                    <span>Export PDF</span>
                  </div>
                  <div className="capability-item">
                    <Calendar size={18} />
                    <span>Programmation + Outlook</span>
                  </div>
                  <div className="capability-item">
                    <BarChart3 size={18} />
                    <span>Statistiques détaillées</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer avec input message */}
        <div className="kiara-modal-footer">
          <div className="kiara-message-input">
            <input
              type="text"
              placeholder="Tester une commande pour Kiara..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <div className="input-actions">
              <button className="input-action-btn"><Paperclip size={18} /></button>
              <button className="send-btn" onClick={handleSendMessage}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KiaraModal
