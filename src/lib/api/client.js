// Central API client. NO component should call fetch() directly.
import { expireAuthSession, getAuthToken, hasAuthSession } from '@/features/auth/session'
import { getRememberTokenHeaders } from './rememberToken'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://10.0.105.90:8000/api'

export class ApiRequestError extends Error {
  constructor(message, { status = 0, details = null } = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.details = details
  }
}

export async function apiRequest(path, options = {}) {
  const { headers: optionHeaders = {}, auth = true, ...requestOptions } = options
  const token = auth ? getAuthToken() : null
  if (auth && !hasAuthSession()) {
    expireAuthSession()
    throw new ApiRequestError('Your login session is missing. Please sign in again.', {
      status: 401,
    })
  }

  let res
  const isFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...requestOptions,
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...optionHeaders,
        ...getRememberTokenHeaders(),
      },
    })
  } catch (error) {
    throw new ApiRequestError(error.message || 'Network request failed.', { details: error })
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    if (res.ok && res.status !== 204) {
      throw new ApiRequestError('The server returned an unreadable response.', {
        status: res.status,
      })
    }
  }

  const missingToken =
    res.status === 403 && /missing authentication token/i.test(data?.message || '')
  if (auth && (res.status === 401 || missingToken)) expireAuthSession()
  if (!res.ok || data?.success === false) {
    throw new ApiRequestError(data?.message || res.statusText || 'Request failed.', {
      status: res.status,
      details: data,
    })
  }
  return data
}
