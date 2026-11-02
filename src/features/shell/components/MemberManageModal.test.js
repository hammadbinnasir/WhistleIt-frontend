import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MemberManageModal from './MemberManageModal.vue'
import { useMembersStore } from '@/stores/members'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

const api = vi.hoisted(() => ({
  getMembers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  searchUsers: vi.fn(),
}))

vi.mock('@/features/shell/api/membersApi', () => ({
  getMembers: api.getMembers,
  addMember: api.addMember,
  removeMember: api.removeMember,
  searchUsers: api.searchUsers,
}))

vi.mock('@/features/auth/session', () => ({
  getAuthUserId: () => 'self-user',
}))

const initialMembers = [
  {
    userId: 'self-user',
    membershipId: 'membership-self',
    name: 'Current User',
    role: 'member',
    joinedDate: 'today',
    status: 'offline',
  },
  {
    userId: 'target-user',
    membershipId: 'membership-target',
    name: 'Other Member',
    email: 'other@example.test',
    role: 'member',
    joinedDate: 'today',
    status: 'offline',
  },
]

describe('MemberManageModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    api.getMembers.mockResolvedValue(initialMembers)
    api.addMember.mockResolvedValue({ success: true })
    api.removeMember.mockResolvedValue({ success: true })
  })

  afterEach(() => vi.restoreAllMocks())

  function mountOpenModal() {
    const teamsStore = useTeamsStore()
    teamsStore.workspaces = [{ id: 'workspace-1', name: 'Workspace' }]
    teamsStore.activeWorkspaceId = 'workspace-1'
    teamsStore.teamsByWorkspaceId = {
      'workspace-1': [{ id: 'team-1', name: 'Design Team', workspaceId: 'workspace-1' }],
    }
    teamsStore.activeTeamId = 'team-1'
    useUiStore().memberManageModalOpen = true
    return mount(MemberManageModal)
  }

  it('marks the current user and never renders a Remove button for them', async () => {
    const wrapper = mountOpenModal()
    await flushPromises()

    expect(wrapper.text()).toContain('Current User (You)')
    expect(wrapper.findAll('.remove-btn')).toHaveLength(1)
  })

  it('shows API-backed add member search in production mode', async () => {
    const wrapper = mountOpenModal()
    await flushPromises()

    expect(wrapper.find('input[placeholder="Enter name or email..."]').exists()).toBe(true)
    const addButton = wrapper.findAll('button').find((button) => button.text().includes('Add Member'))
    expect(addButton).toBeDefined()
    expect(addButton.attributes('disabled')).not.toBeDefined()
  })

  it('confirms removal by user ID and refreshes the member list on success', async () => {
    const wrapper = mountOpenModal()
    const membersStore = useMembersStore()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await flushPromises()

    await wrapper.find('.remove-btn').trigger('click')
    await flushPromises()

    expect(confirm).toHaveBeenCalled()
    expect(api.removeMember).toHaveBeenCalledWith('workspace-1', 'team-1', 'target-user')
    expect(api.getMembers).toHaveBeenCalledTimes(2)
    expect(membersStore.members).toHaveLength(2)
    expect(wrapper.text()).toContain('Removed Other Member.')
    confirm.mockRestore()
  })

  it('disables member actions while a remove request is pending', async () => {
    const wrapper = mountOpenModal()
    let finishRemove
    api.removeMember.mockReturnValue(
      new Promise((resolve) => {
        finishRemove = resolve
      }),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await flushPromises()

    await wrapper.find('.remove-btn').trigger('click')
    expect(wrapper.find('.remove-btn').attributes('disabled')).toBeDefined()

    finishRemove({ success: true })
    await flushPromises()
  })

  it('shows a clear error for a missing member', async () => {
    const wrapper = mountOpenModal()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.removeMember.mockRejectedValue({ status: 404, message: 'not found' })
    await flushPromises()

    await wrapper.find('.remove-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('The team or member could not be found.')
  })

  it('shows the backend validation message for a rejected member operation', async () => {
    const wrapper = mountOpenModal()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.removeMember.mockRejectedValue({
      status: 422,
      message: 'The selected member cannot be removed.',
    })
    await flushPromises()

    await wrapper.find('.remove-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('The selected member cannot be removed.')
  })

  it('keeps the list read-only after a permission error', async () => {
    const wrapper = mountOpenModal()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.removeMember.mockRejectedValue({ status: 403, message: 'forbidden' })
    await flushPromises()

    await wrapper.find('.remove-btn').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('The list is read-only.')
    expect(wrapper.find('.remove-btn').exists()).toBe(false)
  })

  it('shows the backend validation message for an invalid add request', async () => {
    const store = useMembersStore()
    api.addMember.mockRejectedValue({ status: 422, message: 'Select a valid member.' })

    await expect(store.addMember('workspace-1', 'team-1', ['invalid-user'])).rejects.toMatchObject({
      status: 422,
    })
    expect(store.error).toBe('Select a valid member.')
  })
})
