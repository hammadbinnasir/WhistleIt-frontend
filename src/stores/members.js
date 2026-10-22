import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getMembers,
  addMember as apiAddMember,
  removeMember as apiRemoveMember,
} from '@/features/shell/api/membersApi'

/**
 * Members store.
 * Owns the member list for the currently-active team
 * and add/remove operations.
 */
export const useMembersStore = defineStore('members', () => {
  // ── state ──────────────────────────────────────────────
  const members = ref([])
  const loading = ref(false)
  const error = ref(null)

  // ── getters ────────────────────────────────────────────
  const onlineMembers = computed(() =>
    members.value.filter((m) => m.status === 'online'),
  )

  const offlineMembers = computed(() =>
    members.value.filter((m) => m.status !== 'online'),
  )

  const memberCount = computed(() => members.value.length)

  // ── actions ────────────────────────────────────────────

  /** Fetch members for a specific team. */
  async function fetchMembers(teamId) {
    loading.value = true
    error.value = null
    try {
      members.value = await getMembers(teamId)
    } catch (err) {
      error.value = err.message ?? 'Failed to load members'
    } finally {
      loading.value = false
    }
  }

  /** Add a user to the team. */
  async function addMember(teamId, userId) {
    error.value = null
    try {
      const member = await apiAddMember(teamId, userId)
      // avoid duplicates
      if (!members.value.find((m) => m.id === member.id)) {
        members.value.push(member)
      }
      return member
    } catch (err) {
      error.value = err.message ?? 'Failed to add member'
      throw err
    }
  }

  /** Remove a user from the team. */
  async function removeMember(teamId, userId) {
    error.value = null
    try {
      await apiRemoveMember(teamId, userId)
      members.value = members.value.filter((m) => m.id !== userId)
    } catch (err) {
      error.value = err.message ?? 'Failed to remove member'
      throw err
    }
  }

  /** Clear members (used on team switch). */
  function clearMembers() {
    members.value = []
    error.value = null
  }

  return {
    // state
    members,
    loading,
    error,
    // getters
    onlineMembers,
    offlineMembers,
    memberCount,
    // actions
    fetchMembers,
    addMember,
    removeMember,
    clearMembers,
  }
})
