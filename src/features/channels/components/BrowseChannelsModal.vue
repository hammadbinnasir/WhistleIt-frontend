<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useChannelsStore } from '../store/channels.store'
import { useChannelsUiStore } from '../store/channels.ui.store'
import ChannelModal from './ChannelModal.vue'
import ChIcon from './ChIcon.vue'

// "More channels": search every channel you may see, join public ones, open the ones you're in.
const emit = defineEmits(['close', 'open', 'create'])

const store = useChannelsStore()
const ui = useChannelsUiStore()

const query = ref('')
const joiningId = ref(null)
let timer = null

onMounted(() => store.fetchBrowse(''))
onBeforeUnmount(() => clearTimeout(timer))

watch(query, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => store.fetchBrowse(value.trim()), 300)
})

async function join(channel) {
  joiningId.value = channel.id
  try {
    await store.joinChannel(channel.id)
    ui.notify(`Joined ${channel.name}`, 'success')
  } catch (err) {
    ui.notify(err?.message || 'Could not join this channel.')
  } finally {
    joiningId.value = null
  }
}
</script>

<template>
  <ChannelModal title="Browse Channels" width="600px" @close="emit('close')">
    <div class="ch-browse__tools">
      <div class="ch-browse__search">
        <ChIcon name="search" :size="16" />
        <input v-model="query" type="search" placeholder="Search channels" aria-label="Search channels" />
      </div>
      <button class="ch-btn ch-btn--primary ch-btn--small" type="button" @click="emit('create')">New channel</button>
    </div>

    <p v-if="store.browse.loading && !store.browse.items.length" class="ch-browse__state">Loading…</p>
    <p v-else-if="store.browse.error" class="ch-error" role="alert">{{ store.browse.error }}</p>
    <p v-else-if="!store.browse.items.length" class="ch-browse__state">No channels found.</p>

    <ul v-else class="ch-browse__list">
      <li v-for="channel in store.browse.items" :key="channel.id" class="ch-browse__row">
        <ChIcon :name="channel.isPrivate ? 'lock' : 'globe'" :size="18" />
        <div class="ch-browse__info">
          <div class="ch-browse__name">{{ channel.name }}</div>
          <div class="ch-browse__meta">
            {{ channel.memberCount }} {{ channel.memberCount === 1 ? 'member' : 'members' }}
            <template v-if="channel.description"> · {{ channel.description }}</template>
          </div>
        </div>
        <button
          v-if="channel.isMember"
          class="ch-btn ch-btn--ghost ch-btn--small"
          type="button"
          @click="emit('open', channel)"
        >
          Open
        </button>
        <button
          v-else
          class="ch-btn ch-btn--primary ch-btn--small"
          type="button"
          :disabled="joiningId === channel.id"
          @click="join(channel)"
        >
          {{ joiningId === channel.id ? 'Joining…' : 'Join' }}
        </button>
      </li>
    </ul>
  </ChannelModal>
</template>

<style scoped>
.ch-browse__tools {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}
.ch-browse__search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid #cfcde0;
  border-radius: 4px;
  color: var(--ch-muted);
}
.ch-browse__search:focus-within {
  border-color: var(--ch-accent);
  box-shadow: 0 0 0 1px var(--ch-accent);
}
.ch-browse__search input {
  flex: 1;
  min-width: 0;
  padding: 11px 0;
  border: 0;
  outline: none;
  font: inherit;
  font-size: 15px;
  color: var(--ch-text);
  background: transparent;
}
.ch-browse__state {
  margin: 24px 0;
  text-align: center;
  color: var(--ch-muted);
}
.ch-browse__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 340px;
  overflow-y: auto;
}
.ch-browse__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--ch-border);
  color: var(--ch-muted);
}
.ch-browse__info {
  flex: 1;
  min-width: 0;
}
.ch-browse__name {
  font-weight: 600;
  color: var(--ch-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ch-browse__meta {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
