import { describe, expect, it } from 'vitest'
import { searchMessages } from './search'

describe('search date filters', () => {
  it('filters messages before and after a selected date', async () => {
    const before = await searchMessages({ date: '2026-10-22', dateMode: 'before' })
    const after = await searchMessages({ date: '2026-10-20', dateMode: 'after' })

    expect(before.items).toHaveLength(1)
    expect(after.items).toHaveLength(1)
  })

  it('filters messages within an inclusive date range', async () => {
    const result = await searchMessages({
      date: '2026-10-21',
      dateEnd: '2026-10-21',
      dateMode: 'range',
    })

    expect(result.items).toHaveLength(1)
  })
})
