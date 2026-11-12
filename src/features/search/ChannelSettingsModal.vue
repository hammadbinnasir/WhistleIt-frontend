<script setup>
// Channel Settings modal: Settings | Members | Integrations | About
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useChannelsStore } from '@/features/channels'
import { getAuthUserId } from '@/features/auth/session'
import {
  listMembers,
  listAvailableMembers,
  addMember,
  removeMember,
  getWebhookUrl,
} from './members'

const props = defineProps({
  // { id, name, description, createdBy, muted, favourite }
  channel: { type: Object, required: true },
})
const emit = defineEmits([
  'toggle-mute',
  'toggle-favourite',
  'show-polls',
  'left',
  'save-message-permission',
  'archive',
  'save-details',
])
const ui = useUiStore()
const channels = useChannelsStore()
const isChannelCreator = computed(
  () =>
    Boolean(props.channel.isCreator || props.channel.isOwner) ||
    (props.channel.createdById != null &&
      getAuthUserId() != null &&
      String(props.channel.createdById) === String(getAuthUserId())),
)

const tab = ref(ui.channelSettingsTab)
const members = ref([])
const memberQuery = ref('')
const loadingMembers = ref(true)
const membersLoadError = ref('')
const adding = ref(false)
const addQuery = ref('')
const addOptions = ref([])
const selectedUserIds = ref([])
const selectedUsers = ref([])
const dropdownOpen = ref(false)
const loadingAddOptions = ref(false)
const addOptionsError = ref('')
const addMemberError = ref('')
const webhookUrl = ref('')
const copied = ref(false)
const confirmLeave = ref(false)
const memberToRemove = ref(null)
const removingMember = ref(false)
const removeMemberError = ref('')
const showMessagePermissions = ref(false)
const confirmArchive = ref(false)
const editingDetails = ref(false)
const draftName = ref('')
const draftDescription = ref('')
const selectedMessagePermission = ref('everyone')
const selectedAllowedSenderIds = ref([])
const permissionMemberQuery = ref('')
const permissionMemberDropdownOpen = ref(false)
const newAdminId = ref('')
const newAdminSearch = ref('')
const newAdminDropdownOpen = ref(false)
const leaveError = ref('')
const leaving = ref(false)

watch(() => props.channel.id, loadMessagePermission, { immediate: true })

function loadMessagePermission() {
  const saved = props.channel.messagePermission
  selectedMessagePermission.value =
    saved === 'admins'
      ? 'creator_only'
      : saved === 'specific'
        ? 'selected_members'
        : ['everyone', 'creator_only', 'selected_members'].includes(saved)
          ? saved
          : 'everyone'
  selectedAllowedSenderIds.value = (props.channel.allowedSenderIds || []).map(String)
  permissionMemberQuery.value = ''
  permissionMemberDropdownOpen.value = false
}

function openMessagePermissions() {
  if (!isChannelCreator.value) return
  loadMessagePermission()
  showMessagePermissions.value = true
}

function closeMessagePermissions() {
  showMessagePermissions.value = false
  permissionMemberQuery.value = ''
  permissionMemberDropdownOpen.value = false
}

function saveMessagePermissions() {
  if (!isChannelCreator.value) return
  if (
    selectedMessagePermission.value === 'selected_members' &&
    !selectedAllowedSenderIds.value.length
  ) {
    return
  }
  emit('save-message-permission', {
    messagePermission: selectedMessagePermission.value,
    allowedSenderIds:
      selectedMessagePermission.value === 'selected_members'
        ? [...selectedAllowedSenderIds.value]
        : [],
  })
  closeMessagePermissions()
}

function toggleAllowedSender(id) {
  const userId = String(id)
  selectedAllowedSenderIds.value = selectedAllowedSenderIds.value.includes(userId)
    ? selectedAllowedSenderIds.value.filter((selectedId) => selectedId !== userId)
    : [...selectedAllowedSenderIds.value, userId]
}

function startEditingDetails() {
  draftName.value = props.channel.name
  draftDescription.value = props.channel.description || ''
  editingDetails.value = true
}

