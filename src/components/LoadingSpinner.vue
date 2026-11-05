<script setup>
import { useId } from 'vue'

defineProps({
  label: { type: String, default: 'Loading' },
  size: { type: Number, default: 36 },
})

const loaderId = useId()
const trackGradientId = `${loaderId}-track`
const segmentGradientId = `${loaderId}-segment`
const endpointGradientId = `${loaderId}-endpoint`
const glowFilterId = `${loaderId}-glow`
</script>

<template>
  <span
    class="loading-spinner"
    role="status"
    :aria-label="label"
    :style="{ '--loading-spinner-size': `${size}px` }"
  >
    <svg class="loading-spinner__ring" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient :id="trackGradientId" x1="8" y1="12" x2="88" y2="92">
          <stop offset="0%" stop-color="#ddceff" />
          <stop offset="100%" stop-color="#cbb5f7" />
        </linearGradient>
        <linearGradient
          :id="segmentGradientId"
          x1="50"
          y1="7"
          x2="93"
          y2="50"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stop-color="#6533ff" />
          <stop offset="55%" stop-color="#5a27f7" />
          <stop offset="100%" stop-color="#5422ee" />
        </linearGradient>
        <radialGradient :id="endpointGradientId" cx="50%" cy="42%">
          <stop offset="0%" stop-color="#fff" />
          <stop offset="35%" stop-color="#fff" />
          <stop offset="72%" stop-color="#e7ddff" />
          <stop offset="100%" stop-color="#b99cff" stop-opacity="0" />
        </radialGradient>
        <filter :id="glowFilterId" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <circle
        class="loading-spinner__track"
        cx="50"
        cy="50"
        r="43"
        :stroke="`url(#${trackGradientId})`"
      />
      <g class="loading-spinner__arc">
        <circle
          class="loading-spinner__segment"
          cx="50"
          cy="50"
          r="43"
          :stroke="`url(#${segmentGradientId})`"
          stroke-linecap="round"
        />
        <circle
          cx="36.3"
          cy="90.8"
          r="7"
          :fill="`url(#${endpointGradientId})`"
          :filter="`url(#${glowFilterId})`"
        />
        <circle cx="36.3" cy="90.8" r="5" :fill="`url(#${endpointGradientId})`" />
        <circle class="loading-spinner__dot" cx="36.3" cy="90.8" r="4" fill="#fff" />
      </g>
    </svg>
  </span>
</template>

<style scoped>
.loading-spinner {
  display: inline-flex;
  flex: 0 0 auto;
  width: var(--loading-spinner-size);
  height: var(--loading-spinner-size);
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}

.loading-spinner__ring {
  width: 100%;
  height: 100%;
}

.loading-spinner__track,
.loading-spinner__segment {
  fill: none;
  stroke-width: 12;
}

.loading-spinner__arc {
  transform-box: view-box;
  transform-origin: center;
  animation: loading-spinner-rotate 1.5s linear infinite;
}

.loading-spinner__segment {
  stroke-dasharray: 82 188.18;
  stroke-linecap: round;
}

@keyframes loading-spinner-rotate {
  from {
    transform: rotate(-90deg);
  }
  to {
    transform: rotate(270deg);
  }
}
</style>
