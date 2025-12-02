import { useState, useEffect, useCallback } from 'react'
import { X, Send, BarChart3, Paperclip, RefreshCw, AlertCircle, Zap, TrendingUp, Eye, PenTool, Globe, Mic, CheckCircle, Settings } from 'lucide-react'
import './AgentModal.css'

interface Article {
  id: string
  title: string
  slug: string
  category: string
  views_count: number
  status: string
  published_at: string
  created_at: string
  excerpt: string
}

interface KiaraStats {
  totalArticles: number
  publishedArticles: number
  draftsCount: number
  totalViews: number
  categories: { [key: string]: number }
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

// API Backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const KiaraModal = ({ isOpen, onClose, agent }: KiaraModalProps) => {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'articles' | 'trending'>('dashboard')
  
  const [stats, setStats] = useState<KiaraStats>({
    totalArticles: 0,
    publishedArticles: 0,
    draftsCount: 0,
    totalViews: 0,
    categories: {}
  })
  
  const [articles, setArticles] = useState<Article[]>([])
  const [topArticles, setTopArticles] = useState<Article[]>([])

  // Récupérer les données via le backend
  const fetchKiaraData = useCallback(async () => {
    if (!isOpen) return
    
    setLoading(true)
    
    try {
      setError(null)
      
      // Récupérer les articles via le backend (qui a accès à Supabase)
      const res = await fetch(`${API_BASE}/api/agents/kiara/blog-stats`)

      if (res.ok) {
        const data = await res.json()
        console.log('📊 Données Kiara récupérées:', data)
        
        setArticles(data.articles || [])
        setStats(data.stats || {
          totalArticles: 0,
          publishedArticles: 0,
          draftsCount: 0,
          totalViews: 0,
          categories: {}
        })
        setTopArticles(data.stats?.topArticles || [])
      } else {
        const errorText = await res.text()
        console.error('Erreur backend Kiara:', res.status, errorText)
        setError(`Erreur ${res.status}: ${errorText}`)
      }

    } catch (err) {
      console.error('Erreur fetch Kiara data:', err)
      setError('Impossible de charger les données du blog')
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header - Style James */}
        <div className="modal-header">
          <h2>{agent.name}, {agent.role}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Main Content */}
        <div className="modal-content">
          {error && (
            <div className="error-banner">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {!showSettings ? (
            <>
              {/* Agent Avatar & Chat - Style James */}
              <div className="agent-chat-section">
                <div className="agent-avatar-container">
                  <img src={agent.image} alt={agent.name} className="agent-avatar" />
                </div>
                
                <div className="chat-bubble-container">
                  <div className="chat-bubble">
                    <p className="chat-greeting">Hey, je suis {agent.name}</p>
                    <p className="chat-question">Comment puis-je vous aider ?</p>
                    <a href="#" className="see-more-link" onClick={(e) => { e.preventDefault(); setShowSettings(true); }}>
                      Configurer <span>→</span>
                    </a>
                  </div>

                  {/* Message Input */}
                  <div className="message-input-container">
                    <input
                      type="text"
                      placeholder={`Tester une commande pour ${agent.name}...`}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <div className="input-actions">
                      <button className="input-action-btn"><Paperclip size={18} /></button>
                      <button className="input-action-btn"><Globe size={18} /></button>
                      <button className="input-action-btn"><Mic size={18} /></button>
                      <button className="send-btn" onClick={handleSendMessage}>
                        <Send size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Info WhatsApp */}
                  <div className="whatsapp-info">
                    <span>💡</span>
                    <p>Utilisez <strong>WhatsApp</strong> pour communiquer avec {agent.name} via Brian. Envoyez "Génère un article sur l'IA" à Brian.</p>
                  </div>
                </div>
              </div>

              {/* Dashboard Cards - Style James */}
              <div className="features-grid">
                {/* Stats du Blog */}
                <div className="feature-card stats-card">
                  <div className="feature-icon" style={{ background: '#fce7f3' }}>
                    <BarChart3 size={24} color="#ec4899" />
                  </div>
                  <h3>Statistiques du Blog</h3>
                  {loading ? (
                    <p className="loading-text">Chargement...</p>
                  ) : (
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-value">{stats.publishedArticles}</span>
                        <span className="stat-label">Articles publiés</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{stats.draftsCount}</span>
                        <span className="stat-label">Brouillons</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{formatNumber(stats.totalViews)}</span>
                        <span className="stat-label">Vues totales</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{Object.keys(stats.categories).length}</span>
                        <span className="stat-label">Catégories</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Top Articles */}
                <div className="feature-card history-card">
                  <div className="feature-icon" style={{ background: '#dbeafe' }}>
                    <TrendingUp size={24} color="#3b82f6" />
                  </div>
                  <div className="history-header">
                    <h3>Top Articles</h3>
                    <button 
                      className="sync-btn" 
                      onClick={fetchKiaraData}
                      disabled={loading}
                    >
                      <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                    </button>
                  </div>
                  {loading ? (
                    <p className="loading-text">Chargement...</p>
                  ) : topArticles.length === 0 ? (
                    <p className="no-activity">Aucun article publié</p>
                  ) : (
                    <div className="activity-list">
                      {topArticles.slice(0, 4).map((article, index) => (
                        <div key={article.id} className="activity-item">
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: index === 0 ? '#f59e0b' : index === 1 ? '#6b7280' : index === 2 ? '#b45309' : '#9ca3af',
                            marginRight: '8px'
                          }}>
                            #{index + 1}
                          </span>
                          <div className="activity-info">
                            <span className="activity-action">{article.title.substring(0, 35)}{article.title.length > 35 ? '...' : ''}</span>
                            <span className="activity-time">
                              <Eye size={12} style={{ marginRight: '4px' }} />
                              {formatNumber(article.views_count || 0)} vues
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Capacités de Kiara */}
                <div className="feature-card capabilities-card">
                  <div className="feature-icon" style={{ background: '#f3e8ff' }}>
                    <Zap size={24} color="#a855f7" />
                  </div>
                  <h3>Capacités de {agent.name}</h3>
                  <div className="capabilities-grid">
                    <div className="capability-item">
                      <span className="capability-icon">🔍</span>
                      <div className="capability-info">
                        <span className="capability-name">Recherche tendances</span>
                        <span className="capability-example">"Quelles sont les tendances tech ?"</span>
                      </div>
                    </div>
                    <div className="capability-item">
                      <span className="capability-icon">✍️</span>
                      <div className="capability-info">
                        <span className="capability-name">Rédaction article</span>
                        <span className="capability-example">"Rédige un article sur l'IA"</span>
                      </div>
                    </div>
                    <div className="capability-item">
                      <span className="capability-icon">🚀</span>
                      <div className="capability-info">
                        <span className="capability-name">Workflow complet</span>
                        <span className="capability-example">"Recherche 3 articles sur les GPU et génère un blog"</span>
                      </div>
                    </div>
                    <div className="capability-item">
                      <span className="capability-icon">🖼️</span>
                      <div className="capability-info">
                        <span className="capability-name">Images libres</span>
                        <span className="capability-example">"Trouve des images sur le cloud computing"</span>
                      </div>
                    </div>
                    <div className="capability-item">
                      <span className="capability-icon">📄</span>
                      <div className="capability-info">
                        <span className="capability-name">Export PDF</span>
                        <span className="capability-example">"Génère le PDF de l'article"</span>
                      </div>
                    </div>
                    <div className="capability-item">
                      <span className="capability-icon">📅</span>
                      <div className="capability-info">
                        <span className="capability-name">Programmation</span>
                        <span className="capability-example">"Programme l'article pour demain 9h"</span>
                      </div>
                    </div>
                    <div className="capability-item">
                      <span className="capability-icon">📤</span>
                      <div className="capability-info">
                        <span className="capability-name">Publication</span>
                        <span className="capability-example">"Publie l'article"</span>
                      </div>
                    </div>
                    <div className="capability-item">
                      <span className="capability-icon">✏️</span>
                      <div className="capability-info">
                        <span className="capability-name">Modification</span>
                        <span className="capability-example">"Modifie le titre par '...'"</span>
                      </div>
                    </div>
                    <div className="capability-item">
                      <span className="capability-icon">📊</span>
                      <div className="capability-info">
                        <span className="capability-name">Statistiques</span>
                        <span className="capability-example">"Stats de mon blog"</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Brouillons en attente */}
                <div className="feature-card status-card">
                  <div className="feature-icon" style={{ background: '#fef3c7' }}>
                    <PenTool size={24} color="#f59e0b" />
                  </div>
                  <h3>Brouillons</h3>
                  {loading ? (
                    <p className="loading-text">Chargement...</p>
                  ) : stats.draftsCount === 0 ? (
                    <div className="connection-status">
                      <CheckCircle size={18} className="status-icon connected" />
                      <span className="status-text connected">Aucun brouillon en attente</span>
                    </div>
                  ) : (
                    <>
                      <div className="connection-status">
                        <AlertCircle size={18} className="status-icon disconnected" style={{ color: '#f59e0b' }} />
                        <span className="status-text" style={{ color: '#f59e0b' }}>{stats.draftsCount} brouillon(s) en attente</span>
                      </div>
                      <div style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
                        {articles.filter(a => a.status === 'draft').slice(0, 3).map(d => (
                          <div key={d.id} style={{ padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                            📝 {d.title.substring(0, 30)}{d.title.length > 30 ? '...' : ''}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Configuration */}
                <div className="feature-card settings-card" onClick={() => setShowSettings(true)}>
                  <div className="feature-icon" style={{ background: '#f3f4f6' }}>
                    <Settings size={24} color="#6b7280" />
                  </div>
                  <h3>Configurer {agent.name}</h3>
                  <p>Voir les articles et statistiques détaillées</p>
                  <a href="#" className="feature-link" onClick={(e) => e.preventDefault()}>Voir plus <span>→</span></a>
                </div>
              </div>
            </>
          ) : (
            /* Articles Panel - comme settings mais pour les articles */
            <div className="settings-panel">
              <div className="settings-header">
                <button className="back-btn" onClick={() => setShowSettings(false)}>
                  ← Retour
                </button>
                <h3>Articles du Blog</h3>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === 'dashboard' ? '#ec4899' : '#f3f4f6',
                    color: activeTab === 'dashboard' ? 'white' : '#6b7280',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  📊 Stats
                </button>
                <button 
                  onClick={() => setActiveTab('articles')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === 'articles' ? '#ec4899' : '#f3f4f6',
                    color: activeTab === 'articles' ? 'white' : '#6b7280',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  📝 Articles ({articles.length})
                </button>
                <button 
                  onClick={() => setActiveTab('trending')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeTab === 'trending' ? '#ec4899' : '#f3f4f6',
                    color: activeTab === 'trending' ? 'white' : '#6b7280',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  🏆 Top
                </button>
              </div>

              {activeTab === 'dashboard' && (
                <div className="settings-section">
                  <h4>📊 Statistiques détaillées</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '16px' }}>
                    <div style={{ padding: '16px', background: '#fce7f3', borderRadius: '12px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ec4899' }}>{stats.publishedArticles}</div>
                      <div style={{ fontSize: '14px', color: '#9d174d' }}>Articles publiés</div>
                    </div>
                    <div style={{ padding: '16px', background: '#dbeafe', borderRadius: '12px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{formatNumber(stats.totalViews)}</div>
                      <div style={{ fontSize: '14px', color: '#1e40af' }}>Vues totales</div>
                    </div>
                    <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '12px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>{stats.draftsCount}</div>
                      <div style={{ fontSize: '14px', color: '#b45309' }}>Brouillons</div>
                    </div>
                    <div style={{ padding: '16px', background: '#f3e8ff', borderRadius: '12px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#a855f7' }}>{Object.keys(stats.categories).length}</div>
                      <div style={{ fontSize: '14px', color: '#7c3aed' }}>Catégories</div>
                    </div>
                  </div>

                  {Object.keys(stats.categories).length > 0 && (
                    <div style={{ marginTop: '24px' }}>
                      <h4>📂 Par catégorie</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                        {Object.entries(stats.categories).map(([cat, count]) => (
                          <span key={cat} style={{ 
                            padding: '6px 12px', 
                            background: '#f3f4f6', 
                            borderRadius: '16px',
                            fontSize: '13px',
                            color: '#374151'
                          }}>
                            {cat} ({count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'articles' && (
                <div className="settings-section">
                  <h4>📝 Tous les articles</h4>
                  <div style={{ marginTop: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                    {articles.length === 0 ? (
                      <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>Aucun article</p>
                    ) : (
                      articles.map(article => (
                        <div key={article.id} style={{ 
                          padding: '12px 16px', 
                          borderBottom: '1px solid #f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontWeight: 500, color: '#1f2937' }}>{article.title}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                              <span style={{ 
                                padding: '2px 8px', 
                                background: article.status === 'published' ? '#d1fae5' : '#fef3c7',
                                color: article.status === 'published' ? '#065f46' : '#b45309',
                                borderRadius: '4px',
                                marginRight: '8px'
                              }}>
                                {article.status === 'published' ? '✅ Publié' : '📝 Brouillon'}
                              </span>
                              {article.category && <span style={{ marginRight: '8px' }}>{article.category}</span>}
                              <span><Eye size={12} /> {article.views_count || 0}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {formatDate(article.published_at || article.created_at)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'trending' && (
                <div className="settings-section">
                  <h4>🏆 Top 5 par vues</h4>
                  <div style={{ marginTop: '16px' }}>
                    {topArticles.length === 0 ? (
                      <p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>Aucun article publié</p>
                    ) : (
                      topArticles.map((article, index) => (
                        <div key={article.id} style={{ 
                          padding: '16px', 
                          background: index === 0 ? '#fef3c7' : index === 1 ? '#f3f4f6' : index === 2 ? '#fed7aa' : 'white',
                          borderRadius: '12px',
                          marginBottom: '12px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ 
                              fontSize: '24px', 
                              fontWeight: 'bold',
                              color: index === 0 ? '#f59e0b' : index === 1 ? '#6b7280' : index === 2 ? '#ea580c' : '#9ca3af'
                            }}>
                              #{index + 1}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: '#1f2937' }}>{article.title}</div>
                              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                                {article.category} • <Eye size={12} /> {formatNumber(article.views_count || 0)} vues
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default KiaraModal
