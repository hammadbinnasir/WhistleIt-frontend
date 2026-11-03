import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from './http'
import {
  addChannelMember,
  browseChannels,
  createChannel,
  deleteChannel,
  getChannel,
  joinChannel,
  leaveChannel,
  listMembers,
  listMyChannels,
  removeChannelMember,
  updateChannel,
} from './channels.api'

vi.mock('./http', () => ({ http: vi.fn() }))
vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => ({ activeWorkspaceId: 'company-1', activeTeamId: 'team-2' }),
}))

const collectionPath = '/v1/company-1/teams/team-2/channels'
const channelPath = `${collectionPath}/channel-3`

describe('channel API routes', () => {
  beforeEach(() => {
    http.mockReset()
    http.mockResolvedValue({ id: 'channel-3', name: 'Engineering' })
  })

  it('treats channels from the joined-channel list as joined when membership is omitted', async () => {
    http.mockResolvedValue({
      items: [
        { id: 'channel-3', name: 'Engineering' },
        { id: 'channel-4', name: 'Design Reviews', is_member: false },
      ],
    })

    const channels = await listMyChannels()
    expect(http).toHaveBeenLastCalledWith(collectionPath)
    expect(channels.map(({ id, isMember }) => [id, isMember])).toEqual([
      ['channel-3', true],
      ['channel-4', false],
    ])

    http.mockResolvedValue({
      items: [{ id: 'channel-3', name: 'Engineering' }],
    })
    const browsed = await browseChannels('eng')
    expect(http).toHaveBeenLastCalledWith(collectionPath, { params: { q: 'eng' } })
    expect(browsed[0].isMember).toBe(false)
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
})
