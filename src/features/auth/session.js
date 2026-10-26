const TOKEN_KEY = 'authToken'
const USER_KEY = 'authUser'

function getFullName(user) {
  if (!user || typeof user !== 'object') return ''
  const fullName =
    user.full_name ??
    user.fullName ??
    user.name ??
    [
      user.first_name ?? user.firstName,
      user.last_name ?? user.lastName,
    ]
      .filter((part) => typeof part === 'string')
      .join(' ')
  return typeof fullName === 'string' ? fullName.trim() : ''
}

function getUserFromResponse(response) {
  const candidates = [
    response?.user,
    response?.profile,
    response?.data?.user,
    response?.data?.profile,
    response?.data?.data?.user,
    response?.data,
  ]
  for (const candidate of candidates) {
    const fullName = getFullName(candidate)
    if (fullName) return { fullName }
  }
  return null
}

function getUserFromToken(token) {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const fullName = getFullName(decoded)
    return fullName ? { fullName } : null
  } catch {
    return null
  }
}

export function saveAuthToken(response, remember = false) {
  clearAuthSession()

  const token =
    response?.token ??
    response?.access_token ??
    response?.data?.token ??
    response?.data?.access_token

  if (typeof token !== 'string' || token.trim().length === 0) return null

  const storage = remember ? localStorage : sessionStorage
  storage.setItem(TOKEN_KEY, token)
  const user = getUserFromResponse(response) || getUserFromToken(token)
  if (user) storage.setItem(USER_KEY, JSON.stringify(user))
  return token
}

export function getAuthUser() {
  const storedUser = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
  if (!storedUser) return null

  try {
    const user = JSON.parse(storedUser)
    return typeof user?.fullName === 'string' ? user : null
  } catch {
    return null
  }
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

export function hasAuthSession() {
  return Boolean(getAuthToken())
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(USER_KEY)
}
