import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/dms/dmApi', () => ({
  dmApi: {
    meId: vi.fn(() => 'me'),
    listDirectChannels: vi.fn(),
    listMessages: vi.fn(async () => []),
    getDirectChannel: vi.fn(),
    createDirectChannel: vi.fn(),
    listCompanyMembers: vi.fn(),
    listTeamMembers: vi.fn(async () => []),
    listTeamNonMembers: vi.fn(async () => []),
    presence: vi.fn(async () => ({})),
    updateUserStatus: vi.fn(async () => null),
    getUserStatus: vi.fn(async () => null),
  },
}))
vi.mock('@/stores/members', async () => {
  const { reactive } = await import('vue')
  const store = reactive({
    members: [
      { id: 'u5', name: 'Afia Noor' },
      { id: 'u6', name: 'Salman Zahoor' },
    ],
    fetchMembers: vi.fn(),
  })
  return { useMembersStore: () => store }
})

import { dmApi } from '@/features/dms/dmApi'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore } from '@/features/dms/stores/presence'
import { useTeamsStore } from '@/stores/teams'
import { useMembersStore } from '@/stores/members'
import DmList from '../components/DmList.vue'

const dmWith = (id, userId, name) => ({
  conversation: { id, type: 'dm', members: ['me', userId], name: '', unreadCount: 0, isFavorite: false, messages: [] },
  users: [
    { id: 'me', name: 'Aiman Iqbal', avatarUrl: '' },
    { id: userId, name, avatarUrl: '' },
  ],
})

describe('DmList', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    dmApi.listDirectChannels.mockResolvedValue([dmWith('c1', 'u2', 'Ahmad Imran')])
    dmApi.listCompanyMembers.mockResolvedValue([
      { id: 'me', name: 'Aiman Iqbal', email: '', avatarUrl: '' },
      { id: 'u2', name: 'Ahmad Imran', email: '', avatarUrl: '' },
      { id: 'u3', name: 'Muniba Naseer', email: '', avatarUrl: '' },
    ])
    dmApi.createDirectChannel.mockImplementation(async (_c, payload) => dmWith('c9', payload.user_id, ''))
  })
  afterEach(() => {
    useDmStore().stopPolling()
    usePresenceStore().stopPolling()
  })

  async function mountList() {
    const wrapper = mount(DmList, { global: { stubs: { NewDmPanel: true } } })
    await flushPromises()
    return wrapper
  }

  it('shows my DMs first, then the other users again (online first), but not me', async () => {
    const presence = usePresenceStore()
    const wrapper = await mountList()
    presence.presenceById = { u6: { state: 'online' } }
    await flushPromises()

    const names = wrapper.findAll('button[title]').map((b) => b.text()).filter((t) => t && t !== '+')
    expect(names).toEqual(['Ahmad Imran', 'Salman Zahoor', 'Afia Noor', 'Muniba Naseer'])
    expect(wrapper.text()).not.toContain('Aiman Iqbal')
    wrapper.unmount()
  })

  it('starts a DM when another user is clicked', async () => {
    const wrapper = await mountList()

    await wrapper.findAll('[data-test="dm-suggestion"] button')[0].trigger('click')
    await flushPromises()

    expect(dmApi.createDirectChannel).toHaveBeenCalledWith('company-1', { user_id: 'u5' })
    expect(useDmStore().activeId).toBe('c9')
    // ab wo DM ban gayi, isliye "baaki users" mein nahi
    expect(wrapper.findAll('[data-test="dm-suggestion"]').map((w) => w.text())).not.toContain('Afia Noor')
    wrapper.unmount()
  })

  it('hides a suggested user with the close button', async () => {
    const wrapper = await mountList()

    await wrapper.findAll('[data-test="dm-suggestion"] [aria-label="Close conversation"]')[0].trigger('click')

    expect(wrapper.findAll('[data-test="dm-suggestion"]').map((w) => w.text().trim())).not.toContain('Afia Noor')
    wrapper.unmount()
  })

  it('tells the server I am offline when the DM list closes (logout)', async () => {
    const wrapper = await mountList()
    dmApi.updateUserStatus.mockClear()

    wrapper.unmount()

    expect(dmApi.updateUserStatus).toHaveBeenCalledWith('me', { mode: 'offline' }, { keepalive: true })
  })

  it('shows a newly invited/added member in the DM list right away (no refresh)', async () => {
    const wrapper = await mountList()
    const members = useMembersStore()

    members.members = [...members.members, { id: 'u9', name: 'Naya Member' }] // invite/add hua
    await flushPromises()

    expect(wrapper.text()).toContain('Naya Member')
    members.members = members.members.filter((m) => m.id !== 'u9')
    wrapper.unmount()
  })
})