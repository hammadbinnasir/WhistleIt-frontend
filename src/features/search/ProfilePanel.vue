<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getUser, getUserProfile } from '@/features/account/api'
import { useUserStore } from '@/features/account/composables/useUserStore'
import { usePresenceStore } from '@/features/dms/stores/presence'
import { getAuthUserId } from '@/features/auth/session'
import { dmApi } from '@/features/dms/dmApi'

const props = defineProps({
  member: { type: Object, required: true },
  workspaceId: { type: [String, Number], default: null },
})
const emit = defineEmits(['close', 'message'])

const userStore = useUserStore()
const presence = usePresenceStore()
const profile = ref({})
const loading = ref(false)
const error = ref('')
const emailFields = [
  'email',
  'emailAddress',
  'email_address',
  'userEmail',
  'user_email',
  'accountEmail',
  'account_email',
]
let requestVersion = 0

const isOwnProfile = computed(
  () => String(props.member.id) === String(getAuthUserId()),
)

function findProfileField(value, key, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return ''
  seen.add(value)

  const field = value[key]
  if (field != null && field !== '') return field

  for (const nestedValue of Object.values(value)) {
    const nestedField = findProfileField(nestedValue, key, seen)
    if (nestedField !== '') return nestedField
  }
  return ''
}

function profileField(...keys) {
  for (const key of keys) {
    const value = findProfileField(profile.value, key)
    if (value !== '') return value
  }
  return ''
}

const name = computed(() => {
  const accountName =
    isOwnProfile.value && userStore.profileLoaded.value ? userStore.state.profile.fullName : ''
  return accountName || profileField('fullName', 'full_name', 'name') || props.member.name || 'Unknown user'
})
const email = computed(
  () => profileField(...emailFields) || props.member.email || '',
)
const designation = computed(() => {
  if (isOwnProfile.value && userStore.profileLoaded.value) {
    return userStore.state.profile.designation
  }
  return profileField('designation', 'title') || props.member.designation || ''
})
const avatarUrl = computed(() => {
  if (isOwnProfile.value && userStore.profileLoaded.value) {
    return userStore.state.profile.photoUrl
  }
  return (
    profileField(
      'photoUrl',
      'photo_url',
      'avatarUrl',
      'avatar_url',
      'profilePictureUrl',
      'profile_picture_url',
    ) ||
    props.member.avatarUrl ||
    ''
  )
})
const status = computed(() => presence.stateOf(String(props.member.id)))
const statusLabel = computed(
  () => ({ online: 'Online', away: 'Away', offline: 'Offline', dnd: 'Do not disturb' })[status.value] || 'Status unavailable',
)
const responsibilities = computed(() => {
  if (isOwnProfile.value && userStore.profileLoaded.value) {
    return userStore.state.profile.jobResponsibilities
  }
  return (
    profileField('jobResponsibilities', 'job_responsibilities') ||
    props.member.jobResponsibilities ||
    ''
  )
})
const responsibilityItems = computed(() => {
  const value = responsibilities.value
  const items = Array.isArray(value) ? value : String(value || '').split(/\r?\n/)
  return items.map((item) => String(item).trim()).filter(Boolean)
})

function initials(value) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  return words.length
    ? `${words[0][0]}${words[1]?.[0] ?? ''}`.toUpperCase()
    : '?'
}

