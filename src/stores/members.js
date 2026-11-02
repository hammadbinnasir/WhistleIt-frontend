import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getMembers,
  addMember as apiAddMember,
  removeMember as apiRemoveMember,
} from '@/features/shell/api/membersApi'
import { getCompanyIdForTeam } from '@/features/shell/api/teamsApi'
import { useTeamsStore } from './teams'

function messageForError(error, operation) {
  if (error?.status === 403) return 'You do not have permission to manage this team’s members.'
  if (error?.status === 404) return 'The team or member could not be found.'
  if (error?.status === 422) {
    return error.message || `The ${operation} request was invalid. Check the selected members.`
  }
  return error?.message || `Failed to ${operation}.`
}

function resolveScope(workspaceIdOrTeamId, maybeTeamId) {
  if (maybeTeamId != null) {
    return { workspaceId: workspaceIdOrTeamId, teamId: maybeTeamId }
  }

  const teamId = workspaceIdOrTeamId
  const teamsStore = useTeamsStore()
  const workspaceId =
    String(teamsStore.activeTeamId) === String(teamId)
      ? teamsStore.activeWorkspaceId
      : getCompanyIdForTeam(teamId)
  return { workspaceId, teamId }
}

export const useMembersStore = defineStore('members', () => {
  const members = ref([])
  const loading = ref(false)
  const writing = ref(false)
  const error = ref(null)
  const permissionDenied = ref(false)
  const activeTeamKey = ref(null)
  let fetchVersion = 0

  const onlineMembers = computed(() => members.value.filter((member) => member.status === 'online'))
  const offlineMembers = computed(() =>
    members.value.filter((member) => member.status !== 'online'),
  )
  const memberCount = computed(() => members.value.length)

  async function fetchMembers(workspaceIdOrTeamId, maybeTeamId = null) {
    const { workspaceId, teamId } = resolveScope(workspaceIdOrTeamId, maybeTeamId)
    const key = `${workspaceId ?? ''}:${teamId}`
    const requestVersion = ++fetchVersion
    if (activeTeamKey.value !== key) {
      activeTeamKey.value = key
      permissionDenied.value = false
    }
    loading.value = true
    error.value = null
    try {
      const result = await getMembers(workspaceId ?? teamId, workspaceId ? teamId : null)
      if (requestVersion !== fetchVersion || activeTeamKey.value !== key) return false
      members.value = result
      return true
    } catch (requestError) {
      if (requestVersion === fetchVersion) {
        error.value = messageForError(requestError, 'load members')
        permissionDenied.value = requestError?.status === 403
      }
      return false
    } finally {
      if (requestVersion === fetchVersion) loading.value = false
    }
  }

  async function addMember(workspaceId, teamId, userIds) {
    writing.value = true
    error.value = null
    try {
      const response = await apiAddMember(workspaceId, teamId, userIds)
      const refreshed = await fetchMembers(workspaceId, teamId)
      if (!refreshed && error.value) {
        error.value = `Members were added, but the list could not be refreshed. ${error.value}`
      }
      return response
    } catch (requestError) {
      error.value = messageForError(requestError, 'add members')
      permissionDenied.value = requestError?.status === 403
      throw requestError
    } finally {
      writing.value = false
    }
  }

  async function removeMember(workspaceId, teamId, userId) {
    writing.value = true
    error.value = null
    try {
      const response = await apiRemoveMember(workspaceId, teamId, userId)
      const refreshed = await fetchMembers(workspaceId, teamId)
      if (!refreshed && error.value) {
        error.value = `The member was removed, but the list could not be refreshed. ${error.value}`
      }
      return response
    } catch (requestError) {
      error.value = messageForError(requestError, 'remove member')
      permissionDenied.value = requestError?.status === 403
      throw requestError
    } finally {
      writing.value = false
    }
  }

  function clearMembers() {
    fetchVersion += 1
    members.value = []
    error.value = null
    permissionDenied.value = false
    activeTeamKey.value = null
  }

  return {
    members,
    loading,
    writing,
    error,
    permissionDenied,
    onlineMembers,
    offlineMembers,
    memberCount,
    fetchMembers,
    addMember,
    removeMember,
    clearMembers,
  }
})
