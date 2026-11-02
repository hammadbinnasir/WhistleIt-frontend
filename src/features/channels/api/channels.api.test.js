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

  it('lists and browses channels through the team collection route', async () => {
    http.mockResolvedValue({ items: [{ id: 'channel-3', name: 'Engineering' }] })

    await listMyChannels()
    expect(http).toHaveBeenLastCalledWith(collectionPath)

    await browseChannels('eng')
    expect(http).toHaveBeenLastCalledWith(collectionPath, { params: { q: 'eng' } })
  })

  it('uses the channel resource routes for get, create, update, and delete', async () => {
    await getChannel('channel-3')
    expect(http).toHaveBeenLastCalledWith(channelPath)

    await createChannel({ name: 'Engineering', description: 'Build things', isPrivate: true })
    expect(http).toHaveBeenLastCalledWith(collectionPath, {
      method: 'POST',
      body: { name: 'Engineering', description: 'Build things', type: 'private' },
    })

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
