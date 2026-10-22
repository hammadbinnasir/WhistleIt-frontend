const TOKEN_KEY = 'authToken'

export function saveAuthToken(response, remember = false) {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)

  const token =
    response?.token ??
    response?.access_token ??
    response?.data?.token ??
    response?.data?.access_token

  if (typeof token === 'string' && token.length > 0) {
    const storage = remember ? localStorage : sessionStorage
    storage.setItem(TOKEN_KEY, token)
  }
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}
