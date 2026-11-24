
import type { Reservation } from '../types/reservation'

interface StaffReservationsPageProps {
  reservations: Reservation[]
  isLoading: boolean
  error: string
  workingId: number | null
  reservationFilter: string
  onFilterChange: (value: string) => void
  onPickup: (reservation: Reservation) => void
  onReturn: (reservation: Reservation) => void
}

const statuses = ['', 'Reserved', 'CheckedOut', 'Cancelled', 'Returned']

function StaffReservationsPage({
  reservations,
  isLoading,
  error,
  workingId,
  reservationFilter,
  onFilterChange,
  onPickup,
  onReturn,
}: StaffReservationsPageProps) {
  return (
    <section className="workflow-section">
      <div className="catalog-heading">
        <div>
          <p className="eyebrow">LENDING DESK</p>
          <h1>Reservation queue</h1>
        </div>

        <div className="category-filter">
          <label htmlFor="reservation-status">Status:</label>
          <select
            id="reservation-status"
            value={reservationFilter}
            onChange={(event) => onFilterChange(event.target.value)}
          >
            {statuses.map((status) => (
              <option key={status || 'All'} value={status}>
                {status || 'All statuses'}
              </option>
            ))}
          </select>
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

              <div className="reservation-actions">
                {reservation.status === 'Reserved' && (
                  <button
                    disabled={workingId === reservation.id}
                    onClick={() => onPickup(reservation)}
                  >
                    {workingId === reservation.id ? 'Processing...' : 'Record pickup'}
                  </button>
                )}

                {reservation.status === 'CheckedOut' && (
                  <button
                    disabled={workingId === reservation.id}
                    onClick={() => onReturn(reservation)}
                  >
                    {workingId === reservation.id ? 'Processing...' : 'Record return'}
                  </button>
                )}
              </div>

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

export default StaffReservationsPage
