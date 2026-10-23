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

  // modal visibility flags
  const helpModalOpen = ref(false)
  const teamCreateModalOpen = ref(false)
  const teamJoinModalOpen = ref(false)
  const memberManageModalOpen = ref(false)

  // getters
  const hasSelection = computed(() => selectedChannelId.value !== null)

  // actions
  function selectChannel(id) {
    selectedChannelId.value = id
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
    activePanel.value = activePanel.value === 'help' ? null : 'help'
    helpModalOpen.value = activePanel.value === 'help'
  }
  function toggleTeamCreateModal() {
    teamCreateModalOpen.value = !teamCreateModalOpen.value
  }
  function toggleTeamJoinModal() {
    teamJoinModalOpen.value = !teamJoinModalOpen.value
  }
  function toggleMemberManageModal() {
    memberManageModalOpen.value = !memberManageModalOpen.value
  }

  function toast(title, body) {
    const id = Date.now()
    toasts.value.push({ id, title, body })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, 5000)
  }

  return {
    selectedChannelId,
    sidebarOpen,
    activePanel,
    channelSettingsOpen,
    channelSettingsTab,
    toasts,
    hasSelection,
    selectChannel,
    toggleSidebar,
    helpModalOpen,
    teamCreateModalOpen,
    teamJoinModalOpen,
    openPanel,
    closePanel,
    toggleHelpModal,
    toggleTeamCreateModal,
    toggleTeamJoinModal,
    toggleMemberManageModal,
    toast,
  }
})