watch(
  () => props.member.id,
  async (userId) => {
    const version = ++requestVersion
    profile.value = {}
    error.value = ''
    loading.value = false
    if (userId == null || String(userId).trim() === '') {
      error.value = 'This user profile is unavailable because the user ID is missing.'
      return
    }

    loading.value = true
    try {
      const request =
        String(userId) === String(getAuthUserId()) ? getUserProfile(userId) : getUser(userId)
      const userResponse = (await request) ?? {}
      if (version !== requestVersion) return
      profile.value = userResponse

      if (
        String(userId) !== String(getAuthUserId()) &&
        !profileField(...emailFields) &&
        !props.member.email &&
        props.workspaceId
      ) {
        const workspaceMembers = await dmApi.listCompanyMembers(props.workspaceId)
        if (version !== requestVersion) return
        const workspaceMember = workspaceMembers.find(
          (workspaceMember) => String(workspaceMember.id) === String(userId),
        )
        if (workspaceMember?.email) {
          profile.value = { ...userResponse, workspaceMember }
        }
      }
    } catch (cause) {
      if (version === requestVersion) {
        error.value =
          cause?.message || 'Additional profile information could not be loaded. Please try again.'
      }
    } finally {
      if (version === requestVersion) loading.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  requestVersion += 1
})
</script>

<template>
  <aside class="profile-panel" aria-label="Profile">
    <header class="profile-panel__header">
      <h2>Profile</h2>
      <button type="button" aria-label="Close profile" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </header>

    <div class="profile-panel__content">
      <img v-if="avatarUrl" class="profile-panel__avatar" :src="avatarUrl" :alt="name" />
      <div v-else class="profile-panel__avatar profile-panel__avatar--initials" aria-hidden="true">
        {{ initials(name) }}
      </div>

      <h3 class="profile-panel__name">{{ name }}</h3>

      <div class="profile-panel__presence">
        <span :class="`profile-panel__presence-dot profile-panel__presence-dot--${status}`" />
        <span>{{ statusLabel }}</span>
        <button type="button" class="profile-panel__message" @click="emit('message', member)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
          </svg>
          Message
        </button>
      </div>

      <section class="profile-panel__information" aria-labelledby="profile-information-heading">
        <h4 id="profile-information-heading">Information</h4>

        <div v-if="email" class="profile-panel__field">
          <span class="profile-panel__field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          <div>
            <h5>Email Address</h5>
            <a :href="`mailto:${email}`">{{ email }}</a>
          </div>
        </div>
        <div v-else-if="!loading" class="profile-panel__field">
          <div>
            <h5>Email Address</h5>
            <p>No email address added yet.</p>
          </div>
        </div>

        <div class="profile-panel__field">
          <span class="profile-panel__field-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="8" r="3" />
              <path d="M5.5 20a6.5 6.5 0 0 1 13 0M4 4h2M18 4h2" />
            </svg>
          </span>
          <div>
            <h5>Designation</h5>
            <p>{{ designation || 'No designation added yet.' }}</p>
          </div>
        </div>

        <div class="profile-panel__responsibilities">
          <h5>Job Responsibilities</h5>
          <ul v-if="responsibilityItems.length">
            <li v-for="(responsibility, index) in responsibilityItems" :key="index">
              {{ responsibility }}
            </li>
          </ul>
          <p v-else>No job responsibility added yet.</p>
        </div>

        <p v-if="loading" class="profile-panel__message-text" role="status">
          Loading profile information…
        </p>
        <p v-if="error" class="profile-panel__error" role="alert">{{ error }}</p>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.profile-panel {
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  overflow: auto;
  background: #fff;
  color: #1f2937;
}
.profile-panel__header {
  display: flex;
  height: 45px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 12px;
}
.profile-panel__header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.profile-panel__header button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  cursor: pointer;
}
.profile-panel__header button:hover {
  background: #f1f5f9;
}
.profile-panel__header svg {
  width: 20px;
  height: 20px;
  stroke-width: 1.8;
}
.profile-panel__content {
  min-width: 0;
  padding: 10px 10px 24px;
}
.profile-panel__avatar {
  display: block;
  width: min(200px, 72%);
  aspect-ratio: 1;
  margin: 0 auto 10px;
  border-radius: 50%;
  object-fit: cover;
}
.profile-panel__avatar--initials {
  display: grid;
  place-items: center;
  background: #ff8000;
  color: white;
  font-size: clamp(48px, 8vw, 78px);
  font-weight: 400;
}
.profile-panel__name {
  overflow-wrap: anywhere;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.profile-panel__presence {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.profile-panel__presence-dot {
  width: 11px;
  height: 11px;
  flex: 0 0 auto;
  border: 1px solid #cbd5e1;
  border-radius: 50%;
}
.profile-panel__presence-dot--online {
  border-color: #22c55e;
  background: #22c55e;
}
.profile-panel__presence-dot--away {
  border-color: #f59e0b;
  background: #f59e0b;
}
.profile-panel__presence-dot--dnd {
  border-color: #ef4444;
  background: #ef4444;
}
.profile-panel__message {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
  padding: 3px 8px;
  color: #334155;
  font-size: 12px;
  cursor: pointer;
}
.profile-panel__message:hover {
  background: #f8fafc;
}
.profile-panel__message svg {
  width: 14px;
  height: 14px;
  stroke-width: 1.8;
}
.profile-panel__information {
  border-top: 1px solid #e5e7eb;
  padding-top: 10px;
}
.profile-panel__information h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
}
.profile-panel__field {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 12px;
}
.profile-panel__field-icon {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  color: #475569;
}
.profile-panel__field-icon svg {
  width: 18px;
  height: 18px;
  stroke-width: 1.7;
}
.profile-panel__field h5,
.profile-panel__responsibilities h5 {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
}
.profile-panel__field a,
.profile-panel__field p,
.profile-panel__responsibilities p {
  overflow-wrap: anywhere;
  margin: 2px 0 0;
  font-size: 12px;
}
.profile-panel__responsibilities ul {
  margin: 6px 0 0;
  padding-left: 18px;
  list-style: disc;
  font-size: 12px;
}
.profile-panel__responsibilities li {
  overflow-wrap: anywhere;
  margin-top: 2px;
}
.profile-panel__field a {
  color: #4f46e5;
  text-decoration: none;
}
.profile-panel__field a:hover {
  text-decoration: underline;
}
.profile-panel__responsibilities {
  margin-top: 14px;
}
.profile-panel__responsibilities p {
  white-space: pre-line;
  margin-top: 6px;
}
.profile-panel__message-text {
  margin: 12px 0 0;
  color: #64748b;
  font-size: 12px;
}
.profile-panel__error {
  margin: 12px 0 0;
  color: #b91c1c;
  font-size: 12px;
}
</style>
