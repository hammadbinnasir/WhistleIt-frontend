<script setup>
defineEmits(['emoji', 'document', 'attachment', 'video', 'microphone'])
</script>

<template>
  <div class="message-composer__media" role="toolbar" aria-label="Media attachments">
    <button
      class="message-composer__media-button"
      type="button"
      aria-label="Emoji"
      title="Emoji"
      @click="$emit('emoji')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7" />
        <path d="M7.2 11.5c.7 1.1 1.6 1.7 2.8 1.7s2.1-.6 2.8-1.7" />
        <path d="M7.5 7.5h.01M12.5 7.5h.01" />
      </svg>
    </button>
    <button
      class="message-composer__media-button"
      type="button"
      aria-label="Document"
      title="Attach document"
      @click="$emit('document')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 2.5h6l4 4v11H5z" />
        <path d="M11 2.5v4h4M7.5 10h5M7.5 13h5" />
      </svg>
    </button>
    <button
      class="message-composer__media-button"
      type="button"
      aria-label="Attachment"
      title="Attach file"
      @click="$emit('attachment')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="m7.5 10.8 5.1-5.1a3 3 0 0 1 4.2 4.2l-7 7a4.5 4.5 0 0 1-6.4-6.4l7-7"
        />
      </svg>
    </button>
    <button
      class="message-composer__media-button"
      type="button"
      aria-label="Video"
      title="Video"
      @click="$emit('video')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.5" y="5" width="10.5" height="10" rx="1.5" />
        <path d="m13 8 4.5-2v8L13 12" />
      </svg>
    </button>
    <button
      class="message-composer__media-button"
      type="button"
      aria-label="Microphone"
      title="Microphone"
      @click="$emit('microphone')"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="7" y="2.5" width="6" height="10" rx="3" />
        <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3M7.5 18h5" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.message-composer__media {
  display: flex;
  align-items: center;
  gap: 4px;
}

.message-composer__media-button {
  display: grid;
  width: 28px;
  height: 30px;
  padding: 5px;
  place-items: center;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #34364b;
  cursor: pointer;
}

.message-composer__media-button:hover {
  background: #e1e2ec;
}

.message-composer__media-button:focus-visible {
  outline: 2px solid #5962ff;
  outline-offset: 1px;
}

.message-composer__media-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}
</style>
