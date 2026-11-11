<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { http } from '@/features/channels/api/http'
import { messageAttachmentKind, messageAttachmentUrl } from './messageAttachments'

const props = defineProps({
  attachment: { type: Object, required: true },
})

const fileUrl = ref('')
const error = ref('')
const loading = ref(false)
let requestVersion = 0
let ownsFileUrl = false

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
  const version = ++requestVersion
  revokeFileUrl()
  error.value = ''
  const sourceUrl = messageAttachmentUrl(props.attachment)
  if (!sourceUrl) {
    loading.value = false
    error.value = 'The server did not provide a file URL or storage path.'
    return
  }
  if (sourceUrl.startsWith('blob:')) {
    fileUrl.value = sourceUrl
    loading.value = false
    return
  }

  loading.value = true
  try {
    const file = await http(sourceUrl, { responseType: 'blob' })
    if (version !== requestVersion) return
    if (!(file instanceof Blob) || !file.size) {
      throw new Error('The server returned an empty or invalid file.')
    }
    fileUrl.value = URL.createObjectURL(file)
    ownsFileUrl = true
  } catch (cause) {
    if (version === requestVersion) {
      error.value =
        cause?.status === 0
          ? 'Could not reach the attachment server. Check the connection and allow CORS for authenticated /storage requests.'
          : cause instanceof Error
            ? cause.message
            : 'Unable to load this attachment.'
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(() => props.attachment, loadFile, { immediate: true })
onBeforeUnmount(() => {
  requestVersion += 1
  revokeFileUrl()
})
</script>

<template>
  <div class="message-attachment" :aria-busy="loading">
    <span v-if="loading" class="message-attachment__status" role="status">Loading attachment…</span>
    <div v-else-if="error" class="message-attachment__error" role="alert">
      <span>{{ error }}</span>
      <button type="button" @click="loadFile">Retry</button>
    </div>
    <a
      v-else-if="messageAttachmentKind(attachment) === 'image' && fileUrl"
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
    <div v-else class="message-attachment__file-card">
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
      <template v-if="fileUrl">
        <a :href="fileUrl" target="_blank" rel="noopener noreferrer">Open</a>
        <a :href="fileUrl" :download="attachment.name || attachment.file_name || 'attachment'">
          Download
        </a>
      </template>
    </div>
  </div>
</template>

<style scoped>
.message-attachment {
  width: min(100%, 360px);
  margin-top: 8px;
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

.message-attachment__error button {
  border: 0;
  background: transparent;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.message-attachment__image-link {
  display: block;
  width: fit-content;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid #d5d7e2;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 5px rgb(22 24 40 / 16%);
}

.message-attachment__image {
  display: block;
  width: min(280px, 100%);
  height: 190px;
  object-fit: contain;
}

.message-attachment__file-card {
  display: flex;
  width: min(100%, 300px);
  min-height: 48px;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid #d5d7e2;
  border-radius: 7px;
  background: #fff;
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

.message-attachment__file-card > a {
  flex: 0 0 auto;
  color: #514bc7;
  font-size: 11px;
  font-weight: 600;
}
</style>
