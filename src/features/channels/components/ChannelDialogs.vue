<script setup>
import { computed, ref, watch } from 'vue'
import { useChannelsStore } from '../store/channels.store'
import { useChannelsUiStore } from '../store/channels.ui.store'
import { useActiveChannel } from '../composables/useActiveChannel'
import ChannelFormModal from './ChannelFormModal.vue'
import ChannelConfirmModal from './ChannelConfirmModal.vue'
import BrowseChannelsModal from './BrowseChannelsModal.vue'

// Mounted ONCE (inside <ChannelSidebar />). Every dialog and the toast of the module live here.
const store = useChannelsStore()
const ui = useChannelsUiStore()
const { activeId, select } = useActiveChannel()

const confirmBusy = ref(false)
const confirmError = ref('')

const editingChannel = computed(() => (ui.form.channelId ? store.getById(ui.form.channelId) : null))
const showForm = computed(() => ui.form.open && (ui.form.mode === 'create' || !!editingChannel.value))

watch(
  () => ui.confirm.open,
  () => {
    confirmError.value = ''
    confirmBusy.value = false
  },
)

function onFormSaved(channel) {
  const wasCreate = ui.form.mode === 'create'
  ui.closeForm()
  if (wasCreate) {
    ui.notify(`Channel "${channel.name}" created`, 'success')
    select(channel.id)
  } else {
    ui.notify('Channel updated', 'success')
  }
}

function onBrowseOpen(channel) {
  ui.closeBrowse()
  select(channel.id)
}

async function runConfirm() {
  const { type, channel } = ui.confirm
  if (!channel) return
  confirmBusy.value = true
  confirmError.value = ''
  try {
    if (type === 'leave') await store.leaveChannel(channel.id)
    else await store.archiveChannel(channel.id)
    ui.closeConfirm()
    ui.notify(type === 'leave' ? `You left ${channel.name}` : `${channel.name} archived`, 'success')

    // If the user was looking at that channel, move them somewhere valid.
    // (the sidebar's ensureSelection() then picks a valid channel automatically)
    if (activeId.value === String(channel.id)) {
      const fallback = store.visibleChannels.find((c) => c.isDefault) || store.visibleChannels[0]
      if (fallback) select(fallback.id)
    }
  } catch (err) {
    confirmError.value = err?.message || 'Something went wrong. Please try again.'
  } finally {
    confirmBusy.value = false
  }
}
</script>

<template>
  <ChannelFormModal
    v-if="showForm"
    :key="`${ui.form.mode}-${ui.form.channelId}`"
    :mode="ui.form.mode"
    :channel="editingChannel"
    @close="ui.closeForm()"
    @saved="onFormSaved"
  />

  <BrowseChannelsModal
    v-if="ui.browseOpen"
    @close="ui.closeBrowse()"
    @open="onBrowseOpen"
    @create="ui.openCreate()"
  />

  <ChannelConfirmModal
    v-if="ui.confirm.open && ui.confirm.channel"
    :type="ui.confirm.type"
    :channel-name="ui.confirm.channel.name"
    :is-private="ui.confirm.channel.isPrivate"
    :busy="confirmBusy"
    :error="confirmError"
    @confirm="runConfirm"
    @close="ui.closeConfirm()"
  />

  <Teleport to="body">
    <div v-if="ui.toast" class="ch-toast" :class="`ch-toast--${ui.toast.type}`" role="status" aria-live="polite">
      {{ ui.toast.message }}
    </div>
  </Teleport>
</template>

<style scoped>
.ch-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 3000;
  max-width: calc(100vw - 32px);
  padding: 12px 20px;
  transform: translateX(-50%);
  border-radius: 6px;
  font-size: 14px;
  color: #fff;
  background: #2d2a3e;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}
.ch-toast--error {
  background: var(--ch-danger);
}
.ch-toast--success {
  background: #2e7d4f;
}
</style>
