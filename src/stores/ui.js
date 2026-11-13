import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// UI state store: selected channel, sidebar visibility, modal states.
// Server data (messages, channels from the API) does NOT belong here.
export const useUiStore = defineStore('ui', () => {
  const PINNED_MESSAGES_STORAGE_KEY = 'whistleit:pinned-messages'
  const LEGACY_POLL_HISTORY_STORAGE_KEY = 'whistleit:channel-poll-history'

  try {
    localStorage.removeItem(LEGACY_POLL_HISTORY_STORAGE_KEY)
  } catch (error) {
    console.error('Unable to remove cached channel poll history:', error)
  }

  function loadPinnedMessages() {
    try {
      const saved = JSON.parse(localStorage.getItem(PINNED_MESSAGES_STORAGE_KEY) || '[]')
      return Array.isArray(saved) ? saved : []
    } catch (error) {
      console.error('Unable to load pinned messages:', error)
      return []
    }
  }

  function persistPinnedMessages() {
    try {
      localStorage.setItem(PINNED_MESSAGES_STORAGE_KEY, JSON.stringify(pinnedMessages.value))
    } catch (error) {
      console.error('Unable to save pinned messages:', error)
    }
  }

  // state
  const selectedChannelId = ref(null)
  const sidebarOpen = ref(true)
  const activePanel = ref(null)
  const channelSettingsOpen = ref(false)
  const channelSettingsTab = ref('settings')
  const toasts = ref([])
  const pinnedMessages = ref(loadPinnedMessages())
  const polls = ref([])
  let nextToastId = 0

  // modal visibility flags
  const teamCreateModalOpen = ref(false)
  const memberManageModalOpen = ref(false)

  // getters
  const hasSelection = computed(() => selectedChannelId.value !== null)
  const helpModalOpen = computed(() => activePanel.value === 'help')

  // actions
  function selectChannel(id) {
    selectedChannelId.value = id
  }
  function openChannelSettings(tab = 'settings') {
    channelSettingsTab.value = tab
    channelSettingsOpen.value = true
  }
  function closeChannelSettings() {
    channelSettingsOpen.value = false
  }
  function toast(title, body, type = 'info') {
    const id = ++nextToastId
    toasts.value.push({ id, title, body, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter((item) => item.id !== id)
    }, 5000)
  }
  function dismissToast(id) {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }
  function addPoll(message, conversation) {
    const content = message.content || message.text || ''
    const pollData = message.poll || {}
    const titleMatch = content.match(/^Poll:\s*(.+)$/m)
    if (!titleMatch && !message.poll && message.poll_id == null && message.pollId == null) return
    const pollId = pollData.id ?? message.poll_id ?? message.pollId ?? message.id ?? Date.now()
    const scheduleStart =
      pollData.scheduleStart ?? pollData.schedule_start ?? pollData.start_at ?? ''
    const scheduleClose =
      pollData.scheduleClose ?? pollData.schedule_close ?? pollData.close_at ?? ''
    const status = String(pollData.status ?? '').toLowerCase()
    const closed =
      pollData.closed === true ||
      pollData.is_closed === true ||
      ['closed', 'complete', 'completed'].includes(status)
    const startsAt = Date.parse(scheduleStart)
    const poll = {
      ...pollData,
      id: String(pollId),
      title:
        pollData.title ??
        pollData.question ??
        message.poll_title ??
        message.pollTitle ??
        titleMatch?.[1]?.trim() ??
        content,
      content,
      conversation,
      createdAt: message.createdAt || new Date().toISOString(),
      scheduleStart,
      scheduleClose,
      status: closed
        ? 'Closed'
        : status === 'scheduled' || (Number.isFinite(startsAt) && startsAt > Date.now())
          ? 'Scheduled'
          : 'Open',
      audience: pollData.audience ?? pollData.audience_responses ?? 'public',
    }
    const existingIndex = polls.value.findIndex(
      (item) =>
        String(item.id) === poll.id &&
        String(item.conversation?.id ?? '') === String(conversation?.id ?? ''),
    )
    if (existingIndex === -1) polls.value.unshift(poll)
    else polls.value[existingIndex] = { ...polls.value[existingIndex], ...poll }
  }
  function togglePinnedMessage(message, conversation) {
    const id = String(message.id)
    const conversationId = String(conversation?.id ?? message.conversation?.id ?? '')
    const conversationKind =
      conversation?.kind === 'dm' || conversation?.type === 'dm' ? 'dm' : 'channel'
    const existingIndex = pinnedMessages.value.findIndex((item) => {
      const itemConversation = item.conversation || {}
      const itemKind =
        itemConversation.kind === 'dm' || itemConversation.type === 'dm' ? 'dm' : 'channel'
      return (
        String(item.id) === id &&
        String(itemConversation.id ?? '') === conversationId &&
        itemKind === conversationKind
      )
    })
    if (existingIndex !== -1) {
      pinnedMessages.value.splice(existingIndex, 1)
      persistPinnedMessages()
      return false
    }
    pinnedMessages.value.unshift({ ...message, conversation })
    persistPinnedMessages()
    return true
  }
  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  // panel controls (reminders, search, help)
  function openPanel(panel) {
    activePanel.value = activePanel.value === panel ? null : panel
  }
  function closePanel() {
    activePanel.value = null
  }

  // modal & drawer toggles
  function toggleHelpModal() {
    openPanel('help')
  }
  function toggleTeamCreateModal() {
    teamCreateModalOpen.value = !teamCreateModalOpen.value
  }
  function toggleMemberManageModal() {
    memberManageModalOpen.value = !memberManageModalOpen.value
  }

  return {
    selectedChannelId,
    sidebarOpen,
    activePanel,
    channelSettingsOpen,
    channelSettingsTab,
    toasts,
    pinnedMessages,
    polls,
    addPoll,
    togglePinnedMessage,
    hasSelection,
    selectChannel,
    openPanel,
    closePanel,
    openChannelSettings,
    closeChannelSettings,
    toast,
    dismissToast,
    toggleSidebar,
    helpModalOpen,
    teamCreateModalOpen,
    memberManageModalOpen,
    toggleHelpModal,
    toggleTeamCreateModal,
    toggleMemberManageModal,
  }
})
