import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// API mocks (network nahi)
vi.mock('@/features/dms/dmApi', () => ({
  dmApi: {
    meId: vi.fn(() => 'u1'),
    listDirectChannels: vi.fn(),
    getDirectChannel: vi.fn(),
    listMessages: vi.fn(),
    getMessage: vi.fn(),
    sendMessage: vi.fn(),
    updateMessage: vi.fn(),
    deleteMessage: vi.fn(),
    listCompanyMembers: vi.fn(async () => []),
    presence: vi.fn(async () => ({})),
    updateUserStatus: vi.fn(async () => null),
    getUserStatus: vi.fn(async () => null),
  },
}))
vi.mock('@/features/replies/repliesApi', () => ({
  repliesApi: { listReplies: vi.fn(), sendReply: vi.fn() },
}))
vi.mock('@/features/reactions/reactionsApi', () => ({
  reactionsApi: { toggleReaction: vi.fn() },
}))
vi.mock('@/features/composer/api/scheduledMessagesApi', () => ({
  getScheduledMessages: vi.fn(async () => []),
  createScheduledMessage: vi.fn(async () => ({})),
}))
vi.mock('vue3-emoji-picker', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      emits: ['select'],
      props: ['native', 'hideSearch'],
      setup() {
        return () => h('button')
      },
    }),
  }
})

import { dmApi } from '@/features/dms/dmApi'
import { repliesApi } from '@/features/replies/repliesApi'
import { reactionsApi } from '@/features/reactions/reactionsApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore } from '@/features/dms/stores/presence'
import { useTeamsStore } from '@/stores/teams'
import ComposerConversation from './components/ComposerConversation.vue'

const NOW = new Date(2026, 10, 5, 13, 0, 0)
const PARENT_AT = new Date(2026, 10, 2, 12, 39, 25).toISOString()
const LAST_REPLY_AT = new Date(2026, 10, 2, 13, 2, 0).toISOString()

function channel() {
  return {
    conversation: {
      id: 'c1',
      type: 'dm',
      members: ['u1', 'u2'],
      name: '',
      unreadCount: 0,
      isFavorite: false,
      messages: [
        {
          id: 'm1',
          from: 'u2',
          text: 'Office timings decide ho chuki hain.',
          createdAt: PARENT_AT,
          reactions: [{ emoji: '👍', users: ['u1'] }],
          replyCount: 3,
          lastReplyAt: LAST_REPLY_AT,
        },
      ],
    },
    users: [
      { id: 'u1', name: 'Hira Rao', avatarUrl: '' },
      { id: 'u2', name: 'Muniba Naseer', avatarUrl: '' },
    ],
  }
}

async function mountDm() {
  const dms = useDmStore()
  await dms.init()
  dms.openConversation('c1')
  dms.stopPolling()
  const wrapper = mount(ComposerConversation, {
    props: { conversationId: 'c1', conversationType: 'dm' },
    attachTo: document.body,
  })
  await flushPromises()
  return { dms, wrapper }
}

