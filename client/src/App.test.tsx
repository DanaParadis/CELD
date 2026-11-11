
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest'

import {
  render,
  screen,
  fireEvent,
} from '@testing-library/react'

import App from './App'
import { getEquipment } from './services/equipmentService'

vi.mock('./services/equipmentService', () => ({
  getEquipment: vi.fn(),
}))

describe('CELD Equipment Catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getEquipment).mockResolvedValue([
      {
        id: 1,
        assetCode: 'DEMO-001',
        name: 'Laptop Dell',
        category: 'Computadoras',
        description: 'Laptop para uso académico.',
        availability: 'Available',
      },
      {
        id: 2,
        assetCode: 'DEMO-002',
        name: 'Laptop HP',
        category: 'Computadoras',
        description: 'Laptop para actividades académicas.',
        availability: 'Available',
      },
      {
        id: 3,
        assetCode: 'DEMO-003',
        name: 'Mouse Logitech',
        category: 'Accesorios',
        description: 'Mouse inalámbrico.',
        availability: 'Available',
      },
    ])
  })

  it('loads and displays equipment from the API', async () => {
    render(<App />)

    expect(
      await screen.findByText('Laptop Dell')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Laptop HP')
    ).toBeInTheDocument()

    expect(getEquipment).toHaveBeenCalledTimes(1)
  })

  it('searches equipment by name', async () => {
    render(<App />)

    const searchInput = screen.getByPlaceholderText(
      'Buscar equipos...'
    )

    await screen.findByText('Laptop Dell')

    fireEvent.change(searchInput, {
      target: { value: 'Laptop' },
    })

    expect(screen.getByText('Laptop Dell')).toBeInTheDocument()
    expect(screen.getByText('Laptop HP')).toBeInTheDocument()
    expect(screen.queryByText('Mouse Logitech')).not.toBeInTheDocument()
  })

  
  it('filters equipment by category', async () => {
    render(<App />)

    await screen.findByText('Laptop Dell')

    const categorySelect = screen.getByLabelText('Categoría:')

    fireEvent.change(categorySelect, {
      target: { value: 'Accesorios' },
    })

    expect(screen.getByText('Mouse Logitech')).toBeInTheDocument()
    expect(screen.queryByText('Laptop Dell')).not.toBeInTheDocument()
    expect(screen.queryByText('Laptop HP')).not.toBeInTheDocument()
  })

  
  it('combines name search and category filtering', async () => {
    render(<App />)

    await screen.findByText('Laptop Dell')

    const searchInput = screen.getByPlaceholderText(
      'Buscar equipos...'
    )

    const categorySelect = screen.getByLabelText('Categoría:')

    fireEvent.change(categorySelect, {
      target: { value: 'Computadoras' },
    })

    fireEvent.change(searchInput, {
      target: { value: 'Dell' },
    })

    expect(screen.getByText('Laptop Dell')).toBeInTheDocument()
    expect(screen.queryByText('Laptop HP')).not.toBeInTheDocument()
    expect(screen.queryByText('Mouse Logitech')).not.toBeInTheDocument()
  })

  
  it('displays an empty message when no equipment matches', async () => {
    render(<App />)

    await screen.findByText('Laptop Dell')

    const searchInput = screen.getByPlaceholderText(
      'Buscar equipos...'
    )

    fireEvent.change(searchInput, {
      target: { value: 'Cámara Nikon' },
    })

    expect(
      screen.getByText('No se encontraron equipos.')
    ).toBeInTheDocument()

    expect(screen.queryByText('Laptop Dell')).not.toBeInTheDocument()
  })

  
  it('opens and displays equipment details', async () => {
    render(<App />)

    const equipmentCard = await screen.findByRole('button', {
      name: /Laptop Dell/i,
    })

    fireEvent.click(equipmentCard)

    expect(
      screen.getByRole('dialog')
    ).toBeInTheDocument()

    expect(
      screen.getByText('DETALLES DEL EQUIPO')
    ).toBeInTheDocument()

    expect(
      screen.getByText('Laptop para uso académico.')
    ).toBeInTheDocument()

    expect(
      screen.getByText('DEMO-001')
    ).toBeInTheDocument()
  })

  
  it('closes the equipment details modal', async () => {
    render(<App />)

    const equipmentCard = await screen.findByRole('button', {
      name: /Laptop Dell/i,
    })

    fireEvent.click(equipmentCard)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Cerrar detalles' })
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  
  it('displays an error message when the API request fails', async () => {
    vi.mocked(getEquipment).mockRejectedValueOnce(
      new Error('Error de conexión con el servidor.')
    )

    render(<App />)

    expect(
      await screen.findByText('Error de conexión con el servidor.')
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Laptop Dell')
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: 'Intentar nuevamente' })
    ).toBeInTheDocument()
  })

})
