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

  it('normalizes member list records without inventing user profile fields', () => {
    expect(
      normalizeMembers({
        success: true,
        data: { members: [{ id: 'membership-1', role: 'member', joined_by: 'user-2' }] },
      }),
    ).toEqual([
      {
        id: 'membership-1',
        name: 'Member',
        email: '',
        role: 'member',
        status: 'offline',
        avatar: null,
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
