import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/features/channels/api/http'
import {
  deleteChannelMessage,
  forwardChannelMessage,
  getChannelMessage,
  getChannelMessages,
  sendChannelMessage,
  updateChannelMessage,
} from './channelMessageService'

vi.mock('@/features/channels/api/http', () => ({ http: vi.fn() }))

const collectionPath = '/v1/company-1/teams/team-2/channels/channel-3/messages'
const messagePath = `${collectionPath}/message-4`

describe('channel message service', () => {
  beforeEach(() => {
    http.mockReset()
    http.mockResolvedValue({ id: 'message-4', content: 'Hello' })
  })

  it('gets messages for a channel', async () => {
    const data = [{ id: 'message-4', content: 'Hello' }]
    http.mockResolvedValue(data)

    await expect(getChannelMessages('company-1', 'team-2', 'channel-3')).resolves.toEqual({
      success: true,
      data,
    })
    expect(http).toHaveBeenCalledWith(collectionPath, {
      params: { include_deleted: true, page: 1, per_page: 15 },
    })
  })

  it('requests a specific channel message page', async () => {
    await getChannelMessages('company-1', 'team-2', 'channel-3', { page: 3, perPage: 15 })

    expect(http).toHaveBeenCalledWith(collectionPath, {
      params: { include_deleted: true, page: 3, per_page: 15 },
    })
  })

  it('gets one message using encoded path parameters', async () => {
    await getChannelMessage('company/1', 'team 2', 'channel-3', 'message?4')

    expect(http).toHaveBeenCalledWith(
      '/v1/company%2F1/teams/team%202/channels/channel-3/messages/message%3F4',
    )
  })

  it('sends message content using the backend body field', async () => {
    const payload = { content: 'Hello', messageType: 'text' }

    await expect(sendChannelMessage('company-1', 'team-2', 'channel-3', payload)).resolves.toEqual({
      success: true,
      data: { id: 'message-4', content: 'Hello' },
    })
    expect(http).toHaveBeenCalledWith(collectionPath, {
      method: 'POST',
      body: { messageType: 'text', body: 'Hello' },
    })
  })

  it('sends code-mode metadata using the backend is_code field', async () => {
    await sendChannelMessage('company-1', 'team-2', 'channel-3', {
      content: 'const answer = 42',
      isCode: true,
    })

    expect(http).toHaveBeenCalledWith(collectionPath, {
      method: 'POST',
      body: { is_code: true, body: 'const answer = 42' },
    })
  })

  it('sends message text and attached files together as multipart data', async () => {
    const attachment = new File(['report'], 'report.txt', { type: 'text/plain' })

    await sendChannelMessage('company-1', 'team-2', 'channel-3', {
      content: 'Please review this file',
      attachment,
      is_important: false,
    })

    const [, options] = http.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('body')).toBe('Please review this file')
    expect(options.body.get('message')).toBeNull()
    expect(options.body.get('attachment')).toBeInstanceOf(File)
    expect(options.body.get('attachment').name).toBe('report.txt')
    expect(options.body.get('is_important')).toBe('0')
  })

  it('sends an attachment without adding an empty message field', async () => {
    const attachment = new File(['report'], 'report.txt', { type: 'text/plain' })

    await sendChannelMessage('company-1', 'team-2', 'channel-3', {
      content: '',
      attachment,
    })

    const [, options] = http.mock.calls[0]
    expect(options.body.get('body')).toBeNull()
    expect(options.body.get('attachment')).toBeInstanceOf(File)
    expect(options.body.get('attachment').name).toBe('report.txt')
  })

  it('sends a prepared recent file as multipart binary data without a file ID', async () => {
    const file = new File(['report'], 'report.pdf', { type: 'application/pdf' })
    await sendChannelMessage('company-1', 'team-2', 'channel-3', {
      content: 'Please see this',
      attachment: file,
      attachmentSource: 'recent',
      is_important: false,
    })

    expect(http).toHaveBeenCalledWith(collectionPath, {
      method: 'POST',
      body: expect.any(FormData),
    })
    const body = http.mock.calls[0][1].body
    expect(body.get('file')).toBeInstanceOf(File)
    expect(body.get('file').name).toBe('report.pdf')
    expect(body.get('companyId')).toBe('company-1')
    expect(body.get('chatId')).toBe('channel-3')
    expect(body.get('fileName')).toBe('report.pdf')
    expect(body.get('body')).toBe('Please see this')
    expect(body.get('is_important')).toBe('0')
    expect(body.get('attachmentSource')).toBeNull()
    expect(body.get('fileId')).toBeNull()
    expect(body.get('file_id')).toBeNull()
    expect(body.get('attachment')).toBeNull()
  })

  it('updates a message with the provided patch body', async () => {
    const payload = { content: 'Updated' }

    await updateChannelMessage('company-1', 'team-2', 'channel-3', 'message-4', payload)

    expect(http).toHaveBeenCalledWith(messagePath, {
      method: 'PATCH',
      body: { body: 'Updated' },
    })
  })

  it('soft-deletes a message so its placeholder remains visible', async () => {
    await deleteChannelMessage('company-1', 'team-2', 'channel-3', 'message-4', 'Hello')

    expect(http).toHaveBeenCalledWith(messagePath, {
      method: 'PATCH',
      body: { body: 'Hello', is_deleted: true },
    })
  })

  it('treats a backend rejection in an HTTP 200 response as a failed deletion', async () => {
    http.mockResolvedValue({
      success: true,
      data: {
        success: false,
        message: 'Message cannot be deleted.',
      },
    })

    await expect(
      deleteChannelMessage('company-1', 'team-2', 'channel-3', 'message-4', 'Hello'),
    ).resolves.toEqual({ success: false, error: 'Message cannot be deleted.' })

    expect(http).toHaveBeenCalledWith(messagePath, {
      method: 'DELETE',
      body: { body: 'Hello' },
    })
  })

  it('does not send a delete request without a non-empty message body', async () => {
    await expect(
      deleteChannelMessage('company-1', 'team-2', 'channel-3', 'message-4', ' '),
    ).resolves.toEqual({
      success: false,
      error: 'Message body is required to delete a channel message.',
    })
    expect(http).not.toHaveBeenCalled()
  })

  it('forwards a channel message using the specified destinations', async () => {
    const destinations = { channel_ids: ['channel-8'], user_ids: ['user-2'] }

    await expect(
      forwardChannelMessage('company-1', 'team-2', 'channel-3', 'message-4', destinations),
    ).resolves.toMatchObject({ success: true })

    expect(http).toHaveBeenCalledWith(`${messagePath}/forward`, {
      method: 'POST',
      body: destinations,
    })
  })

  it('encodes message IDs and rejects missing forward destinations', async () => {
    await forwardChannelMessage('company/1', 'team 2', 'channel-3', 'message?4', {
      channel_ids: ['channel-8'],
      user_ids: ['user-2'],
    })
    expect(http).toHaveBeenCalledWith(
      '/v1/company%2F1/teams/team%202/channels/channel-3/messages/message%3F4/forward',
      {
        method: 'POST',
        body: { channel_ids: ['channel-8'], user_ids: ['user-2'] },
      },
    )

    http.mockClear()
    await expect(
      forwardChannelMessage('company-1', 'team-2', 'channel-3', 'message-4', {}),
    ).resolves.toEqual({
      success: false,
      error: 'At least one forward destination is required.',
    })
    expect(http).not.toHaveBeenCalled()
  })

  it('rejects forwards without recipient user IDs', async () => {
    await expect(
      forwardChannelMessage('company-1', 'team-2', 'channel-3', 'message-4', {
        channel_ids: ['channel-8'],
      }),
    ).resolves.toEqual({
      success: false,
      error: 'At least one forward recipient is required.',
    })
    expect(http).not.toHaveBeenCalled()
  })

  it('returns a consistent error response when the API request fails', async () => {
    http.mockRejectedValue(new Error('Message not found'))

    await expect(
      getChannelMessage('company-1', 'team-2', 'channel-3', 'message-4'),
    ).resolves.toEqual({ success: false, error: 'Message not found' })
  })

  it('handles non-Error rejections', async () => {
    http.mockRejectedValueOnce('Gateway timeout')
    await expect(getChannelMessages('company-1', 'team-2', 'channel-3')).resolves.toEqual({
      success: false,
      error: 'Gateway timeout',
    })

    http.mockRejectedValueOnce({})
    await expect(getChannelMessages('company-1', 'team-2', 'channel-3')).resolves.toEqual({
      success: false,
      error: 'The channel message request failed.',
    })
  })

  it('returns a consistent error response for missing path parameters', async () => {
    const result = await getChannelMessages('company-1', 'team-2', '')

    expect(result).toEqual({
      success: false,
      error: 'Company, team, and channel IDs are required.',
    })
    expect(http).not.toHaveBeenCalled()
  })

  it('requires a message ID for single-message operations', async () => {
    const message = 'Company, team, channel, and message IDs are required.'

    await expect(getChannelMessage('company-1', 'team-2', 'channel-3')).resolves.toEqual({
      success: false,
      error: message,
    })
    await expect(
      updateChannelMessage('company-1', 'team-2', 'channel-3', ' ', { content: 'x' }),
    ).resolves.toEqual({ success: false, error: message })
    await expect(deleteChannelMessage('company-1', 'team-2', 'channel-3', null)).resolves.toEqual({
      success: false,
      error: message,
    })
    expect(http).not.toHaveBeenCalled()
  })

  it('requires collection IDs when sending a message', async () => {
    await expect(sendChannelMessage('', 'team-2', 'channel-3', { content: 'Hi' })).resolves.toEqual(
      {
        success: false,
        error: 'Company, team, and channel IDs are required.',
      },
    )
    expect(http).not.toHaveBeenCalled()
  })

  it('rejects invalid send payloads before calling the API', async () => {
    const send = (payload) => sendChannelMessage('company-1', 'team-2', 'channel-3', payload)

    await expect(send(undefined)).resolves.toMatchObject({ success: false })
    await expect(send([])).resolves.toMatchObject({ success: false })
    await expect(send({})).resolves.toEqual({
      success: false,
      error: 'Message content is required.',
    })
    await expect(send({ content: '   ' })).resolves.toEqual({
      success: false,
      error: 'Message content must be a non-empty string.',
    })
    await expect(send({ content: 'Hi', messageType: 5 })).resolves.toEqual({
      success: false,
      error: 'Message type must be a string.',
    })
    await expect(send({ content: 'Hi', parentMessageId: 12 })).resolves.toEqual({
      success: false,
      error: 'Parent message ID must be a string or null.',
    })
    await expect(send({ content: 'Hi', attachment: {} })).resolves.toEqual({
      success: false,
      error: 'Message attachment must be a file.',
    })
    await expect(send({ content: 'Hi', attachments: [] })).resolves.toEqual({
      success: false,
      error: 'Only one message attachment is supported.',
    })
    expect(http).not.toHaveBeenCalled()
  })

  it('accepts a null parentMessageId and rejects empty patch bodies', async () => {
    await expect(
      sendChannelMessage('company-1', 'team-2', 'channel-3', {
        content: 'Reply',
        parentMessageId: null,
      }),
    ).resolves.toMatchObject({ success: true })

    await expect(
      updateChannelMessage('company-1', 'team-2', 'channel-3', 'message-4', {}),
    ).resolves.toEqual({
      success: false,
      error: 'At least one field is required to update a message.',
    })
    await expect(
      updateChannelMessage('company-1', 'team-2', 'channel-3', 'message-4', { content: '' }),
    ).resolves.toMatchObject({ success: false })
    expect(http).toHaveBeenCalledTimes(1)
  })
})
