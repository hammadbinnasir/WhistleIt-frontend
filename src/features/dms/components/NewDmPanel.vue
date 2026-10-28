<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { usePresenceStore, STATES } from '@/features/dms/stores/presence'
import PresenceIcon from './PresenceIcon.vue'

const MAX_MEMBERS = 7 // "You can add 7 more people"

const emit = defineEmits(['close'])

const dms = useDmStore()
const presence = usePresenceStore()

const query = ref('')
const selected = ref([]) // chune hue user ids
const groupName = ref('')
const highlight = ref(0)
const input = ref(null)

const remaining = computed(() => MAX_MEMBERS - selected.value.length)

// List tabhi dikhti hai jab kuch likha ho
const showList = computed(() => query.value.trim().length > 0)

// Naam likhte hi filter; jo pehle chun liye wo list se hat jate hain
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return dms.users.filter(
    (u) => u.id !== dms.meId && !selected.value.includes(u.id) && u.name.toLowerCase().includes(q),
  )
})

onMounted(() => input.value?.focus())
watch(query, () => (highlight.value = 0))
watch(highlight, async () => {
  await nextTick()
  document.getElementById(`dm-opt-${highlight.value}`)?.scrollIntoView({ block: 'nearest' })
})

function add(user) {
  if (!user || remaining.value <= 0) return
  selected.value.push(user.id)
  query.value = '' // list dobara band ho jati hai
  highlight.value = 0
  input.value?.focus()
}
function remove(id) {
  selected.value = selected.value.filter((x) => x !== id)
}

function go() {
  if (!selected.value.length) return
  if (selected.value.length === 1)
    dms.startDm(selected.value[0]) // 1 user = DM
  else dms.startGroup(selected.value, groupName.value) // 2+ = group DM
  emit('close')
}

function onKeydown(e) {
  if (e.key === 'ArrowDown' && showList.value) {
    e.preventDefault()
    highlight.value = Math.min(highlight.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp' && showList.value) {
    e.preventDefault()
    highlight.value = Math.max(highlight.value, 1) - 1
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (showList.value && results.value.length && remaining.value > 0)
      add(results.value[highlight.value])
    else go()
  } else if (e.key === 'Backspace' && !query.value && selected.value.length) {
    remove(selected.value.at(-1))
  } else if (e.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
      @mousedown.self="emit('close')"
    >
      <div
        class="w-full max-w-2xl rounded-lg bg-white text-slate-800 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Direct Messages"
      >
        <div class="relative px-6 pb-6 pt-8">
          <button
            class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            aria-label="Close"
            @click="emit('close')"
          >
            ✕
          </button>

          <h2 class="mb-8 text-center text-2xl font-semibold">Direct Messages</h2>

          <p class="mb-2 text-sm text-slate-500">
            Use ↑↓ to browse, ↵ to select. You can add {{ remaining }} more people.
          </p>

          <!-- Search box + dropdown -->
          <div class="relative">
            <div
              class="flex min-h-[56px] flex-wrap items-center gap-2 rounded border-2 border-slate-300 px-3 py-2 focus-within:border-indigo-500"
              @click="input?.focus()"
            >
              <span class="text-slate-400">🔍</span>

              <span
                v-for="id in selected"
                :key="id"
                class="flex items-center gap-1 rounded-full bg-indigo-100 py-0.5 pl-2 pr-1 text-sm text-indigo-800"
              >
                {{ dms.usersById[id]?.name }}
                <button
                  type="button"
                  class="flex h-5 w-5 items-center justify-center rounded-full hover:bg-indigo-200"
                  @click.stop="remove(id)"
                >
                  ×
                </button>
              </span>

              <input
                ref="input"
                v-model="query"
                type="text"
                :placeholder="selected.length ? '' : 'Search and add members'"
                class="min-w-[8rem] flex-1 bg-transparent py-1 text-lg outline-none placeholder:text-slate-400"
                @keydown="onKeydown"
              />

              <span class="px-1 text-indigo-500">▾</span>
            </div>

            <!-- Sirf tab dikhti hai jab naam likha ho -->
            <ul
              v-if="showList"
              class="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded border bg-white shadow-lg"
            >
              <li v-for="(u, i) in results" :id="`dm-opt-${i}`" :key="u.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-3 py-2 text-left"
                  :class="i === highlight ? 'bg-indigo-50' : 'hover:bg-slate-50'"
                  @mouseenter="highlight = i"
                  @click="add(u)"
                >
                  <PresenceIcon :state="presence.stateOf(u.id)" :size="28" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate">{{ u.name }}</span>
                    <span class="block truncate text-xs text-slate-500">
                      {{ STATES[presence.stateOf(u.id)]
                      }}<template v-if="presence.customOf(u.id).text">
                        · {{ presence.customOf(u.id).emoji }}
                        {{ presence.customOf(u.id).text }}</template
                      >
                    </span>
                  </span>
                </button>
              </li>
              <li v-if="remaining <= 0" class="px-3 py-3 text-sm text-slate-500">
                Maximum members reached
              </li>
              <li v-else-if="!results.length" class="px-3 py-3 text-sm text-slate-500">
                No users found
              </li>
            </ul>
          </div>

          <!-- 2+ users chunne par group ka naam -->
          <input
            v-if="selected.length > 1"
            v-model="groupName"
            type="text"
            placeholder="Group name (optional)"
            class="mt-4 w-full rounded border-2 border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </div>

        <div class="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button
            class="px-4 py-3 text-sm font-semibold uppercase tracking-wider"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            class="rounded bg-indigo-500 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
            :disabled="!selected.length"
            @click="go"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
