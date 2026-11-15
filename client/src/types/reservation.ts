export type AccountRole = 'Student' | 'Staff'

export interface CurrentUser {
  id: number
  displayName: string
  role: AccountRole
}

export interface ReservationHistoryEvent {
  id: number
  eventType: string
  status: string
  actorDisplayName: string
  occurredAtUtc: string
}

export interface Reservation {
  id: number
  status: 'Reserved' | 'CheckedOut' | 'Cancelled' | 'Returned'
  createdAtUtc: string
  equipment: {
    id: number
    assetCode: string
    name: string
    category: string
    availability: 'Available' | 'Unavailable'
  }
  student: {
    id: number
    displayName: string
  }
  history: ReservationHistoryEvent[]
}
