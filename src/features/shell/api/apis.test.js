import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }))

import { apiRequest } from '@/lib/api/client'
import {
  getCompanyMembers,
  getMembers,
  getNotMembers,
  addMember,
  addMembers,
  removeMember,
} from './membersApi'
import { createTeam, deleteTeam, getTeam, getTeams, updateTeam } from './teamsApi'
import { getWorkspaces, getWorkspaceTeams } from './workspacesApi'

describe('shell API adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and normalizes workspaces from GET /v1/company', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { user: { companies: [{ id: 'company-1', name: 'Engineering' }] } },
    })

    await expect(getWorkspaces()).resolves.toEqual([
      {
        id: 'company-1',
        name: 'Engineering',
        role: null,
        isAdmin: false,
        initials: 'EN',
      },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/v1/company')
  })

  it('loads teams with their company scope and normalizes the response', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { teams: [{ id: 'team-1', company_id: 'company-1', name: 'Design', user_ids: [] }] },
    })

    await expect(getWorkspaceTeams('company-1')).resolves.toMatchObject([
      { id: 'team-1', workspaceId: 'company-1', name: 'Design' },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/teams')
  })

  it('surfaces real team endpoint errors without falling back to mock data', async () => {
    const error = { status: 404, message: 'Team route not found.' }
    apiRequest.mockRejectedValue(error)

    await expect(getTeams('company-1')).rejects.toBe(error)
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/teams')
  })

  it('loads one team from the company-scoped detail endpoint', async () => {
    apiRequest.mockResolvedValue({
      success: true,
      data: { team: { id: 'team-1', company_id: 'company-1', name: 'Design' } },
    })

    await expect(getTeam('company-1', 'team-1')).resolves.toMatchObject({
      id: 'team-1',
      workspaceId: 'company-1',
    })
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/teams/team-1')
  })

  it('maps create, update and delete to company-scoped team endpoints', async () => {
    apiRequest
      .mockResolvedValueOnce({
        success: true,
        data: { team: { id: 'team-new', name: 'New Team', company_id: 'company-1' } },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { team: { id: 'team-new', name: 'Renamed', company_id: 'company-1' } },
      })
      .mockResolvedValueOnce({ success: true, data: null })

    await expect(
      createTeam({ workspaceId: 'company-1', name: 'New Team', color: 'ignored' }),
    ).resolves.toMatchObject({ id: 'team-new', workspaceId: 'company-1' })
    await expect(updateTeam('company-1', 'team-new', { name: 'Renamed' })).resolves.toMatchObject({
      name: 'Renamed',
    })
    await expect(deleteTeam('company-1', 'team-new')).resolves.toEqual({ success: true })

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/v1/company-1/teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Team' }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/v1/company-1/teams/team-new', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Renamed' }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/v1/company-1/teams/team-new', {
      method: 'DELETE',
    })
  })

  it('loads members and normalizes identity fields using the explicit workspace scope', async () => {
    apiRequest.mockResolvedValueOnce({
      success: true,
      data: {
        teamusers: {
          creator_id: 'user-1',
          members: [{ id: 'user-1', name: 'Team Creator' }],
        },
      },
    })

    await expect(getMembers('company-1', 'team-1')).resolves.toMatchObject([
      { userId: 'user-1', name: 'Team Creator', isCreator: true },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/teams/team-1/members')
  })

  it('loads company members from the company-level members endpoint', async () => {
    apiRequest.mockResolvedValueOnce({
      success: true,
      data: { companyusers: { members: [{ id: 'user-1', name: 'Company User' }] } },
    })

    await expect(getCompanyMembers('company-1')).resolves.toEqual([
      { userId: 'user-1', name: 'Company User' },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/company/company-1/members')
  })

  it('loads notmembers from its confirmed envelope path', async () => {
    apiRequest.mockResolvedValueOnce({
      success: true,
      data: {
        notteamusers: {
          members: [{ id: 'user-1', name: 'Available User' }],
        },
      },
    })

    await expect(getNotMembers('company-1', 'team-1')).resolves.toEqual([
      { userId: 'user-1', name: 'Available User' },
    ])
    expect(apiRequest).toHaveBeenCalledWith('/v1/company-1/teams/team-1/notmembers')
  })

  it('uses single and multiple member routes with array user_ids and removes by user ID', async () => {
    apiRequest
      .mockResolvedValueOnce({
        success: true,
        message: 'Team member added successfully',
        data: null,
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Team members added successfully',
        data: null,
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Team member deleted successfully',
        data: null,
      })

    await expect(addMember('company-1', 'team-1', 'user-1')).resolves.toMatchObject({
      message: 'Team member added successfully',
    })
    await expect(addMembers('company-1', 'team-1', ['user-1', 'user-2'])).resolves.toMatchObject({
      message: 'Team members added successfully',
    })
    await expect(removeMember('company-1', 'team-1', 'user-2')).resolves.toEqual({
      success: true,
      message: 'Team member deleted successfully',
    })

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/v1/company-1/teams/team-1/member', {
      method: 'POST',
      body: JSON.stringify({ user_ids: ['user-1'] }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/v1/company-1/teams/team-1/multiplemembers', {
      method: 'POST',
      body: JSON.stringify({ user_ids: ['user-1', 'user-2'] }),
    })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/v1/company-1/teams/team-1/members/user-2', {
      method: 'DELETE',
    })
  })
})
