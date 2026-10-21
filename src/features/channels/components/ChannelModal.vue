<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ChIcon from './ChIcon.vue'
import '../styles/tokens.css'

const props = defineProps({
  title: { type: String, required: true },
  width: { type: String, default: '540px' },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const panel = ref(null)
let previousOverflow = ''
let previousFocus = null

function requestClose() {
  if (!props.busy) emit('close')
}

function trapFocus(event) {
  const focusable = panel.value?.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  )
  if (!focusable || !focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    requestClose()
  } else if (event.key === 'Tab') {
    trapFocus(event)
  }
}

onMounted(() => {
  previousFocus = document.activeElement
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKeydown)
  nextTick(() => {
    if (panel.value && !panel.value.contains(document.activeElement)) panel.value.focus()
  })
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', onKeydown)
  if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="ch-modal__backdrop" @mousedown.self="requestClose">
      <div
        ref="panel"
        class="ch-modal"
        :style="{ maxWidth: width }"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
      >
        <button class="ch-modal__close" type="button" aria-label="Close" :disabled="busy" @click="requestClose">
          <ChIcon name="close" :size="14" />
        </button>
        <h2 class="ch-modal__title">{{ title }}</h2>
        <div class="ch-modal__body"><slot /></div>
        <div v-if="$slots.footer" class="ch-modal__footer"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ch-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(20, 16, 40, 0.5);
}
.ch-modal {
  position: relative;
  width: 100%;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: var(--ch-surface);
  color: var(--ch-text);
  border-radius: 6px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  outline: none;
}
.ch-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #ebeaf5;
  color: var(--ch-text);
  cursor: pointer;
}
.ch-modal__close:hover:not(:disabled) {
  background: #dcdaee;
}
.ch-modal__title {
  margin: 0;
  padding: 28px 24px 16px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
}
.ch-modal__body {
  padding: 0 24px 24px;
  overflow-y: auto;
}
.ch-modal__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--ch-border);
}
</style>
