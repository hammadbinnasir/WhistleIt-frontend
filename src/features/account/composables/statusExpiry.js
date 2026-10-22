export const DURATIONS = [
  { value: 'never', label: 'Never' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: 'today', label: 'Today' },
  { value: 'date', label: 'Choose Date' },
]

const pad = (n) => String(n).padStart(2, '0')

/** Timestamp -> "YYYY-MM-DD" (local time), the format <input type="date"> uses. */
export const toDateInput = (ms) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const todayInput = () => toDateInput(Date.now())

const endOfDay = (y, m, d) => new Date(y, m, d, 23, 59, 59, 999).getTime()

/**
 * When should the custom status disappear?
 * Returns a timestamp (ms) or null for "never" / an invalid date.
 */
export function computeExpiry(duration, dateStr = '', now = Date.now()) {
  switch (duration) {
    case '30m':
      return now + 30 * 60 * 1000
    case '1h':
      return now + 60 * 60 * 1000
    case '4h':
      return now + 4 * 60 * 60 * 1000
    case 'today': {
      const d = new Date(now)
      return endOfDay(d.getFullYear(), d.getMonth(), d.getDate())
    }
    case 'date': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
      return m ? endOfDay(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
    }
    default:
      return null
  }
}
