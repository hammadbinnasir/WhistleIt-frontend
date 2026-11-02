import { describe, expect, it } from 'vitest'
import {
  normalizeMembers,
  normalizeNotMembers,
  normalizeTeamDetail,
  normalizeTeams,
  normalizeWorkspaces,
} from './normalizers'

describe('shell API normalizers', () => {
  it('unwraps data.user.companies and falls back to the first two name letters', () => {
    expect(
      normalizeWorkspaces({
        success: true,
        data: {
          user: {
            companies: [
              { id: 12, name: 'Research Workspace' },
              { id: 'acme', name: 'Acme', code: 'AC' },
            ],
          },
        },
      }),
    ).toEqual([
      { id: '12', name: 'Research Workspace', initials: 'RE' },
      { id: 'acme', name: 'Acme', initials: 'AC' },
    ])
  })

  it('normalizes company-scoped team list and detail responses', () => {
    const record = {
      id: 8,
      company_id: 7,
      name: 'Product Team',
      description: 'Build products',
      user_ids: ['u1', 'u2'],
    }

    expect(normalizeTeams({ success: true, data: { teams: [record] } }, 7)).toEqual([
      {
        id: '8',
        workspaceId: '7',
        name: 'Product Team',
        initials: 'PT',
        description: 'Build products',
        memberCount: 2,
      },
    ])
    expect(normalizeTeamDetail({ success: true, data: { team: record } }, 7).id).toBe('8')
  })

  it('normalizes the new teamusers shape using member IDs as user IDs', () => {
    expect(
      normalizeMembers({
        success: true,
        data: {
          teamusers: {
            creator_id: 'user-creator',
            members: [
              { id: 'user-creator', name: 'Creator Name' },
              { id: 'user-member', name: 'Member Name' },
            ],
          },
        },
      }),
    ).toEqual([
      { userId: 'user-creator', name: 'Creator Name', isCreator: true },
      { userId: 'user-member', name: 'Member Name', isCreator: false },
    ])
  })

  it('keeps the legacy shape and gets user ID from joined_by, not membership ID', () => {
    expect(
      normalizeMembers({
        success: true,
        data: {
          members: [
            {
              id: 'membership-1',
              joined_by: 'user-2',
              role: 'member',
              joined_date: '2026-10-28',
            },
          ],
        },
      }),
    ).toEqual([
      {
        userId: 'user-2',
        membershipId: 'membership-1',
        role: 'member',
        joinedDate: '2026-10-28',
        status: 'offline',
        isCreator: false,
      },
    ])
  })

  it('normalizes notmembers records and skips entries without a usable id', () => {
    // ASSUMED: id/name are inferred from the confirmed members shape; email/avatar are optional and unverified.
    expect(
      normalizeNotMembers({
        success: true,
        data: {
          notteamusers: {
            members: [
              {
                id: 'user-available',
                name: 'Available User',
                email: 'available@example.test',
                avatar: '/avatar.png',
              },
              { id: '  ', name: 'Invalid User' },
              { name: 'Missing ID' },
            ],
          },
        },
      }),
    ).toEqual([
      {
        userId: 'user-available',
        name: 'Available User',
        email: 'available@example.test',
        avatarUrl: '/avatar.png',
      },
    ])
  })

  it('surfaces a backend error envelope message', () => {
    expect(() =>
      normalizeWorkspaces({
        success: false,
        message: 'Workspace access denied.',
        data: null,
      }),
    ).toThrow('Workspace access denied.')
  })
})
