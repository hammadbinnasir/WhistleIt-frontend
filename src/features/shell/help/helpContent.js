// Everything shown in the Help drawer lives in this file.
//
// TEXT   - edit the strings below. They are copied as written in the navigation document.
// IMAGES - every article (section) has an image slot, shown under its text.
//          Either drop a file in src/assets/help/ named after the section id plus any extension
//          (features-2.gif, features-2.svg, ...), or link one with `image: 'https://…'`.
//          Slides and topic icons work the same way through `media: { name, url }`.
//          The full list of names is in src/assets/help/README.md.
//
// Section fields: id (unique, also the image file name), title, text, bullets, steps, image.
// Page fields:    id, title, icon, iconMedia, numbering ('prefix' = "1:Title", 'badge' = number in
//                 a circle, 'none'), badge ('dark' | 'indigo'), large (bigger type), heading
//                 (centered title at the top of the page), sections.

const SHORTCUT_COMMANDS =
  'Shortcut Commands: Empowering Users for Efficiency. Customize quick-access shortcuts to streamline workflows, save time, and boost productivity. Unlock enhanced functionality at your fingertips.'

const MUTE_CHANNEL_WITH_TIMER =
  'Silence channels or groups with our "Mute Channel with Timer" feature. Choose to temporarily mute notifications for a specified duration, reducing distractions and allowing uninterrupted focus. Take control of your notifications and stay productive with ease.'

const STATUS_WITH_TIMER =
  'Introducing the "Status with Timer" feature, where users can now set their status for a specific duration. With this new functionality, users have the flexibility to define a timeframe for their status updates, whether its for an hour, a day, or a week.'

// ---------------------------------------------------------------------------------------------
// Carousel ("Discover more")
// ---------------------------------------------------------------------------------------------

export const helpSlides = [
  {
    id: 'whats-new',
    title: "What's new in Whistleit",
    subtitle: 'Discover new features available now',
    art: 'gift', // built-in artwork shown until `media` has an image
    media: { name: 'slide-whats-new', url: null },
  },
  {
    id: 'comm-companies',
    title: 'Communication between companies',
    subtitle: 'Click to try it and learn more',
    art: 'company',
    media: { name: 'slide-communication', url: null },
  },
  {
    id: 'quick-jump',
    title: 'Quickly jump to another conversation',
    subtitle: 'Click to try it and learn more',
    art: 'jump',
    media: { name: 'slide-quick-jump', url: null },
  },
]

// ---------------------------------------------------------------------------------------------
// Topic: Features
// ---------------------------------------------------------------------------------------------

const featureItems = [
  {
    title: 'Seamless Communication',
    text: "Chat, collaborate, and share files with ease on WhistleIt's secure and adaptable platform",
  },
  {
    title: 'Enhanced Visuals',
    text: 'Share images, videos, and screenshots to make your messages more impactful and straightforward',
  },
  {
    title: 'Powerful Screen Sharing',
    text: "Illustrate your ideas with WhistleIt's screen sharing feature, streamlining team collaboration",
  },
  {
    title: 'Clear Audio Communication',
    text: "Convey your thoughts with clarity through WhistleIt's voice note feature",
  },
  {
    title: 'Customizable Teams',
    text: "Create and join teams, whether department-specific or company-wide, within WhistleIt's digital workspace",
  },
  {
    title: 'Streamlined Chat Channels',
    text: 'Utilize channels for topic, group, or meeting-based chat, reducing the clutter of emails. Choose between public, private, or direct channels as needed',
  },
  {
    title: 'Support Channel',
    text: "Resolve intra-team queries with ease through WhistleIt's support channel, connecting you with a dedicated support team",
  },
  {
    title: 'Cloud Channel',
    text: "Create secure communication channels with employees from other companies through WhistleIt's cloud channel feature",
  },
  {
    title: 'Create Poll',
    text: 'Create and share polls with multiple choice questions, set options, and view results and analytics in real-time with WhistleIt create poll feature',
  },
  {
    title: 'Schedule Message',
    text: "Compose and schedule messages to be sent at a specified date and time, ensuring important messages are delivered even when you're unavailable",
  },
  {
    title: 'Forward Message',
    text: 'Forward messages with just a few clicks, making communication and information sharing more efficient, especially in group conversations',
  },
  {
    title: 'Important Message',
    text: 'With the "Important Message" feature, users can now emphasize the urgency or importance of their messages. By marking a message as important, users are notified every 5 minutes for up to 20 minutes until the message is seen. This ensures that critical messages receive the necessary attention and enables effective communication even in time-sensitive situations.',
  },
  {
    title: 'Empower users with shortcut commands',
    text: SHORTCUT_COMMANDS,
  },
  {
    title: 'Unread message',
    text: 'Introducing the "Unread Message" Feature, a dedicated tab that consolidates all unread messages for quick and easy access. This convenient tab allows users to effortlessly view to unread messages with just a single click.',
  },
  {
    title: 'Mute channel with timer',
    text: MUTE_CHANNEL_WITH_TIMER,
  },
  {
    title: 'Add status with timer',
    text: STATUS_WITH_TIMER,
  },
  {
    title: 'Seamless Audio Playback',
    text: "Enjoy uninterrupted audio playback with WhistleIt's innovative feature, allowing audio to continue playing even when switching channels. This multi-tasking feature lets you work on other tasks while the audio message plays in the background, maximizing productivity and convenience.",
  },
  {
    title: 'Cmd + K Sort with recent chat',
    text: 'Sort chats by recent activity or alphabetically (A-Z) for improved flexibility and ease of use in quick search',
  },
]

