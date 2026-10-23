<script setup>
import { ref, computed } from 'vue'
import AccountGeneral from './account/AccountGeneral.vue'
import AccountSecurity from './account/AccountSecurity.vue'
import AccountPreferences from './account/AccountPreferences.vue'

const props = defineProps({
  initialTab: {
    type: String,
    default: 'general',
    validator: (v) => ['general', 'security', 'notifications', 'preferences'].includes(v),
  },
  profile: { type: Object, default: () => ({}) },
  preferences: { type: Object, default: () => ({}) },
  security: { type: Object, default: () => ({}) },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'close'])

const tabs = [
  { id: 'general', label: 'General', title: 'General Settings', icon: 'general' },
  { id: 'security', label: 'Security', title: 'Security Settings', icon: 'security' },
  { id: 'notifications', label: 'Notifications', title: 'Notification Settings', icon: 'bell' },
  {
    id: 'preferences',
    label: 'User Preferences',
    title: 'User Preferences Settings',
    icon: 'prefs',
  },
]

const activeTab = ref(props.initialTab)
const activeTitle = computed(() => tabs.find((t) => t.id === activeTab.value).title)

const generalRef = ref(null)
const securityRef = ref(null)
const prefsRef = ref(null)

const onSave = () => {
  if (props.saving) return

  const generalOk = generalRef.value.validate()
  const securityOk = securityRef.value.validate()

  if (!generalOk) {
    activeTab.value = 'general'
    return
  }
  if (!securityOk) {
    activeTab.value = 'security'
    return
  }

  const { profile, photo } = generalRef.value.getValues()
  const { security, password } = securityRef.value.getValues()
  const { preferences } = prefsRef.value.getValues()

  emit('save', { profile, photo, preferences, security, password })
}
</script>

