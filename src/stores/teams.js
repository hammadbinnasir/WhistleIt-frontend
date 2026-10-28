import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createTeam as apiCreateTeam,
  joinTeam as apiJoinTeam,
  searchTeams as apiSearchTeams,
} from '@/features/shell/api/teamsApi'
import { getWorkspaces, getWorkspaceTeams } from '@/features/shell/api/workspacesApi'

const LAST_TEAM_KEY = 'whistleit:last-team'

/**
 * Owns workspace membership, the active workspace/team, and team-level CRUD.
 */
export const useTeamsStore = defineStore('teams', () => {
  // ── state ──────────────────────────────────────────────
  const workspaces = ref([])
  const activeWorkspaceId = ref(null)
  const teamsByWorkspaceId = ref({})
  const activeTeamId = ref(null)
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref(null)

  // search-specific state (external teams to discover/join)
  const searchResults = ref([])
  const searchLoading = ref(false)

  // ── getters ────────────────────────────────────────────
  const activeWorkspace = computed(
    () => workspaces.value.find((workspace) => workspace.id === activeWorkspaceId.value) ?? null,
  )
  const teamsOfActiveWorkspace = computed(
    () => teamsByWorkspaceId.value[activeWorkspaceId.value] ?? [],
  )
  const teams = computed(() => teamsOfActiveWorkspace.value)
  const activeTeam = computed(
    () => teams.value.find((team) => team.id === activeTeamId.value) ?? null,
  )

  const filteredTeams = computed(() => {
    if (!searchQuery.value) return teams.value
    const q = searchQuery.value.toLowerCase()
    return teams.value.filter((t) => t.name.toLowerCase().includes(q))
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
        localStorage.setItem(`${LAST_TEAM_KEY}:${workspaceId}`, teamId)
      }
    } catch (storageError) {
      console.warn('Could not remember the last active team in local storage:', storageError)
    }
  }

  function selectAvailableTeam(workspaceId) {
    const workspaceTeams = teamsByWorkspaceId.value[workspaceId] ?? []
    const rememberedId = readLastTeamId(workspaceId)
    const rememberedTeam = workspaceTeams.find((team) => team.id === rememberedId)
    activeTeamId.value = rememberedTeam?.id ?? workspaceTeams[0]?.id ?? null
    if (activeTeamId.value) rememberTeam(workspaceId, activeTeamId.value)
  }

  // ── actions ────────────────────────────────────────────

  async function fetchWorkspaces() {
    loading.value = true
    error.value = null
    try {
      const result = await getWorkspaces()
      if (!Array.isArray(result)) throw new Error('The workspaces response must be an array.')
      workspaces.value = result
      if (!workspaces.value.some((workspace) => workspace.id === activeWorkspaceId.value)) {
        activeWorkspaceId.value = workspaces.value[0]?.id ?? null
        activeTeamId.value = null
      }
    } catch (err) {
      error.value = err.message ?? 'Failed to load workspaces'
    } finally {
      loading.value = false
    }
  }

  async function fetchTeams(workspaceId = null) {
    if (!workspaces.value.length) await fetchWorkspaces()
    const id = workspaceId ?? activeWorkspaceId.value
    if (!id) return

    loading.value = true
    error.value = null
    try {
      const result = await getWorkspaceTeams(id)
      if (!Array.isArray(result)) throw new Error('The teams response must be an array.')
      teamsByWorkspaceId.value[id] = result
      if (
        id === activeWorkspaceId.value &&
        !result.some((team) => team.id === activeTeamId.value)
      ) {
        selectAvailableTeam(id)
      }
    } catch (err) {
      error.value = err.message ?? 'Failed to load teams'
    } finally {
      loading.value = false
    }
  }

  async function selectWorkspace(id) {
    if (!workspaces.value.some((workspace) => workspace.id === id)) {
      throw new Error('The selected workspace is not available.')
    }
    activeWorkspaceId.value = id
    activeTeamId.value = null
    await fetchTeams(id)
    return activeWorkspace.value
  }

  function selectTeam(id) {
    if (!teams.value.some((team) => team.id === id)) return false
    activeTeamId.value = id
    rememberTeam(activeWorkspaceId.value, id)
    return true
  }

  /** Backward-compatible alias used by existing team consumers. */
  function switchTeam(id) {
    selectTeam(id)
  }

  /** Create a new team and auto-select it. */
  async function createTeam(payload) {
    loading.value = true
    error.value = null
    try {
      if (!activeWorkspaceId.value) {
        await fetchWorkspaces()
      }
      if (!activeWorkspaceId.value) throw new Error('Select a workspace before creating a team.')
      const response = await apiCreateTeam({
        ...payload,
        workspaceId: activeWorkspaceId.value,
      })
      const newTeam = { ...response, workspaceId: response.workspaceId ?? activeWorkspaceId.value }
      const workspaceTeams = teamsByWorkspaceId.value[activeWorkspaceId.value] ?? []
      teamsByWorkspaceId.value[activeWorkspaceId.value] = [...workspaceTeams, newTeam]
      selectTeam(newTeam.id)
      return newTeam
    } catch (err) {
      error.value = err.message ?? 'Failed to create team'
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Join an existing team by ID and auto-select it. */
  async function joinTeam(teamId) {
    loading.value = true
    error.value = null
    try {
      const response = await apiJoinTeam(teamId)
      const workspaceId = response.workspaceId ?? activeWorkspaceId.value
      if (!workspaceId) throw new Error('Select a workspace before joining a team.')
      if (!workspaces.value.some((workspace) => workspace.id === workspaceId)) {
        await fetchWorkspaces()
      }
      if (!workspaces.value.some((workspace) => workspace.id === workspaceId)) {
        throw new Error('The joined team belongs to an unavailable workspace.')
      }
      if (workspaceId !== activeWorkspaceId.value) await selectWorkspace(workspaceId)

      const team = { ...response, workspaceId }
      const workspaceTeams = teamsByWorkspaceId.value[workspaceId] ?? []
      if (!workspaceTeams.some((item) => item.id === team.id)) {
        teamsByWorkspaceId.value[workspaceId] = [...workspaceTeams, team]
      }
      selectTeam(team.id)
      return team
    } catch (err) {
      error.value = err.message ?? 'Failed to join team'
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Search for teams to discover/join. */
  async function searchAvailableTeams(query) {
    searchLoading.value = true
    try {
      searchResults.value = await apiSearchTeams(query)
    } catch {
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }

  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
  }

  return {
    // state
    workspaces,
    activeWorkspaceId,
    teamsByWorkspaceId,
    teams,
    activeTeamId,
    searchQuery,
    loading,
    error,
    searchResults,
    searchLoading,
    // getters
    activeWorkspace,
    activeTeam,
    teamsOfActiveWorkspace,
    filteredTeams,
    // actions
    fetchWorkspaces,
    fetchTeams,
    selectWorkspace,
    selectTeam,
    switchTeam,
    createTeam,
    joinTeam,
    searchAvailableTeams,
    clearSearch,
  }
})
