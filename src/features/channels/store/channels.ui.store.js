import { ref } from 'vue'
import { defineStore } from 'pinia'

// UI-only state (which dialog is open). Kept separate from data so header, sidebar
// and menus can all open the same dialogs, which are mounted once in <ChannelDialogs />.
export const useChannelsUiStore = defineStore('channelsUi', () => {
  const form = ref({ open: false, mode: 'create', channelId: null })
  const browseOpen = ref(false)
  // `channel` is a snapshot ({ id, name, isPrivate }) so the dialog survives the channel leaving the list.
  const confirm = ref({ open: false, type: null, channel: null })
  const toast = ref(null)
  let toastTimer = null

  function openCreate() {
    browseOpen.value = false
    form.value = { open: true, mode: 'create', channelId: null }
  }
  function openEdit(channelId) {
    form.value = { open: true, mode: 'edit', channelId: String(channelId) }
  }
  function closeForm() {
    form.value = { ...form.value, open: false }
  }

  function openBrowse() {
    browseOpen.value = true
  }
  function closeBrowse() {
    browseOpen.value = false
  }

  function openConfirm(type, channel) {
    confirm.value = {
      open: true,
      type,
      channel: { id: channel.id, name: channel.name, isPrivate: channel.isPrivate },
    }
  }
  function closeConfirm() {
    confirm.value = { open: false, type: null, channel: null }
  }

  function notify(message, type = 'error') {
    toast.value = { message, type }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = null
    }, 4000)
  }

  return {
    form, browseOpen, confirm, toast,
    openCreate, openEdit, closeForm, openBrowse, closeBrowse, openConfirm, closeConfirm, notify,
  }
})
