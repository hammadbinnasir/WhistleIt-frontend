import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/dms/dmApi', () => ({
  dmApi: {
    meId: vi.fn(() => 'u1'), listDirectChannels: vi.fn(), getDirectChannel: vi.fn(async () => null),
    listMessages: vi.fn(async () => []), getMessage: vi.fn(), sendMessage: vi.fn(), updateMessage: vi.fn(),
    deleteMessage: vi.fn(), listCompanyMembers: vi.fn(async () => []), presence: vi.fn(async () => ({})),
    updateUserStatus: vi.fn(async () => null), getUserStatus: vi.fn(async () => null), markRecent: vi.fn(),
  },
}))

import { dmApi } from '@/features/dms/dmApi'
import { useDmStore, CONVERSATIONS_KEY, OUTBOX_KEY, CLOSED_KEY } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'

const at = (m) => new Date(Date.UTC(2026, 10, 10, 8, m)).toISOString()
const channel = (id, name, lastAt, recentAt = '') => ({
  conversation: { id, type: 'dm', members: ['u1', name], name: '', unreadCount: 0, lastActivityAt: lastAt, recentAt,
    messages: [{ id: `${id}-m`, from: name, text: 'hi', createdAt: lastAt }] },
  users: [{ id: 'u1', name: 'Hira' }, { id: name, name }],
})
const setOnline = (value) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
const saved = (key) => JSON.parse(localStorage.getItem(key) || '{}')['company-1']

async function setup() {
  const dms = useDmStore()
  await dms.init()
  return dms
}

describe('dms store: PATCH .../recent (local + network)', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); setOnline(true); setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    dmApi.listDirectChannels.mockResolvedValue([channel('c1', 'u2', at(10)), channel('c2', 'u3', at(5))])
  })
  afterEach(() => { useDmStore().stopPolling?.(); setOnline(true); vi.useRealTimers() })

  it('moves the DM to the top at once (optimistic + localStorage), then syncs with the server time', async () => {
    let resolve
    dmApi.markRecent.mockImplementation(() => new Promise((r) => { resolve = r }))
    const dms = await setup()
    expect(dms.sorted.map((c) => c.id)).toEqual(['c1', 'c2'])

    dms.openConversation('c2')
    expect(dms.sorted.map((c) => c.id)).toEqual(['c2', 'c1']) // foran, network se pehle
    expect(dms.recentStatusOf('c2')).toBe('saving')
    expect(saved(CONVERSATIONS_KEY).conversations.find((c) => c.id === 'c2').recentAt).toBeTruthy()
    expect(dmApi.markRecent).toHaveBeenCalledWith('company-1', 'c2', expect.any(String))

    resolve('2026-11-10T09:00:00.000Z')
    await vi.waitFor(() => expect(dms.recentStatusOf('c2')).toBe(''))
    expect(dms.conversations.find((c) => c.id === 'c2').recentAt).toBe('2026-11-10T09:00:00.000Z')
  })

  it('network failure: keeps the local order, queues in localStorage and syncs when back online', async () => {
    dmApi.markRecent.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const dms = await setup()
    dms.openConversation('c2')
    await vi.waitFor(() => expect(dms.recentStatusOf('c2')).toBe('pending'))
    expect(dms.sorted[0].id).toBe('c2')
    expect(saved(OUTBOX_KEY)).toEqual([expect.objectContaining({ type: 'recent', conversationId: 'c2' })])

    dmApi.markRecent.mockResolvedValue('')
    await dms.flushOutbox()
    expect(dmApi.markRecent).toHaveBeenCalledTimes(2)
    expect(dms.recentStatusOf('c2')).toBe('')
    expect(saved(OUTBOX_KEY)).toEqual([])
  })

  it('offline: no request, queued once per conversation (latest time)', async () => {
    const dms = await setup()
    setOnline(false)
    dms.openConversation('c2')
    dms.openConversation('c1')
    dms.openConversation('c2')
    expect(dmApi.markRecent).not.toHaveBeenCalled()
    expect(saved(OUTBOX_KEY).filter((o) => o.conversationId === 'c2')).toHaveLength(1)
    expect(dms.recentStatusOf('c2')).toBe('pending')
  })

  it('4xx: local order stays, row shows error, opening again retries', async () => {
    dmApi.markRecent.mockRejectedValueOnce(Object.assign(new Error('Unprocessable'), { status: 422 }))
    const dms = await setup()
    dms.openConversation('c2')
    await vi.waitFor(() => expect(dms.recentStatusOf('c2')).toBe('error'))
    expect(dms.sorted[0].id).toBe('c2')
    expect(dms.actionError).toBeFalsy() // background: toast nahi

    dmApi.markRecent.mockResolvedValue('')
    dms.openConversation('c2') // throttle ke andar bhi, error par dobara
    await vi.waitFor(() => expect(dms.recentStatusOf('c2')).toBe(''))
    expect(dmApi.markRecent).toHaveBeenCalledTimes(2)
  })

  it('throttles repeated opens of the same DM', async () => {
    dmApi.markRecent.mockResolvedValue('')
    const dms = await setup()
    dms.openConversation('c2')
    await vi.waitFor(() => expect(dms.recentStatusOf('c2')).toBe(''))
    dms.openConversation('c1')
    dms.openConversation('c2')
    expect(dmApi.markRecent.mock.calls.filter((c) => c[1] === 'c2')).toHaveLength(1)
  })

  it('reload: an older server value does not undo a local (unsynced) recent', async () => {
    const dms = await setup()
    setOnline(false)
    dms.openConversation('c2')
    const local = dms.conversations.find((c) => c.id === 'c2').recentAt

    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    setOnline(true)
    dmApi.markRecent.mockResolvedValue('')
    dmApi.listDirectChannels.mockResolvedValue([channel('c1', 'u2', at(10)), channel('c2', 'u3', at(5), at(1))])
    const again = useDmStore(); await again.init()
    expect(again.conversations.find((c) => c.id === 'c2').recentAt).toBe(local)
    expect(again.sorted[0].id).toBe('c2')
    await vi.waitFor(() => expect(again.recentStatusOf('c2')).toBe('')) // init ke baad outbox khud gaya
  })

  it('a request that never answers does not leave the spinner: after the timeout it is queued (◷)', async () => {
    const dms = await setup()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    dmApi.markRecent.mockImplementation(() => new Promise(() => {})) // kabhi jawab nahi
    dms.openConversation('c2')
    expect(dms.recentStatusOf('c2')).toBe('saving')
    await vi.advanceTimersByTimeAsync(12_500)
    expect(dms.recentStatusOf('c2')).toBe('pending')
    expect(saved(OUTBOX_KEY)).toEqual([expect.objectContaining({ type: 'recent', conversationId: 'c2' })])
  })
})

