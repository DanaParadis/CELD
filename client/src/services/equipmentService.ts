
import type { Equipment } from '../types/equipment'

const API_URL = 'http://localhost:5133'

export async function getEquipment(): Promise<Equipment[]> {
  const response = await fetch(`${API_URL}/api/equipment`)

  if (!response.ok) {
    throw new Error('No se pudo obtener el catálogo de equipos.')
  }

  return response.json()
}
