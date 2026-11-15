import { apiRequest, postWithCsrf } from './api'
import type { CurrentUser } from '../types/reservation'

export function getCurrentUser(): Promise<CurrentUser | null> {
  return apiRequest<{ user: CurrentUser | null }>('/api/auth/me')
    .then((session) => session.user)
}

export function signIn(username: string, password: string): Promise<CurrentUser> {
  return postWithCsrf<CurrentUser>('/api/auth/login', { username, password })
}

export function signOut(): Promise<void> {
  return postWithCsrf<void>('/api/auth/logout')
}
