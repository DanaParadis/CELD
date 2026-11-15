import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ApiError } from './services/api'
import App from './App'
import { getCurrentUser, signIn } from './services/authService'
import { getEquipment, getEquipmentById } from './services/equipmentService'
import {
  createReservation,
  getMyReservations,
  getStaffReservations,
  transitionReservation,
} from './services/reservationService'
import type { Equipment } from './types/equipment'
import type { CurrentUser, Reservation } from './types/reservation'

vi.mock('./services/authService', () => ({
  getCurrentUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./services/equipmentService', () => ({
  getEquipment: vi.fn(),
  getEquipmentById: vi.fn(),
}))

vi.mock('./services/reservationService', () => ({
  createReservation: vi.fn(),
  getMyReservations: vi.fn(),
  getStaffReservations: vi.fn(),
  transitionReservation: vi.fn(),
}))

const equipment: Equipment[] = [
  {
    id: 1,
    assetCode: 'CELD-001',
    name: 'Dell Laptop',
    category: 'Computers',
    description: 'Laptop for coursework.',
    isAvailable: true,
  },
  {
    id: 2,
    assetCode: 'CELD-002',
    name: 'Wireless Mouse',
    category: 'Accessories',
    description: 'Wireless campus mouse.',
    isAvailable: false,
  },
]

const student: CurrentUser = { id: 1, displayName: 'Student One', role: 'Student' }
const staff: CurrentUser = { id: 3, displayName: 'Lending Staff', role: 'Staff' }

const staffReservation: Reservation = {
  id: 27,
  status: 'Reserved',
  createdAtUtc: '2026-01-01T12:00:00Z',
  equipment: {
    id: 1,
    assetCode: 'CELD-001',
    name: 'Dell Laptop',
    category: 'Computers',
    availability: 'Unavailable',
  },
  student: { id: 1, displayName: 'Student One' },
  history: [{
    id: 1,
    eventType: 'Created',
    status: 'Reserved',
    actorDisplayName: 'Student One',
    occurredAtUtc: '2026-01-01T12:00:00Z',
  }],
}

