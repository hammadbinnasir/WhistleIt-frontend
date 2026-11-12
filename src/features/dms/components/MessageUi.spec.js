import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/dms/dmApi', () => ({
  dmApi: {
    meId: vi.fn(() => 'u1'),
    listDirectChannels: vi.fn(),
    listMessages: vi.fn(),
    getDirectChannel: vi.fn(),
    listCompanyMembers: vi.fn(async () => []),
    presence: vi.fn(async () => ({})),
  },
}))
vi.mock('@/features/reactions/reactionsApi', () => ({
  reactionsApi: { toggleReaction: vi.fn(async () => null) },
}))
vi.mock('@/features/replies/repliesApi', () => ({
  repliesApi: { listReplies: vi.fn(async () => []), sendReply: vi.fn() },
}))

import { reactionsApi } from '@/features/reactions/reactionsApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'
import TimeAgo from './Timeago.vue'
import MessageReactions from './Messagereactions.vue'
import DmMessageItem from './Dmmessageitem.vue'
import ReplySummary from '@/features/replies/components/ReplySummary.vue'

const NOW = new Date(2026, 10, 5, 13, 0, 0)
// jsdom emoji wale attribute selector nahi samajhta, isliye picker ka button text se
const pickerButton = (wrapper, emoji) =>
  wrapper.findAll('[data-test="emoji-picker"] button').find((b) => b.text() === emoji)

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  setActivePinia(createPinia())
  useTeamsStore().activeWorkspaceId = 'company-1'
})
afterEach(() => vi.useRealTimers())

describe('TimeAgo', () => {
  it('shows "3 days ago" and the full date on hover, and keeps itself up to date', async () => {
    vi.useFakeTimers({ now: NOW })
    const wrapper = mount(TimeAgo, { props: { value: new Date(2026, 10, 2, 12, 39, 25).toISOString() } })
    expect(wrapper.get('time').text()).toBe('3 days ago')
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)

    await wrapper.trigger('mouseenter')
    expect(wrapper.get('[role="tooltip"]').text()).toBe('Nov 2nd at 12:39:25 PM')
    await wrapper.trigger('mouseleave')
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)

    const fresh = mount(TimeAgo, { props: { value: new Date(NOW.getTime() - 5000).toISOString() } })
    expect(fresh.get('time').text()).toBe('just now')
    await vi.advanceTimersByTimeAsync(90_000)
    expect(fresh.get('time').text()).toBe('2 minutes ago') // khud update hua
    wrapper.unmount()
    fresh.unmount()
  })
})

