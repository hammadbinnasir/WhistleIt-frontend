import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'
import CreateTeamModal from './CreateTeamModal.vue'
import TeamRail from './TeamRail.vue'
import TeamSwitcher from './TeamSwitcher.vue'

const memberApi = vi.hoisted(() => ({
  getMembers: vi.fn(),
  getNotMembers: vi.fn(),
  addMember: vi.fn(),
  addMembers: vi.fn(),
  removeMember: vi.fn(),
}))

vi.mock('@/features/shell/api/membersApi', () => memberApi)
vi.mock('@/features/auth/session', () => ({
  getAuthUserId: () => 'self-user',
}))

const wrappers = []

function setupStores(role, teams = [{ id: 'team-1', name: 'Design', workspaceId: 'workspace-1' }]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const teamsStore = useTeamsStore()
  teamsStore.workspaces = [
    { id: 'workspace-1', name: 'Workspace', role, isAdmin: role === 'admin' },
  ]
  teamsStore.activeWorkspaceId = 'workspace-1'
  teamsStore.teamsByWorkspaceId = {
    'workspace-1': teams,
  }
  teamsStore.activeTeamId = 'team-1'
  return { pinia, teamsStore }
}

async function setupRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/app/:workspaceId', name: 'workspace-empty', component: { template: '<div />' } },
      {
        path: '/app/:workspaceId/:teamId',
        name: 'workspace-team',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/')
  await router.isReady()
  return router
}

function remember(wrapper) {
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

beforeEach(() => {
  vi.clearAllMocks()
  memberApi.removeMember.mockResolvedValue({
    success: true,
    message: 'You left the team successfully.',
  })
})

describe('admin-only team controls', () => {
  it('shows team creation in the rail only to admins', async () => {
    const { pinia } = setupStores('admin')
    const wrapper = remember(mount(TeamRail, { global: { plugins: [pinia, await setupRouter()] } }))

    await wrapper.get('[aria-label="Team actions"]').trigger('click')

    expect(document.body.querySelector('[role="menuitem"]')?.textContent).toBe('Create a team')
    expect(document.body.textContent).not.toContain('Join a team')
  })

  it('hides team creation in the rail for non-admins', async () => {
    const { pinia } = setupStores('member')
    const wrapper = remember(mount(TeamRail, { global: { plugins: [pinia, await setupRouter()] } }))

    expect(wrapper.find('[aria-label="Team actions"]').exists()).toBe(false)
  })

  it('keeps team switching and member viewing while hiding write actions for non-admins', async () => {
    const { pinia } = setupStores('member')
    const wrapper = remember(
      mount(TeamSwitcher, {
        props: { isOpen: true },
        global: { plugins: [pinia, await setupRouter()] },
      }),
    )

    expect(wrapper.text()).toContain('Design')
    expect(wrapper.text()).toContain('Manage Members')
    expect(wrapper.text()).toContain('Leave team')
    expect(wrapper.text()).not.toContain('Create a team')
    expect(wrapper.text()).not.toContain('Edit team')
    expect(wrapper.text()).not.toContain('Delete team')
  })

  it('shows team write actions for admins', async () => {
    const { pinia } = setupStores('admin')
    const wrapper = remember(
      mount(TeamSwitcher, {
        props: { isOpen: true },
        global: { plugins: [pinia, await setupRouter()] },
      }),
    )

    expect(wrapper.text()).toContain('Create a team')
    expect(wrapper.text()).toContain('Edit team')
    expect(wrapper.text()).toContain('Delete team')
    expect(wrapper.text()).toContain('Leave team')
  })

  it('lets a non-admin leave their team and navigates to the empty state when it was their only team', async () => {
    const { pinia, teamsStore } = setupStores('member')
    localStorage.setItem('whistleit:last-team:workspace-1', 'team-1')
    const router = await setupRouter()
    const wrapper = remember(
      mount(TeamSwitcher, {
        props: { isOpen: true },
        global: { plugins: [pinia, router] },
      }),
    )
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    await wrapper
      .findAll('.team-switcher__actions button')
      .find((button) => button.text() === 'Leave team')
      .trigger('click')
    await flushPromises()

    expect(confirm).toHaveBeenCalledWith('You will lose access to this team. Leave "Design"?')
    expect(memberApi.removeMember).toHaveBeenCalledWith('workspace-1', 'team-1', 'self-user')
    expect(teamsStore.teams).toEqual([])
    expect(teamsStore.activeTeamId).toBeNull()
    expect(localStorage.getItem('whistleit:last-team:workspace-1')).toBeNull()
    expect(router.currentRoute.value.path).toBe('/app/workspace-1')
  })

  it('navigates to the next team after leaving an active team', async () => {
    const { pinia, teamsStore } = setupStores('member', [
      { id: 'team-1', name: 'Design', workspaceId: 'workspace-1' },
      { id: 'team-2', name: 'Engineering', workspaceId: 'workspace-1' },
    ])
    const router = await setupRouter()
    const wrapper = remember(
      mount(TeamSwitcher, {
        props: { isOpen: true },
        global: { plugins: [pinia, router] },
      }),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await wrapper
      .findAll('.team-switcher__actions button')
      .find((button) => button.text() === 'Leave team')
      .trigger('click')
    await flushPromises()

    expect(teamsStore.activeTeamId).toBe('team-2')
    expect(router.currentRoute.value.path).toBe('/app/workspace-1/team-2')
  })

  it('does not open the create-team dialog when the workspace role is not admin', () => {
    const { pinia } = setupStores('member')
    useUiStore().teamCreateModalOpen = true
    const wrapper = remember(mount(CreateTeamModal, { global: { plugins: [pinia] } }))

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
