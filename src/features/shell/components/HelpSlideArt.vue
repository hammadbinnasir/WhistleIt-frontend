<script setup>
// Built-in artwork for the "Discover more" carousel. Shown until a slide gets its own image
// (the slide's `media` in helpContent.js). Fills its parent, which must be `relative`.
defineProps({
  art: { type: String, required: true },
})
</script>

<template>
  <!-- What's new in Whistleit (dark background with 3D gift boxes) -->
  <div v-if="art === 'gift'" class="absolute inset-0 flex items-center justify-center bg-[#232042]">
    <svg
      width="220"
      height="130"
      viewBox="0 0 220 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <!-- Dark background shadow -->
      <ellipse cx="110" cy="110" rx="90" ry="16" fill="black" fill-opacity="0.25" />
      <!-- Left Large Red Box -->
      <g transform="translate(68, 42)">
        <path d="M42 22L0 38V85L42 70V22Z" fill="#C53030" />
        <path d="M42 22L84 38V85L42 70V22Z" fill="#E53E3E" />
        <path d="M42 22L0 38L42 54L84 38L42 22Z" fill="#F56565" />
        <!-- Yellow Ribbon -->
        <path d="M42 22L21 30L42 38L63 30L42 22Z" fill="#ECC94B" />
        <path d="M18 31V78L24 76V33L18 31Z" fill="#D69E2E" />
        <path d="M60 33V76L66 78V31L60 33Z" fill="#ECC94B" />
        <!-- Ribbon Bow -->
        <circle cx="38" cy="19" r="6" fill="#F6E05E" />
        <circle cx="46" cy="19" r="6" fill="#ECC94B" />
        <circle cx="42" cy="19" r="3" fill="#D69E2E" />
      </g>
      <!-- Right Cyan Small Box -->
      <g transform="translate(132, 62)">
        <path d="M22 12L0 20V50L22 42V12Z" fill="#2B6CB0" />
        <path d="M22 12L44 20V50L22 42V12Z" fill="#3182CE" />
        <path d="M22 12L0 20L22 28L44 20L22 12Z" fill="#63B3ED" />
        <!-- White/Red Ribbon -->
        <path d="M22 12L11 16L22 20L33 16L22 12Z" fill="#FED7D7" />
        <path d="M9 17V45L13 44V18L9 17Z" fill="#FC8181" />
        <path d="M31 18V44L35 45V17L31 18Z" fill="#FEB2B2" />
        <circle cx="22" cy="11" r="3" fill="#E53E3E" />
      </g>
    </svg>
  </div>

  <!-- Communication between companies (peach background with avatars) -->
  <div
    v-else-if="art === 'company'"
    class="absolute inset-0 flex items-center justify-center bg-[#fdf2e9]"
  >
    <div class="relative flex w-full items-center justify-center gap-12">
      <!-- Blue avatar -->
      <div
        class="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#1e88e5] text-white shadow-sm"
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5zm0 14c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"
          />
        </svg>
        <!-- Headset -->
        <div
          class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-blue-600 shadow-xs"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            aria-hidden="true"
          >
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          </svg>
        </div>
      </div>

      <!-- Center speech bubble node -->
      <div
        class="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      >
        <div class="flex h-11 w-11 items-center justify-center rounded-full bg-[#f97316] shadow-sm">
          <div class="flex h-6 w-8 items-center justify-center rounded-lg bg-white px-1 shadow-xs">
            <span class="pb-1 text-xs leading-none font-extrabold tracking-widest text-slate-700">
              ...
            </span>
          </div>
        </div>
        <!-- Small bottom blue node -->
        <div class="mt-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#1e88e5]">
          <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
        </div>
      </div>

      <!-- Connecting dotted arch line -->
      <svg
        class="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 300 120"
        fill="none"
        aria-hidden="true"
      >
        <path d="M90 60 Q 150 25 210 60" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4 4" />
      </svg>

      <!-- Orange avatar -->
      <div
        class="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#ea580c] text-white shadow-sm"
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5zm0 14c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"
          />
        </svg>
      </div>
    </div>
  </div>

  <!-- Quickly jump to another conversation (gold background with Ctrl/Cmd + K) -->
  <div
    v-else-if="art === 'jump'"
    class="absolute inset-0 flex flex-col items-center justify-center bg-[#f59e0b] px-6"
  >
    <!-- Mini search box mockup -->
    <div class="w-full max-w-[210px] space-y-1 rounded-lg bg-white/95 px-2.5 py-1.5 shadow-sm">
      <div class="flex items-center gap-1.5">
        <svg
          class="h-3 w-3 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <div class="h-2 w-16 rounded bg-slate-200"></div>
      </div>
      <div class="flex items-center gap-2 pt-0.5">
        <span class="text-[10px] font-bold text-slate-500">#</span>
        <div class="h-2 w-24 rounded bg-slate-100"></div>
      </div>
      <div class="flex items-center gap-2">
        <div class="h-3 w-3 rounded-full bg-slate-700"></div>
        <div class="h-2 w-14 rounded bg-slate-100"></div>
      </div>
    </div>

    <!-- Ctrl/Cmd + K badge -->
    <div class="mt-2.5 flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 shadow-md">
      <span class="text-xs font-bold text-slate-800">Ctrl/Cmd</span>
      <span class="text-xs font-bold text-slate-400">+</span>
      <span class="text-xs font-bold text-slate-800">K</span>
    </div>
  </div>
</template>
