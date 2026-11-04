import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetUserStore, useUserStore } from '@/features/account/composables/useUserStore'
import { useTeamsStore } from '@/stores/teams'

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  resolve: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => routerMock,
}))

vi.mock('./WorkspaceSwitcher.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      emits: ['select'],
      setup(_, { emit }) {
        return () =>
          h(
            'button',
            {
              class: 'test-workspace-select',
              onClick: () => emit('select', 'workspace-2'),
            },
            'Workspace 2',
          )
      },
    }),
  }
})

import TeamRail from './TeamRail.vue'

describe('team rail workspace preference', () => {
  let wrapper
  let teamsStore
  let openMock

  beforeEach(() => {
    setActivePinia(createPinia())
    resetUserStore()
    teamsStore = useTeamsStore()
    teamsStore.$patch({
      workspaces: [{ id: 'workspace-1' }, { id: 'workspace-2' }],
      activeWorkspaceId: 'workspace-1',
      activeTeamId: 'team-1',
      teamsByWorkspaceId: {
        'workspace-1': [{ id: 'team-1', name: 'Team 1' }],
        'workspace-2': [{ id: 'team-2', name: 'Team 2' }],
      },
    })
    routerMock.push.mockReset()
    routerMock.resolve.mockReset().mockReturnValue({ href: '/app/workspace-2' })
    openMock = vi.fn()
    vi.stubGlobal('open', openMock)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    resetUserStore()
    vi.unstubAllGlobals()
  })

  it('switches in the current tab by default', async () => {
    vi.spyOn(teamsStore, 'selectWorkspace').mockImplementation(async (id) => {
      teamsStore.activeWorkspaceId = id
      teamsStore.activeTeamId = 'team-2'
    })
    wrapper = mount(TeamRail)

    await wrapper.get('.test-workspace-select').trigger('click')

    expect(teamsStore.selectWorkspace).toHaveBeenCalledWith('workspace-2')
    expect(routerMock.push).toHaveBeenCalledWith({
      name: 'workspace-team',
      params: { workspaceId: 'workspace-2', teamId: 'team-2' },
    })
    expect(openMock).not.toHaveBeenCalled()
  })

  it('opens the selected workspace in a new tab when configured', async () => {
    useUserStore().hydrate({ preferences: { workspaceSwitch: 'new' } })
    const selectWorkspace = vi.spyOn(teamsStore, 'selectWorkspace')
    wrapper = mount(TeamRail)

    await wrapper.get('.test-workspace-select').trigger('click')

    expect(routerMock.resolve).toHaveBeenCalledWith({ path: '/app/workspace-2' })
    expect(openMock).toHaveBeenCalledWith(
      '/app/workspace-2',
      '_blank',
      'noopener,noreferrer',
    )
    expect(selectWorkspace).not.toHaveBeenCalled()
    expect(routerMock.push).not.toHaveBeenCalled()
  })
})
