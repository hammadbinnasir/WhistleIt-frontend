import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui' // the app's existing UI store (owned by the project setup)

// The ONLY file in the module that touches the app's ui store.
// If the project later switches to vue-router, change just this file.
export function useActiveChannel() {
  const ui = useUiStore()
  const { selectedChannelId } = storeToRefs(ui)

  const activeId = computed(() => (selectedChannelId.value ? String(selectedChannelId.value) : null))

  function select(id) {
    ui.selectChannel(String(id))
  }
  function clear() {
    ui.selectChannel(null)
  }

  return { activeId, select, clear }
}
