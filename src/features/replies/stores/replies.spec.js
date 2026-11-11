import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/features/dms/dmApi', () => ({
  dmApi: { meId: vi.fn(() => 'u1') },
}))
vi.mock('@/features/replies/repliesApi', () => ({
  repliesApi: { listReplies: vi.fn(), sendReply: vi.fn() },
}))

import { repliesApi } from '@/features/replies/repliesApi'
import { useTeamsStore } from '@/stores/teams'
import { REPLIES_STORAGE_KEY, targetFromKey, threadKey, useRepliesStore } from './Replies'

const dmThread = { channelId: 'c1', messageId: 'm1' }
const teamThread = { teamId: 't1', channelId: 'general', messageId: 'm1' }

function savedReplies(key = threadKey(dmThread)) {
  return JSON.parse(localStorage.getItem(REPLIES_STORAGE_KEY))['company-1'][key]
}

// Naya pinia = page reload jaisa
function freshStore() {
  setActivePinia(createPinia())
  useTeamsStore().activeWorkspaceId = 'company-1'
  return useRepliesStore()
}

describe('replies store', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    repliesApi.listReplies.mockResolvedValue([
      { id: 'r1', from: 'u2', text: 'First reply', createdAt: '2026-01-01T10:00:00Z' },
    ])
    repliesApi.sendReply.mockImplementation(async (_target, payload) => ({
      id: 'server-r1',
      from: 'u1',
      text: payload.body,
      createdAt: '2026-01-01T10:05:00Z',
    }))
  })

  it('builds reversible thread keys for DM and team channel threads', () => {
    expect(threadKey(dmThread)).toBe('dm:c1:m1')
    expect(threadKey(teamThread)).toBe('team:t1:general:m1')
    expect(targetFromKey(threadKey({ channelId: 'a:b', messageId: 'm/1' }))).toEqual({
      channelId: 'a:b',
      messageId: 'm/1',
    })
  })

  it('loads replies from the API with the active company and caches them in localStorage', async () => {
    const replies = freshStore()

    await expect(replies.loadReplies(dmThread)).resolves.toBe(true)

    expect(repliesApi.listReplies).toHaveBeenCalledWith({
      companyId: 'company-1',
      channelId: 'c1',
      messageId: 'm1',
    })
    expect(replies.repliesOf(dmThread).map((r) => r.text)).toEqual(['First reply'])
    expect(savedReplies()).toEqual(replies.repliesOf(dmThread))
  })

  it('uses the team channel endpoint target for channel threads', async () => {
    const replies = freshStore()
    await replies.loadReplies(teamThread)

    expect(repliesApi.listReplies).toHaveBeenCalledWith({
      companyId: 'company-1',
      teamId: 't1',
      channelId: 'general',
      messageId: 'm1',
    })
    expect(replies.countOf(teamThread)).toBe(1)
    expect(replies.countOf(dmThread, 5)).toBe(5) // DM thread abhi load nahi hua
  })

  it('does not call the API again for an already loaded thread unless forced', async () => {
    const replies = freshStore()
    await replies.loadReplies(dmThread)
    await replies.loadReplies(dmThread)
    expect(repliesApi.listReplies).toHaveBeenCalledTimes(1)

    await replies.loadReplies(dmThread, { force: true })
    expect(repliesApi.listReplies).toHaveBeenCalledTimes(2)
  })

  it('shows saved replies from localStorage when the network fails', async () => {
    await freshStore().loadReplies(dmThread)

    repliesApi.listReplies.mockRejectedValue(new Error('Failed to fetch'))
    const reloaded = freshStore()
    await expect(reloaded.loadReplies(dmThread)).resolves.toBe(false)

    expect(reloaded.repliesOf(dmThread).map((r) => r.text)).toEqual(['First reply'])
    expect(reloaded.errorOf(dmThread)).toBe('Failed to fetch')
    expect(reloaded.isOffline(dmThread)).toBe(true)
  })

  it('shows an optimistic reply, waits 30 seconds, then swaps it for the server reply', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const replies = freshStore()
      await replies.loadReplies(dmThread)

      const sent = replies.sendReply(dmThread, '  Got it  ')
      expect(sent).toMatchObject({ text: 'Got it', from: 'u1', status: 'sending', parentId: 'm1' })
      expect(sent.id).toMatch(/^local-/)
      expect(savedReplies().at(-1).id).toBe(sent.id) // network se pehle hi save
      expect(repliesApi.sendReply).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(30_000)

      expect(repliesApi.sendReply).toHaveBeenCalledWith(
        { companyId: 'company-1', channelId: 'c1', messageId: 'm1' },
        { body: 'Got it' },
      )
      await vi.waitFor(() => expect(replies.repliesOf(dmThread).at(-1).id).toBe('server-r1'))
      expect(replies.repliesOf(dmThread).map((r) => r.text)).toEqual(['First reply', 'Got it'])
      expect(savedReplies().at(-1)).toMatchObject({ id: 'server-r1', text: 'Got it' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores empty replies', () => {
    const replies = freshStore()
    expect(replies.sendReply(dmThread, '   ')).toBeNull()
    expect(repliesApi.sendReply).not.toHaveBeenCalled()
  })

  it('marks a reply failed when sending fails, keeps it saved, and retries it', async () => {
    repliesApi.sendReply.mockRejectedValueOnce(new Error('Failed to fetch'))
    const replies = freshStore()
    await replies.loadReplies(dmThread)

    const sent = replies.sendReply(dmThread, 'Offline reply')
    await vi.waitFor(() => expect(replies.repliesOf(dmThread).at(-1).status).toBe('failed'))
    expect(replies.actionError).toBe('Failed to fetch')
    expect(savedReplies().at(-1)).toMatchObject({ text: 'Offline reply', status: 'failed' })

    expect(replies.retryReply(dmThread, sent.id)).toBe(true)
    await vi.waitFor(() => expect(replies.repliesOf(dmThread).at(-1).id).toBe('server-r1'))
    expect(replies.retryReply(dmThread, 'server-r1')).toBe(false)
  })

  it('keeps pending local replies when the server list is refreshed', async () => {
    let finish
    repliesApi.sendReply.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const replies = freshStore()
    await replies.loadReplies(dmThread)

    replies.sendReply(dmThread, 'Still sending')
    await replies.loadReplies(dmThread, { force: true })
    expect(replies.repliesOf(dmThread).map((r) => r.text)).toEqual(['First reply', 'Still sending'])

    finish({ id: 'server-r2', from: 'u1', text: 'Still sending', createdAt: '' })
    await vi.waitFor(() => expect(replies.repliesOf(dmThread).at(-1).id).toBe('server-r2'))
  })

  it('turns an unfinished "sending" reply into "failed" after a page reload', async () => {
    repliesApi.sendReply.mockImplementation(() => new Promise(() => {})) // kabhi khatam nahi
    const replies = freshStore()
    await replies.loadReplies(dmThread)
    replies.sendReply(dmThread, 'Lost on reload')

    repliesApi.listReplies.mockRejectedValue(new Error('Failed to fetch'))
    const reloaded = freshStore()
    await reloaded.loadReplies(dmThread)

    expect(reloaded.repliesOf(dmThread).at(-1)).toMatchObject({
      text: 'Lost on reload',
      status: 'failed',
      error: 'Not sent',
    })
  })

  it('reloads the thread when the server does not return the created reply', async () => {
    repliesApi.sendReply.mockResolvedValue(null)
    const replies = freshStore()
    await replies.loadReplies(dmThread)
    repliesApi.listReplies.mockResolvedValue([
      { id: 'r1', from: 'u2', text: 'First reply', createdAt: '' },
      { id: 'r2', from: 'u1', text: 'No body back', createdAt: '' },
    ])

    replies.sendReply(dmThread, 'No body back')

    await vi.waitFor(() =>
      expect(replies.repliesOf(dmThread).map((r) => r.id)).toEqual(['r1', 'r2']),
    )
  })

  it('resends failed replies and refreshes threads when the network comes back', async () => {
    repliesApi.sendReply.mockRejectedValueOnce(new Error('Failed to fetch'))
    const replies = freshStore()
    await replies.loadReplies(dmThread)
    replies.sendReply(dmThread, 'Send me later')
    await vi.waitFor(() => expect(replies.repliesOf(dmThread).at(-1).status).toBe('failed'))

    repliesApi.listReplies.mockClear()
    window.dispatchEvent(new Event('online'))

    await vi.waitFor(() => expect(replies.repliesOf(dmThread).at(-1).id).toBe('server-r1'))
    expect(repliesApi.listReplies).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'c1', messageId: 'm1' }),
    )
    expect(replies.repliesOf(dmThread).map((r) => r.text)).toEqual(['First reply', 'Send me later'])
  })

  it('discards a failed local reply', async () => {
    repliesApi.sendReply.mockRejectedValueOnce(new Error('Failed to fetch'))
    const replies = freshStore()
    await replies.loadReplies(dmThread)
    const sent = replies.sendReply(dmThread, 'Throw away')
    await vi.waitFor(() => expect(replies.repliesOf(dmThread).at(-1).status).toBe('failed'))

    expect(replies.discardReply(dmThread, sent.id)).toBe(true)
    expect(replies.repliesOf(dmThread).map((r) => r.id)).toEqual(['r1'])
    expect(replies.discardReply(dmThread, 'r1')).toBe(false) // server reply nahi hatata
  })

  it('clears cached replies on logout', async () => {
    const replies = freshStore()
    await replies.loadReplies(dmThread)

    replies.clearCache()

    expect(localStorage.getItem(REPLIES_STORAGE_KEY)).toBeNull()
    expect(replies.repliesOf(dmThread)).toEqual([])
  })

  it('polls open threads and receives replies of the other user without reload', async () => {
    vi.useFakeTimers()
    try {
      const replies = freshStore()
      await replies.loadReplies(dmThread)
      replies.watchThread(dmThread)
      repliesApi.listReplies.mockResolvedValue([
        { id: 'r1', from: 'u2', text: 'First reply', createdAt: '' },
        { id: 'r2', from: 'u2', text: 'New from u2', createdAt: '' },
      ])

      repliesApi.listReplies.mockClear()
      await vi.advanceTimersByTimeAsync(29_999)
      expect(repliesApi.listReplies).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(replies.repliesOf(dmThread).map((r) => r.text)).toEqual(['First reply', 'New from u2'])
      expect(repliesApi.listReplies).toHaveBeenCalledTimes(1)

      replies.unwatchThread(dmThread) // thread band: polling band
      repliesApi.listReplies.mockClear()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(repliesApi.listReplies).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('polls silently without a loading state or error', async () => {
    const replies = freshStore()
    await replies.loadReplies(dmThread)
    replies.watchThread(dmThread)
    repliesApi.listReplies.mockRejectedValue(new Error('Failed to fetch'))

    const polling = replies.pollOnce()
    expect(replies.isLoading(dmThread)).toBe(false)
    await polling

    expect(replies.errorOf(dmThread)).toBe('')
    expect(replies.repliesOf(dmThread).map((r) => r.text)).toEqual(['First reply'])
    replies.unwatchThread(dmThread)
  })

  it('uses the larger of loaded replies and the server reply count, and the newest last reply time', async () => {
    const replies = freshStore()
    expect(replies.countOf(dmThread, 5)).toBe(5) // abhi load nahi hua: server ka count
    expect(replies.lastReplyAtOf(dmThread, '2026-01-01T09:00:00Z')).toBe('2026-01-01T09:00:00Z')

    await replies.loadReplies(dmThread) // 1 reply, 10:00
    expect(replies.countOf(dmThread, 0)).toBe(1)
    expect(replies.countOf(dmThread, 3)).toBe(3) // dusre user ke naye replies server count mein
    expect(replies.lastReplyAtOf(dmThread, '2026-01-01T09:00:00Z')).toBe('2026-01-01T10:00:00Z')
    expect(replies.lastReplyAtOf(dmThread, '2026-01-01T11:00:00Z')).toBe('2026-01-01T11:00:00Z')
  })
})