<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import UserAvatar from './components/UserAvatar.vue'
import UserMenu from './components/UserMenu.vue'
import StatusMenu from './components/StatusMenu.vue'
import StatusModal from './components/StatusModal.vue'
import AccountSettingsModal from './components/AccountSettingsModal.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import BaseModal from './components/BaseModal.vue'
import { useUserStore } from './composables/useUserStore'

const props = defineProps({
  /** Initial/server data: { profile, status, customStatus, preferences, security } */
  user: { type: Object, default: null },
  /** Pin the avatar to the bottom-left of the viewport. Set false to place it yourself. */
  fixed: { type: Boolean, default: true },
  avatarSize: { type: Number, default: 44 },
})

const emit = defineEmits([
  'status-change',
  'custom-status-change',
  'settings-saved',
  'leave-team',
  'log-out',
  'error',
])

const store = useUserStore()
const { state } = store

if (props.user) store.hydrate(props.user)
watch(
  () => props.user,
  (u) => u && store.hydrate(u),
  { deep: true },
)

/* ---------- UI state ---------- */
/** Only ONE popover is ever visible: null | 'menu' (UserMenu) | 'status' (StatusMenu) */
const panel = ref(null)
const statusModalOpen = ref(false)
const settingsOpen = ref(false)
const settingsTab = ref('general')
const saving = ref(false)
const leaveOpen = ref(false)
const leaving = ref(false)

const rootEl = ref(null)
const avatarBtn = ref(null)

const STATUS_LABELS = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
  dnd: 'Do Not Disturb',
}

const avatarLabel = computed(() => {
  const name = state.profile.fullName || 'Your account'
  return `${name} – ${STATUS_LABELS[state.status]}`
})

const avatarTitle = computed(() => state.profile.fullName || 'Your account')

const refocusAvatar = () => nextTick(() => avatarBtn.value?.focus())

/* ---------- popovers ---------- */
const closePanel = () => {
  panel.value = null
}

const toggleMenu = () => {
  panel.value = panel.value ? null : 'menu'
}

const onDocMouseDown = (e) => {
  if (panel.value && rootEl.value && !rootEl.value.contains(e.target)) closePanel()
}

