import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MemberManageModal from './MemberManageModal.vue'
import { useMembersStore } from '@/stores/members'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'

const api = vi.hoisted(() => ({
  getMembers: vi.fn(),
  getNotMembers: vi.fn(),
  addMember: vi.fn(),
  addMembers: vi.fn(),
  removeMember: vi.fn(),
}))
const navigation = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('@/features/shell/api/membersApi', () => ({
  getMembers: api.getMembers,
  getNotMembers: api.getNotMembers,
  addMember: api.addMember,
  addMembers: api.addMembers,
  removeMember: api.removeMember,
}))

vi.mock('@/features/auth/session', () => ({
  getAuthUserId: () => 'self-user',
}))

vi.mock('vue-router', () => ({
  useRouter: () => navigation,
}))

const initialMembers = [
  {
    userId: 'self-user',
    name: 'Current User',
    isCreator: true,
    status: 'offline',
  },
  {
    userId: 'target-user',
    name: 'Other Member',
    isCreator: false,
    status: 'offline',
  },
]

const availableUsers = [
  { userId: 'self-user', name: 'Current User', email: 'self@example.test' },
  { userId: 'new-user-1', name: 'Sarah Khan', email: 'sarah@example.test' },
  { userId: 'new-user-2', name: 'Alex Search', email: 'match@example.test' },
]

