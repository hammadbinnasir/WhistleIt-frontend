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
      class="shell-modal-backdrop shell-modal-backdrop--drawer fixed inset-0 flex justify-end"
      data-testid="help-backdrop"
      @click.self="closeHelp"
    >
      <aside
        class="shell-surface h-full w-full max-w-[432px] rounded-none"
        role="dialog"
        aria-modal="true"
        aria-label="Help and resources"
      >
        <HelpDrawer />
      </aside>
    </div>
  </Teleport>
</template>
