import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChannelsStore } from '@/features/channels'
import { dmApi } from '@/features/dms/dmApi'
import { repliesApi } from '@/features/replies/repliesApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { useMessagesStore } from '@/features/messages/messages'
import { useRemindersStore } from '@/features/search/reminders'
import { useUiStore } from '@/stores/ui'
import { resetUserStore, useUserStore } from '@/features/account/composables/useUserStore'
import { setupDmsTestState } from '@/features/dms/test-utils'
import { normalizeMessage } from '@/features/dms/dmApi'
import {
  getChannelMessages,
  forwardChannelMessage,
  sendChannelMessage,
  updateChannelMessage,
  deleteChannelMessage,
} from '@/features/messages/channelMessageService'

const emojiPickerProps = vi.hoisted(() => vi.fn())
const sendChannelVoiceMessageMock = vi.hoisted(() => vi.fn())
const listMembersMock = vi.hoisted(() => vi.fn())
const reminderApi = vi.hoisted(() => ({
  createReminder: vi.fn(),
  deleteReminder: vi.fn(),
  listReminders: vi.fn(),
}))
vi.mock('@/features/search/remindersApi', () => reminderApi)
const pollsApi = vi.hoisted(() => ({
  closePoll: vi.fn(),
  createPoll: vi.fn(),
  getPollQuestions: vi.fn(),
  getPollResult: vi.fn(),
  submitPollAnswer: vi.fn(),
}))
vi.mock('../api/polls.api', () => pollsApi)
const scheduledMessagesApi = vi.hoisted(() => ({
  createScheduledMessage: vi.fn(async (message) => ({
    id: 'scheduled-server-message',
    body: message.body,
    scheduled_at: message.scheduled_at,
  })),
  getScheduledMessages: vi.fn().mockResolvedValue([]),
}))
vi.mock('../api/scheduledMessagesApi', () => scheduledMessagesApi)
const pinApi = vi.hoisted(() => ({
  pinMessage: vi.fn().mockResolvedValue({}),
  unpinMessage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/messages/channelMessageService', () => ({
  getChannelMessages: vi.fn(),
  forwardChannelMessage: vi.fn(),
  sendChannelMessage: vi.fn(),
  updateChannelMessage: vi.fn(),
  deleteChannelMessage: vi.fn(),
}))

vi.mock('@/features/replies/repliesApi', () => ({
  repliesApi: {
    listReplies: vi.fn(),
    sendReply: vi.fn(),
  },
}))

vi.mock('vue3-emoji-picker', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      emits: ['select'],
      props: ['native', 'hideSearch'],
      setup(props, { emit }) {
        emojiPickerProps(props)
        return () =>
          h('button', {
            class: 'test-emoji-picker-option',
            onClick: () => emit('select', { i: '🥳' }),
          })
      },
    }),
  }
})

vi.mock('@/features/channels/api/channels.api', async (importOriginal) => ({
  ...(await importOriginal()),
  listMembers: listMembersMock,
  pinMessage: pinApi.pinMessage,
  sendChannelVoiceMessage: sendChannelVoiceMessageMock,
  unpinMessage: pinApi.unpinMessage,
}))

vi.mock('@/features/media/voiceNotesApi', async (importOriginal) => ({
  ...(await importOriginal()),
  getVoiceNote: vi.fn().mockResolvedValue({ id: 'voice-note-1' }),
  getVoiceNoteFile: vi.fn().mockResolvedValue(new Blob(['audio'], { type: 'audio/webm' })),
}))

import ComposerConversation from './ComposerConversation.vue'
import MessageComposer from './MessageComposer.vue'
import { sendChannelVoiceMessage } from '@/features/channels/api/channels.api'

