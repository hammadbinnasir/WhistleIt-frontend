<script setup>
import { ref } from 'vue'
import { UserModule } from './modules/user'

// Replace with data from your backend later.
const user = {
  profile: { fullName: 'Hammad Haider' },
  status: 'online',
}

const lastEvent = ref('none yet')
const log = (name, detail = '') => {
  lastEvent.value = detail ? `${name}: ${detail}` : name
}
</script>

<template>
  <div class="app">
    <main>
      <h1>User module demo</h1>
      <p>Click the avatar at the bottom-left to open the menu.</p>
      <p class="event">Last event: <b>{{ lastEvent }}</b></p>
    </main>

    <UserModule
      :user="user"
      @status-change="(s) => log('status-change', s)"
      @custom-status-change="(t) => log('custom-status-change', t || '(cleared)')"
      @settings-saved="() => log('settings-saved')"
      @leave-team="log('leave-team')"
      @log-out="log('log-out')"
      @error="(e) => log('error', e?.message)"
    />
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: 'Roboto', -apple-system, 'Segoe UI', sans-serif;
  background: #f5f6f8;
  color: #1f1f2e;
}
.app {
  min-height: 100vh;
  padding: 40px;
  box-sizing: border-box;
}
.event b {
  color: #5559f4;
}
</style>
