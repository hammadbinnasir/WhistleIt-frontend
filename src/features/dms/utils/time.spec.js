import { describe, expect, it } from 'vitest'
import { dayLabel, fullDate, longDate, timeAgo } from './time'

const NOW = new Date(2026, 10, 5, 13, 0, 0) // 5 Nov 2026, 1:00 PM (local)
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('time helpers', () => {
  it('shows relative time for new and old messages', () => {
    expect(timeAgo(ago(10_000), NOW)).toBe('just now')
    expect(timeAgo(ago(MIN), NOW)).toBe('1 minute ago')
    expect(timeAgo(ago(25 * MIN), NOW)).toBe('25 minutes ago')
    expect(timeAgo(ago(HOUR), NOW)).toBe('1 hour ago')
    expect(timeAgo(ago(5 * HOUR), NOW)).toBe('5 hours ago')
    expect(timeAgo(ago(DAY), NOW)).toBe('yesterday')
    expect(timeAgo(ago(3 * DAY), NOW)).toBe('3 days ago')
    expect(timeAgo(ago(7 * DAY), NOW)).toBe('7 days ago')
  })

  it('shows date, month and time for messages older than 7 days', () => {
    expect(timeAgo(new Date(2026, 9, 26, 16, 27, 28), NOW)).toBe('Oct 26th at 4:27 PM')
    expect(timeAgo(new Date(2025, 9, 26, 9, 5, 0), NOW)).toBe('Oct 26th, 2025 at 9:05 AM')
  })

  it('says Today / Yesterday in the tooltip', () => {
    expect(fullDate(new Date(2026, 10, 5, 15, 33, 57), NOW)).toBe('Today at 3:33:57 PM')
    expect(fullDate(new Date(2026, 10, 4, 23, 10, 0), NOW)).toBe('Yesterday at 11:10:00 PM')
  })

  it('treats a time slightly in the future (clock difference) as just now', () => {
    expect(timeAgo(ago(-5000), NOW)).toBe('just now')
  })

  it('returns an empty label for a missing or broken date', () => {
    expect(timeAgo('', NOW)).toBe('')
    expect(timeAgo('not a date', NOW)).toBe('')
    expect(fullDate(null)).toBe('')
    expect(longDate(undefined)).toBe('')
  })

  it('formats the hover tooltip like "Nov 2nd at 12:39:25 PM"', () => {
    expect(fullDate(new Date(2026, 10, 2, 12, 39, 25), NOW)).toBe('Nov 2nd at 12:39:25 PM')
    expect(fullDate(new Date(2026, 10, 1, 9, 5, 7), NOW)).toBe('Nov 1st at 9:05:07 AM')
    expect(fullDate(new Date(2026, 9, 23, 0, 0, 0), NOW)).toBe('Oct 23rd at 12:00:00 AM')
    expect(fullDate(new Date(2026, 9, 11, 18, 0, 0), NOW)).toBe('Oct 11th at 6:00:00 PM')
  })

  it('adds the year for dates from another year', () => {
    expect(fullDate(new Date(2025, 11, 31, 23, 59, 59), NOW)).toBe('Dec 31st, 2025 at 11:59:59 PM')
  })

  it('formats the last reply date like "Nov 02, 2026 at 1:02 PM"', () => {
    expect(longDate(new Date(2026, 10, 2, 13, 2, 40))).toBe('Nov 02, 2026 at 1:02 PM')
  })

  it('labels the day pill as Today / Yesterday / Oct 14, 2026', () => {
    expect(dayLabel(new Date(2026, 10, 5, 9, 0), NOW)).toBe('Today')
    expect(dayLabel(new Date(2026, 10, 4, 23, 0), NOW)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 9, 14, 9, 50), NOW)).toBe('Oct 14, 2026')
  })
})