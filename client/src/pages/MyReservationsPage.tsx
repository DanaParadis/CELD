
import type { Reservation } from '../types/reservation'

interface MyReservationsPageProps {
  reservations: Reservation[]
  isLoading: boolean
  error: string
  workingId: number | null
  onCancel: (reservation: Reservation) => void
}

function MyReservationsPage({
  reservations,
  isLoading,
  error,
  workingId,
  onCancel,
}: MyReservationsPageProps) {
  return (
    <section className="workflow-section">
      <div className="catalog-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>My reservations</h1>
        </div>
      </div>

      {isLoading && (
        <p className="loading-message" role="status">
          Loading reservations...
        </p>
      )}

      {error && (
        <p className="error-message" role="alert">{error}</p>
      )}

      {!isLoading && !error && reservations.length === 0 && (
        <p className="empty-message">No reservations to display.</p>
      )}

      {!isLoading && !error && (
        <div className="reservation-list">
          {reservations.map((reservation) => (
            <article className="reservation-card" key={reservation.id}>
              <div className="reservation-heading">
                <div>
                  <h2>{reservation.equipment.name}</h2>
                  <p>
                    {reservation.equipment.assetCode} ·{' '}
                    {reservation.student.displayName}
                  </p>
                </div>

                <span className={`status-badge status-${reservation.status.toLowerCase()}`}>
                  {reservation.status}
                </span>
              </div>

              <p>
                Created: {new Date(reservation.createdAtUtc).toLocaleString()}
              </p>

              {reservation.status === 'Reserved' && (
                <div className="reservation-actions">
                  <button
                    disabled={workingId === reservation.id}
                    onClick={() => onCancel(reservation)}
                  >
                    {workingId === reservation.id
                      ? 'Cancelling...'
                      : 'Cancel reservation'}
                  </button>
                </div>
              )}

              <h3>History</h3>

              <ol className="history-list">
                {reservation.history.map((entry) => (
                  <li key={entry.id}>
                    {entry.eventType}: {entry.status} by {entry.actorDisplayName}
                    {' · '}
                    {new Date(entry.occurredAtUtc).toLocaleString()}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default MyReservationsPage
