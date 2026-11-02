import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRemindersStore } from './reminders'
import SetReminderModal from './SetReminderModal.vue'

describe('set reminder modal', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('saves a titled reminder for the selected message', async () => {
    const message = {
      conversationId: 'general',
      conversationName: 'General',
      conversationType: 'channel',
      messageId: 'message-1',
      text: 'Follow up with the team',
    }
    const wrapper = mount(SetReminderModal, { props: { message } })
    await wrapper.get('[aria-label="Reminder title"]').setValue('Team follow-up')
    await wrapper.get('form').trigger('submit')

    const reminders = useRemindersStore()
    expect(reminders.items).toHaveLength(1)
    expect(reminders.items[0]).toMatchObject({
      ...message,
      title: 'Team follow-up',
      fired: false,
    })
    expect(new Date(reminders.items[0].remindAt).getTime()).toBeGreaterThan(Date.now())
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
