import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthUserId } from '@/features/auth/session'
import { http } from './http'
import {
  addChannelMember,
  browseChannels,
  createChannel,
  deleteChannel,
  getChannel,
  joinChannel,
  leaveChannel,
  listAvailableMembers,
  listChannels,
  listMembers,
  removeChannelMember,
  updateChannel,
} from './channels.api'

vi.mock('./http', () => ({ http: vi.fn() }))
vi.mock('@/features/auth/session', () => ({ getAuthUserId: vi.fn() }))
vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => ({ activeWorkspaceId: 'company-1', activeTeamId: 'team-2' }),
}))

const collectionPath = '/v1/company-1/teams/team-2/channels'
const channelPath = `${collectionPath}/channel-3`

describe('channel API routes', () => {
  beforeEach(() => {
    http.mockReset()
    http.mockResolvedValue({ id: 'channel-3', name: 'Engineering' })
    getAuthUserId.mockReturnValue(null)
  })

  it('preserves explicit membership status from list and browse responses', async () => {
    http.mockResolvedValue({
      items: [
        { id: 'channel-3', name: 'Engineering', is_member: true },
        { id: 'channel-4', name: 'Design Reviews', is_member: false },
      ],
    })

    const channels = await listChannels()
    expect(http).toHaveBeenLastCalledWith(collectionPath)
    expect(channels.map(({ id, isMember }) => [id, isMember])).toEqual([
      ['channel-3', true],
      ['channel-4', false],
    ])

    const browseResults = await browseChannels('eng')
    expect(http).toHaveBeenLastCalledWith(collectionPath, { params: { q: 'eng' } })
    expect(browseResults.map(({ id, isMember }) => [id, isMember])).toEqual([
      ['channel-3', true],
      ['channel-4', false],
    ])
  })

  it('resolves membership in browse results when the response omits it', async () => {
    getAuthUserId.mockReturnValue('user-42')
    http.mockImplementation(async (path) => {
      if (path === collectionPath) {
        return {
          success: true,
          data: {
            channels: [
              { id: 'channel-3', name: 'Engineering' },
              { id: 'channel-4', name: 'Design Reviews' },
            ],
          },
        }
      }
      if (path === `${collectionPath}/channel-3/members`) {
        return { success: true, data: { members: ['user-42'], total: 1 } }
      }
      if (path === `${collectionPath}/channel-4/members`) {
        return { success: true, data: { members: ['user-99'], total: 1 } }
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    const channels = await browseChannels()

    expect(channels.map(({ id, isMember }) => [id, isMember])).toEqual([
      ['channel-3', true],
      ['channel-4', false],
    ])
  })

  it('surfaces missing membership data when the signed-in user ID is unavailable', async () => {
    http.mockResolvedValue({
      channels: [{ id: 'channel-3', name: 'Engineering' }],
    })

    await expect(listChannels()).rejects.toThrow(
      'The channel response does not include membership and the signed-in user ID is unavailable.',
    )
  })

  it('resolves missing membership from the current user in channel members', async () => {
    getAuthUserId.mockReturnValue('user-42')
    http.mockImplementation(async (path) => {
      if (path === collectionPath) {
        return {
          items: [
            { id: 'channel-3', name: 'Engineering' },
            { id: 'channel-4', name: 'Design Reviews', is_member: false },
          ],
        }
      }
      if (path === `${collectionPath}/channel-3/members`) {
        return {
          success: true,
          data: { members: [{ user_id: 'user-42' }], total: 1 },
        }
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    const channels = await listChannels()

    expect(channels.map(({ id, isMember }) => [id, isMember])).toEqual([
      ['channel-3', true],
      ['channel-4', false],
    ])
    expect(http).toHaveBeenCalledTimes(2)
  })

  it('matches the user ID rather than a membership record ID', async () => {
    getAuthUserId.mockReturnValue('user-42')
    http.mockImplementation(async (path) => {
      if (path === collectionPath) {
        return { channels: [{ id: 'channel-3', name: 'Engineering' }] }
      }
      if (path === `${collectionPath}/channel-3/members`) {
        return {
          success: true,
          data: {
            members: [{ id: 'membership-7', user_id: 'user-42' }],
            total: 1,
          },
        }
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    await expect(listChannels()).resolves.toMatchObject([{ id: 'channel-3', isMember: true }])
  })

  it('recognizes the backend channel member response with joined_by', async () => {
    getAuthUserId.mockReturnValue('user-42')
    http.mockImplementation(async (path) => {
      if (path === collectionPath) {
        return {
          success: true,
          data: {
            channels: [{ id: 'channel-3', name: 'Engineering' }],
          },
        }
      }
      if (path === `${collectionPath}/channel-3/members`) {
        return {
          success: true,
          data: {
            members: [
              {
                id: 'membership-1',
                channel_id: 'channel-3',
                added_by: 'other-user',
                joined_by: 'user-42',
                deleted_at: null,
              },
            ],
            total: 1,
          },
        }
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    await expect(listChannels()).resolves.toMatchObject([{ id: 'channel-3', isMember: true }])
  })

  it('uses the channel resource routes for get, create, update, and delete', async () => {
    await getChannel('channel-3')
    expect(http).toHaveBeenLastCalledWith(channelPath)

    const created = await createChannel({
      name: 'Engineering',
      description: 'Build things',
      isPrivate: true,
    })
    expect(http).toHaveBeenLastCalledWith(collectionPath, {
      method: 'POST',
      body: { name: 'Engineering', description: 'Build things', type: 'private' },
    })
    expect(created.isMember).toBe(true)

    await updateChannel('channel-3', { name: 'Platform', description: 'Tools' })
    expect(http).toHaveBeenLastCalledWith(channelPath, {
      method: 'PATCH',
      body: { name: 'Platform', description: 'Tools' },
    })

    await deleteChannel('channel-3')
    expect(http).toHaveBeenLastCalledWith(channelPath, { method: 'DELETE' })
  })

  it('uses the supplied join, leave, and membership routes', async () => {
    await joinChannel('channel-3')
    expect(http).toHaveBeenLastCalledWith(`${channelPath}/join`, { method: 'POST' })

    await leaveChannel('channel-3')
    expect(http).toHaveBeenLastCalledWith(`${channelPath}/leave`, { method: 'DELETE' })

    await leaveChannel('channel-3', 'user-4')
    expect(http).toHaveBeenLastCalledWith(`${channelPath}/leave`, {
      method: 'DELETE',
      body: { new_admin_id: 'user-4' },
    })

    http.mockResolvedValue({ items: [], total: 0 })
    await listMembers('channel-3')
    expect(http).toHaveBeenLastCalledWith(`${channelPath}/members`, { params: { limit: 10 } })

    await addChannelMember('channel-3', 'user-4')
    expect(http).toHaveBeenLastCalledWith(`${channelPath}/members`, {
      method: 'POST',
      body: { user_id: 'user-4' },
    })

    await removeChannelMember('channel-3', 'user-4')
    expect(http).toHaveBeenLastCalledWith(`${channelPath}/members/user-4`, { method: 'DELETE' })
  })

  it('loads and normalizes channel available members', async () => {
    http.mockResolvedValue({
      success: true,
      data: {
        available_members: [
          { user_id: 'user-8', full_name: 'Avery Jones', email: 'avery@example.com' },
        ],
        total: 1,
      },
    })

    await expect(listAvailableMembers('channel-3')).resolves.toEqual({
      items: [
        {
          id: 'user-8',
          name: 'Avery Jones',
          email: 'avery@example.com',
          avatarUrl: '',
          status: null,
        },
      ],
      total: 1,
    })
    expect(http).toHaveBeenLastCalledWith(`${channelPath}/available-members`)
  })
})
