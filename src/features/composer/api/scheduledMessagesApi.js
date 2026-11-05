import { getAuthToken } from '@/features/auth/session'

const SCHEDULED_MESSAGES_PATH = '/v1/scheduled-messages'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://10.0.105.90:8000'

async function request(path, options = {}) {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  let data = null
  try {
    data = await response.json()
  } catch (error) {
    if (response.ok) throw error
  }
  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || response.statusText || 'Scheduled message request failed.')
  }
  return data
}

export function createScheduledMessage(payload) {
  return request(SCHEDULED_MESSAGES_PATH, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getScheduledMessages() {
  return request(SCHEDULED_MESSAGES_PATH)
}
