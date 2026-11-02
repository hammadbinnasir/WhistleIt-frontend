// Central API client. NO component should call fetch() directly.
// Owner: Auth (token attach + refresh) with App shell lead. Stub for now.
import { getAuthToken } from '@/features/auth/session'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function apiRequest(path, options = {}) {
  const { headers: optionHeaders = {}, ...requestOptions } = options
  const token = getAuthToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw { status: res.status, message: data?.message || res.statusText }
  }
  return data
}
