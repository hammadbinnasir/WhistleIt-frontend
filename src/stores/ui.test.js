import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from './ui'

describe('ui store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

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

  it('scopes pinned messages to their conversation', () => {
    const ui = useUiStore()
    const message = { id: 'same-id', content: 'Pinned' }

    ui.togglePinnedMessage(message, { id: 'general', name: 'General' })
    ui.togglePinnedMessage(message, { id: 'random', name: 'Random' })
    expect(ui.pinnedMessages).toHaveLength(2)

    ui.togglePinnedMessage(message, { id: 'general', name: 'General' })
    expect(ui.pinnedMessages).toHaveLength(1)
    expect(ui.pinnedMessages[0].conversation.name).toBe('Random')
  })

  it('persists pinned messages across store refreshes', () => {
    localStorage.clear()
    const ui = useUiStore()
    ui.togglePinnedMessage(
      { id: 'message-1', content: 'Keep this pin' },
      { id: 'general', name: 'General' },
    )

    setActivePinia(createPinia())
    const refreshedStore = useUiStore()
    expect(refreshedStore.pinnedMessages).toEqual([
      expect.objectContaining({
        id: 'message-1',
        content: 'Keep this pin',
        conversation: { id: 'general', name: 'General' },
      }),
    ])
  })

  it('records plain-title channel polls and restores them after a store refresh', () => {
    const ui = useUiStore()
    ui.addPoll(
      {
        id: 'poll-message-1',
        poll_id: 'poll-1',
        content: 'My poll',
        createdAt: '2026-11-11T10:00:00.000Z',
        poll: { id: 'poll-1', title: 'My poll', audience: 'public' },
      },
      { id: 'channel-1', name: 'Research', kind: 'public' },
    )

    expect(ui.polls).toContainEqual(
      expect.objectContaining({
        id: 'poll-1',
        title: 'My poll',
        conversation: { id: 'channel-1', name: 'Research', kind: 'public' },
      }),
    )
    expect(
      JSON.parse(localStorage.getItem('whistleit:channel-poll-history'))['channel-1'],
    ).toHaveLength(1)

    setActivePinia(createPinia())
    expect(useUiStore().polls).toContainEqual(
      expect.objectContaining({ id: 'poll-1', title: 'My poll' }),
    )
  })

  it('persists scheduled poll status and updates it to closed', () => {
    const ui = useUiStore()
    const conversation = { id: 'channel-1', name: 'Research', kind: 'public' }
    const scheduledPoll = {
      id: 'message-1',
      content: 'Future poll',
      poll: {
        id: 'server-poll-1',
        title: 'Future poll',
        scheduleStart: '2099-11-11T12:00:00.000Z',
      },
    }

    ui.addPoll(scheduledPoll, conversation)
    expect(ui.polls[0].status).toBe('Scheduled')

    ui.addPoll(
      { ...scheduledPoll, poll: { ...scheduledPoll.poll, closed: true, status: 'Closed' } },
      conversation,
    )
    expect(ui.polls[0].status).toBe('Closed')
    expect(
      JSON.parse(localStorage.getItem('whistleit:channel-poll-history'))['channel-1'][0].status,
    ).toBe('Closed')

    setActivePinia(createPinia())
    expect(useUiStore().polls[0].status).toBe('Closed')
  })

  it('opens and closes search panels and channel settings', () => {
    const ui = useUiStore()

    ui.openPanel('search')
    expect(ui.activePanel).toBe('search')
    ui.closePanel()
    expect(ui.activePanel).toBeNull()

    ui.openChannelSettings()
    expect(ui.channelSettingsOpen).toBe(true)
    expect(ui.channelSettingsTab).toBe('settings')
    ui.closeChannelSettings()
    expect(ui.channelSettingsOpen).toBe(false)

    ui.openChannelSettings('members')
    expect(ui.channelSettingsOpen).toBe(true)
    expect(ui.channelSettingsTab).toBe('members')
  })

  it('toggles modals properly', () => {
    const ui = useUiStore()

    expect(ui.helpModalOpen).toBe(false)
    ui.toggleHelpModal()
    expect(ui.helpModalOpen).toBe(true)

    expect(ui.teamCreateModalOpen).toBe(false)
    ui.toggleTeamCreateModal()
    expect(ui.teamCreateModalOpen).toBe(true)

    expect(ui.memberManageModalOpen).toBe(false)
    ui.toggleMemberManageModal()
    expect(ui.memberManageModalOpen).toBe(true)
  })
})
