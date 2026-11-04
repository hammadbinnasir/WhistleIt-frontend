import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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
const teamApi = vi.hoisted(() => ({
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
}))

vi.mock('@/features/shell/api/membersApi', () => memberApi)
vi.mock('@/features/shell/api/teamsApi', () => ({
  createTeam: teamApi.createTeam,
  updateTeam: teamApi.updateTeam,
  deleteTeam: teamApi.deleteTeam,
}))
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
  teamApi.deleteTeam.mockResolvedValue({ success: true })
  memberApi.removeMember.mockResolvedValue({
    success: true,
    message: 'You left the team successfully.',
  })
})

describe('admin-only team controls', () => {
  it('shows team creation in the rail only to admins', async () => {
    const { pinia } = setupStores('admin')
    const wrapper = remember(mount(TeamRail, { global: { plugins: [pinia, await setupRouter()] } }))
    const trigger = wrapper.get('[aria-label="Team actions"]').element
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      left: 22,
      right: 52,
      top: 420,
      bottom: 450,
      width: 30,
      height: 30,
    })

    await wrapper.get('[aria-label="Team actions"]').trigger('click')
    await flushPromises()

    const menu = document.body.querySelector('[role="menu"]')
    expect(menu?.querySelector('[role="menuitem"]')?.textContent).toBe('Create a team')
    expect(Number.parseFloat(menu.style.left)).toBe(82)
    expect(document.body.textContent).not.toContain('Join a team')
  })

  it('hides team creation in the rail for non-admins', async () => {
    const { pinia } = setupStores('member')
    const wrapper = remember(mount(TeamRail, { global: { plugins: [pinia, await setupRouter()] } }))

    expect(wrapper.find('[aria-label="Team actions"]').exists()).toBe(false)
  })

  it('keeps team switching and member viewing while hiding write actions for non-admins', async () => {
    const { pinia } = setupStores('member')
    remember(
      mount(TeamSwitcher, {
        props: { isOpen: true },
        global: { plugins: [pinia, await setupRouter()] },
      }),
    )

    const menuText = document.body.querySelector('.team-switcher').textContent
    expect(menuText).toContain('Design')
    expect(menuText).toContain('Manage members')
    expect(menuText).toContain('Leave team')
    expect(menuText).not.toContain('Create a team')
    expect(menuText).not.toContain('Edit team')
    expect(menuText).not.toContain('Delete team')
  })

  it('shows team write actions for admins', async () => {
    const { pinia } = setupStores('admin')
    remember(
      mount(TeamSwitcher, {
        props: { isOpen: true },
        global: { plugins: [pinia, await setupRouter()] },
      }),
    )

    const menuText = document.body.querySelector('.team-switcher').textContent
    expect(menuText).toContain('Create a team')
    expect(menuText).toContain('Edit team')
    expect(menuText).toContain('Delete team')
    expect(menuText).toContain('Leave team')
  })

  it('uses the danger dialog for deletion and displays backend errors inline', async () => {
    const { pinia } = setupStores('admin')
    const wrapper = remember(
      mount(TeamSwitcher, {
        props: { isOpen: true },
        global: { plugins: [pinia, await setupRouter()] },
      }),
    )
    teamApi.deleteTeam.mockRejectedValueOnce(new Error('Deletion is blocked by policy.'))

    document.body.querySelector('.team-switcher__danger').click()
    await flushPromises()
    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.text()).toContain("Delete the team Design? This can't be undone.")
    expect(dialog.find('.shell-danger-button').exists()).toBe(true)

    await dialog.get('.shell-danger-button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Deletion is blocked by policy.')
    expect(teamApi.deleteTeam).toHaveBeenCalledWith('workspace-1', 'team-1')
  })

  it('filters team rows and renders a no-results state', async () => {
    const { pinia } = setupStores('member', [
      { id: 'team-1', name: 'Design', workspaceId: 'workspace-1' },
      { id: 'team-2', name: 'Engineering', workspaceId: 'workspace-1' },
    ])
    const router = await setupRouter()
    remember(
      mount(TeamSwitcher, {
        props: { isOpen: true },
        global: { plugins: [pinia, router] },
      }),
    )
    const search = document.body.querySelector('.team-switcher__search input')

    expect(search.placeholder).toBe('Search teams')
    search.value = 'Design'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(document.body.querySelectorAll('.team-switcher__team')).toHaveLength(1)

    search.value = 'missing'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(document.body.querySelector('.team-switcher__empty')?.textContent.trim()).toBe(
      'No teams found',
    )
  })

  it('moves through team menu items with arrow keys', async () => {
    const { pinia } = setupStores('admin')
    const wrapper = remember(
      mount(TeamSwitcher, {
        props: { isOpen: true },
        global: { plugins: [pinia] },
      }),
    )
    await flushPromises()
    const menuItems = document.body.querySelectorAll('.team-switcher [role="menuitem"]')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(menuItems[0])

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(menuItems[1])
    expect(wrapper.exists()).toBe(true)
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
    const leaveButton = [...document.body.querySelectorAll('.team-switcher__actions button')].find(
      (button) => button.textContent.includes('Leave team'),
    )
    leaveButton.click()
    await flushPromises()
    const dialog = wrapper.get('[role="alertdialog"]')
    expect(dialog.text()).toContain('Leave Design? You will lose access to this team.')
    await dialog.get('.shell-confirm-actions button:last-child').trigger('click')
    await flushPromises()

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
    const leaveButton = [...document.body.querySelectorAll('.team-switcher__actions button')].find(
      (button) => button.textContent.includes('Leave team'),
    )
    leaveButton.click()
    await flushPromises()
    await wrapper
      .get('[role="alertdialog"] .shell-confirm-actions button:last-child')
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

  it('does not use native confirm or alert dialogs in shell source files', () => {
    const shellPath = join(process.cwd(), 'src', 'features', 'shell')
    const sourceFiles = []
    const visit = (directory) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) visit(path)
        else if (/\.(?:js|vue)$/.test(entry.name) && !entry.name.endsWith('.test.js')) {
          sourceFiles.push(path)
        }
      }
    }
    visit(shellPath)

    for (const path of sourceFiles) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/\b(?:window\.)?(?:confirm|alert)\s*\(/)
    }
  })
})
