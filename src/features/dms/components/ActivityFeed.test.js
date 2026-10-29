import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useActivityStore } from '@/stores/activity'
import { useDmStore } from '@/features/dms/stores/dms'
import { useMessagesStore } from '@/features/messages/messages'
import { useUiStore } from '@/stores/ui'
import { useRemindersStore } from '@/features/search/reminders'
import { useChannelsStore } from '@/features/channels/store/channels.store'
import ActivityFeed from './ActivityFeed.vue'

vi.mock('vue3-emoji-picker', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      setup() {
        return () => h('div')
      },
    }),
  }
})

function mountActivityFeed() {
  const dms = useDmStore()
  const ui = useUiStore()

  return mount(ActivityFeed, {
    attrs: {
      onOpenConversation: ({ id, type }) => {
        if (type === 'dm') {
          if (!dms.openConversation(id)) return
          ui.selectChannel(null)
        } else {
          dms.deactivateConversation()
          ui.selectChannel(id)
        }
        ui.closePanel()
      },
      onOpenUserChat: (userId) => {
        if (userId === dms.meId) return
        dms.startDm(userId)
        ui.selectChannel(null)
        ui.closePanel()
      },
    },
  })
}

describe('ActivityFeed', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps activity tab labels on one line', () => {
    const wrapper = mountActivityFeed()

    expect(wrapper.get('nav').classes()).toContain('flex-nowrap')
    expect(wrapper.get('nav button').classes()).toContain('whitespace-nowrap')
    wrapper.unmount()
  })

  it('opens a reply thread and sends a message from Recent DMs', async () => {
    const dms = useDmStore()
    const ui = useUiStore()
    ui.activePanel = 'activity'
    const wrapper = mountActivityFeed()
    await dms.init()

    expect(wrapper.text()).toContain('Muniba Naseer')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reply')
      .trigger('click')

    expect(wrapper.get('[aria-label="Reply thread"]').text()).toContain('Reply Thread')
    expect(ui.activePanel).toBe('activity')

    const editor = wrapper.get('[aria-label="Reply thread"] [contenteditable="true"]')
    editor.element.textContent = 'Reply from the thread'
    editor.element.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.get('[aria-label="Reply thread"] form').trigger('submit')

    const reply = dms.conversations.find((conversation) => conversation.id === 'c1').messages.at(-1)
    expect(reply).toMatchObject({
      text: 'Reply from the thread',
      threadId: 'm-c1',
      from: dms.meId,
    })
    expect(wrapper.get('[aria-label="Reply thread"]').text()).toContain('Reply from the thread')
    expect(
      wrapper.findAll('button').some((button) => ['Pin', 'Unpin'].includes(button.text().trim())),
    ).toBe(false)
    wrapper.unmount()
  })

  it('opens a reply thread from Recent Messages and has no pin action', async () => {
    const dms = useDmStore()
    const wrapper = mountActivityFeed()
    await dms.init()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Recent Messages')
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reply')
      .trigger('click')
    expect(wrapper.get('[aria-label="Reply thread"]').text()).toContain('Reply Thread')
    expect(
      wrapper.findAll('button').some((button) => ['Pin', 'Unpin'].includes(button.text().trim())),
    ).toBe(false)
    wrapper.unmount()
  })

  it('opens a channel from Recent Messages', async () => {
    const ui = useUiStore()
    const dms = useDmStore()
    await dms.init()
    dms.startDm('u2')
    const messages = useMessagesStore()
    messages.sendMessage('general', { content: 'Channel activity' }, 'You', 'General')
    const wrapper = mountActivityFeed()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Recent Messages')
      .trigger('click')

    expect(wrapper.text()).toContain('Channel activity')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Open')
      .trigger('click')
    expect(ui.selectedChannelId).toBe('general')
    expect(dms.activeId).toBeNull()
    expect(ui.activePanel).toBeNull()
    wrapper.unmount()
  })

  it('opens a direct message from the Recent DMs contact name', async () => {
    const dms = useDmStore()
    const ui = useUiStore()
    await dms.init()
    ui.selectChannel('general')
    ui.activePanel = 'activity'
    const wrapper = mountActivityFeed()

    await wrapper.get('[aria-label="Open direct message with Muniba Naseer"]').trigger('click')

    expect(dms.activeId).toBe('c1')
    expect(ui.activePanel).toBeNull()
    wrapper.unmount()
  })

  it('opens a direct message when an activity message author is clicked', async () => {
    const dms = useDmStore()
    const messages = useMessagesStore()
    const ui = useUiStore()
    await dms.init()
    ui.activePanel = 'activity'
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
    const wrapper = mountActivityFeed()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Recent Messages')
      .trigger('click')
    await wrapper.get('[aria-label="Open direct message with Muniba Naseer"]').trigger('click')

    expect(dms.activeId).toBe('c1')
    expect(ui.activePanel).toBeNull()
    wrapper.unmount()
  })

  it('shows and cancels scheduled messages', async () => {
    const dms = useDmStore()
    await dms.init()
    const conversation = dms.startDm('u2')
    dms.sendMessage(conversation.id, {
      content: 'Scheduled for later',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      timeZone: 'Asia/Karachi',
    })
    const wrapper = mount(ActivityFeed)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Scheduled Messages')
      .trigger('click')

    expect(wrapper.text()).toContain('Scheduled for later')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Cancel')
      .trigger('click')
    expect(conversation.messages.some((message) => message.scheduled)).toBe(false)
    wrapper.unmount()
  })

  it('shows the centered empty state when an activity list has no messages', async () => {
    const wrapper = mount(ActivityFeed)
    await useDmStore().init()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Scheduled Messages')
      .trigger('click')

    expect(wrapper.get('[role="status"]').text()).toContain('No Messages')
    expect(wrapper.get('[role="status"]').text()).toContain('You are all done.')
    wrapper.unmount()
  })

  it('shows upcoming reminders and lets the user delete them', async () => {
    const reminders = useRemindersStore()
    reminders.add({
      conversationId: 'c1',
      conversationName: 'Muniba Naseer',
      conversationType: 'dm',
      messageId: 'reminder-message',
      text: 'Follow up tomorrow',
      remindAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
    const wrapper = mount(ActivityFeed)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Upcoming Reminders')
      .trigger('click')

    expect(wrapper.text()).toContain('Follow up tomorrow')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Delete')
      .trigger('click')
    expect(reminders.sorted).toHaveLength(0)
    wrapper.unmount()
  })

  it('shows no mentions until a message mentions someone', async () => {
    const activity = useActivityStore()
    await activity.init()

    expect(activity.sorted.filter((item) => item.type === 'mention')).toHaveLength(0)

    const dms = useDmStore()
    await dms.init()
    dms.sendMessage('c1', { content: 'Please review this, @Aiman' })
    expect(activity.sorted[0]).toMatchObject({
      type: 'mention',
      title: 'You mentioned @Aiman',
      body: 'Please review this, @Aiman',
      conversationId: 'c1',
    })
  })

  it('opens the related DM from All Mentions and marks it read', async () => {
    const dms = useDmStore()
    const activity = useActivityStore()
    const ui = useUiStore()
    await Promise.all([dms.init(), activity.init()])
    dms.sendMessage('c1', { content: 'Hello @Muniba' })
    ui.activePanel = 'activity'

    const wrapper = mountActivityFeed()
    await wrapper.get('button[aria-label="Scroll tabs right"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('All Mentions'))
      .trigger('click')
    expect(wrapper.text()).toContain('You mentioned @Muniba')

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('You mentioned @Muniba'))
      .trigger('click')
    expect(dms.activeId).toBe('c1')
    expect(ui.activePanel).toBeNull()
    expect(activity.items.find((item) => item.type === 'mention').read).toBe(true)
    wrapper.unmount()
  })

  it('opens the related channel from All Mentions', async () => {
    const activity = useActivityStore()
    const messages = useMessagesStore()
    const ui = useUiStore()
    await activity.init()
    messages.sendMessage('general', { content: 'Please look, @Aiman' }, 'You', 'General')

    const wrapper = mountActivityFeed()
    await wrapper.get('button[aria-label="Scroll tabs right"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('All Mentions'))
      .trigger('click')
    expect(wrapper.text()).toContain('You mentioned @Aiman')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('You mentioned @Aiman'))
      .trigger('click')

    expect(ui.selectedChannelId).toBe('general')
    expect(ui.activePanel).toBeNull()
    expect(activity.sorted[0].read).toBe(true)
    wrapper.unmount()
  })

  it('shows pinned messages in the pinned message card layout', async () => {
    const ui = useUiStore()
    ui.activePanel = 'activity'
    const wrapper = mountActivityFeed()
    ui.togglePinnedMessage(
      {
        id: 'pinned-1',
        content: 'Pinned for the team https://example.com',
        author: 'Aiman Iqbal',
        createdAt: new Date().toISOString(),
      },
      { id: 'general', name: 'General', kind: 'public' },
    )
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Pinned Messages')
      .trigger('click')

    expect(wrapper.text()).toContain('Pinned for the team')
    expect(wrapper.text()).toContain('General')
    expect(wrapper.text()).toContain('PINNED')
    expect(wrapper.text()).toContain('Aiman Iqbal')
    expect(wrapper.text()).toContain('Reply')
    expect(wrapper.get('article').classes()).toContain('p-2.5')
    expect(wrapper.get('article .relative').attributes('style')).toContain('36px')
    expect(wrapper.get('article a').attributes('href')).toBe('https://example.com/')
    await wrapper.get('button[aria-label="Open pinned message conversation"]').trigger('click')
    expect(ui.selectedChannelId).toBe('general')
    expect(ui.activePanel).toBeNull()
    expect(ui.pinnedMessages).toHaveLength(1)
    wrapper.unmount()
  })

  it('opens the direct message when a pinned DM name is clicked', async () => {
    const dms = useDmStore()
    const ui = useUiStore()
    await dms.init()
    ui.selectChannel('general')
    ui.activePanel = 'activity'
    ui.togglePinnedMessage(
      {
        id: 'pinned-dm',
        content: 'A pinned direct message',
        from: 'u2',
        createdAt: new Date().toISOString(),
      },
      { id: 'c1', name: 'Muniba Naseer', type: 'dm' },
    )
    const wrapper = mountActivityFeed()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Pinned Messages')
      .trigger('click')

    await wrapper.get('[aria-label="Open direct message with Muniba Naseer"]').trigger('click')

    expect(dms.activeId).toBe('c1')
    expect(ui.selectedChannelId).toBeNull()
    expect(ui.activePanel).toBeNull()
    expect(ui.pinnedMessages).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows and cancels scheduled channel messages', async () => {
    const messages = useMessagesStore()
    const scheduled = messages.sendMessage(
      'general',
      {
        content: 'Scheduled channel post',
        scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      },
      'You',
      'General',
    )
    const wrapper = mount(ActivityFeed)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Scheduled Messages')
      .trigger('click')

    expect(wrapper.text()).toContain('Scheduled channel post')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Cancel')
      .trigger('click')
    expect(messages.messagesFor('general')).not.toContain(scheduled)
    wrapper.unmount()
  })

  it('creates and toggles a workflow from a template', async () => {
    const channels = useChannelsStore()
    channels.channels = [
      { id: 'channel-1', name: 'General', isDefault: true, isFavorite: false, isArchived: false },
    ]
    const activity = useActivityStore()
    const wrapper = mount(ActivityFeed)

    await wrapper.get('button[aria-label="Scroll tabs right"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Workflows')
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Create a recurring message'))
      .trigger('click')

    const form = wrapper.get('form')
    await form.get('input').setValue('Daily standup')
    await form.get('select').setValue('channel-1')
    await form.get('textarea').setValue('Standup starts now')
    await form.trigger('submit')

    expect(activity.workflows[0]).toMatchObject({
      name: 'Daily standup',
      channelName: 'General',
      message: 'Standup starts now',
      enabled: true,
    })
    activity.toggleWorkflow(activity.workflows[0].id)
    expect(activity.workflows[0].enabled).toBe(false)
    wrapper.unmount()
  })

  it('collapses and expands the All Workflows section', async () => {
    const wrapper = mount(ActivityFeed)
    await wrapper.get('button[aria-label="Scroll tabs right"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Workflows')
      .trigger('click')

    const toggle = wrapper.find('button[aria-controls="all-workflows-content"]')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#workflow-search').exists()).toBe(true)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#workflow-search').exists()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('#workflow-search').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows mentions and workflows on the next tab page and returns with the left arrow', async () => {
    const ui = useUiStore()
    ui.activePanel = 'activity'
    const wrapper = mount(ActivityFeed)
    const nav = wrapper.get('nav[aria-label="Activity views"]')
    expect(nav.text()).toContain('Upcoming Reminders')
    expect(nav.text()).not.toContain('All Mentions')
    expect(nav.text()).not.toContain('Workflows')
    expect(nav.findAll('button')).toHaveLength(5)

    await wrapper.get('button[aria-label="Scroll tabs right"]').trigger('click')
    expect(nav.text()).toContain('All Mentions')
    expect(nav.text()).toContain('Workflows')
    expect(nav.text()).not.toContain('Recent DMs')
    expect(nav.findAll('button')).toHaveLength(5)
    expect(
      wrapper.get('button[aria-label="Scroll tabs right"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.get('button[aria-label="Scroll tabs left"]').trigger('click')
    expect(nav.text()).toContain('Recent DMs')
    expect(nav.text()).not.toContain('Workflows')
    expect(
      wrapper.get('button[aria-label="Scroll tabs left"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.get('button[aria-label="Close activities"]').trigger('click')
    expect(ui.activePanel).toBeNull()
    wrapper.unmount()
  })
})
