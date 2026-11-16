const STATUS_KEY_PREFIX = 'whistleit:status-mode:'
const VALID_STATUS_MODES = new Set(['online', 'away', 'offline', 'dnd'])

export function getSavedStatusMode(userId) {
  if (!userId || typeof localStorage === 'undefined') return null
  const status = localStorage.getItem(`${STATUS_KEY_PREFIX}${userId}`)
  return VALID_STATUS_MODES.has(status) ? status : null
}

export function saveStatusMode(userId, status) {
  if (!userId || typeof localStorage === 'undefined' || !VALID_STATUS_MODES.has(status)) return
  localStorage.setItem(`${STATUS_KEY_PREFIX}${userId}`, status)
}
