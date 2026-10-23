<script setup>
import { ref } from 'vue'

const emit = defineEmits(['update-status', 'account-settings', 'leave-team', 'log-out'])

const items = ref([
  { id: 'status', label: 'Update your status', icon: 'smile', event: 'update-status' },
  { id: 'settings', label: 'Account Settings', icon: 'gear', event: 'account-settings' },
  { id: 'team', label: 'Leave Team', icon: 'team', event: 'leave-team' },
])

const logout = { id: 'logout', label: 'Log Out', icon: 'logout', event: 'log-out' }

const onSelect = (item) => emit(item.event)
</script>

<template>
  <div class="menu" role="menu">
    <ul class="menu-list">
      <li v-for="item in items" :key="item.id">
        <button class="menu-item" role="menuitem" @click="onSelect(item)">
          <svg
            class="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <template v-if="item.icon === 'smile'">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 14.5c1 1.3 2.3 2 4 2s3-.7 4-2" />
              <line x1="9" y1="9.5" x2="9" y2="10.5" />
              <line x1="15" y1="9.5" x2="15" y2="10.5" />
            </template>
            <template v-else-if="item.icon === 'gear'">
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
              />
            </template>
            <template v-else-if="item.icon === 'team'">
              <circle cx="12" cy="5.5" r="2" />
              <circle cx="5" cy="11" r="2" />
              <circle cx="19" cy="11" r="2" />
              <path d="M9 13.5h6a1 1 0 0 1 1 1V16H8v-1.5a1 1 0 0 1 1-1z" />
              <path d="M2.5 19v-2.5A1.5 1.5 0 0 1 4 15h2" />
              <path d="M21.5 19v-2.5A1.5 1.5 0 0 0 20 15h-2" />
              <path d="M3 19h18" />
            </template>
          </svg>
          <span>{{ item.label }}</span>
        </button>
      </li>
    </ul>

    <div class="divider"></div>

    <ul class="menu-list">
      <li>
        <button class="menu-item" role="menuitem" @click="onSelect(logout)">
          <svg
            class="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
            <path d="M10 12h10" />
            <path d="M16 8l4 4-4 4" />
          </svg>
          <span>{{ logout.label }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.menu {
  width: 290px;
  background: #fff;
  border: 1px solid #e5e5e8;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  padding: 8px 0;
  font-family:
    'Roboto',
    -apple-system,
    'Segoe UI',
    sans-serif;
}

.menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 18px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 17px;
  color: #1f1f2e;
}

.menu-item:hover {
  background: #f4f4f7;
}

.icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: #3b3b4f;
}

.divider {
  height: 1px;
  background: #e5e5e8;
  margin: 6px 0;
}
</style>
