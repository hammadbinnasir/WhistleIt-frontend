import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { demoMessages, demoPolls, initialChannelMembers, signedInMembers } from './data'

export const useSearchStore = defineStore('search', () => {
  const messages = ref(demoMessages)
  const membersByChannel = ref(
    Object.fromEntries(
      Object.entries(initialChannelMembers).map(([channelId, memberIds]) => [
        channelId,
        [...memberIds],
      ]),
    ),
  )
  const pollsByChannel = ref({
    frontend: [...demoPolls],
    general: [demoPolls[0]],
    random: [],
  })
  const signedMembers = computed(() => signedInMembers)

  function membersForChannel(channelId) {
    const ids = membersByChannel.value[channelId] || []
    return ids.map((id) => signedMembers.value.find((member) => member.id === id)).filter(Boolean)
  }

  function availableMembers(channelId) {
    const currentIds = new Set(membersByChannel.value[channelId] || [])
    return signedMembers.value.filter((member) => !currentIds.has(member.id))
  }

  function addMembers(channelId, memberIds) {
    const current = new Set(membersByChannel.value[channelId] || [])
    memberIds.forEach((id) => {
      if (signedMembers.value.some((member) => member.id === id)) current.add(id)
    })
    membersByChannel.value[channelId] = [...current]
  }

  function pollsForChannel(channelId) {
    return pollsByChannel.value[channelId] || []
  }

  return {
    messages,
    signedMembers,
    membersForChannel,
    availableMembers,
    addMembers,
    pollsForChannel,
  }
})
