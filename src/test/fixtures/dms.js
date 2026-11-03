export const ME_ID = 'u1'

export const USERS = [
  { id: 'u1', name: 'Aiman Iqbal' },
  { id: 'u2', name: 'Muniba Naseer', avatarUrl: 'https://i.pravatar.cc/150?img=47' },
  { id: 'u3', name: 'Ali Umais' },
  { id: 'u4', name: 'Salman Zahoor' },
  { id: 'u5', name: 'Muhammad Ahmad', avatarUrl: 'https://i.pravatar.cc/150?img=12' },
  { id: 'u6', name: 'Esha Fayyaz' },
  { id: 'u7', name: 'Taha Jawad' },
  { id: 'u8', name: 'Syed Mukarram Ali' },
]

export const PRESENCE = {
  u1: { state: 'online' },
  u2: { state: 'offline' },
  u3: { state: 'online' },
  u4: { state: 'online' },
  u5: { state: 'online' },
  u6: { state: 'online' },
  u7: { state: 'offline' },
  u8: { state: 'offline' },
}

const ago = (hours) => new Date(Date.now() - hours * 3600_000).toISOString()

const dm = (id, userId, text, hoursAgo, unread = 0) => ({
  id,
  type: 'dm',
  members: [ME_ID, userId],
  unreadCount: unread,
  messages: [
    { id: `m-${id}-older`, from: userId, text: `Earlier: ${text}`, createdAt: ago(hoursAgo + 2) },
    {
      id: `m-${id}-followup`,
      from: userId,
      text: `Following up: ${text}`,
      createdAt: ago(hoursAgo + 1),
    },
    { id: `m-${id}`, from: userId, text, createdAt: ago(hoursAgo) },
  ],
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
