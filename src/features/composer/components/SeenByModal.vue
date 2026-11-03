<script setup>
import { computed, ref } from 'vue'
import BaseModal from '@/features/account/components/BaseModal.vue'

const props = defineProps({
  viewers: { type: Array, default: () => [] },
})

const emit = defineEmits(['close'])
const query = ref('')

const filteredViewers = computed(() => {
  const search = query.value.trim().toLowerCase()
  if (!search) return props.viewers
  return props.viewers.filter((viewer) => viewer.name.toLowerCase().includes(search))
})

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
</script>

<template>
  <BaseModal @close="emit('close')">
    <section
      class="seen-by-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seen-by-title"
    >
      <button
        class="seen-by-dialog__close"
        type="button"
        aria-label="Close"
        @click="emit('close')"
      >
        ×
      </button>
      <h2 id="seen-by-title">Message Seen By</h2>

      <label class="seen-by-dialog__search">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <input v-model="query" type="search" placeholder="Search" aria-label="Search viewers" />
      </label>

      <ul v-if="filteredViewers.length" class="seen-by-dialog__list">
        <li v-for="viewer in filteredViewers" :key="viewer.id">
          <img v-if="viewer.avatarUrl" :src="viewer.avatarUrl" :alt="''" />
          <span v-else class="seen-by-dialog__avatar" aria-hidden="true">
            {{ initials(viewer.name) }}
          </span>
          <span>{{ viewer.name }}</span>
        </li>
      </ul>
      <p v-else class="seen-by-dialog__empty" role="status">
        {{ query ? 'No viewers match your search.' : 'No one has seen this message yet.' }}
      </p>
    </section>
  </BaseModal>
</template>

<style scoped>
.seen-by-dialog {
  position: relative;
  width: min(500px, 100%);
  box-sizing: border-box;
  padding: 26px 16px 14px;
  border-radius: 4px;
  background: #fff;
  color: #252536;
  box-shadow: 0 8px 32px rgb(0 0 0 / 22%);
}

.seen-by-dialog h2 {
  margin: 0 28px 28px;
  text-align: center;
  font-size: 20px;
  font-weight: 600;
}

.seen-by-dialog__close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 50%;
  background: #f0f0f5;
  color: #303044;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.seen-by-dialog__search {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid #6761d5;
  border-radius: 4px;
  color: #6761d5;
}

.seen-by-dialog__search svg {
  width: 19px;
  height: 19px;
  flex: 0 0 auto;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.seen-by-dialog__search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: #252536;
  font: inherit;
}

.seen-by-dialog__search input::placeholder {
  color: #9292a0;
}

.seen-by-dialog__list {
  display: grid;
  gap: 4px;
  max-height: min(320px, 45vh);
  margin: 10px 0 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.seen-by-dialog__list li {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 38px;
  padding: 3px 12px;
  color: #303044;
  font-size: 14px;
}

.seen-by-dialog__list img,
.seen-by-dialog__avatar {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  place-items: center;
  border-radius: 50%;
}

.seen-by-dialog__list img {
  object-fit: cover;
}

.seen-by-dialog__avatar {
  background: #7938c8;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.seen-by-dialog__empty {
  margin: 18px 12px 12px;
  color: #777785;
  font-size: 14px;
  text-align: center;
}
</style>