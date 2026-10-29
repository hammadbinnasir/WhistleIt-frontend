import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useActivityStore } from '@/stores/activity'
import { useDmStore } from '@/features/dms/stores/dms'
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

describe('ActivityFeed', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('opens a reply thread and sends a message from Recent DMs', async () => {
    const dms = useDmStore()
    const ui = useUiStore()
    ui.activePanel = 'activity'
    const wrapper = mount(ActivityFeed)
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
    const wrapper = mount(ActivityFeed)
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

  it('opens the related DM from All Mentions and marks it read', async () => {
    const dms = useDmStore()
    const activity = useActivityStore()
    const ui = useUiStore()
    await Promise.all([dms.init(), activity.init()])
    ui.activePanel = 'activity'

    const wrapper = mount(ActivityFeed)
    await wrapper.get('button[aria-label="Scroll tabs right"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'All Mentions')
      .trigger('click')
    expect(wrapper.text()).toContain('Ali Umais ne mention kiya')

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Ali Umais ne mention kiya'))
      .trigger('click')
    expect(dms.activeId).toBe('c2')
    expect(ui.activePanel).toBeNull()
    expect(activity.items.find((item) => item.id === 'n3').read).toBe(true)
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

    await wrapper.get('button[aria-label="Scroll tabs right"]').trigger('click')
    expect(nav.text()).toContain('All Mentions')
    expect(nav.text()).toContain('Workflows')
    expect(nav.text()).not.toContain('Recent DMs')
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
