// Public entry point of the Shell & Teams module.
// Other modules should import from here.
export { default as TeamRail } from './components/TeamRail.vue'
export { default as TeamSwitcher } from './components/TeamSwitcher.vue'
export { default as WorkspaceSwitcher } from './components/WorkspaceSwitcher.vue'
export { default as CreateTeamModal } from './components/CreateTeamModal.vue'
export { default as CreateWorkspaceModal } from './components/CreateWorkspaceModal.vue'
export { default as JoinTeamModal } from './components/JoinTeamModal.vue'
export { default as HelpModal } from './components/HelpModal.vue'
export { default as HelpDrawer } from './components/HelpDrawer.vue'
export { default as MemberManageModal } from './components/MemberManageModal.vue'
export { useTeamsStore } from '@/stores/teams'
export { useMembersStore } from '@/stores/members'
