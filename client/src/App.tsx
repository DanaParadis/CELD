
import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'

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

import Layout from './components/Layout'
import EquipmentPage from './pages/EquipmentPage'
import EquipmentDetailsPage from './pages/EquipmentDetailsPage'
import MyReservationsPage from './pages/MyReservationsPage'
import StaffReservationsPage from './pages/StaffReservationsPage'
import LoginPage from './pages/LoginPage'

import './App.css'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred. Please try again.'
}

interface EquipmentDetailsRouteProps {
  user: CurrentUser | null
  workingId: number | null
  refreshKey: number
  onReserve: (item: Equipment) => void
}


function EquipmentDetailsRoute({
  user,
  workingId,
  refreshKey,
  onReserve,
}: EquipmentDetailsRouteProps) {
  const { id } = useParams()

  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const equipmentId = Number(id)
  const invalidId = !id || !Number.isInteger(equipmentId) || equipmentId <= 0

  useEffect(() => {
    if (invalidId) return

    let active = true

    async function loadEquipment() {
      setIsLoading(true)
      setError('')

      try {
        const item = await getEquipmentById(equipmentId)

        if (active) setEquipment(item)
      } catch (requestError: unknown) {
        if (active) setError(getErrorMessage(requestError))
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadEquipment()

    return () => {
      active = false
    }
  }, [equipmentId, invalidId, refreshKey])

  return (
    <EquipmentDetailsPage
      equipment={invalidId ? null : equipment}
      user={user}
      isLoading={invalidId ? false : isLoading}
      workingId={workingId}
      error={invalidId ? 'Invalid equipment ID.' : error}
      onReserve={onReserve}
    />
  )
}

function AppContent() {
  const navigate = useNavigate()

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
  const [equipmentFailure, setEquipmentFailure] = useState<{
    key: string
    message: string
  } | null>(null)

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loadedReservationKey, setLoadedReservationKey] = useState('')
  const [reservationFailure, setReservationFailure] = useState<{
    key: string
    message: string
  } | null>(null)
  const [reservationFilter, setReservationFilter] = useState('')

  const [actionError, setActionError] = useState('')
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const equipmentKey = JSON.stringify([
    search,
    selectedCategory,
    refreshKey,
  ])

  const reservationKey = JSON.stringify([
    user?.id ?? null,
    user?.role ?? null,
    reservationFilter,
    refreshKey,
  ])

  const isLoadingEquipment = loadedEquipmentKey !== equipmentKey

  const equipmentError =
    equipmentFailure?.key === equipmentKey
      ? equipmentFailure.message
      : ''

  const isLoadingReservations =
    Boolean(user) && loadedReservationKey !== reservationKey

  const reservationError =
    reservationFailure?.key === reservationKey
      ? reservationFailure.message
      : ''

  useEffect(() => {
    let active = true

    getCurrentUser()
      .then((currentUser) => {
        if (active && currentUser) setUser(currentUser)
      })
      .catch((error: unknown) => {
        if (active) setAuthError(getErrorMessage(error))
      })
      .finally(() => {
        if (active) setAuthChecked(true)
      })

    return () => {
      active = false
    }
  }, [])

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
          setEquipmentFailure({
            key: equipmentKey,
            message: getErrorMessage(error),
          })
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadedEquipmentKey(equipmentKey)
        }
      })

    return () => controller.abort()
  }, [search, selectedCategory, refreshKey, equipmentKey])

  useEffect(() => {
    let active = true

    if (!user) return

    const loadReservations =
      user.role === 'Staff'
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
          setReservationFailure({
            key: reservationKey,
            message: getErrorMessage(error),
          })
          setLoadedReservationKey(reservationKey)
        }
      })

    return () => {
      active = false
    }
  }, [user, reservationFilter, refreshKey, reservationKey])

  async function handleSignIn() {
    setAuthError('')

    try {
      const signedInUser = await signIn(username, password)
      setUser(signedInUser)
      setPassword('')

      navigate(
        signedInUser.role === 'Staff'
          ? '/staff/reservations'
          : '/my-reservations',
      )
    } catch (error) {
      setAuthError(getErrorMessage(error))
    }
  }

  async function handleSignOut() {
    setAuthError('')

    try {
      await signOut()
      setUser(null)
      setReservations([])
      setReservationFilter('')
      navigate('/equipment')
    } catch (error) {
      setAuthError(getErrorMessage(error))
    }
  }

  async function handleReserve(item: Equipment) {
    setWorkingId(item.id)
    setActionError('')

    try {
      await createReservation(item.id)
      setRefreshKey((key) => key + 1)
    } catch (error) {
      setRefreshKey((key) => key + 1)
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
    } catch (error) {
      setRefreshKey((key) => key + 1)
      setActionError(getErrorMessage(error))
    } finally {
      setWorkingId(null)
    }
  }

  if (!authChecked) {
    return (
      <div className="app">
        <p className="loading-message" role="status">
          Checking session...
        </p>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route
          element={
            <Layout
              user={user}
              onSignOut={handleSignOut}
            />
          }
        >
          <Route
            path="/"
            element={<Navigate to="/equipment" replace />}
          />

          <Route
            path="/equipment"
            element={
              <EquipmentPage
                equipment={equipment}
                search={search}
                onSearchChange={setSearch}
                selectedCategory={selectedCategory}
                categories={categories}
                onCategoryChange={setSelectedCategory}
                isLoading={isLoadingEquipment}
                error={equipmentError}
                onRetry={() => setRefreshKey((key) => key + 1)}
                onViewDetails={(id) => navigate(`/equipment/${id}`)}
              />
            }
          />

          <Route
            path="/equipment/:id"
            element={
              <EquipmentDetailsRoute
                user={user}
                workingId={workingId}
                refreshKey={refreshKey}
                onReserve={handleReserve}
              />
            }
          />

          <Route
            path="/login"
            element={
              user ? (
                <Navigate
                  to={user.role === 'Staff' ? '/staff/reservations' : '/my-reservations'}
                  replace
                />
              ) : (
                <LoginPage
                  username={username}
                  password={password}
                  authError={authError}
                  onUsernameChange={setUsername}
                  onPasswordChange={setPassword}
                  onSubmit={handleSignIn}
                />
              )
            }
          />

          <Route
            path="/my-reservations"
            element={
              user?.role === 'Student' ? (
                <MyReservationsPage
                  reservations={reservations}
                  isLoading={isLoadingReservations}
                  error={reservationError}
                  workingId={workingId}
                  onCancel={(reservation) =>
                    handleTransition(reservation, 'cancel')
                  }
                />
              ) : (
                <Navigate to={user ? '/equipment' : '/login'} replace />
              )
            }
          />

          <Route
            path="/staff/reservations"
            element={
              user?.role === 'Staff' ? (
                <StaffReservationsPage
                  reservations={reservations}
                  isLoading={isLoadingReservations}
                  error={reservationError}
                  workingId={workingId}
                  reservationFilter={reservationFilter}
                  onFilterChange={setReservationFilter}
                  onPickup={(reservation) =>
                    handleTransition(reservation, 'pickup')
                  }
                  onReturn={(reservation) =>
                    handleTransition(reservation, 'return')
                  }
                />
              ) : (
                <Navigate to={user ? '/equipment' : '/login'} replace />
              )
            }
          />

          <Route
            path="*"
            element={<Navigate to="/equipment" replace />}
          />
        </Route>
      </Routes>

      {actionError && (
        <p className="global-error" role="alert">
          {actionError}
        </p>
      )}

      {authError && user && (
        <p className="global-error" role="alert">
          {authError}
        </p>
      )}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