describe('dms store: X se band DM (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); setOnline(true); setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    dmApi.markRecent.mockResolvedValue('')
    dmApi.listDirectChannels.mockResolvedValue([channel('c1', 'u2', at(10)), channel('c2', 'u3', at(5))])
  })
  afterEach(() => useDmStore().stopPolling?.())

  const reload = async () => {
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    const dms = useDmStore(); await dms.init(); return dms
  }

  it('stays closed after a page reload', async () => {
    const dms = await setup()
    dms.closeConversation('c2')
    expect(dms.sorted.map((c) => c.id)).toEqual(['c1'])
    expect(Object.keys(saved(CLOSED_KEY))).toEqual(['c2'])

    const again = await reload()
    expect(again.sorted.map((c) => c.id)).toEqual(['c1'])
  })

  it('comes back when the other user sends a new message (also after reload)', async () => {
    const dms = await setup()
    dms.closeConversation('c2')
    dmApi.listDirectChannels.mockResolvedValue([
      channel('c1', 'u2', at(10)),
      (() => {
        const c = channel('c2', 'u3', at(20))
        c.conversation.messages.push({ id: 'c2-new', from: 'u3', text: 'wapas', createdAt: at(20) }) // naya message
        return c
      })(),
    ])
    const again = await reload()
    expect(again.sorted.map((c) => c.id)).toContain('c2')
    expect(saved(CLOSED_KEY)).toEqual({})
  })

  it('opening it again (from search / Activity) removes it from the closed list', async () => {
    const dms = await setup()
    dms.closeConversation('c2')
    dms.openConversation('c2')
    expect(dms.sorted.map((c) => c.id)).toContain('c2')
    const again = await reload()
    expect(again.sorted.map((c) => c.id)).toContain('c2')
  })
})

describe('dms store: recent ! ki wajah', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); setOnline(true); setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    dmApi.listDirectChannels.mockResolvedValue([channel('c1', 'u2', at(10)), channel('c2', 'u3', at(5))])
  })
  afterEach(() => useDmStore().stopPolling?.())

  it('no company yet: waits in the queue instead of showing !', async () => {
    const dms = await setup()
    useTeamsStore().activeWorkspaceId = ''
    dms.openConversation('c2')
    expect(dmApi.markRecent).not.toHaveBeenCalled()
    expect(dms.recentStatusOf('c2')).toBe('pending')
    await dms.flushOutbox()
    expect(dms.recentStatusOf('c2')).toBe('pending') // abhi bhi intezar, ! nahi
  })

  it('keeps the reason of a failure for the tooltip and clears it after success', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    dmApi.markRecent.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), { status: 422, details: { message: 'The last opened at field is invalid.' } }),
    )
    const dms = await setup()
    dms.openConversation('c2')
    await vi.waitFor(() => expect(dms.recentStatusOf('c2')).toBe('error'))
    expect(dms.recentErrorOf('c2')).toMatch(/^422 /)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[dms] recent sync failed for c2: 422'), expect.anything())

    dmApi.markRecent.mockResolvedValue('')
    dms.openConversation('c2')
    await vi.waitFor(() => expect(dms.recentStatusOf('c2')).toBe(''))
    expect(dms.recentErrorOf('c2')).toBe('')
    warn.mockRestore()
  })
})