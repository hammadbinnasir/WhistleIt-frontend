<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { fetchMessageAttachment, messageAttachmentKind } from './messageAttachments'

const props = defineProps({
  attachment: { type: Object, required: true },
  conversationType: { type: String, required: true },
  companyId: { type: [String, Number], required: true },
  teamId: { type: [String, Number], default: null },
  channelId: { type: [String, Number], required: true },
  messageId: { type: [String, Number], required: true },
})

const fileUrl = ref('')
const error = ref('')
const loading = ref(false)
let ownsFileUrl = false
let loadId = 0

function revokeFileUrl() {
  if (!ownsFileUrl || !fileUrl.value.startsWith('blob:')) {
    fileUrl.value = ''
    ownsFileUrl = false
    return
  }
  URL.revokeObjectURL(fileUrl.value)
  fileUrl.value = ''
  ownsFileUrl = false
}

async function loadFile() {
  const currentLoadId = ++loadId
  revokeFileUrl()
  error.value = ''
  if (
    typeof props.attachment.localPreviewUrl === 'string' &&
    props.attachment.localPreviewUrl.startsWith('blob:')
  ) {
    fileUrl.value = props.attachment.localPreviewUrl
    loading.value = false
    return
  }

  loading.value = true
  try {
    const blob = await fetchMessageAttachment(props.attachment, {
      conversationType: props.conversationType,
      companyId: props.companyId,
      teamId: props.teamId,
      channelId: props.channelId,
      messageId: props.messageId,
    })
    if (currentLoadId !== loadId) return
    fileUrl.value = URL.createObjectURL(blob)
    ownsFileUrl = true
  } catch (cause) {
    if (currentLoadId === loadId) {
      error.value = cause instanceof Error ? cause.message : 'Unable to load attachment.'
    }
  } finally {
    if (currentLoadId === loadId) loading.value = false
  }
}

watch(
  () => [
    props.attachment,
    props.conversationType,
    props.companyId,
    props.teamId,
    props.channelId,
    props.messageId,
  ],
  loadFile,
  { immediate: true },
)
onBeforeUnmount(() => {
  loadId += 1
  revokeFileUrl()
})
</script>

<template>
  <div class="message-attachment" :aria-busy="loading">
    <span v-if="loading" class="message-attachment__status" role="status">Loading attachment…</span>
    <div v-else-if="error" class="message-attachment__error" role="alert">
      <span>{{ error }}</span>
    </div>
    <template v-else-if="fileUrl">
      <div
        v-if="messageAttachmentKind(attachment) === 'image'"
        class="message-attachment__image-card"
      >
        <div class="message-attachment__name">
          <span>{{ attachment.name || attachment.file_name || 'Image' }}</span>
          <span class="message-attachment__open-indicator" aria-hidden="true">↗</span>
        </div>
        <div class="message-attachment__image-frame">
          <a
            class="message-attachment__image-link"
            :href="fileUrl"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`Open image ${attachment.name || attachment.file_name || 'attachment'}`"
          >
            <img
              class="message-attachment__image"
              :src="fileUrl"
              :alt="attachment.name || attachment.file_name || 'Image attachment'"
              loading="lazy"
            />
          </a>
          <div class="message-attachment__actions">
            <a
              class="message-attachment__action-button"
              :href="fileUrl"
              :download="attachment.name || attachment.file_name || 'image'"
              :aria-label="`Download ${attachment.name || attachment.file_name || 'image'}`"
              title="Download"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
      <div v-else class="message-attachment__document">
        <div class="message-attachment__name">
          <span>1 File</span>
          <span class="message-attachment__open-indicator" aria-hidden="true">↗</span>
        </div>
        <div class="message-attachment__file-card">
          <span
            class="message-attachment__icon"
            :class="`is-${messageAttachmentKind(attachment)}`"
            aria-hidden="true"
          >
            {{
              messageAttachmentKind(attachment) === 'pdf'
                ? 'PDF'
                : messageAttachmentKind(attachment) === 'word'
                  ? 'DOC'
                  : 'FILE'
            }}
          </span>
          <span class="message-attachment__details">
            <strong>{{ attachment.name || attachment.file_name || 'Attachment' }}</strong>
            <small v-if="attachment.size">{{ Math.ceil(attachment.size / 1024) }} KB</small>
          </span>
          <div class="message-attachment__actions">
            <a
              class="message-attachment__action-button"
              :href="fileUrl"
              :download="attachment.name || attachment.file_name || 'attachment'"
              :aria-label="`Download ${attachment.name || attachment.file_name || 'attachment'}`"
              title="Download"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.message-attachment {
  width: min(100%, 320px);
}

