import { http } from '@/features/channels/api/http'

const userPath = (userId, suffix = '') => `/v1/users/${encodeURIComponent(userId)}${suffix}`

export function getPublicProfile(userId) {
  return http(userPath(userId))
}

export function uploadUserAvatar(userId, file) {
  const body = new FormData()
  body.append('avatar', file)
  return http(userPath(userId, '/avatar'), { method: 'POST', body })
}

export function deleteUserAvatar(userId) {
  return http(userPath(userId, '/avatar'), { method: 'DELETE' })
}
