<script setup>
import { useUiStore } from '@/stores/ui'
import HelpDrawer from './HelpDrawer.vue'

const ui = useUiStore()

function closeHelp() {
  ui.toggleHelpModal()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ui.helpModalOpen"
      class="fixed inset-0 z-50 flex justify-end bg-black/40"
      data-testid="help-backdrop"
      @click.self="closeHelp"
    >
      <aside
        class="h-full w-full max-w-[480px] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Help and resources"
      >
        <HelpDrawer />
      </aside>
    </div>
  </Teleport>
</template>
