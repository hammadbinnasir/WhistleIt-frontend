<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { getVoiceNote, getVoiceNoteFile } from './voiceNotesApi'

const props = defineProps({
  voiceNoteId: { type: [String, Number], required: true },
})

const audioUrl = ref('')
const fileName = ref('voice-message')
const loading = ref(false)
const error = ref('')
let requestVersion = 0

function revokeAudioUrl() {
  if (!audioUrl.value) return
  URL.revokeObjectURL(audioUrl.value)
  audioUrl.value = ''
}

async function loadAudio() {
  const version = ++requestVersion
  revokeAudioUrl()
  loading.value = true
  error.value = ''
  try {
    const details = await getVoiceNote(props.voiceNoteId)
    if (version !== requestVersion) return
    fileName.value = details.file_name ?? details.filename ?? 'voice-message'
    const file = await getVoiceNoteFile(props.voiceNoteId, details)
    if (version !== requestVersion) return
    if (!(file instanceof Blob) || !file.size) {
      throw new Error('The audio file was empty or unavailable.')
    }
    audioUrl.value = URL.createObjectURL(file)
  } catch (cause) {
    if (version === requestVersion) {
      error.value = cause instanceof Error ? cause.message : 'Could not load this voice message.'
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(() => props.voiceNoteId, loadAudio, { immediate: true })
onBeforeUnmount(() => {
  requestVersion += 1
  revokeAudioUrl()
})
</script>

<template>
  <div class="voice-note-player" :aria-busy="loading">
    <audio v-if="audioUrl" :src="audioUrl" controls preload="metadata">
      Your browser does not support audio playback.
    </audio>
    <span v-else-if="loading" role="status">Loading voice message…</span>
    <div v-else-if="error" class="voice-note-player__error" role="alert">
      <span>{{ error }}</span>
      <button type="button" @click="loadAudio">Retry</button>
    </div>
    <a v-if="audioUrl" class="voice-note-player__download" :href="audioUrl" :download="fileName">
      Download audio
    </a>
  </div>
</template>

<style scoped>
.voice-note-player {
  display: grid;
  max-width: min(360px, 100%);
  gap: 6px;
  margin: 8px 0;
  color: #55596d;
  font-size: 12px;
}

.voice-note-player audio {
  display: block;
  width: 100%;
  min-width: 240px;
  height: 40px;
}

.voice-note-player__download {
  color: inherit;
}

.voice-note-player__error {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #b42318;
}

.voice-note-player__error button {
  border: 0;
  background: transparent;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}
</style>
