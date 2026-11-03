<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useDmStore } from '@/features/dms/stores/dms'
import { useMembersStore } from '@/stores/members'
import { useTeamsStore } from '@/stores/teams'
import { useUiStore } from '@/stores/ui'
import UserAvatar from './UserAvatar.vue'

const emit = defineEmits(['close'])

const dms = useDmStore()
const memberStore = useMembersStore()
const teams = useTeamsStore()
const ui = useUiStore()

const query = ref('')
const selected = ref([]) // chune hue user ids
const selectedUsers = ref({})
const highlight = ref(0)
const input = ref(null)
const listOpen = ref(true)
const creating = ref(false)
const createError = ref('')
const memberUsers = computed(() =>
  memberStore.members.map((user) => ({
    ...user,
    id: String(user.userId ?? user.id),
    avatarUrl: user.avatarUrl ?? user.avatar ?? '',
  })),
)
const userById = computed(() =>
  Object.fromEntries([
    ...[...dms.users, ...memberUsers.value].map((user) => [user.id, user]),
    ...Object.entries(selectedUsers.value),
  ]),
)
const availableUsers = computed(() => {
  const usersById = new Map()
  const candidates = [...dms.companyMembers, ...memberUsers.value, ...dms.users]
  for (const user of candidates) {
    if (user?.id != null && String(user.id) !== String(dms.meId)) {
      usersById.set(String(user.id), {
        ...usersById.get(String(user.id)),
        ...user,
        id: String(user.id),
      })
    }
  }
  return [...usersById.values()]
})

const showList = computed(() => listOpen.value)

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  return availableUsers.value.filter(
    (user) =>
      !selected.value.includes(user.id) &&
      [user.name, user.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
  )
})
const currentUserMatchesQuery = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q || !dms.meId) return false
  const currentUser = [...dms.companyMembers, ...memberUsers.value, ...dms.users].find(
    (user) => String(user.id) === String(dms.meId),
  )
  return [currentUser?.name, currentUser?.email]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q))
})

onMounted(() => {
  input.value?.focus()
  void dms.loadCompanyMembers()
  if (teams.activeWorkspaceId && teams.activeTeamId) {
    void memberStore.fetchMembers(teams.activeWorkspaceId, teams.activeTeamId)
  }
})
watch(query, (value) => {
  highlight.value = 0
  if (value.trim()) listOpen.value = true
})
watch(highlight, async () => {
  await nextTick()
  document.getElementById(`dm-opt-${highlight.value}`)?.scrollIntoView({ block: 'nearest' })
})

async function add(user) {
  if (!user || selected.value.length >= 1) return
  selected.value.push(user.id)
  selectedUsers.value = { ...selectedUsers.value, [user.id]: user }
  createError.value = ''
  query.value = '' // list dobara band ho jati hai
  listOpen.value = false
  highlight.value = 0
  await go()
}
function remove(id) {
  selected.value = selected.value.filter((x) => x !== id)
}

function toggleList() {
  listOpen.value = !listOpen.value
  if (listOpen.value) input.value?.focus()
}

async function go(userId = selected.value[0]) {
  if (!userId || creating.value) return
  creating.value = true
  createError.value = ''
  try {
    await dms.startDm(userId)
    ui.selectChannel(null)
    ui.closePanel()
    emit('close')
  } catch (error) {
    createError.value = error?.message || 'Could not start this direct message.'
  } finally {
    creating.value = false
  }
}

function onKeydown(e) {
  if (e.key === 'ArrowDown' && showList.value && results.value.length) {
    e.preventDefault()
    highlight.value = Math.min(highlight.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp' && showList.value && results.value.length) {
    e.preventDefault()
    highlight.value = Math.max(highlight.value, 1) - 1
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (showList.value) {
      if (results.value.length && selected.value.length < 1) add(results.value[highlight.value])
    } else {
      go()
    }
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

          <p class="mb-2 text-sm text-slate-500">Select one person to start a direct message.</p>
          <p
            v-if="memberStore.loading || dms.companyMembersLoading"
            class="mb-2 text-sm text-slate-500"
            role="status"
          >
            Loading members…
          </p>
          <p
            v-if="dms.companyMembersError || memberStore.error"
            class="mb-2 text-sm text-red-600"
            role="alert"
          >
            {{ dms.companyMembersError || memberStore.error }}
          </p>
          <!-- Search box + dropdown -->
          <div class="relative">
            <div
              class="flex min-h-[56px] flex-wrap items-center gap-2 rounded border-2 border-slate-300 px-3 py-2 focus-within:border-indigo-500"
              @click="input?.focus()"
            >
              <svg
                aria-hidden="true"
                class="h-5 w-5 shrink-0 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.2 4.2" />
              </svg>

              <span
                v-for="id in selected"
                :key="id"
                class="flex items-center gap-1 rounded-full bg-indigo-100 py-0.5 pl-2 pr-1 text-sm text-indigo-800"
              >
                {{ userById[id]?.name }}
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

              <button
                type="button"
                class="inline-block px-1 text-indigo-500 transition-transform"
                :class="{ 'rotate-180': showList }"
                aria-label="Show members"
                :aria-expanded="showList"
                @click.stop="toggleList"
              >
                ▾
              </button>
            </div>

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
                  <UserAvatar :name="u.name" :user-id="u.id" :size="44" ring="border-white" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate">{{ u.name }}</span>
                  </span>
                </button>
              </li>
              <li v-if="selected.length >= 1" class="px-3 py-3 text-sm text-slate-500">
                One-to-one direct messages include one other person
              </li>
              <li v-else-if="currentUserMatchesQuery" class="px-3 py-3 text-sm text-slate-500">
                That is your account. Choose another member to start a direct message.
              </li>
              <li v-else-if="!results.length" class="px-3 py-3 text-sm text-slate-500">
                {{
                  query.trim() ? 'No matching company members or conversations' : 'No users found'
                }}
              </li>
            </ul>
          </div>

          <p v-if="createError" class="mt-3 text-sm text-red-600" role="alert">
            {{ createError }}
          </p>
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
            :disabled="!selected.length || creating"
            @click="go"
          >
            {{ creating ? 'Creating…' : 'Go' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
