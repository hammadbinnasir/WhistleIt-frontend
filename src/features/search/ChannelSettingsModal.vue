<script setup>
// Channel Settings modal: Settings | Members | Integrations | About
import { ref, computed, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui'
import { listMembers, removeMember, addMember, getWebhookUrl } from './members'
import { searchUsers } from './search'

const props = defineProps({
  // { id, name, description, createdBy, muted, favourite }
  channel: { type: Object, required: true },
})
const emit = defineEmits(['toggle-mute', 'toggle-favourite', 'show-polls', 'left'])
const ui = useUiStore()

const tab = ref(ui.channelSettingsTab)
const members = ref([])
const memberQuery = ref('')
const loadingMembers = ref(true)
const adding = ref(false)
const addQuery = ref('')
const addOptions = ref([])
const webhookUrl = ref('')
const copied = ref(false)
const confirmLeave = ref(false)

const colors = ['bg-orange-500', 'bg-green-500', 'bg-purple-600', 'bg-blue-600', 'bg-pink-500']
const colorFor = (id) =>
  colors[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length]
const initials = (n) =>
  n
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
const filtered = computed(() =>
  members.value.filter((m) => m.name.toLowerCase().includes(memberQuery.value.toLowerCase())),
)

async function refresh() {
  members.value = await listMembers()
  loadingMembers.value = false
}
onMounted(async () => {
  await refresh()
  webhookUrl.value = await getWebhookUrl(props.channel.id)
})

async function openAdd() {
  adding.value = !adding.value
  if (adding.value) onAddSearch()
}
async function onAddSearch() {
  const all = await searchUsers(addQuery.value)
  addOptions.value = all.filter((u) => !members.value.find((m) => m.id === u.id))
}
async function add(u) {
  await addMember(u)
  await refresh()
  onAddSearch()
}
async function remove(m) {
  await removeMember(m.id)
  await refresh()
}

async function copy() {
  try {
    await navigator.clipboard.writeText(webhookUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch (error) {
    console.error('Unable to copy webhook URL:', error)
  }
}
function leave() {
  emit('left')
}

const samplePayload = JSON.stringify({ text: 'Build finished', username: 'CI Bot' }, null, 2)
const showSample = ref(false)
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    @click.self="ui.closeChannelSettings()"
  >
    <div
      v-if="confirmConnectionUpdate"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4"
      @click.self="confirmConnectionUpdate = false"
    >
      <section
        class="w-[520px] max-w-full rounded-lg bg-white px-8 py-7 text-center shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-connection-title"
      >
        <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
          <span class="text-4xl font-bold leading-none">i</span>
        </div>
        <h3 id="update-connection-title" class="text-xl font-bold text-slate-700">
          Update Connection URL
        </h3>
        <p class="mt-7 text-base text-slate-600">
          Are you sure you want to update this channel's connection URL?
        </p>
        <div class="mt-8 flex justify-end gap-4">
          <button
            type="button"
            class="cursor-pointer rounded border border-slate-300 px-7 py-2.5 font-semibold uppercase text-slate-600 hover:bg-slate-50"
            @click="confirmConnectionUpdate = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="cursor-pointer rounded bg-red-500 px-7 py-2.5 font-semibold uppercase text-white hover:bg-red-600"
            @click="updateConnectionUrl"
          >
            Update
          </button>
        </div>
      </section>
    </div>
    <div
      v-if="confirmArchive"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4"
      @click.self="confirmArchive = false"
    >
      <section
        class="w-[520px] max-w-full rounded-lg bg-white px-8 py-7 text-center shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-channel-title"
      >
        <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
          <span class="text-4xl font-bold leading-none">i</span>
        </div>
        <h3 id="archive-channel-title" class="text-xl font-bold text-slate-700">
          Archive Channel
        </h3>
        <p class="mt-7 text-base text-slate-600">
          Are you sure you want to archive this Channel?
        </p>
        <div class="mt-8 flex justify-end gap-4">
          <button
            type="button"
            class="cursor-pointer rounded border border-slate-300 px-7 py-2.5 font-semibold uppercase text-slate-600 hover:bg-slate-50"
            @click="confirmArchive = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="cursor-pointer rounded bg-red-500 px-7 py-2.5 font-semibold uppercase text-white hover:bg-red-600"
            @click="emit('archive')"
          >
            Archive
          </button>
        </div>
      </section>
    </div>
    <div
      v-if="showMessagePermissions"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
      @click.self="showMessagePermissions = false"
    >
      <section class="w-[520px] max-w-full overflow-visible rounded-md bg-white shadow-2xl">
        <header class="relative px-6 py-5 text-center">
          <button
            type="button"
            class="absolute right-5 top-5 cursor-pointer text-xl leading-none text-slate-600"
            aria-label="Close message permissions"
            @click="showMessagePermissions = false"
          >
            &times;
          </button>
          <h3 class="text-xl font-semibold text-slate-700">Message Permissions</h3>
        </header>
        <div class="border-t border-slate-200 px-10 py-8">
          <p class="mb-5 font-semibold text-slate-700">
            Who can send and reply to messages in this channel?
          </p>
          <label class="flex cursor-pointer items-center gap-4 py-2 text-slate-700">
            <input v-model="selectedMessagePermission" type="radio" value="everyone" />
            Everyone
          </label>
          <label class="flex cursor-pointer items-center gap-4 py-3 text-slate-700">
            <input v-model="selectedMessagePermission" type="radio" value="admins" />
            Admin Only
          </label>
          <label class="flex cursor-pointer items-center gap-4 py-2 text-slate-700">
            <input v-model="selectedMessagePermission" type="radio" value="specific" />
            Allow Specific Members
          </label>
        </div>
        <footer class="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            class="cursor-pointer px-5 py-2 font-semibold uppercase text-slate-700"
            @click="showMessagePermissions = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="cursor-pointer rounded bg-indigo-500 px-5 py-2 font-semibold uppercase text-white"
            @click="saveMessagePermissions"
          >
            Save
          </button>
        </footer>
      </section>
    </div>
    <div
      class="relative max-h-[85vh] w-[560px] max-w-[95vw] overflow-hidden rounded-lg bg-white shadow-xl"
    >
      <button
        class="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-indigo-50 text-slate-600"
        aria-label="Close"
        @click="ui.closeChannelSettings()"
      >
        ✕
      </button>
      <h2 class="pt-6 text-center text-xl font-semibold text-slate-700">Channel Settings</h2>

      <nav class="mt-4 flex justify-center gap-8 border-b border-slate-200">
        <button
          v-for="t in ['settings', 'members', 'integrations', 'about']"
          :key="t"
          class="flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm font-semibold capitalize"
          :class="
            tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500'
          "
          @click="tab = t"
        >
          {{ t }}
          <span
            v-if="t === 'members'"
            class="rounded-full bg-indigo-500 px-2 py-0.5 text-xs text-white"
            >{{ members.length }}</span
          >
        </button>
      </nav>

      <div class="max-h-[60vh] overflow-y-auto p-5">
        <!-- Settings -->
        <div v-if="tab === 'settings'" class="space-y-4">
          <div class="rounded border border-slate-300 p-3">
            <div class="flex items-start justify-between">
              <h3 class="font-bold text-slate-700">Mute</h3>
              <!-- toggle switch -->
              <label class="inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  role="switch"
                  class="peer sr-only"
                  aria-label="Mute channel"
                  :checked="channel.muted"
                  @change="emit('toggle-mute')"
                />
                <span
                  class="relative h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-indigo-500 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
                ></span>
              </label>
            </div>
            <p class="mt-1 text-sm text-slate-500">
              Muted channel will not receive any notifications or any message badge and will be
              displayed at bottom with dim grey color
            </p>
          </div>
          <div class="rounded border border-slate-300 p-3">
            <div class="flex items-start justify-between">
              <h3 class="font-bold text-slate-700">Favourite</h3>
              <!-- toggle switch -->
              <label class="inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  role="switch"
                  class="peer sr-only"
                  aria-label="Favourite channel"
                  :checked="channel.favourite"
                  @change="emit('toggle-favourite')"
                />
                <span
                  class="relative h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-indigo-500 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
                ></span>
              </label>
            </div>
            <p class="mt-1 text-sm text-slate-500">
              Favourite move your most important channels to top in the sidebar, to access them
              easily
            </p>
          </div>
          <div class="rounded border border-slate-300 p-3">
            <h3 class="font-bold text-slate-700">Polls</h3>
            <p class="mt-1 text-sm text-slate-500">
              Access all the history of polls of this channel with a single click
            </p>
            <button
              class="mt-3 cursor-pointer rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
              @click="emit('show-polls')"
            >
              History
            </button>
          </div>
        </div>

        <!-- Members -->
        <div v-else-if="tab === 'members'">
          <input
            v-model="memberQuery"
            placeholder="Search by user name"
            class="w-full rounded border-2 border-indigo-500 px-3 py-2 text-sm outline-none"
          />
          <button
            class="my-3 flex items-center gap-2 text-sm font-bold tracking-wide text-indigo-600"
            @click="openAdd"
          >
            <span
              class="flex h-8 w-8 items-center justify-center rounded-full border border-indigo-500 text-lg"
              >+</span
            >
            ADD MEMBERS
          </button>
          <div
            v-if="adding"
            class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
            @click.self="closeAdd"
          >
            <section class="w-[520px] max-w-full overflow-hidden rounded-md bg-white shadow-2xl">
              <div class="relative px-6 pb-3 pt-4 text-center">
                <button
                  type="button"
                  class="absolute right-5 top-5 grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-600 shadow-sm hover:bg-slate-100"
                  aria-label="Close add members"
                  @click="closeAdd"
                >
                  &times;
                </button>
                <h3 class="pr-12 text-[22px] font-bold leading-tight text-slate-700">
                  Add Members in Channel
                </h3>
              </div>

              <div class="px-8 pb-5 pt-3">
                <label class="relative block">
                  <span class="absolute left-2 -top-3 bg-white px-1 text-sm text-indigo-500">Search</span>
                  <span
                    class="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-slate-400"
                    aria-hidden="true"
                  >⌕</span>
                  <input
                    v-model="addQuery"
                    placeholder="Type here to search"
                    class="h-[52px] w-full rounded border-2 border-indigo-500 px-10 text-base text-slate-600 outline-none focus:ring-2 focus:ring-indigo-100"
                    @input="onAddSearch"
                    @focus="dropdownOpen = true; onAddSearch()"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded text-sm text-indigo-500 hover:bg-indigo-50"
                    aria-label="Show available members"
                    @click.stop="toggleDropdown"
                  >
                    <span :class="dropdownOpen ? '-rotate-180' : ''" class="transition-transform"
                      >▼</span
                    >
                  </button>
                </label>

                <div
                  v-if="dropdownOpen && loadingAddOptions"
                  class="mt-2 rounded border border-slate-200 px-4 py-3 text-center text-sm text-slate-500"
                >
                  Loading members...
                </div>
                <div
                  v-else-if="dropdownOpen && addOptionsError"
                  class="mt-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {{ addOptionsError }}
                </div>
                <div
                  v-else-if="dropdownOpen && !addOptions.length"
                  class="mt-2 rounded border border-slate-200 px-4 py-3 text-center text-sm text-slate-500"
                >
                  No available members
                </div>
                <div
                  v-else-if="dropdownOpen && addOptions.length"
                  class="mt-2 max-h-44 overflow-y-auto rounded border border-slate-200 bg-white shadow-sm"
                >
                  <div
                    v-for="user in addOptions"
                    :key="user.id"
                    class="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-lg text-slate-800 hover:bg-indigo-50"
                    @click="toggleSelectedUser(user.id)"
                  >
                    <span class="flex items-center gap-3">
                      <input
                        type="checkbox"
                        class="pointer-events-none"
                        :checked="selectedUserIds.includes(String(user.id))"
                      />
                      {{ user.name }}
                    </span>
                    <button
                      type="button"
                      class="cursor-pointer rounded px-3 py-1 text-sm font-semibold text-indigo-500 hover:bg-indigo-100"
                      @click.stop="add(user)"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div
                  v-if="addMemberError"
                  class="mt-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                  role="alert"
                >
                  {{ addMemberError }}
                </div>
              </div>

              <div class="border-t border-slate-200 px-8 py-4 text-right">
                <button
                  type="button"
                  class="h-[42px] cursor-pointer rounded bg-indigo-500 px-5 text-sm font-bold tracking-wide text-white shadow-sm hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:text-white"
                  :disabled="!selectedUserIds.length"
                  @click="addSelected"
                >
                  ADD MEMBERS
                </button>
              </div>
            </section>
          </div>
          <p v-if="loadingMembers" class="text-sm text-slate-500">Loading members…</p>
          <p v-else-if="!filtered.length" class="text-sm text-slate-500">
            No member matches "{{ memberQuery }}".
          </p>
          <ul>
            <li
              v-for="m in filtered"
              :key="m.id"
              class="group flex items-center justify-between rounded px-2 py-2 hover:bg-indigo-50"
            >
              <div class="flex items-center gap-3">
                <span
                  class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                  :class="colorFor(m.id)"
                  >{{ initials(m.name) }}</span
                >
                <span class="text-sm text-slate-800">{{ m.name }}</span>
              </div>
              <button class="invisible text-xs text-red-600 group-hover:visible" @click="remove(m)">
                Remove
              </button>
            </li>
          </ul>
        </div>

        <!-- Integrations -->
        <div v-else-if="tab === 'integrations'" class="rounded border border-slate-300 p-4">
          <h3 class="font-bold text-slate-700">Webhooks</h3>
          <p class="mt-1 text-sm text-slate-500">
            Webhooks are a way to send messages to WhistleIt from any external source. It includes
            simple HTTP Requests with JSON payload.
          </p>
          <button class="mt-2 text-sm text-blue-600 underline" @click="showSample = !showSample">
            Sample payload
          </button>
          <pre v-if="showSample" class="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs">{{
            samplePayload
          }}</pre>
          <div class="mt-3 flex gap-2">
            <input
              :value="webhookUrl"
              readonly
              class="min-w-0 flex-1 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
            />
            <button
              class="rounded bg-indigo-500 px-3 text-white"
              :aria-label="copied ? 'Copied' : 'Copy URL'"
              @click="copy"
            >
              {{ copied ? '✓' : '⧉' }}
            </button>
          </div>
        </div>

        <!-- About -->
        <div v-else class="rounded border border-slate-300">
          <div class="border-b border-slate-200 p-3">
            <p class="font-bold text-slate-700">Name</p>
            <p class="text-sm text-slate-500">{{ channel.name }}</p>
          </div>
          <div class="border-b border-slate-200 p-3">
            <p class="font-bold text-slate-700">Description</p>
            <p class="text-sm text-slate-500">
              {{ channel.description || 'Add channel description' }}
            </p>
          </div>
          <div class="border-b border-slate-200 p-3">
            <p class="font-bold text-slate-700">Created by</p>
            <p class="text-sm text-slate-500">{{ channel.createdBy }}</p>
          </div>
          <div class="p-3">
            <button
              v-if="!confirmLeave"
              class="font-bold text-red-500"
              @click="confirmLeave = true"
            >
              Leave Channel
            </button>
            <div v-else class="flex items-center gap-3 text-sm">
              <span class="text-slate-700">Leave #{{ channel.name }}?</span>
              <button class="font-bold text-red-500" @click="leave">Yes, leave</button>
              <button class="text-slate-500" @click="confirmLeave = false">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
