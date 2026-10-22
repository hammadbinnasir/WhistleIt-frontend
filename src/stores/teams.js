import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getTeams,
  createTeam as apiCreateTeam,
  joinTeam as apiJoinTeam,
  searchTeams as apiSearchTeams,
} from '@/features/shell/api/teamsApi'

/**
 * Teams / Workspaces store.
 * Owns the list of teams the current user belongs to,
 * the active team selection, and team-level CRUD.
 */
export const useTeamsStore = defineStore('teams', () => {
  // ── state ──────────────────────────────────────────────
  const teams = ref([])
  const activeTeamId = ref(null)
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref(null)

  // search-specific state (external teams to discover/join)
  const searchResults = ref([])
  const searchLoading = ref(false)

  // ── getters ────────────────────────────────────────────
  const activeTeam = computed(() =>
    teams.value.find((t) => t.id === activeTeamId.value) ?? null,
  )

  const filteredTeams = computed(() => {
    if (!searchQuery.value) return teams.value
    const q = searchQuery.value.toLowerCase()
    return teams.value.filter((t) => t.name.toLowerCase().includes(q))
  })

  // ── actions ────────────────────────────────────────────

  /** Fetch all teams the current user belongs to. */
  async function fetchTeams() {
    loading.value = true
    error.value = null
    try {
      teams.value = await getTeams()
      // auto-select first team if nothing is selected
      if (!activeTeamId.value && teams.value.length > 0) {
        activeTeamId.value = teams.value[0].id
      }
    } catch (err) {
      error.value = err.message ?? 'Failed to load teams'
    } finally {
      loading.value = false
    }
  }

  /** Switch the active team. */
  function switchTeam(id) {
    activeTeamId.value = id
  }

  /** Create a new team and auto-select it. */
  async function createTeam(payload) {
    loading.value = true
    error.value = null
    try {
      const newTeam = await apiCreateTeam(payload)
      teams.value.push(newTeam)
      activeTeamId.value = newTeam.id
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
      const team = await apiJoinTeam(teamId)
      // avoid duplicates if already in the list
      if (!teams.value.find((t) => t.id === team.id)) {
        teams.value.push(team)
      }
      activeTeamId.value = team.id
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
    teams,
    activeTeamId,
    searchQuery,
    loading,
    error,
    searchResults,
    searchLoading,
    // getters
    activeTeam,
    filteredTeams,
    // actions
    fetchTeams,
    switchTeam,
    createTeam,
    joinTeam,
    searchAvailableTeams,
    clearSearch,
  }
})