function cancelEditingDetails() {
  editingDetails.value = false
  draftName.value = props.channel.name
  draftDescription.value = props.channel.description || ''
}

function saveDetails() {
  const name = draftName.value.trim()
  if (!isChannelCreator.value || !name) return
  emit('save-details', { name, description: draftDescription.value.trim() })
  editingDetails.value = false
}

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
const permissionMemberOptions = computed(() => {
  const query = permissionMemberQuery.value.trim().toLowerCase()
  return members.value
    .filter((member) => !selectedAllowedSenderIds.value.includes(String(member.id)))
    .filter(
      (member) =>
        !query || `${member.name} ${member.email || ''}`.toLowerCase().includes(query),
    )
})
const selectedPermissionMembers = computed(() =>
  members.value.filter((member) =>
    selectedAllowedSenderIds.value.includes(String(member.id)),
  ),
)
const creatorName = computed(() => {
  const creatorId = props.channel.createdById ?? props.channel.createdBy
  const creator = members.value.find(
    (member) => creatorId != null && String(member.id) === String(creatorId),
  )
  if (creator?.name) return creator.name

  const providedName = String(props.channel.createdBy ?? '').trim()
  if (
    providedName &&
    (props.channel.createdById == null ||
      providedName !== String(props.channel.createdById)) &&
    !/^[a-f\d-]{16,}$/i.test(providedName)
  ) {
    return providedName
  }
  return 'Unknown user'
})

async function refresh() {
  loadingMembers.value = true
  membersLoadError.value = ''
  try {
    members.value = await listMembers(props.channel.id)
  } catch (error) {
    membersLoadError.value = error?.message || 'Unable to load channel members.'
    throw error
  } finally {
    loadingMembers.value = false
  }
}
onMounted(async () => {
  try {
    await refresh()
  } catch (error) {
    console.error('Unable to load channel settings members:', error)
  }
  try {
    webhookUrl.value = await getWebhookUrl(props.channel.id)
  } catch (error) {
    console.error('Unable to load channel webhook URL:', error)
  }
})

