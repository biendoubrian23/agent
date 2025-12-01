import { useState, useEffect, useCallback } from 'react'
import { X, Send, Settings, Link, History, BarChart3, Globe, Mic, Paperclip, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react'
import './AgentModal.css'

interface AgentPermission {
  id: string
  label: string
  description: string
  enabled: boolean
}

interface Activity {
  id: number
  action: string
  time: string
  timeFormatted: string
  status: string
}

interface AgentStats {
  emailsProcessed: number
  emailsToday: number
  urgentEmails: number
  lastSync: string
}

interface AgentModalProps {
  isOpen: boolean
  onClose: () => void
  agent: {
    name: string
    role: string
    image: string
    gradient: string
  }
}

// Utiliser la variable d'environnement ou localhost en dev
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const AgentModal = ({ isOpen, onClose, agent }: AgentModalProps) => {
  const [message, setMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // État dynamique depuis le backend
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [stats, setStats] = useState<AgentStats>({
    emailsProcessed: 0,
    emailsToday: 0,
    urgentEmails: 0,
    lastSync: 'Jamais'
  })
  const [activities, setActivities] = useState<Activity[]>([])
  const [permissions, setPermissions] = useState<AgentPermission[]>([])
  
  const [systemPrompt, setSystemPrompt] = useState(
    `Tu es James, l'assistant email expert. Tu aides l'utilisateur à gérer ses emails Outlook/Gmail.
Tes capacités :
- Récupérer et résumer les emails
- Classifier les emails par importance
- Rédiger des brouillons de réponse
- Envoyer des emails (si autorisé)
- Rechercher des emails spécifiques

Tu es professionnel, efficace et tu communiques en français.`
  )

  // Récupérer les données depuis le backend
  const fetchAgentData = useCallback(async () => {
    if (!isOpen) return
    
    const agentKey = agent.name.toLowerCase()
    
    try {
      setError(null)
      
      // Récupérer stats + activités + connexions
      const [statsRes, permissionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/agents/${agentKey}/stats`),
        fetch(`${API_BASE}/api/agents/${agentKey}/permissions`)
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data.stats || stats)
        setActivities(data.activities || [])
        setOutlookConnected(data.connections?.outlook || false)
      }

      if (permissionsRes.ok) {
        const data = await permissionsRes.json()
        setPermissions(data.permissions || [])
      }

    } catch (err) {
      console.error('Erreur fetch agent data:', err)
      setError('Impossible de contacter le serveur')
    } finally {
      setLoading(false)
    }
  }, [isOpen, agent.name])

  // Charger les données au montage et rafraîchir toutes les 30 secondes
  useEffect(() => {
    fetchAgentData()
    
    const interval = setInterval(fetchAgentData, 30000)
    return () => clearInterval(interval)
  }, [fetchAgentData])

  // Forcer une synchronisation
  const handleSync = async () => {
    const agentKey = agent.name.toLowerCase()
    setSyncing(true)
    
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentKey}/sync`, {
        method: 'POST'
      })
      
      if (res.ok) {
        // Recharger les données après sync
        await fetchAgentData()
      } else {
        const data = await res.json()
        setError(data.error || 'Erreur de synchronisation')
      }
    } catch (err) {
      setError('Erreur de connexion au serveur')
    } finally {
      setSyncing(false)
    }
  }

  // Reconnecter Outlook
  const handleReconnect = () => {
    window.open(`${API_BASE}/auth/outlook`, '_blank')
  }

  const togglePermission = (id: string) => {
    setPermissions(prev =>
      prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p)
    )
  }

  const handleSaveSettings = async () => {
    const agentKey = agent.name.toLowerCase()
    
    try {
      await Promise.all([
        fetch(`${API_BASE}/api/agents/${agentKey}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions })
        }),
        fetch(`${API_BASE}/api/agents/${agentKey}/prompt`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemPrompt })
        })
      ])
      
      setShowSettings(false)
    } catch (err) {
      setError('Erreur lors de la sauvegarde')
    }
  }

  const handleSendMessage = () => {
    if (message.trim()) {
      console.log('Message envoyé à', agent.name, ':', message)
      setMessage('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
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
              {/* Agent Avatar & Chat */}
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

                  {/* Message Input - pour tester directement */}
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
                    <p>Utilisez <strong>WhatsApp</strong> pour communiquer avec {agent.name} via Brian. Envoyez "Résume mes emails" à Brian.</p>
                  </div>
                </div>
              </div>

              {/* Dashboard Cards */}
              <div className="features-grid">
                {/* Connexion Status */}
                <div className="feature-card status-card">
                  <div className="feature-icon">
                    <Link size={24} />
                  </div>
                  <h3>Connexion Outlook</h3>
                  <div className="connection-status">
                    {loading ? (
                      <span className="status-text loading">Chargement...</span>
                    ) : outlookConnected ? (
                      <>
                        <CheckCircle size={18} className="status-icon connected" />
                        <span className="status-text connected">Connecté</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={18} className="status-icon disconnected" />
                        <span className="status-text disconnected">Déconnecté</span>
                      </>
                    )}
                  </div>
                  <button className="reconnect-btn" onClick={handleReconnect}>
                    <RefreshCw size={14} />
                    {outlookConnected ? 'Reconnecter' : 'Connecter'}
                  </button>
                </div>

                {/* Statistiques */}
                <div className="feature-card stats-card">
                  <div className="feature-icon">
                    <BarChart3 size={24} />
                  </div>
                  <h3>Statistiques</h3>
                  {loading ? (
                    <p className="loading-text">Chargement...</p>
                  ) : (
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-value">{stats.emailsProcessed}</span>
                        <span className="stat-label">Emails traités</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{stats.emailsToday}</span>
                        <span className="stat-label">Aujourd'hui</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{stats.urgentEmails}</span>
                        <span className="stat-label">Urgents</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{stats.lastSync}</span>
                        <span className="stat-label">Dernière sync</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Historique */}
                <div className="feature-card history-card">
                  <div className="feature-icon">
                    <History size={24} />
                  </div>
                  <div className="history-header">
                    <h3>Activité récente</h3>
                    <button 
                      className="sync-btn" 
                      onClick={handleSync}
                      disabled={syncing}
                    >
                      <RefreshCw size={14} className={syncing ? 'spinning' : ''} />
                    </button>
                  </div>
                  {loading ? (
                    <p className="loading-text">Chargement...</p>
                  ) : activities.length === 0 ? (
                    <p className="no-activity">Aucune activité récente</p>
                  ) : (
                    <div className="activity-list">
                      {activities.map((activity) => (
                        <div key={activity.id} className="activity-item">
                          <CheckCircle size={14} className={`activity-icon ${activity.status}`} />
                          <div className="activity-info">
                            <span className="activity-action">{activity.action}</span>
                            <span className="activity-time">{activity.timeFormatted}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Configuration */}
                <div className="feature-card settings-card" onClick={() => setShowSettings(true)}>
                  <div className="feature-icon"><Settings size={24} /></div>
                  <h3>Configurer {agent.name}</h3>
                  <p>Permissions, prompt système et préférences</p>
                  <a href="#" className="feature-link" onClick={(e) => e.preventDefault()}>Configurer <span>→</span></a>
                </div>
              </div>
            </>
          ) : (
            /* Settings Panel */
            <div className="settings-panel">
              <div className="settings-header">
                <button className="back-btn" onClick={() => setShowSettings(false)}>
                  ← Retour
                </button>
                <h3>Configuration de {agent.name}</h3>
              </div>

              {/* System Prompt */}
              <div className="settings-section">
                <h4>📝 Prompt Système</h4>
                <p className="section-description">
                  Définissez la personnalité et les instructions de base de {agent.name}
                </p>
                <textarea
                  className="prompt-textarea"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={8}
                />
              </div>

              {/* Permissions */}
              <div className="settings-section">
                <h4>🔐 Permissions</h4>
                <p className="section-description">
                  Contrôlez ce que {agent.name} peut faire
                </p>
                <div className="permissions-list">
                  {permissions.map((permission) => (
                    <div key={permission.id} className="permission-item">
                      <div className="permission-info">
                        <span className="permission-label">{permission.label}</span>
                        <span className="permission-description">{permission.description}</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={permission.enabled}
                          onChange={() => togglePermission(permission.id)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="settings-actions">
                <button className="save-btn" onClick={handleSaveSettings}>
                  Sauvegarder les modifications
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AgentModal
