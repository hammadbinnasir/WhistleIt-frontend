export const ME_ID = 'u1' // baad mein auth store se aayega

export const USERS = [
  { id: 'u1', name: 'Aiman Iqbal' },
  { id: 'u2', name: 'Muniba Naseer' },
  { id: 'u3', name: 'Ali Umais' },
  { id: 'u4', name: 'Salman Zahoor' },
  { id: 'u5', name: 'Muhammad Ahmad' },
  { id: 'u6', name: 'Esha Fayyaz' },
  { id: 'u7', name: 'Taha Jawad' },
  { id: 'u8', name: 'Syed Mukarram Ali' },
]

// state: online | away | offline, status: custom status (emoji + text)
export const PRESENCE = {
  u1: { state: 'online', status: { emoji: '', text: '' } },
  u2: { state: 'offline', status: { emoji: '', text: 'On leave' } },
  u3: { state: 'online', status: { emoji: '', text: 'Coding' } },
  u4: { state: 'online', status: { emoji: '', text: '' } },
  u5: { state: 'online', status: { emoji: '', text: 'Studying' } },
  u6: { state: 'online', status: { emoji: '', text: '' } },
  u7: { state: 'offline', status: { emoji: '', text: '' } },
  u8: { state: 'offline', status: { emoji: '', text: '' } },
}

const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString()

// Sirf 1:1 DMs. List latest message ke hisaab se sort hoti hai, isliye time se order set hai
const dm = (id, userId, text, hoursAgo, unread = 0) => ({
  id,
  type: 'dm',
  members: [ME_ID, userId],
  unreadCount: unread,
  messages: [{ id: `m-${id}`, from: userId, text, createdAt: ago(hoursAgo) }],
})

export const CONVERSATIONS = [
  dm('c1', 'u2', 'Project ideas bhej di hain', 1, 2),
  dm('c2', 'u3', 'Kal meeting hai, 11 baje', 2),
  dm('c3', 'u4', 'PR merge ho gaya', 3),
  dm('c4', 'u5', 'Assignment ka update?', 4),
  dm('c5', 'u6', 'Thanks!', 5),
  dm('c6', 'u7', 'Theek hai', 6),
  dm('c7', 'u8', 'Done', 7),
]

export const NOTIFICATIONS = [
  { id: 'n1', type: 'message', conversationId: 'c1', title: 'Muniba Naseer', body: 'Project ideas bhej di hain', createdAt: ago(1), read: false },
  { id: 'n2', type: 'message', conversationId: 'c3', title: 'Salman Zahoor', body: 'PR merge ho gaya', createdAt: ago(3), read: false },
  { id: 'n3', type: 'mention', conversationId: 'c2', title: 'Ali Umais ne mention kiya', body: '@Aiman kal meeting hai', createdAt: ago(2), read: true },
]