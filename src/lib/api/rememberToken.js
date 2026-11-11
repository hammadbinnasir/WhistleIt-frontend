import { getRememberToken } from '@/features/auth/session'

export function getRememberTokenHeaders() {
  const token = getRememberToken()
  return token ? { 'X-Remember-Token': token } : {}
}
