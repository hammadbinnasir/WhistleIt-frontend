// Mock members API. Replace with real calls (members, add/remove endpoints).
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms))
let MEMBERS = [
  { id: 'u5', name: 'Aiman Iqbal' },
  { id: 'u6', name: 'Ali Umais' },
  { id: 'u3', name: 'Hammad Bin Nasir' },
  { id: 'u2', name: 'Hammad Haider' },
  { id: 'u8', name: 'Muhammad Abdullah Tariq' },
  { id: 'u4', name: 'Muhammad Ahmad Imran' },
]
export async function listMembers() {
  await wait()
  return [...MEMBERS]
}
export async function removeMember(userId) {
  await wait()
  MEMBERS = MEMBERS.filter((m) => m.id !== userId)
}
export async function addMember(user) {
  await wait()
  if (!MEMBERS.find((m) => m.id === user.id)) MEMBERS.push(user)
}
export async function getWebhookUrl(channelId) {
  await wait(100)
  return `https://app.whistleit.io/api/webhooks/${channelId}`
}
export async function leaveChannel() {
  await wait()
}
