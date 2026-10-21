<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChannelsStore } from '../store/channels.store'
import { useChannelsUiStore } from '../store/channels.ui.store'
import { CHANNEL_ROUTE_NAME } from '../constants'
import ChannelHeader from '../components/ChannelHeader.vue'
import '../styles/tokens.css'

// Screen for /channels/:channelId?. If another teammate already owns the chat screen,
// don't use this view: put <ChannelHeader :channel-id="..."/> inside theirs instead (see README).
const route = useRoute()
const router = useRouter()
const store = useChannelsStore()
const ui = useChannelsUiStore()

const channelId = computed(() => (route.params.channelId ? String(route.params.channelId) : null))
const channel = computed(() => store.getById(channelId.value))

onMounted(() => store.fetchChannels())

// /channels (no id) -> open the default channel, or the first one.
watch(
  [() => store.loaded, channelId],
  () => {
    if (!store.loaded || channelId.value) return
    const target = store.visibleChannels.find((c) => c.isDefault) || store.visibleChannels[0]
    if (target) router.replace({ name: CHANNEL_ROUTE_NAME, params: { channelId: target.id } })
  },
  { immediate: true },
)
</script>

<template>
  <section class="ch-view">
    <p
      v-if="(store.loading && !store.loaded) || (!channelId && store.visibleChannels.length)"
      class="ch-view__state"
    >
      Loading…
    </p>

    <div v-else-if="store.error" class="ch-view__state" role="alert">
      <p>{{ store.error }}</p>
      <button
        class="ch-btn ch-btn--primary ch-btn--small"
        type="button"
        @click="store.fetchChannels({ force: true })"
      >
        Retry
      </button>
    </div>

    <div v-else-if="!channel" class="ch-view__state">
      <p>
        {{
          channelId
            ? "This channel doesn't exist or you're not a member."
            : "You haven't joined any channels yet."
        }}
      </p>
      <button class="ch-btn ch-btn--primary ch-btn--small" type="button" @click="ui.openBrowse()">
        Browse channels
      </button>
    </div>

    <template v-else>
      <ChannelHeader :channel-id="channel.id" />
      <div class="ch-view__body">
        <!-- MESSAGES MODULE MOUNTS HERE: message list + composer from the teammate who owns them. -->
      </div>
    </template>
  </section>
</template>

<style scoped>
.ch-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--ch-surface);
}
.ch-view__body {
  flex: 1;
  min-height: 0;
}
.ch-view__state {
  margin: auto;
  padding: 24px;
  text-align: center;
  color: var(--ch-muted);
}
</style>
