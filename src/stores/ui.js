import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// UI state store: selected channel, sidebar visibility, modal states.
// Server data (messages, channels from the API) does NOT belong here.
export const useUiStore = defineStore('ui', () => {
  // state
  const selectedChannelId = ref(null)
  const sidebarOpen = ref(true)

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

  // modal toggles
  function toggleHelpModal() {
    helpModalOpen.value = !helpModalOpen.value
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

  return {
    selectedChannelId,
    sidebarOpen,
    hasSelection,
    selectChannel,
    toggleSidebar,
    helpModalOpen,
    teamCreateModalOpen,
    teamJoinModalOpen,
    memberManageModalOpen,
    toggleHelpModal,
    toggleTeamCreateModal,
    toggleTeamJoinModal,
    toggleMemberManageModal,
  }
})
