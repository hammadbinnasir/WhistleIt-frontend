<script setup>
import { computed, ref, watch } from 'vue'
import { getUser } from '@/features/account/api'
import { useChannelsStore } from '../store/channels.store'
import { HEADER_AVATAR_MAX } from '../constants'
import ChIcon from './ChIcon.vue'
import MemberAvatarStack from './MemberAvatarStack.vue'
import '../styles/tokens.css'

// Drop this into any chat screen:  <ChannelHeader :channel-id="route.params.channelId" />
const props = defineProps({
  channelId: { type: [String, Number], required: true },
  maxAvatars: { type: Number, default: HEADER_AVATAR_MAX },
})
// 'members-click' lets the owner of the members panel open it. Extra header icons go in the #actions slot.
const emit = defineEmits(['members-click'])

const store = useChannelsStore()
const profileStatusByUserId = ref({})
let profileRequestVersion = 0

const channel = computed(() => store.getById(props.channelId))
const channelMembers = computed(() => store.members[String(props.channelId)])
const memberItems = computed(() =>
  (channelMembers.value?.items || []).map((member) => ({
    id: member.id,
    name: member.name || member.email || 'Channel member',
    avatarUrl: member.avatarUrl || '',
    status: member.status || profileStatusByUserId.value[member.id] || 'unknown',
    email: member.email || '',
  })),
)
watch(
  () => props.channelId,
  (channelId) => {
    profileRequestVersion += 1
    profileStatusByUserId.value = {}
    void store.fetchMembers(channelId)
  },
  { immediate: true },
)
watch(
  () =>
    (channelMembers.value?.items || [])
      .map((member) => `${member.id}:${member.status || ''}`)
      .join('|'),
  async () => {
    const requestVersion = ++profileRequestVersion
    const members = channelMembers.value?.items || []
    if (!members.length) {
      profileStatusByUserId.value = {}
      return
    }

    const results = await Promise.allSettled(
      members.map(async (member) => {
        const response = await getUser(member.id)
        let payload = response
        while (payload?.data && typeof payload.data === 'object') payload = payload.data
        const user = payload?.user ?? payload
        const rawStatus =
          user?.status_mode ?? user?.presence ?? user?.status ?? user?.mode ?? user?.state
        const status =
          typeof rawStatus === 'string'
            ? rawStatus.toLowerCase()
            : (rawStatus?.state ?? rawStatus?.mode ?? rawStatus?.status)
        return {
          id: member.id,
          status: ['online', 'away', 'offline', 'dnd'].includes(status) ? status : 'unknown',
        }
      }),
    )

    if (requestVersion !== profileRequestVersion) return
    profileStatusByUserId.value = Object.fromEntries(
      results.map((result, index) => {
        const memberId = members[index].id
        return result.status === 'fulfilled'
          ? [result.value.id, result.value.status]
          : [memberId, 'unknown']
      }),
    )
  },
  { immediate: true },
)

function toggleFavorite() {
  store.toggleFavorite(props.channelId)
}
</script>

<template>
  <header v-if="channel" class="ch-header">
    <div class="ch-header__row">
      <button
        type="button"
        class="ch-header__favorite"
        :class="{ 'is-favorite': channel.isFavorite }"
        :aria-label="
          channel.isFavorite ? 'Remove channel from favorites' : 'Add channel to favorites'
        "
        :aria-pressed="channel.isFavorite"
        :title="channel.isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        @click="toggleFavorite"
      >
        <ChIcon name="star" :size="19" :filled="channel.isFavorite" />
      </button>

      <h1 class="ch-header__name" :title="channel.name">
        <ChIcon v-if="channel.isPrivate" name="lock" :size="18" />
        <span>{{ channel.name }}</span>
      </h1>

      <span class="ch-header__divider" aria-hidden="true" />

      <MemberAvatarStack
        :members="memberItems"
        :total="channelMembers?.total ?? channel.memberCount"
        :max="maxAvatars"
        @click="emit('members-click')"
      />

      <div class="ch-header__actions">
        <slot name="actions" />
      </div>
    </div>

    <p v-if="channel.description" class="ch-header__desc">
      <span class="ch-header__bullet" aria-hidden="true">•</span>{{ channel.description }}
    </p>
  </header>
  <div v-else class="ch-header ch-header--skeleton" aria-hidden="true" />
</template>

<style scoped>
.ch-header {
  padding: 10px 20px 8px;
  background: var(--ch-surface);
  color: var(--ch-text);
  border-bottom: 1px solid var(--ch-border);
}
.ch-header--skeleton {
  height: 64px;
}
.ch-header__row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.ch-header__name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}
.ch-header__name span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ch-header__favorite {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  padding: 3px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #85899a;
  cursor: pointer;
}
.ch-header__favorite:hover,
.ch-header__favorite:focus-visible {
  background: #f3f4f6;
  color: #d99a00;
}
.ch-header__favorite.is-favorite {
  color: #d99a00;
}
.ch-header__favorite:focus-visible {
  outline: 2px solid #5962ff;
  outline-offset: 2px;
}
.ch-header__divider {
  align-self: stretch;
  width: 1px;
  margin: 4px 6px;
  background: var(--ch-border);
}
.ch-header__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.ch-header__desc {
  margin: 2px 0 0 36px;
  font-size: 14px;
  color: var(--ch-muted);
}
.ch-header__bullet {
  margin-right: 8px;
}
</style>
