<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import '../styles/tokens.css'

// Floating menu rendered in <body> (so sidebar overflow can never clip it).
const props = defineProps({
  open: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] }, // [{ key, label, danger?, divider? }]
})
const emit = defineEmits(['select', 'close'])

const el = ref(null)
const position = ref({ left: 0, top: 0 })

function onDocumentMouseDown(event) {
  if (el.value && !el.value.contains(event.target)) emit('close')
}
function onKeydown(event) {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const buttons = [...(el.value?.querySelectorAll('button') || [])]
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement)
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1
    buttons[(next + buttons.length) % buttons.length].focus()
  }
}
function onDismiss() {
  emit('close')
}

function listen() {
  document.addEventListener('mousedown', onDocumentMouseDown)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onDismiss)
  window.addEventListener('scroll', onDismiss, true)
}
function unlisten() {
  document.removeEventListener('mousedown', onDocumentMouseDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onDismiss)
  window.removeEventListener('scroll', onDismiss, true)
}

watch(
  () => [props.open, props.x, props.y],
  async ([open]) => {
    if (!open) {
      unlisten()
      return
    }
    position.value = { left: props.x, top: props.y }
    await nextTick()
    const rect = el.value?.getBoundingClientRect()
    if (!rect) return
    const pad = 8
    position.value = {
      left: Math.max(pad, Math.min(props.x, window.innerWidth - rect.width - pad)),
      top: Math.max(pad, Math.min(props.y, window.innerHeight - rect.height - pad)),
    }
    unlisten() // avoid double-registering when x/y change while open
    listen()
    el.value.querySelector('button')?.focus({ preventScroll: true })
  },
  { immediate: true },
)

onBeforeUnmount(unlisten)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="el"
      class="ch-menu"
      role="menu"
      :style="{ left: `${position.left}px`, top: `${position.top}px` }"
      @contextmenu.prevent
    >
      <template v-for="item in items" :key="item.key">
        <div v-if="item.divider" class="ch-menu__sep" role="separator" />
        <button
          v-else
          class="ch-menu__item"
          :class="{ 'ch-menu__item--danger': item.danger }"
          type="button"
          role="menuitem"
          @click="emit('select', item.key)"
        >
          {{ item.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.ch-menu {
  position: fixed;
  z-index: 2500;
  min-width: 200px;
  padding: 8px 0;
  border-radius: 6px;
  background: var(--ch-surface);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.28);
}
.ch-menu__item {
  display: block;
  width: 100%;
  padding: 14px 20px;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 16px;
  font-weight: 500;
  text-align: left;
  color: var(--ch-text);
  cursor: pointer;
}
.ch-menu__item:hover,
.ch-menu__item:focus-visible {
  background: #f1f0f8;
  outline: none;
}
.ch-menu__item--danger {
  color: var(--ch-danger);
}
.ch-menu__sep {
  height: 1px;
  margin: 6px 0;
  background: var(--ch-border);
}
</style>
