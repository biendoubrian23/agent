import './AssistantCard.css'

interface AssistantCardProps {
  name: string
  role: string
  image: string
  gradient: string
  isPrincipal?: boolean
  onClick?: () => void
}

const AssistantCard = ({ name, role, image, gradient, isPrincipal = false, onClick }: AssistantCardProps) => {
  return (
    <div 
      className={`assistant-card ${isPrincipal ? 'principal' : ''}`} 
      style={{ background: gradient }}
      onClick={onClick}
    >
      <div className="card-header">
        <h3 className="assistant-name">{name}</h3>
        <p className="assistant-role">{role}</p>
      </div>
      <div className="card-image">
        <img src={image} alt={`${name} - ${role}`} />
      </div>
      {isPrincipal && (
        <div className="principal-badge">
          <span>👑 Principal</span>
        </div>
      )}
    </div>
  )
}

export default AssistantCard
