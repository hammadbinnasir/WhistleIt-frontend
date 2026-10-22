<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  closeOnBackdrop: { type: Boolean, default: true },
})

const emit = defineEmits(['close'])

const panel = ref(null)
let previouslyFocused = null
let previousOverflow = ''

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

const onBackdrop = () => {
  if (props.closeOnBackdrop) emit('close')
}

const onKeydown = (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !panel.value) return

  const items = [...panel.value.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.hidden && el.getClientRects().length > 0,
  )
  if (!items.length) {
    e.preventDefault()
    return
  }

  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement

  if (e.shiftKey && (active === first || active === panel.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  previouslyFocused = document.activeElement
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  const target = panel.value?.querySelector('[data-autofocus]') || panel.value
  target?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @mousedown.self="onBackdrop" @keydown="onKeydown">
      <div ref="panel" class="panel" tabindex="-1">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  padding: 16px;
  box-sizing: border-box;
  overflow: auto;
  background: rgba(31, 31, 46, 0.5);
}

/* margin:auto centres the card and, unlike align-items:center, never clips its top */
.panel {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  margin: auto;
  outline: none;
}
</style>
