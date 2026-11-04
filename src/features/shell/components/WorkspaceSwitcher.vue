<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTeamsStore } from '@/stores/teams'
import { useAnchoredPopover } from '../composables/useAnchoredPopover'

const emit = defineEmits(['select'])
const teamsStore = useTeamsStore()
const { workspaces, activeWorkspaceId } = storeToRefs(teamsStore)
const activeWorkspace = computed(
  () =>
    workspaces.value.find(
      (workspace) => String(workspace.id) === String(activeWorkspaceId.value),
    ) ??
    workspaces.value[0] ??
    null,
)

const isOpen = ref(false)
const trigger = ref(null)
const menu = ref(null)
const position = ref({ top: 0, left: 0 })
const hoverBridgeStyle = ref(null)
let openTimer = null
let closeTimer = null
let restoringFocus = false

const { close: dismiss, updatePosition } = useAnchoredPopover({
  isOpen,
  triggerRef: trigger,
  popoverRef: menu,
  position,
  placement: 'right-start',
  offset: 28,
  onClose: () => {
    isOpen.value = false
  },
  onRestoreFocus: () => {
    restoringFocus = true
    trigger.value?.focus()
    restoringFocus = false
  },
})

function getInitials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

function clearTimers() {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
  openTimer = null
  closeTimer = null
}

function openFlyout() {
  clearTimers()
  isOpen.value = true
  nextTick(updatePosition)
}

function updateHoverBridge() {
  const triggerBounds = trigger.value?.getBoundingClientRect()
  const menuBounds = menu.value?.getBoundingClientRect()
  if (!triggerBounds || !menuBounds) {
    hoverBridgeStyle.value = null
    return
  }

  const isToRight = menuBounds.left >= triggerBounds.right
  const left = isToRight ? triggerBounds.right : menuBounds.right
  const width = isToRight
    ? menuBounds.left - triggerBounds.right
    : triggerBounds.left - menuBounds.right

  hoverBridgeStyle.value =
    width > 0
      ? {
          top: `${menuBounds.top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${menuBounds.height}px`,
        }
      : null
}

function refreshFlyoutPosition() {
  updatePosition()
  nextTick(updateHoverBridge)
}

function stopTrackingFlyoutPosition() {
  window.removeEventListener('resize', refreshFlyoutPosition)
  window.removeEventListener('scroll', refreshFlyoutPosition, true)
}

watch(
  isOpen,
  async (open) => {
    stopTrackingFlyoutPosition()
    if (!open) {
      hoverBridgeStyle.value = null
      return
    }

    await nextTick()
    refreshFlyoutPosition()
    window.addEventListener('resize', refreshFlyoutPosition)
    window.addEventListener('scroll', refreshFlyoutPosition, true)
  },
  { flush: 'post' },
)

function handleTriggerFocus() {
  if (!restoringFocus) openFlyout()
}

function scheduleOpen() {
  clearTimeout(closeTimer)
  clearTimeout(openTimer)
  openTimer = setTimeout(openFlyout, 150)
}

function scheduleClose() {
  clearTimeout(openTimer)
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    isOpen.value = false
    closeTimer = null
  }, 200)
}

function cancelClose() {
  clearTimeout(closeTimer)
  closeTimer = null
}

function handleFocusout(event) {
  if (
    event.relatedTarget &&
    (trigger.value?.contains(event.relatedTarget) || menu.value?.contains(event.relatedTarget))
  ) {
    return
  }
  scheduleClose()
}

function handleTriggerKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  openFlyout()
  nextTick(() => {
    const items = menu.value?.querySelectorAll('[role="menuitem"]')
    if (!items?.length) return
    items[event.key === 'ArrowUp' ? items.length - 1 : 0].focus()
  })
}

function handleMenuKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const items = [...(menu.value?.querySelectorAll('[role="menuitem"]') ?? [])]
  if (!items.length) return
  event.preventDefault()
  const currentIndex = items.indexOf(document.activeElement)
  const direction = event.key === 'ArrowDown' ? 1 : -1
  const nextIndex = (currentIndex + direction + items.length) % items.length
  items[nextIndex].focus()
}

