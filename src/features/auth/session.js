const TOKEN_KEY = 'authToken'

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
  return token
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
}