// ---------------------------------------------------------------------------------------------
// Topics (the four rows under "Explore help topics")
// ---------------------------------------------------------------------------------------------

export const helpPages = [
  {
    id: 'features',
    title: 'Features',
    icon: 'star', // built-in icon shown until `iconMedia` has an image
    iconMedia: { name: 'icon-features', url: null },
    numbering: 'prefix',
    sections: featureItems.map((item, index) => ({ id: `features-${index + 1}`, ...item })),
  },
  {
    id: 'direct-messages',
    title: 'Understand direct messages',
    icon: 'chat',
    iconMedia: { name: 'icon-direct-messages', url: null },
    numbering: 'none',
    large: true,
    sections: [
      {
        id: 'direct-messages-intro',
        title: 'Leverage the Power of Direct Messages on WhistleIt',
        text: 'Direct Messages, or DMs, are a powerful tool within WhistleIt, providing a secure and private space for individual conversations. Unlike public channels, DMs are not visible to the rest of the team, making them ideal for sensitive or personal discussions that do not require input from multiple individuals.',
      },
      {
        id: 'direct-messages-access',
        title: 'Effortless Access to Direct Messages',
        bullets: [
          'Accessing your DMs is easy and convenient. By default, your most recent DMs are displayed under the "Direct Messages" header in the left sidebar, allowing for quick and easy access. If you need to locate a specific DM, simply click the "+" icon to view all of your DMs or use ctrl/cmd + k.',
          "With WhistleIt's robust and sophisticated Direct Message feature, you have the power to communicate and collaborate with colleagues in a private and secure manner. So why wait? Start leveraging the power of DMs today!.",
        ],
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Problem with notification',
    icon: 'bell',
    iconMedia: { name: 'icon-notifications', url: null },
    numbering: 'badge',
    badge: 'dark',
    sections: [
      {
        id: 'notifications-browser',
        title: 'Problem with notification on browser',
        text: 'If you are facing issues with receiving notifications on browser, you can try enabling notification permission',
      },
      {
        id: 'notifications-mac',
        title: 'Problem with notification on mac',
        text: 'If you are facing a problem with notifications on a Mac, its possible that the notification permission for the specific application is not enabled. To enable the notification permission, follow these steps:',
        steps: [
          'Click the Apple icon in the top-left corner of your screen, and select "System Preferences".',
          'Select "Notifications".',
          'Ensure that the "Allow Notifications" checkbox is selected.',
          'If the "Allow Notifications" checkbox is not selected, click on it to enable notifications for that application.',
          'Close the System Preferences window.',
        ],
      },
    ],
  },
  {
    id: 'mentions',
    title: 'Use mention at Whistleit',
    icon: 'at',
    iconMedia: { name: 'icon-mentions', url: null },
    numbering: 'badge',
    badge: 'dark',
    sections: [
      {
        id: 'mentions-overview',
        title: 'Use mentions in Whistleit',
        // This text is transcribed from the screenshot in the document (the document has no text for it).
        text: "Mentions in Whistleit are a feature that allows you to notify specific individuals or teams about a message that requires their attention. To mention someone in a message, type the '@' symbol followed by the person's name or username. You can also mention a specific team by using @channel or @here. This will send a notification to the mentioned individuals or teams and they will be able to quickly respond to the message.",
      },
    ],
  },
]

// ---------------------------------------------------------------------------------------------
// What's New (gift icon in the header)
// ---------------------------------------------------------------------------------------------

export const whatsNewPage = {
  id: 'whats-new',
  title: "What's New",
  heading: "What's New",
  numbering: 'badge',
  badge: 'indigo',
  sections: [
    {
      id: 'whats-new-1',
      title: 'Send recent files',
      text: 'This feature will enable you to conveniently access and share your recently uploaded files, such as photos, audio files, and videos, from a unified location. By streamlining your workflow, it will allow you to quickly locate and share your most recent files with a single click.',
    },
    {
      id: 'whats-new-2',
      title: 'Recent messages',
      text: 'Introducing the "Recent Message" Feature, a dedicated tab that consolidates all recent messages for quick and easy access. This convenient tab allows users to effortlessly view to recent messages with just a single click.',
    },
    {
      id: 'whats-new-3',
      title: 'Change schedule meassge flow',
      text: 'Our Scheduled Message feature allows users to send messages to other users at their preferred local time, ensuring timely communication and avoiding the hassle of time zone conversions.',
    },
    {
      id: 'whats-new-4',
      title: 'Send message as important',
      text: 'With the "Send Message as Important" feature, users can now emphasize the urgency or importance of their messages. By marking a message as important, users are notified every 5 minutes for up to 20 minutes until the message is seen. This ensures that critical messages receive the necessary attention and enables effective communication even in time-sensitive situations.',
    },
    {
      id: 'whats-new-5',
      title: 'Empower users with shortcut commands',
      text: SHORTCUT_COMMANDS,
    },
    {
      id: 'whats-new-6',
      title: 'Mute channel with timer',
      text: MUTE_CHANNEL_WITH_TIMER,
    },
    {
      id: 'whats-new-7',
      title: 'Add status with timer',
      text: STATUS_WITH_TIMER,
    },
    {
      id: 'whats-new-8',
      title: 'Channel header avatar',
      text: 'The feature of displaying all user avatars in the header provides a quick and easy way to see who is part of a channel. The user avatars are displayed in a compact and visually appealing manner, making it simple to see who is online and available.',
    },
  ],
}

export const allHelpPages = [...helpPages, whatsNewPage]

// ---------------------------------------------------------------------------------------------
// Keyboard Shortcuts dialog (keyboard icon in the header)
// ---------------------------------------------------------------------------------------------

export const shortcutColumns = [
  {
    title: 'Messages',
    groups: [
      {
        title: 'Works inside an empty input field or on message hover',
        items: [
          { label: 'Copy message', keys: ['Ctrl', 'G'] },
          { label: 'Edit message', keys: ['Ctrl', 'E'] },
          { label: 'Delete message', keys: ['Ctrl', 'D'] },
          { label: 'Forward message', keys: ['Ctrl', 'H'] },
          { label: 'Reply to message', keys: ['Ctrl', 'J'] },
          { label: 'Set message reminder', keys: ['Ctrl', 'A'] },
        ],
      },
      {
        title: 'Works in sending a message',
        items: [
          { label: 'Emoji menu', keys: ['ctrl', 'shift', 'L'] },
          { label: 'Attach file', keys: ['ctrl', 'shift', 'U'] },
          { label: 'Attach recent file', keys: ['ctrl', '2'] },
          { label: 'Start audio recording', keys: ['ctrl', 'shift', 'O'] },
          { label: 'Start screen recording', keys: ['ctrl', 'shift', 'S'] },
          { label: 'Create poll', keys: ['ctrl', 'shift', 'P'] },
          { label: 'Send scheduled message', keys: ['ctrl', 'shift', 'Y'] },
          { label: 'Send important Message', keys: ['Ctrl', '1'] },
        ],
      },
      {
        title: 'Formatting',
        items: [
          { label: 'Bold', keys: ['Ctrl', 'B'] },
          { label: 'Italicize', keys: ['Ctrl', 'I'] },
          { label: 'Underline', keys: ['Ctrl', 'U'] },
          { label: 'Strike', keys: ['Ctrl', 'D'] },
          { label: 'Code', keys: ['Ctrl', 'Shift', '\\'] },
          { label: 'Bullet List', keys: ['Ctrl', 'Shift', '8'] },
          { label: 'Order List', keys: ['Ctrl', 'Shift', '9'] },
        ],
      },
    ],
  },
  {
    title: 'Navigation',
    groups: [
      {
        title: null,
        items: [
          { label: 'Quick navigation over Whistle It', keys: ['ctrl', 'K'] },
          { label: 'Messages, links and files search', keys: ['ctrl', 'F'] },
        ],
      },
      {
        title: 'Works inside an empty input field',
        items: [
          { label: 'Highlight latest message', keys: ['Down'] },
          { label: 'Highlight previous message', keys: ['Up'] },
        ],
      },
      {
        title: 'Other',
        items: [
          { label: 'Open account setting', keys: ['Ctrl', 'Shift', 'I'] },
          { label: 'Open channel Setting', keys: ['Ctrl', 'Shift', 'X'] },
          { label: 'Open reminder drawer', keys: ['Ctrl', 'Shift', '2'] },
          { label: 'Open Pinned message drawer', keys: ['Ctrl', 'Shift', '6'] },
          { label: 'Open help drawer', keys: ['Ctrl', 'Esc'] },
        ],
      },
    ],
  },
]
