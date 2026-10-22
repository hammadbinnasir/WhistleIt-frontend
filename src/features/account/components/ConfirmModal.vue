<script setup>
defineProps({
  title: { type: String, required: true },
  message: { type: String, default: '' },
  confirmText: { type: String, default: 'CONFIRM' },
  cancelText: { type: String, default: 'CANCEL' },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div
    class="confirm"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    aria-describedby="confirm-message"
  >
    <div class="icon-circle" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="#fb275d">
        <circle cx="12" cy="5.8" r="2" />
        <rect x="10.2" y="9.6" width="3.6" height="9.4" rx="1.8" />
      </svg>
    </div>

    <h2 id="confirm-title" class="title">{{ title }}</h2>
    <p id="confirm-message" class="message">{{ message }}</p>

    <div class="actions">
      <button type="button" class="btn cancel" data-autofocus @click="emit('cancel')">
        {{ cancelText }}
      </button>
      <button type="button" class="btn danger" :disabled="busy" @click="emit('confirm')">
        {{ confirmText }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.confirm {
  width: 626px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 18px 24px 34px;
  text-align: center;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  font-family: 'Roboto', -apple-system, 'Segoe UI', sans-serif;
  color: #1f1f2e;
}

.icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62px;
  height: 62px;
  margin: 0 auto;
  border-radius: 50%;
  background: #efeff7;
}
.icon-circle svg {
  width: 34px;
  height: 34px;
}

.title {
  margin: 44px 0 0;
  font-size: 22px;
  font-weight: 500;
  line-height: 28px;
  color: #1f1f2e;
}

.message {
  margin: 36px 0 0;
  font-size: 18px;
  line-height: 24px;
  color: #4a4a5a;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 33px;
}

.btn {
  min-width: 134px;
  height: 40px;
  padding: 0 20px;
  font-family: inherit;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 1px;
  border-radius: 4px;
  cursor: pointer;
}

.cancel {
  background: #fff;
  color: #3b3b4f;
  border: 1px solid #c9cbd9;
}
.cancel:hover { background: #f4f4f7; }
.cancel:focus-visible { outline: 2px solid #5559f4; outline-offset: 2px; }

.danger {
  background: #fe3856;
  color: #fff;
  border: 1px solid #fe3856;
}
.danger:hover:not(:disabled) { background: #ec2745; }
.danger:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
