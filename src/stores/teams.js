import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createTeam as apiCreateTeam,
  deleteTeam as apiDeleteTeam,
  joinTeam as apiJoinTeam,
  updateTeam as apiUpdateTeam,
} from '@/features/shell/api/teamsApi'
import {
  createWorkspace as apiCreateWorkspace,
  getWorkspaces,
  getWorkspaceTeams,
} from '@/features/shell/api/workspacesApi'

const LAST_TEAM_KEY = 'whistleit:last-team'

/**
 * Owns workspace membership, the active workspace/team, and team-level CRUD.
 */
export const useTeamsStore = defineStore('teams', () => {
  const workspaces = ref([])
  const activeWorkspaceId = ref(null)
  const teamsByWorkspaceId = ref({})
  const activeTeamId = ref(null)
  const searchQuery = ref('')
  const workspacesLoading = ref(false)
  const workspacesError = ref(null)
  const teamsLoadingByWorkspaceId = ref({})
  const teamsErrorByWorkspaceId = ref({})
  const actionLoading = ref(false)
  const actionError = ref(null)
  const searchResults = ref([])
  const searchLoading = ref(false)

  let workspacesRequestVersion = 0
  const teamRequestVersions = new Map()

  const activeWorkspace = computed(
    () =>
      workspaces.value.find(
        (workspace) => String(workspace.id) === String(activeWorkspaceId.value),
      ) ?? null,
  )
  const teamsOfActiveWorkspace = computed(
    () => teamsByWorkspaceId.value[activeWorkspaceId.value] ?? [],
  )
  const teams = computed(() => teamsOfActiveWorkspace.value)
  const activeTeam = computed(
    () => teams.value.find((team) => String(team.id) === String(activeTeamId.value)) ?? null,
  )
  const teamsLoading = computed(() =>
    Boolean(teamsLoadingByWorkspaceId.value[activeWorkspaceId.value]),
  )
  const teamsError = computed(() => teamsErrorByWorkspaceId.value[activeWorkspaceId.value] ?? null)
  const loading = computed(
    () => workspacesLoading.value || teamsLoading.value || actionLoading.value,
  )
  const error = computed(() => workspacesError.value || teamsError.value || actionError.value)

  const filteredTeams = computed(() => {
    if (!searchQuery.value) return teams.value
    const query = searchQuery.value.toLowerCase()
    return teams.value.filter((team) => team.name.toLowerCase().includes(query))
  })

  function readLastTeamId(workspaceId) {
    try {
      return localStorage.getItem(`${LAST_TEAM_KEY}:${workspaceId}`)
    } catch (storageError) {
      console.warn('Could not read the last active team from local storage:', storageError)
      return null
    }
  }

  function rememberTeam(workspaceId, teamId) {
    try {
      if (workspaceId && teamId) {
        localStorage.setItem(`${LAST_TEAM_KEY}:${workspaceId}`, String(teamId))
      }
    } catch (storageError) {
      console.warn('Could not remember the last active team in local storage:', storageError)
    }
  }

  function selectAvailableTeam(workspaceId) {
    const workspaceTeams = teamsByWorkspaceId.value[workspaceId] ?? []
    const rememberedId = readLastTeamId(workspaceId)
    const rememberedTeam = workspaceTeams.find((team) => String(team.id) === rememberedId)
    activeTeamId.value = rememberedTeam?.id ?? workspaceTeams[0]?.id ?? null
    if (activeTeamId.value) rememberTeam(workspaceId, activeTeamId.value)
  }

  async function fetchWorkspaces() {
    const requestVersion = ++workspacesRequestVersion
    workspacesLoading.value = true
    workspacesError.value = null
    actionError.value = null
    try {
      const result = await getWorkspaces()
      if (requestVersion !== workspacesRequestVersion) return
      if (!Array.isArray(result)) throw new Error('The workspaces response must be an array.')
      workspaces.value = result
      if (
        !workspaces.value.some(
          (workspace) => String(workspace.id) === String(activeWorkspaceId.value),
        )
      ) {
        activeWorkspaceId.value = workspaces.value[0]?.id ?? null
        activeTeamId.value = null
      }
    } catch (err) {
      if (requestVersion === workspacesRequestVersion) {
        workspacesError.value = err?.message ?? 'Failed to load workspaces.'
      }
    } finally {
      if (requestVersion === workspacesRequestVersion) workspacesLoading.value = false
    }
  }

  async function fetchTeams(workspaceId = null) {
    if (!workspaces.value.length) await fetchWorkspaces()
    const id = workspaceId ?? activeWorkspaceId.value
    if (!id) return []

    const requestVersion = (teamRequestVersions.get(String(id)) ?? 0) + 1
    teamRequestVersions.set(String(id), requestVersion)
    teamsLoadingByWorkspaceId.value = { ...teamsLoadingByWorkspaceId.value, [id]: true }
    teamsErrorByWorkspaceId.value = { ...teamsErrorByWorkspaceId.value, [id]: null }
    actionError.value = null
    try {
      const result = await getWorkspaceTeams(id)
      if (
        teamRequestVersions.get(String(id)) !== requestVersion ||
        String(activeWorkspaceId.value) !== String(id)
      ) {
        return teamsByWorkspaceId.value[id] ?? []
      }
      if (!Array.isArray(result)) throw new Error('The teams response must be an array.')
      teamsByWorkspaceId.value = { ...teamsByWorkspaceId.value, [id]: result }
      if (!result.some((team) => String(team.id) === String(activeTeamId.value))) {
        selectAvailableTeam(id)
      }
      return result
    } catch (err) {
      if (
        teamRequestVersions.get(String(id)) === requestVersion &&
        String(activeWorkspaceId.value) === String(id)
      ) {
        teamsErrorByWorkspaceId.value = {
          ...teamsErrorByWorkspaceId.value,
          [id]: err?.message ?? 'Failed to load teams.',
        }
      }
      return teamsByWorkspaceId.value[id] ?? []
    } finally {
      if (teamRequestVersions.get(String(id)) === requestVersion) {
        teamsLoadingByWorkspaceId.value = { ...teamsLoadingByWorkspaceId.value, [id]: false }
      }
    }
  }

  async function selectWorkspace(id) {
    const workspace = workspaces.value.find((item) => String(item.id) === String(id))
    if (!workspace) throw new Error('The selected workspace is not available.')
    activeWorkspaceId.value = workspace.id
    activeTeamId.value = null
    actionError.value = null
    await fetchTeams(workspace.id)
    return activeWorkspace.value
  }

  async function createWorkspace(payload) {
    actionLoading.value = true
    actionError.value = null
    try {
      const workspace = await apiCreateWorkspace(payload)
      if (!workspace?.id || !workspace.name) {
        throw new Error('The workspace response is missing required fields.')
      }
      if (!workspaces.value.some((item) => String(item.id) === String(workspace.id))) {
        workspaces.value = [...workspaces.value, workspace]
      }
      teamsByWorkspaceId.value = { ...teamsByWorkspaceId.value, [workspace.id]: [] }
      activeWorkspaceId.value = workspace.id
      activeTeamId.value = null
      return workspace
    } catch (err) {
      actionError.value = err?.message ?? 'Failed to create workspace.'
      throw err
    } finally {
      actionLoading.value = false
    }
  }

  function selectTeam(id) {
    const selected = teams.value.find((team) => String(team.id) === String(id))
    if (!selected) return false
    activeTeamId.value = selected.id
    rememberTeam(activeWorkspaceId.value, selected.id)
    return true
  }

  function switchTeam(id) {
    selectTeam(id)
  }

  async function createTeam(payload) {
    actionLoading.value = true
    actionError.value = null
    try {
      if (!activeWorkspaceId.value) await fetchWorkspaces()
      if (!activeWorkspaceId.value) throw new Error('Select a workspace before creating a team.')
      const workspaceId = activeWorkspaceId.value
      const newTeam = await apiCreateTeam({ ...payload, workspaceId })
      const team = { ...newTeam, workspaceId: newTeam.workspaceId ?? workspaceId }
      const workspaceTeams = teamsByWorkspaceId.value[workspaceId] ?? []
      teamsByWorkspaceId.value = {
        ...teamsByWorkspaceId.value,
        [workspaceId]: [...workspaceTeams, team],
      }
      selectTeam(team.id)
      return team
    } catch (err) {
      actionError.value = err?.message ?? 'Failed to create team.'
      throw err
    } finally {
      actionLoading.value = false
    }
  }

  async function updateTeam(teamId, payload) {
    const workspaceId = activeWorkspaceId.value
    if (!workspaceId) throw new Error('Select a workspace before editing a team.')
    actionLoading.value = true
    actionError.value = null
    try {
      const updatedTeam = await apiUpdateTeam(workspaceId, teamId, payload)
      const workspaceTeams = teamsByWorkspaceId.value[workspaceId] ?? []
      teamsByWorkspaceId.value = {
        ...teamsByWorkspaceId.value,
        [workspaceId]: workspaceTeams.map((team) =>
          String(team.id) === String(teamId) ? { ...team, ...updatedTeam, workspaceId } : team,
        ),
      }
      return updatedTeam
    } catch (err) {
      actionError.value = err?.message ?? 'Failed to update team.'
      throw err
    } finally {
      actionLoading.value = false
    }
  }

  async function deleteTeam(teamId) {
    const workspaceId = activeWorkspaceId.value
    if (!workspaceId) throw new Error('Select a workspace before deleting a team.')
    actionLoading.value = true
    actionError.value = null
    try {
      await apiDeleteTeam(workspaceId, teamId)
      const workspaceTeams = (teamsByWorkspaceId.value[workspaceId] ?? []).filter(
        (team) => String(team.id) !== String(teamId),
      )
      teamsByWorkspaceId.value = {
        ...teamsByWorkspaceId.value,
        [workspaceId]: workspaceTeams,
      }
      if (String(activeTeamId.value) === String(teamId)) selectAvailableTeam(workspaceId)
    } catch (err) {
      actionError.value = err?.message ?? 'Failed to delete team.'
      throw err
    } finally {
      actionLoading.value = false
    }
  }

  async function joinTeam(inviteCode) {
    actionLoading.value = true
    actionError.value = null
    try {
      if (!workspaces.value.length) await fetchWorkspaces()
      if (!workspaces.value.length) {
        throw new Error(workspacesError.value || 'A workspace is required to join a team.')
      }
      const response = await apiJoinTeam(inviteCode, activeWorkspaceId.value)
      const team = response.team
      const workspaceId = response.workspaceId ?? team?.workspaceId
      if (!team?.id || !workspaceId) {
        throw new Error('The invite response is missing its team or workspace.')
      }
      if (!workspaces.value.some((workspace) => String(workspace.id) === String(workspaceId))) {
        await fetchWorkspaces()
      }
      if (!workspaces.value.some((workspace) => String(workspace.id) === String(workspaceId))) {
        throw new Error('The joined team belongs to an unavailable workspace.')
      }
      if (
        String(workspaceId) !== String(activeWorkspaceId.value) ||
        !Object.prototype.hasOwnProperty.call(teamsByWorkspaceId.value, workspaceId)
      ) {
        await selectWorkspace(workspaceId)
      }

      const workspaceTeams = teamsByWorkspaceId.value[workspaceId] ?? []
      const existingTeam = workspaceTeams.find((item) => String(item.id) === String(team.id))
      if (!existingTeam) {
        teamsByWorkspaceId.value = {
          ...teamsByWorkspaceId.value,
          [workspaceId]: [...workspaceTeams, { ...team, workspaceId }],
        }
      }
      selectTeam(team.id)
      return {
        team: existingTeam ?? { ...team, workspaceId },
        alreadyMember: Boolean(response.alreadyMember || existingTeam),
      }
    } catch (err) {
      actionError.value = err?.message ?? 'Failed to join team.'
      throw err
    } finally {
      actionLoading.value = false
    }
  }

  async function searchAvailableTeams(query) {
    searchLoading.value = true
    try {
      const search = String(query ?? '')
        .trim()
        .toLowerCase()
      searchResults.value = search
        ? teams.value.filter((team) => team.name.toLowerCase().includes(search))
        : [...teams.value]
    } finally {
      searchLoading.value = false
    }
  }

  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
  }

  return {
    workspaces,
    activeWorkspaceId,
    teamsByWorkspaceId,
    teams,
    activeTeamId,
    searchQuery,
    loading,
    error,
    workspacesLoading,
    workspacesError,
    teamsLoading,
    teamsError,
    searchResults,
    searchLoading,
    activeWorkspace,
    activeTeam,
    teamsOfActiveWorkspace,
    filteredTeams,
    fetchWorkspaces,
    fetchTeams,
    selectWorkspace,
    createWorkspace,
    selectTeam,
    switchTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    joinTeam,
    searchAvailableTeams,
    clearSearch,
  }
})
