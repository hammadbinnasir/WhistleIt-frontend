import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '@/lib/api/client'
import { repliesApi } from './Repliesapi'

const dm = { companyId: 'company-1', channelId: 'channel-1', messageId: 'm1' }
const team = { companyId: 'company-1', teamId: 'team-1', channelId: 'general', messageId: 'm1' }

describe('Replies API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists replies of a direct message', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { replies: [{ id: 'r1', sender_id: 'user-2', body: 'Reply', created_at: 'T1' }] },
    })

    await expect(repliesApi.listReplies(dm)).resolves.toMatchObject([
      { id: 'r1', from: 'user-2', text: 'Reply', createdAt: 'T1' },
    ])
    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/direct-channels/channel-1/messages/m1/replies',
    )
  })

  it('lists replies of a team channel message', async () => {
    apiRequest.mockResolvedValue({ success: true, data: [{ id: 'r2', user_id: 'u3', content: 'Hi' }] })

    await expect(repliesApi.listReplies(team)).resolves.toMatchObject([
      { id: 'r2', from: 'u3', text: 'Hi' },
    ])
    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/teams/team-1/channels/general/messages/m1/replies',
    )
  })

  it('lists replies from nested API response envelopes', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        success: true,
        data: {
          replies: [{ reply_id: 'r3', sender_id: 'u4', body: 'Nested reply' }],
        },
      },
    })

    await expect(repliesApi.listReplies(team)).resolves.toMatchObject([
      { id: 'r3', from: 'u4', text: 'Nested reply' },
    ])
  })

  it('reports malformed reply list responses instead of showing an empty thread', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { unexpected: [] } })

    await expect(repliesApi.listReplies(team)).rejects.toThrow(
      'The server returned an invalid replies response.',
    )
  })

  it('URL-encodes every ID in the replies path', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { replies: [] } })

    await repliesApi.listReplies({
      companyId: 'company 1',
      teamId: 'team/1',
      channelId: 'ch 1',
      messageId: 'm/1',
    })

    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company%201/teams/team%2F1/channels/ch%201/messages/m%2F1/replies',
    )
  })

  it('sends a reply to a direct message', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { reply: { id: 'r9', sender_id: 'user-1', body: 'Thanks' } },
    })

    await expect(repliesApi.sendReply(dm, { body: 'Thanks' })).resolves.toMatchObject({
      id: 'r9',
      from: 'user-1',
      text: 'Thanks',
    })
    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/direct-channels/channel-1/messages/m1/replies',
      { method: 'POST', body: JSON.stringify({ body: 'Thanks' }) },
    )
  })

  it('sends a reply to a team channel message', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { message: { id: 'r10', body: 'Ok' } } })

    await expect(repliesApi.sendReply(team, { body: 'Ok' })).resolves.toMatchObject({
      id: 'r10',
      text: 'Ok',
    })
    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/teams/team-1/channels/general/messages/m1/replies',
      { method: 'POST', body: JSON.stringify({ body: 'Ok' }) },
    )
  })

  it('returns null when the send response has no reply', async () => {
    apiRequest.mockResolvedValue({ success: true, data: null })

    await expect(repliesApi.sendReply(dm, { body: 'x' })).resolves.toBeNull()
  })

  it('surfaces API errors', async () => {
    apiRequest.mockResolvedValue({ success: false, message: 'Message not found.' })

    await expect(repliesApi.listReplies(dm)).rejects.toThrow('Message not found.')
  })

  it('requires company, channel and message IDs', () => {
    expect(() => repliesApi.listReplies({ ...dm, companyId: '' })).toThrow(
      'A company ID is required to load replies.',
    )
    expect(() => repliesApi.listReplies({ ...dm, channelId: '' })).toThrow(
      'A channel ID is required to load replies.',
    )
    expect(() => repliesApi.sendReply({ ...dm, messageId: '' }, { body: 'x' })).toThrow(
      'A message ID is required to send a reply.',
    )
    expect(apiRequest).not.toHaveBeenCalled()
  })
})