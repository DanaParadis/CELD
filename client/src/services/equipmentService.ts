
import type { Equipment } from '../types/equipment'
import { apiRequest } from './api'

export function getEquipment(
  search = '',
  category = '',
  signal?: AbortSignal,
): Promise<Equipment[]> {
  const query = new URLSearchParams()
  if (search.trim()) query.set('search', search.trim())
  if (category) query.set('category', category)
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  return apiRequest<Equipment[]>(`/api/equipment${suffix}`, { signal })
}

export function getEquipmentById(id: number): Promise<Equipment> {
  return apiRequest<Equipment>(`/api/equipment/${id}`)
}
