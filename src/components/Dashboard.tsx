import { useState } from 'react'
import { Mail, Landmark, Briefcase, MessageCircle } from 'lucide-react'
import AssistantCard from './AssistantCard'
import AgentModal from './AgentModal'
import './Dashboard.css'

// Images des assistants
import bankAssistant from '../assets/BankAssistant.jpeg'
import mailAssistant from '../assets/MailAssistant.jpeg'
import ceoAssistant from '../assets/SeoAssistant.jpeg'
import principalAssistant from '../assets/principal.jpeg'

interface Assistant {
  name: string
  role: string
  image: string
  gradient: string
}

interface DashboardProps {
  userName: string
}

const Dashboard = ({ userName }: DashboardProps) => {
  const [selectedAgent, setSelectedAgent] = useState<Assistant | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Actions rapides disponibles
  const quickActions = [
    { icon: Mail, label: 'Résumer mes emails', color: '#6366f1' },
    { icon: Landmark, label: 'Analyser mon compte', color: '#10b981' },
    { icon: Briefcase, label: 'Rédiger un article', color: '#f59e0b' },
    { icon: MessageCircle, label: 'Contacter Brian', color: '#8b5cf6' },
  ]

  // Configuration des assistants
  const assistants: Assistant[] = [
    {
      name: 'Magali',
      role: 'Assistant Bancaire',
      image: bankAssistant,
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    },
    {
      name: 'James',
      role: 'Mail Assistant',
      image: mailAssistant,
      gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    },
    {
      name: 'Kiara',
      role: 'CEO Assistant',
      image: ceoAssistant,
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    },
  ]

  const principalAssistantData: Assistant = {
    name: 'Brian',
    role: 'Assistant Principal',
    image: principalAssistant,
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  }

  const handleAgentClick = (agent: Assistant) => {
    setSelectedAgent(agent)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedAgent(null)
  }

  return (
    <div className="dashboard">
      {/* Header avec salutation */}
      <header className="dashboard-header">
        <h1 className="greeting">
          Bonjour, <span className="user-name">{userName}</span> 👋
        </h1>
      </header>

      {/* Actions rapides */}
      <section className="quick-actions">
        {quickActions.map((action, index) => (
          <button key={index} className="quick-action-btn">
            <action.icon size={18} style={{ color: action.color }} />
            <span>{action.label}</span>
          </button>
        ))}
      </section>

      {/* Grille des assistants secondaires */}
      <section className="assistants-section">
        <div className="assistants-grid">
          {assistants.map((assistant, index) => (
            <AssistantCard
              key={index}
              name={assistant.name}
              role={assistant.role}
              image={assistant.image}
              gradient={assistant.gradient}
              onClick={() => handleAgentClick(assistant)}
            />
          ))}
        </div>

        {/* Assistant Principal */}
        <div className="principal-section">
          <AssistantCard
            name={principalAssistantData.name}
            role={principalAssistantData.role}
            image={principalAssistantData.image}
            gradient={principalAssistantData.gradient}
            isPrincipal={true}
            onClick={() => handleAgentClick(principalAssistantData)}
          />
        </div>
      </section>

      {/* Modal Agent */}
      {selectedAgent && (
        <AgentModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          agent={selectedAgent}
        />
      )}
    </div>
  )
}

export default Dashboard
