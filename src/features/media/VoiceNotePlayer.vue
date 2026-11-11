<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getVoiceNote, getVoiceNoteFile } from './voiceNotesApi'

const props = defineProps({
  voiceNoteId: { type: [String, Number], default: null },
  previewUrl: { type: String, default: '' },
})

const audioElement = ref(null)
const audioUrl = ref('')
const fileName = ref('voice-message')
const loading = ref(false)
const error = ref('')
const playing = ref(false)
const muted = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playbackRate = ref(1)
const waveform = [3, 5, 8, 5, 10, 6, 12, 7, 4, 9, 6, 11, 5, 8, 4, 7, 10, 5, 8, 4, 11, 6, 9, 4]
let requestVersion = 0
let ownsAudioUrl = false

const progress = computed(() =>
  duration.value > 0 ? Math.min(currentTime.value / duration.value, 1) : 0,
)

function revokeAudioUrl() {
  if (ownsAudioUrl && audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  ownsAudioUrl = false
  audioUrl.value = ''
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = String(wholeSeconds % 60).padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

function updateDuration() {
  const audio = audioElement.value
  if (!audio) return
  duration.value = audio.duration || 0
  audio.playbackRate = playbackRate.value
  audio.muted = muted.value
}

function updateCurrentTime() {
  currentTime.value = audioElement.value?.currentTime || 0
}

async function togglePlayback() {
  const audio = audioElement.value
  if (!audio) return

  if (audio.paused) {
    try {
      await audio.play()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not play this voice message.'
    }
  } else {
    audio.pause()
  }
}

function seekTo(event) {
  if (!audioElement.value || duration.value <= 0) return
  const bounds = event.currentTarget.getBoundingClientRect()
  if (!bounds.width) return
  const position = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1)
  audioElement.value.currentTime = position * duration.value
  updateCurrentTime()
}

function handleWaveformKeydown(event) {
  if (!audioElement.value || duration.value <= 0) return
  const seekBy = event.shiftKey ? 10 : 5
  if (event.key === 'ArrowRight') audioElement.value.currentTime += seekBy
  else if (event.key === 'ArrowLeft') audioElement.value.currentTime -= seekBy
  else if (event.key === 'Home') audioElement.value.currentTime = 0
  else if (event.key === 'End') audioElement.value.currentTime = duration.value
  else return
  event.preventDefault()
  updateCurrentTime()
}

function toggleMute() {
  muted.value = !muted.value
  if (audioElement.value) audioElement.value.muted = muted.value
}

function cyclePlaybackRate() {
  const rates = [1, 1.25, 1.5, 2]
  const nextRate = rates[(rates.indexOf(playbackRate.value) + 1) % rates.length]
  playbackRate.value = nextRate
  if (audioElement.value) audioElement.value.playbackRate = nextRate
}

async function loadAudio() {
  const version = ++requestVersion
  revokeAudioUrl()
  loading.value = true
  error.value = ''
  playing.value = false
  currentTime.value = 0
  duration.value = 0
  if (props.previewUrl) {
    audioUrl.value = props.previewUrl
    loading.value = false
    return
  }
  if (props.voiceNoteId == null) {
    loading.value = false
    error.value = 'This voice message is unavailable.'
    return
  }
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
    ownsAudioUrl = true
  } catch (cause) {
    if (version === requestVersion) {
      error.value = cause instanceof Error ? cause.message : 'Could not load this voice message.'
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(() => [props.voiceNoteId, props.previewUrl], loadAudio, { immediate: true })
onBeforeUnmount(() => {
  requestVersion += 1
  revokeAudioUrl()
})
</script>

<template>
  <div class="voice-note-player" :aria-busy="loading">
    <audio
      v-if="audioUrl"
      ref="audioElement"
      class="voice-note-player__audio"
      :src="audioUrl"
      preload="metadata"
      @loadedmetadata="updateDuration"
      @durationchange="updateDuration"
      @timeupdate="updateCurrentTime"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false"
    />

    <div v-if="audioUrl" class="voice-note-player__controls">
      <button
        class="voice-note-player__play"
        type="button"
        :aria-label="playing ? 'Pause voice message' : 'Play voice message'"
        @click="togglePlayback"
      >
        <svg v-if="playing" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </button>

      <div
        class="voice-note-player__waveform"
        role="slider"
        tabindex="0"
        aria-label="Seek voice message"
        :aria-valuemin="0"
        :aria-valuemax="Math.floor(duration)"
        :aria-valuenow="Math.floor(currentTime)"
        :aria-valuetext="`${formatTime(currentTime)} of ${formatTime(duration)}`"
        @click="seekTo"
        @keydown="handleWaveformKeydown"
      >
        <span
          v-for="(height, index) in waveform"
          :key="index"
          class="voice-note-player__bar"
          :class="{ 'voice-note-player__bar--played': (index + 1) / waveform.length <= progress }"
          :style="{ height: `${height}px` }"
        />
      </div>

      <span class="voice-note-player__time" aria-live="off">
        {{ formatTime(currentTime) }}/{{ formatTime(duration) }}
      </span>

      <button
        class="voice-note-player__volume"
        type="button"
        :aria-label="muted ? 'Unmute voice message' : 'Mute voice message'"
        @click="toggleMute"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
          <path
            v-if="!muted"
            d="M16 9a5 5 0 0 1 0 6m2-9a8 8 0 0 1 0 12"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.8"
          />
          <path
            v-else
            d="m16 9 5 6m0-6-5 6"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-width="1.8"
          />
        </svg>
      </button>

      <button
        class="voice-note-player__speed"
        type="button"
        :aria-label="`Playback speed ${playbackRate} times`"
        @click="cyclePlaybackRate"
      >
        {{ playbackRate }}x
      </button>

      <a
        class="voice-note-player__download"
        :href="audioUrl"
        :download="fileName"
        :aria-label="`Download ${fileName}`"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3v11m0 0 4-4m-4 4-4-4M5 18v2h14v-2"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
          />
        </svg>
      </a>
    </div>

    <span v-else-if="loading" class="voice-note-player__status" role="status">
      Loading voice message…
    </span>
    <div v-else-if="error" class="voice-note-player__error" role="alert">
      <span>{{ error }}</span>
      <button type="button" @click="loadAudio">Retry</button>
    </div>
  </div>
</template>

<style scoped>
.voice-note-player {
  width: min(320px, 100%);
  margin: 8px 0;
  color: #55596d;
  font-size: 12px;
}

.voice-note-player__audio {
  display: none;
}

.voice-note-player__controls {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  min-height: 56px;
  padding: 8px 10px 8px 7px;
  border: 1px solid #dedde8;
  border-radius: 22px;
  background: #f3f2f8;
}

.voice-note-player__play {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #494477;
  color: #fff;
  cursor: pointer;
}

.voice-note-player__play svg {
  width: 19px;
  height: 19px;
}

.voice-note-player__waveform {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: space-between;
  min-width: 32px;
  height: 32px;
  gap: 2px;
  cursor: pointer;
  outline-offset: 3px;
}

.voice-note-player__bar {
  width: 3px;
  min-height: 3px;
  border-radius: 2px;
  background: #aab9ca;
}

.voice-note-player__bar--played {
  background: #514d7d;
}

.voice-note-player__time {
  flex: 0 0 auto;
  color: #202034;
  white-space: nowrap;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.voice-note-player__volume,
.voice-note-player__download {
  display: grid;
  flex: 0 0 22px;
  width: 22px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #696a75;
  cursor: pointer;
}

.voice-note-player__volume svg,
.voice-note-player__download svg {
  width: 19px;
  height: 19px;
}

.voice-note-player__speed {
  flex: 0 0 auto;
  min-width: 36px;
  padding: 5px 7px;
  border: 1px solid #d5d4dd;
  border-radius: 14px;
  background: transparent;
  color: #373644;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.voice-note-player__play:focus-visible,
.voice-note-player__volume:focus-visible,
.voice-note-player__speed:focus-visible,
.voice-note-player__download:focus-visible {
  outline: 2px solid #514d7d;
  outline-offset: 2px;
}

.voice-note-player__status {
  display: inline-block;
  padding: 10px 12px;
  color: #55596d;
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

@media (max-width: 360px) {
  .voice-note-player__controls {
    gap: 5px;
    padding-right: 7px;
  }

  .voice-note-player__time {
    font-size: 10px;
  }
}
</style>
