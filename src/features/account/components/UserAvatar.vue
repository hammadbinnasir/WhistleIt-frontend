<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  src: { type: String, default: '' },
  status: {
    type: String,
    default: 'online',
    validator: (v) => ['online', 'away', 'offline', 'dnd', 'none'].includes(v),
  },
  size: { type: Number, default: 48 },
  color: { type: String, default: '#7b2cbf' },
})

const initials = computed(() =>
  props.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join(''),
)

const badgeSize = computed(() => Math.round(props.size * 0.42))
</script>

<template>
  <div class="avatar" :style="{ width: size + 'px', height: size + 'px', '--avatar-color': color }">
    <img v-if="src" class="img" :src="src" :alt="name" />
    <span v-else class="initials" :style="{ fontSize: size * 0.4 + 'px' }">{{ initials }}</span>

    <span
      v-if="status !== 'none'"
      class="badge"
      :class="status"
      :style="{ width: badgeSize + 'px', height: badgeSize + 'px' }"
    >
      <!-- online: check -->
      <svg
        v-if="status === 'online'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M6 12.5l4 4 8-9" />
      </svg>
      <!-- away: clock hands -->
      <svg
        v-else-if="status === 'away'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 6v6h5" />
      </svg>
      <!-- dnd: minus -->
      <svg
        v-else-if="status === 'dnd'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        stroke-width="3.5"
        stroke-linecap="round"
      >
        <path d="M6 12h12" />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 4px;
  background: var(--avatar-color);
  color: #fff;
  font-family:
    'Roboto',
    -apple-system,
    'Segoe UI',
    sans-serif;
  user-select: none;
}

.img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.initials {
  font-weight: 400;
  line-height: 1;
}

.badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  box-sizing: border-box;
  border: 2px solid #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge svg {
  width: 78%;
  height: 78%;
}

.badge.online {
  background: #00c875;
}
.badge.away {
  background: #f5c332;
}
.badge.offline {
  background: #fff;
  border-color: #c5c7d0;
}
.badge.dnd {
  background: #fb275d;
}
</style>
