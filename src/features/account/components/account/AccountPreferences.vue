<script setup>
import { reactive } from 'vue'

const props = defineProps({
  preferences: { type: Object, default: () => ({}) },
})

const defaults = {
  enterKey: 'send',
  doubleClick: 'default',
  leftClick: 'menu',
  workspaceSwitch: 'current',
}

const form = reactive(
  Object.fromEntries(Object.keys(defaults).map((k) => [k, props.preferences[k] ?? defaults[k]]))
)

const sections = [
  {
    key: 'enterKey',
    title: 'When writing a message, press',
    keycap: 'Enter',
    titleSuffix: 'to…',
    options: [
      { value: 'send', label: 'Send the message' },
      { value: 'newline', label: 'Start a new line', keys: ['Shift', 'Enter'] },
    ],
  },
  {
    key: 'doubleClick',
    title: 'When double click on message',
    options: [
      { value: 'default', label: 'Default Selection' },
      { value: 'reminder', label: 'Add Reminder' },
    ],
  },
  {
    key: 'leftClick',
    title: 'When left click on message',
    options: [
      { value: 'default', label: 'Default Click' },
      { value: 'menu', label: 'Open Menu' },
    ],
  },
  {
    key: 'workspaceSwitch',
    title: 'When switching to a different workspace',
    options: [
      { value: 'current', label: 'Open in Current Tab' },
      { value: 'new', label: 'Open in New Tab' },
    ],
  },
]

const getValues = () => ({ preferences: { ...form } })

defineExpose({ getValues })
</script>

<template>
  <div>
    <div
      v-for="section in sections"
      :key="section.key"
      class="section"
      role="radiogroup"
      :aria-labelledby="`pref-title-${section.key}`"
    >
      <h4 :id="`pref-title-${section.key}`" class="section-title">
        {{ section.title }}
        <kbd v-if="section.keycap" class="kbd kbd-lg">{{ section.keycap }}</kbd>
        <template v-if="section.titleSuffix">{{ ' ' + section.titleSuffix }}</template>
      </h4>

      <label v-for="opt in section.options" :key="opt.value" class="radio">
        <input
          v-model="form[section.key]"
          class="radio-input"
          type="radio"
          :name="`pref-${section.key}`"
          :value="opt.value"
        />
        <span class="radio-mark"></span>
        <span class="radio-label">
          {{ opt.label }}
          <template v-if="opt.keys">
            (use
            <kbd class="kbd">{{ opt.keys[0] }}</kbd>
            <kbd class="kbd">{{ opt.keys[1] }}</kbd>
            to send)
          </template>
        </span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 40px;
  padding-left: 15px;
}

.section-title {
  margin: 0 0 30px;
  font-size: 19px;
  font-weight: 700;
  color: #1f1f2e;
}

/* Keycaps */
.kbd {
  display: inline-block;
  padding: 1px 6px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 400;
  color: #1f1f2e;
  background: #dcdcdc;
  border-radius: 3px;
  line-height: 1.25;
}
.kbd-lg {
  font-size: 18px;
  padding: 1px 6px;
}

/* Radios */
.radio {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  height: 40px;
  padding-left: 13px;
  cursor: pointer;
}

.radio-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.radio-mark {
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  border: 2px solid #676879;
  border-radius: 50%;
  flex-shrink: 0;
  position: relative;
  transition: border-color 0.15s;
}
.radio-mark::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: #5559f4;
  transform: scale(0);
  transition: transform 0.15s;
}

.radio-input:checked + .radio-mark { border-color: #5559f4; }
.radio-input:checked + .radio-mark::after { transform: scale(1); }
.radio-input:focus-visible + .radio-mark { box-shadow: 0 0 0 3px rgba(85, 89, 244, 0.3); }

.radio-label {
  font-size: 16px;
  color: #676879;
}
</style>
