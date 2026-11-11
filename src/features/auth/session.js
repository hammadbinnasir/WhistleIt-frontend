const TOKEN_KEY = 'authToken'
const USER_KEY = 'authUser'
const USER_ID_KEY = 'authUserId'
const REMEMBER_TOKEN_KEY = 'rememberToken'
const REDIRECT_KEY = 'authRedirect'

function isInternalRedirect(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
}

export function saveAuthRedirect(path) {
  if (!isInternalRedirect(path)) return
  sessionStorage.setItem(REDIRECT_KEY, path)
}

export function consumeAuthRedirect() {
  const path = sessionStorage.getItem(REDIRECT_KEY)
  sessionStorage.removeItem(REDIRECT_KEY)
  return isInternalRedirect(path) ? path : null
}

function getFullName(user) {
  if (!user || typeof user !== 'object') return ''
  const fullName =
    user.full_name ??
    user.fullName ??
    user.name ??
    [user.first_name ?? user.firstName, user.last_name ?? user.lastName]
      .filter((part) => typeof part === 'string')
      .join(' ')
  return typeof fullName === 'string' ? fullName.trim() : ''
}

function getUserId(user) {
  if (!user || typeof user !== 'object') return null
  const id = user.id ?? user.user_id ?? user.userId ?? user.sub
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null
}

function normalizeUser(user) {
  if (!user || typeof user !== 'object') return null
  const id = getUserId(user)
  const fullName = getFullName(user)
  if (!id && !fullName) return null
  return { ...(id ? { id } : {}), ...(fullName ? { fullName } : {}) }
}

function getUserFromResponse(response) {
  const candidates = [
    response?.user,
    response?.profile,
    response?.data?.user,
    response?.data?.profile,
    response?.data?.data?.user,
    response?.data?.data,
    response?.data,
    response,
  ]
  for (const candidate of candidates) {
    const user = normalizeUser(candidate)
    if (user) return user
  }
  return null
}

function getUserFromToken(token) {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    return normalizeUser(decoded)
  } catch {
    return null
  }
}

function isExpiredToken(token) {
  const payload = token.split('.')[1]
  if (!payload) return false

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    return typeof decoded.exp === 'number' && decoded.exp <= Date.now() / 1000
  } catch {
    return false
  }
}

function clearStoredCredentials() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(TOKEN_KEY)
    storage.removeItem(USER_KEY)
    storage.removeItem(USER_ID_KEY)
  }
}

function clearAuthCredentials() {
  clearStoredCredentials()
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(REMEMBER_TOKEN_KEY)
  }
}

export function saveAuthToken(response) {
  clearAuthCredentials()

  const responseData = response?.data
  const nestedResponseData = responseData?.data
  const rawRememberToken =
    response?.rememberToken ??
    response?.remember_token ??
    responseData?.rememberToken ??
    responseData?.remember_token ??
    nestedResponseData?.rememberToken ??
    nestedResponseData?.remember_token
  const rememberToken =
    typeof rawRememberToken === 'string' ? rawRememberToken.trim() : rawRememberToken
  if (typeof rememberToken === 'string' && rememberToken.length > 0) {
    sessionStorage.setItem(REMEMBER_TOKEN_KEY, rememberToken)
  }

  const rawToken =
    response?.token ??
    response?.access_token ??
    response?.accessToken ??
    response?.data?.token ??
    response?.data?.access_token ??
    response?.data?.accessToken ??
    response?.data?.data?.token ??
    response?.data?.data?.access_token ??
    response?.data?.data?.accessToken
  const token = typeof rawToken === 'string' ? rawToken.replace(/^Bearer\s+/i, '').trim() : rawToken

  const authToken = typeof token === 'string' && token.trim().length > 0 ? token.trim() : null
  if (authToken) localStorage.setItem(TOKEN_KEY, authToken)
  const user =
    getUserFromResponse(response) || (typeof token === 'string' ? getUserFromToken(token) : null)
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    if (user.id) localStorage.setItem(USER_ID_KEY, user.id)
  }
  return (
    authToken ||
    (typeof rememberToken === 'string' && rememberToken.length > 0 ? rememberToken : null)
  )
}

export function getAuthUser() {
  const storedUser = localStorage.getItem(USER_KEY)
  if (!storedUser) return null

  try {
    const user = JSON.parse(storedUser)
    return normalizeUser(user)
  } catch {
    return null
  }
}

export function getAuthUserId() {
  if (!getAuthToken() && !getRememberToken()) return null
  return localStorage.getItem(USER_ID_KEY) || getAuthUser()?.id || null
}

export function getRememberToken() {
  return sessionStorage.getItem(REMEMBER_TOKEN_KEY)
}

export function getAuthToken() {
  if (
    sessionStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(USER_KEY) ||
    sessionStorage.getItem(USER_ID_KEY)
  ) {
    clearStoredCredentials()
  }

  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    if (
      !getRememberToken() &&
      (localStorage.getItem(USER_KEY) || localStorage.getItem(USER_ID_KEY))
    ) {
      clearStoredCredentials()
    }
    return null
  }

  if (token && isExpiredToken(token)) {
    clearAuthSession()
    return null
  }
  return token
}

export function hasAuthSession() {
  return Boolean(getAuthToken() || getRememberToken())
}

export function clearAuthSession() {
  clearAuthCredentials()
  localStorage.removeItem(REDIRECT_KEY)
  sessionStorage.removeItem(REDIRECT_KEY)
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('verified_token_')) sessionStorage.removeItem(key)
  }
}

export function expireAuthSession() {
  clearAuthSession()
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'))
}
