const ago = (hours) => new Date(Date.now() - hours * 3600_000).toISOString()

export const NOTIFICATIONS = [
  {
    id: 'n1',
    type: 'message',
    conversationId: 'c1',
    title: 'Muniba Naseer',
    body: 'Project ideas bhej di hain',
    createdAt: ago(1),
    read: false,
  },
  {
    id: 'n2',
    type: 'message',
    conversationId: 'c3',
    title: 'Salman Zahoor',
    body: 'PR merge ho gaya',
    createdAt: ago(3),
    read: false,
  },
]
