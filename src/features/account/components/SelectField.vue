<script setup>
import { ref, computed, nextTick, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, required: true }, // [{ value, label }]
  label: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const root = ref(null)
const trigger = ref(null)
const open = ref(false)
const openUp = ref(false)
const activeIndex = ref(-1)

const uid = `sf-${Math.random().toString(36).slice(2, 8)}`
const ITEM_HEIGHT = 50

const selectedIndex = computed(() => props.options.findIndex((o) => o.value === props.modelValue))
const selectedLabel = computed(() => props.options[selectedIndex.value]?.label ?? '')

const openMenu = async () => {
  activeIndex.value = Math.max(selectedIndex.value, 0)
  open.value = true
  await nextTick()

  // Flip upwards when there is no room below but more room above.
  const rect = trigger.value.getBoundingClientRect()
  const needed = props.options.length * ITEM_HEIGHT + 12
  const below = window.innerHeight - rect.bottom
  openUp.value = below < needed && rect.top > below
}

const closeMenu = () => {
  open.value = false
}

const toggle = () => (open.value ? closeMenu() : openMenu())

const choose = (option) => {
  if (!option) return
  emit('update:modelValue', option.value)
  closeMenu()
  trigger.value?.focus()
}

const onKeydown = (e) => {
  const count = props.options.length

  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openMenu()
    }
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      activeIndex.value = (activeIndex.value + 1) % count
      break
    case 'ArrowUp':
      e.preventDefault()
      activeIndex.value = (activeIndex.value - 1 + count) % count
      break
    case 'Home':
      e.preventDefault()
      activeIndex.value = 0
      break
    case 'End':
      e.preventDefault()
      activeIndex.value = count - 1
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      choose(props.options[activeIndex.value])
      break
    case 'Escape':
      // Close only the dropdown, not the surrounding modal.
      e.preventDefault()
      e.stopPropagation()
      closeMenu()
      break
    case 'Tab':
      closeMenu()
      break
  }
}

const onDocMouseDown = (e) => {
  if (root.value && !root.value.contains(e.target)) closeMenu()
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('mousedown', onDocMouseDown)
  else document.removeEventListener('mousedown', onDocMouseDown)
})

onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMouseDown))
</script>

<template>
  <div ref="root" class="select-field">
    <button
      ref="trigger"
      type="button"
      class="trigger"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${uid}-list`"
      :aria-labelledby="`${uid}-label`"
      @click="toggle"
      @keydown="onKeydown"
      @keyup.space.prevent
    >
      <span class="value">{{ selectedLabel }}</span>
      <svg class="caret" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7 10l5 5 5-5z" />
      </svg>
    </button>

    <span :id="`${uid}-label`" class="float-label">{{ label }}</span>

    <ul
      v-if="open"
      :id="`${uid}-list`"
      class="menu"
      :class="{ up: openUp }"
      role="listbox"
      :aria-labelledby="`${uid}-label`"
      :aria-activedescendant="`${uid}-opt-${activeIndex}`"
    >
      <li
        v-for="(option, i) in options"
        :id="`${uid}-opt-${i}`"
        :key="option.value"
        class="option"
        :class="{ selected: option.value === modelValue, active: i === activeIndex }"
        role="option"
        :aria-selected="option.value === modelValue"
        @mousemove="activeIndex = i"
        @click="choose(option)"
      >
        {{ option.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.select-field {
  position: relative;
}

.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 50px;
  box-sizing: border-box;
  padding: 0 10px 0 14px;
  font-family: inherit;
  font-size: 20px;
  color: #1f1f2e;
  text-align: left;
  background: #fff;
  border: 1px solid #a5a6b0;
  border-radius: 4px;
  cursor: pointer;
}
.trigger:focus-visible,
.trigger[aria-expanded='true'] {
  border-color: #5559f4;
  outline: none;
}

.caret {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  color: #5a5b6a;
}

.float-label {
  position: absolute;
  top: -9px;
  left: 11px;
  padding: 0 4px;
  background: #fff;
  font-size: 14px;
  line-height: 1;
  color: #676879;
  pointer-events: none;
}
.trigger[aria-expanded='true'] ~ .float-label {
  color: #5559f4;
}

.menu {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 20;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.2);
}
.menu.up {
  top: auto;
  bottom: calc(100% + 2px);
}

.option {
  display: flex;
  align-items: center;
  height: 50px;
  padding: 0 19px;
  font-size: 18px;
  color: #1f1f2e;
  cursor: pointer;
}
.option.active {
  background: #f4f4f7;
}
.option.selected {
  background: #e4e5fb;
  color: #5559f4;
}
</style>
