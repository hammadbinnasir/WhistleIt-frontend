import { expireAuthSession, getAuthToken } from '@/features/auth/session'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://10.0.105.90:8000/api'

export class ApiError extends Error {
  constructor(message, { status = 0, details = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function http(
  path,
  {
    method = 'GET',
    body,
    params,
    signal,
    credentials = 'omit',
    auth = true,
    headers = {},
    responseType = 'json',
  } = {},
) {
  const token = auth ? getAuthToken() : null
  if (auth && !token) {
    expireAuthSession()
    throw new ApiError('Your login session is missing. Please sign in again.', { status: 401 })
  }

  const baseUrl = new URL(BASE_URL, window.location.origin)
  const basePath = baseUrl.pathname.replace(/\/$/, '')
  const isAbsoluteUrl = /^https?:\/\//i.test(path)
  const alreadyIncludesBasePath =
    basePath && (path === basePath || path.startsWith(`${basePath}/`))
  const url = isAbsoluteUrl
    ? new URL(path)
    : alreadyIncludesBasePath
      ? new URL(path, baseUrl.origin)
      : new URL(`${BASE_URL}${path}`, window.location.origin)
  if (basePath && url.origin === baseUrl.origin) {
    while (url.pathname.startsWith(`${basePath}${basePath}/`)) {
      url.pathname = url.pathname.slice(basePath.length)
    }
  }
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    })
  }
  let response
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  try {
    response = await fetch(url.toString(), {
      method,
      credentials,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    })
  } catch (error) {
    throw new ApiError(error.message || 'Network request failed', { details: error })
  }
  let payload = null
  if (!response.ok || responseType !== 'blob') {
    try {
      payload = await response.json()
    } catch (error) {
      if (response.ok && response.status !== 204) {
        throw new ApiError('The server returned an unreadable response.', {
          status: response.status,
          details: error,
        })
      }
    }
  }
  const missingToken =
    response.status === 403 && /missing authentication token/i.test(payload?.message || '')
  if (auth && (response.status === 401 || missingToken)) expireAuthSession()
  if (!response.ok) {
    throw new ApiError(payload?.message || response.statusText || 'Request failed', {
      status: response.status,
      details: payload,
    })
  }
  if (responseType === 'blob') return response.blob()
  return payload
}
