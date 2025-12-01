import { 
  Home, 
  LayoutGrid, 
  Zap, 
  Building2, 
  Bot, 
  Users,
  User,
  Settings,
  CreditCard,
  HelpCircle,
  BookOpen,
  LogOut
} from 'lucide-react'
import './Sidebar.css'

interface SidebarProps {
  onSignOut?: () => void
}

const Sidebar = ({ onSignOut }: SidebarProps) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-content">
        {/* Logo */}
        <div className="logo">
          <div className="logo-icon">
            <span>B</span>
          </div>
        </div>

        {/* Section Principale */}
        <div className="nav-section">
          <span className="nav-section-title">PRINCIPALE</span>
          <nav className="nav-menu">
            <a href="#" className="nav-item active">
              <Home size={20} />
            </a>
            <a href="#" className="nav-item">
              <LayoutGrid size={20} />
            </a>
            <a href="#" className="nav-item">
              <Zap size={20} />
            </a>
          </nav>
        </div>

        {/* Section Entreprise */}
        <div className="nav-section">
          <span className="nav-section-title">ENTREPRISE</span>
          <nav className="nav-menu">
            <a href="#" className="nav-item">
              <Building2 size={20} />
            </a>
            <a href="#" className="nav-item">
              <Bot size={20} />
            </a>
            <a href="#" className="nav-item">
              <Users size={20} />
            </a>
          </nav>
        </div>

        {/* Section Compte */}
        <div className="nav-section">
          <span className="nav-section-title">COMPTE</span>
          <nav className="nav-menu">
            <a href="#" className="nav-item">
              <User size={20} />
            </a>
            <a href="#" className="nav-item">
              <Settings size={20} />
            </a>
            <a href="#" className="nav-item">
              <CreditCard size={20} />
            </a>
          </nav>
        </div>

        {/* Spacer */}
        <div className="sidebar-spacer"></div>

        {/* Bottom Icons */}
        <div className="sidebar-bottom">
          <a href="#" className="nav-item">
            <HelpCircle size={20} />
          </a>
          <a href="#" className="nav-item">
            <BookOpen size={20} />
          </a>
          {onSignOut && (
            <button className="nav-item logout-btn" onClick={onSignOut} title="Se déconnecter">
              <LogOut size={20} />
            </button>
          )}
          <div className="language-flag">
            🇫🇷
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
