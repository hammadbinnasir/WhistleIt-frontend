import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/dms/dmApi', () => ({
  dmApi: { meId: vi.fn(() => 'u1') },
}))
vi.mock('@/features/replies/repliesApi', () => ({
  repliesApi: { listReplies: vi.fn(), sendReply: vi.fn() },
}))

import { repliesApi } from '@/features/replies/repliesApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'
import ThreadPanel from './ThreadPanel.vue'

const parent = { id: 'm1', from: 'u2', text: 'Parent message', createdAt: '2026-01-01T10:00:00Z' }

function mountPanel(props = {}) {
  return mount(ThreadPanel, { props: { channelId: 'c1', message: parent, ...props } })
}

describe('ThreadPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    const dms = useDmStore()
    dms.usersById = {
      u1: { name: 'Hira Rao' },
      u2: { name: 'Muniba Khan' },
    }
    repliesApi.listReplies.mockResolvedValue([
      { id: 'r1', from: 'u2', text: 'First reply', createdAt: '2026-01-01T10:01:00Z' },
    ])
    repliesApi.sendReply.mockImplementation(async (_t, payload) => ({
      id: 'r2',
      from: 'u1',
      text: payload.body,
      createdAt: '2026-01-01T10:02:00Z',
    }))
  })

  it('loads and shows replies of the DM message', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(repliesApi.listReplies).toHaveBeenCalledWith({
      companyId: 'company-1',
      channelId: 'c1',
      messageId: 'm1',
    })
    expect(wrapper.get('[data-test="parent"]').text()).toContain('Parent message')
    const items = wrapper.findAll('[data-test="reply"]')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('Muniba Khan')
    expect(items[0].text()).toContain('First reply')
    expect(wrapper.get('[data-test="reply-count"]').text()).toBe('1 reply')
  })

  it('uses the team channel thread when a team ID is given', async () => {
    mountPanel({ teamId: 't1', channelId: 'general' })
    await flushPromises()

    expect(repliesApi.listReplies).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 't1', channelId: 'general', messageId: 'm1' }),
    )
  })

  it('sends a reply with Enter and shows it in the thread', async () => {
    let finish
    repliesApi.sendReply.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const wrapper = mountPanel()
    await flushPromises()

    const box = wrapper.get('textarea')
    await box.setValue('My answer')
    await box.trigger('keydown', { key: 'Enter' })
    expect(wrapper.text()).toContain('Sending…')

    finish({ id: 'r2', from: 'u1', text: 'My answer', createdAt: '2026-01-01T10:02:00Z' })
    await flushPromises()
    expect(repliesApi.sendReply).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'c1', messageId: 'm1' }),
      { body: 'My answer' },
    )
    expect(box.element.value).toBe('')
    const items = wrapper.findAll('[data-test="reply"]')
    expect(items.at(-1).text()).toContain('Hira Rao')
    expect(items.at(-1).text()).toContain('My answer')
    expect(wrapper.text()).not.toContain('Sending…')
    expect(wrapper.get('[data-test="reply-count"]').text()).toBe('2 replies')
  })

  it('shows a failed reply with retry when the network is down', async () => {
    repliesApi.sendReply.mockRejectedValueOnce(new Error('Failed to fetch'))
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.get('textarea').setValue('Offline answer')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('Not sent: Failed to fetch')

    await wrapper.findAll('button').find((b) => b.text() === 'Retry').trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Not sent')
    expect(wrapper.text()).toContain('Offline answer')
  })

  it('shows saved replies with an offline note when loading fails', async () => {
    mountPanel()
    await flushPromises() // pehli baar: API se aa kar localStorage mein save

    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    repliesApi.listReplies.mockRejectedValue(new Error('Failed to fetch'))
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('First reply')
    expect(wrapper.get('[data-test="replies-error"]').text()).toContain(
      'Offline: showing saved replies.',
    )
  })

  it('does not call the replies API while the parent message is still local', async () => {
    const wrapper = mountPanel({ message: { ...parent, id: 'local-abc' } })
    await flushPromises()

    expect(repliesApi.listReplies).not.toHaveBeenCalled()
    expect(wrapper.get('textarea').element.disabled).toBe(true)
  })
})