import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRemindersStore } from './reminders'
import { useChannelsStore } from '@/features/channels'
import RemindersPanel from './RemindersPanel.vue'

const api = vi.hoisted(() => ({
  createReminder: vi.fn(),
  deleteReminder: vi.fn(),
  listReminders: vi.fn(),
}))
vi.mock('./remindersApi', () => api)

describe('reminders panel conversation scope', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    api.createReminder.mockReset().mockImplementation(async (reminder) => ({
      ...reminder,
      id: `server-${Math.random()}`,
      fired: false,
    }))
    api.deleteReminder.mockReset().mockResolvedValue()
  })

  it('shows only reminders belonging to the open DM, including deleted reminders', async () => {
    const store = useRemindersStore()
    const remindAt = new Date(Date.now() + 60_000).toISOString()
    await store.add({
      conversationId: 'same-id',
      conversationName: 'Hammad',
      conversationType: 'dm',
      messageId: 'dm-message',
      text: 'DM reminder',
      remindAt,
    })
    await store.add({
      conversationId: 'same-id',
      conversationName: 'Channel',
      conversationType: 'channel',
      messageId: 'channel-message',
      text: 'Channel reminder',
      remindAt,
    })

    const channelReminderId = store.items.find((item) => item.text === 'Channel reminder').id
    await store.remove(channelReminderId)

    const wrapper = mount(RemindersPanel, {
      props: { conversationId: 'same-id', conversationType: 'dm' },
    })

    expect(wrapper.text()).toContain('DM reminder')
    expect(wrapper.text()).not.toContain('Channel reminder')
  })

  it('shows only reminders belonging to the open channel', async () => {
    useChannelsStore().upsertChannel({
      id: 'channel-1',
      name: 'Channel One',
      isMember: true,
    })
    const store = useRemindersStore()
    const remindAt = new Date(Date.now() + 60_000).toISOString()
    await store.add({
      conversationId: 'channel-1',
      conversationName: 'Channel One',
      conversationType: 'channel',
      messageId: 'channel-one-message',
      text: 'Channel one reminder',
      remindAt,
    })
    await store.add({
      conversationId: 'dm-1',
      conversationName: 'Hammad',
      conversationType: 'dm',
      messageId: 'dm-message',
      text: 'DM reminder',
      remindAt,
    })

    const wrapper = mount(RemindersPanel, {
      props: { conversationId: 'channel-1', conversationType: 'channel' },
    })

    expect(wrapper.text()).toContain('Channel one reminder')
    expect(wrapper.text()).toContain('@Channel One')
    expect(wrapper.text()).not.toContain('DM reminder')
  })

  it('resolves channel IDs to channel names for reminders loaded from the API', () => {
    useChannelsStore().upsertChannel({
      id: 'channel-2',
      name: 'Product Updates',
      isMember: true,
    })
    const store = useRemindersStore()
    store.items.push({
      id: 'api-reminder',
      conversationId: 'channel-2',
      conversationName: 'channel-2',
      conversationType: 'channel',
      text: 'Release notes',
      remindAt: new Date(Date.now() + 60_000).toISOString(),
    })

    const wrapper = mount(RemindersPanel)

    expect(wrapper.text()).toContain('@Product Updates')
    expect(wrapper.text()).not.toContain('@channel-2')
  })

  it('keeps reminder titles visible after the reminder fires', () => {
    const store = useRemindersStore()
    store.deletedItems.push({
      id: 'fired-reminder',
      conversationId: 'channel-1',
      conversationName: 'Channel One',
      conversationType: 'channel',
      messageId: 'message-1',
      title: 'Follow up with the team',
      text: 'Send the update',
      remindAt: new Date(Date.now() - 60_000).toISOString(),
      fired: true,
      firedAt: new Date().toISOString(),
      dismissed: false,
    })

    const wrapper = mount(RemindersPanel, {
      props: { conversationId: 'channel-1', conversationType: 'channel' },
    })

    expect(wrapper.text()).toContain('Deleted Reminders')
    expect(wrapper.text()).toContain('Title: Follow up with the team')
    expect(wrapper.text()).toContain('Send the update')
  })
})
