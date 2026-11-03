import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// UI state store: selected channel, sidebar visibility, modal states.
// Server data (messages, channels from the API) does NOT belong here.
export const useUiStore = defineStore('ui', () => {
  // state
  const selectedChannelId = ref(null)
  const sidebarOpen = ref(true)
  const activePanel = ref(null)
  const channelSettingsOpen = ref(false)
  const channelSettingsTab = ref('settings')
  const toasts = ref([])
  const pinnedMessages = ref([])
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
    const titleMatch = content.match(/^Poll:\s*(.+)$/m)
    if (!titleMatch) return
    const existing = polls.value.some((poll) => poll.id === String(message.id))
    if (existing) return
    polls.value.unshift({
      id: String(message.id || Date.now()),
      title: titleMatch[1].trim(),
      content,
      conversation,
      createdAt: message.createdAt || new Date().toISOString(),
      status: 'Open',
    })
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
      return false
    }
    pinnedMessages.value.unshift({ ...message, conversation })
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
