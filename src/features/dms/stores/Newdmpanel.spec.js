import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/dms/dmApi', () => ({
  dmApi: {
    meId: vi.fn(() => 'me'),
    listCompanyMembers: vi.fn(),
    listTeamMembers: vi.fn(async () => []),
    listTeamNonMembers: vi.fn(async () => []),
    presence: vi.fn(async () => ({})),
  },
}))
vi.mock('@/stores/members', () => {
  const store = { members: [{ id: 'u5', name: 'Afia Noor' }], fetchMembers: vi.fn() }
  return { useMembersStore: () => store }
})

import { dmApi } from '@/features/dms/dmApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { useTeamsStore } from '@/stores/teams'
import NewDmPanel from './NewDmPanel.vue'

describe('NewDmPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    dmApi.listCompanyMembers.mockResolvedValue([
      { id: 'me', name: 'Ahmad Imran', email: '', avatarUrl: '' },
      { id: 'u2', name: 'Muniba Naseer', email: '', avatarUrl: '' },
      { id: 'u3', name: 'Salman Zahoor', email: '', avatarUrl: '' },
    ])
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('lists the other users (company + team members) but not me, in a smaller card', async () => {
    useDmStore()
    const wrapper = mount(NewDmPanel, { attachTo: document.body })
    await flushPromises()

    document.body.querySelector('[aria-label="Show members"]').click()
    await flushPromises()

    const names = [...document.body.querySelectorAll('li button')].map((b) => b.textContent)
    expect(names.join('|')).toContain('Muniba Naseer')
    expect(names.join('|')).toContain('Salman Zahoor')
    expect(names.join('|')).toContain('Afia Noor')
    expect(names.join('|')).not.toContain('Ahmad Imran')
    expect(document.body.querySelector('[role="dialog"]').className).toContain('max-w-lg')
    wrapper.unmount()
  })
})