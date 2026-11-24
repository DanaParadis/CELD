
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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

const student: CurrentUser = {
  id: 1,
  displayName: 'Student One',
  role: 'Student',
}

const staff: CurrentUser = {
  id: 3,
  displayName: 'Lending Staff',
  role: 'Staff',
}

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
  student: {
    id: 1,
    displayName: 'Student One',
  },
  history: [
    {
      id: 1,
      eventType: 'Created',
      status: 'Reserved',
      actorDisplayName: 'Student One',
      occurredAtUtc: '2026-01-01T12:00:00Z',
    },
  ],
}

describe('CELD application workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')

    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(signIn).mockResolvedValue(student)

    vi.mocked(getEquipment).mockImplementation(async (search = '', category = '') =>
      equipment.filter(
        (item) =>
          item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
          (!category || item.category === category),
      ),
    )

    vi.mocked(getEquipmentById).mockImplementation(async (id) => {
      const item = equipment.find((candidate) => candidate.id === id)

      if (!item) {
        throw new ApiError('Equipment item not found.', 404)
      }

      return item
    })

    vi.mocked(getMyReservations).mockResolvedValue([])
    vi.mocked(getStaffReservations).mockResolvedValue([])
    vi.mocked(createReservation).mockResolvedValue({
      ...staffReservation,
      id: 28,
    })
    vi.mocked(transitionReservation).mockResolvedValue({
      ...staffReservation,
      status: 'CheckedOut',
    })
  })

  it('checks the session before displaying the application', async () => {
    render(<App />)

    expect(await screen.findByText('Dell Laptop')).toBeInTheDocument()
  })

  it('loads the equipment catalog and filters by name', async () => {
    render(<App />)

    expect(await screen.findByText('Dell Laptop')).toBeInTheDocument()
    expect(screen.getByText('Wireless Mouse')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search equipment'), {
      target: { value: 'dell' },
    })

    await waitFor(() => {
      expect(screen.getByText('Dell Laptop')).toBeInTheDocument()
      expect(screen.queryByText('Wireless Mouse')).not.toBeInTheDocument()
    })
  })

  it('shows an empty state when no equipment matches the search', async () => {
    render(<App />)

    await screen.findByText('Dell Laptop')

    fireEvent.change(screen.getByLabelText('Search equipment'), {
      target: { value: 'camera' },
    })

    expect(
      await screen.findByText('No equipment matches these search filters.'),
    ).toBeInTheDocument()
  })

  it('shows an error when the equipment catalog cannot load', async () => {
    vi.mocked(getEquipment).mockRejectedValueOnce(
      new Error('Catalog is unavailable.'),
    )

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Catalog is unavailable.',
    )
  })

  it('announces the loading state while equipment is being retrieved', async () => {
    vi.mocked(getEquipment).mockReturnValueOnce(
      new Promise<Equipment[]>(() => {}),
    )

    render(<App />)

    expect(await screen.findByText('Loading equipment...')).toBeInTheDocument()
  })

  
it('opens the equipment details page', async () => {
  render(<App />)

  await screen.findByText('Dell Laptop')

  fireEvent.click(screen.getAllByRole('button', { name: 'View details' })[0])

  expect(
    await screen.findByRole('link', { name: /Back to equipment/i }),
  ).toBeInTheDocument()

  expect(getEquipmentById).toHaveBeenCalledWith(1)
})

  it('allows a Student to sign in and reserve available equipment', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('link', { name: 'Sign in' }))

    fireEvent.change(await screen.findByLabelText('Username'), {
      target: { value: 'student1' },
    })

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'test-password' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Student One · Student')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Equipment' }))

    await screen.findByText('Dell Laptop')

    fireEvent.click(screen.getAllByRole('button', { name: 'View details' })[0])

    fireEvent.click(
      await screen.findByRole('button', { name: 'Reserve equipment' }),
    )

    await waitFor(() => {
      expect(createReservation).toHaveBeenCalledWith(1)
    })
  })

  it('allows Staff to view the reservation queue and record pickup', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(staff)
    vi.mocked(getStaffReservations).mockResolvedValue([staffReservation])

    render(<App />)

    fireEvent.click(
      await screen.findByRole('link', { name: 'Staff Reservations' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Reservation queue' }),
    ).toBeInTheDocument()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Record pickup' }),
    )

    await waitFor(() => {
      expect(transitionReservation).toHaveBeenCalledWith(27, 'pickup')
    })
  })

  it('shows an error when the user enters invalid login credentials', async () => {
    vi.mocked(signIn).mockRejectedValue(
      new ApiError('Invalid username or password.', 401),
    )

    render(<App />)

    fireEvent.click(await screen.findByRole('link', { name: 'Sign in' }))

    fireEvent.change(await screen.findByLabelText('Username'), {
      target: { value: 'student1' },
    })

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'incorrect' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid username or password.',
    )
  })
})
