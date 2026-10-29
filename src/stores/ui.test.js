import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'

describe('ui store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts with no channel selected', () => {
    const ui = useUiStore()
    expect(ui.selectedChannelId).toBeNull()
    expect(ui.hasSelection).toBe(false)
  })

  it('selects a channel', () => {
    const ui = useUiStore()
    ui.selectChannel('general')
    expect(ui.selectedChannelId).toBe('general')
    expect(ui.hasSelection).toBe(true)
  })

  it('toggles the sidebar', () => {
    const ui = useUiStore()
    ui.toggleSidebar()
    expect(ui.sidebarOpen).toBe(false)
  })

  it('opens and closes search panels and channel settings', () => {
    const ui = useUiStore()

    ui.openPanel('search')
    expect(ui.activePanel).toBe('search')
    ui.closePanel()
    expect(ui.activePanel).toBeNull()

    ui.openChannelSettings()
    expect(ui.channelSettingsOpen).toBe(true)
    ui.closeChannelSettings()
    expect(ui.channelSettingsOpen).toBe(false)
  })

  it('toggles modals properly', () => {
    const ui = useUiStore()

    expect(ui.helpModalOpen).toBe(false)
    ui.toggleHelpModal()
    expect(ui.helpModalOpen).toBe(true)

    expect(ui.workspaceCreateModalOpen).toBe(false)
    ui.toggleWorkspaceCreateModal()
    expect(ui.workspaceCreateModalOpen).toBe(true)

    expect(ui.teamCreateModalOpen).toBe(false)
    ui.toggleTeamCreateModal()
    expect(ui.teamCreateModalOpen).toBe(true)

    expect(ui.teamJoinModalOpen).toBe(false)
    ui.toggleTeamJoinModal()
    expect(ui.teamJoinModalOpen).toBe(true)

    expect(ui.memberManageModalOpen).toBe(false)
    ui.toggleMemberManageModal()
    expect(ui.memberManageModalOpen).toBe(true)
  })
})
