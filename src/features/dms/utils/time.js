import { getCurrentScope, onScopeDispose, ref } from 'vue'

// Message ke waqt ko dikhane ke helpers (browser ke local time zone mein)

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseDate(value) {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'} ago`

// 7 din tak: "just now", "1 minute ago", "5 hours ago", "yesterday", "3 days ago"
// 7 din se purana: "Oct 26th at 4:27 PM" (dusre saal ka: "Oct 26th, 2025 at 4:27 PM")
export function timeAgo(value, now = Date.now()) {
  const date = parseDate(value)
  if (!date) return ''
  if (Number(now) - date.getTime() > 7 * DAY) return shortDate(date, now)
  // thoda aage ka waqt (dono computers ki ghari ka farq) bhi "just now"
  const diff = Math.max(0, Number(now) - date.getTime())
  if (diff < 45_000) return 'just now'
  const minutes = Math.max(1, Math.round(diff / MINUTE))
  if (minutes < 60) return plural(minutes, 'minute')
  const hours = Math.round(diff / HOUR)
  if (hours < 24) return plural(hours, 'hour')
  const days = Math.round(diff / DAY)
  if (days === 1) return 'yesterday'
  if (days < 30) return plural(days, 'day')
  const months = Math.round(days / 30)
  if (months < 12) return plural(months, 'month')
  return plural(Math.max(1, Math.round(days / 365)), 'year')
}

function ordinal(n) {
  const suffix = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0])
}

function clock(date, { seconds = false } = {}) {
  const h = date.getHours() % 12 || 12
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}${seconds ? `:${s}` : ''} ${date.getHours() < 12 ? 'AM' : 'PM'}`
}

function dayDiff(date, now) {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const n = new Date(Number(now))
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate())
  return Math.round((b - a) / DAY)
}

function dayAndMonth(date, now) {
  const year =
    date.getFullYear() !== new Date(Number(now)).getFullYear() ? `, ${date.getFullYear()}` : ''
  return `${MONTHS[date.getMonth()]} ${ordinal(date.getDate())}${year}`
}

// 7 din se purane message ka label: "Oct 26th at 4:27 PM"
export function shortDate(value, now = Date.now()) {
  const date = parseDate(value)
  if (!date) return ''
  return `${dayAndMonth(date, now)} at ${clock(date)}`
}

// Hover/click tooltip: "Today at 3:33:57 PM", "Yesterday at …", "Oct 26th at 4:27:28 PM"
// (dusre saal ka ho to "Dec 31st, 2025 at …")
export function fullDate(value, now = Date.now()) {
  const date = parseDate(value)
  if (!date) return ''
  const days = dayDiff(date, now)
  if (days === 0) return `Today at ${clock(date, { seconds: true })}`
  if (days === 1) return `Yesterday at ${clock(date, { seconds: true })}`
  const year =
    date.getFullYear() !== new Date(Number(now)).getFullYear() ? `, ${date.getFullYear()}` : ''
  return `${MONTHS[date.getMonth()]} ${ordinal(date.getDate())}${year} at ${clock(date, { seconds: true })}`
}

// "Last reply: Nov 02, 2026 at 1:02 PM"
export function longDate(value) {
  const date = parseDate(value)
  if (!date) return ''
  const day = String(date.getDate()).padStart(2, '0')
  return `${MONTHS[date.getMonth()]} ${day}, ${date.getFullYear()} at ${clock(date)}`
}

// Chat mein din ki pill: "Today", "Yesterday", "Oct 14, 2026"
export function dayLabel(value, now = Date.now()) {
  const date = parseDate(value)
  if (!date) return ''
  const days = dayDiff(date, now)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`
}

// Isi user ka pichla message 5 minute ke andar ho to naam/avatar dobara na dikhao
export function isContinuation(previous, message, gap = 5 * MINUTE) {
  if (!previous || !message || previous.from !== message.from) return false
  const a = parseDate(previous.createdAt)
  const b = parseDate(message.createdAt)
  return Boolean(a && b && b - a >= 0 && b - a < gap)
}

// Sab components ka ek hi "abhi" ka waqt: har 30 sec badalta hai,
// taake "just now" khud "1 minute ago" ban jaye (page reload ke bina)
const now = ref(Date.now())
let timer = null
let users = 0

export function useNow() {
  users += 1
  now.value = Date.now() // naya component: taaza waqt se shuru
  if (!timer && typeof window !== 'undefined') {
    timer = setInterval(() => {
      now.value = Date.now()
    }, 30_000)
  }
  if (getCurrentScope()) {
    onScopeDispose(() => {
      users -= 1
      if (!users) {
        clearInterval(timer)
        timer = null
      }
    })
  }
  return now
}