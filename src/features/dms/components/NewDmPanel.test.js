import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDmStore } from '@/features/dms/stores/dms'
import { dmApi } from '@/features/dms/dmApi'
import { useMembersStore } from '@/stores/members'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'
import NewDmPanel from './NewDmPanel.vue'

describe('NewDmPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dmApi.listCompanyMembers.mockResolvedValue([])
    setActivePinia(createPinia())
    useTeamsStore().activeWorkspaceId = 'company-1'
    const members = useMembersStore()
    members.members = [{ id: 'membership-1', userId: 'company-user-1', name: 'Company User' }]
    members.fetchMembers = vi.fn().mockResolvedValue(true)
    useTeamsStore().activeTeamId = 'team-1'
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('filters already-loaded team members by name', async () => {
    const dms = useDmStore()
    await dms.init()
    dms.users = []
    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    expect(document.body.textContent).toContain('Company User')
    const input = document.body.querySelector('input')
    input.value = 'company'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(document.body.querySelectorAll('li button')).toHaveLength(1)
    expect(document.body.querySelector('li button').textContent).toContain('Company User')

    wrapper.unmount()
  })

  it('starts a DM immediately after selecting a known user', async () => {
    const dms = useDmStore()
    useMembersStore().members = []
    await dms.init()
    dms.users = [{ id: 'user-42', name: 'Hammad Bin Nasir', avatarUrl: '' }]
    const wrapper = mount(NewDmPanel, { attachTo: document.body })
    const input = document.body.querySelector('input')

    input.value = 'Hammad'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('Hammad Bin Nasir')

    await document.body.querySelector('li button').click()
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('Hammad Bin Nasir')

    await vi.waitFor(() => {
      expect(dms.activeId).toBe('created-user-42')
    })
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(document.body.textContent).not.toContain('could not be found')

    wrapper.unmount()
  })

  it('loads company members and lets the user add a name-search result', async () => {
    dmApi.listCompanyMembers.mockResolvedValue([
      { id: 'company-user-2', name: 'Alex Member', email: 'alex@example.com', avatarUrl: '' },
    ])
    const dms = useDmStore()
    await dms.init()
    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    await vi.waitFor(() => {
      expect(dmApi.listCompanyMembers).toHaveBeenCalledWith('company-1')
    })
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Alex Member')
    })
    const input = document.body.querySelector('input')
    input.value = 'Alex'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('li button').textContent).toContain('Alex Member')
    await document.body.querySelector('li button').click()
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('Alex Member')

    wrapper.unmount()
  })

  it('fetches active team members and adds them to the DM picker', async () => {
    const members = useMembersStore()
    members.fetchMembers = vi.fn(async () => {
      members.members = [{ id: 'membership-2', userId: 'team-user-2', name: 'Team API Member' }]
      return true
    })
    const dms = useDmStore()
    await dms.init()
    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    await vi.waitFor(() => {
      expect(members.fetchMembers).toHaveBeenCalledWith('company-1', 'team-1')
      expect(document.body.textContent).toContain('Team API Member')
    })

    wrapper.unmount()
  })

  it('shows cached company members without repeating the request on mount', async () => {
    dmApi.listCompanyMembers.mockResolvedValue([
      { id: 'company-user-2', name: 'Alex Member', email: 'alex@example.com', avatarUrl: '' },
    ])
    const dms = useDmStore()
    await dms.init()
    await dms.loadCompanyMembers()
    expect(dmApi.listCompanyMembers).toHaveBeenCalledTimes(1)

    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    await vi.waitFor(() => {
      expect(dmApi.listCompanyMembers).toHaveBeenCalledTimes(1)
      expect(document.body.textContent).toContain('Alex Member')
    })

    wrapper.unmount()
  })

  it('keeps loaded team members searchable when company members only include the current user', async () => {
    dmApi.listCompanyMembers.mockResolvedValue([
      { id: 'company-user-1', name: 'Aiman Iqbal', email: '', avatarUrl: '' },
    ])
    const members = useMembersStore()
    members.members = [
      { id: 'membership-1', userId: 'company-user-1', name: 'Aiman Iqbal' },
      { id: 'membership-2', userId: 'user-muniba', name: 'Muniba Khan' },
    ]
    const dms = useDmStore()
    await dms.init()
    dms.meId = 'company-user-1'
    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    await vi.waitFor(() => {
      expect(dms.companyMembers).toHaveLength(1)
    })
    const input = document.body.querySelector('input')
    input.value = 'muniba'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('li button').textContent).toContain('Muniba Khan')

    wrapper.unmount()
  })

  it('explains that the current user cannot be selected as a DM recipient', async () => {
    dmApi.listCompanyMembers.mockResolvedValue([
      { id: 'u1', name: 'Aiman Iqbal', email: '', avatarUrl: '' },
    ])
    const dms = useDmStore()
    await dms.init()
    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    await vi.waitFor(() => {
      expect(dms.companyMembers).toHaveLength(1)
    })
    const input = document.body.querySelector('input')
    input.value = 'aiman'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain(
      'That is your account. Choose another member to start a direct message.',
    )

    wrapper.unmount()
  })

  it('shows available member names when the panel opens', async () => {
    const dms = useDmStore()
    await dms.init()
    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    const options = document.body.querySelectorAll('li button')
    expect([...options].map((option) => option.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Company User'),
        expect.stringContaining('Muniba Naseer'),
      ]),
    )
    expect(document.body.textContent).not.toContain('Aiman Iqbal')

    wrapper.unmount()
  })

  it('shows names only and rotates the dropdown arrow while open', async () => {
    const dms = useDmStore()
    await dms.init()
    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    const firstOption = document.body.querySelector('li button')
    const userName = firstOption.querySelector('.min-w-0 > span')
    expect(firstOption.querySelector('.relative').style.width).toBe('44px')
    expect(userName.textContent.trim()).toBe('Company User')
    expect(userName.children).toHaveLength(0)
    expect(document.body.querySelector('[aria-label="Show members"]').classList).toContain(
      'rotate-180',
    )
    expect(document.body.querySelector('input').parentElement.querySelector('svg')).not.toBeNull()

    wrapper.unmount()
  })

  it('clears channel and panel selection after starting a DM', async () => {
    const dms = useDmStore()
    const ui = useUiStore()
    await dms.init()
    ui.selectChannel('general')
    ui.activePanel = 'activity'
    const wrapper = mount(NewDmPanel, { attachTo: document.body })

    await document.body.querySelector('li button').click()
    await vi.waitFor(() => {
      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(dms.activeId).toBe('created-company-user-1')
    })

    expect(ui.selectedChannelId).toBeNull()
    expect(ui.activePanel).toBeNull()

    wrapper.unmount()
  })
})
