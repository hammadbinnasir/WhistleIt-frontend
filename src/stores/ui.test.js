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
})
