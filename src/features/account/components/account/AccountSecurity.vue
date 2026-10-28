<script setup>
import { ref, reactive, computed } from 'vue'

const props = defineProps({
  security: { type: Object, default: () => ({}) },
})

const hideEmail = ref(props.security.hideEmail ?? false)

const passwords = reactive({ old: '', next: '', confirm: '' })
const showPw = reactive({ old: false, next: false, confirm: false })
const touched = reactive({ old: false, next: false, confirm: false })
const attempted = ref(false)

const passwordFields = [
  { key: 'old', placeholder: 'Old Password', autocomplete: 'current-password' },
  { key: 'next', placeholder: 'Enter New Password', autocomplete: 'new-password' },
  { key: 'confirm', placeholder: 'Confirm New Password', autocomplete: 'new-password' },
]

const changingPassword = computed(() => !!(passwords.old || passwords.next || passwords.confirm))

const errors = computed(() => {
  const errs = {}
  const submitting = attempted.value && changingPassword.value

  if (!passwords.old && (touched.old || submitting)) {
    errs.old = 'Required.'
  }

  if (!passwords.next && submitting) {
    errs.next = 'Required.'
  } else if (passwords.next && passwords.next.length < 8 && (touched.next || attempted.value)) {
    errs.next = 'Must be at least 8 characters.'
  }

  if (!passwords.confirm && submitting) {
    errs.confirm = 'Required.'
  } else if (
    passwords.confirm &&
    passwords.confirm !== passwords.next &&
    (touched.confirm || attempted.value)
  ) {
    errs.confirm = 'Passwords do not match.'
  }

  return errs
})

/** Returns true when it is OK to save. Password rules only apply if the user is changing it. */
const validate = () => {
  attempted.value = true
  return !(changingPassword.value && Object.keys(errors.value).length)
}

const getValues = () => ({
  security: { hideEmail: hideEmail.value },
  password: changingPassword.value
    ? { oldPassword: passwords.old, newPassword: passwords.next }
    : null,
})

defineExpose({ validate, getValues })
</script>

<template>
  <div class="security">
    <div class="email-row">
      <div class="email-text">
        <h4 class="sec-heading">Email</h4>
        <p class="email-desc">Email will not be shown to other users of your workspace.</p>
      </div>
      <button
        type="button"
        class="toggle"
        :class="{ on: hideEmail }"
        role="switch"
        :aria-checked="hideEmail"
        aria-label="Hide email from other users"
        @click="hideEmail = !hideEmail"
      >
        <span class="knob"></span>
      </button>
    </div>

    <h4 class="sec-heading password-heading">Password</h4>

    <div v-for="pf in passwordFields" :key="pf.key" class="pw-field">
      <div class="pw-control" :class="{ invalid: errors[pf.key] }">
        <input
          v-model="passwords[pf.key]"
          class="pw-input"
          :type="showPw[pf.key] ? 'text' : 'password'"
          :placeholder="pf.placeholder"
          :autocomplete="pf.autocomplete"
          :aria-invalid="!!errors[pf.key]"
          @blur="touched[pf.key] = true"
        />
        <button
          type="button"
          class="eye"
          :aria-label="showPw[pf.key] ? 'Hide password' : 'Show password'"
          @click="showPw[pf.key] = !showPw[pf.key]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            <path v-if="!showPw[pf.key]" d="M4 4l16 16" />
          </svg>
        </button>
      </div>
      <span v-if="errors[pf.key]" class="pw-error">{{ errors[pf.key] }}</span>
    </div>
  </div>
</template>

<style scoped>
.security {
  padding: 0 24px;
}

.email-row {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  margin-top: 24px;
}

.email-text {
  width: 200px;
}

.sec-heading {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #323248;
}

.email-desc {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 24px;
  color: #9a9ba5;
}

.toggle {
  position: relative;
  flex-shrink: 0;
  width: 56px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 14px;
  background: #e4e4e8;
  cursor: pointer;
  transition: background 0.2s;
}
.toggle.on {
  background: #5559f4;
}
.toggle:focus-visible {
  box-shadow: 0 0 0 3px rgba(85, 89, 244, 0.3);
  outline: none;
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
}
.toggle.on .knob {
  transform: translateX(28px);
}

.password-heading {
  margin-top: 28px;
  margin-bottom: 16px;
}

.pw-field {
  position: relative;
  margin-bottom: 24px;
}

.pw-control {
  display: flex;
  align-items: center;
  height: 46px;
  box-sizing: border-box;
  padding: 0 14px;
  background: #fff;
  border: 1px solid #a5a6b0;
  border-radius: 4px;
}
.pw-control:focus-within {
  border-color: #5559f4;
}
.pw-control.invalid {
  border: 2px solid #fb275d;
  padding: 0 13px;
}

.pw-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 16px;
  color: #1f1f2e;
}
.pw-input::placeholder {
  color: #a8a9b2;
}
.pw-control.invalid .pw-input,
.pw-control.invalid .pw-input::placeholder {
  color: #fb275d;
}

.eye {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  padding: 3px;
  border: none;
  background: transparent;
  color: #8a8b96;
  cursor: pointer;
}
.eye svg {
  width: 100%;
  height: 100%;
}
.eye:hover {
  color: #5559f4;
}
.pw-control.invalid .eye {
  color: #fb275d;
}

.pw-error {
  position: absolute;
  left: 15px;
  top: 51px;
  font-size: 13px;
  color: #fb275d;
}
</style>
