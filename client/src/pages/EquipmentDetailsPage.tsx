
import { Link } from 'react-router-dom'
import type { Equipment } from '../types/equipment'
import type { CurrentUser } from '../types/reservation'

interface EquipmentDetailsPageProps {
  equipment: Equipment | null
  user: CurrentUser | null
  isLoading: boolean
  workingId: number | null
  error: string
  onReserve: (equipment: Equipment) => void
}

function EquipmentDetailsPage({
  equipment,
  user,
  isLoading,
  workingId,
  error,
  onReserve,
}: EquipmentDetailsPageProps) {
  if (isLoading) {
    return <p className="loading-message" role="status">Loading item details...</p>
  }

  if (error) {
    return (
      <section className="workflow-section">
        <p className="error-message" role="alert">{error}</p>
        <Link to="/equipment">Back to equipment</Link>
      </section>
    )
  }

  if (!equipment) {
    return (
      <section className="workflow-section">
        <p className="empty-message">Equipment not found.</p>
        <Link to="/equipment">Back to equipment</Link>
      </section>
    )
  }

  return (
    <section className="workflow-section">
      <Link to="/equipment">← Back to equipment</Link>

      <p className="eyebrow">EQUIPMENT DETAILS</p>
      <h1>{equipment.name}</h1>

      <p><strong>Asset code:</strong> {equipment.assetCode}</p>
      <p><strong>Category:</strong> {equipment.category}</p>
      <p><strong>Description:</strong> {equipment.description}</p>

      <p>
        <strong>Availability:</strong>{' '}
        {equipment.isAvailable ? 'Available' : 'Unavailable'}
      </p>

      {user?.role === 'Student' && equipment.isAvailable && (
        <button
          className="login-button"
          disabled={workingId === equipment.id}
          onClick={() => onReserve(equipment)}
        >
          {workingId === equipment.id ? 'Reserving...' : 'Reserve equipment'}
        </button>
      )}

      {!user && (
        <p>
          <Link to="/login">Sign in</Link> to reserve equipment.
        </p>
      )}
    </section>
  )
}

export default EquipmentDetailsPage
