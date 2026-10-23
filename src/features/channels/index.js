// Public entry point of the Channels module.
// Other modules should import ONLY from here, never from deep paths.
export { default as ChannelSidebar } from './components/ChannelSidebar.vue'
export { default as ChannelHeader } from './components/ChannelHeader.vue'
export { useChannelsStore } from './store/channels.store'