describe('composer conversation', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    setupDmsTestState()
    resetUserStore()
    reminderApi.createReminder.mockReset().mockImplementation(async (reminder) => ({
      ...reminder,
      id: 'server-reminder',
      fired: false,
    }))
    reminderApi.deleteReminder.mockReset().mockResolvedValue()
    reminderApi.listReminders.mockReset().mockResolvedValue([])
    Object.values(pollsApi).forEach((mock) => mock.mockReset())
    pollsApi.closePoll.mockResolvedValue({ closed: true })
    pollsApi.createPoll.mockResolvedValue({ poll: { id: 'server-poll-default' } })
    pollsApi.getPollQuestions.mockResolvedValue([])
    pollsApi.getPollResult.mockResolvedValue({})
    pollsApi.submitPollAnswer.mockResolvedValue({ accepted: true })
    scheduledMessagesApi.createScheduledMessage.mockReset().mockImplementation(async (message) => ({
      id: 'scheduled-server-message',
      body: message.body,
      scheduled_at: message.scheduled_at,
    }))
    scheduledMessagesApi.getScheduledMessages.mockReset().mockResolvedValue([])
    pinApi.pinMessage.mockReset().mockResolvedValue({})
    pinApi.unpinMessage.mockReset().mockResolvedValue(undefined)
    listMembersMock.mockReset().mockResolvedValue({ items: [], total: 0 })
    getChannelMessages.mockReset()
    getChannelMessages.mockResolvedValue({
      success: true,
      data: { success: true, data: { messages: [] } },
    })
    forwardChannelMessage.mockReset()
    forwardChannelMessage.mockResolvedValue({ success: true, data: {} })
    repliesApi.listReplies.mockReset()
    repliesApi.listReplies.mockResolvedValue([])
    repliesApi.sendReply.mockReset()
    repliesApi.sendReply.mockResolvedValue({
      id: 'server-reply-1',
      from: 'u1',
      text: 'Reply from thread',
      createdAt: '2026-11-05T10:01:00Z',
    })
    sendChannelMessage.mockReset()
    updateChannelMessage.mockReset()
    updateChannelMessage.mockResolvedValue({ success: true, data: {} })
    deleteChannelMessage.mockReset()
    deleteChannelMessage.mockResolvedValue({ success: true, data: null })
    sendChannelVoiceMessage.mockReset()
    sendChannelVoiceMessage.mockResolvedValue({ id: 'server-voice-message' })
    let serverMessageId = 0
    sendChannelMessage.mockImplementation(async (_company, _team, _channel, { content }) => ({
      success: true,
      data: {
        success: true,
        data: {
          message: {
            id: `server-message-${++serverMessageId}`,
            content,
            sender_id: 'u1',
            created_at: '2026-11-05T10:00:00Z',
          },
        },
      },
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function sendMessage(wrapper, content) {
    const editor = wrapper.get('[contenteditable="true"]')
    editor.element.textContent = content
    editor.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await wrapper.findComponent(MessageComposer).get('form').trigger('submit')
    await nextTick()
  }

  function buttonWithText(wrapper, content) {
    return wrapper.findAll('button').find((button) => button.text().includes(content))
  }

  it('loads channel messages when a channel conversation opens', async () => {
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: '6aeb0aa8fbf9fd02ad07048f' },
    })

    await vi.waitFor(() => {
      expect(getChannelMessages).toHaveBeenCalledWith(
        'company-1',
        'team-1',
        '6aeb0aa8fbf9fd02ad07048f',
        { page: 1, perPage: 15 },
      )
    })
    wrapper.unmount()
  })

  it('shows the restriction notice to members and only the creator can post in creator-only mode', async () => {
    localStorage.setItem('authToken', 'test-token')
    localStorage.setItem('authUserId', 'member-1')
    localStorage.setItem('authUser', JSON.stringify({ id: 'member-1' }))
    const channels = useChannelsStore()
    channels.upsertChannel({
      id: 'restricted-channel',
      name: 'Restricted',
      isMember: true,
      createdById: 'creator-1',
      canManage: false,
      isOwner: false,
      messagePermission: 'creator_only',
      allowedSenderIds: [],
    })

    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'restricted-channel', conversationType: 'channel' },
    })

    expect(wrapper.findComponent(MessageComposer).exists()).toBe(false)
    expect(wrapper.text()).toContain('Only certain people can post in this channel.')

    channels.upsertChannel({
      ...channels.getById('restricted-channel'),
      canManage: true,
    })
    await nextTick()
    expect(wrapper.findComponent(MessageComposer).exists()).toBe(false)
    expect(wrapper.text()).toContain('Only certain people can post in this channel.')

    channels.upsertChannel({
      ...channels.getById('restricted-channel'),
      createdById: 'member-1',
      isMember: true,
    })
    await nextTick()
    expect(wrapper.findComponent(MessageComposer).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Only certain people can post in this channel.')
    wrapper.unmount()
  })

  it('shows the composer only to selected members, with a restriction notice to others', async () => {
    localStorage.setItem('authToken', 'test-token')
    localStorage.setItem('authUserId', 'member-1')
    localStorage.setItem('authUser', JSON.stringify({ id: 'member-1' }))
    const channels = useChannelsStore()
    channels.upsertChannel({
      id: 'selected-channel',
      name: 'Selected',
      isMember: true,
      createdById: 'creator-1',
      canManage: true,
      isOwner: false,
      messagePermission: 'specific',
      allowedSenderIds: ['member-2'],
    })

    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'selected-channel', conversationType: 'channel' },
    })
    expect(wrapper.findComponent(MessageComposer).exists()).toBe(false)
    expect(wrapper.text()).toContain('Only certain people can post in this channel.')

    channels.upsertChannel({
      ...channels.getById('selected-channel'),
      allowedSenderIds: ['member-1', 'member-2'],
    })
    await nextTick()
    expect(wrapper.findComponent(MessageComposer).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Only certain people can post in this channel.')

    channels.upsertChannel({
      ...channels.getById('selected-channel'),
      allowedSenderIds: ['member-2'],
    })
    await nextTick()
    expect(wrapper.findComponent(MessageComposer).exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the composer to an explicitly allowed sender when membership data is stale', () => {
    localStorage.setItem('authToken', 'test-token')
    localStorage.setItem('authUserId', 'member-1')
    localStorage.setItem('authUser', JSON.stringify({ id: 'member-1' }))
    const channels = useChannelsStore()
    channels.channels.push({
      id: 'selected-channel',
      name: 'Selected',
      isMember: false,
      messagePermission: 'selected_members',
      allowedSenderIds: [{ user_id: 'member-1' }],
    })

    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'selected-channel', conversationType: 'channel' },
    })

    expect(wrapper.findComponent(MessageComposer).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Only certain people can post in this channel.')
    wrapper.unmount()
  })

  it('shows the restriction notice to users who are not channel members', () => {
    localStorage.setItem('authUserId', 'outsider')
    localStorage.setItem('authUser', JSON.stringify({ id: 'outsider' }))
    const channels = useChannelsStore()
    channels.channels.push({
      id: 'private-channel',
      name: 'Private',
      isMember: false,
      messagePermission: 'everyone',
      allowedSenderIds: [],
    })

    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'private-channel', conversationType: 'channel' },
    })

    expect(wrapper.findComponent(MessageComposer).exists()).toBe(false)
    expect(wrapper.text()).toContain('Only certain people can post in this channel.')
    wrapper.unmount()
  })

  it('does not let channel admins bypass creator-only or selected-member permissions', async () => {
    localStorage.setItem('authToken', 'test-token')
    localStorage.setItem('authUserId', 'admin-1')
    localStorage.setItem('authUser', JSON.stringify({ id: 'admin-1' }))
    const channels = useChannelsStore()
    channels.upsertChannel({
      id: 'admin-channel',
      name: 'Admin channel',
      isMember: true,
      createdById: 'creator-1',
      canManage: true,
      isOwner: false,
      messagePermission: 'creator_only',
      allowedSenderIds: [],
    })

    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'admin-channel', conversationType: 'channel' },
    })

    for (const messagePermission of ['creator_only', 'selected_members', 'everyone']) {
      channels.upsertChannel({
        ...channels.getById('admin-channel'),
        messagePermission,
        allowedSenderIds: [],
      })
      await nextTick()
      expect(wrapper.findComponent(MessageComposer).exists()).toBe(messagePermission === 'everyone')
    }
    wrapper.unmount()
  })

  it('keeps admins-only mode separate from creator-only permissions', async () => {
    localStorage.setItem('authToken', 'test-token')
    localStorage.setItem('authUserId', 'admin-1')
    localStorage.setItem('authUser', JSON.stringify({ id: 'admin-1' }))
    const channels = useChannelsStore()
    channels.upsertChannel({
      id: 'admin-channel',
      name: 'Admin channel',
      isMember: true,
      createdById: 'creator-1',
      canManage: false,
      isOwner: false,
      isAdmin: false,
      adminIds: ['admin-1'],
      messagePermission: 'creator_only',
      allowedSenderIds: [],
    })

    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'admin-channel', conversationType: 'channel' },
    })

    expect(wrapper.findComponent(MessageComposer).exists()).toBe(false)
    expect(wrapper.text()).toContain('Only certain people can post in this channel.')

    channels.upsertChannel({
      ...channels.getById('admin-channel'),
      isAdmin: true,
      messagePermission: 'admins',
      adminIds: [],
    })
    await nextTick()
    expect(wrapper.findComponent(MessageComposer).exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the full message time on hover without requiring a click', async () => {
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Hover over the timestamp')
    const time = wrapper.get('.composer-conversation__message-heading time')

    expect(time.attributes('data-time-tooltip')).toBeTruthy()
    expect(time.attributes('aria-label')).toBe(time.attributes('data-time-tooltip'))
    expect(time.attributes('title')).toBeUndefined()
    expect(time.attributes('tabindex')).toBe('0')
    wrapper.unmount()
  })

  it('posts channel message text and attachments through the message API', async () => {
    const attachment = new File(['report'], 'report.txt', { type: 'text/plain' })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'channel-1', conversationType: 'channel' },
    })

    wrapper.findComponent(MessageComposer).vm.$emit('send', {
      content: 'Please review this file',
      attachment,
    })

    await vi.waitFor(() => {
      expect(sendChannelMessage).toHaveBeenCalledWith(
        'company-1',
        'team-1',
        'channel-1',
        expect.objectContaining({ content: 'Please review this file', attachment }),
      )
    })
  })

  it('posts a file-only channel message through the message API', async () => {
    const attachment = new File(['report'], 'report.txt', { type: 'text/plain' })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'channel-1', conversationType: 'channel' },
    })

    wrapper.findComponent(MessageComposer).vm.$emit('send', {
      content: '',
      attachment,
    })

    await vi.waitFor(() => {
      expect(sendChannelMessage).toHaveBeenCalledWith(
        'company-1',
        'team-1',
        'channel-1',
        expect.objectContaining({ content: '', attachment }),
      )
    })
  })

  it('immediately previews a returned image attachment below the message text', async () => {
    const attachment = {
      id: 'file-image',
      name: 'men.jpg',
      mime_type: 'image/jpeg',
      path: 'messages/channel-1/men.jpg',
    }
    sendChannelMessage.mockResolvedValue({
      success: true,
      data: {
        message: {
          id: 'message-image',
          body: 'Photo',
          attachment: [attachment],
          sender: { id: 'u1', name: 'Umais' },
          created_at: '2026-11-10T10:00:00.000Z',
        },
      },
    })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'channel-1', conversationType: 'channel' },
    })

    wrapper.findComponent(MessageComposer).vm.$emit('send', {
      content: 'Photo',
      attachment: new File(['image'], 'men.jpg', { type: 'image/jpeg' }),
    })

    await vi.waitFor(() => expect(wrapper.find('img[alt="men.jpg"]').exists()).toBe(true))
    const image = wrapper.get('img[alt="men.jpg"]')
    expect(image.attributes('src')).toMatch(/^blob:/)
    expect(image.element.parentElement.getAttribute('href')).toMatch(/^blob:/)
    expect(wrapper.text()).toContain('Photo')
    wrapper.unmount()
  })

  it.each([
    [
      { id: 'pdf', name: 'guide.pdf', mime_type: 'application/pdf', path: 'messages/guide.pdf' },
      'PDF',
    ],
    [
      {
        id: 'docx',
        name: 'notes.docx',
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        path: 'messages/notes.docx',
      },
      'DOC',
    ],
  ])('shows a document card for returned %s attachments', async (file, icon) => {
    sendChannelMessage.mockResolvedValue({
      success: true,
      data: {
        message: {
          id: `message-${file.id}`,
          body: 'Document',
          attachment: [file],
          sender: { id: 'u1', name: 'Umais' },
          created_at: '2026-11-10T10:00:00.000Z',
        },
      },
    })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'channel-1', conversationType: 'channel' },
    })

    wrapper.findComponent(MessageComposer).vm.$emit('send', {
      content: 'Document',
      attachment: new File(['document'], file.name, { type: file.mime_type }),
    })

    await vi.waitFor(() => expect(wrapper.text()).toContain(file.name))
    expect(wrapper.text()).toContain(icon)
    expect(wrapper.get('a[download]').attributes('href')).toMatch(/^blob:/)
    wrapper.unmount()
  })

  it('loads and displays older channel messages from the next API page', async () => {
    const makeMessages = (prefix) =>
      Array.from({ length: 15 }, (_, index) => ({
        id: `${prefix}-${index}`,
        body: `${prefix} message ${index}`,
        sender_id: 'u2',
        created_at: new Date(Date.UTC(2026, 10, 5, 10, index)).toISOString(),
      }))
    const pagination = (currentPage) => ({
      current_page: currentPage,
      per_page: 15,
      total: 30,
      last_page: 2,
      has_more_pages: currentPage === 1,
    })
    getChannelMessages
      .mockResolvedValueOnce({
        success: true,
        data: { messages: makeMessages('latest'), pagination: pagination(1) },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          messages: [
            {
              id: 'older-message',
              body: 'Older channel history',
              sender_id: 'u2',
              created_at: '2026-11-04T10:00:00Z',
            },
          ],
          pagination: pagination(2),
        },
      })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'channel-1' },
    })

    await vi.waitFor(() => {
      expect(buttonWithText(wrapper, 'Load older messages')).toBeTruthy()
    })
    await buttonWithText(wrapper, 'Load older messages').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Older channel history')
    })
    expect(getChannelMessages).toHaveBeenNthCalledWith(2, 'company-1', 'team-1', 'channel-1', {
      page: 2,
      perPage: 15,
    })
    wrapper.unmount()
  })

  it('sends a plain channel message through the shared messages API', async () => {
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: '6aeb0aa8fbf9fd02ad07048f' },
    })
    await sendMessage(wrapper, 'Hello everyone')

    expect(sendChannelMessage).toHaveBeenCalledWith(
      'company-1',
      'team-1',
      '6aeb0aa8fbf9fd02ad07048f',
      { content: 'Hello everyone', is_important: false },
    )
    expect(wrapper.text()).toContain('Hello everyone')
    wrapper.unmount()
  })

  it('sends and renders underline formatting for channel messages', async () => {
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: '6aeb0aa8fbf9fd02ad07048f' },
    })
    const editor = wrapper.get('[contenteditable="true"]')
    editor.element.innerHTML = '<u>Underlined update</u>'
    editor.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await wrapper.findComponent(MessageComposer).get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('.composer-conversation__message-content u').text()).toBe(
        'Underlined update',
      )
    })
    expect(sendChannelMessage).toHaveBeenCalledWith(
      'company-1',
      'team-1',
      '6aeb0aa8fbf9fd02ad07048f',
      expect.objectContaining({
        content: '++Underlined update++',
        is_important: false,
      }),
    )
    wrapper.unmount()
  })

  it('shows a sent message in the conversation', async () => {
    const wrapper = mount(ComposerConversation)

    const composer = wrapper.findComponent(MessageComposer)
    const editor = wrapper.get('[contenteditable="true"]')
    editor.element.textContent = 'Hello team'
    editor.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(composer.get('button[aria-label="Send message"]').attributes('disabled')).toBeUndefined()

    await composer.get('form').trigger('submit')
    await nextTick()

    expect(wrapper.text()).toContain('You')

    expect(wrapper.text()).toContain('Hello team')

    expect(wrapper.get('time').attributes('datetime')).toBeTruthy()

    expect(wrapper.get('[aria-label="Sent"]').text()).toBe('✓✓')
  })

  it('renders existing messages without literal paragraph tags', async () => {
    useMessagesStore().messagesByChannel.general = [
      {
        id: 'legacy-html-message',
        content: '<p>Aslam u Alikum</p>',
        author: 'Another user',
        mine: false,
        createdAt: new Date().toISOString(),
      },
    ]
    const wrapper = mount(ComposerConversation)

    expect(wrapper.text()).toContain('Aslam u Alikum')
    expect(wrapper.text()).not.toContain('<p>')
    wrapper.unmount()
  })

  it.each(['channel', 'dm'])(
    'preserves underline formatting when rendering a %s message',
    async (type) => {
      const message = {
        id: `underline-${type}-message`,
        content: '<u>Important text</u>',
        author: 'Another user',
        from: 'user-2',
        mine: false,
        createdAt: new Date().toISOString(),
      }
      let wrapper
      if (type === 'dm') {
        useDmStore().conversations = [
          {
            id: 'underline-dm',
            type: 'dm',
            members: [useDmStore().meId, 'user-2'],
            messages: [message],
          },
        ]
        wrapper = mount(ComposerConversation, {
          props: { conversationId: 'underline-dm', conversationType: 'dm' },
        })
      } else {
        useMessagesStore().messagesByChannel.general = [message]
        wrapper = mount(ComposerConversation)
      }

      expect(wrapper.get('.composer-conversation__message-bubble u').text()).toBe('Important text')
      expect(wrapper.text()).not.toContain('<u>')
      wrapper.unmount()
    },
  )

  it('sends the important flag to the channel API and renders the backend flag', async () => {
    const wrapper = mount(ComposerConversation)
    const composer = wrapper.findComponent(MessageComposer)
    await composer.get('button[aria-label="Important message"]').trigger('click')
    await sendMessage(wrapper, 'Urgent channel update')

    expect(sendChannelMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'general',
      expect.objectContaining({ important: true, is_important: true }),
    )
    await vi.waitFor(() => expect(wrapper.text()).toContain('IMPORTANT!'))
    expect(wrapper.text()).toContain('IMPORTANT!')

    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'backend-important-message',
        content: 'Important from backend',
        author: 'Another user',
        mine: false,
        createdAt: new Date().toISOString(),
        is_important: true,
      },
    ]
    await nextTick()
    expect(wrapper.text()).toContain('IMPORTANT!')
    expect(wrapper.text()).toContain('Important from backend')
    wrapper.unmount()
  })

  it('sends important DMs with is_important and renders the delivered flag', async () => {
    const dms = useDmStore()
    dms.conversations.push({ id: 'important-dm', members: [dms.meId, 'user-2'], messages: [] })
    const sendDmMessage = vi
      .spyOn(dmApi, 'sendMessage')
      .mockImplementation(async (_companyId, channelId, payload) => ({
        id: 'important-dm-server-message',
        from: dms.meId,
        text: payload.body,
        createdAt: new Date().toISOString(),
        is_important: payload.is_important,
        channelId,
      }))
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'important-dm', conversationType: 'dm' },
    })

    await wrapper
      .findComponent(MessageComposer)
      .get('button[aria-label="Important message"]')
      .trigger('click')
    await sendMessage(wrapper, 'Urgent direct message')
    await vi.waitFor(() =>
      expect(dms.conversations[0].messages.at(-1).id).toBe('important-dm-server-message'),
    )

    expect(sendDmMessage).toHaveBeenCalledWith(
      'company-1',
      'important-dm',
      expect.objectContaining({
        body: 'Urgent direct message',
        isCode: false,
        senderId: dms.meId,
        receiverId: 'user-2',
        timestamp: expect.any(String),
        is_important: true,
      }),
    )
    expect(wrapper.text()).toContain('IMPORTANT!')
    wrapper.unmount()
    sendDmMessage.mockRestore()
  })

  it('sends code-mode metadata to the DM API and renders the delivered message as code', async () => {
    const dms = useDmStore()
    dms.conversations.push({ id: 'code-dm', members: [dms.meId, 'user-2'], messages: [] })
    const sendDmMessage = vi
      .spyOn(dmApi, 'sendMessage')
      .mockImplementation(async (_companyId, channelId, payload) => ({
        id: 'code-dm-server-message',
        from: payload.senderId,
        text: payload.text,
        is_code: null,
        createdAt: payload.timestamp,
        channelId,
      }))
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'code-dm', conversationType: 'dm' },
    })
    const composer = wrapper.findComponent(MessageComposer)
    const editor = composer.get('[contenteditable="true"]')
    editor.element.textContent = 'const answer = 42'
    editor.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    const range = document.createRange()
    range.selectNodeContents(editor.element)
    const selection = document.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    await composer.get('button[aria-label="Code block"]').trigger('mousedown')
    await composer.get('button[aria-label="Code block"]').trigger('click')
    expect(composer.text()).toContain('Code mode on')
    await composer.get('form').trigger('submit')

    await vi.waitFor(() =>
      expect(dms.conversations.find((item) => item.id === 'code-dm').messages.at(-1).id).toBe(
        'code-dm-server-message',
      ),
    )
    expect(sendDmMessage).toHaveBeenCalledWith(
      'company-1',
      'code-dm',
      expect.objectContaining({
        body: 'const answer = 42',
        text: 'const answer = 42',
        is_code: true,
        senderId: dms.meId,
        receiverId: 'user-2',
        timestamp: expect.any(String),
      }),
    )
    expect(wrapper.get('.composer-conversation__message-bubble pre code').text()).toBe(
      'const answer = 42',
    )
    wrapper.unmount()
    sendDmMessage.mockRestore()
  })

  it('sends channel voice-note IDs and renders playback for received voice notes', async () => {
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'voice-channel', conversationType: 'channel' },
    })
    expect(wrapper.findComponent(MessageComposer).props('channelId')).toBe('voice-channel')
    wrapper.findComponent(MessageComposer).vm.$emit('send', {
      content: 'Listen to this',
      voiceNoteId: 'voice-note-1',
    })

    await vi.waitFor(() => expect(sendChannelVoiceMessage).toHaveBeenCalledOnce())
    expect(sendChannelMessage).not.toHaveBeenCalled()
    expect(sendChannelVoiceMessage).toHaveBeenCalledWith(
      'voice-channel',
      'voice-note-1',
      'Listen to this',
    )
    await vi.waitFor(() => expect(wrapper.find('.voice-note-player__audio').exists()).toBe(true))
    expect(useMessagesStore().messagesFor('voice-channel').at(-1)).toMatchObject({
      content: 'Listen to this',
      voiceNoteId: 'voice-note-1',
    })
    wrapper.unmount()
  })

  it('loads and plays voice notes received from the channel messages API', async () => {
    getChannelMessages.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [
          {
            id: 'incoming-channel-voice',
            sender_id: 'member-2',
            sender: { name: 'Avery' },
            body: '<p>Voice message</p>',
            voice_note_id: 'voice-note-incoming',
            created_at: new Date().toISOString(),
          },
        ],
      },
    })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'received-channel', conversationType: 'channel' },
    })

    await vi.waitFor(() => expect(wrapper.find('.voice-note-player__audio').exists()).toBe(true))
    expect(wrapper.find('.composer-conversation__message-bubble p').exists()).toBe(false)
    expect(getChannelMessages).toHaveBeenCalledWith('company-1', 'team-1', 'received-channel', {
      page: 1,
      perPage: 15,
    })
    wrapper.unmount()
  })

  it('renders a player for a received voice ID nested in backend metadata', async () => {
    getChannelMessages.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [
          {
            id: 'incoming-nested-voice',
            sender_id: 'member-2',
            body: '<p>Voice message</p>',
            sender: { voice_note: { id: 'voice-note-nested' } },
            created_at: new Date().toISOString(),
          },
        ],
      },
    })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'nested-voice-channel', conversationType: 'channel' },
    })

    await vi.waitFor(() => expect(wrapper.find('.voice-note-player__audio').exists()).toBe(true))
    expect(useMessagesStore().messagesFor('nested-voice-channel')[0]).toMatchObject({
      id: 'incoming-nested-voice',
      voiceNoteId: 'voice-note-nested',
    })
    wrapper.unmount()
  })

  it('opens the message action menu on left click when configured', async () => {
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Click for actions')

    await wrapper.get('.composer-conversation__message-bubble').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 275))

    expect(wrapper.find('.composer-conversation__menu').exists()).toBe(true)
  })

  it('sets a one-hour reminder on a channel message double click when configured', async () => {
    useUserStore().hydrate({ preferences: { doubleClick: 'reminder' } })
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Remind me about this')
    const beforeDoubleClick = Date.now()

    await wrapper.get('.composer-conversation__message-bubble').trigger('dblclick')

    const reminders = useRemindersStore()
    await vi.waitFor(() => expect(reminders.items).toHaveLength(1))
    expect(reminders.items[0]).toMatchObject({
      conversationId: 'general',
      conversationType: 'channel',
      text: 'Remind me about this',
    })
    expect(
      Math.abs(
        new Date(reminders.items[0].remindAt).getTime() - beforeDoubleClick - 60 * 60 * 1000,
      ),
    ).toBeLessThan(1000)
    expect(wrapper.find('[aria-label="Reminder title"]').exists()).toBe(false)
    expect(wrapper.find('.composer-conversation__message-reminder').text()).toMatch(
      /^Remind you at /,
    )
    expect(useUiStore().toasts[0].title).toBe('Reminder set')
  })

  it('sets a one-hour reminder on a direct message double click when configured', async () => {
    useUserStore().hydrate({ preferences: { doubleClick: 'reminder' } })
    const dms = useDmStore()
    await dms.init()
    dms.stopPolling()
    const conversation = dms.conversations[0]
    const message = conversation.messages[0]
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: conversation.id, conversationType: 'dm' },
    })
    const beforeDoubleClick = Date.now()

    await wrapper.find('.composer-conversation__message-bubble').trigger('dblclick')

    const reminders = useRemindersStore()
    await vi.waitFor(() => expect(reminders.items).toHaveLength(1))
    expect(reminders.items[0]).toMatchObject({
      conversationId: conversation.id,
      conversationType: 'dm',
      messageId: message.id,
      text: message.text,
    })
    expect(
      Math.abs(
        new Date(reminders.items[0].remindAt).getTime() - beforeDoubleClick - 60 * 60 * 1000,
      ),
    ).toBeLessThan(1000)
    expect(wrapper.find('[aria-label="Reminder title"]').exists()).toBe(false)
    expect(useUiStore().toasts[0].title).toBe('Reminder set')
    wrapper.unmount()
  })

  it('shows a fired DM reminder in the matching direct-message chat', async () => {
    const dms = useDmStore()
    await dms.init()
    dms.stopPolling()
    const conversation = dms.conversations[0]
    const firedAt = new Date(Date.now() - 60_000).toISOString()
    useRemindersStore().deletedItems.push({
      id: 'fired-dm-reminder',
      fired: true,
      firedAt,
      dismissed: false,
      conversationId: conversation.id,
      conversationName: dms.titleOf(conversation),
      conversationType: 'dm',
      messageId: 'dm-message-1',
      text: 'Follow up in this DM',
      remindAt: firedAt,
    })

    const wrapper = mount(ComposerConversation, {
      props: { conversationId: conversation.id, conversationType: 'dm' },
    })

    expect(wrapper.text()).toContain('Reminded you at')
    expect(wrapper.text()).toContain('Follow up in this DM')
    wrapper.unmount()
  })

  it('shows due reminders in chat and snoozes them back to the reminder list', async () => {
    const reminderStore = useRemindersStore()
    const reminderTime = new Date(Date.now() - 60_000).toISOString()
    reminderStore.deletedItems.push({
      id: 'due-reminder-1',
      fired: true,
      dismissed: false,
      conversationId: 'general',
      conversationName: 'General',
      conversationType: 'channel',
      messageId: 'message-1',
      text: 'Check https://example.com',
      remindAt: reminderTime,
      firedAt: reminderTime,
    })
    reminderStore.deletedItems.push({
      id: 'due-reminder-other-conversation',
      fired: true,
      dismissed: false,
      conversationId: 'general',
      conversationName: 'General DM',
      conversationType: 'dm',
      messageId: 'message-2',
      text: 'This reminder belongs to a DM',
      remindAt: reminderTime,
      firedAt: reminderTime,
    })
    const wrapper = mount(ComposerConversation)

    expect(wrapper.text()).toContain('Reminded you at')
    expect(wrapper.text()).toContain('System')
    expect(wrapper.text()).not.toContain('This reminder belongs to a DM')
    expect(wrapper.get('.composer-conversation__reminder-message a').attributes('href')).toBe(
      'https://example.com/',
    )

    await buttonWithText(wrapper, 'Snooze').trigger('click')

    expect(wrapper.get('[role="dialog"] #reminder-title').text()).toBe('Snooze Reminder')
    await wrapper.get('[role="dialog"]').trigger('submit')

    await vi.waitFor(() => {
      expect(reminderStore.dueItems.map((reminder) => reminder.id)).toEqual([
        'due-reminder-other-conversation',
      ])
      expect(reminderStore.items).toHaveLength(1)
    })
    expect(reminderStore.items[0].fired).toBe(false)
    expect(reminderApi.createReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'general',
        conversationName: 'General',
        messageId: 'message-1',
        text: 'Check https://example.com',
      }),
    )
  })

  it('removes a due reminder from chat when Delete Reminder is clicked', async () => {
    const reminderStore = useRemindersStore()
    const reminderTime = new Date(Date.now() - 60_000).toISOString()
    reminderStore.deletedItems.push({
      id: 'due-reminder-delete',
      fired: true,
      dismissed: false,
      conversationId: 'general',
      conversationName: 'General',
      conversationType: 'channel',
      messageId: 'message-delete',
      text: 'Remove this reminder from chat',
      remindAt: reminderTime,
      firedAt: reminderTime,
    })
    const wrapper = mount(ComposerConversation)

    expect(wrapper.text()).toContain('Remove this reminder from chat')
    await buttonWithText(wrapper, 'Delete Reminder').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).not.toContain('Remove this reminder from chat')
      expect(reminderStore.dueItems).toHaveLength(0)
    })
    expect(reminderStore.deletedItems[0]).toMatchObject({
      id: 'due-reminder-delete',
      dismissed: true,
      hideFromChat: true,
    })
  })

  it('keeps deleted reminders in the panel history but hides them from chat', async () => {
    const reminderStore = useRemindersStore()
    await reminderStore.add({
      conversationId: 'general',
      conversationName: 'General',
      conversationType: 'channel',
      messageId: 'message-deleted',
      text: 'Deleted reminder message',
      remindAt: new Date(Date.now() + 60_000).toISOString(),
    })
    const reminderId = reminderStore.items[0].id
    await reminderStore.remove(reminderId)

    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'general', conversationType: 'channel' },
    })

    expect(wrapper.text()).not.toContain('Reminder deleted at')
    expect(wrapper.text()).not.toContain('Deleted reminder message')

    const otherConversation = mount(ComposerConversation, {
      props: { conversationId: 'other-channel', conversationType: 'channel' },
    })
    expect(otherConversation.text()).not.toContain('Deleted reminder message')
    expect(reminderStore.deletedItems[0]).toMatchObject({
      dismissed: true,
      hideFromChat: true,
    })
  })

  it('does not open a message menu when left click is set to default', async () => {
    useUserStore().hydrate({ preferences: { leftClick: 'default' } })
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Select this message')

    await wrapper.get('.composer-conversation__message-bubble').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 275))

    expect(wrapper.find('.composer-conversation__menu').exists()).toBe(false)
  })

  it('shows a sent poll in the conversation', async () => {
    const wrapper = mount(ComposerConversation)
    const composer = wrapper.findComponent(MessageComposer)

    await composer.get('button[aria-label="Insert poll"]').trigger('click')

    const titleInput = document.querySelector('#poll-title-input')
    titleInput.value = 'Lunch vote'
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    const questionInput = document.querySelector('#poll-question-0')
    questionInput.value = 'What should we order?'
    questionInput.dispatchEvent(new Event('input', { bubbles: true }))
    const options = document.querySelectorAll('.message-composer__poll-option input')
    options[0].value = 'Pizza'
    options[0].dispatchEvent(new Event('input', { bubbles: true }))
    options[1].value = 'Salad'
    options[1].dispatchEvent(new Event('input', { bubbles: true }))

    document.querySelector('.message-composer__poll-next').click()
    await nextTick()
    document.querySelector('.message-composer__poll-next').click()
    await nextTick()
    document.querySelector('.message-composer__poll-schedule-option input').click()
    await nextTick()
    document.querySelector('.message-composer__poll-footer .message-composer__poll-next').click()
    await vi.waitFor(() => expect(pollsApi.createPoll).toHaveBeenCalledOnce())
    await vi.waitFor(() =>
      expect(wrapper.find('.composer-conversation__poll-card').exists()).toBe(true),
    )
    await vi.waitFor(() =>
      expect(wrapper.find('.composer-conversation__poll-card').exists()).toBe(true),
    )
    await vi.waitFor(() => expect(sendChannelMessage).toHaveBeenCalledOnce())

    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Lunch vote')
    expect(
      document.querySelector('[role="dialog"][aria-labelledby="message-poll-title"]'),
    ).toBeNull()
    expect(useMessagesStore().messagesFor('general').at(-1).poll.questions[0].text).toBe(
      'What should we order?',
    )
    expect(pollsApi.createPoll).toHaveBeenCalledWith(
      'general',
      expect.objectContaining({
        title: 'Lunch vote',
        audience_responses: 'public',
        results_visibility: 'owner_only',
        start_now: true,
        schedule_start: false,
        schedule_close: false,
      }),
    )
    expect(pollsApi.createPoll.mock.calls[0][1]).not.toHaveProperty('start_at')
    expect(pollsApi.createPoll.mock.calls[0][1]).not.toHaveProperty('close_at')
    expect(pollsApi.createPoll.mock.calls[0][1]).not.toHaveProperty('id')
    expect(sendChannelMessage).toHaveBeenCalledWith(
      'company-1',
      'team-1',
      'general',
      expect.objectContaining({ content: 'Lunch vote', poll_id: 'server-poll-default' }),
    )
    expect(useMessagesStore().messagesFor('general').at(-1)).toMatchObject({
      poll_id: 'server-poll-default',
      content: 'Lunch vote',
    })
    await wrapper.get('.composer-conversation__poll-actions button:last-child').trigger('click')
    await vi.waitFor(() => expect(pollsApi.closePoll).toHaveBeenCalledOnce())
    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Closed')
  })

  it('sends and stores a created poll in the active DM conversation', async () => {
    const dms = useDmStore()
    const sendDmMessage = vi
      .spyOn(dmApi, 'sendMessage')
      .mockImplementation(async (_companyId, channelId, payload) => ({
        id: 'dm-poll-message-server-id',
        from: dms.meId,
        text: payload.body,
        createdAt: new Date().toISOString(),
        poll_id: payload.poll_id,
        channelId,
      }))
    dms.conversations.push({
      id: 'dm-poll-channel',
      title: 'Poll test DM',
      messages: [],
      members: [dms.meId],
    })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'dm-poll-channel', conversationType: 'dm' },
    })
    const createPoll = wrapper.findComponent(MessageComposer).props('createPoll')

    await expect(
      createPoll('dm-poll-channel', {
        id: 'draft-poll-id',
        title: 'DM poll',
        questions: [{ text: 'Ready?', type: 'choice', options: ['Yes', 'No'] }],
      }),
    ).resolves.toMatchObject({ title: 'DM poll' })

    expect(pollsApi.createPoll).toHaveBeenCalledWith(
      'dm-poll-channel',
      expect.objectContaining({ title: 'DM poll' }),
    )
    expect(sendDmMessage).toHaveBeenCalledWith(
      'company-1',
      'dm-poll-channel',
      expect.objectContaining({
        body: 'DM poll',
        is_important: false,
        poll_id: 'server-poll-default',
      }),
    )
    await vi.waitFor(() =>
      expect(dms.conversations[0].messages[0].id).toBe('dm-poll-message-server-id'),
    )
    expect(dms.conversations[0].messages[0]).toMatchObject({
      poll_id: 'server-poll-default',
      poll: { title: 'DM poll', id: 'server-poll-default' },
    })
    expect(wrapper.text()).toContain('DM poll')
    wrapper.unmount()
    sendDmMessage.mockRestore()
  })

  it('renders a poll card from a fetched message that contains poll_id', async () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'server-poll-message',
        content: 'Shared poll',
        poll_id: 'server-poll-from-message',
        author: 'Another user',
        mine: false,
        createdAt: new Date().toISOString(),
      },
    ]
    const wrapper = mount(ComposerConversation)

    expect(wrapper.get('.composer-conversation__poll-card').attributes('data-poll-id')).toBe(
      'server-poll-from-message',
    )
    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Shared poll')
    expect(wrapper.text().match(/Shared poll/g)).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows only poll summary in the message and full poll details after Participate', async () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'compact-poll-message',
        content: 'Lunch poll',
        poll_id: 'compact-server-poll',
        author: 'Another user',
        mine: false,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'compact-server-poll',
          title: 'Lunch poll',
          description: 'Choose what we should order',
          audience: 'public',
          questions: [],
        },
      },
    ]
    pollsApi.getPollQuestions.mockResolvedValueOnce({
      result: [
        {
          id: 'lunch-question',
          question: 'What should we order?',
          type: 'choice',
          required: true,
          choices: ['Pizza', 'Salad'],
        },
      ],
    })
    const wrapper = mount(ComposerConversation)
    const card = wrapper.get('.composer-conversation__poll-card')

    expect(card.text()).toContain('Lunch poll')
    expect(card.text()).toContain('Open')
    expect(card.text()).toContain('Public')
    expect(card.text()).not.toContain('Choose what we should order')
    expect(card.text()).not.toContain('What should we order?')
    expect(card.text()).not.toContain('Pizza')
    expect(card.text()).not.toContain('Salad')

    await card
      .findAll('button')
      .find((button) => button.text().includes('Participate'))
      .trigger('click')
    await vi.waitFor(() =>
      expect(document.querySelector('.composer-conversation__poll-response-modal')).not.toBeNull(),
    )
    const dialog = document.querySelector('.composer-conversation__poll-response-modal')
    expect(dialog.textContent).toContain('Lunch poll')
    expect(dialog.textContent).toContain('Description: Choose what we should order')
    expect(dialog.textContent).toContain('Q1. What should we order?')
    expect(dialog.textContent).toContain('Pizza')
    expect(dialog.textContent).toContain('Salad')
    wrapper.unmount()
  })

  it("shows You're Done for a previously answered poll and prevents another participation", async () => {
    const messages = useMessagesStore()
    const dms = useDmStore()
    localStorage.setItem(
      `whistleit:participated-polls:${dms.meId}`,
      JSON.stringify(['already-voted-poll']),
    )
    messages.messagesByChannel.general = [
      {
        id: 'already-voted-message',
        content: 'Vote',
        poll_id: 'already-voted-poll',
        author: 'Another user',
        mine: false,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'already-voted-poll',
          title: 'Vote',
          questions: [{ id: 'question-1', text: 'Ready?', type: 'choice', options: ['Yes'] }],
        },
      },
    ]
    const wrapper = mount(ComposerConversation)
    const card = wrapper.get('.composer-conversation__poll-card')

    expect(card.text()).toContain("You're Done")
    expect(card.text()).not.toContain('Participate')
    await card.get('button.is-done').trigger('click')
    expect(document.querySelector('.composer-conversation__poll-response-modal')).toBeNull()
    expect(pollsApi.getPollQuestions).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('prevents the poll creator from participating and explains why on hover', async () => {
    const messages = useMessagesStore()
    const dms = useDmStore()
    messages.messagesByChannel.general = [
      {
        id: 'creator-poll-message',
        content: 'Creator poll',
        poll_id: 'creator-poll',
        author: 'You',
        mine: true,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'creator-poll',
          title: 'Creator poll',
          creatorId: dms.meId,
          questions: [{ text: 'Choose?', type: 'choice', options: ['A', 'B'] }],
        },
      },
    ]
    const wrapper = mount(ComposerConversation)
    const tooltip = wrapper.get('.composer-conversation__poll-tooltip')
    const participateButton = tooltip.get('button')

    expect(participateButton.attributes('disabled')).toBeDefined()
    expect(tooltip.attributes('title')).toBe(
      'You are the creator and cannot participate in this poll.',
    )
    expect(tooltip.attributes('data-tooltip')).toBe(
      'You are the creator and cannot participate in this poll.',
    )
    await participateButton.trigger('click')
    expect(document.querySelector('.composer-conversation__poll-response-modal')).toBeNull()
    expect(pollsApi.getPollQuestions).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders open-ended answers from results when the message has no question data', async () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'poll-without-question-data',
        content: 'vote',
        poll_id: 'server-poll-with-answer',
        author: 'Another user',
        mine: false,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'server-poll-with-answer',
          title: 'vote',
          description: 'Da',
          audience: 'public',
        },
      },
    ]
    pollsApi.getPollResult.mockResolvedValueOnce({
      result: [
        {
          id: 'question-age',
          poll_id: 'server-poll-with-answer',
          type: 'open_ended',
          question: 'age',
          total_votes: 1,
          answers: [{ answer: 'i am good', users: 'Hammad Kazmi' }],
        },
      ],
      pagination: { current_page: 1, total: 1 },
    })
    const wrapper = mount(ComposerConversation)

    await wrapper
      .get('.composer-conversation__poll-card')
      .findAll('button')
      .find((button) => button.text().includes('View All Results'))
      .trigger('click')

    await vi.waitFor(() => expect(document.body.textContent).toContain('i am good'))
    expect(document.body.textContent).toContain('Q1. age')
    expect(document.body.textContent).toContain('Total Responses: 1')
    expect(document.body.textContent).not.toContain('Unable to load poll results')
    wrapper.unmount()
  })

  it('renders choice result objects as option labels and vote counts', async () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'choice-poll-message',
        content: 'My poll',
        poll_id: 'choice-results-poll',
        author: 'Another user',
        mine: false,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'choice-results-poll',
          title: 'My poll',
          questions: [],
        },
      },
    ]
    pollsApi.getPollResult.mockResolvedValueOnce({
      result: [
        {
          id: 'choice-question',
          question: 'What is your Name',
          type: 'choice',
          total_votes: 1,
          choices: [
            { choice: '1', votes: 0, users: [] },
            { choice: '2', votes: 0, users: [] },
            { choice: '3', votes: 0, users: [] },
            { choice: '4', votes: 1, users: ['Muhammad Abdullah Tariq'] },
            { choice: '5', votes: 0, users: [] },
          ],
        },
      ],
      pagination: { total: 1 },
    })
    const wrapper = mount(ComposerConversation)

    await wrapper
      .get('.composer-conversation__poll-card')
      .findAll('button')
      .find((button) => button.text().includes('View All Results'))
      .trigger('click')

    const dialog = () => document.querySelector('.composer-conversation__poll-response-modal')
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Q1. What is your Name'))
    expect(dialog().textContent).toContain('100%')
    expect(dialog().textContent).toContain('1 VOTE')
    expect(dialog().textContent).not.toContain('"choice"')
    for (const option of ['1', '2', '3', '4', '5']) {
      expect(dialog().textContent).toContain(option)
    }
    wrapper.unmount()
  })

  it('shows after-close guidance until the poll closes, then displays its results', async () => {
    const messages = useMessagesStore()
    const dms = useDmStore()
    messages.messagesByChannel.general = [
      {
        id: 'after-close-poll-message',
        content: 'Poll results',
        poll_id: 'after-close-poll',
        author: 'You',
        mine: true,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'after-close-poll',
          title: 'Poll results',
          creatorId: dms.meId,
          resultsVisibility: 'after_close',
          questions: [{ text: 'Favorite?', type: 'choice', options: ['Tea', 'Coffee'] }],
        },
      },
    ]
    pollsApi.getPollResult.mockResolvedValueOnce({
      result: [
        {
          question: 'Favorite?',
          type: 'choice',
          total_votes: 1,
          choices: [
            { choice: 'Tea', votes: 1, users: ['user-2'] },
            { choice: 'Coffee', votes: 0, users: [] },
          ],
        },
      ],
    })
    const wrapper = mount(ComposerConversation)
    const card = wrapper.get('.composer-conversation__poll-card')
    const resultsButton = () =>
      card.findAll('button').find((button) => button.text().includes('View All Results'))

    await resultsButton().trigger('click')
    const dialog = () => document.querySelector('.composer-conversation__poll-response-modal')
    await vi.waitFor(() =>
      expect(dialog()?.textContent).toContain(
        'Poll is not closed yet. The results will be shown when the poll is closed!',
      ),
    )
    expect(pollsApi.getPollResult).not.toHaveBeenCalled()
    dialog().querySelector('button[aria-label="Close poll response"]').click()
    await nextTick()

    await card
      .findAll('button')
      .find((button) => button.text().includes('Close Poll'))
      .trigger('click')
    await vi.waitFor(() => expect(card.text()).toContain('Closed'))
    await resultsButton().trigger('click')
    await vi.waitFor(() => expect(dialog()?.textContent).toContain('Total Votes: 1'))
    expect(dialog().textContent).toContain('100%')
    expect(pollsApi.getPollResult).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('restricts owner-only results to the poll creator', async () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'private-results-poll-message',
        content: 'Private results',
        poll_id: 'private-results-poll',
        author: 'Another user',
        mine: false,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'private-results-poll',
          title: 'Private results',
          creatorId: 'another-user',
          resultsVisibility: 'owner_only',
          questions: [],
        },
      },
    ]
    const wrapper = mount(ComposerConversation)

    await wrapper
      .get('.composer-conversation__poll-card')
      .findAll('button')
      .find((button) => button.text().includes('View All Results'))
      .trigger('click')

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Results are visible to the poll creator only.'),
    )
    expect(document.body.textContent).toContain('Creator: Another user')
    expect(document.body.textContent).not.toContain('Creator: You')
    expect(pollsApi.getPollResult).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('normalizes the backend poll response before rendering status and permissions', async () => {
    pollsApi.createPoll.mockResolvedValueOnce({
      poll: {
        id: 'backend-poll-1',
        creator_id: 'user-1',
        audience_responses: 'anonymous',
        results_visibility: 'after_close',
        status: 'scheduled',
        start_at: new Date(Date.now() + 60_000).toISOString(),
        close_at: null,
      },
    })
    const wrapper = mount(ComposerConversation)
    const createPoll = wrapper.findComponent(MessageComposer).props('createPoll')

    await expect(
      createPoll('general', {
        id: 'draft-poll-id',
        title: 'Backend poll',
        audience: 'public',
        resultsVisibility: 'private',
        startNow: true,
        scheduleStart: '',
        scheduleClose: '',
        questions: [{ text: 'Ready?', type: 'choice', options: ['Yes', 'No'] }],
      }),
    ).resolves.toMatchObject({
      id: 'backend-poll-1',
      creatorId: 'user-1',
      audience: 'anonymous',
      resultsVisibility: 'after_close',
      scheduleClose: null,
    })

    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Scheduled')
    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Anonymous')
    wrapper.unmount()
  })

  it('uses the nested server poll ID for subsequent question requests', async () => {
    pollsApi.createPoll.mockResolvedValueOnce({
      data: { poll: { id: 'server-poll-nested', title: 'Nested response poll' } },
    })
    pollsApi.getPollQuestions.mockResolvedValueOnce({ result: [] })
    const wrapper = mount(ComposerConversation)
    const createPoll = wrapper.findComponent(MessageComposer).props('createPoll')

    await createPoll('general', {
      id: 'poll-temporary-draft-id',
      title: 'Nested response poll',
      audience: 'public',
      resultsVisibility: 'private',
      startNow: true,
      scheduleStartEnabled: false,
      scheduleCloseEnabled: false,
      questions: [{ text: 'Ready?', type: 'choice', options: ['Yes', 'No'] }],
    })
    await wrapper.get('.composer-conversation__poll-actions button').trigger('click')

    expect(pollsApi.getPollQuestions).toHaveBeenCalledWith({ poll_id: 'server-poll-nested' })
    expect(wrapper.text()).not.toContain('poll-temporary-draft-id')
    wrapper.unmount()
  })

  it('maps all editor question types to backend poll fields', async () => {
    const wrapper = mount(ComposerConversation)
    const createPoll = wrapper.findComponent(MessageComposer).props('createPoll')

    await createPoll('general', {
      id: 'draft-poll-id',
      title: 'Question type mapping',
      audience: 'public',
      resultsVisibility: 'private',
      startNow: true,
      scheduleStartEnabled: false,
      scheduleCloseEnabled: false,
      questions: [
        {
          text: 'Pick one',
          type: 'choice',
          required: true,
          multiple: true,
          options: ['A', 'B'],
        },
        {
          text: 'Rate it',
          type: 'rating',
          required: true,
          ratingType: '1-10',
          options: Array.from({ length: 10 }, (_, index) => String(index + 1)),
        },
        { text: 'Explain', type: 'openEnded', required: false, options: [] },
      ],
    })

    expect(pollsApi.createPoll.mock.calls[0][1].questions).toEqual([
      {
        text: 'Pick one',
        type: 'choice',
        required: true,
        options: ['A', 'B'],
        multiple_select: true,
      },
      {
        text: 'Rate it',
        type: 'rating',
        required: true,
        options: Array.from({ length: 10 }, (_, index) => String(index + 1)),
        rating_scale: 10,
      },
      {
        text: 'Explain',
        type: 'open_ended',
        required: false,
        options: ['__open_ended__', '__open_ended__'],
      },
    ])
    wrapper.unmount()
  })

  it('accepts and displays an open-ended poll response', async () => {
    pollsApi.getPollQuestions.mockResolvedValueOnce({
      result: [
        {
          id: 'open-question-1',
          question: 'What should we improve?',
          type: 'open_ended',
          required: true,
          choices: [],
        },
      ],
    })
    const wrapper = mount(ComposerConversation)
    const composer = wrapper.findComponent(MessageComposer)
    composer.vm.$emit('send', {
      content: '',
      poll: {
        id: 'open-ended-poll',
        title: 'Open feedback',
        questions: [
          {
            text: 'What should we improve?',
            type: 'openEnded',
            required: true,
            multiple: false,
            options: [],
          },
        ],
      },
    })
    await nextTick()

    await wrapper.get('.composer-conversation__poll-actions button').trigger('click')
    await vi.waitFor(() => expect(pollsApi.getPollQuestions).toHaveBeenCalledOnce())
    await vi.waitFor(() =>
      expect(
        document.querySelector('textarea[aria-label="Response to question 1"]'),
      ).not.toBeNull(),
    )
    const response = document.querySelector('textarea[aria-label="Response to question 1"]')
    expect(response).not.toBeNull()
    response.value = 'Improve documentation'
    response.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    document.querySelector('.composer-conversation__poll-response-footer button').click()
    await vi.waitFor(() => expect(pollsApi.submitPollAnswer).toHaveBeenCalledOnce())
    await vi.waitFor(() =>
      expect(wrapper.get('.composer-conversation__poll-card').text()).toContain("You're Done"),
    )
    expect(wrapper.get('.composer-conversation__poll-card').text()).not.toContain('Participate')
    expect(pollsApi.submitPollAnswer).toHaveBeenCalledWith({
      channel_id: 'general',
      poll_id: 'open-ended-poll',
      answers: { 'open-question-1': 'Improve documentation' },
    })
    await vi.waitFor(() =>
      expect(wrapper.get('.composer-conversation__poll-card').text()).not.toContain('Participate'),
    )
    pollsApi.getPollResult.mockResolvedValueOnce({
      result: [
        {
          id: 'open-question-1',
          poll_id: 'open-ended-poll',
          type: 'open_ended',
          question: 'What should we improve?',
          total_votes: 1,
          answers: [{ answer: 'mai theek houn', users: 'Hammad Kazmi' }],
        },
      ],
      pagination: { total: 1 },
    })
    const resultRequestCount = pollsApi.getPollResult.mock.calls.length
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('View All Results'))
      .trigger('click')
    await vi.waitFor(() =>
      expect(pollsApi.getPollResult).toHaveBeenCalledTimes(resultRequestCount + 1),
    )
    expect(pollsApi.getPollResult).toHaveBeenLastCalledWith({
      channel_id: 'general',
      poll_id: 'open-ended-poll',
    })
    await nextTick()
    expect(document.body.textContent).toContain('mai theek houn')
    expect(document.body.textContent).toContain('Total Responses:')
    expect(document.body.textContent).not.toContain('Improve documentation')
    const closeButton = document.querySelector(
      '.composer-conversation__poll-response-footer .is-close',
    )
    expect(closeButton).not.toBeNull()
    closeButton.click()
    await nextTick()
    expect(document.querySelector('.composer-conversation__poll-response-modal')).toBeNull()
    wrapper.unmount()
  })

  it('shows scheduled poll status without timing details in the message card', async () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'scheduled-poll',
        content: '',
        author: 'You',
        mine: true,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'scheduled-poll',
          title: 'Scheduled poll',
          scheduleStart: '2099-11-03T12:34:59',
          scheduleClose: '2099-11-03T13:34:59',
          questions: [],
        },
      },
    ]
    const wrapper = mount(ComposerConversation)

    expect(wrapper.text()).toContain('Scheduled')
    expect(wrapper.text()).not.toContain('Starts')
    expect(wrapper.text()).not.toContain('Ends')
    expect(wrapper.text()).not.toContain('Participate')
    expect(wrapper.text()).not.toContain('View All Results')
    wrapper.unmount()
  })

  it('allows closing a scheduled poll and persists its closed status to history', async () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'scheduled-poll-message',
        content: 'Future poll',
        author: 'You',
        mine: true,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'server-scheduled-poll',
          title: 'Future poll',
          status: 'Scheduled',
          scheduleStart: '2099-11-11T12:00:00.000Z',
          questions: [],
        },
      },
    ]
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'general', conversationType: 'channel' },
    })

    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Scheduled')
    const closeButton = wrapper
      .findAll('.composer-conversation__poll-actions button')
      .find((button) => button.text() === 'Close Poll')
    expect(closeButton).toBeDefined()

    await closeButton.trigger('click')
    await vi.waitFor(() =>
      expect(pollsApi.closePoll).toHaveBeenCalledWith('server-scheduled-poll', undefined),
    )

    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Closed')
    expect(useUiStore().polls).toContainEqual(
      expect.objectContaining({ id: 'server-scheduled-poll', status: 'Closed' }),
    )
    expect(localStorage.getItem('whistleit:channel-poll-history')).toContain('"status":"Closed"')
    wrapper.unmount()
  })

  it('hides Close Poll from users who are not the creator or authorized', () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'other-users-poll-message',
        content: 'Poll: Team choice',
        author: 'Another user',
        mine: false,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'other-users-poll',
          title: 'Team choice',
          creatorId: 'another-user',
          canClose: false,
          questions: [{ text: 'Which option?', type: 'choice', options: ['A', 'B'] }],
        },
      },
    ]
    const wrapper = mount(ComposerConversation)

    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Team choice')
    expect(wrapper.get('.composer-conversation__poll-card').text()).not.toContain('Which option?')
    expect(
      wrapper
        .findAll('.composer-conversation__poll-actions button')
        .some((button) => button.text().includes('Close Poll')),
    ).toBe(false)
    wrapper.unmount()
  })

  it('publishes a legacy poll as a server copy and replaces its temporary ID', async () => {
    pollsApi.createPoll.mockResolvedValueOnce({ poll: { id: 'server-poll-migrated' } })
    pollsApi.getPollQuestions.mockResolvedValueOnce({ result: [] })
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'legacy-poll-message',
        content: 'Poll: Legacy poll',
        author: 'You',
        mine: true,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'poll-1794292224037-0ka65j',
          title: 'Legacy poll',
          questions: [{ text: 'Question?', type: 'choice', options: ['A', 'B'] }],
        },
      },
    ]
    const wrapper = mount(ComposerConversation)

    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain(
      'This older poll has no server ID.',
    )
    await wrapper.get('.composer-conversation__poll-actions button').trigger('click')
    await vi.waitFor(() => expect(pollsApi.createPoll).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(sendChannelMessage).toHaveBeenCalledOnce())
    const publishedMessage = messages.messagesByChannel.general.find(
      (message) => message.poll?.id === 'server-poll-migrated',
    )
    expect(publishedMessage).toBeDefined()
    expect(wrapper.get('.composer-conversation__poll-card').attributes('data-poll-id')).toBe(
      'server-poll-migrated',
    )
    expect(sendChannelMessage).toHaveBeenCalledWith(
      'company-1',
      'team-1',
      'general',
      expect.objectContaining({
        content: 'Legacy poll',
        poll_id: 'server-poll-migrated',
      }),
    )
    await wrapper.get('.composer-conversation__poll-actions button').trigger('click')
    await vi.waitFor(() => expect(pollsApi.getPollQuestions).toHaveBeenCalledOnce())
    expect(pollsApi.getPollQuestions).toHaveBeenCalledWith({ poll_id: 'server-poll-migrated' })
    expect(pollsApi.getPollResult).not.toHaveBeenCalled()
    expect(pollsApi.closePoll).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('closes a poll and shows closed actions when its end time passes', async () => {
    vi.useFakeTimers()
    const closeAt = new Date(Date.now() + 60_000).toISOString()
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'expired-poll',
        content: '',
        author: 'You',
        mine: true,
        createdAt: new Date().toISOString(),
        poll: {
          id: 'expired-poll',
          title: 'Expired poll',
          scheduleClose: closeAt,
          questions: [
            {
              text: 'Which option?',
              type: 'choice',
              required: true,
              multiple: false,
              options: ['A', 'B'],
            },
          ],
        },
      },
    ]
    const wrapper = mount(ComposerConversation)

    expect(wrapper.text()).toContain('Participate')

    await vi.advanceTimersByTimeAsync(60_000)
    await nextTick()

    expect(wrapper.text()).toContain('Closed')
    expect(wrapper.text()).not.toContain('Participate')
    expect(wrapper.text()).not.toContain('Close Poll')
    expect(wrapper.text()).toContain('View All Results')
    expect(wrapper.text()).toContain('Export To Csv')

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('opens and sends messages in the selected direct message', async () => {
    const dms = useDmStore()
    await dms.init()
    const conversation = await dms.startDm('u2')
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: conversation.id, conversationType: 'dm' },
    })
    expect(wrapper.text()).toContain('Project ideas bhej di hain')
    expect(wrapper.text()).toContain('Project ideas bhej di hain')

    const editor = wrapper.get('[contenteditable="true"]')
    editor.element.textContent = 'Reply from the composer'
    editor.element.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await wrapper.get('form').trigger('submit')

    expect(conversation.messages.at(-1)).toMatchObject({
      from: dms.meId,
      text: 'Reply from the composer',
    })
    expect(wrapper.text()).toContain('Reply from the composer')
  })

  it('passes the direct-channel ID to the voice composer', () => {
    const dms = useDmStore()
    dms.conversations = [
      {
        id: 'direct-channel-42',
        type: 'dm',
        members: [dms.meId, 'user-2'],
        messages: [],
      },
    ]
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'direct-channel-42', conversationType: 'dm' },
    })

    expect(wrapper.findComponent(MessageComposer).props('channelId')).toBe('direct-channel-42')
    wrapper.unmount()
  })

  it('sends and plays voice notes in direct messages', async () => {
    const dms = useDmStore()
    const conversation = {
      id: 'direct-channel-voice',
      type: 'dm',
      members: [dms.meId, 'u2'],
      messages: [
        normalizeMessage({
          id: 'received-dm-voice',
          from: 'u2',
          body: 'Voice message',
          voice_note: { voice_note_id: 'voice-note-received' },
          createdAt: new Date().toISOString(),
        }),
      ],
    }
    dms.conversations = [conversation]
    const sendDmMessage = vi.spyOn(dmApi, 'sendMessage').mockResolvedValue({
      id: 'sent-dm-voice',
      from: dms.meId,
      text: 'Voice message',
      voiceNoteId: 'voice-note-sent',
    })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: conversation.id, conversationType: 'dm' },
    })

    wrapper.findComponent(MessageComposer).vm.$emit('send', {
      content: '',
      voiceNoteId: 'voice-note-sent',
    })

    await vi.waitFor(() => {
      expect(sendDmMessage).toHaveBeenCalledWith(
        'company-1',
        conversation.id,
        expect.objectContaining({
          body: 'Voice message',
          isCode: false,
          senderId: dms.meId,
          receiverId: 'u2',
          timestamp: expect.any(String),
          voice_note_id: 'voice-note-sent',
          is_important: false,
        }),
      )
    })
    await vi.waitFor(() => expect(wrapper.findAll('.voice-note-player__audio')).toHaveLength(2))
    expect(wrapper.findAll('.composer-conversation__message-bubble p')).toHaveLength(0)
    expect(conversation.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ voiceNoteId: 'voice-note-sent' })]),
    )

    sendDmMessage.mockRestore()
    wrapper.unmount()
  })

  it('shows the signed-in user name instead of You for DM messages', async () => {
    localStorage.setItem('authUserId', 'u1')
    localStorage.setItem('authUser', JSON.stringify({ id: 'u1', fullName: 'Aiman Iqbal' }))
    const dms = useDmStore()
    await dms.init()
    dms.users = dms.users.filter((user) => user.id !== dms.meId)
    const conversation = await dms.startDm('u2')
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: conversation.id, conversationType: 'dm' },
    })

    await sendMessage(wrapper, 'Name should be visible')

    expect(wrapper.text()).toContain('Aiman Iqbal')
    expect(wrapper.text()).not.toMatch(/\bYou\b/)
    wrapper.unmount()
  })

  it('opens the message author direct message from a channel', async () => {
    const dms = useDmStore()
    const ui = useUiStore()
    await dms.init()
    const messages = useMessagesStore()
    messages.messagesByChannel.general = [
      {
        id: 'from-muniba',
        content: 'A message from Muniba',
        author: 'Muniba Naseer',
        authorId: 'u2',
        mine: false,
        createdAt: new Date().toISOString(),
      },
    ]
    ui.activePanel = 'activity'
    const wrapper = mount(ComposerConversation)

    await wrapper.get('[aria-label="Open direct message with Muniba Naseer"]').trigger('click')

    expect(dms.activeId).toBe('c1')
    expect(ui.activePanel).toBeNull()
    wrapper.unmount()
  })

  it('opens the message author direct message from a DM', async () => {
    const dms = useDmStore()
    const ui = useUiStore()
    await dms.init()
    const otherConversation = await dms.startDm('u3')
    ui.activePanel = 'activity'
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'c1', conversationType: 'dm' },
    })

    await wrapper.get('[aria-label="Open direct message with Muniba Naseer"]').trigger('click')

    expect(dms.activeId).toBe('c1')
    expect(dms.activeId).not.toBe(otherConversation.id)
    expect(ui.activePanel).toBeNull()
    wrapper.unmount()
  })

  it('keeps channel messages scoped to the channel they were sent in', async () => {
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'channel-one', conversationType: 'channel' },
    })
    const send = async (text) => {
      const editor = wrapper.get('[contenteditable="true"]')
      editor.element.textContent = text
      editor.element.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()
      await wrapper.get('form').trigger('submit')
    }

    await send('Only in channel one')
    expect(wrapper.text()).toContain('Only in channel one')

    await wrapper.setProps({ conversationId: 'channel-two' })
    expect(wrapper.text()).not.toContain('Only in channel one')

    await send('Only in channel two')
    expect(wrapper.text()).toContain('Only in channel two')
    expect(wrapper.text()).not.toContain('Only in channel one')

    await wrapper.setProps({ conversationId: 'channel-one' })
    expect(wrapper.text()).toContain('Only in channel one')
    expect(wrapper.text()).not.toContain('Only in channel two')
    wrapper.unmount()
  })

  it('shows edit and delete only for messages sent by the current user', async () => {
    const dms = useDmStore()
    await dms.init()
    const conversation = await dms.startDm('u2')
    dms.sendMessage(conversation.id, { content: 'My message' })
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: conversation.id, conversationType: 'dm' },
    })
    const receivedArticle = wrapper.findAll('article')[0]
    await receivedArticle.get('button[aria-label="More message actions"]').trigger('click')

    const receivedMenu = receivedArticle.get('.composer-conversation__menu')
    expect(buttonWithText(receivedMenu, 'Edit')).toBeUndefined()
    expect(buttonWithText(receivedMenu, 'Delete')).toBeUndefined()

    const ownArticle = wrapper
      .findAll('article')
      .find((article) => article.text().includes('My message'))
    await ownArticle.get('button[aria-label="More message actions"]').trigger('click')
    const ownMenu = ownArticle.get('.composer-conversation__menu')
    expect(buttonWithText(ownMenu, 'Edit')).toBeDefined()
    expect(buttonWithText(ownMenu, 'Delete')).toBeDefined()
    expect(buttonWithText(ownMenu, 'Edit').attributes('disabled')).toBeUndefined()
    expect(buttonWithText(ownMenu, 'Delete').attributes('disabled')).toBeUndefined()
  })

  it('keeps the message actions card within the viewport at top, center, and bottom', async () => {
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Keep the actions card visible')
    const article = wrapper.get('article')
    const trigger = article.get('button[aria-label="More message actions"]')
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight
    const anchorRects = [
      { top: 2, bottom: 22, left: 10, right: 40 },
      {
        top: viewportHeight / 2,
        bottom: viewportHeight / 2 + 20,
        left: viewportWidth / 2,
        right: viewportWidth / 2 + 30,
      },
      {
        top: viewportHeight - 22,
        bottom: viewportHeight - 2,
        left: viewportWidth - 40,
        right: viewportWidth - 10,
      },
    ]
    let activeRect = anchorRects[0]
    vi.spyOn(trigger.element, 'getBoundingClientRect').mockImplementation(() => ({
      ...activeRect,
      width: 30,
      height: 20,
      x: activeRect.left,
      y: activeRect.top,
      toJSON: () => ({}),
    }))

    for (const [index, rect] of anchorRects.entries()) {
      activeRect = rect
      await trigger.trigger('click')
      await nextTick()
      await nextTick()

      const menu = article.get('.composer-conversation__menu')
      const top = Number.parseFloat(menu.element.style.top)
      const left = Number.parseFloat(menu.element.style.left)
      const width = Number.parseFloat(menu.element.style.width)
      const maxHeight = Number.parseFloat(menu.element.style.maxHeight)
      expect(menu.element.style.position).toBe('fixed')
      expect(left).toBeGreaterThanOrEqual(8)
      expect(left + width).toBeLessThanOrEqual(viewportWidth - 8)
      expect(top).toBeGreaterThanOrEqual(8)
      expect(top + maxHeight).toBeLessThanOrEqual(viewportHeight - 8)
      expect(menu.element.style.width).toBe('224px')

      if (index < anchorRects.length - 1) {
        await trigger.trigger('click')
      }
    }

    wrapper.unmount()
  })

  it('supports message reactions, pinning, and editing', async () => {
    const wrapper = mount(ComposerConversation)
    const ui = useUiStore()
    await sendMessage(wrapper, 'A message to update')

    const article = wrapper.get('article')
    await article.get('button[aria-label="Add reaction"]').trigger('click')
    await article.get('.test-emoji-picker-option').trigger('click')
    expect(article.text()).toContain('🥳 1')
    expect(emojiPickerProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ native: false, hideSearch: false }),
    )

    await article.get('button[aria-label="Pin message"]').trigger('click')
    expect(ui.pinnedMessages).toHaveLength(1)

    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Edit').trigger('click')
    const editForm = article.get('.composer-conversation__edit-form')
    await editForm.get('textarea').setValue('Edited message')
    await editForm.trigger('submit')
    await vi.waitFor(() => {
      expect(updateChannelMessage).toHaveBeenCalledWith(
        'company-1',
        'team-1',
        'general',
        'server-message-1',
        { content: 'Edited message' },
      )
    })

    await vi.waitFor(() => {
      expect(article.text()).toContain('Edited message')
      expect(article.find('.composer-conversation__edit-form').exists()).toBe(false)
    })
    expect(
      article.get('.composer-conversation__message-bubble .composer-conversation__edited').text(),
    ).toBe('(edited)')
    expect(
      article
        .find('.composer-conversation__message-heading .composer-conversation__edited')
        .exists(),
    ).toBe(false)
  })

  it('deletes a server-backed channel message through the delete API', async () => {
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'A message to delete')
    const article = wrapper.get('article')
    let resolveDelete
    deleteChannelMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve
        }),
    )

    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Delete').trigger('click')
    document.querySelector('.composer-conversation__delete-dialog .is-delete').click()
    await nextTick()

    expect(deleteChannelMessage).toHaveBeenCalledWith(
      'company-1',
      'team-1',
      'general',
      'server-message-1',
      'A message to delete',
    )
    expect(article.text()).toContain('(message deleted)')
    expect(document.querySelector('.composer-conversation__delete-dialog')).toBeNull()
    resolveDelete({ success: true, data: null })
    wrapper.unmount()
  })

  it('copies message text from the toolbar copy button', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Copy this message')

    await wrapper.get('button[aria-label="Copy message"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith('Copy this message')
    expect(wrapper.get('button[aria-label="Copy message"] svg').exists()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('falls back to the browser copy command when clipboard access is blocked', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'))
    const execCommand = vi.fn().mockReturnValue(true)
    const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(ComposerConversation)
    const ui = useUiStore()
    await sendMessage(wrapper, 'Copy with fallback')

    await wrapper.get('button[aria-label="Copy message"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith('Copy with fallback')
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(ui.toasts.at(-1)).toMatchObject({ title: 'Copied', type: 'success' })
    expect(document.querySelector('textarea[readonly]')).toBeNull()

    if (originalExecCommand) {
      Object.defineProperty(document, 'execCommand', originalExecCommand)
    } else {
      delete document.execCommand
    }
    vi.unstubAllGlobals()
  })

  it('confirms deletion, keeps the deleted message visible, and removes its pin', async () => {
    const wrapper = mount(ComposerConversation)
    const ui = useUiStore()
    const messages = useMessagesStore()
    await sendMessage(wrapper, 'Remove this message')
    const article = wrapper.get('article')

    await article.get('button[aria-label="Pin message"]').trigger('click')
    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Delete').trigger('click')
    await nextTick()

    expect(document.querySelector('.composer-conversation__delete-dialog')?.textContent).toContain(
      'Are you sure you want to delete this Message?',
    )
    document.querySelector('.composer-conversation__delete-footer .is-delete').click()
    await vi.waitFor(() => expect(messages.messagesFor('general').at(-1).deleted).toBe(true))

    expect(wrapper.text()).not.toContain('Remove this message')
    expect(wrapper.text()).toContain('(message deleted)')
    expect(messages.messagesFor('general').at(-1).deleted).toBe(true)
    expect(ui.pinnedMessages).toHaveLength(0)
    wrapper.unmount()
  })

  it('replaces quoted content when its original message is deleted', async () => {
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Original message text')
    const originalArticle = wrapper.findAll('article')[0]

    await originalArticle.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(originalArticle.get('.composer-conversation__menu'), 'Reply').trigger(
      'click',
    )
    await sendMessage(wrapper, 'Reply to original')

    const originalMenu = wrapper.findAll('article')[0]
    await originalMenu.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(originalMenu.get('.composer-conversation__menu'), 'Delete').trigger(
      'click',
    )
    await nextTick()
    document.querySelector('.composer-conversation__delete-footer .is-delete').click()
    await vi.waitFor(() => expect(useMessagesStore().messagesFor('general')[0].deleted).toBe(true))

    const replyArticle = wrapper
      .findAll('article')
      .find((article) => article.text().includes('Reply to original'))
    expect(replyArticle.get('.composer-conversation__reply-quote').text()).toContain(
      '(message deleted)',
    )
    expect(replyArticle.text()).not.toContain('Original message text')
    wrapper.unmount()
  })

  it('schedules a message deletion for the selected date and time', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-11-03T12:00:00.000Z'))
      const wrapper = mount(ComposerConversation)
      const messages = useMessagesStore()
      await sendMessage(wrapper, 'Delete this later')
      const article = wrapper.get('article')

      await article.get('button[aria-label="More message actions"]').trigger('click')
      await buttonWithText(article.get('.composer-conversation__menu'), 'Delete').trigger('click')
      await nextTick()
      document.querySelector('.composer-conversation__schedule-delete input').click()
      await nextTick()

      const deleteAt = new Date(Date.now() + 120_000)
      const localDeleteAt = new Date(deleteAt.getTime() - deleteAt.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16)
      const dateInput = document.querySelector('.composer-conversation__delete-date input')
      dateInput.value = localDeleteAt
      dateInput.dispatchEvent(new Event('input', { bubbles: true }))
      dateInput.dispatchEvent(new Event('change', { bubbles: true }))
      await nextTick()

      document.querySelector('.composer-conversation__delete-footer .is-delete').click()
      await vi.waitFor(() =>
        expect(messages.messagesFor('general').at(-1).deleteScheduledAt).toBe(
          deleteAt.toISOString(),
        ),
      )
      expect(wrapper.text()).toContain('Delete this later')

      await vi.advanceTimersByTimeAsync(120_000)
      await nextTick()
      expect(wrapper.text()).toContain('(message deleted)')
      expect(wrapper.text()).not.toContain('Delete this later')
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('replies to a message with an attached quoted message', async () => {
    const wrapper = mount(ComposerConversation)
    const messages = useMessagesStore()
    await sendMessage(wrapper, 'Original message')
    const article = wrapper.get('article')

    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Reply').trigger('click')
    expect(wrapper.text()).toContain('Replying to You')

    await sendMessage(wrapper, 'A reply')
    expect(messages.messagesFor('general').at(-1).replyTo).toMatchObject({
      content: 'Original message',
      author: 'You',
    })
    expect(wrapper.text()).toContain('A reply')
  })

  it('renders a link preview card and safe clickable link', async () => {
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Check this https://example.com/launch-plan')

    const preview = wrapper.get('.composer-conversation__link-preview')
    expect(preview.text()).toContain('Launch Plan')
    expect(preview.attributes('href')).toBe('https://example.com/launch-plan')
    expect(preview.attributes('rel')).toBe('noopener noreferrer')
  })

  it('opens the reminder message dialog from message actions', async () => {
    const wrapper = mount(ComposerConversation)
    const ui = useUiStore()
    await sendMessage(wrapper, 'Remember this update')
    const article = wrapper.get('article')
    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Set Reminder').trigger(
      'click',
    )

    await wrapper.get('[aria-label="Reminder title"]').setValue('Review tomorrow')
    await wrapper.get('.reminder-dialog').trigger('submit')

    const reminders = useRemindersStore()
    await vi.waitFor(() => expect(reminders.items).toHaveLength(1))
    expect(reminders.items[0]).toMatchObject({
      text: 'Remember this update',
      title: 'Review tomorrow',
      conversationId: 'general',
    })
    expect(ui.toasts[0].title).toBe('Reminder set')
  })

  it('forwards a message to another channel', async () => {
    const channels = useChannelsStore()
    channels.upsertChannel({ id: 'random', name: 'random', isArchived: false, isFavorite: false })
    listMembersMock
      .mockResolvedValueOnce({ items: [{ id: 'u1' }, { id: 'u2' }], total: 3 })
      .mockResolvedValueOnce({ items: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }], total: 3 })
    const messages = useMessagesStore()
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Forward this update')
    const article = wrapper.get('article')

    await article.get('button[aria-label="More message actions"]').trigger('click')
    const forwardAction = buttonWithText(article.get('.composer-conversation__menu'), 'Forward')
    expect(forwardAction.find('svg').exists()).toBe(true)
    await forwardAction.trigger('click')
    await wrapper.get('form.composer-conversation__forward-dialog').trigger('submit')

    await vi.waitFor(() => {
      expect(forwardChannelMessage).toHaveBeenLastCalledWith(
        'company-1',
        'team-1',
        'general',
        'server-message-1',
        { channel_ids: ['random'], user_ids: ['u2', 'u3'] },
      )
    })
    expect(listMembersMock).toHaveBeenNthCalledWith(1, 'random', { limit: 100 })
    expect(listMembersMock).toHaveBeenNthCalledWith(2, 'random', { limit: 3 })

    await wrapper.setProps({ conversationId: 'random' })
    expect(messages.messagesFor('random')).toHaveLength(0)
    wrapper.unmount()
  })

  it('loads and sends replies for a channel message in the thread panel', async () => {
    repliesApi.listReplies.mockResolvedValue([
      {
        id: 'reply-1',
        from: 'u2',
        text: 'Existing reply',
        createdAt: '2026-11-05T10:01:00Z',
      },
    ])
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Thread parent')
    const article = wrapper.get('article')
    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'View replies').trigger(
      'click',
    )

    await vi.waitFor(() => expect(wrapper.text()).toContain('Existing reply'))
    expect(wrapper.get('.composer-conversation__thread-summary').text()).toContain('1 reply')
    expect(wrapper.get('.composer-conversation__thread-summary').text()).toContain('Last reply:')
    expect(repliesApi.listReplies).toHaveBeenCalledWith({
      companyId: 'company-1',
      teamId: 'team-1',
      channelId: 'general',
      messageId: 'server-message-1',
    })

    await wrapper.get('textarea[aria-label="Reply"]').setValue('Reply from thread')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Send')
      .trigger('click')
    await vi.waitFor(() =>
      expect(repliesApi.sendReply).toHaveBeenCalledWith(
        {
          companyId: 'company-1',
          teamId: 'team-1',
          channelId: 'general',
          messageId: 'server-message-1',
        },
        { body: 'Reply from thread' },
      ),
    )
    expect(wrapper.text()).toContain('Reply from thread')
    expect(wrapper.get('.composer-conversation__thread-summary').text()).toContain('2 replies')
    wrapper.unmount()
  })

  it('restores a channel message and shows an error when the delete API fails', async () => {
    deleteChannelMessage.mockResolvedValue({
      success: false,
      error: 'The server rejected the delete request.',
    })
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Keep this message')

    const article = wrapper.get('article')
    await article.get('button[aria-label="More message actions"]').trigger('click')
    await article.get('.composer-conversation__delete-action').trigger('click')
    document.body.querySelector('.composer-conversation__delete-dialog .is-delete').click()
    await nextTick()

    await vi.waitFor(() => {
      expect(useUiStore().toasts).toContainEqual(
        expect.objectContaining({
          title: 'Message not deleted',
          body: 'The server rejected the delete request.',
          type: 'error',
        }),
      )
    })
    expect(wrapper.text()).toContain('Keep this message')
    expect(document.body.querySelector('.composer-conversation__delete-dialog')).not.toBeNull()
    expect(deleteChannelMessage).toHaveBeenCalledWith(
      'company-1',
      'team-1',
      'general',
      'server-message-1',
      'Keep this message',
    )
    wrapper.unmount()
  })

  it('uses the channel forward API for a direct-message recipient', async () => {
    const dms = useDmStore()
    await dms.init()
    vi.spyOn(dmApi, 'listMessages').mockResolvedValue([
      {
        id: 'forwarded-dm-message',
        from: 'u1',
        text: 'Forward this direct message',
        forwardedFrom: 'Aiman Iqbal in general',
        createdAt: '2026-11-05T10:00:00Z',
      },
    ])

    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Forward this direct message')
    const article = wrapper.get('article')
    await article.get('button[aria-label="More message actions"]').trigger('click')
    await buttonWithText(article.get('.composer-conversation__menu'), 'Forward').trigger('click')
    await wrapper.get('#forward-destination').setValue('c1')
    await wrapper.get('form.composer-conversation__forward-dialog').trigger('submit')
    await vi.waitFor(() => {
      expect(forwardChannelMessage).toHaveBeenCalledWith(
        'company-1',
        'team-1',
        'general',
        'server-message-1',
        { user_ids: ['u2'] },
      )
      expect(
        dms.conversations.find((conversation) => conversation.id === 'c1').messages,
      ).toContainEqual(
        expect.objectContaining({
          id: 'forwarded-dm-message',
          forwardedFrom: 'Aiman Iqbal in general',
        }),
      )
    })

    await wrapper.setProps({ conversationType: 'dm', conversationId: 'c1' })
    await nextTick()
    expect(wrapper.text()).toContain('(forwarded)')
    wrapper.unmount()
  })

  it('groups messages and loads older history in pages', async () => {
    const messages = useMessagesStore()
    messages.messagesByChannel.general = Array.from({ length: 21 }, (_, index) => ({
      id: `m${index}`,
      content: `History ${index}`,
      author: 'Teammate',
      authorId: 'teammate',
      mine: false,
      createdAt: new Date(Date.UTC(2026, 9, 28, 10, index)).toISOString(),
    }))
    const wrapper = mount(ComposerConversation)

    expect(wrapper.findAll('article')).toHaveLength(20)
    expect(wrapper.findAll('.composer-conversation__date')).toHaveLength(1)
    expect(wrapper.findAll('.composer-conversation__avatar')).toHaveLength(1)

    await wrapper.get('.composer-conversation__load-older').trigger('click')
    expect(wrapper.findAll('article')).toHaveLength(21)
    expect(wrapper.findAll('.composer-conversation__date')).toHaveLength(1)
  })

  it('shows scheduled message time and timezone in the conversation', async () => {
    const wrapper = mount(ComposerConversation)

    const editor = wrapper.get('[contenteditable="true"]')

    editor.element.textContent = 'Reminder'

    editor.element.dispatchEvent(new Event('input', { bubbles: true }))

    await nextTick()

    await wrapper.get('button[aria-label="Schedule message"]').trigger('click')

    await wrapper.get('.message-composer__schedule-choice').trigger('click')

    expect(wrapper.text()).toContain('Reminder')

    expect(wrapper.text()).toContain('Scheduled for')

    expect(wrapper.text()).toContain('Asia/Karachi')
  })

  it('shows delivery ticks after a scheduled message reaches its send time', async () => {
    const messages = useMessagesStore()
    const sentAt = new Date(Date.now() - 500)
    localStorage.setItem(
      'whistleit:composer-scheduled-messages',
      JSON.stringify({
        general: [
          {
            id: 'scheduled-1',
            body: 'Scheduled and sent',
            scheduled_at: new Date(sentAt.getTime() - 500).toISOString(),
            status: 'pending',
          },
        ],
      }),
    )
    messages.messagesByChannel.general = [
      {
        id: 'sent-1',
        content: 'Scheduled and sent',
        mine: true,
        author: 'You',
        createdAt: sentAt.toISOString(),
      },
    ]

    const wrapper = mount(ComposerConversation)
    await nextTick()

    expect(wrapper.get('[aria-label="Sent"]').text()).toBe('✓✓')
    expect(wrapper.text()).not.toContain('Scheduled for')
    expect(wrapper.findAll('.composer-conversation__message-bubble')).toHaveLength(1)
  })
})