<template>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <header class="header">
      <h2 id="settings-title" class="header-title">Account Settings</h2>
      <button class="close" aria-label="Close" @click="emit('close')">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.8"
          stroke-linecap="round"
        >
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      </button>
    </header>

    <div class="body">
      <!-- Sidebar -->
      <nav class="sidebar" role="tablist" aria-orientation="vertical">
        <button
          v-for="tab in tabs"
          :id="`settings-tab-${tab.id}`"
          :key="tab.id"
          class="tab"
          :class="{ active: activeTab === tab.id }"
          role="tab"
          :aria-selected="activeTab === tab.id"
          :aria-controls="`settings-panel-${tab.id}`"
          @click="activeTab = tab.id"
        >
          <svg
            class="tab-icon"
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <!-- general: person + gear -->
            <template v-if="tab.icon === 'general'">
              <circle cx="12" cy="10" r="4.5" />
              <path d="M3 25v-2a6 6 0 0 1 6-6h4" />
              <circle cx="23" cy="22" r="2.6" />
              <path
                d="M23 17.5v1.4M23 25.1v1.4M18.5 22h1.4M26.1 22h1.4M19.8 18.8l1 1M25.2 24.2l1 1M26.2 18.8l-1 1M20.8 24.2l-1 1"
              />
            </template>
            <!-- security: lock + check -->
            <template v-else-if="tab.icon === 'security'">
              <path d="M10 13V9.5a6 6 0 0 1 12 0V13" />
              <path d="M7 13h18v6.5" />
              <path d="M7 13v13h9" />
              <circle cx="16" cy="19" r="1.6" />
              <path d="M20 25l2.5 2.5L28 21.5" />
            </template>
            <!-- bell -->
            <template v-else-if="tab.icon === 'bell'">
              <path d="M7 23h18l-2-3v-6a7 7 0 0 0-14 0v6z" />
              <path d="M13.5 26.5a2.5 2.5 0 0 0 5 0" />
              <path d="M16 5v2" />
            </template>
            <!-- prefs: person + wrench -->
            <template v-else-if="tab.icon === 'prefs'">
              <circle cx="12" cy="10" r="4.5" />
              <path d="M3 25v-2a6 6 0 0 1 6-6h4" />
              <path
                d="M27 17.5a4 4 0 0 1-5.2 4.9l-5.3 5.3a1.6 1.6 0 0 1-2.3-2.3l5.3-5.3a4 4 0 0 1 4.9-5.2l-2.4 2.4.4 2 2 .4z"
              />
            </template>
          </svg>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Content: every panel stays mounted (v-show) so unsaved input survives tab switches -->
      <section class="content">
        <h3 class="content-title">{{ activeTitle }}</h3>

        <div
          id="settings-panel-general"
          v-show="activeTab === 'general'"
          role="tabpanel"
          aria-labelledby="settings-tab-general"
        >
          <AccountGeneral ref="generalRef" :profile="profile" />
        </div>

        <div
          id="settings-panel-security"
          v-show="activeTab === 'security'"
          role="tabpanel"
          aria-labelledby="settings-tab-security"
        >
          <AccountSecurity ref="securityRef" :security="security" />
        </div>

        <div
          id="settings-panel-notifications"
          v-show="activeTab === 'notifications'"
          role="tabpanel"
          aria-labelledby="settings-tab-notifications"
        >
          <p class="placeholder">Settings for this section go here.</p>
        </div>

        <div
          id="settings-panel-preferences"
          v-show="activeTab === 'preferences'"
          role="tabpanel"
          aria-labelledby="settings-tab-preferences"
        >
          <AccountPreferences ref="prefsRef" :preferences="preferences" />
        </div>
      </section>
    </div>

    <footer class="footer">
      <button class="btn cancel" @click="emit('close')">CANCEL</button>
      <button class="btn save" :disabled="saving" @click="onSave">
        {{ saving ? 'SAVING…' : 'SAVE' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.modal {
  display: flex;
  flex-direction: column;
  width: 1000px;
  max-width: 100%;
  height: 825px;
  max-height: calc(100vh - 32px);
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  font-family:
    'Roboto',
    -apple-system,
    'Segoe UI',
    sans-serif;
  color: #1f1f2e;
  overflow: hidden;
}

/* Header */
.header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 70px;
  border-bottom: 1px solid #e5e5e8;
  flex-shrink: 0;
}

.header-title {
  margin: 0;
  font-size: 24px;
  font-weight: 400;
  color: #1f1f2e;
}

.close {
  position: absolute;
  top: 16px;
  right: 24px;
  width: 26px;
  height: 26px;
  padding: 6px;
  border: none;
  border-radius: 50%;
  background: #e8e8f3;
  color: #2b2b3c;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close:hover {
  background: #dcdcee;
}
.close svg {
  width: 100%;
  height: 100%;
}

/* Body */
.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Sidebar */
.sidebar {
  width: 252px;
  flex-shrink: 0;
  border-right: 1px solid #e5e5e8;
  padding-top: 8px;
  box-sizing: border-box;
}

.tab {
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  height: 50px;
  padding: 0 22px;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  cursor: pointer;
  text-align: left;
  color: #1f1f2e;
  font-family: inherit;
}
.tab:hover {
  background: #f4f4f7;
}

.tab.active {
  background: #e6e6fb;
  border-left-color: #5559f4;
  color: #5559f4;
}

.tab-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  color: #676879;
}
.tab.active .tab-icon {
  color: #5559f4;
}

.tab-label {
  font-size: 17px;
  font-weight: 500;
}

/* Content */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 26px 30px 30px;
  box-sizing: border-box;
}

.content-title {
  margin: 0 0 34px;
  font-size: 24px;
  font-weight: 500;
  color: #323248;
}

.placeholder {
  color: #676879;
  font-size: 17px;
}

/* Footer */
.footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 18px;
  height: 104px;
  padding: 0 48px;
  border-top: 1px solid #e5e5e8;
  flex-shrink: 0;
  box-sizing: border-box;
}

.btn {
  font-family: inherit;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 1px;
  cursor: pointer;
  border: none;
  border-radius: 2px;
}

.cancel {
  background: transparent;
  color: #1f1f2e;
  padding: 14px 20px;
}
.cancel:hover {
  color: #5559f4;
}

.save {
  background: #5559f4;
  color: #fff;
  width: 165px;
  height: 45px;
}
.save:hover:not(:disabled) {
  background: #4448d9;
}
.save:disabled {
  background: #a5a7fa;
  cursor: wait;
}
</style>