function selectWorkspace(workspaceId) {
  clearTimers()
  dismiss(true)
  emit('select', workspaceId)
}

onBeforeUnmount(() => {
  clearTimers()
  stopTrackingFlyoutPosition()
})
</script>

<template>
  <div class="workspace-switcher" @focusout="handleFocusout">
    <button
      v-if="activeWorkspace"
      ref="trigger"
      type="button"
      class="workspace-switcher__button"
      :title="activeWorkspace.name"
      :aria-label="`Active workspace: ${activeWorkspace.name}`"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :aria-current="'page'"
      @mouseenter="scheduleOpen"
      @mouseleave="scheduleClose"
      @focus="handleTriggerFocus"
      @click="openFlyout"
      @keydown="handleTriggerKeydown"
    >
      {{ activeWorkspace.initials || getInitials(activeWorkspace.name) }}
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen && hoverBridgeStyle"
        class="workspace-switcher__hover-bridge"
        aria-hidden="true"
        :style="hoverBridgeStyle"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      />
      <div
        v-if="isOpen"
        ref="menu"
        class="workspace-switcher__menu shell-surface"
        role="menu"
        aria-label="Workspaces"
        :style="{ top: position.top, left: position.left }"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
        @focusout="handleFocusout"
        @keydown="handleMenuKeydown"
      >
        <button
          v-for="workspace in workspaces"
          :key="workspace.id"
          type="button"
          class="workspace-switcher__item"
          :class="{
            'workspace-switcher__item--active': String(activeWorkspaceId) === String(workspace.id),
          }"
          role="menuitem"
          :aria-current="String(activeWorkspaceId) === String(workspace.id) ? 'page' : undefined"
          :title="workspace.name"
          @click="selectWorkspace(workspace.id)"
        >
          <span class="workspace-switcher__initials">
            {{ workspace.initials || getInitials(workspace.name) }}
          </span>
          <span class="workspace-switcher__name">{{ workspace.name }}</span>
          <span
            v-if="workspace.isAdmin || workspace.role === 'admin'"
            class="workspace-switcher__admin"
          >
            Admin
          </span>
          <svg
            v-if="String(activeWorkspaceId) === String(workspace.id)"
            class="workspace-switcher__check"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path d="m4 10 4 4 8-8" />
          </svg>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.workspace-switcher {
  display: flex;
  width: 100%;
  justify-content: center;
  padding: 2px 0;
}

.workspace-switcher__button {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: var(--color-orange-500);
  color: var(--color-white);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  transition:
    border-radius 150ms ease,
    transform 150ms ease,
    box-shadow 150ms ease;
}

.workspace-switcher__button:hover {
  border-radius: 7px;
  transform: scale(1.05);
  box-shadow: 0 0 0 2px var(--color-white);
}

.workspace-switcher__button:focus-visible,
.workspace-switcher__item:focus-visible {
  outline: 2px solid var(--shell-accent);
  outline-offset: 2px;
}

.workspace-switcher__menu {
  position: fixed;
  z-index: var(--shell-z-popover);
  display: flex;
  width: min(17rem, calc(100vw - 1rem));
  max-height: min(70vh, 24rem);
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  padding: 0.375rem;
  scrollbar-color: var(--color-slate-400) transparent;
  scrollbar-width: thin;
}

.workspace-switcher__hover-bridge {
  position: fixed;
  z-index: var(--shell-z-popover);
  background: transparent;
}

.workspace-switcher__item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.625rem;
  border: 0;
  border-radius: 0.5rem;
  padding: 0.5rem;
  background: transparent;
  color: var(--color-slate-800);
  cursor: pointer;
  text-align: left;
}

.workspace-switcher__item:hover,
.workspace-switcher__item--active {
  background: var(--color-indigo-50);
}

.workspace-switcher__initials {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.5rem;
  background: var(--color-orange-500);
  color: var(--color-white);
  font-size: 0.75rem;
  font-weight: 700;
}

.workspace-switcher__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-switcher__admin {
  color: var(--color-slate-600);
  font-size: 0.6875rem;
  font-weight: 600;
}

.workspace-switcher__check {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  stroke: var(--shell-accent);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
</style>
