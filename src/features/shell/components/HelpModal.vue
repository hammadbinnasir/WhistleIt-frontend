<script setup>
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const shortcuts = [
  { keys: ['Ctrl', 'K'], desc: 'Quick search messages & channels' },
  { keys: ['Ctrl', 'Shift', 'T'], desc: 'Switch team/workspace' },
  { keys: ['Esc'], desc: 'Close dialog or modal' },
  { keys: ['Alt', '↑ / ↓'], desc: 'Navigate channels' },
  { keys: ['Ctrl', 'Enter'], desc: 'Send message' },
]

function handleClose() {
  ui.toggleHelpModal()
}
</script>

<template>
  <div
    v-if="ui.helpModalOpen"
    class="modal-backdrop"
    @click.self="handleClose"
    role="dialog"
    aria-modal="true"
    aria-labelledby="help-title"
  >
    <div class="modal-card">
      <div class="modal-header">
        <div class="header-content">
          <div class="icon-circle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 id="help-title" class="modal-title">Help & Resources</h3>
            <span class="modal-subtitle">WhistleIt Workspace Guide</span>
          </div>
        </div>
        <button
          type="button"
          class="close-btn"
          aria-label="Close dialog"
          @click="handleClose"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- Keyboard shortcuts -->
        <div class="section">
          <h4 class="section-title">Keyboard Shortcuts</h4>
          <div class="shortcut-list">
            <div v-for="item in shortcuts" :key="item.desc" class="shortcut-row">
              <span class="shortcut-desc">{{ item.desc }}</span>
              <div class="keys-group">
                <kbd v-for="k in item.keys" :key="k" class="key-cap">{{ k }}</kbd>
              </div>
            </div>
          </div>
        </div>

        <!-- Helpful tips -->
        <div class="section">
          <h4 class="section-title">Quick Tips</h4>
          <ul class="tips-list">
            <li>Use the left rail to jump between different teams and workspaces instantly.</li>
            <li>Click <strong>+</strong> on the team rail to create a new workspace or discover team workspaces.</li>
            <li>Use <strong>Manage</strong> in the Members section to invite or remove team members.</li>
          </ul>
        </div>
      </div>

      <div class="modal-footer">
        <span class="version-tag">WhistleIt v0.1.0 • Built with Vue 3 & Vite</span>
        <button type="button" class="btn-primary" @click="handleClose">
          Got it
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 8, 18, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 500px;
  background: #1e1b2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
  color: #f1f5f9;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-circle {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(124, 58, 237, 0.15);
  color: #7c3aed;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: #fff;
}

.modal-subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
}

.shortcut-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.keys-group {
  display: flex;
  gap: 4px;
}

.key-cap {
  font-family: monospace;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  color: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.tips-list {
  margin: 0;
  padding-left: 18px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.version-tag {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.btn-primary {
  background: #7c3aed;
  border: none;
  color: #fff;
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-primary:hover {
  background: #6d28d9;
}
</style>