describe('CELD product workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(signIn).mockResolvedValue(student)
    vi.mocked(getEquipment).mockImplementation(async (search = '', category = '') =>
      equipment.filter((item) =>
        item.name.toLowerCase().includes(search.trim().toLowerCase())
        && (!category || item.category === category),
      ))
    vi.mocked(getEquipmentById).mockImplementation(async (id) => {
      const item = equipment.find((candidate) => candidate.id === id)
      if (!item) throw new ApiError('Equipment item not found.', 404)
      return item
    })
    vi.mocked(getMyReservations).mockResolvedValue([])
    vi.mocked(getStaffReservations).mockResolvedValue([])
    vi.mocked(createReservation).mockResolvedValue({ ...staffReservation, id: 28 })
    vi.mocked(transitionReservation).mockResolvedValue({ ...staffReservation, status: 'CheckedOut' })
  })

  // Verifies the catalog loads and filter changes reach the equipment service.
  it('loads the catalog and sends name/category filters to the API service', async () => {
    render(<App />)
    expect(await screen.findByText('Dell Laptop')).toBeInTheDocument()
    expect(screen.getByText('Wireless Mouse')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search equipment'), {
      target: { value: 'dell' },
    })
    fireEvent.change(screen.getByLabelText('Category:'), {
      target: { value: 'Computers' },
    })

    await waitFor(() => {
      expect(getEquipment).toHaveBeenLastCalledWith('dell', 'Computers', expect.any(AbortSignal))
    })
    expect(screen.getByText('Dell Laptop')).toBeInTheDocument()
    expect(screen.queryByText('Wireless Mouse')).not.toBeInTheDocument()
  })

  // Verifies an unmatched search displays the empty state.
  it('shows an empty state when the server returns no matching equipment', async () => {
    render(<App />)
    await screen.findByText('Dell Laptop')

    fireEvent.change(screen.getByLabelText('Search equipment'), {
      target: { value: 'camera' },
    })

    expect(await screen.findByText('No equipment matches these search filters.'))
      .toBeInTheDocument()
  })

  // Verifies catalog failures are reported without displaying fabricated items.
  it('shows a controlled catalog failure instead of fabricated equipment', async () => {
    vi.mocked(getEquipment).mockRejectedValueOnce(new Error('Catalog is unavailable.'))
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Catalog is unavailable.')
    expect(screen.queryByText('Dell Laptop')).not.toBeInTheDocument()
  })

  // Verifies users are informed while the catalog is loading.
  it('announces catalog loading state', () => {
    vi.mocked(getEquipment).mockReturnValueOnce(new Promise<Equipment[]>(() => { }))
    render(<App />)

    expect(screen.getByText('Loading equipment...')).toBeInTheDocument()
  })

  // Verifies the details dialog supports keyboard focus and Escape dismissal.
  it('opens item details accessibly and closes with Escape', async () => {
    render(<App />)
    await screen.findByText('Dell Laptop')
    const opener = screen.getAllByRole('button', { name: 'View details' })[0]
    fireEvent.click(opener)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    const closeButton = screen.getByRole('button', { name: 'Close details' })
    await waitFor(() => expect(closeButton).toHaveFocus())
    fireEvent.keyDown(closeButton, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })

  // Verifies a signed-in Student can reserve an item from its details dialog.
  it('signs in a Student and submits a reservation from current item details', async () => {
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Username'), {
      target: { value: 'student1' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'test-only-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Student One · Student')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'View details' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Reserve equipment' }))

    await waitFor(() => expect(createReservation).toHaveBeenCalledWith(1))
    expect(getMyReservations).toHaveBeenCalled()
    expect(getEquipmentById).toHaveBeenCalledWith(1)
  })

  // Verifies a reservation conflict refreshes the item's availability.
  it('revalidates authoritative item state after a reservation conflict', async () => {
    vi.mocked(createReservation).mockRejectedValueOnce(
      new ApiError('The equipment is no longer available.', 409),
    )
    vi.mocked(getEquipmentById)
      .mockResolvedValueOnce(equipment[0])
      .mockResolvedValueOnce({ ...equipment[0], isAvailable: false })
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Username'), {
      target: { value: 'student1' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'temporary-test-value' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByText('Student One · Student')
    fireEvent.click(screen.getAllByRole('button', { name: 'View details' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Reserve equipment' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The equipment is no longer available.',
    )
    expect(await within(screen.getByRole('dialog')).findByText('Unavailable'))
      .toBeInTheDocument()
    expect(getEquipmentById).toHaveBeenCalledTimes(2)
  })

  // Verifies Staff can view reservation history and initiate pickup.
  it('shows staff queue history and offers the pickup transition', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff)
    vi.mocked(getStaffReservations).mockResolvedValue([staffReservation])
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Reservation queue' }))
      .toBeInTheDocument()
    expect(await screen.findByText(/Created: Reserved by Student One/)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Record pickup' }))

    await waitFor(() => {
      expect(transitionReservation).toHaveBeenCalledWith(27, 'pickup')
    })
  })

  // Verifies Students do not see Staff-only pickup or return controls.
  it('does not render staff transition controls for a Student', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(student)
    vi.mocked(getMyReservations).mockResolvedValue([staffReservation])
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Cancel reservation' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record pickup' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record return' })).not.toBeInTheDocument()
  })

  // Verifies failed sign-in shows an error without creating a signed-in view.
  it('reports invalid sign-in without showing a successful session', async () => {
    vi.mocked(signIn).mockRejectedValue(new ApiError('Invalid username or password.', 401))
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Username'), {
      target: { value: 'student1' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'incorrect' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.')
    expect(screen.queryByText('Student One · Student')).not.toBeInTheDocument()
  })
})
