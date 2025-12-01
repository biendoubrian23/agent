import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './LandingPage.css'

// Images des agents (utiliser les images existantes)
import brianImg from '../assets/principal.jpeg'
import jamesImg from '../assets/MailAssistant.jpeg'
import magaliImg from '../assets/BankAssistant.jpeg'
import kiaraImg from '../assets/SeoAssistant.jpeg'

const LandingPage = () => {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/dashboard')
      } else {
        if (!firstName || !lastName) {
          throw new Error('Prénom et nom requis')
        }
        const { error } = await signUp(email, password, firstName, lastName)
        if (error) throw error
        // Après inscription, on peut soit rediriger, soit afficher un message
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-container">
      {/* Left Side - Auth Form */}
      <div className="landing-left">
        <div className="auth-box">
          <div className="logo">
            <h1>BiendouCorp</h1>
          </div>
          
          <h2>{isLogin ? 'Connexion' : 'Créer un compte'}</h2>
          <p className="auth-subtitle">
            {isLogin 
              ? 'Accédez à vos agents IA personnels' 
              : 'Rejoignez BiendouCorp et configurez vos agents'}
          </p>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="form-row">
                <div className="form-group">
                  <label>Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Brian"
                    required={!isLogin}
                  />
                </div>
                <div className="form-group">
                  <label>Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}
            
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="brian@biendoucorp.com"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : 'Créer mon compte')}
            </button>
          </form>

          <div className="auth-switch">
            {isLogin ? (
              <p>
                Pas encore de compte ?{' '}
                <button onClick={() => setIsLogin(false)}>S'inscrire</button>
              </p>
            ) : (
              <p>
                Déjà un compte ?{' '}
                <button onClick={() => setIsLogin(true)}>Se connecter</button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Agents Showcase */}
      <div className="landing-right">
        <div className="agents-showcase">
          <h2>Vos Agents IA</h2>
          <p>Une équipe d'assistants intelligents à votre service</p>
          
          <div className="agents-grid">
            <div className="agent-preview brian">
              <img src={brianImg} alt="Brian" />
              <div className="agent-info">
                <h3>Brian</h3>
                <span>Agent Principal</span>
              </div>
            </div>
            
            <div className="agent-preview james">
              <img src={jamesImg} alt="James" />
              <div className="agent-info">
                <h3>James</h3>
                <span>Assistant Email</span>
              </div>
            </div>
            
            <div className="agent-preview magali">
              <img src={magaliImg} alt="Magali" />
              <div className="agent-info">
                <h3>Magali</h3>
                <span>Assistante Bancaire</span>
              </div>
            </div>
            
            <div className="agent-preview kiara">
              <img src={kiaraImg} alt="Kiara" />
              <div className="agent-info">
                <h3>Kiara</h3>
                <span>Assistante CEO</span>
              </div>
            </div>
          </div>

          <div className="features-list">
            <div className="feature">
              <p>Gestion intelligente des emails</p>
            </div>
            <div className="feature">
              <p>Communication via WhatsApp</p>
            </div>
            <div className="feature">
              <p>Suivi des transactions bancaires</p>
            </div>
            <div className="feature">
              <p>Tableaux de bord en temps réel</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage
