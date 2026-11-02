import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getMembers,
  getNotMembers,
  addMember as apiAddMember,
  addMembers as apiAddMembers,
  removeMember as apiRemoveMember,
} from '@/features/shell/api/membersApi'
import { getCompanyIdForTeam } from '@/features/shell/api/teamsApi'
import { useTeamsStore } from './teams'

function messageForError(error, operation) {
  if (error?.status === 403 && ['add members', 'load users'].includes(operation)) {
    return "You don't have permission to add members."
  }
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
  const notMembers = ref([])
  const loading = ref(false)
  const notMembersLoading = ref(false)
  const writing = ref(false)
  const error = ref(null)
  const notMembersError = ref(null)
  const permissionDenied = ref(false)
  const activeTeamKey = ref(null)
  let fetchVersion = 0
  let notMembersFetchVersion = 0

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
      notMembersFetchVersion += 1
      notMembers.value = []
      notMembersError.value = null
      notMembersLoading.value = false
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

  async function fetchNotMembers(workspaceId, teamId) {
    const key = `${workspaceId ?? ''}:${teamId}`
    if (activeTeamKey.value !== key) {
      activeTeamKey.value = key
      permissionDenied.value = false
      fetchVersion += 1
      notMembers.value = []
      notMembersError.value = null
      members.value = []
      error.value = null
      loading.value = false
    }
    const requestVersion = ++notMembersFetchVersion
    notMembersLoading.value = true
    notMembersError.value = null
    try {
      const result = await getNotMembers(workspaceId, teamId)
      if (requestVersion !== notMembersFetchVersion || activeTeamKey.value !== key) return false
      notMembers.value = result
      return true
    } catch (requestError) {
      if (requestVersion === notMembersFetchVersion) {
        notMembersError.value = messageForError(requestError, 'load users')
        permissionDenied.value = requestError?.status === 403
      }
      return false
    } finally {
      if (requestVersion === notMembersFetchVersion) notMembersLoading.value = false
    }
  }

  async function addSelectedMembers(workspaceId, teamId, userIds, addRequest) {
    writing.value = true
    error.value = null
    try {
      const response = await addRequest(workspaceId, teamId, userIds)
      await Promise.all([fetchMembers(workspaceId, teamId), fetchNotMembers(workspaceId, teamId)])
      return response
    } catch (requestError) {
      error.value = messageForError(requestError, 'add members')
      permissionDenied.value = requestError?.status === 403
      throw requestError
    } finally {
      writing.value = false
    }
  }

  function addMember(workspaceId, teamId, userId) {
    return addSelectedMembers(workspaceId, teamId, userId, apiAddMember)
  }

  function addMembers(workspaceId, teamId, userIds) {
    return addSelectedMembers(workspaceId, teamId, userIds, apiAddMembers)
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
    notMembersFetchVersion += 1
    members.value = []
    notMembers.value = []
    error.value = null
    notMembersError.value = null
    loading.value = false
    notMembersLoading.value = false
    permissionDenied.value = false
    activeTeamKey.value = null
  }

  return {
    members,
    notMembers,
    loading,
    notMembersLoading,
    writing,
    error,
    notMembersError,
    permissionDenied,
    onlineMembers,
    offlineMembers,
    memberCount,
    fetchMembers,
    fetchNotMembers,
    addMember,
    addMembers,
    removeMember,
    clearMembers,
  }
})
