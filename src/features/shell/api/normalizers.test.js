import { describe, expect, it } from 'vitest'
import {
  normalizeMembers,
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

  it('normalizes target user IDs from joined_by, never the membership ID', () => {
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
      },
    ])
  })

  it('maps profile fields only when the members response provides them', () => {
    expect(
      normalizeMembers({
        success: true,
        data: {
          members: [
            {
              id: 'membership-1',
              joined_by: 'user-2',
              user: { name: 'Member Name', email: 'member@example.test', avatar_url: '/avatar' },
            },
          ],
        },
      })[0],
    ).toMatchObject({
      userId: 'user-2',
      membershipId: 'membership-1',
      name: 'Member Name',
      email: 'member@example.test',
      avatar: '/avatar',
    })
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