.message-attachment__status,
.message-attachment__error {
  color: #696d81;
  font-size: 12px;
}

.message-attachment__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #b42318;
}

.message-attachment__image-card,
.message-attachment__document {
  display: grid;
  gap: 7px;
  width: fit-content;
  max-width: 100%;
}

.message-attachment__name {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: #4a4b5c;
  font-size: 12px;
  line-height: 1.35;
}

.message-attachment__name > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-attachment__open-indicator {
  flex: 0 0 auto;
  color: #77798b;
  font-size: 11px;
}

.message-attachment__image-frame {
  position: relative;
  overflow: hidden;
  width: fit-content;
  max-width: 100%;
  border-top: 4px solid #45445f;
  border-bottom: 4px solid #45445f;
  background: #282738;
  box-shadow: 0 3px 8px rgb(22 24 40 / 30%);
  transition:
    box-shadow 140ms ease,
    background-color 140ms ease;
}

.message-attachment__image-link {
  display: block;
  max-width: 100%;
}

.message-attachment__image {
  display: block;
  width: auto;
  max-width: min(276px, 100%);
  max-height: 220px;
  object-fit: cover;
  transition:
    filter 140ms ease,
    opacity 140ms ease;
}

.message-attachment__file-card {
  position: relative;
  display: flex;
  width: min(100%, 280px);
  min-height: 54px;
  align-items: center;
  gap: 9px;
  padding: 6px 48px 6px 8px;
  border: 1px solid #d4d7e3;
  border-radius: 6px;
  background: #fff;
  transition:
    background-color 140ms ease,
    box-shadow 140ms ease,
    color 140ms ease;
}

.message-attachment__icon {
  display: grid;
  width: 36px;
  height: 40px;
  flex: 0 0 36px;
  place-items: center;
  border: 1px solid #c9cbd6;
  border-radius: 5px;
  color: #5962ff;
  font-size: 10px;
  font-weight: 700;
}

.message-attachment__icon.is-pdf {
  color: #c53737;
}

.message-attachment__icon.is-word {
  color: #2867b2;
}

.message-attachment__details {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}

.message-attachment__details strong {
  overflow: hidden;
  color: #25263a;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-attachment__details small {
  color: #696d81;
  font-size: 11px;
}

.message-attachment__actions {
  position: absolute;
  z-index: 1;
  right: 7px;
  bottom: 7px;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

.message-attachment__action-button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: #fff;
  color: #514bc7;
  cursor: pointer;
  text-decoration: none;
}

.message-attachment__action-button:hover {
  background: #f0efff;
}

.message-attachment__action-button svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.message-attachment__image-frame:hover,
.message-attachment__image-frame:focus-within {
  box-shadow: 0 5px 13px rgb(22 24 40 / 42%);
}

.message-attachment__image-frame:hover .message-attachment__image,
.message-attachment__image-frame:focus-within .message-attachment__image {
  filter: brightness(0.62);
}

.message-attachment__image-frame:hover .message-attachment__actions,
.message-attachment__image-frame:focus-within .message-attachment__actions,
.message-attachment__file-card:hover .message-attachment__actions,
.message-attachment__file-card:focus-within .message-attachment__actions {
  opacity: 1;
  pointer-events: auto;
}

.message-attachment__file-card:hover,
.message-attachment__file-card:focus-within {
  background: #66647f;
  box-shadow: 0 4px 10px rgb(22 24 40 / 32%);
  color: #fff;
}

.message-attachment__file-card:hover .message-attachment__details strong,
.message-attachment__file-card:focus-within .message-attachment__details strong,
.message-attachment__file-card:hover .message-attachment__details small,
.message-attachment__file-card:focus-within .message-attachment__details small {
  color: #fff;
}

@media (hover: none) {
  .message-attachment__actions {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
