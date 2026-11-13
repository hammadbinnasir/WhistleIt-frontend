import { http } from '@/features/channels/api/http'
import { clearAuthSession } from './session'

export function login(credentials) {
  return http('/v1/auth/login', { method: 'POST', body: credentials, auth: false })
}

export async function logout() {
  try {
    return await http('/v1/auth/logout', { method: 'POST', body: { is_remember: false } })
  } finally {
    clearAuthSession()
  }
}

export function register(account) {
  return http('/v1/auth/register', { method: 'POST', body: account, auth: false })
}

export function sendInvitation(
  email,
  frontendUrl = typeof window !== 'undefined' ? window.location.origin : '',
) {
  return http('/sendinvitation', {
    method: 'POST',
    body: { email, frontend_url: frontendUrl },
  })
}

export function registerViaInvitation(token, account) {
  return http(`/invitation/register/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: account,
    auth: false,
  })
}

export function loginViaInvitation(token, credentials) {
  return http(`/invitation/login/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: credentials,
    auth: false,
  })
}

export function requestPasswordReset(email) {
  return http('/forgetpassword', { method: 'POST', body: { email }, auth: false })
}

export function resetPassword(token, credentials) {
  return http(`/forgetpassword/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: credentials,
    auth: false,
  })
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