async function openAdd() {
  adding.value = !adding.value
  if (adding.value) {
    dropdownOpen.value = false
  }
}
function closeAdd() {
  adding.value = false
  addQuery.value = ''
  selectedUserIds.value = []
  selectedUsers.value = []
  dropdownOpen.value = false
}
async function onAddSearch() {
  loadingAddOptions.value = true
  addOptionsError.value = ''
  try {
    const availableMembers = await listAvailableMembers(props.channel.id)
    const query = addQuery.value.trim().toLowerCase()
    addOptions.value = availableMembers
      .filter((user) => {
        if (!query) return true
        return `${user.name} ${user.email}`.toLowerCase().includes(query)
      })
      .filter((user) => !members.value.some((member) => String(member.id) === String(user.id)))
      .filter((user) => !selectedUserIds.value.includes(String(user.id)))
  } catch (error) {
    addOptions.value = []
    addOptionsError.value = error?.message || 'Unable to load available channel members.'
  } finally {
    loadingAddOptions.value = false
  }
}
async function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
  if (dropdownOpen.value) await onAddSearch()
}
function toggleSelectedUser(userId) {
  const id = String(userId)
  if (selectedUserIds.value.includes(id)) {
    const removedUser = selectedUsers.value.find((user) => String(user.id) === id)
    selectedUserIds.value = selectedUserIds.value.filter((selectedId) => selectedId !== id)
    selectedUsers.value = selectedUsers.value.filter((user) => String(user.id) !== id)
    if (removedUser) addOptions.value = [...addOptions.value, removedUser]
  } else {
    const user = addOptions.value.find((option) => String(option.id) === id)
    if (!user) return
    selectedUserIds.value = [...selectedUserIds.value, id]
    selectedUsers.value = [...selectedUsers.value, user]
    addOptions.value = addOptions.value.filter((option) => String(option.id) !== id)
  }
}
async function addSelected() {
  addMemberError.value = ''
  try {
    for (const user of selectedUsers.value) await addMember(user, props.channel.id)
    await refresh()
    closeAdd()
  } catch (error) {
    addMemberError.value = error?.status === 403
      ? 'You are not authorized to add members to this channel.'
      : (error?.message || 'Unable to add the selected members to the channel.')
  }
}
function askToRemoveMember(member) {
  if (!isChannelCreator.value || String(member.id) === String(getAuthUserId())) return
  memberToRemove.value = member
  removeMemberError.value = ''
}
async function confirmRemoveMember() {
  if (!isChannelCreator.value || !memberToRemove.value || removingMember.value) return
  removingMember.value = true
  removeMemberError.value = ''
  try {
    await removeMember(String(memberToRemove.value.id), props.channel.id)
    await refresh()
    ui.toast(
      'Member removed',
      `${memberToRemove.value.name} was removed from the channel.`,
      'success',
    )
    memberToRemove.value = null
  } catch (error) {
    removeMemberError.value = error?.message || 'Unable to remove this member. Please try again.'
  } finally {
    removingMember.value = false
  }
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

function openLeaveConfirmation() {
  newAdminId.value = ''
  newAdminSearch.value = ''
  leaveError.value = ''
  newAdminDropdownOpen.value = false
  confirmLeave.value = true
}

async function leave() {
  if (channelNeedsAdmin.value && !newAdminId.value) return
  leaveError.value = ''
  leaving.value = true
  try {
    await channels.leaveChannel(props.channel.id, newAdminId.value || undefined)
    if (newAdminId.value) {
      ui.toast(
        'Channel admin transferred',
        `${selectedNewAdmin.value?.name || 'The selected member'} is now the channel admin.`,
        'success',
      )
    }
    emit('left')
  } catch (error) {
    leaveError.value = error?.message || 'Unable to leave this channel. Please try again.'
  } finally {
    leaving.value = false
  }
}

const channelNeedsAdmin = computed(() => Boolean(props.channel.canManage))
const availableNewAdmins = computed(() =>
  members.value.filter(
    (member) => getAuthUserId() == null || String(member.id) !== String(getAuthUserId()),
  ),
)
const filteredNewAdmins = computed(() => {
  const query = newAdminSearch.value.trim().toLowerCase()
  if (!query) return availableNewAdmins.value
  return availableNewAdmins.value.filter((member) =>
    `${member.name} ${member.email}`.toLowerCase().includes(query),
  )
})
const selectedNewAdmin = computed(() =>
  availableNewAdmins.value.find((member) => String(member.id) === String(newAdminId.value)),
)

const samplePayload = JSON.stringify({ text: 'Build finished', username: 'CI Bot' }, null, 2)
const showSample = ref(false)
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    @click.self="ui.closeChannelSettings()"
  >
    <div
      v-if="confirmLeave"
      class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4"
      @click.self="confirmLeave = false"
    >
      <section
        class="w-[450px] max-w-full rounded-lg bg-white px-6 py-6 text-center shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-channel-title"
        @click="newAdminDropdownOpen = false"
      >
        <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
          <span class="text-4xl font-bold leading-none">i</span>
        </div>
        <h3 id="leave-channel-title" class="text-xl font-bold text-slate-700">Leave Channel</h3>
        <p v-if="channelNeedsAdmin" class="mt-5 text-sm text-slate-600">
          Before leaving, select a new channel admin from the existing members.
        </p>
        <div
          v-if="channelNeedsAdmin"
          class="relative mt-5 text-left"
          @click.stop
        >
          <label for="new-channel-admin-search" class="sr-only">Search channel members</label>
          <div class="flex items-center rounded border-2 border-indigo-500 px-3">
            <i class="fa-solid fa-magnifying-glass text-slate-400" aria-hidden="true"></i>
            <input
              id="new-channel-admin-search"
              v-model="newAdminSearch"
              type="search"
              class="min-w-0 flex-1 border-0 px-2 py-3 text-sm text-slate-700 outline-none"
              :placeholder="selectedNewAdmin?.name || 'Type here to search'"
              aria-label="Search channel members to select a new admin"
              aria-controls="new-channel-admin-options"
              :aria-expanded="newAdminDropdownOpen"
              @focus="newAdminDropdownOpen = true"
              @input="newAdminDropdownOpen = true"
            />
            <button
              type="button"
              class="cursor-pointer px-1 text-indigo-500"
              :aria-label="newAdminDropdownOpen ? 'Close member list' : 'Open member list'"
              @click="newAdminDropdownOpen = !newAdminDropdownOpen"
            >
              <i
                class="fa-solid"
                :class="newAdminDropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'"
                aria-hidden="true"
              ></i>
            </button>
          </div>
          <ul
            v-if="newAdminDropdownOpen"
            id="new-channel-admin-options"
            class="absolute z-10 max-h-56 w-full overflow-y-auto rounded-b bg-white py-2 text-left shadow-lg"
            role="listbox"
            aria-label="Channel members"
          >
            <li v-if="loadingMembers" class="px-4 py-3 text-sm text-slate-500">
              Loading channel members...
            </li>
            <li v-else-if="membersLoadError" class="px-4 py-3 text-sm text-red-600" role="alert">
              {{ membersLoadError }}
            </li>
            <li
              v-else-if="!filteredNewAdmins.length"
              class="px-4 py-3 text-sm text-slate-500"
            >
              {{ availableNewAdmins.length ? 'No matching members.' : 'No other channel members.' }}
            </li>
            <li v-for="member in filteredNewAdmins" :key="member.id" role="presentation">
              <button
                type="button"
                class="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
                :class="{ 'bg-indigo-50': String(newAdminId) === String(member.id) }"
                role="option"
                :aria-selected="String(newAdminId) === String(member.id)"
                @click="
                  newAdminId = String(member.id);
                  newAdminSearch = '';
                  newAdminDropdownOpen = false
                "
              >
                <img
                  v-if="member.avatar"
                  :src="member.avatar"
                  :alt="`${member.name} avatar`"
                  class="h-9 w-9 rounded-full object-cover"
                />
                <span
                  v-else
                  class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  :class="colorFor(member.id)"
                  aria-hidden="true"
                >
                  {{ initials(member.name || member.email || 'User') }}
                </span>
                <span>{{ member.name || member.email || 'Channel member' }}</span>
              </button>
            </li>
          </ul>
        </div>
        <p v-if="leaveError" class="mt-4 text-left text-sm text-red-600" role="alert">
          {{ leaveError }}
        </p>
        <div class="mt-6 flex justify-center gap-4">
          <button
            type="button"
            class="cursor-pointer rounded border border-slate-300 px-7 py-2.5 font-semibold uppercase text-slate-600 hover:bg-slate-50"
            :disabled="leaving"
            @click="confirmLeave = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="cursor-pointer rounded bg-red-500 px-7 py-2.5 font-semibold uppercase text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="leaving || (channelNeedsAdmin && !newAdminId)"
            @click="leave"
          >
            {{ leaving ? 'Leaving...' : 'Leave' }}
          </button>
        </div>
      </section>
    </div>
    <div
      v-if="memberToRemove"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4"
      @click.self="!removingMember && (memberToRemove = null)"
    >
      <section
        class="w-[450px] max-w-full rounded-lg bg-white px-6 py-10 text-center shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-channel-member-title"
      >
        <div class="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-red-500">
          <span class="text-4xl font-bold leading-none">i</span>
        </div>
        <h3 id="remove-channel-member-title" class="text-2xl font-bold text-slate-700">
          Remove Member
        </h3>
        <p class="mt-6 text-base text-slate-600">
          Are you sure you want to remove this member?
        </p>
        <p v-if="removeMemberError" class="mt-4 text-sm text-red-600" role="alert">
          {{ removeMemberError }}
        </p>
        <div class="mt-12 flex justify-center gap-3">
          <button
            type="button"
            class="cursor-pointer rounded border border-slate-800 px-8 py-3 font-semibold tracking-wide text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="removingMember"
            @click="memberToRemove = null"
          >
            Cancel
          </button>
          <button
            type="button"
            class="cursor-pointer rounded bg-rose-600 px-8 py-3 font-semibold tracking-wide text-white shadow hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="removingMember"
            @click="confirmRemoveMember"
          >
            {{ removingMember ? 'Removing...' : 'Remove' }}
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
        class="w-[450px] max-w-full rounded-lg bg-white px-6 py-6 text-center shadow-2xl"
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
        <div class="mt-6 flex justify-center gap-4">
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
      @click.self="closeMessagePermissions"
    >
      <section class="w-[450px] max-w-full overflow-hidden rounded-md bg-white shadow-2xl">
        <header class="relative px-6 py-5 text-center">
          <button
            type="button"
            class="absolute right-5 top-5 cursor-pointer text-xl leading-none text-slate-600"
            aria-label="Close message permissions"
            @click="closeMessagePermissions"
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
            <input v-model="selectedMessagePermission" type="radio" value="creator_only" />
            Creator Only
          </label>
          <label class="flex cursor-pointer items-center gap-4 py-2 text-slate-700">
            <input v-model="selectedMessagePermission" type="radio" value="selected_members" />
            Allow Specific Members
          </label>
          <div
            v-if="selectedMessagePermission === 'selected_members'"
            class="relative mt-2"
          >
            <label class="relative block">
              <span class="absolute -top-2 left-2 z-10 bg-white px-1 text-xs text-indigo-500">
                Search channel members
              </span>
              <div
                class="flex min-h-12 w-full items-center gap-2 rounded border-2 border-indigo-500 bg-white py-2 pl-3 pr-10 focus-within:ring-2 focus-within:ring-indigo-100"
              >
                <svg
                  class="h-5 w-5 shrink-0 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7"></circle>
                  <path d="m16.4 16.4 4.1 4.1" stroke-linecap="round"></path>
                </svg>
                <span
                  v-if="selectedPermissionMembers.length"
                  class="flex shrink-0 items-center gap-1"
                >
                  <button
                    v-for="member in selectedPermissionMembers"
                    :key="member.id"
                    type="button"
                    class="relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm"
                    :class="colorFor(member.id)"
                    :title="`Remove ${member.name}`"
                    @click.stop="toggleAllowedSender(member.id)"
                  >
                    {{ initials(member.name) }}
                    <span
                      class="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-slate-300 bg-white text-[10px] leading-none text-slate-500 shadow-sm"
                      aria-hidden="true"
                    >
                      &times;
                    </span>
                  </button>
                </span>
                <input
                  v-model="permissionMemberQuery"
                  type="search"
                  :placeholder="
                    selectedPermissionMembers.length ? '' : 'Type here to search'
                  "
                  class="min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-slate-600 outline-none"
                  aria-label="Search channel members for permissions"
                  @focus="permissionMemberDropdownOpen = true"
                />
              </div>
              <button
                type="button"
                class="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded text-sm text-indigo-500 hover:bg-indigo-50"
                aria-label="Show channel members"
                :aria-expanded="permissionMemberDropdownOpen"
                @click.stop="permissionMemberDropdownOpen = !permissionMemberDropdownOpen"
              >
                <span
                  :class="permissionMemberDropdownOpen ? '-rotate-180' : ''"
                  class="transition-transform"
                >
                  ▼
                </span>
              </button>
            </label>
            <p v-if="loadingMembers" class="mt-2 py-2 text-sm text-slate-500">
              Loading channel members…
            </p>
            <p
              v-else-if="membersLoadError"
              class="mt-2 py-2 text-sm text-red-600"
              role="alert"
            >
              {{ membersLoadError }}
            </p>
            <div
              v-else-if="permissionMemberDropdownOpen && !permissionMemberOptions.length"
              class="mt-2 rounded border border-slate-200 px-4 py-3 text-center text-sm text-slate-500"
            >
              No channel members found
            </div>
            <div
              v-else-if="permissionMemberDropdownOpen && permissionMemberOptions.length"
              class="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white shadow-sm"
            >
              <div
                v-for="member in permissionMemberOptions"
                :key="member.id"
                class="text-sm text-slate-800"
              >
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-indigo-50"
                  @click="toggleAllowedSender(member.id)"
                >
                  <span
                    class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                    :class="colorFor(member.id)"
                  >
                    {{ initials(member.name) }}
                  </span>
                  <span class="truncate">{{ member.name }}</span>
                </button>
              </div>
            </div>
          </div>
          <p
            v-if="
              selectedMessagePermission === 'selected_members' &&
              !selectedAllowedSenderIds.length &&
              !loadingMembers &&
              !membersLoadError
            "
            class="mt-2 text-sm text-red-600"
          >
            Select at least one channel member.
          </p>
        </div>
        <footer class="flex justify-center gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            class="cursor-pointer px-5 py-2 font-semibold uppercase text-slate-700"
            @click="closeMessagePermissions"
          >
            Cancel
          </button>
          <button
            type="button"
            class="cursor-pointer rounded bg-indigo-500 px-5 py-2 font-semibold uppercase text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="
              selectedMessagePermission === 'selected_members' &&
              (!selectedAllowedSenderIds.length || loadingMembers || Boolean(membersLoadError))
            "
            @click="saveMessagePermissions"
          >
            Save
          </button>
        </footer>
      </section>
    </div>
    <div
      class="relative max-h-[76vh] w-full max-w-[450px] overflow-hidden rounded-lg bg-white shadow-xl"
    >
      <button
        class="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-indigo-50 text-slate-600"
        aria-label="Close"
        @click="ui.closeChannelSettings()"
      >
        ✕
      </button>
      <h2 class="pt-5 text-center text-lg font-semibold text-slate-700">Channel Settings</h2>

      <nav       class="mt-3 flex justify-center gap-7 border-b border-slate-200">
        <button
          v-for="t in ['settings', 'members', 'integrations', 'about']"
          :key="t"
          class="flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-xs font-semibold capitalize"
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

      <div class="max-h-[58vh] overflow-y-auto p-4">
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
          <div v-if="isChannelCreator" class="rounded border border-slate-300 p-3">
            <h3 class="font-bold text-slate-700">Message Permissions</h3>
            <p class="mt-1 text-sm text-slate-500">
              Control who can send and reply to messages in this channel. By default everyone can
              send messages in channel
            </p>
            <button
              type="button"
              class="mt-3 cursor-pointer rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
              @click="openMessagePermissions"
            >
              Update
            </button>
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
          <div v-if="channel.canManage" class="rounded border border-slate-300 p-3">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-2 font-bold text-red-500"
              @click="confirmArchive = true"
            >
              <i class="fa-solid fa-box-archive" aria-hidden="true"></i>
              ARCHIVE CHANNEL
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
            style="cursor: pointer"
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
            <section class="w-[420px] max-w-[calc(100vw-32px)] max-h-[82vh] overflow-hidden rounded-md bg-white shadow-2xl">
              <div class="relative px-6 pb-3 pt-4 text-center">
                <button
                  type="button"
                  class="absolute right-5 top-5 grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-600 shadow-sm hover:bg-slate-100"
                  aria-label="Close add members"
                  @click="closeAdd"
                >
                  &times;
                </button>
                <h3 class="pr-8 text-[22px] font-bold leading-tight text-slate-700">
                  Add Members in Channel
                </h3>
              </div>

              <div class="px-[34px] pb-5 pt-2">
                <label class="relative block">
                  <span class="absolute left-2 -top-3 bg-white px-1 text-sm text-indigo-500">Search</span>
                  <div class="flex h-[48px] w-full items-center rounded border-2 border-indigo-500 bg-white px-3 focus-within:ring-2 focus-within:ring-indigo-100">
                    <svg class="mr-2 h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <circle cx="11" cy="11" r="7"></circle>
                      <path d="m16.4 16.4 4.1 4.1" stroke-linecap="round"></path>
                    </svg>
                    <span v-if="selectedUsers.length" class="flex shrink-0 items-center gap-2 pr-2">
                      <button
                        v-for="user in selectedUsers"
                        :key="user.id"
                        type="button"
                        class="relative grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm"
                        :class="colorFor(user.id)"
                        :title="`Remove ${user.name}`"
                        @click.stop="toggleSelectedUser(user.id)"
                      >
                        {{ initials(user.name) }}
                        <span
                          class="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-slate-300 bg-white text-[10px] leading-none text-slate-500 shadow-sm"
                          aria-hidden="true"
                        >
                          &times;
                        </span>
                      </button>
                    </span>
                    <input
                      v-model="addQuery"
                      :placeholder="selectedUsers.length ? '' : 'Type here to search'"
                      class="min-w-0 flex-1 border-0 bg-transparent px-0 text-base text-slate-600 outline-none"
                      @focus="dropdownOpen = true; onAddSearch()"
                      @input="onAddSearch"
                    />
                  </div>
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
                    class="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-base text-slate-800 hover:bg-indigo-50"
                  >
                    <span class="flex items-center gap-3">
                      <span
                        class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                        :class="colorFor(user.id)"
                      >
                        {{ initials(user.name) }}
                      </span>
                      {{ user.name }}
                    </span>
                    <button
                      type="button"
                      class="h-[28px] min-w-[50px] cursor-pointer rounded-md bg-[#6175e8] text-xs font-bold tracking-wide text-white shadow-sm hover:bg-[#5367da]"
                      style="padding: 0 12.4444444444px"
                      :class="selectedUserIds.includes(String(user.id)) ? '!bg-indigo-600' : ''"
                      @click.stop="toggleSelectedUser(user.id)"
                    >
                      {{ selectedUserIds.includes(String(user.id)) ? 'Added' : 'Add' }}
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

              <div class="border-t border-slate-200 px-6 py-3 text-right">
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
              <button
                v-if="isChannelCreator && String(m.id) !== String(getAuthUserId())"
                type="button"
                class="cursor-pointer px-2 py-1 text-sm font-semibold tracking-wide text-indigo-600 hover:text-indigo-800"
                :aria-label="`Remove ${m.name} from channel`"
                @click="askToRemoveMember(m)"
              >
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
          <template v-if="editingDetails && isChannelCreator">
            <div class="space-y-4 p-3">
              <label class="block text-sm font-bold text-slate-700">
                Name
                <input
                  v-model="draftName"
                  class="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal text-slate-700 outline-none focus:border-indigo-500"
                />
              </label>
              <label class="block text-sm font-bold text-slate-700">
                Description
                <textarea
                  v-model="draftDescription"
                  rows="3"
                  class="mt-1 w-full resize-y rounded border border-slate-300 px-3 py-2 font-normal text-slate-700 outline-none focus:border-indigo-500"
                ></textarea>
              </label>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="cursor-pointer rounded px-3 py-2 text-sm font-semibold text-slate-600"
                  @click="cancelEditingDetails"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
                  :disabled="!draftName.trim()"
                  @click="saveDetails"
                >
                  Save
                </button>
              </div>
            </div>
          </template>
          <div
            v-if="!editingDetails"
            class="border-b border-slate-200 p-3"
          >
            <div class="flex items-center justify-between">
              <p class="font-bold text-slate-700">Name</p>
              <button
                v-if="isChannelCreator"
                type="button"
                class="cursor-pointer text-sm font-semibold text-blue-600 underline"
                @click="startEditingDetails"
              >
                Edit
              </button>
            </div>
            <p class="text-sm text-slate-500">{{ channel.name }}</p>
          </div>
          <div
            v-if="!editingDetails"
            class="border-b border-slate-200 p-3"
          >
            <div class="flex items-center justify-between">
              <p class="font-bold text-slate-700">Description</p>
              <button
                v-if="isChannelCreator"
                type="button"
                class="cursor-pointer text-sm font-semibold text-blue-600 underline"
                @click="startEditingDetails"
              >
                Edit
              </button>
            </div>
            <p class="text-sm text-slate-500">
              {{ channel.description || 'Add channel description' }}
            </p>
          </div>
          <div class="border-b border-slate-200 p-3">
            <p class="font-bold text-slate-700">Created by</p>
            <p class="text-sm text-slate-500">{{ creatorName }}</p>
          </div>
          <div class="p-3">
            <button
              v-if="!confirmLeave"
              class="font-bold text-red-500"
              @click="openLeaveConfirmation"
            >
              Leave Channel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
