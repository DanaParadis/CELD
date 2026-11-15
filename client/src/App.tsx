import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { getCurrentUser, signIn, signOut } from './services/authService'
import { getEquipment, getEquipmentById } from './services/equipmentService'
import {
  createReservation,
  getMyReservations,
  getStaffReservations,
  transitionReservation,
} from './services/reservationService'
import type { Equipment } from './types/equipment'
import type { CurrentUser, Reservation } from './types/reservation'
import './App.css'

const categoriesLabel = 'All categories'
const statuses = ['', 'Reserved', 'CheckedOut', 'Cancelled', 'Returned']

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred. Please try again.'
}

function App() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loadedEquipmentKey, setLoadedEquipmentKey] = useState('')
  const [equipmentFailure, setEquipmentFailure] = useState<{ key: string; message: string } | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loadedReservationKey, setLoadedReservationKey] = useState('')
  const [reservationFailure, setReservationFailure] = useState<{ key: string; message: string } | null>(null)
  const [reservationFilter, setReservationFilter] = useState('')
  const [actionError, setActionError] = useState('')
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const dialogRef = useRef<HTMLElement>(null)
  const dialogCloseButtonRef = useRef<HTMLButtonElement>(null)
  const dialogOpenerRef = useRef<HTMLButtonElement | null>(null)
  const equipmentKey = JSON.stringify([search, selectedCategory, refreshKey])
  const reservationKey = JSON.stringify([
    user?.id ?? null,
    user?.role ?? null,
    reservationFilter,
    refreshKey,
  ])
  const isLoadingEquipment = loadedEquipmentKey !== equipmentKey
  const equipmentError = equipmentFailure?.key === equipmentKey
    ? equipmentFailure.message
    : ''
  const isLoadingReservations = Boolean(user) && loadedReservationKey !== reservationKey
  const reservationLoadError = reservationFailure?.key === reservationKey
    ? reservationFailure.message
    : ''

  useEffect(() => {
    let active = true
    getCurrentUser()
      .then((currentUser) => {
        if (active && currentUser) setUser(currentUser)
      })
      .catch((error: unknown) => {
        if (active) {
          setAuthError(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (active) setAuthChecked(true)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedEquipment) return

    dialogCloseButtonRef.current?.focus()
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedEquipment(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      if (dialogOpenerRef.current?.isConnected) dialogOpenerRef.current.focus()
    }
  }, [selectedEquipment])

  useEffect(() => {
    const controller = new AbortController()

    getEquipment(search, selectedCategory, controller.signal)
      .then((items) => {
        setEquipment(items)
        if (!search && !selectedCategory) {
          setCategories([...new Set(items.map((item) => item.category))])
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setEquipmentFailure({ key: equipmentKey, message: getErrorMessage(error) })
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedEquipmentKey(equipmentKey)
      })

    return () => controller.abort()
  }, [search, selectedCategory, refreshKey, equipmentKey])

  useEffect(() => {
    let active = true
    if (!user) {
      return
    }

    const loadReservations = user.role === 'Staff'
      ? getStaffReservations(reservationFilter)
      : getMyReservations()

    loadReservations
      .then((items) => {
        if (active) {
          setReservations(items)
          setLoadedReservationKey(reservationKey)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setReservationFailure({ key: reservationKey, message: getErrorMessage(error) })
          setLoadedReservationKey(reservationKey)
        }
      })

    return () => {
      active = false
    }
  }, [user, reservationFilter, refreshKey, reservationKey])

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    try {
      setUser(await signIn(username, password))
      setPassword('')
    } catch (error) {
      setAuthError(getErrorMessage(error))
    }
  }

  async function handleSignOut() {
    setAuthError('')
    try {
      await signOut()
      setUser(null)
    } catch (error) {
      setAuthError(getErrorMessage(error))
    }
  }

  async function openEquipment(id: number, opener: HTMLButtonElement) {
    dialogOpenerRef.current = opener
    setIsLoadingDetails(true)
    setActionError('')
    try {
      setSelectedEquipment(await getEquipmentById(id))
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setIsLoadingDetails(false)
    }
  }

  function trapDialogTab(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input, select, [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable?.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function handleReserve(item: Equipment) {
    setWorkingId(item.id)
    setActionError('')
    try {
      await createReservation(item.id)
      setRefreshKey((key) => key + 1)
      setSelectedEquipment(await getEquipmentById(item.id))
    } catch (error) {
      setRefreshKey((key) => key + 1)
      try {
        setSelectedEquipment(await getEquipmentById(item.id))
      } catch (refreshError) {
        setActionError(
          `${getErrorMessage(error)} Current availability could not be refreshed: ${getErrorMessage(refreshError)}`,
        )
        return
      }

      setActionError(getErrorMessage(error))
    } finally {
      setWorkingId(null)
    }
  }

  async function handleTransition(
    reservation: Reservation,
    action: 'cancel' | 'pickup' | 'return',
  ) {
    setWorkingId(reservation.id)
    setActionError('')
    try {
      await transitionReservation(reservation.id, action)
      setRefreshKey((key) => key + 1)
      if (selectedEquipment?.id === reservation.equipment.id) {
        setSelectedEquipment(await getEquipmentById(reservation.equipment.id))
      }
    } catch (error) {
      setRefreshKey((key) => key + 1)
      if (selectedEquipment?.id === reservation.equipment.id) {
        try {
          setSelectedEquipment(await getEquipmentById(reservation.equipment.id))
        } catch (refreshError) {
          setActionError(
            `${getErrorMessage(error)} Current equipment state could not be refreshed: ${getErrorMessage(refreshError)}`,
          )
          return
        }
      }

      setActionError(getErrorMessage(error))
    } finally {
      setWorkingId(null)
    }
  }

  const displayCategories = [categoriesLabel, ...categories]

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="#catalog" aria-label="CELD home">
          <span className="brand-icon">C</span>
          <span>CELD</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#catalog">Equipment</a>
          {user && <a href="#reservations">{user.role === 'Staff' ? 'Staff queue' : 'My reservations'}</a>}
        </nav>
        <div className="session-controls">
          {authChecked && user ? (
            <>
              <span className="user-label">{user.displayName} · {user.role}</span>
              <button className="login-button secondary-button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <a className="login-button" href="#sign-in">Sign in</a>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">CAMPUS EQUIPMENT LENDING DESK</p>
          <h1>Find the equipment you need.</h1>
          <p className="hero-description">
            Browse campus equipment, make a reservation, and track its lending status.
          </p>
          <div className="search-container">
            <label htmlFor="equipment-search">Search equipment</label>
            <input
              id="equipment-search"
              type="search"
              placeholder="Search by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </section>

        <section className="catalog" id="catalog" aria-labelledby="catalog-title">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">CATALOG</p>
              <h2 id="catalog-title">Explore equipment</h2>
            </div>
            <span className="equipment-count">{equipment.length} items</span>
          </div>
          <div className="category-filter">
            <label htmlFor="category">Category:</label>
            <select
              id="category"
              value={selectedCategory || categoriesLabel}
              onChange={(event) =>
                setSelectedCategory(event.target.value === categoriesLabel ? '' : event.target.value)
              }
            >
              {displayCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {isLoadingEquipment && <p className="loading-message" role="status">Loading equipment...</p>}
          {equipmentError && (
            <div className="error-message" role="alert">
              <p>{equipmentError}</p>
              <button onClick={() => setRefreshKey((key) => key + 1)}>Retry</button>
            </div>
          )}
          {!isLoadingEquipment && !equipmentError && (
            equipment.length > 0 ? (
              <div className="equipment-grid">
                {equipment.map((item) => (
                  <article className="equipment-card" key={item.id}>
                    <div className="equipment-image" aria-hidden="true"><span>▣</span></div>
                    <div className="equipment-info">
                      <span className="category">{item.category}</span>
                      <h3>{item.name}</h3>
                      <p>Asset code: {item.assetCode}</p>
                      <span className={`availability ${item.isAvailable ? 'available' : 'unavailable'}`}>
                        {item.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                      <button
                        className="text-button"
                        onClick={(event) => void openEquipment(item.id, event.currentTarget)}
                      >
                        View details
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-message">No equipment matches these search filters.</p>
            )
          )}
        </section>

        {!authChecked && <p className="loading-message" role="status">Checking session...</p>}
        {authChecked && !user && (
          <section className="workflow-section sign-in-section" id="sign-in">
            <p className="eyebrow">ACCOUNT</p>
            <h2>Sign in to CELD</h2>
            <p>Use a provisioned Student or Lending Staff account.</p>
            <form className="sign-in-form" onSubmit={handleSignIn}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button className="login-button" type="submit">Sign in</button>
            </form>
            {authError && <p className="error-message" role="alert">{authError}</p>}
          </section>
        )}

        {authChecked && user && (
          <section className="workflow-section" id="reservations" aria-labelledby="reservations-title">
            <div className="catalog-heading">
              <div>
                <p className="eyebrow">{user.role === 'Staff' ? 'LENDING DESK' : 'YOUR ACCOUNT'}</p>
                <h2 id="reservations-title">
                  {user.role === 'Staff' ? 'Reservation queue' : 'My reservations'}
                </h2>
              </div>
              {user.role === 'Staff' && (
                <div className="category-filter">
                  <label htmlFor="reservation-status">Status:</label>
                  <select
                    id="reservation-status"
                    value={reservationFilter}
                    onChange={(event) => setReservationFilter(event.target.value)}
                  >
                    {statuses.map((status) => (
                      <option key={status || 'All'} value={status}>{status || 'All statuses'}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {reservationLoadError && <p className="error-message" role="alert">{reservationLoadError}</p>}
            {isLoadingReservations && <p className="loading-message" role="status">Loading reservations...</p>}
            {!isLoadingReservations && !reservationLoadError && reservations.length === 0 && (
              <p className="empty-message">No reservations to display.</p>
            )}
            {!isLoadingReservations && !reservationLoadError && (
              <div className="reservation-list">
                {reservations.map((reservation) => (
                <article className="reservation-card" key={reservation.id}>
                  <div className="reservation-heading">
                    <div>
                      <h3>{reservation.equipment.name}</h3>
                      <p>{reservation.equipment.assetCode} · {reservation.student.displayName}</p>
                    </div>
                    <span className={`status-badge status-${reservation.status.toLowerCase()}`}>
                      {reservation.status}
                    </span>
                  </div>
                  <p>Created: {new Date(reservation.createdAtUtc).toLocaleString()}</p>
                  <div className="reservation-actions">
                    {user.role === 'Student' && reservation.status === 'Reserved' && (
                      <button
                        disabled={workingId === reservation.id}
                        onClick={() => void handleTransition(reservation, 'cancel')}
                      >
                        Cancel reservation
                      </button>
                    )}
                    {user.role === 'Staff' && reservation.status === 'Reserved' && (
                      <button
                        disabled={workingId === reservation.id}
                        onClick={() => void handleTransition(reservation, 'pickup')}
                      >
                        Record pickup
                      </button>
                    )}
                    {user.role === 'Staff' && reservation.status === 'CheckedOut' && (
                      <button
                        disabled={workingId === reservation.id}
                        onClick={() => void handleTransition(reservation, 'return')}
                      >
                        Record return
                      </button>
                    )}
                  </div>
                  <h4>History</h4>
                  <ol className="history-list">
                    {reservation.history.map((entry) => (
                      <li key={entry.id}>
                        {entry.eventType}: {entry.status} by {entry.actorDisplayName}
                        {' · '}{new Date(entry.occurredAtUtc).toLocaleString()}
                      </li>
                    ))}
                  </ol>
                </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {actionError && <p className="global-error" role="alert">{actionError}</p>}

      {(selectedEquipment || isLoadingDetails) && (
        <div className="modal-overlay" onClick={() => setSelectedEquipment(null)}>
          <section
            className="equipment-modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="equipment-modal-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={trapDialogTab}
          >
            <button
              className="modal-close"
              ref={dialogCloseButtonRef}
              onClick={() => setSelectedEquipment(null)}
              aria-label="Close details"
            >
              &times;
            </button>
            {isLoadingDetails && <p role="status">Loading item details...</p>}
            {selectedEquipment && (
              <>
                <p className="eyebrow">EQUIPMENT DETAILS</p>
                <h2 id="equipment-modal-title">{selectedEquipment.name}</h2>
                <p><strong>Asset code:</strong> {selectedEquipment.assetCode}</p>
                <p><strong>Category:</strong> {selectedEquipment.category}</p>
                <p><strong>Description:</strong> {selectedEquipment.description}</p>
                <p>
                  <strong>Availability:</strong>{' '}
                  {selectedEquipment.isAvailable ? 'Available' : 'Unavailable'}
                </p>
                {user?.role === 'Student' && selectedEquipment.isAvailable && (
                  <button
                    className="login-button"
                    disabled={workingId === selectedEquipment.id}
                    onClick={() => void handleReserve(selectedEquipment)}
                  >
                    Reserve equipment
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <footer><p>CELD · Campus Equipment Lending Desk</p></footer>
    </div>
  )
}

export default App