describe('MessageReactions', () => {
  const users = { u1: { name: 'Hira Rao' }, u2: { name: 'Muniba Naseer' } }

  it('shows reaction pills, highlights mine and names who reacted', () => {
    const wrapper = mount(MessageReactions, {
      props: {
        meId: 'u1',
        usersById: users,
        reactions: [{ emoji: '👍', users: ['u2', 'u1'] }, { emoji: '🎉', users: ['u2'] }],
      },
    })
    const pills = wrapper.findAll('[data-test="reaction"]')
    expect(pills.map((p) => p.text().replace(/\s+/g, ''))).toEqual(['👍2', '🎉1'])
    expect(pills[0].attributes('aria-pressed')).toBe('true')
    expect(pills[1].attributes('aria-pressed')).toBe('false')
    expect(pills[0].attributes('title')).toBe('Muniba Naseer and You reacted with 👍')
  })

  it('toggles a reaction by clicking its pill and adds one from the picker', async () => {
    const wrapper = mount(MessageReactions, {
      props: { meId: 'u1', usersById: users, reactions: [{ emoji: '👍', users: ['u2'] }] },
      attachTo: document.body,
    })
    await wrapper.get('[data-test="reaction"]').trigger('click')
    expect(wrapper.emitted('toggle')[0]).toEqual(['👍'])

    await wrapper.get('[aria-label="Add reaction"]').trigger('click')
    await pickerButton(wrapper, '🔥').trigger('click')
    expect(wrapper.emitted('toggle')[1]).toEqual(['🔥'])
    expect(wrapper.find('[data-test="emoji-picker"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('stays hidden with no reactions but can open the picker from outside', async () => {
    const wrapper = mount(MessageReactions, { props: { meId: 'u1', reactions: [] } })
    expect(wrapper.classes()).toContain('hidden')

    wrapper.vm.openPicker()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="emoji-picker"]').exists()).toBe(true)
  })
})

describe('ReplySummary', () => {
  it('shows the reply count and last reply date, with "View thread" on hover', async () => {
    const wrapper = mount(ReplySummary, {
      props: { count: 5, lastReplyAt: new Date(2026, 10, 2, 13, 2).toISOString() },
    })
    expect(wrapper.text()).toContain('5 replies')
    expect(wrapper.text()).toContain('Last reply: Nov 02, 2026 at 1:02 PM')
    expect(wrapper.text()).toContain('View thread')

    await wrapper.trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('says "1 reply" and hides itself with no replies', () => {
    expect(mount(ReplySummary, { props: { count: 1 } }).text()).toContain('1 reply')
    expect(mount(ReplySummary, { props: { count: 0 } }).html()).not.toContain('reply')
  })
})

describe('DmMessageItem', () => {
  function setup(message) {
    const dms = useDmStore()
    dms.usersById = { u1: { name: 'Hira Rao' }, u2: { name: 'Muniba Naseer' } }
    dms.conversations = [{ id: 'c1', type: 'dm', members: ['u1', 'u2'], messages: [message] }]
    return mount(DmMessageItem, {
      props: { message: dms.conversations[0].messages[0], conversationId: 'c1' },
      attachTo: document.body,
    })
  }

  it('renders author, relative time, text, reactions and the replies line', () => {
    const wrapper = setup({
      id: 'm1', from: 'u2', text: 'Hi Team,', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      reactions: [{ emoji: '👍', users: ['u1'] }], replyCount: 5, lastReplyAt: '2026-11-02T08:02:00Z',
    })
    expect(wrapper.text()).toContain('Muniba Naseer')
    expect(wrapper.get('time').text()).toBe('3 days ago')
    expect(wrapper.get('[data-test="message-text"]').text()).toBe('Hi Team,')
    expect(wrapper.get('[data-test="reaction"]').text()).toContain('1')
    expect(wrapper.get('[data-test="reply-summary"]').text()).toContain('5 replies')
    wrapper.unmount()
  })

  it('renders received code-mode messages in a dark, multiline code block', () => {
    const code = 'const answer = 42\n  return answer'
    const wrapper = setup({ id: 'code-message', from: 'u2', text: code, isCode: true, createdAt: '' })

    const codeBlock = wrapper.get('[data-test="message-text"]')
    expect(codeBlock.element.tagName).toBe('PRE')
    expect(codeBlock.classes()).toContain('bg-slate-950')
    expect(codeBlock.text()).toBe(code)
    wrapper.unmount()
  })

  it('renders deleted messages as deleted and never labels them edited', () => {
    const wrapper = setup({
      id: 'm-deleted',
      from: 'u2',
      text: 'Old message text',
      deleted: true,
      editedAt: '2026-11-11T09:05:00Z',
      createdAt: '',
    })

    expect(wrapper.get('[data-test="message-deleted"]').text()).toBe('(message deleted)')
    expect(wrapper.text()).not.toContain('(edited)')
    expect(wrapper.text()).not.toContain('Old message text')
    expect(wrapper.find('[aria-label="More actions"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens the thread from the replies line and the toolbar', async () => {
    const wrapper = setup({ id: 'm1', from: 'u2', text: 'Hi', createdAt: '', replyCount: 2 })
    await wrapper.get('[data-test="reply-summary"]').trigger('click')
    await wrapper.get('[aria-label="Reply in thread"]').trigger('click')
    expect(wrapper.emitted('open-thread')).toHaveLength(2)
    wrapper.unmount()
  })

  it('adds the first reaction from the toolbar picker through the reactions API', async () => {
    const wrapper = setup({ id: 'm1', from: 'u2', text: 'Hi', createdAt: '' })
    await wrapper.get('.group > .absolute [aria-label="Add reaction"]').trigger('click')
    await flushPromises()
    await pickerButton(wrapper, '🎉').trigger('click')

    expect(wrapper.get('[data-test="reaction"]').text()).toContain('🎉')
    expect(reactionsApi.toggleReaction).toHaveBeenCalledWith(
      { companyId: 'company-1', channelId: 'c1', messageId: 'm1' },
      '🎉',
    )
    wrapper.unmount()
  })

  it('lets me edit and delete only my own message', async () => {
    const other = setup({ id: 'm1', from: 'u2', text: 'Theirs', createdAt: '' })
    expect(other.find('[aria-label="More actions"]').exists()).toBe(false)
    other.unmount()

    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    const wrapper = setup({ id: 'm2', from: 'u1', text: 'Mine', createdAt: '' })
    await wrapper.get('[aria-label="More actions"]').trigger('click')
    expect(wrapper.text()).toContain('Edit message')
    expect(wrapper.text()).toContain('Delete message')
    wrapper.unmount()
  })
})