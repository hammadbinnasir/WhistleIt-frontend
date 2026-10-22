<script setup>
const props = defineProps({
  modelValue: { type: String, default: 'online' },
})

const emit = defineEmits(['update:modelValue', 'update-custom-status'])

const options = [
  { value: 'online', label: 'Online' },
  { value: 'away', label: 'Away' },
  { value: 'offline', label: 'Offline' },
  { value: 'dnd', label: 'Do Not Disturb', description: 'Disables all notifications' },
]

const select = (value) => emit('update:modelValue', value)
</script>

<template>
  <div class="status-menu" role="menu">
    <button class="item custom" role="menuitem" @click="emit('update-custom-status')">
      <svg class="smile" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14.5c1 1.3 2.3 2 4 2s3-.7 4-2" />
        <line x1="9" y1="9.5" x2="9" y2="10.5" />
        <line x1="15" y1="9.5" x2="15" y2="10.5" />
      </svg>
      <span class="label">Update custom status</span>
    </button>

    <div class="divider"></div>

    <button
      v-for="opt in options"
      :key="opt.value"
      class="item"
      :class="{ active: props.modelValue === opt.value }"
      role="menuitemradio"
      :aria-checked="props.modelValue === opt.value"
      @click="select(opt.value)"
    >
      <span class="dot" :class="opt.value">
        <!-- online: check -->
        <svg v-if="opt.value === 'online'" viewBox="0 0 24 24" fill="none" stroke="#fff"
             stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 12.5l4 4 8-9" />
        </svg>
        <!-- away: clock hands -->
        <svg v-else-if="opt.value === 'away'" viewBox="0 0 24 24" fill="none" stroke="#fff"
             stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6v6h5" />
        </svg>
        <!-- dnd: minus -->
        <svg v-else-if="opt.value === 'dnd'" viewBox="0 0 24 24" fill="none" stroke="#fff"
             stroke-width="3.5" stroke-linecap="round">
          <path d="M6 12h12" />
        </svg>
      </span>

      <span class="text">
        <span class="label">{{ opt.label }}</span>
        <span v-if="opt.description" class="desc">{{ opt.description }}</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.status-menu {
  width: 302px;
  background: #fff;
  border: 1px solid #e5e5e8;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  font-family: 'Roboto', -apple-system, 'Segoe UI', sans-serif;
  overflow: hidden;
}

.item {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 0 18px;
  height: 60px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: #1f1f2e;
}

.item:hover {
  background: #f4f4f7;
}

.item.active {
  background: #e6e6fb;
  color: #5559f4;
}

.item.custom {
  height: 62px;
}

.label {
  font-size: 17px;
  line-height: 1.2;
}

.smile {
  width: 24px;
  height: 24px;
  color: #3b3b4f;
  flex-shrink: 0;
}

.divider {
  height: 1px;
  background: #e5e5e8;
}

.dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.dot svg {
  width: 14px;
  height: 14px;
}

.dot.online { background: #00c875; }
.dot.away { background: #f5c332; }
.dot.offline { background: #fff; border: 1.5px solid #c5c7d0; }
.dot.dnd { background: #fb275d; }

.text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.desc {
  font-size: 13px;
  color: #676879;
}
</style>
