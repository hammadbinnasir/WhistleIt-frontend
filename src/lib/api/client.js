// Central API client. NO component should call fetch() directly.
import { getAuthToken } from '@/features/auth/session'

const BASE_URL = import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_BASE_URL

function responseErrorMessage(data, fallback) {
  if (typeof data?.message === 'string' && data.message) return data.message
  const detail = data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const location = Array.isArray(item?.loc) ? item.loc.slice(1).join('.') : ''
        const message = item?.msg ?? item?.message
        return [location, message].filter(Boolean).join(': ')
      })
      .filter(Boolean)
      .join('; ')
  }
  if (detail && typeof detail === 'object') {
    return Object.entries(detail)
      .map(([field, message]) => `${field}: ${message}`)
      .join('; ')
  }
  return fallback
}

export async function apiRequest(path, options = {}) {
  const { headers: optionHeaders = {}, ...requestOptions } = options
  const token = getAuthToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...optionHeaders,
    },
  })
  let data
  try {
    data = await res.json()
  } catch (error) {
    if (res.ok) throw error
  }
  if (!res.ok || data?.success === false) {
    throw {
      status: res.status,
      message: responseErrorMessage(data, res.statusText),
      details: data,
    }
  }
  return data
}
