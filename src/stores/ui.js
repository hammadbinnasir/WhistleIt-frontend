import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// UI state store: selected channel, sidebar visibility.
// Server data (messages, channels from the API) does NOT belong here.
export const useUiStore = defineStore('ui', () => {
  // state
  const selectedChannelId = ref(null)
  const sidebarOpen = ref(true)
  const activePanel = ref(null)
  const channelSettingsOpen = ref(false)
  const channelSettingsTab = ref('settings')
  const toasts = ref([])

  // getters
  const hasSelection = computed(() => selectedChannelId.value !== null)

  // actions
  function selectChannel(id) {
    selectedChannelId.value = id
  }
  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function openPanel(name) {
    activePanel.value = activePanel.value === name ? null : name
  }
  function closePanel() {
    activePanel.value = null
  }
  function openChannelSettings(tab = 'settings') {
    channelSettingsTab.value = tab
    channelSettingsOpen.value = true
  }
  function closeChannelSettings() {
    channelSettingsOpen.value = false
  }
  function toast(title, body) {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, title, body })
    setTimeout(() => {
      toasts.value = toasts.value.filter((item) => item.id !== id)
    }, 6000)
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
    openPanel,
    closePanel,
    openChannelSettings,
    closeChannelSettings,
    toast,
  }
})
