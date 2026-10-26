<script setup>
import { computed, ref } from 'vue'
import { useActivityStore } from '@/stores/activity'
import { useDmStore } from '@/features/dms/stores/dms'

const activity = useActivityStore()
const dms = useDmStore()

const filter = ref('all') // all | unread
const list = computed(() =>
  filter.value === 'unread' ? activity.sorted.filter((i) => !i.read) : activity.sorted
)

function openItem(item) {
  activity.setRead(item.id, true)
  if (item.conversationId) {
    activity.open = false
    dms.openConversation(item.conversationId)
  }
}

function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="flex flex-wrap items-center gap-3 border-b bg-white px-5 py-3">
      <h2 class="mr-auto text-xl font-semibold">Activities</h2>

      <div class="flex overflow-hidden rounded border text-sm">
        <button class="px-3 py-1" :class="filter === 'all' ? 'bg-slate-800 text-white' : ''" @click="filter = 'all'">All</button>
        <button class="px-3 py-1" :class="filter === 'unread' ? 'bg-slate-800 text-white' : ''" @click="filter = 'unread'">
          Unread ({{ activity.unreadCount }})
        </button>
      </div>

      <button class="rounded border px-3 py-1 text-sm hover:bg-slate-50" @click="activity.markAllRead()">Mark all as read</button>
      <button class="rounded border border-indigo-300 px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50" @click="dms.receiveDemo()">
        Demo: naya message
      </button>
    </header>

    <ul class="flex-1 divide-y overflow-y-auto bg-white">
      <li v-for="item in list" :key="item.id" class="flex items-center" :class="item.read ? '' : 'bg-indigo-50/60'">
        <button class="flex min-w-0 flex-1 items-start gap-3 px-5 py-3 text-left hover:bg-slate-50" @click="openItem(item)">
          <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" :class="item.read ? 'bg-transparent' : 'bg-indigo-500'" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm" :class="item.read ? 'text-slate-600' : 'font-bold text-slate-900'">{{ item.title }}</span>
            <span class="block truncate text-sm text-slate-500">{{ item.body }}</span>
          </span>
          <span class="shrink-0 text-xs text-slate-400">{{ ago(item.createdAt) }}</span>
        </button>
        <button class="px-4 text-xs text-slate-500 underline" @click="activity.setRead(item.id, !item.read)">
          {{ item.read ? 'Mark unread' : 'Mark read' }}
        </button>
      </li>
      <li v-if="!list.length" class="p-8 text-center text-slate-400">Koi activity nahi</li>
    </ul>
  </div>
</template>