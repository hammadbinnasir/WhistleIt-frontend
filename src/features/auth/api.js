import { http } from '@/features/channels/api/http'

export function login(credentials) {
  return http('/login', { method: 'POST', body: credentials })
}

export function register(account) {
  return http('/register', { method: 'POST', body: account })
}

export function requestPasswordReset(email) {
  return http('/forgot-password', { method: 'POST', body: { email } })
}
