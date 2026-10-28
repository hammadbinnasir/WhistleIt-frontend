import { http } from '@/features/channels/api/http'

export function login(credentials) {
  return http('/login', { method: 'POST', body: credentials, auth: false })
}

export function register(account) {
  return http('/register', { method: 'POST', body: account, auth: false })
}

export function requestPasswordReset(email) {
  return http('/forgot-password', { method: 'POST', body: { email }, auth: false })
}

export function resetPassword(credentials) {
  return http('/reset-password', { method: 'POST', body: credentials, auth: false })
}

export function verifyEmail(token) {
  return http(`/auth/verify/${encodeURIComponent(token)}`, { method: 'GET', auth: false })
}

export function resendVerificationEmail(
  email,
  frontendUrl = typeof window !== 'undefined' ? window.location.origin : '',
) {
  return http('/auth/resend-verification', {
    method: 'POST',
    body: { email, frontend_url: frontendUrl },
    auth: false,
  })
}
