import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChannelsStore } from '@/features/channels'
import { dmApi } from '@/features/dms/dmApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { useMessagesStore } from '@/features/messages/messages'
import { useRemindersStore } from '@/features/search/reminders'
import { useUiStore } from '@/stores/ui'
import { resetUserStore, useUserStore } from '@/features/account/composables/useUserStore'
import { setupDmsTestState } from '@/features/dms/test-utils'
import {
  getChannelMessages,
  sendChannelMessage,
  updateChannelMessage,
  deleteChannelMessage,
} from '@/features/messages/channelMessageService'

const emojiPickerProps = vi.hoisted(() => vi.fn())
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
vi.mock('@/features/channels/api/channels.api', async (importOriginal) => ({
  ...(await importOriginal()),
  pinMessage: pinApi.pinMessage,
  unpinMessage: pinApi.unpinMessage,
}))

vi.mock('@/features/messages/channelMessageService', () => ({
  getChannelMessages: vi.fn(),
  sendChannelMessage: vi.fn(),
  updateChannelMessage: vi.fn(),
  deleteChannelMessage: vi.fn(),
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

import ComposerConversation from './ComposerConversation.vue'
import MessageComposer from './MessageComposer.vue'

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
    getChannelMessages.mockReset()
    getChannelMessages.mockResolvedValue({
      success: true,
      data: { success: true, data: { messages: [] } },
    })
    sendChannelMessage.mockReset()
    updateChannelMessage.mockReset()
    updateChannelMessage.mockResolvedValue({ success: true, data: {} })
    deleteChannelMessage.mockReset()
    deleteChannelMessage.mockResolvedValue({ success: true, data: null })
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

  it('shows the restriction notice to members and the composer to channel admins in creator-only mode', async () => {
    sessionStorage.setItem('authUser', JSON.stringify({ id: 'member-1' }))
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
    expect(wrapper.findComponent(MessageComposer).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Only certain people can post in this channel.')
    wrapper.unmount()
  })

  it('shows the composer to selected members and admins, with a restriction notice to others', async () => {
    sessionStorage.setItem('authUser', JSON.stringify({ id: 'member-1' }))
    const channels = useChannelsStore()
    channels.upsertChannel({
      id: 'selected-channel',
      name: 'Selected',
      isMember: true,
      createdById: 'creator-1',
      canManage: false,
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
    sessionStorage.setItem('authUser', JSON.stringify({ id: 'member-1' }))
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
    sessionStorage.setItem('authUser', JSON.stringify({ id: 'outsider' }))
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

  it('shows the composer to channel admins in all message permission modes', async () => {
    sessionStorage.setItem('authUser', JSON.stringify({ id: 'admin-1' }))
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
      expect(wrapper.findComponent(MessageComposer).exists()).toBe(true)
    }

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
    expect(getChannelMessages).toHaveBeenNthCalledWith(
      2,
      'company-1',
      'team-1',
      'channel-1',
      { page: 2, perPage: 15 },
    )
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
    const sendDmMessage = vi.spyOn(dmApi, 'sendMessage').mockImplementation(
      async (_companyId, channelId, payload) => ({
        id: 'important-dm-server-message',
        from: dms.meId,
        text: payload.body,
        createdAt: new Date().toISOString(),
        is_important: payload.is_important,
        channelId,
      }),
    )
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: 'important-dm', conversationType: 'dm' },
    })

    await wrapper.findComponent(MessageComposer).get('button[aria-label="Important message"]').trigger('click')
    await sendMessage(wrapper, 'Urgent direct message')
    await vi.waitFor(() =>
      expect(dms.conversations[0].messages.at(-1).id).toBe('important-dm-server-message'),
    )

    expect(sendDmMessage).toHaveBeenCalledWith(
      'company-1',
      'important-dm',
      { body: 'Urgent direct message', is_important: true },
    )
    expect(wrapper.text()).toContain('IMPORTANT!')
    wrapper.unmount()
    sendDmMessage.mockRestore()
  })

  it('opens the message action menu on left click when configured', async () => {
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Click for actions')

    await wrapper.get('.composer-conversation__message-bubble').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 275))

    expect(wrapper.find('.composer-conversation__menu').exists()).toBe(true)
  })

  it('opens the reminder dialog on double click when configured', async () => {
    useUserStore().hydrate({ preferences: { doubleClick: 'reminder' } })
    const wrapper = mount(ComposerConversation)
    await sendMessage(wrapper, 'Remind me about this')

    await wrapper.get('.composer-conversation__message-bubble').trigger('dblclick')

    expect(wrapper.get('[aria-label="Reminder title"]').exists()).toBe(true)
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
    await vi.waitFor(() => expect(wrapper.find('.composer-conversation__poll-card').exists()).toBe(true))

    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Lunch vote')
    expect(document.querySelector('[role="dialog"][aria-labelledby="message-poll-title"]')).toBeNull()
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
    await wrapper.get('.composer-conversation__poll-actions button:last-child').trigger('click')
    await vi.waitFor(() => expect(pollsApi.closePoll).toHaveBeenCalledOnce())
    expect(wrapper.get('.composer-conversation__poll-card').text()).toContain('Closed')
  })

  it('sends and stores a created poll in the active DM conversation', async () => {
    const dms = useDmStore()
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
    expect(dms.conversations[0].messages[0].poll.title).toBe('DM poll')
    expect(wrapper.text()).toContain('DM poll')
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
      attachments: [],
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
    await vi.waitFor(() => expect(document.querySelector('textarea[aria-label="Response to question 1"]')).not.toBeNull())
    const response = document.querySelector('textarea[aria-label="Response to question 1"]')
    expect(response).not.toBeNull()
    response.value = 'Improve documentation'
    response.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    document.querySelector('.composer-conversation__poll-response-footer button').click()
    await vi.waitFor(() => expect(pollsApi.submitPollAnswer).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(wrapper.text()).toContain("You're Done"))

    expect(wrapper.text()).toContain("You're Done")
    expect(pollsApi.submitPollAnswer).toHaveBeenCalledWith({
      channel_id: 'general',
      poll_id: 'open-ended-poll',
      answers: { 'open-question-1': 'Improve documentation' },
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('View All Results'))
      .trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('Improve documentation')
    const closeButton = document.querySelector(
      '.composer-conversation__poll-response-footer .is-close',
    )
    expect(closeButton).not.toBeNull()
    closeButton.click()
    await nextTick()
    expect(document.querySelector('.composer-conversation__poll-response-modal')).toBeNull()
    wrapper.unmount()
  })

  it('shows scheduled poll start and end times before participation', async () => {
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

    expect(wrapper.text()).toContain('Starts')
    expect(wrapper.text()).toContain('Ends')
    expect(wrapper.text()).toContain('Scheduled')
    expect(wrapper.text()).not.toContain('Participate')
    expect(wrapper.text()).not.toContain('View All Results')
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

    expect(wrapper.text()).toContain('Which option?')
    expect(wrapper.findAll('.composer-conversation__poll-actions button').some((button) =>
      button.text().includes('Close Poll'),
    )).toBe(false)
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
    expect(messages.messagesByChannel.general[0].poll.id).toBe('server-poll-migrated')
    expect(wrapper.get('.composer-conversation__poll-card').attributes('data-poll-id')).toBe(
      'server-poll-migrated',
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

  it('shows the signed-in user name instead of You for DM messages', async () => {
    sessionStorage.setItem('authUser', JSON.stringify({ id: 'u1', fullName: 'Aiman Iqbal' }))
    const dms = useDmStore()
    await dms.init()
    dms.users = dms.users.filter((user) => user.id !== dms.meId)
    const conversation = await dms.startDm('u2')
    const wrapper = mount(ComposerConversation, {
      props: { conversationId: conversation.id, conversationType: 'dm' },
    })

    await sendMessage(wrapper, 'Name should be visible')

    expect(wrapper.text()).toContain('Aiman Iqbal')
    expect(wrapper.text()).not.toContain('You')
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
    expect(article.find('.composer-conversation__message-heading .composer-conversation__edited').exists()).toBe(
      false,
    )
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
      expect(sendChannelMessage).toHaveBeenLastCalledWith(
        'company-1',
        'team-1',
        'random',
        {
          content: 'Forward this update',
          forwardedFrom: 'You in general',
        },
      )
    })
    expect(messages.messagesFor('random')).toContainEqual(
      expect.objectContaining({
        serverBacked: true,
        forwardedFrom: 'You in general',
        id: expect.any(String),
      }),
    )

    await wrapper.setProps({ conversationId: 'random' })
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('(forwarded)')
      expect(wrapper.text()).not.toContain('Forwarded from')
    })
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

  it('shows a selected GIF as a conversation message', async () => {
    const wrapper = mount(ComposerConversation)
    const gif = { title: 'Celebration', url: 'https://example.com/celebration.gif' }

    wrapper.findComponent(MessageComposer).vm.$emit('gif', gif)
    await nextTick()

    expect(wrapper.get('img[alt="Celebration"]').attributes('src')).toBe(gif.url)
  })
})
