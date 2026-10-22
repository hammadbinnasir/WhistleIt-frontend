// Minimal fetch wrapper used by the Channels API.
// If your project already has an axios/fetch instance (with auth + interceptors),
// replace the body of `http()` to use it. Nothing else in the module needs to change.
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

// TODO(adapt): return the auth header your app uses, e.g. { Authorization: `Bearer ${token}` }
function getAuthHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function http(
  path,
  { method = 'GET', body, params, signal, credentials = 'omit' } = {},
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
      signal,
      credentials,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...getAuthHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError('Network error. Please check your connection.')
  }

  let data = null
  if (response.status !== 204) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession()
      window.dispatchEvent(new Event('auth:expired'))
    }
    throw new ApiError(data?.message || `Request failed (${response.status})`, {
      status: response.status,
      details: data,
    })
  }
  return data
}
