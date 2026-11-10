import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/lib/api/client'
import { createReminder, deleteReminder, listReminders } from './remindersApi'

vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }))

describe('reminders API', () => {
  afterEach(() => vi.clearAllMocks())

  it('loads and normalizes reminders from the API', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        reminders: [
          {
            reminder_id: 8,
            conversation_id: 'channel-1',
            conversation_name: 'General',
            message_id: 'message-1',
            text: 'Follow up',
            remind_at: '2026-11-12T10:00:00Z',
          },
        ],
      },
    })

    await expect(listReminders()).resolves.toEqual([
      {
        reminder_id: 8,
        conversation_id: 'channel-1',
        conversation_name: 'General',
        message_id: 'message-1',
        text: 'Follow up',
        remind_at: '2026-11-12T10:00:00Z',
        id: '8',
        conversationId: 'channel-1',
        conversationName: 'General',
        conversationType: 'channel',
        messageId: 'message-1',
        title: '',
        remindAt: '2026-11-12T10:00:00Z',
        fired: false,
      },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/v1/reminders')
  })

  it('posts the reminder and deletes by encoded ID', async () => {
    const reminder = {
      conversationId: 'channel-1',
      conversationName: 'General',
      conversationType: 'channel',
      messageId: 'message-1',
      text: 'Follow up',
      title: 'Team follow-up',
      remindAt: '2026-11-12T10:00:00Z',
    }
    apiRequest
      .mockResolvedValueOnce({ success: true, data: { id: 8, remind_at: reminder.remindAt } })
      .mockResolvedValueOnce({ success: true })

    await expect(createReminder(reminder)).resolves.toMatchObject({
      id: '8',
      remindAt: reminder.remindAt,
    })
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/v1/reminders', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: 'channel-1',
        conversation_name: 'General',
        conversation_type: 'channel',
        message_id: 'message-1',
        text: 'Follow up',
        title: 'Team follow-up',
        remind_at: reminder.remindAt,
      }),
    })

    await deleteReminder('reminder/8')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/v1/reminders/reminder%2F8', {
      method: 'DELETE',
    })
  })

  it('treats a missing reminder as already deleted', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Reminder not found'), { status: 404 }))

    await expect(deleteReminder('missing-reminder')).resolves.toBeUndefined()
    expect(apiRequest).toHaveBeenCalledWith('/v1/reminders/missing-reminder', {
      method: 'DELETE',
    })
  })

  it('continues to report reminder delete errors other than not found', async () => {
    const error = Object.assign(new Error('Forbidden'), { status: 403 })
    apiRequest.mockRejectedValueOnce(error)

    await expect(deleteReminder('protected-reminder')).rejects.toBe(error)
  })
})
