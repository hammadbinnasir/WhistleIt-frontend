import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { dmApi } from '@/features/dms/dmApi'

let generatedId = 0

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${generatedId++}`
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export const useDmStore = defineStore('dms', () => {
  const meId = ref(null)
  const users = ref([])
  const conversations = ref([])
  const activeId = ref(null)
  const loading = ref(false)
  const error = ref('')
  const usersById = computed(() => Object.fromEntries(users.value.map((user) => [user.id, user])))
  const sorted = computed(() =>
    conversations.value
      .slice()
      .sort((a, b) => {
        const aTime = a.messages.at(-1)?.createdAt ?? ''
        const bTime = b.messages.at(-1)?.createdAt ?? ''
        return bTime.localeCompare(aTime)
      })
  )

  let initialization

  async function init() {
    if (initialization) return initialization

    loading.value = true
    error.value = ''
    initialization = Promise.all([dmApi.users(), dmApi.conversations()]).then(([loadedUsers, loadedConversations]) => {
      users.value = loadedUsers
      conversations.value = loadedConversations
      meId.value = dmApi.meId()
    }).catch((cause) => {
      error.value = errorMessage(cause)
    }).finally(() => {
      loading.value = false
      initialization = null
    })

    return initialization
  }

  function partnerId(conversation) {
    return conversation.members.find((id) => id !== meId.value) ?? null
  }

  function titleOf(conversation) {
    if (conversation.name) return conversation.name
    if (conversation.type === 'dm') return usersById.value[partnerId(conversation)]?.name ?? ''
    return conversation.members
      .filter((id) => id !== meId.value)
      .map((id) => usersById.value[id]?.name)
      .filter(Boolean)
      .join(', ')
  }

  function openConversation(id) {
    if (conversations.value.some((conversation) => conversation.id === id)) activeId.value = id
  }

  function closeConversation(id) {
    conversations.value = conversations.value.filter((conversation) => conversation.id !== id)
    if (activeId.value === id) activeId.value = null
  }

  function startConversation(memberIds, name = '') {
    const members = [...new Set([meId.value, ...memberIds])]
    const existing = conversations.value.find(
      (conversation) =>
        conversation.members.length === members.length &&
        members.every((memberId) => conversation.members.includes(memberId))
    )

    if (existing) {
      openConversation(existing.id)
      return existing
    }

    const conversation = {
      id: createId(),
      type: members.length === 2 ? 'dm' : 'group',
      members,
      name: name.trim(),
      unreadCount: 0,
      messages: [],
    }
    conversations.value.push(conversation)
    activeId.value = conversation.id
    return conversation
  }

  function startDm(userId) {
    return startConversation([userId])
  }

  function startGroup(userIds, name = '') {
    return startConversation(userIds, name)
  }

  function receiveDemo() {
    const conversation = sorted.value.find((item) => item.messages.length)
    if (!conversation) return
    conversation.unreadCount += 1
  }

  return {
    meId,
    users,
    usersById,
    conversations,
    sorted,
    activeId,
    loading,
    error,
    init,
    partnerId,
    titleOf,
    openConversation,
    closeConversation,
    startDm,
    startGroup,
    receiveDemo,
  }
})
