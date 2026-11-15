import { apiRequest, postWithCsrf } from './api'
import type { Reservation } from '../types/reservation'

export function getMyReservations(): Promise<Reservation[]> {
  return apiRequest<Reservation[]>('/api/reservations')
}

export function getStaffReservations(status = ''): Promise<Reservation[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiRequest<Reservation[]>(`/api/staff/reservations${query}`)
}

export function createReservation(equipmentId: number): Promise<Reservation> {
  return postWithCsrf<Reservation>('/api/reservations', { equipmentId })
}

export function transitionReservation(
  id: number,
  action: 'cancel' | 'pickup' | 'return',
): Promise<Reservation> {
  return postWithCsrf<Reservation>(`/api/reservations/${id}/${action}`)
}