const onDocKeydown = (e) => {
  if (e.key === 'Escape' && panel.value) {
    closePanel()
    refocusAvatar()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('keydown', onDocKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('keydown', onDocKeydown)
})

/* ---------- status ---------- */
const selectStatus = async (status) => {
  closePanel()
  try {
    await store.setStatus(status)
    emit('status-change', status)
  } catch (err) {
    emit('error', err)
  }
}

const openStatusModal = () => {
  closePanel()
  statusModalOpen.value = true
}

const closeStatusModal = () => {
  statusModalOpen.value = false
  refocusAvatar()
}

const saveCustomStatus = async ({ text, duration, expiresAt }) => {
  try {
    await store.setCustomStatus(text, { duration, expiresAt })
    emit('custom-status-change', text, { duration, expiresAt })
    closeStatusModal()
  } catch (err) {
    emit('error', err)
  }
}

const clearCustomStatus = async () => {
  try {
    await store.clearCustomStatus()
    emit('custom-status-change', '', { duration: 'never', expiresAt: null })
    closeStatusModal()
  } catch (err) {
    emit('error', err)
  }
}

/* ---------- account settings ---------- */
const openSettings = (tab = 'general') => {
  closePanel()
  settingsTab.value = tab
  settingsOpen.value = true
}

const closeSettings = () => {
  settingsOpen.value = false
  refocusAvatar()
}

const saveSettings = async (payload) => {
  saving.value = true
  try {
    await store.saveSettings(payload)
    emit('settings-saved', payload)
    closeSettings()
  } catch (err) {
    emit('error', err)
  } finally {
    saving.value = false
  }
}

/* ---------- leave team (confirmation) ---------- */
const openLeaveConfirm = () => {
  closePanel()
  leaveOpen.value = true
}

const closeLeaveConfirm = () => {
  leaveOpen.value = false
  refocusAvatar()
}

const confirmLeave = async () => {
  leaving.value = true
  try {
    await store.leaveTeam()
    emit('leave-team')
    leaveOpen.value = false
  } catch (err) {
    emit('error', err)
  } finally {
    leaving.value = false
  }
}

/* ---------- session ---------- */
const logOut = () => {
  closePanel()
  emit('log-out')
}
</script>

<template>
  <div ref="rootEl" class="user-module" :class="{ fixed }">
    <button
      ref="avatarBtn"
      type="button"
      class="avatar-btn"
      aria-haspopup="menu"
      :aria-expanded="panel !== null"
      :aria-label="avatarLabel"
      aria-describedby="user-avatar-tooltip"
      @click="toggleMenu"
    >
      <UserAvatar
        :name="state.profile.fullName"
        :src="state.profile.photoUrl"
        :status="state.status"
        :size="avatarSize"
      />
      <span id="user-avatar-tooltip" class="avatar-tooltip" role="tooltip">
        {{ avatarTitle }}
      </span>
    </button>

    <!-- Opens to the RIGHT of the avatar. UserMenu and StatusMenu take turns in the same spot. -->
    <div v-if="panel" class="popover">
      <UserMenu
        v-if="panel === 'menu'"
        @update-status="panel = 'status'"
        @account-settings="openSettings()"
        @leave-team="openLeaveConfirm"
        @log-out="logOut"
      />
      <StatusMenu
        v-else
        :model-value="state.status"
        @update:model-value="selectStatus"
        @update-custom-status="openStatusModal"
      />
    </div>

    <BaseModal v-if="statusModalOpen" @close="closeStatusModal">
      <StatusModal
        :model-value="state.customStatus"
        :duration="state.customStatusDuration"
        :expires-at="state.customStatusExpiresAt"
        @save="saveCustomStatus"
        @clear="clearCustomStatus"
        @close="closeStatusModal"
      />
    </BaseModal>

    <BaseModal v-if="settingsOpen" :close-on-backdrop="false" @close="closeSettings">
      <AccountSettingsModal
        :initial-tab="settingsTab"
        :profile="state.profile"
        :preferences="state.preferences"
        :security="state.security"
        :saving="saving"
        @save="saveSettings"
        @close="closeSettings"
      />
    </BaseModal>

    <BaseModal v-if="leaveOpen" @close="closeLeaveConfirm">
      <ConfirmModal
        title="Leave Team"
        message="Are you sure you want to leave this team?"
        confirm-text="LEAVE"
        cancel-text="CANCEL"
        :busy="leaving"
        @confirm="confirmLeave"
        @cancel="closeLeaveConfirm"
      />
    </BaseModal>
  </div>
</template>

<style scoped>
.user-module {
  position: relative;
  display: inline-block;
  font-family:
    'Roboto',
    -apple-system,
    'Segoe UI',
    sans-serif;
}

.user-module.fixed {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 1000;
}

.avatar-btn {
  /* flex (not block) removes the baseline gap under the inline avatar, so the
     menu's bottom edge lines up exactly with the avatar's bottom edge */
  position: relative;
  display: flex;
  padding: 0;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
}
.avatar-btn:focus-visible {
  outline: 2px solid #5559f4;
  outline-offset: 3px;
}

.avatar-tooltip {
  position: absolute;
  top: 50%;
  left: calc(100% + 10px);
  z-index: 2;
  padding: 6px 10px;
  border-radius: 4px;
  background: #55545d;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translate(4px, -50%);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease,
    visibility 0s linear 0.12s;
}

.avatar-btn:hover .avatar-tooltip,
.avatar-btn:focus-visible .avatar-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translate(0, -50%);
  transition-delay: 0s;
}

/* To the right of the avatar, bottom edges aligned (the avatar sits at the bottom-left) */
.popover {
  position: absolute;
  left: calc(100% + 14px);
  bottom: 0;
  z-index: 1;
  animation: popover-in 0.12s ease-out;
}

@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
