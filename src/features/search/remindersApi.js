import { apiRequest } from '@/lib/api/client'

const REMINDERS_PATH = '/v1/reminders'

function payloadOf(response) {
  return response?.data?.data ?? response?.data ?? response
}

function isDirectConversationType(value) {
  return [
    'dm',
    'direct',
    'direct_channel',
    'direct-channel',
    'direct_message',
    'direct-message',
  ].includes(String(value ?? '').toLowerCase())
}

function normalizeReminder(raw = {}) {
  const reminder = raw.reminder ?? raw
  const id = reminder.id ?? reminder.reminder_id
  if (id == null) throw new Error('A reminder response is missing its ID.')

  const directChannelId =
    reminder.direct_channel_id ?? reminder.directChannelId ?? reminder.direct_channel?.id
  const conversationType =
    isDirectConversationType(reminder.conversationType ?? reminder.conversation_type) ||
    directChannelId != null
      ? 'dm'
      : 'channel'
  const remindAt =
    reminder.remindAt ?? reminder.remind_at ?? reminder.reminder_at ?? reminder.scheduled_at
  if (!remindAt) throw new Error('A reminder response is missing its scheduled time.')

  return {
    ...reminder,
    id: String(id),
    conversationId: String(
      reminder.conversationId ??
        (conversationType === 'dm' ? directChannelId : null) ??
        reminder.conversation_id ??
        reminder.channel_id ??
        directChannelId ??
        'general',
    ),
    conversationName:
      reminder.conversationName ??
      reminder.conversation_name ??
      reminder.channel_name ??
      reminder.name ??
      'Conversation',
    conversationType: conversationType === 'dm' ? 'dm' : 'channel',
    messageId: String(reminder.messageId ?? reminder.message_id ?? ''),
    text: reminder.text ?? reminder.message ?? reminder.content ?? '',
    title: reminder.title ?? '',
    remindAt,
    fired: Boolean(reminder.fired),
  }
}

function reminderList(response) {
  const payload = payloadOf(response)
  const items = Array.isArray(payload)
    ? payload
    : (payload?.reminders ?? payload?.items ?? payload?.data)
  if (!Array.isArray(items)) throw new Error('The server returned an invalid reminders list.')
  return items.map(normalizeReminder)
}

export async function listReminders() {
  return reminderList(await apiRequest(REMINDERS_PATH))
}

export async function createReminder(reminder) {
  const response = await apiRequest(REMINDERS_PATH, {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: reminder.conversationId,
      ...(reminder.conversationType === 'dm' ? { direct_channel_id: reminder.conversationId } : {}),
      conversation_name: reminder.conversationName,
      conversation_type: reminder.conversationType,
      message_id: reminder.messageId,
      text: reminder.text,
      title: reminder.title,
      remind_at: reminder.remindAt,
    }),
  })
  const payload = payloadOf(response)
  if (!payload || typeof payload !== 'object') return null
  const created = payload.reminder ?? payload
  return created.id != null || created.reminder_id != null
    ? normalizeReminder({ ...reminder, ...created })
    : null
}

export async function deleteReminder(id) {
  try {
    await apiRequest(`${REMINDERS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  } catch (error) {
    if (error?.status !== 404) throw error
  }
}
