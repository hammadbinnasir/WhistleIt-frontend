import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useMembersStore } from './members'
import { useTeamsStore } from './teams'

export const useDmStore = defineStore('dms', () => {
  const membersStore = useMembersStore()
  const teamsStore = useTeamsStore()

  const activeId = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const closedIds = ref(new Set())

  const sorted = computed(() => {
    const list = membersStore.members.filter((m) => !closedIds.value.has(m.id))
    return [...list].sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1
      if (a.status !== 'online' && b.status === 'online') return 1
      return (a.name || '').localeCompare(b.name || '')
    })
  })

  const activeConversation = computed(() => {
    return membersStore.members.find((m) => m.id === activeId.value) || null
  })

  async function init() {
    loading.value = true
    error.value = null
    try {
      if (!membersStore.members.length) {
        const teamId = teamsStore.activeTeamId || 'team-1'
        await membersStore.fetchMembers(teamId)
      }
    } catch (err) {
      error.value = err.message || 'Failed to load conversations'
    } finally {
      loading.value = false
    }
  }

  function openConversation(id) {
    closedIds.value.delete(id)
    activeId.value = id
  }

  function closeConversation(id) {
    closedIds.value.add(id)
    if (activeId.value === id) {
      activeId.value = null
    }
  }

  return {
    activeId,
    activeConversation,
    loading,
    error,
    sorted,
    init,
    openConversation,
    closeConversation,
  }
})