describe('MemberManageModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    navigation.push.mockReset()
    api.getMembers.mockResolvedValue(initialMembers)
    api.getNotMembers.mockResolvedValue(availableUsers)
    api.addMember.mockResolvedValue({ success: true, message: 'Team member added successfully' })
    api.addMembers.mockResolvedValue({ success: true, message: 'Team members added successfully' })
    api.removeMember.mockResolvedValue({
      success: true,
      message: 'Team member deleted successfully',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function mountOpenModal(role = 'admin', teams = null) {
    const teamsStore = useTeamsStore()
    teamsStore.workspaces = [
      {
        id: 'workspace-1',
        name: 'Workspace',
        role,
        isAdmin: role === 'admin',
      },
    ]
    teamsStore.activeWorkspaceId = 'workspace-1'
    teamsStore.teamsByWorkspaceId = {
      'workspace-1': teams ?? [{ id: 'team-1', name: 'Design Team', workspaceId: 'workspace-1' }],
    }
    teamsStore.activeTeamId = teamsStore.teamsByWorkspaceId['workspace-1'][0]?.id ?? null
    useUiStore().memberManageModalOpen = true
    return mount(MemberManageModal)
  }

  async function openPicker(wrapper) {
    await wrapper.find('button.add-btn').trigger('click')
    await flushPromises()
  }

  it('marks the current user and offers Leave instead of Remove on their row', async () => {
    const wrapper = mountOpenModal()
    await flushPromises()

    expect(wrapper.text()).toContain('Current User (You)')
    expect(wrapper.text()).toContain('Creator')
    const currentUserRow = wrapper
      .findAll('.member-row')
      .find((row) => row.text().includes('(You)'))
    expect(currentUserRow.text()).toContain('Leave team')
    expect(currentUserRow.find('.remove-btn').exists()).toBe(false)
    expect(wrapper.findAll('.remove-btn')).toHaveLength(1)
  })

  it('confirms leaving, removes the current user, and routes to the empty workspace state', async () => {
    const wrapper = mountOpenModal('member', [
      { id: 'team-1', name: 'Design Team', workspaceId: 'workspace-1' },
    ])
    api.removeMember.mockResolvedValue({
      success: true,
      message: 'You left the team successfully.',
    })
    await flushPromises()

    await wrapper.find('.leave-btn').trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.text()).toContain('Leave Design Team? You will lose access to this team.')
    await dialog.get('.shell-confirm-actions button:last-child').trigger('click')
    await flushPromises()

    expect(api.removeMember).toHaveBeenCalledWith('workspace-1', 'team-1', 'self-user')
    expect(useTeamsStore().teams).toEqual([])
    expect(navigation.push).toHaveBeenCalledWith({ path: '/app/workspace-1' })
    expect(useUiStore().toasts.at(-1)).toMatchObject({
      body: 'You left the team successfully.',
      type: 'success',
    })
  })

  it('keeps the member list read-only for non-admins', async () => {
    const wrapper = mountOpenModal('member')
    await flushPromises()

    expect(wrapper.text()).toContain('Other Member')
    expect(wrapper.find('button.add-btn').exists()).toBe(false)
    expect(wrapper.find('.remove-btn').exists()).toBe(false)
  })

  it('loads the picker list only when opened and keeps user IDs out of visible text', async () => {
    const wrapper = mountOpenModal()
    await flushPromises()

    expect(api.getNotMembers).not.toHaveBeenCalled()
    await openPicker(wrapper)

    expect(api.getNotMembers).toHaveBeenCalledWith('workspace-1', 'team-1')
    expect(wrapper.text()).toContain('Sarah Khan')
    expect(wrapper.text()).not.toContain('new-user-1')
    expect(wrapper.text()).not.toContain('self-user')
    expect(wrapper.text()).not.toContain('self@example.test')
  })

  it('shows loading and empty picker states', async () => {
    const wrapper = mountOpenModal()
    let finishLoading
    api.getNotMembers.mockReturnValue(new Promise((resolve) => (finishLoading = resolve)))

    await wrapper.find('button.add-btn').trigger('click')
    expect(wrapper.text()).toContain('Loading users...')

    finishLoading([])
    await flushPromises()
    expect(wrapper.text()).toContain('No users available to add.')
  })

  it('shows an error and retry control when the available-user request fails', async () => {
    const wrapper = mountOpenModal()
    api.getNotMembers.mockRejectedValueOnce({ status: 404, message: 'Users unavailable.' })
    await openPicker(wrapper)

    expect(wrapper.text()).toContain('The team or member could not be found.')
    expect(wrapper.find('.member-picker .retry-members').exists()).toBe(true)
  })

  it('debounces case-insensitive trimmed name-only search', async () => {
    vi.useFakeTimers()
    const wrapper = mountOpenModal()
    await flushPromises()
    await openPicker(wrapper)

    const search = wrapper.find('#member-picker-search')
    await search.setValue('  SARAH  ')
    await vi.advanceTimersByTimeAsync(199)
    await flushPromises()
    expect(wrapper.text()).toContain('Alex Search')

    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(wrapper.text()).toContain('Sarah Khan')
    expect(wrapper.text()).not.toContain('Alex Search')

    await search.setValue('  MATCH@EXAMPLE.TEST ')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(wrapper.text()).toContain('No users found')
  })

  it('shows No users found when a non-empty picker list has no search matches', async () => {
    const wrapper = mountOpenModal()
    await flushPromises()
    await openPicker(wrapper)
    await wrapper.find('#member-picker-search').setValue('absent')
    await new Promise((resolve) => setTimeout(resolve, 210))
    await flushPromises()

    expect(wrapper.text()).toContain('No users found')
  })

  it('disables Add selected until a user is selected and uses the single-member route', async () => {
    const wrapper = mountOpenModal()
    await flushPromises()
    await openPicker(wrapper)

    const addButton = wrapper.findAll('.member-picker .add-btn').at(-1)
    expect(addButton.attributes('disabled')).toBeDefined()

    await wrapper.findAll('.picker-user input').at(0).setValue(true)
    expect(wrapper.text()).toContain('1 selected')
    await wrapper.findAll('.member-picker .add-btn').at(-1).trigger('click')
    await flushPromises()

    expect(api.addMember).toHaveBeenCalledWith('workspace-1', 'team-1', 'new-user-1')
    expect(api.addMembers).not.toHaveBeenCalled()
    expect(api.getMembers).toHaveBeenCalledTimes(2)
    expect(api.getNotMembers).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Team member added successfully')
  })

  it('uses the multiple-member route when multiple users are selected', async () => {
    const wrapper = mountOpenModal()
    await flushPromises()
    await openPicker(wrapper)

    const checkboxes = wrapper.findAll('.picker-user input')
    await checkboxes.at(0).setValue(true)
    await checkboxes.at(1).setValue(true)
    expect(wrapper.text()).toContain('2 selected')
    await wrapper.findAll('.member-picker .add-btn').at(-1).trigger('click')
    await flushPromises()

    expect(api.addMembers).toHaveBeenCalledWith('workspace-1', 'team-1', [
      'new-user-1',
      'new-user-2',
    ])
    expect(api.addMember).not.toHaveBeenCalled()
    expect(api.getMembers).toHaveBeenCalledTimes(2)
    expect(api.getNotMembers).toHaveBeenCalledTimes(2)
  })

  it('maps add permission errors to read-only state', async () => {
    const wrapper = mountOpenModal()
    api.addMember.mockRejectedValue({ status: 403, message: 'Forbidden' })
    await flushPromises()
    await openPicker(wrapper)
    await wrapper.findAll('.picker-user input').at(0).setValue(true)
    await wrapper.findAll('.member-picker .add-btn').at(-1).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("You don't have permission to add members.")
    expect(wrapper.text()).toContain('The list is read-only.')
    expect(wrapper.find('.remove-btn').exists()).toBe(false)
  })

  it('confirms removal by user ID and refreshes the member list on success', async () => {
    const wrapper = mountOpenModal()
    const membersStore = useMembersStore()
    await flushPromises()

    await wrapper.find('.remove-btn').trigger('click')
    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.text()).toContain('Remove Other Member from Design Team?')
    await dialog.get('.shell-confirm-actions button:last-child').trigger('click')
    await flushPromises()

    expect(api.removeMember).toHaveBeenCalledWith('workspace-1', 'team-1', 'target-user')
    expect(api.getMembers).toHaveBeenCalledTimes(2)
    expect(membersStore.members).toHaveLength(2)
    expect(wrapper.text()).toContain('Team member deleted successfully')
  })

  it('disables member actions while a remove request is pending', async () => {
    const wrapper = mountOpenModal()
    let finishRemove
    api.removeMember.mockReturnValue(
      new Promise((resolve) => {
        finishRemove = resolve
      }),
    )
    await flushPromises()

    await wrapper.find('.remove-btn').trigger('click')
    await wrapper
      .get('[role="alertdialog"] .shell-confirm-actions button:last-child')
      .trigger('click')
    expect(wrapper.find('.remove-btn').attributes('disabled')).toBeDefined()

    finishRemove({ success: true })
    await flushPromises()
  })

  it('shows clear errors and enters read-only state for a forbidden removal', async () => {
    const wrapper = mountOpenModal()
    api.removeMember.mockRejectedValue({ status: 403, message: 'Forbidden' })
    await flushPromises()

    await wrapper.find('.remove-btn').trigger('click')
    await wrapper
      .get('[role="alertdialog"] .shell-confirm-actions button:last-child')
      .trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('The list is read-only.')
    expect(wrapper.get('[role="alertdialog"] [role="alert"]').text()).toBe('Forbidden')
    expect(wrapper.find('.remove-btn').exists()).toBe(false)
  })

  it('shows a clear 404 removal error', async () => {
    const wrapper = mountOpenModal()
    api.removeMember.mockRejectedValue({ status: 404, message: 'Not found' })
    await flushPromises()

    await wrapper.find('.remove-btn').trigger('click')
    await wrapper
      .get('[role="alertdialog"] .shell-confirm-actions button:last-child')
      .trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alertdialog"] [role="alert"]').text()).toBe('Not found')
  })
})
