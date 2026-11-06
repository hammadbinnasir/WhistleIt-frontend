import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRemindersStore } from './reminders'
import RemindersPanel from './RemindersPanel.vue'

describe('reminders panel conversation scope', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('shows only reminders belonging to the open DM, including deleted reminders', () => {
    const store = useRemindersStore()
    const remindAt = new Date(Date.now() + 60_000).toISOString()
    store.add({
      conversationId: 'same-id',
      conversationName: 'Hammad',
      conversationType: 'dm',
      messageId: 'dm-message',
      text: 'DM reminder',
      remindAt,
    })
    store.add({
      conversationId: 'same-id',
      conversationName: 'Channel',
      conversationType: 'channel',
      messageId: 'channel-message',
      text: 'Channel reminder',
      remindAt,
    })

    const channelReminderId = store.items.find((item) => item.text === 'Channel reminder').id
    store.remove(channelReminderId)

    const wrapper = mount(RemindersPanel, {
      props: { conversationId: 'same-id', conversationType: 'dm' },
    })

    expect(wrapper.text()).toContain('DM reminder')
    expect(wrapper.text()).not.toContain('Channel reminder')
  })

  it('shows only reminders belonging to the open channel', () => {
    const store = useRemindersStore()
    const remindAt = new Date(Date.now() + 60_000).toISOString()
    store.add({
      conversationId: 'channel-1',
      conversationName: 'Channel One',
      conversationType: 'channel',
      messageId: 'channel-one-message',
      text: 'Channel one reminder',
      remindAt,
    })
    store.add({
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
    expect(wrapper.text()).not.toContain('DM reminder')
  })
})