describe('ComposerConversation (DM)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, shouldAdvanceTime: true })
    localStorage.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    dmApi.listDirectChannels.mockImplementation(async () => [channel()])
    dmApi.listMessages.mockImplementation(async () => channel().conversation.messages)
    reactionsApi.toggleReaction.mockResolvedValue(null)
    repliesApi.listReplies.mockResolvedValue([
      { id: 'r1', from: 'u1', text: 'Ji theek hai', createdAt: LAST_REPLY_AT },
    ])
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('shows "3 days ago" with the full date on hover', async () => {
    const { wrapper } = await mountDm()
    const time = wrapper.get('.composer-conversation__message-heading time')

    expect(time.text()).toBe('3 days ago')
    await time.element.parentElement.dispatchEvent(new Event('mouseenter'))
    await flushPromises()
    expect(wrapper.get('[role="tooltip"]').text()).toBe('Nov 2nd at 12:39:25 PM')
    wrapper.unmount()
  })

  it('shows the author online/offline dot live', async () => {
    const { wrapper } = await mountDm()
    const presence = usePresenceStore()

    presence.presenceById = { u2: { state: 'online' } }
    await flushPromises()
    expect(wrapper.get('.composer-conversation__presence').attributes('title')).toBe('online')

    presence.presenceById = { u2: { state: 'offline' } }
    await flushPromises()
    expect(wrapper.get('.composer-conversation__presence').attributes('title')).toBe('offline')
    wrapper.unmount()
  })

  it('shows reaction pills (mine highlighted) with an add button, and toggles through the API', async () => {
    const { wrapper } = await mountDm()
    const pill = wrapper.get('.composer-conversation__reactions button[aria-pressed]')

    expect(pill.text().replace(/\s+/g, '')).toBe('👍1')
    expect(pill.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('.composer-conversation__reaction-add').exists()).toBe(true)

    await pill.trigger('click')
    expect(reactionsApi.toggleReaction).toHaveBeenCalledWith(
      { companyId: 'company-1', channelId: 'c1', messageId: 'm1' },
      '👍',
    )
    expect(wrapper.find('.composer-conversation__reactions').exists()).toBe(false) // hat gaya

    wrapper.unmount()
  })

  it('opens the emoji picker from the ☺+ button', async () => {
    const { wrapper } = await mountDm()

    await wrapper.get('.composer-conversation__reaction-add').trigger('click')

    expect(wrapper.find('.composer-conversation__reaction-picker').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows "3 replies · Last reply" and opens the Reply Thread panel', async () => {
    const { wrapper } = await mountDm()
    const summary = wrapper.get('[data-test="reply-summary"]')

    expect(summary.text()).toContain('3 replies')
    expect(summary.text()).toContain('Last reply: Nov 02, 2026 at 1:02 PM')
    expect(summary.text()).toContain('View thread')

    await summary.trigger('click')
    await flushPromises()

    const thread = wrapper.get('.composer-conversation__thread')
    expect(thread.text()).toContain('Reply Thread')
    expect(thread.text()).toContain('Office timings decide ho chuki hain.')
    expect(repliesApi.listReplies).toHaveBeenCalledWith({
      companyId: 'company-1',
      channelId: 'c1',
      messageId: 'm1',
    })
    expect(thread.findAll('[data-test="reply"]')).toHaveLength(1)

    await thread.get('[aria-label="Close thread"]').trigger('click')
    expect(wrapper.find('.composer-conversation__thread').exists()).toBe(false)
    wrapper.unmount()
  })

  it('loads a receiver-side reply summary and opens the received reply', async () => {
    const received = channel()
    delete received.conversation.messages[0].replyCount
    delete received.conversation.messages[0].lastReplyAt
    dmApi.listDirectChannels.mockResolvedValue([received])
    dmApi.listMessages.mockResolvedValue(received.conversation.messages)
    repliesApi.listReplies.mockResolvedValue([
      { id: 'r2', from: 'u2', text: 'Reply from the other participant', createdAt: LAST_REPLY_AT },
    ])

    const { wrapper } = await mountDm()
    await vi.waitFor(() =>
      expect(wrapper.get('[data-test="reply-summary"]').text()).toContain('1 reply'),
    )
    await wrapper.get('[data-test="reply-summary"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('.composer-conversation__thread').text()).toContain(
      'Reply from the other participant',
    )
    wrapper.unmount()
  })

  it('does not add a reply button to the message toolbar', async () => {
    const { wrapper } = await mountDm()

    expect(wrapper.find('[aria-label="Reply in thread"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows "(message deleted)" instead of removing my deleted message', async () => {
    const withMine = () => {
      const c = channel()
      c.conversation.messages.push({
        id: 'm2',
        from: 'u1',
        text: 'Mera message',
        createdAt: LAST_REPLY_AT,
        editedAt: LAST_REPLY_AT,
      })
      return c
    }
    dmApi.listDirectChannels.mockImplementation(async () => [withMine()])
    dmApi.listMessages.mockImplementation(async () => withMine().conversation.messages)
    dmApi.deleteMessage.mockResolvedValue(null)
    const { dms, wrapper } = await mountDm()

    dms.deleteMessage('c1', 'm2')
    await flushPromises()

    const mine = wrapper.get('[data-message-id="m2"]')
    expect(mine.text()).toContain('(message deleted)')
    expect(mine.text()).not.toContain('Mera message')
    expect(mine.text()).not.toContain('(edited)')
    expect(mine.find('.composer-conversation__actions').exists()).toBe(false)
    expect(mine.find('textarea[aria-label="Edit message"]').exists()).toBe(false)
    expect(dmApi.deleteMessage).toHaveBeenCalledWith('company-1', 'c1', 'm2', 'Mera message')
    wrapper.unmount()
  })

  it('shows a sender-deleted message as deleted for the other participant', async () => {
    const { dms, wrapper } = await mountDm()
    const message = channel().conversation.messages[0]
    dmApi.listMessages.mockResolvedValue([
      { ...message, deleted: true, editedAt: LAST_REPLY_AT },
    ])

    await dms.loadMessages('c1', { force: true })
    await flushPromises()

    const received = wrapper.get('[data-message-id="m1"]')
    expect(received.text()).toContain('(message deleted)')
    expect(received.text()).not.toContain(message.text)
    expect(received.text()).not.toContain('(edited)')
    expect(received.find('.composer-conversation__actions').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps my reaction when the same emoji is picked again from the picker', async () => {
    const { dms, wrapper } = await mountDm()

    // ☺+ se picker khola (store ko pata hai ke picker khula hai)
    await wrapper.get('.composer-conversation__reaction-add').trigger('click')
    expect(dms.toggleReaction('c1', 'm1', '👍')).toBe(true) // 👍 pehle se mera
    expect(dms.conversations[0].messages[0].reactions).toEqual([{ emoji: '👍', users: ['u1'] }])
    expect(reactionsApi.toggleReaction).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows (edited) under the message and saves an edit with Enter', async () => {
    const withMine = () => {
      const c = channel()
      c.conversation.messages.push({
        id: 'm2', from: 'u1', text: 'save', createdAt: LAST_REPLY_AT, editedAt: LAST_REPLY_AT,
      })
      return c
    }
    dmApi.listDirectChannels.mockImplementation(async () => [withMine()])
    dmApi.listMessages.mockImplementation(async () => withMine().conversation.messages)
    dmApi.updateMessage.mockResolvedValue(null)
    dmApi.getMessage.mockResolvedValue(null)
    const { wrapper } = await mountDm()
    const mine = () => wrapper.get('[data-message-id="m2"]')

    expect(mine().find('.composer-conversation__edited-below').text()).toBe('(edited)')

    // ⋯ > Edit
    await mine().find('[aria-label="More message actions"]').trigger('click')
    const editButton = mine().findAll('button').find((b) => b.text().includes('Edit'))
    await editButton.trigger('click')
    const box = mine().get('textarea[aria-label="Edit message"]')
    await box.setValue('save karo')

    await box.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(dmApi.updateMessage).toHaveBeenCalledWith('company-1', 'c1', 'm2', { body: 'save karo' })
    expect(mine().find('textarea').exists()).toBe(false)
    expect(mine().text()).toContain('save karo')
    wrapper.unmount()
  })

  it('cancels an edit with Escape and keeps a new line with Shift+Enter', async () => {
    const withMine = () => {
      const c = channel()
      c.conversation.messages.push({ id: 'm2', from: 'u1', text: 'pehle', createdAt: LAST_REPLY_AT })
      return c
    }
    dmApi.listDirectChannels.mockImplementation(async () => [withMine()])
    dmApi.listMessages.mockImplementation(async () => withMine().conversation.messages)
    const { wrapper } = await mountDm()
    const mine = () => wrapper.get('[data-message-id="m2"]')
    await mine().find('[aria-label="More message actions"]').trigger('click')
    await mine().findAll('button').find((b) => b.text().includes('Edit')).trigger('click')
    const box = mine().get('textarea[aria-label="Edit message"]')

    await box.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(mine().find('textarea').exists()).toBe(true) // save nahi hua
    await box.trigger('keydown', { key: 'Escape' })
    expect(mine().find('textarea').exists()).toBe(false)
    expect(dmApi.updateMessage).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps the older messages on screen when 30 new messages arrive', async () => {
    const at = (min) => new Date(2026, 10, 5, 10, min).toISOString()
    const base = Array.from({ length: 15 }, (_, i) => ({ id: `b${i}`, from: 'u2', text: `pehla ${i}`, createdAt: at(i) }))
    const withBase = () => {
      const c = channel()
      c.conversation.messages = [...base]
      return c
    }
    dmApi.listDirectChannels.mockImplementation(async () => [withBase()])
    dmApi.listMessages.mockImplementation(async () => [...base])
    let n = 0
    dmApi.sendMessage.mockImplementation(async (_c, _ch, payload) => {
      n += 1
      return { id: `s${n}`, from: 'u1', text: payload.body, createdAt: at(30 + n) }
    })
    const { dms, wrapper } = await mountDm()

    for (let i = 1; i <= 30; i += 1) dms.sendMessage('c1', { content: `naya ${i}` })
    await vi.waitFor(() => expect(dmApi.sendMessage).toHaveBeenCalledTimes(30))
    await flushPromises()

    const shown = wrapper.findAll('[data-message-id]').map((w) => w.attributes('data-message-id'))
    expect(shown).toContain('b0') // purana abhi bhi screen par
    expect(shown).toContain('s30')
    expect(shown).toHaveLength(45)
    wrapper.unmount()
  })

  it('loads older messages from the server with the Load older button', async () => {
    const at = (min) => new Date(2026, 10, 5, 10, min).toISOString()
    const page = (from, to, hasMore) =>
      Object.defineProperty(
        Array.from({ length: to - from }, (_, i) => ({ id: `q${from + i}`, from: 'u2', text: `q${from + i}`, createdAt: at(from + i) })),
        'pagination',
        { value: { hasMore } },
      )
    dmApi.listDirectChannels.mockImplementation(async () => {
      const c = channel()
      c.conversation.messages = []
      return [c]
    })
    dmApi.listMessages.mockImplementation(async (_c, _ch, opts = {}) =>
      opts.page === 2 ? page(0, 15, false) : page(15, 30, true),
    )
    const { wrapper } = await mountDm()
    await flushPromises()

    const button = wrapper.get('[data-test="load-older-server"]')
    await button.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-message-id="q0"]').exists()).toBe(true))

    expect(dmApi.listMessages).toHaveBeenCalledWith('company-1', 'c1', { page: 2 })
    expect(wrapper.find('[data-test="load-older-server"]').exists()).toBe(false) // aur nahi
    wrapper.unmount()
  })

  it('shows the day as a pill (Oct 14, 2026) and loads older messages when scrolled to the top', async () => {
    const page = (from, to, hasMore) =>
      Object.defineProperty(
        Array.from({ length: to - from }, (_, i) => ({
          id: `w${String(from + i).padStart(2, '0')}`,
          from: 'u2',
          text: `w${from + i}`,
          createdAt: new Date(2026, 9, 14, 9, from + i).toISOString(),
        })),
        'pagination',
        { value: { hasMore } },
      )
    dmApi.listDirectChannels.mockImplementation(async () => {
      const c = channel()
      c.conversation.messages = []
      return [c]
    })
    dmApi.listMessages.mockImplementation(async (_c, _ch, opts = {}) =>
      opts.page === 2 ? page(0, 15, false) : page(15, 30, true),
    )
    const { wrapper } = await mountDm()
    await flushPromises()

    expect(wrapper.get('.composer-conversation__dm-date').text()).toBe('Oct 14, 2026')

    const box = wrapper.get('.composer-conversation__messages')
    box.element.scrollTop = 0
    await box.trigger('scroll')
    await vi.waitFor(() => expect(wrapper.find('[data-message-id="w00"]').exists()).toBe(true))
    expect(dmApi.listMessages).toHaveBeenCalledWith('company-1', 'c1', { page: 2 })
    wrapper.unmount()
  })

  it('shows (forwarded) under a forwarded DM message', async () => {
    const withFwd = () => {
      const c = channel()
      c.conversation.messages.push({ id: 'f1', from: 'u2', text: 'hlw', createdAt: LAST_REPLY_AT, forwardedFrom: 'forwarded' })
      return c
    }
    dmApi.listDirectChannels.mockImplementation(async () => [withFwd()])
    dmApi.listMessages.mockImplementation(async () => withFwd().conversation.messages)
    const { wrapper } = await mountDm()

    const msg = wrapper.get('[data-message-id="f1"]')
    expect(msg.get('.composer-conversation__forwarded-below').text()).toBe('(forwarded)')
    expect(msg.find('.composer-conversation__dm-forward-marker').exists()).toBe(true) // upar wala CSS se chhupa
    wrapper.unmount()
  })
})