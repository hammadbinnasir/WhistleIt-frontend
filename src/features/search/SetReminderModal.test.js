import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRemindersStore } from './reminders'
import SetReminderModal from './SetReminderModal.vue'

const api = vi.hoisted(() => ({
  createReminder: vi.fn(),
  deleteReminder: vi.fn(),
  listReminders: vi.fn(),
}))
vi.mock('./remindersApi', () => api)

describe('set reminder modal', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    api.createReminder.mockReset().mockImplementation(async (reminder) => ({
      ...reminder,
      id: 'server-reminder-1',
      fired: false,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
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
    await vi.waitFor(() => expect(useRemindersStore().items).toHaveLength(1))

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

  it('disables saving when the selected time passes while the modal stays open', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T10:00:00'))
    const wrapper = mount(SetReminderModal, {
      props: {
        message: {
          conversationId: 'general',
          messageId: 'message-2',
          text: 'Follow up',
        },
      },
    })

    vi.setSystemTime(new Date('2026-11-10T10:21:00'))
    await vi.advanceTimersByTimeAsync(1000)

    expect(wrapper.get('.reminder-save').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Choose a date and time in the future.')
    expect(api.createReminder).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
