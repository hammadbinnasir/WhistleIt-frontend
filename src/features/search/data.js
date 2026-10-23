const now = Date.now()
const ago = (days, hours = 0) => new Date(now - (days * 24 + hours) * 60 * 60 * 1000).toISOString()

export const signedInMembers = [
  { id: 'u1', name: 'Hammad Bin Nasir', email: 'hammad@pf.com', status: 'online' },
  { id: 'u2', name: 'Taha Jawad', email: 'taha@pf.com', status: 'online' },
  { id: 'u3', name: 'Muhammad Abdullah Tariq', email: 'mabdul@pf.com', status: 'online' },
  { id: 'u4', name: 'Muhammad Humayun', email: 'mhum@pf.com', status: 'away' },
  { id: 'u5', name: 'Syed Mukarram Ali', email: 'mukarram@pf.com', status: 'offline' },
  { id: 'u7', name: 'Ali Raza Akram', email: 'ali@pf.com', status: 'online' },
  { id: 'u9', name: 'Salman Zahoor', email: 'salman@pf.com', status: 'online' },
  { id: 'u10', name: 'Anil Watcher', email: 'anil@pf.com', status: 'offline' },
  { id: 'u11', name: 'Ali Umais', email: 'umais@pf.com', status: 'online' },
  { id: 'u20', name: 'Sarah Khan', email: 'sarah@pf.com', status: 'online' },
  { id: 'u21', name: 'Ahmed Malik', email: 'ahmed@pf.com', status: 'away' },
  { id: 'u22', name: 'Fatima Zahra', email: 'fatima@pf.com', status: 'offline' },
]

const message = (id, conversationId, conversationName, authorId, text, days, hours, extra = {}) => ({
  id,
  conversationId,
  conversationName,
  authorId,
  authorName: signedInMembers.find((member) => member.id === authorId)?.name || 'WhistleIt',
  text,
  createdAt: ago(days, hours),
  ...extra,
})

export const demoMessages = [
  message(
    'msg-1',
    'frontend',
    'Frontend Team Cmi 2',
    'u2',
    'Welcome to the frontend team! The sprint plan and project files are ready to review.',
    0,
    2,
    {
      links: ['https://whistleit.example/projects/frontend'],
      attachments: [
        {
          id: 'file-1',
          name: 'Team member.docx',
          type: 'document',
          url: 'https://whistleit.example/files/team-member.docx',
        },
        {
          id: 'file-2',
          name: 'Intern Project Multi.pdf',
          type: 'pdf',
          url: 'https://whistleit.example/files/intern-project.pdf',
        },
      ],
    },
  ),
  message(
    'msg-2',
    'frontend',
    'Frontend Team Cmi 2',
    'u1',
    'Hammad Nasir, can you share the updated design before our review?',
    0,
    5,
    { links: ['https://design.example.com/frontend-review'] },
  ),
  message(
    'msg-3',
    'frontend',
    'Frontend Team Cmi 2',
    'u3',
    'The new image assets are uploaded. Please check image.png and send any feedback.',
    1,
    1,
    {
      attachments: [
        {
          id: 'file-3',
          name: 'image.png',
          type: 'image',
          url: 'https://whistleit.example/files/image.png',
        },
      ],
    },
  ),
  message(
    'msg-4',
    'general',
    'general',
    'u9',
    'Reminder: all teams should share their weekly update by Friday.',
    1,
    4,
    { links: ['https://whistleit.example/weekly-updates'] },
  ),
  message(
    'msg-5',
    'general',
    'general',
    'u7',
    'The roadmap is ready. I have attached the latest PDF for everyone.',
    2,
    3,
    {
      attachments: [
        {
          id: 'file-4',
          name: 'Product roadmap.pdf',
          type: 'pdf',
          url: 'https://whistleit.example/files/product-roadmap.pdf',
        },
      ],
    },
  ),
  message(
    'msg-6',
    'random',
    'random',
    'u11',
    'Here is the link to the team event photos: https://photos.example.com/team-day',
    3,
    2,
    { links: ['https://photos.example.com/team-day'] },
  ),
  message(
    'msg-7',
    'dm-hammad',
    'Hammad Bin Nasir',
    'u1',
    'Hi! I sent the project requirements in this message.',
    0,
    8,
    {
      attachments: [
        {
          id: 'file-5',
          name: 'Project requirements.pdf',
          type: 'pdf',
          url: 'https://whistleit.example/files/project-requirements.pdf',
        },
      ],
    },
  ),
  message(
    'msg-8',
    'dm-hammad',
    'Hammad Bin Nasir',
    'u2',
    'Thanks, I will review the requirements and reply this afternoon.',
    0,
    7,
    { links: ['https://whistleit.example/tasks/42'] },
  ),
]

export const initialChannelMembers = {
  frontend: ['u1', 'u2', 'u3', 'u4', 'u7', 'u9', 'u11'],
  general: ['u1', 'u2', 'u3', 'u5', 'u7', 'u9'],
  random: ['u2', 'u4', 'u7', 'u10', 'u11'],
}

export const demoPolls = [
  { id: 'poll-1', question: 'Which day works best for the next team review?', votes: 8, status: 'Closed' },
  { id: 'poll-2', question: 'Should we move the design sync to Thursday?', votes: 5, status: 'Closed' },
]
