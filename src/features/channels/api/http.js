import { clearAuthSession, getAuthToken } from '@/features/auth/session'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://10.0.105.90:8000/api'

export class ApiError extends Error {
  constructor(message, { status = 0, details = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function getAuthHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: 'Bearer ' + token } : {}
}

export async function http(
  path,
  { method = 'GET', body, params, signal, credentials = 'omit', auth = true, headers = {} } = {},
) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    })
  }
  let response
  try {
    response = await fetch(url.toString(), {
      method,
      credentials,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth ? getAuthHeaders() : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    throw new ApiError(error.message || 'Network request failed', { details: error })
  }
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (response.status === 401) clearAuthSession()
  if (!response.ok) {
    throw new ApiError(payload?.message || response.statusText || 'Request failed', {
      status: response.status,
      details: payload,
    })
  }
  return payload
}
