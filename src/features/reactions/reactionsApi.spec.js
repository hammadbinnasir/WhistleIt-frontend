import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '@/lib/api/client'
import { reactionsApi } from './reactionsApi'

const dm = { companyId: 'company-1', channelId: 'channel-1', messageId: 'm1' }
const team = { companyId: 'company-1', teamId: 'team-1', channelId: 'general', messageId: 'm1' }

describe('Reactions API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adds/removes a reaction on a direct message', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { reactions: [{ emoji: '👍', user_ids: ['user-1', 'user-2'] }] },
    })

    await expect(reactionsApi.toggleReaction(dm, '👍')).resolves.toEqual([
      { emoji: '👍', users: ['user-1', 'user-2'] },
    ])
    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/direct-channels/channel-1/messages/m1/reactions',
      { method: 'POST', body: JSON.stringify({ reaction: '👍' }) },
    )
  })

  it('adds/removes a reaction on a team channel message', async () => {
    apiRequest.mockResolvedValue({ success: true, data: null })

    await expect(reactionsApi.toggleReaction(team, '🎉')).resolves.toBeNull()
    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/company-1/teams/team-1/channels/general/messages/m1/reactions',
      { method: 'POST', body: JSON.stringify({ reaction: '🎉' }) },
    )
  })

  it('reads reactions from the returned message and groups one row per user', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: {
        message: {
          id: 'm1',
          reactions: [
            { id: 1, emoji: '❤️', user_id: 'user-1' },
            { id: 2, emoji: '❤️', user: { id: 'user-2' } },
            { id: 3, reaction: '😂', user_id: 'user-2' },
          ],
        },
      },
    })

    await expect(reactionsApi.toggleReaction(dm, '❤️')).resolves.toEqual([
      { emoji: '❤️', users: ['user-1', 'user-2'] },
      { emoji: '😂', users: ['user-2'] },
    ])
  })

  it('URL-encodes every ID', async () => {
    apiRequest.mockResolvedValue({ success: true, data: null })

    await reactionsApi.toggleReaction(
      { companyId: 'c 1', teamId: 't/1', channelId: 'ch 1', messageId: 'm/1' },
      '👍',
    )

    expect(apiRequest).toHaveBeenCalledWith(
      '/v1/c%201/teams/t%2F1/channels/ch%201/messages/m%2F1/reactions',
      expect.any(Object),
    )
  })

  it('surfaces API errors', async () => {
    apiRequest.mockResolvedValue({ success: false, message: 'Not allowed.' })

    await expect(reactionsApi.toggleReaction(dm, '👍')).rejects.toThrow('Not allowed.')
  })

  it('requires the IDs and an emoji', () => {
    expect(() => reactionsApi.toggleReaction({ ...dm, companyId: '' }, '👍')).toThrow(
      'A company ID is required to react to a message.',
    )
    expect(() => reactionsApi.toggleReaction({ ...dm, messageId: '' }, '👍')).toThrow(
      'A message ID is required to react to a message.',
    )
    expect(() => reactionsApi.toggleReaction(dm, '')).toThrow(
      'An emoji is required to react to a message.',
    )
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('keeps the screen reactions when the server returns only the single reaction row', async () => {
    apiRequest.mockResolvedValue({ success: true, data: { id: 9, reaction: '👍', user_id: 'user-1' } })

    await expect(reactionsApi.toggleReaction(dm, '👍')).resolves.toBeNull()
  })

  it('reads the full list from message_reactions in the response', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { message: { id: 'm1', message_reactions: [{ reaction: '👍', user_id: 'user-1' }] } },
    })

    await expect(reactionsApi.toggleReaction(dm, '👍')).resolves.toEqual([{ emoji: '👍', users: ['user-1'] }])
  })

  it('reads the real backend response ("message-reaction" with reaction.data)', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      message: 'Message reaction created successfully.',
      data: {
        'message-reaction': {
          message_id: '6aec621cee75978dd106506d',
          reactions: [
            {
              reaction: { data: '\ud83d\ude43', category: null, aliases: [] },
              user_ids: ['6ae1c59f18c64b137702b4eb'],
            },
          ],
          updated_at: '2026-11-05T12:49:20.789000',
          created_at: '2026-11-05T12:49:20.786000',
          id: '6aec7b505e6a10344b0caded',
        },
      },
    })

    await expect(reactionsApi.toggleReaction(dm, '🙃')).resolves.toEqual([
      { emoji: '🙃', users: ['6ae1c59f18c64b137702b4eb'] },
    ])
  })
})