import { http } from '@/features/channels/api/http'

const userPath = (userId, suffix = '') => `/v1/users/${encodeURIComponent(userId)}${suffix}`

export function getUserProfile(userId) {
  return http(userPath(userId, '/profile'))
}

export function updateUserProfile(userId, profile) {
  return http(userPath(userId, '/profile'), { method: 'PATCH', body: profile })
}

export function updateUserStatus(userId, status) {
  return http(userPath(userId, '/status'), { method: 'PUT', body: status })
}

export function deleteUserCustomStatus(userId) {
  return http(userPath(userId, '/status/custom'), { method: 'DELETE' })
}

export function uploadUserAvatar(userId, file) {
  const body = new FormData()
  body.append('avatar', file)
  return http(userPath(userId, '/avatar'), { method: 'POST', body })
}

export function deleteUserAvatar(userId) {
  return http(userPath(userId, '/avatar'), { method: 'DELETE' })
}

export function updateUserPassword(userId, password) {
  return http(userPath(userId, '/password'), {
    method: 'PUT',
    body: {
      old_password: password.oldPassword,
      new_password: password.newPassword,
      new_password_confirmation: password.newPasswordConfirmation,
    },
  })
}
